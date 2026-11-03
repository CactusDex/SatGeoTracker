# MVP roadmap

## Stage 0 — local environment

- [x] FastAPI starts locally.
- [x] Vite starts locally.
- [x] Cesium runtime assets are available.
- [x] One-command launcher added.
- [x] Fixed dev ports.
- [x] Vite API proxy added.
- [x] CelesTrak cache survives project-version upgrades.

## Stage 1 — reliable real data

- [x] ACTIVE CelesTrak dataset works with local cache/stale-cache fallback.
- [x] Real OMM data reaches frontend.
- [x] ISS-only query can be used as diagnostic mode.

## Stage 2 — satellite rendering

- [x] Large active-object set renders with `PointPrimitiveCollection`.
- [x] Global positions update on the MVP 1 Hz loop.
- [x] Selected satellite remains highlighted.
- [x] Orbit path is rendered for selected object.

## Stage 3 — interaction

- [x] Search by name/NORAD/International ID.
- [x] LEO/MEO/GEO filter.
- [x] Side panel metrics.
- [x] LIVE UTC clock.
- [x] Hover highlight.

## Stage 3.5 — Camera System v0.4

- [x] Explicit `EARTH | TRANSITION | SATELLITE` state machine.
- [x] Hover never changes focus.
- [x] Smooth satellite focus transition.
- [x] Per-render-frame SGP4 for tracked object.
- [x] Camera follows moving selected satellite.
- [x] KSP-style `target + heading + pitch + range` orbit controls.
- [x] Logarithmic/smoothed satellite zoom.
- [x] Earth click releases satellite focus.
- [x] ESC releases satellite focus.
- [x] Switching target cancels stale transition ownership.
- [x] F8 camera debug overlay.
- [x] Browser acceptance test/tuning pass on the development machine.


## Stage 3.6 — Earth Visual System v0.5

- [x] High-resolution ArcGIS World Imagery when available.
- [x] Bundled Natural Earth II fallback for offline/error operation.
- [x] HIGH-quality Earth mode; end-user quality selector removed in v0.5.4.
- [x] Sun-driven globe and atmosphere lighting.
- [x] Improved SkyAtmosphere / ground atmosphere.
- [x] HDR where supported.
- [x] Cesium lighting clock synchronized with live UTC.
- [x] Camera v0.4.1 left unchanged.

## Stage 4 — performance

- [ ] Move bulk SGP4 propagation to Web Worker.
- [ ] Measure frame time with full ACTIVE dataset.
- [ ] Avoid unnecessary primitive rewrites.
- [ ] Add update throttling/adaptive cadence if needed.

## Stage 5 — selected-object presentation

- [x] Dedicated model registry / manager.
- [x] Official NASA ISS GLB for NORAD 25544.
- [x] Real-scale ISS reference span (109 m).
- [x] LOD rule for ISS: point -> selected 3D model at close range.
- [x] Same per-frame SGP4 position shared by marker/model/camera target.
- [x] Visual orbital orientation from propagated motion.
- [ ] Hubble / Starlink model registry entries.
- [ ] Generic GLB for unknown satellites.
- [ ] Ground track.
- [ ] Past/future orbit styling.

## Stage 6 — time simulation

- [ ] Pause simulation time.
- [ ] 0.1x / 1x / 10x / 100x.
- [ ] Future/past SGP4 position preview.

## Stage 7 — database integration

- [ ] PostgreSQL service/config.
- [ ] OMM synchronization into `satellites` and `orbital_elements`.
- [ ] `sync_runs` logging.
- [ ] SATCAT owner enrichment.

## Deferred

- country filter;
- news feed;
- favorites;
- authentication;
- user profiles.

## v0.5 — Earth Visual Upgrade ✅

- high-resolution online Earth imagery with local fallback;
- improved atmosphere and Earth limb;
- Sun-driven day/night lighting;
- HIGH-quality Earth mode with local fallback;
- camera v0.4.1 unchanged.

## v0.6 — Selected Satellite 3D Mode

Next target:

- official NASA ISS glTF model;
- real physical scale for ISS;
- selected-object-only 3D LOD;
- model transform driven by the same SGP4 sample as the tracking target;
- no conversion of the global PointPrimitiveCollection to Entities.

- v0.5.1 — scale-aware country boundaries / countries / city labels.

## v0.7.0 — Observer & Pass Engine (implemented)

- browser/manual observer location;
- local observer persistence;
- live azimuth/elevation/range;
- elevation mask;
- next-hour AOS/TCA/LOS prediction in a Web Worker;
- pass strip and click-to-track.

## Next SDR stages

- RF/transmitter metadata joined by NORAD ID;
- band/frequency/modulation/status filters;
- receivable-now view;
- Doppler correction and tuning target;
- pass timeline / SDR workspace redesign;
- optional SDR/rig and antenna-rotator integration.
## v0.8.1 — UI Redesign Shell ✅

- graphite top shell without gradients;
- `MAP / SDR / PASSES` workspace tabs;
- compact `TOOLS` menu;
- hideable right `PANEL`;
- unified controls, cards, spacing and typography;
- logo/favicon deferred.

## v0.8.3 — Workspace Layout Cleanup ✅

- Map-first workspace layout.
- Compact temporary `TOOLS` popover.
- Docked right-side inspector `PANEL`.
- Collapsible bottom pass drawer.
- Dense telemetry and expandable technical metadata.
- No logo/favicon in this release.
- No changes to Camera, SGP4, Earth/ISS 3D, Observer/Pass Engine, or SDR backend.

## v0.8.2 — Mode Wiring + Working Controls ✅

- mode-specific globe and search filtering;
- radio-capable targets and receivable pass strip in `SDR`;
- predicted-pass targets in `PASSES`;
- orbit filter wired into pass presentation;
- context-aware workspace/selected-object `PANEL`;
- mode-aware `TOOLS`;
- Camera, SGP4, Earth/ISS 3D, Observer/Pass Engine and SDR backend preserved.



## v0.8.4 — Russian UI Adaptation ✅

- Russian user-facing shell and workflow copy.
- Technical acronyms and orbital/radio notation preserved where appropriate.
- Russian Observer, pass drawer and SDR control labels/statuses.
- Russian cardinal direction abbreviations.
- No logo/favicon and no functional core changes.

## v0.8.5 — Dynamic Camera FOV ✅

- `Ctrl + Wheel` smooth FOV control (`25–110°`).
- Works in Earth and satellite camera modes.
- Normal wheel behavior remains unchanged.
- `Ctrl + 0` resets FOV to `60°`.
- Temporary auto-hiding FOV HUD.
- Perspective-only implementation; true fisheye distortion remains deferred.
- Camera baseline v0.4.2; no changes to SGP4, Earth/ISS 3D, Observer/Pass Engine, or SDR backend.

## v0.8.6 — Stability & UX (candidate)

- [x] Keep orbital filter tools open during selection.
- [x] Respect Earth occlusion for observer marker.
- [x] Improve compact typography and narrow-viewport layout.
- [ ] Validate with a production frontend build and browser regression checks.

## Planned v0.9.0 — Local satellite favorites

- [ ] Save favorite NORAD IDs in browser localStorage.
- [ ] Add star action to satellite inspector and a favorites list.
- [ ] Preserve unavailable IDs without requiring a server-side database.


## v0.8.7 — Orbital Accuracy (candidate)

- [x] Separate spatial orbit from time-varying Earth-fixed ground track.
- [x] Render one TEME -> Earth-fixed rotation at the orbit's reference UTC time.
- [x] Use ArcType.NONE and refresh the selected orbit every 30 seconds.
- [x] Unit-test inertial orbit geometry and pass crossing/peak refinement.
- [x] Add optional JS vs Python SGP4 audit scripts.
- [ ] Verify fresh LEO / MEO / GEO OMM numerically on the user's machine.
- [ ] Check GEO image / Cesium rendering and AOS/TCA/LOS against independent results.


## v0.8.8 — Visual Polish (candidate)

- [x] Remove isolated mesh nodes from NASA ISS B GLB (including old cache migration).
- [x] Align return-to-Earth and close controls in inspector header.
- [x] Cap inspector at pass-strip boundary with internal scroll.
- [x] High-contrast amber point markers, dark outline.
- [x] Station pictogram and distinct station label/color.
- [ ] Verify live 3D ISS rendering and responsive layout on Windows browser.

## v0.9.0 — Satellite Favorites (planned, unchanged)

- [ ] Add/remove favorites and quick focus.
- [ ] Persist NORAD IDs to browser localStorage.
- [ ] Retain entries temporarily missing from online catalog.

## v0.9.0 — Favorites & Identity (functionally accepted)

- [x] Store NORAD IDs and cached names in browser localStorage without a database.
- [x] Inspector star action, searchable Favorites popover and quick focus.
- [x] Preserve unavailable favorites until manually removed.
- [x] Graphite Glass inspector with text readability fallback.
- [x] Full-width bottom pass drawer; inspector aligns above the drawer.
- [x] Approved orbit/globe logo and SVG/PNG/ICO favicons.
- [x] TypeScript check and automated orbital/marker/favorites/shell tests.
- [ ] Validate actual interaction, scrolling and adaptive layout in Windows browsers.
- [ ] Validate production Vite build after native platform dependencies are installed.
- [ ] Merge accepted version into GitHub after user approval.

## v0.9.0 RC2 — Search & Mobile Layout (candidate)

- [x] Search relevance ranking, canonical ISS first, NORAD-based deduplication.
- [x] Consistent collapsed mobile pass drawer for SDR and PASSES.
- [x] Automated search and CSS contract tests.
- [ ] Validate collapsed/expanded drawer in browser at 390/520/768 px.
- [ ] Confirm Cesium console and production build on Windows.

## v0.9.1 — Universal Satellite Hover (accepted)

- [x] Одна read-only карточка наведения для КАРТА, SDR и ПРОЛЁТЫ.
- [x] Название, NORAD, класс орбиты, высота, скорость, режимные данные.
- [x] Поиск с приоритетом основной МКС и NORAD, дедупликация по NORAD ID.
- [x] Единая мобильная геометрия окна и карточек SDR/ПРОЛЁТЫ.
- [x] Проверено пользователем на локальном запуске; поведение карточек принято.
- [ ] Подтвердить production-сборку на Windows и сверку расчётов на свежих OMM.

## Следующие этапы (после v0.9.1)

- [ ] Финальная техническая проверка Cesium в Console после долгой работы.
- [ ] Независимая численная сверка SGP4 и AOS/TCA/LOS с эталонными данными.
- [ ] Автоматическая сборка и CI проверки в GitHub Actions.
- [ ] Определить требования к v1.0.0 без лишних функций и серверной БД.
