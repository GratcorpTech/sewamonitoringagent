import { getActiveApplication } from "./monitor/activeApplication.js";
import { startIdleMonitoring } from "./monitor/idleDetection.js";
import { SessionTracker } from "./monitor/sessionTracker.js";
import { getDeviceInfo } from "./device/deviceInfo.js";
import { logInfo, logError } from "./utils/logger.js";
import { sendUsageSession } from "./sync/apiService.js";
import { initializeMonitoredApplications } from "./monitor/applicationMatcher.js";
import { initDatabase, closeDatabase } from "./storage/database.js";

import {
  enqueueSession,
  getPendingSessions,
  deleteSyncedSession,
  markSessionFailed,
  saveActiveCheckpoint,
  getActiveCheckpoint,
  clearActiveCheckpoint,
} from "./storage/sessionQueue.js";

import {
  acquireSingleInstance,
  releaseSingleInstance,
} from "./utils/singleInstance.js";

const IDLE_THRESHOLD = 15000;
const SYNC_INTERVAL = 10000;
const CHECKPOINT_INTERVAL = 30000;
const APPLICATION_REFRESH_INTERVAL = 2 * 60 * 1000;

let isIdle = false;
let isCheckingApplication = false;
let isSyncing = false;
let isShuttingDown = false;
let isShutdownStarted = false;
let lastObservedApplication = null;

let syncInterval;
let checkpointInterval;
let monitoringInterval;
let stopIdleMonitoring;
let applicationRefreshInterval;

async function startAgent() {
  // 1. Acquire mutex before initializing SQLite or monitoring.
  const acquired = await acquireSingleInstance();

  if (!acquired) {
    logInfo(
      "Another SEWA Monitoring Agent instance is already running. Exiting.",
    );
    process.exit(0);
  }

  logInfo("Single-instance protection acquired.");
  initDatabase();

  // Load application configuration before starting monitoring.
  const applicationCount = await initializeMonitoredApplications();

  logInfo(
    `Application configuration initialized: ${applicationCount} application(s).`,
  );

  let isRefreshingApplications = false;

  applicationRefreshInterval = setInterval(async () => {
    if (isRefreshingApplications || isShuttingDown) return;

    isRefreshingApplications = true;

    try {
      logInfo("Refreshing application configuration from SEWA...");

      const count = await initializeMonitoredApplications();

      logInfo(`Application configuration refreshed: ${count} application(s).`);
    } catch (error) {
      logError("Application configuration refresh failed", error);
    } finally {
      isRefreshingApplications = false;
    }
  }, APPLICATION_REFRESH_INTERVAL);

  // 2. Initialize database only after acquiring mutex.
  // const { db } = await import("./storage/database.js");

  // // 3. Load session queue functions after database initialization.
  // const {
  //   enqueueSession,
  //   getPendingSessions,
  //   deleteSyncedSession,
  //   markSessionFailed,
  //   saveActiveCheckpoint,
  //   getActiveCheckpoint,
  //   clearActiveCheckpoint,
  // } = await import("./storage/sessionQueue.js");

  // Device information
  const device = getDeviceInfo();

  logInfo("====================================");
  logInfo("SEWA MONITORING AGENT");
  logInfo("====================================");
  logInfo("Device Information", device);

  // Initialize session tracker
  const sessionTracker = new SessionTracker();

  // Synchronize pending sessions from SQLite
  async function syncPendingSessions() {
    if (isSyncing || isShuttingDown) return;

    isSyncing = true;

    try {
      const pendingSessions = getPendingSessions();

      if (pendingSessions.length === 0) return;

      logInfo(`${pendingSessions.length} pending session(s) found.`);

      for (const record of pendingSessions) {
        if (isShuttingDown) break;

        try {
          const payload = JSON.parse(record.payload);

          logInfo("Uploading session", record.session_id);

          const result = await sendUsageSession(payload.session, payload.user);

          if (result) {
            deleteSyncedSession(record.session_id);
          } else {
            markSessionFailed(record.session_id, "API upload failed");
          }
        } catch (error) {
          logError(
            `Session synchronization failed: ${record.session_id}`,
            error,
          );

          markSessionFailed(record.session_id, error.message);
        }
      }
    } catch (error) {
      logError("Synchronization manager error", error);
    } finally {
      isSyncing = false;
    }
  }

  // Save completed session locally before uploading
  function saveCompletedSession(session) {
    if (!session) return;

    enqueueSession(session, device);
    clearActiveCheckpoint();

    void syncPendingSessions();
  }

  // Recover an unfinished session from the previous run
  function recoverActiveSession() {
    try {
      const checkpoint = getActiveCheckpoint();

      if (!checkpoint) {
        logInfo("No previous active session found.");
        return;
      }

      const recoveredSession = {
        ...checkpoint.payload.session,
        endedAt: checkpoint.checkpointedAt,
        status: "INTERRUPTED",
      };

      const recoveredDevice = checkpoint.payload.user || device;

      logInfo("Previous interrupted session found", checkpoint.sessionId);

      enqueueSession(recoveredSession, recoveredDevice);
      clearActiveCheckpoint();

      logInfo(
        "Interrupted session recovered and queued",
        recoveredSession.sessionId,
      );
    } catch (error) {
      logError("Session recovery failed", error);
    }
  }

  // Graceful shutdown
  async function shutdown() {
    if (isShutdownStarted) return;

    isShutdownStarted = true;
    isShuttingDown = true;

    logInfo("Stopping SEWA Monitoring Agent...");

    clearInterval(monitoringInterval);
    clearInterval(syncInterval);
    clearInterval(checkpointInterval);
    clearInterval(applicationRefreshInterval);

    if (stopIdleMonitoring) {
      stopIdleMonitoring();
    }

    try {
      const finalSession = sessionTracker.stop();

      if (finalSession) {
        logInfo("Saving final session locally.");

        enqueueSession(finalSession, device);
        clearActiveCheckpoint();
      }

      // Wait for an ongoing synchronization to finish.
      while (isSyncing) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Allow one final synchronization attempt.
      isShuttingDown = false;
      await syncPendingSessions();
      isShuttingDown = true;

      logInfo("SEWA Monitoring Agent stopped.");
    } catch (error) {
      logError("Shutdown error", error);
    } finally {
      try {
        closeDatabase();
      } catch (error) {
        logError("Database close failed", error);
      }

      releaseSingleInstance();
      process.exit(0);
    }
  }

  // Register shutdown handlers
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Recover unfinished sessions before monitoring.
  recoverActiveSession();

  // Start idle monitoring
  stopIdleMonitoring = startIdleMonitoring((result) => {
    if (result.error) {
      logError("Idle monitoring error", result.error);
      return;
    }

    const currentlyIdle = result.idleMilliseconds >= IDLE_THRESHOLD;

    if (currentlyIdle !== isIdle) {
      isIdle = currentlyIdle;

      logInfo(isIdle ? "Employee is inactive." : "Employee activity detected.");
    }
  });

  logInfo("Application monitoring started.");

  // Retry pending sessions immediately.
  void syncPendingSessions();

  // Periodically retry pending sessions.
  syncInterval = setInterval(() => {
    void syncPendingSessions();
  }, SYNC_INTERVAL);

  // Periodically save active session checkpoint.
  checkpointInterval = setInterval(() => {
    if (isShuttingDown) return;

    const activeSession = sessionTracker.currentSession;

    if (!activeSession) return;

    try {
      saveActiveCheckpoint({ ...activeSession }, device);
    } catch (error) {
      logError("Checkpoint error", error);
    }
  }, CHECKPOINT_INTERVAL);

  // Monitor foreground application.
  monitoringInterval = setInterval(async () => {
    if (isCheckingApplication || isShuttingDown) return;

    isCheckingApplication = true;

    try {
      const previousSessionId =
        sessionTracker.currentSession?.sessionId || null;

      const application = await getActiveApplication();

      const observedApplication = application
        ? `${application.status}:${application.processName}`
        : "UNAVAILABLE";

      if (observedApplication !== lastObservedApplication) {
        logInfo("Foreground application observed", {
          status: application?.status || "UNAVAILABLE",
          processName: application?.processName || null,
          applicationName: application?.applicationName || null,
        });
        lastObservedApplication = observedApplication;
      }

      const completedSessions = sessionTracker.update(application, isIdle);

      for (const session of completedSessions) {
        logInfo("Session completed", {
          application: session.applicationName,
          startedAt: session.startedAt,
          endedAt: session.endedAt,
          foregroundMinutes: (session.foregroundDurationMs / 60000).toFixed(2),
          interactionMinutes: (session.interactionDurationMs / 60000).toFixed(
            2,
          ),
          idleMinutes: (session.idleDurationMs / 60000).toFixed(2),
        });

        saveCompletedSession(session);
      }

      const activeSession = sessionTracker.currentSession;

      if (activeSession && activeSession.sessionId !== previousSessionId) {
        saveActiveCheckpoint({ ...activeSession }, device);
      }
    } catch (error) {
      logError("Application monitoring error", error);
    } finally {
      isCheckingApplication = false;
    }
  }, 1000);
}

// Start the agent
startAgent().catch((error) => {
  logError("Agent startup failed", error);
  releaseSingleInstance();
  process.exit(1);
});
