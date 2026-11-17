import fs from "node:fs";
import path from "node:path";
import os from "node:os";
//import { fileURLToPath } from "node:url";

const isPackaged = Boolean(process.pkg);

//const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

const configDirectory = path.join(
  process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"),
  "SEWA",
  "MonitoringAgent",
  "config",
);

const configPath = path.join(configDirectory, "applications.json");

function getDefaultConfig() {
  if (isPackaged) {
    return {
      applications: [
        {
          applicationId: "app-001",
          name: "Adobe Photoshop",
          publisher: "Adobe Inc.",
          processNames: ["Photoshop.exe"],
          enabled: true,
        },
        {
          applicationId: "app-002",
          name: "Microsoft Excel",
          publisher: "Microsoft",
          processNames: ["EXCEL.EXE"],
          enabled: true,
        },
        {
          applicationId: "app-003",
          name: "Microsoft Word",
          publisher: "Microsoft",
          processNames: ["WINWORD.EXE"],
          enabled: true,
        },
        {
          applicationId: "app-004",
          name: "Google Chrome",
          publisher: "Google",
          processNames: ["chrome.exe"],
          enabled: true,
        },
      ],
    };
  }

  // const developmentConfigPath = path.resolve(
  //   currentDirectory,
  //   "../config/applications.json",
  // );
  const developmentConfigPath = path.join(
    process.cwd(),
    "src",
    "config",
    "applications.json",
  );

  return JSON.parse(fs.readFileSync(developmentConfigPath, "utf8"));
}

export function getMonitoredApplications() {
  if (!fs.existsSync(configPath)) {
    fs.mkdirSync(configDirectory, { recursive: true });

    fs.writeFileSync(
      configPath,
      JSON.stringify(getDefaultConfig(), null, 2),
      "utf8",
    );

    console.log("[CONFIG] Default application configuration created.");
  }

  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

  return config.applications || [];
}

export function matchApplication(processName) {
  const applications = getMonitoredApplications();

  return (
    applications.find((application) => {
      if (!application.enabled) return false;

      const processNames = Array.isArray(application.processNames)
        ? application.processNames
        : application.processNames?.[process.platform] || [];

      return processNames.some(
        (name) => name.toLowerCase() === processName.toLowerCase(),
      );
    }) || null
  );
}
