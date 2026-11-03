import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

test("obsolete SDR-specific 106px sizing is gone", () => {
  assert.doesNotMatch(css, /\.pass-strip\.sdr-mode \.pass-card,\s*\.pass-strip\.sdr-mode \.pass-more\s*\{\s*height:\s*106px/);
});

test("both modes share identical collapsed mobile strip height", () => {
  assert.match(css, /--sgt-mobile-pass-height:\s*162px/);
  assert.match(css, /\.pass-strip\.collapsed,\s*\.app-shell:has\(\.sat-panel\.open\) \.pass-strip\.collapsed/);
  assert.match(css, /height:\s*var\(--sgt-mobile-pass-height\)/);
});

test("expanded strip remains scrollable", () => {
  assert.match(css, /\.pass-strip\.expanded \.pass-cards\s*\{[^}]*overflow-y:\s*auto/s);
});
