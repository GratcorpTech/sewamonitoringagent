import { getAgentSettings } from "../config/settings.js";

const API_TIMEOUT = 10000;

export async function sendUsageSession(session, device) {
  try {
    const settings = getAgentSettings();

    if (!settings.instanceUrl || !settings.username || !settings.password) {
      throw new Error("SEWA configuration or credentials are missing.");
    }

    const API_BASE_URL = settings.instanceUrl.replace(/\/+$/, "");

    const credentials = Buffer.from(
      `${settings.username}:${settings.password}`,
    ).toString("base64");

    const response = await fetch(`${API_BASE_URL}/monitoring`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${credentials}`,
      },
      body: JSON.stringify({
        session,
        user: device,
        username: settings.username,
      }),
      signal: AbortSignal.timeout(API_TIMEOUT),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.message ||
          result.error ||
          `API failed with status ${response.status}`,
      );
    }

    console.log("[SYNC SUCCESS]", result.message);
    return result;
  } catch (error) {
    console.error("[SYNC FAILED]", error.message);
    return null;
  }
}

export async function fetchApplicationRecords() {
  const settings = getAgentSettings();

  if (!settings.instanceUrl || !settings.username || !settings.password) {
    throw new Error("SEWA configuration or credentials are missing.");
  }

  const API_BASE_URL = settings.instanceUrl.replace(/\/+$/, "");

  const credentials = Buffer.from(
    `${settings.username}:${settings.password}`,
  ).toString("base64");

  const queryParams = new URLSearchParams({
    currentPage: "1",
    limit: "1000",
    filters: JSON.stringify([]),
    pagination: "confirm",
    skiplimitcheck: "true",
    selectedFields: JSON.stringify([
      "id",
      "assetname",
      "windowsprocessnames",
      "macprocessnames",
      "linuxprocessnames",
    ]),
  });

  const response = await fetch(
    `${API_BASE_URL}/get/table/assetsoftwarelicense?${queryParams}`,
    {
      method: "GET",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(API_TIMEOUT),
    },
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result?.error ||
        result?.message ||
        `Application fetch failed: ${response.status}`,
    );
  }

  if (!Array.isArray(result?.data)) {
    throw new Error("Invalid application records response from SEWA.");
  }

  return result.data;
}