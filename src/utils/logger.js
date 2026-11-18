import fs from "node:fs";
import path from "node:path";
import { getAgentLogDirectory } from "../platform/paths.js";

const logDirectory = getAgentLogDirectory();

fs.mkdirSync(logDirectory, { recursive: true });

const infoLogPath = path.join(logDirectory, "agent.log");
const errorLogPath = path.join(logDirectory, "agent-error.log");

function writeLog(filePath, level, message, data = null) {
  const timestamp = new Date().toISOString();

  const details =
    data instanceof Error
      ? data.stack || data.message
      : data
        ? typeof data === "string"
          ? data
          : JSON.stringify(data, null, 2)
        : "";

  const entry = `[${timestamp}] [${level}] ${message} ${details}\n`;

  fs.appendFileSync(filePath, entry, "utf8");

  if (level === "ERROR") {
    console.error(entry.trim());
  } else {
    console.log(entry.trim());
  }
}

export function logInfo(message, data = null) {
  writeLog(infoLogPath, "INFO", message, data);
}

export function logError(message, error = null) {
  writeLog(errorLogPath, "ERROR", message, error);
}
