import { startMacIdleMonitoring } from "../platform/macos/idleDetection.js";
import { startWindowsIdleMonitoring } from "../platform/windows/idleDetection.js";

export function startIdleMonitoring(callback) {
  if (process.platform === "darwin") return startMacIdleMonitoring(callback);
  if (process.platform === "win32") return startWindowsIdleMonitoring(callback);

  throw new Error(`Idle monitoring is unsupported on ${process.platform}.`);
}
