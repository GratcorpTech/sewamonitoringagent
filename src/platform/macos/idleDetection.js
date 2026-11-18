import { execFile } from "node:child_process";

const POLL_INTERVAL_MS = 1000;

function readIdleMilliseconds() {
  return new Promise((resolve, reject) => {
    execFile("/usr/sbin/ioreg", ["-c", "IOHIDSystem"], (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }

      const match = /"HIDIdleTime"\s*=\s*(\d+)/.exec(stdout);

      if (!match) {
        reject(new Error("macOS did not report HID idle time."));
        return;
      }

      // IOHIDSystem reports nanoseconds; JavaScript session tracking uses milliseconds.
      resolve(Math.floor(Number(match[1]) / 1_000_000));
    });
  });
}

export function startMacIdleMonitoring(callback) {
  let stopped = false;
  let timer = null;

  const poll = async () => {
    if (stopped) return;

    try {
      const idleMilliseconds = await readIdleMilliseconds();
      callback({
        idleMilliseconds,
        idleSeconds: Math.floor(idleMilliseconds / 1000),
      });
    } catch (error) {
      callback({ idleMilliseconds: null, error: error.message });
    } finally {
      if (!stopped) timer = setTimeout(poll, POLL_INTERVAL_MS);
    }
  };

  void poll();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
