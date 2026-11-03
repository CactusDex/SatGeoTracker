# SatGeoTracker v0.9.0 RC2 — QA checklist

## Search / catalog

1. Search `iss`: first match should be **ISS (ZARYA)**, NORAD **25544**.
2. ISS (UNITY), ISS (ZVEZDA) must remain distinct with their original NORAD IDs.
3. Lower relevance matches like SWISSCUBE can be listed after actual ISS names; no repeat of the same NORAD ID.
4. Search `25544`: exact match is first. Search `WGS` and a partial satellite name.
5. Switch between MAP, SDR, PASSES and verify search remains constrained to each workspace.

## Mobile panels (DevTools responsive mode)

1. Test 390x820, 520x820, 768x820 and 1920x1080.
2. Configure observer and choose SDR, then PASSES.
3. In both workspaces, the collapsed pass drawer should have the same height and cards should be equal in size.
4. Expand/collapse both drawers. Additional information must scroll within the drawer.
5. Confirm that the page itself does not grow a vertical scrollbar and the bottom-right gap stays filled.

## Regression / release gate

1. Add/remove a favorite, reload, confirm persistence; temporarily unavailable entries stay saved.
2. Check ISS, GPS and GEO tracking; FOV, observer marker, Orbit view, SDR and passes.
3. Confirm logo/favicons and v0.9.0 RC2 label.
4. Open F12 -> Console. No new Cesium Worker errors or uncaught rendering errors.
5. From `frontend` run `npm run test:all`, `npm run check:cesium`, `npm run build` on Windows.
6. Do not publish RC2 to GitHub `main` until browser and production-build checks pass.
