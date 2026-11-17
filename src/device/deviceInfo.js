import os from "os";

export function getDeviceInfo() {
  return {
    hostname: os.hostname(),
    username: os.userInfo().username,
    platform: os.platform(),
    architecture: os.arch(),
  };
}
