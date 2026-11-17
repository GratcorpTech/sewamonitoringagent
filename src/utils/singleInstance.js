import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

let mutexProcess = null;

export function acquireSingleInstance() {
  return new Promise((resolve, reject) => {
const scriptPath = process.pkg
  ? path.join(path.dirname(process.execPath), "singleInstance.ps1")
  : path.join(currentDirectory, "singleInstance.ps1");

    // One monitoring process per Windows login session.
    const username = process.env.USERNAME || os.userInfo().username;
    const safeUsername = username.replace(/[^a-zA-Z0-9_-]/g, "_");
    const mutexName = `Local\\SEWA_MonitoringAgent_${safeUsername}`;

    const child = spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        scriptPath,
        "-MutexName",
        mutexName,
      ],
      {
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      },
    );

    let output = "";
    let errorOutput = "";
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new Error("Timed out acquiring monitoring mutex."));
    }, 10000);

    child.stdout.on("data", (chunk) => {
      output += chunk.toString();

      if (output.includes("READY") && !settled) {
        settled = true;
        clearTimeout(timeout);
        mutexProcess = child;
        resolve(true);
      }
    });

    child.stderr.on("data", (chunk) => {
      errorOutput += chunk.toString();
    });

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    });

    child.on("exit", (code) => {
      if (settled) return;

      settled = true;
      clearTimeout(timeout);

      if (code === 2) {
        resolve(false);
      } else {
        reject(
          new Error(
            `Mutex helper exited unexpectedly (${code}): ${errorOutput}`,
          ),
        );
      }
    });
  });
}

export function releaseSingleInstance() {
  if (mutexProcess && !mutexProcess.killed) {
    mutexProcess.stdin.end();
    mutexProcess = null;
  }
}
