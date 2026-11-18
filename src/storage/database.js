import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { logInfo } from "../utils/logger.js";
import { getAgentDataDirectory } from "../platform/paths.js";

let db = null;

const dataDirectory = path.join(getAgentDataDirectory(), "data");

const databasePath = path.join(dataDirectory, "sewa-agent.db");

export function initDatabase() {
  if (db) return db;

  fs.mkdirSync(dataDirectory, { recursive: true });

  db = new Database(databasePath);

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");

  db.exec(`
    CREATE TABLE IF NOT EXISTS usage_session_queue (
      session_id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'PENDING',
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      next_retry_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      synced_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_usage_queue_status
    ON usage_session_queue(sync_status);

    CREATE INDEX IF NOT EXISTS idx_usage_queue_retry
    ON usage_session_queue(next_retry_at);

    CREATE TABLE IF NOT EXISTS active_session_checkpoint (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      session_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      checkpointed_at TEXT NOT NULL
    );
  `);

  logInfo("Local session queue initialized.");
  logInfo("Database location", databasePath);

  return db;
}

export function getDatabase() {
  if (!db) {
    throw new Error("Database has not been initialized.");
  }

  return db;
}

export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
    logInfo("Database connection closed.");
  }
}
