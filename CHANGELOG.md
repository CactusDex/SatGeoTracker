# Changelog

## v0.9.1 — Universal Satellite Hover (accepted)

- Единая карточка наведения в КАРТА / SDR / ПРОЛЁТЫ с названием, NORAD ID, орбитальным классом, высотой и скоростью.
- Дополнительные данные: угол места при заданном наблюдателе, параметры радиоканала в SDR и ближайший прогноз в ПРОЛЁТЫ.
- Наведение не захватывает выбор спутника и не меняет камеру; обычное нажатие сохраняется.
- Перенесены исправления v0.9.0 RC2: ранжирование поиска по NORAD/названию и одинаковые размеры мобильных карточек SDR/ПРОЛЁТЫ.
- Сохранены Favorites, Graphite Glass, логотип и фавикон из v0.9.0.
- Принято пользователем после браузерной проверки. Production-сборку на Windows и независимую проверку SGP4 на свежих OMM следует подтвердить отдельно.

## v0.9.0 — Favorites & Identity (functionally accepted)

- Local NORAD-based favorites with cached names, searchable list and quick focus.
- Preserve unavailable favorites and tolerate restricted browser storage.
- Graphite Glass translucent inspector with internal scrolling.
- Full-width pass drawer below the inspector; eliminate bottom-right gap.
- Add approved orbit/globe branding: header mark and SVG/PNG/ICO favicons.
- Preserve Cesium static runtime and all v0.8.8 orbital/camera/SDR logic.
- Browser regression and Windows production build remain to be confirmed.


## v0.8.8 — Visual Polish (accepted)

- Remove detached construction meshes from the original NASA ISS B glTF scene.
- Sanitize previously cached GLB and bust client immutable URL cache.
- Align inspector top-line buttons; constrain inspector to the pass drawer.
- Amber satellite points, contrasting station icons and a station badge.
- No SGP4, camera, pass prediction or SDR algorithm changes.
- Validate model appearance and responsive layout in browser before release.

## v0.8.7 — Cesium Worker hotfix

- Bundle Cesium static assets so a fresh ZIP has the workers immediately.
- Automatically validate and refresh Cesium runtime assets when npm dependencies change, before starting Vite.
- Fail setup on npm / pip install errors, and check the concrete Worker file before starting.
- No changes to orbital math, 3D camera, FastAPI, or UI rendering logic.


## v0.8.7 — Orbital Accuracy (candidate)

- Fix GEO / MEO / LEO orbit line by converting propagated TEME samples with a **single reference GMST**, instead of a time-varying GMST per sample.
- Render world-space 3D orbit segments with `ArcType.NONE`.
- Refresh the orbit polyline every 30 seconds so the inertial-plane orientation does not drift relative to moving Earth and selected marker.
- Add geometry/pass-refinement regression tests and a real WGS F9 satellite.js fixture; add optional independent JS / Python SGP4 + pass audits.
- Leave CameraManager, SGP4 physics, pass prediction model, SDR and FastAPI intact.
- Browser and independent SGP4 numeric audits remain required before publishing a stable release.

## v0.8.6 — Stability & UX (candidate)

- Keep the TOOLS popover open when switching ALL / LEO / MEO / GEO filters.
- Restore globe depth testing for the observer marker so it cannot appear through Earth.
- Raise the legibility of small telemetry, labels, pass cards and interactive controls.
- Reflow the narrow-screen header and improve compact pass-card sizing.
- Leave CameraManager, SGP4, pass prediction and FastAPI unchanged.
- Browser regression and production build validation are required before release.


## v0.8.5 — Dynamic Camera FOV

- Added smooth perspective FOV control from `25°` to `110°` with `Ctrl + Wheel`.
- FOV control works in both Earth navigation and satellite tracking without changing the existing normal-wheel behavior.
- Added `Ctrl + 0` reset to the default `60°` lens.
- Added a compact auto-hiding `FOV xx°` HUD for immediate feedback.
- Intercepted modified wheel input before Cesium/browser zoom so FOV adjustment is exclusive and deterministic.
- Kept the projection perspective-only; no post-process fisheye distortion was introduced, preserving Cesium picking accuracy.
- Camera baseline advanced to v0.4.2; SGP4, Earth/ISS 3D, Observer/Pass Engine, and SDR backend remain unchanged.

## v0.8.4 — Russian UI Adaptation

- Adapted the user-facing shell and workflow copy to Russian while preserving technical acronyms and radio/orbital terminology where appropriate.
- Localized MAP/PASSES navigation labels, search placeholders, tools/panel controls, workspace summaries, tracking context, loading/error states, and technical metadata labels.
- Localized Observer controls, geolocation feedback, pass prediction messages, pass cards, and pass-drawer actions.
- Localized SDR filter/radio UI while preserving band names, NORAD, UTC, RX, SGP4/OMM, and raw external service metadata.
- Switched cardinal direction display to Russian abbreviations.
- No functional changes to Camera, propagation, Earth/ISS 3D, pass calculations, or SDR backend.
- Logo/favicon remain intentionally deferred.

## v0.8.3 — Workspace Layout Cleanup

- Reworked the shell around a map-first layout with fewer simultaneous floating surfaces.
- Converted `TOOLS` into a compact temporary popover and removed catalog/visible/source statistic cards from it.
- Converted the right object/workspace panel into a docked inspector attached to the application edge.
- Rebuilt the pass strip as a compact bottom drawer with collapsed and expanded states.
- Collapsed pass cards now expose only actionable summary data; expanded mode provides detailed multi-row browsing.
- Replaced oversized metric cards with dense telemetry readouts for altitude, velocity, elevation, azimuth, and range.
- Moved low-frequency object metadata into an expandable `TECHNICAL DATA` section.
- Selecting a target now dismisses the transient tools popover automatically.
- Preserved Camera, SGP4/orbit core, Earth/ISS 3D, Observer/Pass Engine, and SDR backend behavior.
- Logo/favicon remain intentionally deferred.

## v0.8.2 — Mode Wiring + Working Controls

- Wired `MAP`, `SDR`, and `PASSES` to distinct map/search behavior instead of shell-only tabs.
- `MAP` keeps the full orbital workspace under the active orbit filter.
- `SDR` limits map/search to satellites matching active radio filters and shows receivable pass cards when an observer is available.
- `PASSES` limits map/search to satellites with predicted passes in the current horizon.
- Orbit filters now also constrain displayed pass cards without changing the pass engine itself.
- `PANEL` is now a true workspace panel: it can open without a selected satellite and shows mode-specific status/metrics.
- Selected-object panel content is mode-aware for map, radio, and pass workflows.
- `TOOLS` is mode-aware and exposes SDR controls only in SDR mode while retaining observer/orbit controls where relevant.
- Fixed stale mode visibility when releasing a tracked target after switching workspaces.
- Camera, SGP4, Earth/ISS 3D, Observer/Pass Engine, and SDR backend behavior remain unchanged.
- Logo/favicon remain intentionally deferred.

## v0.8.1 — UI Redesign Shell + Branding

- Rebuilt the application shell around a solid dark graphite header.
- Added workspace modes: `MAP`, `SDR`, and `PASSES`.
- Added `TOOLS` popover for orbit filters, observer controls, and SDR filters.
- Added `PANEL` toggle that hides satellite details without cancelling tracking.
- Added explicit `EARTH` action inside the satellite panel to release camera tracking.
- Shortened and normalized the header search control.
- Removed the permanent lower-left status panel and persistent left-side tool panels.
- Unified cards, controls, spacing, borders, radii, and typography.
- Removed UI gradients from the shell.
- Preserved Camera, SGP4 propagation, Earth/ISS 3D, Observer/Pass Engine, and SDR data logic.
- Logo/favicon intentionally deferred; v0.8.1 ships without logo assets.

## 0.8.0

### Added

- MAP / SDR workspace switch.
- SatNOGS DB transmitter metadata proxy and persistent cache.
- RF band, mode, service, active-only and visible-now filters.
- Satellite-to-transmitter matching by NORAD catalog ID.
- Selected-object SDR radio panel with downlink frequency, mode, service, status and baud.
- Real-time Doppler shift / RX NOW estimate from observer-relative range rate.
- SDR hover card and radio-aware pass strip.

### Preserved

- Earth visual baseline v0.5.7.
- Camera baseline/state machine v0.4.1.
- Selected ISS 3D model subsystem v0.6.2.
- Observer/pass subsystem v0.7.0.

## 0.7.0

### Added

- Observer station from browser geolocation or manual coordinates.
- Local-only observer persistence.
- Globe observer marker.
- Live selected-satellite azimuth, elevation and slant range.
- User-selectable minimum elevation mask (5°/10°/20°/30°).
- Next-hour AOS/TCA/LOS pass predictor in a dedicated Web Worker.
- Maximum elevation and azimuth-at-TCA pass metadata.
- Bottom pass strip with NOW/countdown state and click-to-track.
- Automatic five-minute pass refresh plus manual refresh.

### Preserved

- Earth visual baseline v0.5.7 unchanged.
- Camera baseline/state machine v0.4.1 unchanged.
- Selected ISS 3D model subsystem v0.6.2 preserved.
- Backend CelesTrak/model cache behavior unchanged.
