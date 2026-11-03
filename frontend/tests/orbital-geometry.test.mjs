import test from 'node:test';
import assert from 'node:assert/strict';

import {
  sampleOrbitInEarthFixedFrame,
  temeToEarthFixedMeters,
} from '../src/orbitPath.ts';
import { refineCrossing, refinePeak } from '../src/observer/passMath.ts';

const TAU = 2 * Math.PI;
const SIDEREAL_DAY_MS = 86_164_090.5;
const EARTH_ANGULAR_RATE = TAU / SIDEREAL_DAY_MS;
const EPOCH_MS = Date.UTC(2026, 10, 3, 19, 0, 0);
const GMST_AT_EPOCH = 1.2345;

function circularTeme(radiusKm, periodMs, inclinationDeg = 0) {
  const inc = inclinationDeg * Math.PI / 180;
  return (date) => {
    const theta = TAU * (date.getTime() - EPOCH_MS) / periodMs;
    return {
      x: radiusKm * Math.cos(theta),
      y: radiusKm * Math.sin(theta) * Math.cos(inc),
      z: radiusKm * Math.sin(theta) * Math.sin(inc),
    };
  };
}

function sampledDates(periodMs) {
  return Array.from({ length: 241 }, (_, index) => new Date(
    EPOCH_MS + (index - 120) * (periodMs / 240)
  ));
}

function norm(point) {
  return Math.hypot(point.x, point.y, point.z);
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

for (const { kind, radiusKm, periodMs, inclination } of [
  { kind: 'LEO', radiusKm: 6_770, periodMs: 5_500_000, inclination: 51.6 },
  { kind: 'MEO', radiusKm: 26_560, periodMs: 43_082_000, inclination: 55 },
  { kind: 'GEO', radiusKm: 42_164, periodMs: SIDEREAL_DAY_MS, inclination: 0.1 },
]) {
  test(`${kind}: a fixed-epoch coordinate frame preserves the full 3D orbit`, () => {
    const propagate = circularTeme(radiusKm, periodMs, inclination);
    const dates = sampledDates(periodMs);
    const points = sampleOrbitInEarthFixedFrame(dates, GMST_AT_EPOCH, propagate);

    assert.equal(points.length, dates.length);
    assert.ok(points.every(p => Math.abs(norm(p) - radiusKm * 1000) < 1));

    // Half an orbit after the first sample should be on the opposite side
    // of the Earth. Old per-sample GMST would wrongly collapse a GEO ring.
    assert.ok(dist(points[0], points[120]) > 1.9 * radiusKm * 1000);
    assert.ok(dist(points[0], points[240]) < 10); // One complete period, UTC rounded to ms

    const marker = temeToEarthFixedMeters(propagate(new Date(EPOCH_MS)), GMST_AT_EPOCH);
    assert.ok(dist(points[120], marker) < 1);
  });
}

test('GEO ground track is NOT its orbital ring', () => {
  const satelliteAt = circularTeme(42_164, SIDEREAL_DAY_MS, 0);
  const dates = sampledDates(SIDEREAL_DAY_MS);
  const orbit3D = sampleOrbitInEarthFixedFrame(dates, GMST_AT_EPOCH, satelliteAt);
  const earthRelative = dates.map(date => {
    const dt = date.getTime() - EPOCH_MS;
    return temeToEarthFixedMeters(satelliteAt(date), GMST_AT_EPOCH + dt * EARTH_ANGULAR_RATE);
  });
  assert.ok(dist(orbit3D[0], orbit3D[120]) > 80_000_000);
  assert.ok(dist(earthRelative[0], earthRelative[120]) < 1);
});

test('invalid or failed SGP4 propagation never produces NaN orbit vertices', () => {
  const points = sampleOrbitInEarthFixedFrame(
    [new Date(EPOCH_MS), new Date(EPOCH_MS + 1), new Date(EPOCH_MS + 2)],
    0,
    date => date.getTime() === EPOCH_MS + 1 ? null : {x: 7000, y:0, z:0}
  );
  assert.equal(points.length, 2);
  assert.deepEqual(sampleOrbitInEarthFixedFrame([new Date(EPOCH_MS)], NaN, () => ({x:1,y:0,z:0})), []);
});

test('AOS and LOS threshold refinement is accurate to <= 0.06 sec over a 60 sec bracket', () => {
  const t0 = 100_000;
  const aosExact = t0 + 17_123;
  const losExact = t0 + 46_789;
  const aos = refineCrossing(t0, t0 + 60_000, 10, true, t => 10 + (t - aosExact) / 1000);
  const los = refineCrossing(t0, t0 + 60_000, 10, false, t => 10 - (t - losExact) / 1000);
  assert.ok(Math.abs(aos - aosExact) <= 30);
  assert.ok(Math.abs(los - losExact) <= 30);
  assert.ok(aos < los);
});

test('TCA peak refinement retains AOS < TCA < LOS for a complete synthetic pass', () => {
  const aos = 0, los = 480_000, expectedTca = 215_000;
  const elevation = t => 68 - ((t - expectedTca) / 60000) ** 2;
  const tca = refinePeak(aos, los, elevation);
  assert.ok(aos < tca && tca < los);
  assert.ok(Math.abs(tca - expectedTca) < 5_000, `TCA = ${tca}`);
});
