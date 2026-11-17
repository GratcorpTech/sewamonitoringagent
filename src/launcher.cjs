import { getActiveApplication } from "./monitor/activeApplication.js";
import { startIdleMonitoring } from "./monitor/idleDetection.js";
import { SessionTracker } from "./monitor/sessionTracker.js";
import { getDeviceInfo } from "./device/deviceInfo.js";
import { logInfo, logError } from "./utils/logger.js";
import { sendUsageSession } from "./sync/apiService.js";

import {
  enqueueSession,
  getPendingSessions,
  deleteSyncedSession,
  markSessionFailed,
  saveActiveCheckpoint,
  getActiveCheckpoint,
  clearActiveCheckpoint,
} from "./storage/sessionQueue.js";

// import { db } from "./storage/database.js";
import {
  acquireSingleInstance,
  releaseSingleInstance,
} from "./utils/singleInstance.js";

const IDLE_THRESHOLD = 15000;
const SYNC_INTERVAL = 10000;
const CHECKPOINT_INTERVAL = 30000;

// Device information
const device = getDeviceInfo();

logInfo("====================================");
logInfo("       SEWA MONITORING AGENT");
logInfo("====================================");

logInfo("\nDevice Information:");
logInfo(device);

// Initialize session tracker
const sessionTracker = new SessionTracker();

let isIdle = false;
let isCheckingApplication = false;
let isSyncing = false;
let isShuttingDown = false;

// Synchronize all pending sessions from SQLite
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
       logError(`Session synchronization failed: ${record.session_id}`, error);

        markSessionFailed(record.session_id, error.message);
      }
    }
  } catch (error) {
    logError("Synchronization manager error", error);
  } finally {
    isSyncing = false;
  }
}

// Save completed session locally before attempting upload
function saveCompletedSession(session) {
  if (!session) return;

  // First save the completed session in the queue
  enqueueSession(session, device);

  // Clear its active checkpoint only after queue insertion
  clearActiveCheckpoint();

  // Start synchronization without blocking monitoring
  void syncPendingSessions();
}

// Recover an unfinished session from the previous agent run
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

    // Save the interrupted session before clearing its checkpoint
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

// Start idle monitoring
const stopIdleMonitoring = startIdleMonitoring((result) => {
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

// Recover any unfinished session before starting new monitoring
recoverActiveSession();

// Retry pending sessions immediately when agent starts
void syncPendingSessions();

// Periodically retry pending sessions
const syncInterval = setInterval(() => {
  void syncPendingSessions();
}, SYNC_INTERVAL);

// Periodically save the currently active session
const checkpointInterval = setInterval(() => {
  if (isShuttingDown) return;

  const activeSession = sessionTracker.currentSession;

  if (!activeSession) return;

  try {
    saveActiveCheckpoint({ ...activeSession }, device);
  } catch (error) {
   logError("Checkpoint error", error);
  }
}, CHECKPOINT_INTERVAL);

// Monitor foreground application
const monitoringInterval = setInterval(async () => {
  if (isCheckingApplication || isShuttingDown) return;

  isCheckingApplication = true;

  try {
    // Remember the session before updating the tracker
    const previousSessionId = sessionTracker.currentSession?.sessionId || null;

    const application = await getActiveApplication();

    const completedSessions = sessionTracker.update(application, isIdle);

    // Handle completed sessions
    for (const session of completedSessions) {
      //console.log("\n[SESSION COMPLETED]");

      logInfo("Session completed", {
        application: session.applicationName,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        foregroundMinutes: (session.foregroundDurationMs / 60000).toFixed(2),
        interactionMinutes: (session.interactionDurationMs / 60000).toFixed(2),
        idleMinutes: (session.idleDurationMs / 60000).toFixed(2),
      });

      saveCompletedSession(session);
    }

    // Save a checkpoint immediately when a new session starts
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

// Graceful shutdown
async function shutdown() {
  if (isShuttingDown) return;

  isShuttingDown = true;

logInfo("Stopping SEWA Monitoring Agent...");

  clearInterval(monitoringInterval);
  clearInterval(syncInterval);
  clearInterval(checkpointInterval);

  stopIdleMonitoring();

  const finalSession = sessionTracker.stop();

  if (finalSession) {
  logInfo("Saving final session locally.");

    // Save as normally completed, not interrupted
    enqueueSession(finalSession, device);

    clearActiveCheckpoint();
  }

  // Wait for any currently running synchronization to finish
  while (isSyncing) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Upload remaining pending sessions once
  isShuttingDown = false;

  await syncPendingSessions();

  isShuttingDown = true;

logInfo("SEWA Monitoring Agent stopped.");

  db.close();

  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

export { shutdown };
