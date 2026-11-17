import { getDatabase } from "./database.js";

let statements = null;

// Prepare statements only after the database has been initialized.
function getStatements() {
  if (statements) return statements;

  const db = getDatabase();

  statements = {
    insertSession: db.prepare(`
      INSERT OR IGNORE INTO usage_session_queue (
        session_id,
        payload,
        sync_status
      )
      VALUES (?, ?, 'PENDING')
    `),

    getPending: db.prepare(`
      SELECT *
      FROM usage_session_queue
      WHERE sync_status = 'PENDING'
        AND (
          next_retry_at IS NULL
          OR next_retry_at <= ?
        )
      ORDER BY created_at ASC
    `),

    deleteSynced: db.prepare(`
      DELETE FROM usage_session_queue
      WHERE session_id = ?
        AND sync_status = 'PENDING'
    `),

    saveCheckpoint: db.prepare(`
      INSERT INTO active_session_checkpoint (
        id,
        session_id,
        payload,
        checkpointed_at
      )
      VALUES (1, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        session_id = excluded.session_id,
        payload = excluded.payload,
        checkpointed_at = excluded.checkpointed_at
    `),

    getCheckpoint: db.prepare(`
      SELECT *
      FROM active_session_checkpoint
      WHERE id = 1
    `),

    deleteCheckpoint: db.prepare(`
      DELETE FROM active_session_checkpoint
      WHERE id = 1
    `),

    markFailed: db.prepare(`
      UPDATE usage_session_queue
      SET attempts = attempts + 1,
          last_error = ?,
          next_retry_at = ?
      WHERE session_id = ?
        AND sync_status = 'PENDING'
    `),

    getAttempts: db.prepare(`
      SELECT attempts
      FROM usage_session_queue
      WHERE session_id = ?
    `),
  };

  return statements;
}

// Add a completed session to local storage
export function enqueueSession(session, device) {
  const { insertSession } = getStatements();

  const payload = JSON.stringify({
    session,
    user: device,
  });

  const result = insertSession.run(session.sessionId, payload);

  console.log(
    result.changes > 0
      ? "[QUEUE] Session saved locally:"
      : "[QUEUE] Session already exists:",
    session.sessionId,
  );

  return result.changes > 0;
}

// Get sessions waiting for synchronization
export function getPendingSessions() {
  const { getPending } = getStatements();
  return getPending.all(new Date().toISOString());
}

// Delete a session only after successful API upload
export function deleteSyncedSession(sessionId) {
  const { deleteSynced } = getStatements();
  const result = deleteSynced.run(sessionId);

  if (result.changes > 0) {
    console.log(
      "[QUEUE] Successfully uploaded session removed locally:",
      sessionId,
    );
  }

  return result.changes > 0;
}

// Mark failed upload and schedule retry
export function markSessionFailed(sessionId, error) {
  const { markFailed, getAttempts } = getStatements();

  const row = getAttempts.get(sessionId);
  const nextAttempt = (row?.attempts || 0) + 1;

  // Exponential backoff: 5s, 10s, 20s, 40s...
  const retryDelay = Math.min(
    5000 * Math.pow(2, nextAttempt - 1),
    5 * 60 * 1000,
  );

  const nextRetryAt = new Date(Date.now() + retryDelay).toISOString();

  markFailed.run(String(error), nextRetryAt, sessionId);

  console.log(
    `[QUEUE] Retry ${nextAttempt} scheduled in ${retryDelay / 1000}s`,
  );
}

// Save or update the currently active session
export function saveActiveCheckpoint(session, device) {
  if (!session) return;

  const { saveCheckpoint } = getStatements();

  const checkpointedAt = new Date().toISOString();

  const payload = JSON.stringify({
    session,
    user: device,
  });

  saveCheckpoint.run(session.sessionId, payload, checkpointedAt);

  console.log("[CHECKPOINT] Active session saved:", session.sessionId);
}

// Retrieve the last active session checkpoint
export function getActiveCheckpoint() {
  const { getCheckpoint } = getStatements();

  const checkpoint = getCheckpoint.get();

  if (!checkpoint) return null;

  return {
    sessionId: checkpoint.session_id,
    payload: JSON.parse(checkpoint.payload),
    checkpointedAt: checkpoint.checkpointed_at,
  };
}

// Remove the active checkpoint
export function clearActiveCheckpoint() {
  const { deleteCheckpoint } = getStatements();
  const result = deleteCheckpoint.run();

  if (result.changes > 0) {
    console.log("[CHECKPOINT] Active session checkpoint cleared.");
  }

  return result.changes > 0;
}
