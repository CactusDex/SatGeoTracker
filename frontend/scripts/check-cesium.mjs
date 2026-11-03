import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const front = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runtime = join(front, "public", "cesium");
const required = ["Workers/createGroundPolylineGeometry.js", "Workers/createTaskProcessorWorker.js", "Widgets/widgets.css"];
let errors = 0;
for (const file of required) {
  const full = join(runtime, file);
  if (!existsSync(full)) { console.error("MISSING", file); errors++; continue; }
  const data = readFileSync(full);
  if (data.length < 100 || data.subarray(0, 40).toString("utf8").includes("<!doctype html")) {
    console.error("INVALID", file); errors++;
  } else console.log("OK", file, `${data.length} bytes`);
}
process.exitCode = errors ? 1 : 0;
