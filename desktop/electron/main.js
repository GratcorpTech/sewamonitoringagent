import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  saveSettings,
  getSettings,
  getAgentLaunchConfig,
} from "./storage/config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let agentProcess = null;

// Packaged builds run the bundled agent on Electron's own Node runtime;
// development runs the source with the system Node.
function getAgentLaunch() {
  if (app.isPackaged) {
    const agentDirectory = path.join(process.resourcesPath, "agent");

    return {
      command: process.execPath,
      script: path.join(agentDirectory, "agent.cjs"),
      cwd: agentDirectory,
      env: {
        ELECTRON_RUN_AS_NODE: "1",
        SEWA_AGENT_SCRIPTS_DIR: agentDirectory,
        NODE_PATH: [
          path.join(process.resourcesPath, "app.asar", "node_modules"),
          path.join(process.resourcesPath, "app.asar.unpacked", "node_modules"),
        ].join(path.delimiter),
      },
    };
  }

  const projectRoot = path.resolve(__dirname, "../..");

  return {
    command: "node",
    script: path.join(projectRoot, "src", "index.js"),
    cwd: projectRoot,
    env: {},
  };
}


function startMonitoringAgent() {
  // Prevent duplicate launches during this Electron process.
  if (agentProcess && !agentProcess.killed) {
    return Promise.resolve({
      success: true,
      message: "Monitoring agent is already running.",
    });
  }

  const config = getAgentLaunchConfig();
  const launch = getAgentLaunch();

  if (!fs.existsSync(launch.script)) {
    throw new Error(`Monitoring agent not found: ${launch.script}`);
  }

  const child = spawn(launch.command, [launch.script], {
    cwd: launch.cwd,
    ...(process.platform === "win32" ? { windowsHide: true } : {}),
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      ...launch.env,
      SEWA_AGENT_PASSWORD: config.password,
    },
  });

  return new Promise((resolve, reject) => {
    child.once("spawn", () => {
      agentProcess = child;

      child.once("error", (error) => {
        console.error("[AGENT PROCESS ERROR]", error);
        agentProcess = null;
      });

      child.once("exit", (code) => {
        console.log(`[AGENT] Monitoring process exited with code ${code}`);
        agentProcess = null;
      });

      child.unref();

      console.log("[AGENT] Monitoring EXE started in background.");

      resolve({
        success: true,
        message: "Monitoring agent started successfully.",
      });
    });

    child.once("error", (error) => {
      reject(new Error(`Unable to start monitoring agent: ${error.message}`));
    });
  });
}


function stopMonitoringAgent() {
  if (!agentProcess || agentProcess.killed) {
    agentProcess = null;
    return { success: true, message: "Monitoring agent is not running." };
  }

  agentProcess.kill();
  agentProcess = null;

  return { success: true, message: "Monitoring agent stop requested." };
}

function registerIpcHandlers() {
  ipcMain.handle("config:save-settings", async (_, settings) => {
    if (!settings?.instanceUrl || !settings?.username || !settings?.password) {
      throw new Error("Instance URL, username and password are required.");
    }

    let url;

    try {
      url = new URL(settings.instanceUrl);
    } catch {
      throw new Error("Please enter a valid SEWA instance URL.");
    }

    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("Invalid SEWA instance URL.");
    }

    saveSettings({
      instanceUrl: url.origin + url.pathname.replace(/\/+$/, ""),
      username: settings.username.trim(),
      password: settings.password,
      employeeId: settings.employeeId || null,
      deviceId: settings.deviceId || null,
    });

    // Automatically start the monitoring EXE after saving.
    const agentResult = await startMonitoringAgent();

    return {
      success: true,
      message: agentResult.message,
    };
  });

  ipcMain.handle("config:get-settings", () => getSettings());

  ipcMain.handle("agent:start", () => startMonitoringAgent());

  ipcMain.handle("agent:stop", () => stopMonitoringAgent());
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 900,
    minHeight: 650,
    title: "SEWA Monitoring Agent",

    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (!app.isPackaged) {
    mainWindow.loadURL("http://127.0.0.1:5174");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();

  if (process.platform === "darwin") {
    app.setLoginItemSettings({ openAtLogin: true });

    // The macOS agent receives its password from Electron's Keychain-backed
    // safeStorage. Start it again when this app is opened at login.
    try {
      if (getSettings()) {
        void startMonitoringAgent().catch((error) => {
          console.error("[AGENT] Unable to start at login:", error.message);
        });
      }
    } catch (error) {
      console.error("[AGENT] Unable to start at login:", error.message);
    }
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
