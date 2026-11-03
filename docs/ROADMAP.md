# SatGeoTracker — Roadmap

Current local-first version: **v0.9.1**. This page tracks active work, not every historical design iteration. For earlier milestones, see [Roadmap history](ROADMAP_HISTORY.md) and the [Changelog](../CHANGELOG.md).

## Shipped

| Version | Milestone |
| --- | --- |
| v0.4–v0.5 | Camera tracking, 3D Earth imagery and visual refinements |
| v0.6 | Selected satellite 3D model (ISS) |
| v0.7 | Observer coordinates, AOS/TCA/LOS prediction, pass strip |
| v0.8 | SDR transmitter metadata, workspace modes, Russian interface, camera FOV |
| v0.8.6–v0.8.8 | Orbital-path fixes, Cesium Workers, marker and ISS model polish |
| v0.9.0 | Favorites, branded UI, Graphite Glass and adaptive pass layout |
| v0.9.1 | Universal hover card in MAP, SDR and PASSES; search/mobile fixes carried forward |

## Next — reliability and verification

- [ ] Verify production Vite build on Windows with the current `satellite.js` WASM / Worker dependency. ES-module worker output is configured, but a successful build is not yet confirmed.
- [ ] Compare independent SGP4 results for fresh LEO / MEO / GEO OMM data against trusted reference implementations.
- [ ] Verify AOS/TCA/LOS prediction numerically for representative observer locations and elevation masks.
- [ ] Review browser console errors for Cesium Workers and measure render performance with the full ACTIVE catalog.
- [ ] Capture up-to-date v0.9.1 screenshots for this repository.

## Later — exploratory features

- [ ] Satellite ground-track visualization and past/future orbit styling.
- [ ] Optional time controls for satellite position previews.
- [ ] Broader spacecraft model registry where appropriate assets exist.
- [ ] Profile main-thread propagation cost and evaluate moving bulk SGP4 updates into Workers.
- [ ] Optional SDR hardware integration only if a reliable, useful workflow is defined.

## Scope decisions

- **No database or authentication is required** for the local MVP. Favorites use `localStorage`, orbital elements and radio data come from external sources with local caching.
- Prioritize data correctness, performance, and clear technical UI before expanding functionality.
- This roadmap is directional; exploratory features are not committed release dates.
