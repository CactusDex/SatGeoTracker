import test from "node:test";
import assert from "node:assert/strict";
import { formatHoverAltitude, formatHoverSpeed } from "../src/hover/hoverFormat.ts";

test("hover altitude and speed format actual SGP4 values", () => {
  assert.equal(formatHoverAltitude(429.84), "429.8 км");
  assert.equal(formatHoverSpeed(7.65249), "7.652 км/с");
});

test("GEO altitude and speed can be displayed without overflow", () => {
  assert.equal(formatHoverAltitude(35784.5), "35784.5 км");
  assert.equal(formatHoverSpeed(3.075), "3.075 км/с");
});

test("invalid telemetry displays neutral placeholders", () => {
  for (const invalid of [NaN, Infinity, -Infinity, -1]) {
    assert.equal(formatHoverAltitude(invalid), "—");
    assert.equal(formatHoverSpeed(invalid), "—");
  }
});
