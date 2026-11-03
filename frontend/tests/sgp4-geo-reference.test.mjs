import test from 'node:test';
import assert from 'node:assert/strict';
import * as satellite from 'satellite.js';
import { sampleOrbitInEarthFixedFrame } from '../src/orbitPath.ts';

// Historical orbital elements for WGS F9 (USA 275), NORAD 42075,
// from Heavens-Above 2026-06-08. This is a TEST FIXTURE, not live navigation data.
const WGS_F9 = {
  OBJECT_NAME: 'WGS F9 (USA 275)',
  OBJECT_ID: '2017-016A',
  EPOCH: '2026-06-08T08:11:30.953',
  MEAN_MOTION: 1.00275450,
  ECCENTRICITY: 0.0000573,
  INCLINATION: 0.0103,
  RA_OF_ASC_NODE: 278.5527,
  ARG_OF_PERICENTER: 187.7613,
  MEAN_ANOMALY: 261.3090,
  NORAD_CAT_ID: 42075,
  EPHEMERIS_TYPE: 0,
  CLASSIFICATION_TYPE: 'U',
  ELEMENT_SET_NO: 1,
  REV_AT_EPOCH: 0,
  BSTAR: 0,
  MEAN_MOTION_DOT: 0,
  MEAN_MOTION_DDOT: 0,
};

const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const norm = p => Math.hypot(p.x,p.y,p.z);

test('WGS F9: real SGP4 propagation gives a GEO ring, not a collapsed ground-track line', () => {
  const satrec = satellite.json2satrec(WGS_F9);
  const center = new Date(WGS_F9.EPOCH+'Z');
  const periodMs = 86_400_000 / WGS_F9.MEAN_MOTION;
  const dates = Array.from({length:241},(_,index) => new Date(center.getTime() + (index-120)*periodMs/240));
  const gmst = satellite.gstime(center);
  const propagate = date => satellite.propagate(satrec,date)?.position || null;

  const orbit = sampleOrbitInEarthFixedFrame(dates,gmst,propagate);
  assert.equal(orbit.length,241);
  const radii = orbit.map(norm);
  assert.ok(Math.min(...radii)>41_900_000,`Min orbital radius ${Math.min(...radii)}m`);
  assert.ok(Math.max(...radii)<42_400_000,`Max orbital radius ${Math.max(...radii)}m`);
  assert.ok(distance(orbit[0],orbit[120])>80_000_000,'True GEO orbit extends around Earth');

  const groundRelative = dates.map(date => sampleOrbitInEarthFixedFrame([date],satellite.gstime(date),propagate)[0]);
  assert.ok(distance(groundRelative[0],groundRelative[120])<100_000,'GEO ground track is nearly stationary');

  const pv = satellite.propagate(satrec,center);
  const ecf = satellite.eciToEcf(pv.position,gmst);
  const actualCenter = {x:ecf.x*1000,y:ecf.y*1000,z:ecf.z*1000};
  assert.ok(distance(orbit[120],actualCenter)<0.01,'Selected marker coincides with orbit at the reference UTC');
});
