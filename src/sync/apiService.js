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

// export async function sendUsageSession(session, device) {
//   try {
//     const settings = getAgentSettings();

//     if (!settings.instanceUrl) {
//       throw new Error("SEWA instance URL is not configured.");
//     }

//     const API_BASE_URL = settings.instanceUrl.replace(/\/+$/, "");

//     const response = await fetch(`${API_BASE_URL}/monitoring`, {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({
//         session,
//         user: {
//           ...device,
//           username: settings.username,
//         },
//       }),
//       signal: AbortSignal.timeout(API_TIMEOUT),
//     });

//     const result = await response.json();

//     if (!response.ok) {
//       throw new Error(
//         result.message || `API failed with status ${response.status}`,
//       );
//     }

//     console.log("[SYNC SUCCESS]", result.message);

//     return result;
//   } catch (error) {
//     if (error.name === "TimeoutError") {
//       console.error(
//         "[SYNC TIMEOUT] Backend did not respond within 10 seconds.",
//       );
//     } else {
//       console.error("[SYNC FAILED]", error.message);
//     }

//     return null;
//   }
// }
