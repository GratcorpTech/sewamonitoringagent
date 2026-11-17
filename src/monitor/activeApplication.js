import activeWin from "active-win";
import path from "path";

import { matchApplication } from "./applicationMatcher.js";

export async function getActiveApplication() {
  try {
    const activeWindow = await activeWin();

    // Windows did not provide reliable foreground information.
    // This is not necessarily an application switch.
    if (!activeWindow || !activeWindow.owner?.path) {
      return null;
    }

    const processName = path.basename(activeWindow.owner.path);

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
    console.error("Foreground detection failed:", error.message);

    return null;
  }
}
