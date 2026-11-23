import { build } from "esbuild";
import fs from "node:fs";

const outputDirectory = "dist/agent";

fs.rmSync(outputDirectory, { recursive: true, force: true });
fs.mkdirSync(outputDirectory, { recursive: true });

// Native modules are loaded from the Electron app's node_modules at runtime.
await build({
  entryPoints: ["src/index.js"],
  outfile: `${outputDirectory}/agent.cjs`,
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  external: ["better-sqlite3", "active-win"],
  minify: true,
  define: { "import.meta.url": "__importMetaUrl" },
  banner: {
    js: 'const __importMetaUrl = require("node:url").pathToFileURL(__filename).href;',
  },
});

for (const script of [
  "src/utils/singleInstance.ps1",
  "src/monitor/idleDetection.ps1",
  "src/windows/credential.ps1",
  "src/windows/startAgent.ps1",
]) {
  fs.copyFileSync(script, `${outputDirectory}/${script.split("/").pop()}`);
}
