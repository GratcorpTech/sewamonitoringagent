import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";

const isPackaged = Boolean(process.pkg);

const powershellScript = isPackaged
  ? path.join(path.dirname(process.execPath), "idleDetection.ps1")
  : path.join(process.cwd(), "src", "monitor", "idleDetection.ps1");

const currentDirectory = isPackaged
  ? path.dirname(process.execPath)
  : path.join(process.cwd(), "src", "monitor");


export function startIdleMonitoring(callback) {
  if (process.platform !== "win32") {
    throw new Error("Idle monitoring currently supports Windows only.");
  }

  if (!fs.existsSync(powershellScript)) {
    throw new Error(`PowerShell script not found: ${powershellScript}`);
  }

  const child = spawn(
    "powershell.exe",
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      powershellScript,
    ],
    {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  let buffer = "";

  child.stdout.setEncoding("utf8");

  child.stdout.on("data", (chunk) => {
    buffer += chunk;

    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";

    for (const line of lines) {
      const value = line.trim();

      if (!value) continue;

      if (value === "ERROR") {
        callback({
          idleMilliseconds: null,
          error: "Unable to read Windows idle time",
        });
        continue;
      }

      const idleMilliseconds = Number(value);

      if (!Number.isFinite(idleMilliseconds)) continue;

      callback({
        idleMilliseconds,
        idleSeconds: Math.floor(idleMilliseconds / 1000),
      });
    }
  });

  child.stderr.on("data", (data) => {
    console.error("Idle monitor error:", data.toString());
  });

  child.on("error", (error) => {
    console.error("Unable to start idle monitor:", error.message);
  });

  child.on("exit", (code) => {
    console.log("Idle monitor exited with code:", code);
  });

  return () => {
    if (!child.killed) {
      child.kill();
    }
  };
}
