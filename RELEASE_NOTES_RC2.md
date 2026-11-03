# SatGeoTracker v0.9.0 RC2 — Search & Mobile Layout

This is a release candidate, not yet a final validated Windows release.

## Changes
- Search prioritizes NORAD matches and actual name matches over substrings. The ISS ZARYA object (NORAD 25544) takes precedence for `ISS`.
- Same NORAD ID appears only once in results; real ISS modules with distinct NORAD IDs remain accessible.
- Mobile SDR and PASSES modes use one 162px collapsed pass drawer. Expanded cards retain extra data and internal scrolling.
- Unchanged: orbit mechanics, CameraManager, pass predictions, SDR data, favorites persistence, graphics assets.

## Windows steps
1. Unzip to a **new** folder, keep v0.9.0 as fallback.
2. Run `setup.cmd`, then `dev.cmd`.
3. Search `ISS`, `25544`, `WGS`; check ranking and unique NORAD IDs.
4. With observer configured, switch SDR/PASSES at 390, 520, 768 px and check bottom drawer height. Expand/collapse.
5. Open DevTools Console and confirm no new Cesium worker errors; run `npm run build` in `frontend`.

## QA caveats
- Automated tests verify search logic and CSS structure; visual browser testing remains required.
- Not yet published to GitHub main.
