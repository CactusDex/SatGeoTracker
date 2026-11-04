import { test } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const hook = readFileSync(new URL("../src/media/useSatelliteMedia.ts", import.meta.url), "utf8");
const thumbnail = readFileSync(new URL("../src/media/SatelliteThumbnail.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

test("photo is requested for any visible selected satellite, regardless of workspace", () => {
  assert.match(app, /useSatelliteMedia\(panelVisible \? selected\?\.noradId \?\? null : null\)/);
  assert.doesNotMatch(app, /appMode\s*===\s*["']SDR["']\s*\?\s*selectedMedia/);
});

test("thumbnail never uses an image for the previous selected NORAD ID", () => {
  assert.match(app, /selectedMedia\?\.norad_id === selected\.noradId \? selectedMedia : null/);
  assert.match(thumbnail, /onError=\{\(\) => setFailed\(true\)\}/);
});

test("only one selected satellite's metadata is requested; abort when changing it", () => {
  assert.match(hook, /fetch\(`\/api\/satellites\/\$\{noradId\}\/media`/);
  assert.match(hook, /controller\.abort\(\)/);
  assert.match(hook, /MAX_SESSION_CACHE = 128/);
});

test("thumbnail is subtle, linked to source and has mobile sizing", () => {
  assert.match(thumbnail, /rel="noopener noreferrer"/);
  assert.match(thumbnail, /referrerPolicy="no-referrer"/);
  assert.match(styles, /\.inspector-object-header/);
  assert.match(styles, /\.satellite-thumbnail/);
});
