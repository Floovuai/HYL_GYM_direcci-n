import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(projectRoot, "dist", "server");

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

await build({
  entryPoints: [path.join(projectRoot, "src", "server", "index.ts")],
  outfile: path.join(outDir, "index.cjs"),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  packages: "external",
  sourcemap: false,
  logLevel: "info",
  banner: {
    js: "const __import_meta_url = require(\"node:url\").pathToFileURL(__filename).href;"
  },
  define: {
    "import.meta.url": "__import_meta_url"
  }
});

const dataOutDir = path.join(outDir, "data");
mkdirSync(dataOutDir, { recursive: true });
for (const file of ["branchTrackingAug2026.json", "seasonalityDaily.json"]) {
  cpSync(path.join(projectRoot, "src", "server", "data", file), path.join(dataOutDir, file));
}
