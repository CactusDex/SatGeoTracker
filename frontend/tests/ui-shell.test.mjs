import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const app = readFileSync(resolve(root, "src/App.tsx"), "utf8");
const css = readFileSync(resolve(root, "src/styles.css"), "utf8");
const html = readFileSync(resolve(root, "index.html"), "utf8");
const tail = css.split("/* v0.9.0 — Favorites & Identity")[1];

test("pass strip spans full width even with an open inspector", () => {
  assert.ok(tail, "v0.9.0 CSS rules missing");
  assert.match(tail, /\.app-shell:has\(\.sat-panel\.open\) \.pass-strip\s*\{\s*right:\s*0;\s*left:\s*0;\s*width:\s*100%/);
  assert.match(app, /new ResizeObserver\(sync\)/);
});

test("inspector uses translucent graphite glass and inner scrolling", () => {
  assert.match(tail, /backdrop-filter:\s*blur\(12px\)/);
  assert.match(tail, /background:\s*rgba\(19, 23, 29, 0\.85\)/);
  assert.match(tail, /overflow-y:\s*auto/);
});

test("brand mark and favicon paths exist in the bundled project", () => {
  for (const name of ["logo-mark.svg", "favicon.svg", "favicon.ico", "favicon-32.png", "favicon-180.png"]) {
    assert.ok(existsSync(resolve(root, "public/brand", name)), `${name} missing`);
  }
  assert.match(html, /rel="icon" type="image\/svg\+xml"/);
  assert.match(html, /<title>SatGeoTracker v0\.9\.1<\/title>/);
  assert.match(app, /className="brand-icon"/);
  assert.match(app, /brand-version">v0\.9\.1/);
});

test("favorite navigation and inspector star remain connected", () => {
  assert.match(app, /<FavoritesPanel/);
  assert.match(app, /toggleFavorite\(selected\.noradId, selected\.name\)/);
  assert.match(app, /onSelectSatellite=\{\(noradId\) => \{/);
  assert.match(app, /setAppMode\("MAP"\)/);
});
