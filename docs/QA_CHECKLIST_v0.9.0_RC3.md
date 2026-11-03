# SGT v0.9.0 RC3 — QA checklist

## Common hover (mouse / trackpad)

1. MAP: hover a regular satellite dot. Card at upper left shows name, NORAD, orbit type, altitude and speed.
2. MAP: hover ISS/Tiangong station icon. Verify the same card shows the STATION badge.
3. SDR: hover a radio-enabled satellite. Same identity and telemetry plus frequency/mode/service, if catalog data exists.
4. PASSES: hover an eligible satellite. Same identity and telemetry plus next calculated pass, if present.
5. When observer configured, elevation is displayed; without observer there is no bogus value.
6. Move the pointer into empty space: tooltip disappears. Moving between satellites updates it. No click is necessary and the camera does not follow.
7. Hover an already selected satellite: tooltip still works; right inspector remains unchanged.
8. Switch workspaces; no stale tooltip and hover only for visible targets.
9. At narrow widths and on touchscreens there is no floating hover card; tap to select remains available.

## Regression

1. Favorites persistence, quick focus and removal.
2. LEO/MEO/GEO orbits, FOV / camera, Cesium Workers, ISS 3D model.
3. Pass drawer, Graphite Glass, logo and browser favicon.
4. Test from `frontend`: `npm run test:all`, `npm run check:cesium`, `npm run build` on Windows.
5. Inspect DevTools Console for new errors, and confirm v0.9.0 RC3 label.
