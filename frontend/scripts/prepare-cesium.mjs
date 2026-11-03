import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const frontendDir = resolve(scriptDir, "..");
const packageDir = join(frontendDir, "node_modules", "cesium");
const sourceDir = join(packageDir, "Build", "Cesium");
const publicDir = join(frontendDir, "public", "cesium");
const manifestFile = join(publicDir, ".sgt-cesium-version.json");
const requiredDirs = ["Workers", "Assets", "ThirdParty", "Widgets"];
const criticalFiles = [
  "Workers/createGroundPolylineGeometry.js",
  "Workers/createTaskProcessorWorker.js",
  "Widgets/widgets.css",
];

function checkFiles(base) {
  return criticalFiles.every((file) => {
    const path = join(base, file);
    if (!existsSync(path) || statSync(path).size < 100) return false;
    const prefix = readFileSync(path).subarray(0, 80).toString("utf8").toLowerCase();
    return !prefix.includes("<!doctype html") && !prefix.includes("<html");
  });
}

function main() {
  const cesiumPkg = join(packageDir, "package.json");
  if (!existsSync(cesiumPkg)) {
    throw new Error("Cesium npm dependency not found. Run setup.cmd / npm install first.");
  }
  const version = JSON.parse(readFileSync(cesiumPkg, "utf8")).version;
  const missingSources = requiredDirs.filter((dir) => !existsSync(join(sourceDir, dir)));
  if (missingSources.length || !checkFiles(sourceDir)) {
    throw new Error(`Cesium ${version} package is missing runtime files: ${missingSources.join(", ") || "critical workers"}. Reinstall dependencies with npm ci.`);
  }

  let installedVersion = "";
  try {
    installedVersion = JSON.parse(readFileSync(manifestFile, "utf8")).version;
  } catch {}
  const mustCopy = process.argv.includes("--force") || installedVersion !== version ||
    requiredDirs.some((dir) => !existsSync(join(publicDir, dir))) || !checkFiles(publicDir);

  if (mustCopy) {
    console.log(`[SGT] Synchronizing Cesium ${version} runtime assets...`);
    mkdirSync(publicDir, { recursive: true });
    for (const dir of requiredDirs) {
      const destination = join(publicDir, dir);
      rmSync(destination, { recursive: true, force: true });
      cpSync(join(sourceDir, dir), destination, { recursive: true });
    }
    if (!checkFiles(publicDir)) {
      throw new Error("Cesium runtime sync failed: required worker or CSS missing.");
    }
    writeFileSync(manifestFile, JSON.stringify({ version, source: "node_modules/cesium/Build/Cesium" }, null, 2) + "\n");
    console.log("[SGT] Cesium runtime synchronized.");
  } else {
    console.log(`[SGT] Cesium ${version} runtime OK.`);
  }
}

try { main(); } catch (error) {
  console.error("[SGT Cesium ERROR]", error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
