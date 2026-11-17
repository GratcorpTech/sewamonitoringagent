import { build } from "esbuild";

await build({
  entryPoints: ["src/index.js"],
  outfile: "build/app.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node24",
  packages: "external",
  sourcemap: false,
  minify: false,
  external: ["better-sqlite3", "active-win"],
  define: {
    "import.meta.url": '""',
    "process.pkg": "false",
  },
  banner: {
    js: `
const { createRequire } = require("node:module");
const requireExternal = createRequire(process.execPath);
`,
  },
});
