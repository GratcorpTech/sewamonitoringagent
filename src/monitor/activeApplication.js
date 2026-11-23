import activeWin from "active-win";
import path from "path";

import { matchApplication } from "./applicationMatcher.js";
import { logError } from "../utils/logger.js";

const ERROR_LOG_INTERVAL_MS = 60 * 1000;
let lastForegroundErrorAt = 0;

export async function getActiveApplication() {
  try {
    const activeWindow = await activeWin();

    // Windows did not provide reliable foreground information.
    // This is not necessarily an application switch.
    if (
      !activeWindow ||
      !activeWindow.owner ||
      (!activeWindow.owner.path && !activeWindow.owner.name)
    ) {
      return null;
    }

    // macOS reports the bundle path (for example, Google Chrome.app), while
    // Windows reports an executable path. Keep the existing Windows mapping.
    const processName = process.platform === "darwin"
      ? activeWindow.owner.name || path.basename(activeWindow.owner.path)
      : path.basename(activeWindow.owner.path);

    const processId = activeWindow.owner.processId;

    const matchedApplication = matchApplication(processName);

    // Successfully detected, but not configured in SEWA
    if (!matchedApplication) {
      return {
        status: "UNMONITORED",
        processName,
        processId,
      };
    }

    return {
      status: "MONITORED",
      applicationId: matchedApplication.applicationId,
      applicationName: matchedApplication.name,
      processName,
      processId,
      detectedAt: new Date().toISOString(),
    };
  } catch (error) {
    const now = Date.now();

    // Foreground detection runs every second. Keep the persistent error log
    // useful without writing the same permission or native-helper error on
    // every poll.
    if (now - lastForegroundErrorAt >= ERROR_LOG_INTERVAL_MS) {
      logError("Foreground detection failed", error);
      lastForegroundErrorAt = now;
    }

    return null;
  }
}
