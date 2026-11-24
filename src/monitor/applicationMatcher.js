import fs from "node:fs";
import path from "node:path";

import { fetchApplicationRecords } from "../sync/apiService.js";
import { getAgentDataDirectory } from "../platform/paths.js";

const configDirectory = path.join(getAgentDataDirectory(), "config");
const configPath = path.join(configDirectory, "applications.json");

let monitoredApplications = [];

function readCachedApplications() {
  try {
    if (!fs.existsSync(configPath)) {
      return [];
    }

    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

    return Array.isArray(config.applications) ? config.applications : [];
  } catch (error) {
    console.error("[CONFIG] Failed to read application cache:", error.message);
    return [];
  }
}

function saveCachedApplications(applications) {
  fs.mkdirSync(configDirectory, { recursive: true });

  const tempPath = `${configPath}.tmp`;

  fs.writeFileSync(tempPath, JSON.stringify({ applications }, null, 2), "utf8");

  fs.renameSync(tempPath, configPath);
}

function getProcessNames(record, platform) {
  let processNamesField;

  switch (platform) {
    case "win32":
      processNamesField = record?.windowsprocessnames;
      break;

    case "darwin":
      processNamesField = record?.macprocessnames;
      break;

    case "linux":
      processNamesField = record?.linuxprocessnames;
      break;

    default:
      return [];
  }

  if (!processNamesField) return [];

  return processNamesField
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

function mapApplicationRecords(records) {
  const platform = process.platform;
  const mappedApplications = [];
  const seenNames = new Set();

  for (const record of records) {
    const applicationId = record?.id;
    const name = record?.assetname?.trim();

    if (!applicationId || !name) continue;

    const normalizedName = name.toLowerCase();

    if (seenNames.has(normalizedName)) continue;

    const processNames = getProcessNames(record, platform);

    if (processNames.length === 0) {
      console.log(`[CONFIG] No ${platform} process mapping found for: ${name}`);
      continue;
    }

    seenNames.add(normalizedName);

    mappedApplications.push({
      applicationId,
      name,
      processNames,
      enabled: true,
    });
  }

  return mappedApplications;
}

export async function initializeMonitoredApplications() {
  // Load the previous configuration first so monitoring can continue
  // if the SEWA API is unavailable.
  monitoredApplications = readCachedApplications();

  if (monitoredApplications.length > 0) {
    console.log(
      `[CONFIG] Loaded ${monitoredApplications.length} cached application(s).`,
    );
  }

  try {
    console.log("[CONFIG] Fetching applications from SEWA...");

    const records = await fetchApplicationRecords();
    const mappedApplications = mapApplicationRecords(records);

    if (mappedApplications.length === 0) {
      console.log(
        "[CONFIG] No supported applications returned. Keeping existing cache.",
      );
      return monitoredApplications.length;
    }

    saveCachedApplications(mappedApplications);
    monitoredApplications = mappedApplications;

    console.log(
      `[CONFIG] ${mappedApplications.length} application(s) loaded from SEWA.`,
    );
  } catch (error) {
    console.error(
      "[CONFIG] Could not refresh applications from SEWA:",
      error.message,
    );

    console.log(
      `[CONFIG] Continuing with ${monitoredApplications.length} cached application(s).`,
    );
  }

  return monitoredApplications.length;
}

export function getMonitoredApplications() {
  return monitoredApplications;
}

export function matchApplication(processName) {
  if (!processName) return null;

  const normalizedProcessName = processName.toLowerCase();

  return (
    monitoredApplications.find((application) => {
      if (!application.enabled) return false;

      return application.processNames.some(
        (name) => name.toLowerCase() === normalizedProcessName,
      );
    }) || null
  );
}
