import test from "node:test";
import assert from "node:assert/strict";
import { searchSatellites } from "../src/search/satelliteSearch.ts";

const rows = [
  { noradId: 35932, name: "SWISSCUBE", internationalId: "2009-051B", orbitType: "LEO" },
  { noradId: 26400, name: "ISS (ZVEZDA)", internationalId: "2000-037A", orbitType: "LEO" },
  { noradId: 25575, name: "ISS (UNITY)", internationalId: "1998-069F", orbitType: "LEO" },
  { noradId: 68454, name: "AISSAT 4", internationalId: "2026-010A", orbitType: "LEO" },
  { noradId: 25544, name: "ISS (ZARYA)", internationalId: "1998-067A", orbitType: "LEO" },
  { noradId: 25544, name: "ISS (ZARYA)", internationalId: "1998-067A", orbitType: "LEO" },
  { noradId: 42075, name: "WGS F9 (USA 275)", internationalId: "2017-008A", orbitType: "GEO" },
];

test("ISS main orbital object is first, modules remain distinct, substring noise is later", () => {
  const results = searchSatellites(rows, "ISS", () => true, 20);
  assert.equal(results[0].noradId, 25544);
  assert.equal(results.filter((sat) => sat.noradId === 25544).length, 1);
  assert.ok(results.findIndex((sat) => sat.noradId === 25575) < results.findIndex((sat) => sat.noradId === 35932));
  assert.ok(results.findIndex((sat) => sat.noradId === 26400) < results.findIndex((sat) => sat.noradId === 68454));
});

test("numeric exact NORAD match has priority and is unique", () => {
  assert.equal(searchSatellites(rows, "25544")[0]?.noradId, 25544);
  assert.equal(searchSatellites(rows, "25544").length, 1);
});

test("prefix matches outrank substring matches without a hard-coded catalog filter", () => {
  assert.equal(searchSatellites(rows, "ISS")[0]?.noradId, 25544);
  assert.deepEqual(searchSatellites(rows, "WGS").map((sat) => sat.noradId), [42075]);
});

test("punctuation-normalized search handles satellite fragments", () => {
  assert.equal(searchSatellites(rows, "iss z")[0]?.noradId, 25544);
});

test("mode-specific predicate is applied before search ranking", () => {
  assert.deepEqual(searchSatellites(rows, "iss", (sat) => sat.noradId === 25575).map((sat) => sat.noradId), [25575]);
});

test("empty query and zero limit do not open suggestions", () => {
  assert.deepEqual(searchSatellites(rows, "   "), []);
  assert.deepEqual(searchSatellites(rows, "iss", () => true, 0), []);
});
