import {
  acquireSingleInstance,
  releaseSingleInstance,
} from "./utils/singleInstance.js";

import { logInfo, logError } from "./utils/logger.js";

async function bootstrap() {
  try {
    const acquired = await acquireSingleInstance();

    if (!acquired) {
      logInfo(
        "Another SEWA Monitoring Agent instance is already running. Exiting.",
      );
      process.exit(0);
    }

    logInfo("Single-instance protection acquired.");

    // Start monitoring only after acquiring the mutex.
    await import("./index.js");
  } catch (error) {
    logError("Agent startup failed", error);
    releaseSingleInstance();
    process.exit(1);
  }
}

bootstrap();
