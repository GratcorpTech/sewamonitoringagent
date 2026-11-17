import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

const settingsPath = path.join(
  process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"),
  "SEWA",
  "MonitoringAgent",
  "config",
  "settings.json",
);

function getCredentialScriptPath() {
  if (process.pkg) {
    return path.join(path.dirname(process.execPath), "credential.ps1");
  }

  return path.resolve(currentDirectory, "../windows/credential.ps1");
}

function decryptPassword(encryptedPassword) {
  const scriptPath = getCredentialScriptPath();

  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Credential helper not found: ${scriptPath}`);
  }

  const result = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath,
      "decrypt",
    ],
    {
      input: encryptedPassword,
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    },
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `Credential decryption failed: ${result.stderr || "Unknown error"}`,
    );
  }

  return result.stdout;
}

export function getAgentSettings() {
  if (!fs.existsSync(settingsPath)) {
    throw new Error("SEWA agent configuration not found.");
  }

  const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));

  // Keep Electron-provided credentials as a backward-compatible override.
  const password = process.env.SEWA_AGENT_PASSWORD
    ? process.env.SEWA_AGENT_PASSWORD
    : settings.passwordDpapi
      ? decryptPassword(settings.passwordDpapi)
      : null;

  if (!settings.instanceUrl || !settings.username || !password) {
    throw new Error("SEWA configuration or credentials are missing.");
  }

  return {
    ...settings,
    password,
  };
}
