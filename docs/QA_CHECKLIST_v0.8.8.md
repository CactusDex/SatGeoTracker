# SatGeoTracker v0.8.8 — acceptance checklist

Use a fresh folder and run `setup.cmd`, then `dev.cmd`. Do not copy old
`frontend/node_modules` from v0.8.7 into the new release.

## Visual tests (browser)

1. Search ISS (NORAD 25544), focus on its 3D model. The grey detached sphere
   cluster from v0.8.7 must be gone. The station itself must remain detailed.
   Reload the page and repeat to confirm the previous shared GLB cache was fixed.
2. At 1920x1080 select ISS: `ЗЕМЛЯ` and close button must be equal height,
   aligned on one horizontal row, without obscuring the header/target name.
3. Switch to `ПРОЛЁТЫ` with an observer configured. The inspector should stop
   above the pass drawer. Expand and collapse the pass drawer; the inspector
   bottom boundary must move with it. Content below the boundary scrolls inside.
4. Select different satellites on bright imagery/ocean/night sky. All normal
   markers must remain visible as amber dots with dark borders.
5. Find ISS and CSS/Tiangong (NORAD 48274). Verify the distinct magenta station
   pictogram is visible and clickable, and the inspector shows `СТАНЦИЯ`.
   On close-up ISS the icon disappears when the detailed 3D model takes over.
6. Test 1366x768, 1920x1080 and a narrow viewport. Open/close controls,
   camera tracking and changing modes should still work.

## Automated tests

Frontend (after setup): `cd frontend && npm run test:orbits && npm run test:markers`

Backend (no database required): `python -m unittest discover -s backend/tests -v`

Build: `cd frontend && npm run build` (requires platform-specific dependencies)

## Non-goals

No change to SGP4 orbit propagation, camera controller, AOS/TCA/LOS prediction,
SatNOGS SDR, or user accounts/database. Favorites are planned for v0.9.0.
