# SatGeoTracker contributor instructions

## Product goal

SatGeoTracker (SGT) is an educational real-time 3D satellite tracker.
The MVP must visualize real orbital objects around a CesiumJS globe and compute current positions from orbital elements with SGP4.

## Stable architecture

- Frontend: React + TypeScript + Vite.
- 3D engine: CesiumJS.
- Orbit propagation: `satellite.js` using OMM JSON and SGP4.
- Backend: FastAPI.
- Upstream orbital source: CelesTrak GP/OMM JSON.
- Future persistent storage: PostgreSQL.
- Development API traffic goes through the Vite `/api` proxy to FastAPI.

Do not replace CesiumJS, satellite.js, FastAPI, or OMM/SGP4 without an explicit project decision.

## Important data rule

Do NOT persist per-second satellite latitude, longitude, altitude, or speed for the MVP.
These are derived runtime values:

`OMM + UTC time -> SGP4 -> position/velocity -> geodetic coordinates`.

Persist satellite identity and orbital-element history only.

## MVP scope

Required:

1. 3D Earth.
2. Real satellite data.
3. SGP4 real-time propagation.
4. Large active-satellite dataset.
5. Satellite picking.
6. Selected-object highlight.
7. Orbit path for selected object only.
8. Name.
9. NORAD ID.
10. International ID.
11. Altitude.
12. Speed.
13. Orbit class.
14. Search.
15. LEO/MEO/GEO filters.
16. Live UTC clock.
17. Collapsible information panel.
18. Backend CelesTrak cache.

Deferred until the above is stable:

- country/owner enrichment;
- news feed;
- authentication;
- favorites;
- user accounts;
- historical position storage;
- commercial features.

## Local development

First setup:

```powershell
.\setup.cmd
```

Start:

```powershell
.\dev.cmd
```

Stop:

```powershell
.\stop-dev.cmd
```

Expected endpoints:

- `http://127.0.0.1:5173/`
- `http://127.0.0.1:8000/health`
- `http://127.0.0.1:8000/api/satellites`

## Validation before finishing code changes

Run at least:

```powershell
cd frontend
npm run build
```

and verify backend syntax/imports with the project venv:

```powershell
.\backend\.venv\Scripts\python.exe -m compileall backend\app
```

If runtime behavior changed, also start `dev.cmd` and check `/health` plus the browser UI.

## Frontend rules

- Keep TypeScript strict.
- Avoid one React component per satellite.
- Large satellite rendering should use Cesium primitive collections, not thousands of React DOM nodes.
- Orbit trajectories are calculated only for selected objects unless requirements change.
- Heavy all-satellite propagation should move to a Web Worker as the next performance step.
- Keep the main interface single-screen for MVP.
- Camera v0.4 is centralized under `frontend/src/camera/` and uses an explicit `EARTH | TRANSITION | SATELLITE` state machine.
- Preserve the camera invariant `target + heading + pitch + range` in satellite mode.
- Hover must never change camera focus. Earth click / ESC must release satellite tracking.
- Never allow Cesium native camera inputs and custom satellite camera inputs to own the camera simultaneously.
- The selected satellite is propagated every render frame while tracked; the global collection remains on its slower loop.
- Do not change Earth imagery/terrain while working on camera-only tasks.

## Backend rules

- Async FastAPI I/O.
- Cache upstream CelesTrak responses in the shared per-user cache directory.
- Do not hammer CelesTrak on every browser request.
- Preserve stale cache fallback when upstream is unavailable.
- Return diagnostic upstream information on 502 errors without exposing secrets.

## Database rules

Canonical schema is `database/schema.sql`.
Core tables:

- `satellites`
- `orbital_elements`
- `sync_runs`

Country/owner lookup can be introduced later as a separate normalized table.

## Change discipline

Prefer small, runnable increments.
Do not add unrelated features while fixing startup, data loading, SGP4 correctness, or rendering performance.
Update README/docs whenever launch commands, ports, architecture, or data contracts change.

## v0.5 Earth visual baseline

Earth rendering is now owned by `frontend/src/earth/EarthVisualController.ts`.

Hard rule: do not modify CameraManager to implement imagery, atmosphere, lighting, or Earth quality. Camera v0.4.1 is the stable camera baseline.

The application UI is locked to HIGH Earth quality. Remote imagery failure must never prevent the globe, satellites, or local demo from rendering; Natural Earth remains the fallback underlay.

## Earth v0.5.6

Earth HIGH uses direct ArcGIS cached raster tile URLs through `UrlTemplateImageryProvider`. Keep the local Natural Earth layer underneath as a fast placeholder/fallback. Keep the World Boundaries and Places layer hidden at orbital overview distance and only wake it when camera height enters the map-context fade range. Do not trade away the v0.5.1 visual quality to optimize startup. Camera v0.4.1 remains a locked baseline.

The end-user quality selector was removed in v0.5.6. Do not reintroduce LOW/MED/HIGH UI controls unless explicitly requested; startup should always request HIGH immediately.


### v0.5.6 map reliability rules

- Do not reintroduce the ArcGIS `World_Boundaries_and_Places` MapServer as a runtime dependency for country/city labels.
- Keep local map context under `frontend/public/map-data/`.
- Keep World Imagery browser requests same-origin through `/api/map/imagery/{z}/{y}/{x}`.
- Keep the persistent backend tile cache and stale-tile fallback.
- Do not modify Camera v0.4.1 while working on Earth visuals.

### Earth v0.5.7 adaptive-detail baseline

- Default HIGH imagery must use Cesium `ArcGisMapServerImageryProvider.fromUrl` against ArcGIS World Imagery, wrapped by `ImageryLayer.fromProviderAsync` so provider initialization never blocks startup.
- Keep Natural Earth II underneath as the instant placeholder/fallback.
- Keep local borders/country/city labels independent from remote imagery.
- Preserve adaptive globe LOD: tighten `maximumScreenSpaceError` as camera height decreases instead of forcing maximum detail at orbital overview distances.
- Keep `useBrowserRecommendedResolution=false` in HIGH so Cesium renders in device pixels.
- Do not route the default imagery path through the FastAPI tile proxy unless a future regression proves the direct provider unusable.
- Do not modify Camera v0.4.1 while working on Earth visuals.


## v0.6.2 selected-model baseline

- Keep the full ACTIVE catalog as `PointPrimitiveCollection`; do not instantiate one glTF model per satellite.
- Detailed spacecraft models belong under `frontend/src/models/` and are selected through the registry.
- In v0.6.2 only NORAD 25544 (ISS) has a detailed model.
- The selected model must use the exact Cartesian3 generated by the existing per-frame tracked-object SGP4 path.
- OMM/SGP4 is orbital state, not spacecraft body-attitude telemetry. Do not describe the visual velocity-aligned orientation as true ISS attitude.
- Keep `minimumPixelSize=0` for real-scale spacecraft rendering. Use point/model LOD rather than silently inflating the physical model.
- Model load failure must fall back to the PointPrimitive without breaking tracking.
- Preserve Earth v0.5.7 imagery, atmosphere, local borders/cities, and adaptive LOD while working on models.
- Camera v0.4.1 remains the state-machine baseline. v0.6.2 may use the documented optional preferred target range / 250 m close-zoom extension, but must not alter Earth-return logic or introduce a second camera owner.

## v0.7 observer/pass baseline

- Ground-station logic lives under `frontend/src/observer/` and must remain separate from CameraManager/EarthVisualController.
- Observer latitude/longitude/altitude are local browser state; v0.7 does not send them to FastAPI.
- Browser geolocation must remain permission-based and manual coordinates must remain available as fallback.
- Pass prediction must run in the Web Worker, not in the Cesium render loop or React 1 Hz update loop.
- Default pass horizon is 60 minutes and the minimum elevation mask is a user-facing filter.
- AOS/TCA/LOS are derived from OMM + SGP4 + observer location; do not persist per-second pass geometry.
- Do not let observer/pass errors stop Cesium rendering, selected-object tracking, or the point catalog.
- Earth v0.5.7 and Camera v0.4.1 remain locked baselines while working on observer/SDR features.
