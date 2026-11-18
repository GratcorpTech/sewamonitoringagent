import {
  acquireMacSingleInstance,
  releaseMacSingleInstance,
} from "../platform/macos/singleInstance.js";
import {
  acquireWindowsSingleInstance,
  releaseWindowsSingleInstance,
} from "../platform/windows/singleInstance.js";

export function acquireSingleInstance() {
  if (process.platform === "darwin") return acquireMacSingleInstance();
  if (process.platform === "win32") return acquireWindowsSingleInstance();
  throw new Error(`Single-instance protection is unsupported on ${process.platform}.`);
}

export function releaseSingleInstance() {
  if (process.platform === "darwin") return releaseMacSingleInstance();
  if (process.platform === "win32") return releaseWindowsSingleInstance();
}
