import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { app, safeStorage } from "electron";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

const baseDirectory = process.platform === "darwin"
  ? path.join(os.homedir(), "Library", "Application Support", "SEWA", "MonitoringAgent")
  : path.join(
      process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"),
      "SEWA",
      "MonitoringAgent",
    );

const configDirectory = path.join(baseDirectory, "config");
const settingsPath = path.join(configDirectory, "settings.json");

function ensureConfigDirectory() {
  fs.mkdirSync(configDirectory, { recursive: true });
}

function ensureEncryptionAvailable() {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("Secure credential encryption is unavailable.");
  }
}

function getCredentialScriptPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "agent", "credential.ps1");
  }

  return path.resolve(currentDirectory, "../../../src/windows/credential.ps1");
}

function runCredentialOperation(operation, input) {
  const scriptPath = getCredentialScriptPath();

  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Credential helper not found: ${scriptPath}`);
  }

  return execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath,
      operation,
    ],
    {
      input,
      encoding: "utf8",
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    },
  ).trim();
}

export function saveSettings(settings) {
  ensureConfigDirectory();
  ensureEncryptionAvailable();

  // Keep existing Electron encryption for backward compatibility.
  const encryptedPassword = safeStorage.encryptString(settings.password);

  // The independent Windows agent uses DPAPI. On macOS Electron launches the
  // agent with a password decrypted from Keychain via safeStorage.
  const passwordDpapi = process.platform === "win32"
    ? runCredentialOperation("encrypt", settings.password)
    : null;

  const safeSettings = {
    instanceUrl: settings.instanceUrl,
    username: settings.username,
    passwordEncrypted: encryptedPassword.toString("base64"),
    ...(passwordDpapi ? { passwordDpapi } : {}),
    employeeId: settings.employeeId || null,
    deviceId: settings.deviceId || null,
  };

  fs.writeFileSync(settingsPath, JSON.stringify(safeSettings, null, 2), "utf8");

  return true;
}

export function getSettings() {
  ensureConfigDirectory();

  if (!fs.existsSync(settingsPath)) {
    return null;
  }

  const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));

  return {
    instanceUrl: settings.instanceUrl || "",
    username: settings.username || "",
    employeeId: settings.employeeId || null,
    deviceId: settings.deviceId || null,
  };
}

export function getAgentLaunchConfig() {
  ensureConfigDirectory();
  ensureEncryptionAvailable();

  if (!fs.existsSync(settingsPath)) {
    throw new Error("SEWA agent configuration not found.");
  }

  const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));

  if (!settings.instanceUrl || !settings.username) {
    throw new Error("SEWA configuration is incomplete.");
  }

  let password;

  if (process.platform === "win32" && settings.passwordDpapi) {
    password = runCredentialOperation("decrypt", settings.passwordDpapi);
  } else if (settings.passwordEncrypted) {
    // Migrate credentials saved by the previous Electron version.
    password = safeStorage.decryptString(
      Buffer.from(settings.passwordEncrypted, "base64"),
    );

    if (process.platform === "win32") {
      settings.passwordDpapi = runCredentialOperation("encrypt", password);
    }

    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf8");
  } else {
    throw new Error("Saved SEWA password not found. Please reconnect.");
  }

  return {
    instanceUrl: settings.instanceUrl,
    username: settings.username,
    password,
    employeeId: settings.employeeId || null,
    deviceId: settings.deviceId || null,
  };
}
