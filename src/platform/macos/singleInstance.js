import fs from "node:fs";
import path from "node:path";

import { getAgentDataDirectory } from "../paths.js";

const lockPath = path.join(getAgentDataDirectory(), "run", "agent.lock");
let lockHandle = null;

function processIsRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

function removeStaleLock() {
  try {
    const existing = JSON.parse(fs.readFileSync(lockPath, "utf8"));
    if (processIsRunning(existing.pid)) return false;
    fs.unlinkSync(lockPath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return true;
    throw error;
  }
}

export async function acquireMacSingleInstance() {
  fs.mkdirSync(path.dirname(lockPath), { recursive: true, mode: 0o700 });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      lockHandle = fs.openSync(lockPath, "wx", 0o600);
      fs.writeFileSync(lockHandle, JSON.stringify({ pid: process.pid }));
      return true;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      if (!removeStaleLock()) return false;
    }
  }

  return false;
}

export function releaseMacSingleInstance() {
  if (lockHandle === null) return;

  try {
    fs.closeSync(lockHandle);
    fs.unlinkSync(lockPath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  } finally {
    lockHandle = null;
  }
}
