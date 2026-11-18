import os from "node:os";
import path from "node:path";

const applicationName = "SEWA";
const agentName = "MonitoringAgent";

export function getAgentDataDirectory() {
  if (process.platform === "darwin") {
    return path.join(
      os.homedir(),
      "Library",
      "Application Support",
      applicationName,
      agentName,
    );
  }

  return path.join(
    process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"),
    applicationName,
    agentName,
  );
}

export function getAgentLogDirectory() {
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Logs", applicationName, agentName);
  }

  return path.join(getAgentDataDirectory(), "logs");
}
