/**
 * Independent SGP4 audit stage 1: export unmodified CelesTrak OMM input,
 * UTC timestamps, and satellite.js TEME vectors for Python comparison.
 *
 * Run from frontend/: node scripts/sgp4-audit.mjs [OMM_JSON_CACHE] [OUTPUT_JSON]
 * Requires `npm install` to have installed satellite.js.
 */
import * as satellite from 'satellite.js';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const defaultCache = process.platform === 'win32'
  ? join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'SatGeoTracker', 'cache', 'celestrak-active.json')
  : join(homedir(), '.cache', 'satgeotracker', 'celestrak-active.json');
const input = process.argv[2] || defaultCache;
const output = process.argv[3] || 'sgp4-audit-output.json';

if (!existsSync(input)) {
  console.error(`OMM catalog not found: ${input}`);
  console.error('Run the application once to populate its CelesTrak cache, or supply a JSON file path.');
  process.exit(2);
}

const records = JSON.parse(readFileSync(input, 'utf8'));
if (!Array.isArray(records)) throw new Error('CelesTrak OMM must be a JSON array.');
const meanMotion = row => Number(row.MEAN_MOTION);
const search = predicate => records.find(predicate);
const chosen = [
  search(row => Number(row.NORAD_CAT_ID) === 25544),
  search(row => meanMotion(row) >= 1.8 && meanMotion(row) <= 2.4 && /GPS|NAVSTAR/i.test(row.OBJECT_NAME || '')) ||
    search(row => meanMotion(row) >= 1.8 && meanMotion(row) <= 2.4),
  search(row => /WGS\s*F9|USA\s*275/i.test(row.OBJECT_NAME || '')) ||
    search(row => meanMotion(row) >= 0.95 && meanMotion(row) <= 1.05),
].filter(Boolean);
const unique = [...new Map(chosen.map(row => [Number(row.NORAD_CAT_ID), row])).values()];
if (unique.length < 3) console.warn(`Only ${unique.length} test-class objects available in cache; provide a full ACTIVE catalog.`);

const center = new Date();
const offsets = [-3600, -900, -300, 0, 300, 900, 3600];
const cases = [];
for (const omm of unique) {
  const norad = Number(omm.NORAD_CAT_ID);
  let satrec;
  try { satrec = satellite.json2satrec(omm); }
  catch (error) { console.warn(`Skipping NORAD ${norad}: ${error}`); continue; }

  const samples = offsets.map(offset => {
    const when = new Date(center.getTime() + offset * 1000);
    const pv = satellite.propagate(satrec, when);
    if (!pv?.position || !pv?.velocity) return { utc: when.toISOString(), error: 'SGP4 propagate failed' };
    return {
      utc: when.toISOString(),
      temePositionKm: pv.position,
      temeVelocityKmS: pv.velocity,
    };
  });
  cases.push({ name: omm.OBJECT_NAME, norad, omm, samples });
  console.log(`${norad} ${omm.OBJECT_NAME}: epoch ${omm.EPOCH}, ${samples.filter(s => s.temePositionKm).length} position samples`);
}
const report = {
  schema: 'satgeotracker.sg4audit.v1',
  generatedUtc: center.toISOString(),
  sourceFile: input,
  note: 'TEME is NOT Earth-fixed. Compare TEME at the same UTC with an independent SGP4 implementation.',
  cases,
};
writeFileSync(output, JSON.stringify(report, null, 2), 'utf8');
console.log(`Wrote ${output}. Next: python ../scripts/compare_sgp4.py ${output}`);
