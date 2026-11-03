<div align="center">

<img src="frontend/public/brand/logo-mark.svg" alt="SatGeoTracker orbit logo" width="98" />

# SatGeoTracker

**Explore the space above us.**

A local-first 3D satellite tracker combining orbital mechanics, ground-pass predictions, and radio data in one workspace.

<p>
  <img alt="Version 0.9.1" src="https://img.shields.io/badge/version-v0.9.1-E7B960?style=flat-square&amp;labelColor=151A20" />
  <img alt="Local-first" src="https://img.shields.io/badge/platform-local--first-647785?style=flat-square&amp;labelColor=151A20" />
  <img alt="React + CesiumJS" src="https://img.shields.io/badge/visualization-React%20%2B%20CesiumJS-647785?style=flat-square&amp;labelColor=151A20" />
  <img alt="Frontend tests: 37 passed" src="https://img.shields.io/badge/tests-37%20passing-528B75?style=flat-square&amp;labelColor=151A20" />
</p>

<img src="docs/assets/branding/showcase.svg" alt="SatGeoTracker branded orbital illustration" width="100%" />

**[Features](#features) · [Quick start](#quick-start) · [Architecture](#architecture) · [Roadmap](docs/ROADMAP.md) · [Changelog](CHANGELOG.md)**

</div>

## Overview

SatGeoTracker is an interactive Earth-orbit visualization project. It retrieves real orbital elements from **CelesTrak**, computes satellite positions with **SGP4**, and renders them on a **CesiumJS 3D globe**. The same interface also provides an observer-based pass predictor and satellite transmitter metadata from **SatNOGS**.

Designed for local use, exploration, and learning — **not a live spacecraft telemetry feed**.

## Features

| Workspace | What you can do |
| --- | --- |
| **MAP** | Explore the 3D globe, search by name or NORAD ID, filter LEO/MEO/GEO objects, inspect orbital paths, and follow satellites with the camera. |
| **SDR** | Explore SatNOGS transmitter records, filter radio-capable satellites, view downlink frequencies and estimated Doppler-corrected RX frequencies. |
| **PASSES** | Set a ground observer, calculate upcoming passes with AOS/TCA/LOS, elevation and azimuth, and focus on selected events. |

**Across all modes**

- **Universal satellite hover** — a lightweight read-only card with object name, NORAD ID, orbit class, altitude, speed, and relevant mode-specific information.
- **Favorites** — save objects by NORAD ID, search the list, and jump back to them. Stored locally in your browser; temporarily unavailable catalog entries are retained.
- **Tracking and visualization** — camera follow mode, orbital path rendering, an ISS 3D model, station markers, and an adjustable field of view.
- **Graphite Glass interface** — compact technical panels, responsive SDR/pass layouts, amber satellite markers, and custom project branding.

## Quick start

**Requirements:** Windows, Node.js/npm, Python 3, and an internet connection for initial dependency installation and current external data.

```powershell
git clone https://github.com/CactusDex/SatGeoTracker.git
cd SatGeoTracker
.\setup.cmd
.\dev.cmd
```

Open **http://127.0.0.1:5173/**. The API runs at **http://127.0.0.1:8000/**.

Use `stop-dev.cmd` to stop the local services. For detailed setup and troubleshooting, see [Development](docs/DEVELOPMENT.md).

## Architecture

```text
CelesTrak OMM ──┐
                ├── FastAPI + local cache ── React / TypeScript
SatNOGS DB ─────┘                               │
                                             SGP4
                                               │
                                    CesiumJS 3D Earth
                                               │
                            Tracking · Observer passes · SDR
```

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, Vite |
| Globe and imagery | CesiumJS |
| Propagation | satellite.js / SGP4 |
| API and caching | Python, FastAPI |
| Orbital elements | CelesTrak GP / OMM |
| Radio metadata | SatNOGS DB |
| ISS 3D asset | NASA |

The project does not require a database for the current workflow. Favorites and observer settings are browser-local; the backend caches external data.

## Development and validation

```powershell
cd frontend
npm run test:all
npm run check:cesium
```

The v0.9.1 frontend test suite has **37 passing tests**. Local interactive use has been accepted in the browser.

**Current limitations:** The production `npm run build` has encountered a `satellite.js` WASM / Vite Worker bundling incompatibility on Windows. The repository includes an ES-module Worker configuration, but a successful production build is not yet confirmed. Independent numerical checks of fresh orbital elements also remain on the roadmap. These are distinct from the working local development flow.

## Roadmap and documentation

- [Roadmap](docs/ROADMAP.md) — completed milestones and next work
- [Changelog](CHANGELOG.md) — version history
- [Architecture](docs/ARCHITECTURE.md) · [Development](docs/DEVELOPMENT.md)
- [Observer and passes](docs/OBSERVER_PASSES.md) · [3D models](docs/MODELS.md)
- [Independent numerical audit](scripts/INDEPENDENT_AUDIT.md)

## Credits

Built by **[Cactus Dex](https://github.com/CactusDex)**.

Orbital elements: [CelesTrak](https://celestrak.org/) · Radio data: [SatNOGS](https://db.satnogs.org/) · ISS 3D resources: [NASA](https://science.nasa.gov/3d-resources/).

Satellite positions and passes are calculated from published orbital elements and may vary with element age, perturbations, and observer settings. Listed transmitter records do not guarantee radio reception.

---

<div align="center"><sub>SatGeoTracker · Earth / Orbits / Signals · v0.9.1</sub></div>
