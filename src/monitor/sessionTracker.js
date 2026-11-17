import { randomUUID } from "node:crypto";

export class SessionTracker {
  constructor() {
    this.currentSession = null;
    this.lastSampleTime = null;
  }

  startSession(application, timestamp) {
    this.currentSession = {
      sessionId: randomUUID(),
      applicationId: application.applicationId,
      applicationName: application.applicationName,
      processName: application.processName,
      processId: application.processId,

      startedAt: new Date(timestamp).toISOString(),
      endedAt: null,

      foregroundDurationMs: 0,
      interactionDurationMs: 0,
      idleDurationMs: 0,

      status: "ACTIVE",
    };

    console.log("\n[SESSION STARTED]");
    console.log(this.currentSession);
  }

  accumulateDuration(elapsedMs, isIdle) {
    if (!this.currentSession || elapsedMs <= 0) {
      return;
    }

    this.currentSession.foregroundDurationMs += elapsedMs;

    if (isIdle) {
      this.currentSession.idleDurationMs += elapsedMs;
      this.currentSession.status = "IDLE";
    } else {
      this.currentSession.interactionDurationMs += elapsedMs;
      this.currentSession.status = "ACTIVE";
    }
  }

  closeSession(timestamp) {
    if (!this.currentSession) return null;

    this.currentSession.endedAt = new Date(timestamp).toISOString();

    const completedSession = {
      ...this.currentSession,
      status: "COMPLETED",
    };

    this.currentSession = null;

    return completedSession;
  }

  update(detection, isIdle, timestamp = Date.now()) {
    const completedSessions = [];

    // Calculate elapsed time for the previous observation.
    if (this.lastSampleTime !== null && this.currentSession) {
      const elapsedMs = Math.max(
        0,
        Math.min(timestamp - this.lastSampleTime, 5000),
      );

      // Use the previous sample's idle state.
      this.accumulateDuration(elapsedMs, this.currentSession.status === "IDLE");
    }

    // Temporary detection failure: preserve the current session.
    if (detection === null) {
      this.lastSampleTime = timestamp;
      return completedSessions;
    }

    // Only configured applications can create sessions.
    const application =
      detection.status === "MONITORED" &&
      detection.applicationId &&
      detection.applicationName
        ? detection
        : null;

    const currentKey = application
      ? `${application.applicationId}:${application.processId}`
      : null;

    const previousKey = this.currentSession
      ? `${this.currentSession.applicationId}:${this.currentSession.processId}`
      : null;

    // Close the previous session if the foreground application changed
    // or an unmonitored application became active.
    if (previousKey !== currentKey) {
      const completed = this.closeSession(timestamp);

      if (completed) {
        completedSessions.push(completed);
      }

      // Start a session only for a configured application.
      if (application) {
        this.startSession(application, timestamp);
      }
    }

    if (this.currentSession) {
      this.currentSession.status = isIdle ? "IDLE" : "ACTIVE";
    }

    this.lastSampleTime = timestamp;

    return completedSessions;
  }

  stop(timestamp = Date.now()) {
    const completed = this.closeSession(timestamp);
    this.lastSampleTime = null;

    return completed;
  }
}
