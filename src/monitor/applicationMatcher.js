import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { APPLICATION_PROCESS_MAP } from "../config/applicationProcessMap.js";
import { fetchApplicationRecords } from "../sync/apiService.js";

const configDirectory = path.join(
  process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"),
  "SEWA",
  "MonitoringAgent",
  "config",
);

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

function mapApplicationRecords(records) {
  const platform = process.platform;
  const mappedApplications = [];
  const seenNames = new Set();

  for (const record of records) {
    const applicationId = record?.id;
    const name = record?.assetname?.trim();

    if (!applicationId || !name) continue;

    const normalizedName = name.toLowerCase();

    // Avoid duplicate application names in the licensing table.
    if (seenNames.has(normalizedName)) continue;

    const processNames =
      APPLICATION_PROCESS_MAP[normalizedName]?.[platform] || [];

    if (processNames.length === 0) {
      console.log(`[CONFIG] No process mapping found for: ${name}`);
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

// import fs from "node:fs";
// import path from "node:path";
// import os from "node:os";
// //import { fileURLToPath } from "node:url";

// const isPackaged = Boolean(process.pkg);

// //const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

// const configDirectory = path.join(
//   process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"),
//   "SEWA",
//   "MonitoringAgent",
//   "config",
// );

// const configPath = path.join(configDirectory, "applications.json");

// function getDefaultConfig() {
//   if (isPackaged) {
//     return {
//       applications: [
//         {
//           applicationId: "app-001",
//           name: "Adobe Photoshop",
//           publisher: "Adobe Inc.",
//           processNames: ["Photoshop.exe"],
//           enabled: true,
//         },
//         {
//           applicationId: "app-002",
//           name: "Microsoft Excel",
//           publisher: "Microsoft",
//           processNames: ["EXCEL.EXE"],
//           enabled: true,
//         },
//         {
//           applicationId: "app-003",
//           name: "Microsoft Word",
//           publisher: "Microsoft",
//           processNames: ["WINWORD.EXE"],
//           enabled: true,
//         },
//         {
//           applicationId: "app-004",
//           name: "Google Chrome",
//           publisher: "Google",
//           processNames: ["chrome.exe"],
//           enabled: true,
//         },
//       ],
//     };
//   }

//   // const developmentConfigPath = path.resolve(
//   //   currentDirectory,
//   //   "../config/applications.json",
//   // );
//   const developmentConfigPath = path.join(
//     process.cwd(),
//     "src",
//     "config",
//     "applications.json",
//   );

//   return JSON.parse(fs.readFileSync(developmentConfigPath, "utf8"));
// }

// export function getMonitoredApplications() {
//   if (!fs.existsSync(configPath)) {
//     fs.mkdirSync(configDirectory, { recursive: true });

//     fs.writeFileSync(
//       configPath,
//       JSON.stringify(getDefaultConfig(), null, 2),
//       "utf8",
//     );

//     console.log("[CONFIG] Default application configuration created.");
//   }

//   const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

//   return config.applications || [];
// }

// export function matchApplication(processName) {
//   const applications = getMonitoredApplications();

//   return (
//     applications.find((application) => {
//       if (!application.enabled) return false;

//       const processNames = Array.isArray(application.processNames)
//         ? application.processNames
//         : application.processNames?.[process.platform] || [];

//       return processNames.some(
//         (name) => name.toLowerCase() === processName.toLowerCase(),
//       );
//     }) || null
//   );
// }
