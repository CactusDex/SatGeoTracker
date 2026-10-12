# SatGeoTracker architecture — v0.4

## Runtime data flow

```text
CelesTrak GP / OMM JSON
          ↓
       FastAPI
          ↓
 shared 2-hour disk cache
          ↓
    GET /api/satellites
          ↓
 Vite development proxy
          ↓
 React + satellite.js
          ↓
 OMM -> SatRec -> SGP4
          ↓
 ECI position / velocity
          ↓
 geodetic conversion
          ↓
 Cesium Cartesian3
          ↓
 PointPrimitiveCollection
```

## Camera data flow

```text
all satellites                    selected satellite
     |                                   |
  ~1 Hz SGP4                      render-frame SGP4
     |                                   |
PointPrimitive                     one shared sample
                                         |
                               +---------+---------+
                               |                   |
                       selected PointPrimitive  CameraManager
                                                   |
                                      target + heading + pitch + range
```

The selected object is intentionally removed from the slow point-update ownership while it is tracked. This prevents two loops from writing different target positions.

## Camera ownership

```text
EARTH
  Cesium native ScreenSpaceCameraController owns camera input

TRANSITION
  camera input disabled; Cesium flight owns camera

SATELLITE
  Cesium native input disabled; CameraManager owns camera
```

No two camera controllers are allowed to mutate the camera simultaneously.

## Responsibilities

### CelesTrak

Provides orbital elements, not a real-time geographic-coordinate stream.

### FastAPI

- upstream fetch;
- shared cache;
- legacy-cache migration;
- stale-cache fallback;
- future OMM + SATCAT enrichment;
- future DB synchronization.

### satellite.js

- OMM parsing;
- SGP4 propagation;
- position and velocity at supplied UTC timestamps;
- coordinate-system conversions.

### CesiumJS

- globe;
- primitive rendering/picking;
- orbit polyline;
- camera rendering and native Earth navigation.

### CameraManager

- `EARTH | TRANSITION | SATELLITE` state machine;
- satellite target ownership;
- custom satellite orbit input;
- per-frame selected-object propagation callback;
- smooth range/angle interpolation;
- cleanup/debug state.

## Cache location

Windows:

```text
%LOCALAPPDATA%\SatGeoTracker\cache\celestrak-active.json
```

Fallback:

```text
~/.cache/satgeotracker/celestrak-active.json
```

A legacy `backend/.cache/celestrak-active.json` is migrated automatically when available.

## Performance direction

Bulk SGP4 still runs on the main browser thread in the current MVP. Next performance milestone:

```text
React/UI thread
     ↕ messages
Web Worker
     ↓
SGP4 for all active satellites
```

The selected object remains cheap enough to propagate every rendered frame independently.

## Observer / pass subsystem v0.7.0

```text
Browser geolocation or manual coordinates
                 │
                 ▼
        ObserverLocation (local only)
                 │
        ┌────────┴────────┐
        │                 │
        ▼                 ▼
selected satellite     pass worker
1 Hz/UI sample         ACTIVE OMM catalog
        │                 │
        ▼                 ▼
 az/el/range          AOS/TCA/LOS
        │                 │
        └────────┬────────┘
                 ▼
          observer UI / pass strip
```

The pass worker rebuilds `SatRec` values from OMM inside the worker so expensive next-hour scanning stays off the render thread. The existing global point collection and selected-target camera path are unchanged.
