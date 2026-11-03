import test from "node:test";
import assert from "node:assert/strict";
import {
  isSpaceStation, TRACKER_COLOR, STATION_COLOR, TRACKER_OUTLINE_COLOR,
} from "../src/markers/stationMarkers.ts";

test("ISS and Tiangong are recognizable stations", () => {
  assert.equal(isSpaceStation(25544, "ISS (ZARYA)"), true);
  assert.equal(isSpaceStation(48274, "CSS (TIANHE)"), true);
  assert.equal(isSpaceStation(999999, "TIANGONG"), true);
});

test("non-station spacecraft are not falsely classified", () => {
  assert.equal(isSpaceStation(43226, "STARLINK-1234"), false);
  assert.equal(isSpaceStation(20580, "HUBBLE SPACE TELESCOPE"), false);
});

test("marker colors are distinct and contrast with backdrop", () => {
  assert.notEqual(TRACKER_COLOR, STATION_COLOR);
  assert.notEqual(TRACKER_COLOR, TRACKER_OUTLINE_COLOR);
  assert.match(TRACKER_COLOR, /^#[0-9a-fA-F]{6}$/);
});
