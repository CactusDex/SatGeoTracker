# Camera System — v0.4.2

Camera v0.4.2 builds on v0.4.1 with a smooth perspective-lens FOV control while preserving the deterministic ownership state machine. v0.4.1 fixed the Earth-return transition. v0.4 replaces the experimental cursor-pivot v0.3 controller with a deterministic target-based subsystem inspired by KSP.

## Core model

```text
TARGET + HEADING + PITCH + RANGE
```

Exactly one mode owns the camera at a time:

```text
EARTH -> TRANSITION -> SATELLITE
  ^                      |
  |______________________|
      Earth click / ESC
```

## Controls

### EARTH

- Cesium native globe controls are enabled.
- LMB drag: rotate/tilt the globe.
- Wheel/right drag: Cesium distance-aware zoom.
- Ctrl + Wheel: smoothly change perspective FOV from 25° to 110°.
- Ctrl + 0: return FOV to the 60° default.
- Hover satellite: highlight only; focus never changes.
- Click satellite: enter `TRANSITION`.

### TRANSITION

- Cesium camera inputs are disabled.
- Camera uses an eased `flyToBoundingSphere` to the chosen moving object.
- Selecting a different satellite invalidates/cancels the previous transition.
- Earth click or ESC clears satellite selection immediately, then performs a short controlled `TRANSITION` back to a stable Earth-fixed view before re-enabling Cesium globe controls.

### SATELLITE

The selected object becomes the camera pivot.

- LMB drag horizontally: heading around the satellite.
- LMB drag vertically: pitch around the satellite.
- Wheel: logarithmic/multiplicative zoom relative to the satellite.
- Ctrl + Wheel: smoothly change perspective FOV from 25° to 110° without changing range.
- Ctrl + 0: return FOV to the 60° default.
- Earth click: release target, reset `lookAt` transform to `Matrix4.IDENTITY`, perform a short roll-free Earth return flight, then restore Earth navigation.
- ESC: same deterministic Earth-return path as clicking the globe.
- Click another satellite: clean target switch.

## Moving target tracking

The full satellite collection remains on the existing ~1 Hz propagation loop.

The selected satellite is different:

```text
scene.postUpdate
      ↓
current UTC Date
      ↓
SGP4(selected)
      ↓
one Cartesian3 sample
      ├─> selected PointPrimitive position
      └─> camera target
```

Both the marker and camera consume the same propagated position for that frame. This prevents the classic one-second tracking jitter where the point and camera are updated on different schedules.

React is not updated at render FPS. The selected runtime object is mutated by the tracking loop and the existing 1 Hz UI snapshot refreshes panel metrics.

## Smooth orbit and zoom

Satellite camera input writes desired values:

```text
targetHeading
targetPitch
targetRange
```

Each render frame smoothly converges the actual:

```text
heading
pitch
range
```

toward those targets with frame-rate-independent exponential smoothing.

Wheel zoom is multiplicative rather than a fixed distance step, which keeps the control usable from tens of kilometres to many thousands of kilometres.


## v0.4.2 Dynamic perspective FOV

The lens is now an independent smoothed camera parameter:

```text
heading
pitch
range
fov
```

`Ctrl + Wheel` changes only `targetFov`; every render frame exponentially smooths the current perspective frustum toward that target. The allowed range is `25°–110°`, with `60°` as the reset/default lens. A compact `FOV xx°` HUD appears while adjusting and hides automatically.

The modified wheel event is captured before Cesium's normal globe zoom handler, so Earth zoom and FOV never fire from the same input. Normal wheel input remains untouched. This is deliberately not a shader-based fisheye projection: standard Cesium perspective and screen picking remain aligned.

## v0.4.1 Earth-return hotfix

`Camera.lookAt()` changes the camera reference frame to the target-local ENU frame. Returning to normal globe navigation must therefore reset the transform with `camera.lookAtTransform(Matrix4.IDENTITY)` before Cesium's `ScreenSpaceCameraController` owns the camera again.

v0.4.1 also removes the redundant `setView()` that was re-applying the satellite-era world pose during release. Instead it:

1. invalidates/cancels the active satellite flight;
2. resets the camera transform to `Matrix4.IDENTITY`;
3. clears the selected satellite/orbit;
4. computes a stable roll-free Earth view from the current hemisphere;
5. performs a short `flyTo`;
6. reasserts the identity transform;
7. only then re-enables Cesium Earth controls.

Repeated Earth clicks while this transition is active are ignored so transition callbacks cannot stack.

## Earth collision guard

Positive HPR pitch moves the satellite camera below the local tangent plane. For LEO objects a large range could otherwise place the camera inside Earth.

v0.4 dynamically limits the positive pitch using:

```text
satellite altitude
camera range
Earth clearance
```

The closer the camera gets to the satellite, the more below-target viewing becomes available.

## Source layout

```text
frontend/src/camera/
├─ CameraManager.ts   # state machine, input, tracking, cleanup
├─ cameraConfig.ts    # tuning values
├─ cameraMath.ts      # angle/smoothing helpers
├─ cameraTypes.ts     # contracts/state
└─ index.ts
```

`frontend/src/camera.ts` remains only as a compatibility re-export. Camera physics is no longer embedded in `App.tsx`.

## Debugging

Press `F8` to toggle the development camera overlay:

```text
MODE
TARGET / NORAD
HEADING
PITCH
RANGE
FOV
CESIUM IN
CUSTOM IN
```

This makes controller ownership visible when diagnosing regressions.

## Camera invariants

1. Exactly one mode owns the camera: `EARTH | TRANSITION | SATELLITE`.
2. Hover never changes focus.
3. Clicking a satellite requests satellite focus.
4. Clicking the rendered globe returns to Earth focus.
5. ESC returns to Earth focus.
6. While tracking, the selected satellite remains the target every rendered frame.
7. The selected marker and camera use the same SGP4 sample.
8. The 1 Hz global loop never overwrites the tracked marker.
9. Cesium native inputs and satellite custom inputs are never active together.
10. Switching targets invalidates an older transition before cancelling it.
11. Camera DOM/Cesium listeners are cleaned up in `destroy()`.
12. React is not used for per-frame camera physics.
13. Ctrl+Wheel changes only perspective FOV; normal wheel behavior is preserved.
14. FOV remains within 25°–110° and can be reset to 60° with Ctrl+0.

## Acceptance checklist

- Earth navigation works after startup.
- Hovering several objects never moves the camera.
- Satellite click performs a smooth transition.
- Selected object stays centered for at least 30 seconds without 1 Hz jumps.
- LMB orbit keeps the selected object as pivot.
- Repeated wheel zoom does not drift the target.
- Ctrl+Wheel changes FOV without changing Earth zoom or satellite range.
- Ctrl+0 smoothly returns FOV to 60°.
- Earth click releases tracking immediately; Earth controls are restored only after the short Earth-return transition completes.
- A -> B satellite switching leaves only B tracked.
- Clicking a new target during an existing transition does not corrupt transforms.
- ESC always releases satellite tracking.
- Repeated Earth/satellite switching does not accumulate handlers/controllers.
- F8 shows exactly one input owner.

## Not part of Camera v0.4

- Earth imagery upgrade;
- terrain;
- city/country labels;
- Google Photorealistic 3D Tiles;
- 3D satellite models;
- time acceleration / rewind;
- ground-track rendering.


## v0.6 model-view compatibility

Camera v0.4.2 retains the v0.4.1 ownership/tracking baseline: its ownership state machine, input routing, tracking loop and Earth-return transform logic are unchanged. v0.6 adds only two model-view accommodations: `CameraTargetSample` can optionally request a preferred initial range, and the satellite minimum range is extended from 15 km to 250 m. The ISS registry requests 4 km so its real-scale mesh is visible after the transition. Ordinary satellite points retain the previous computed initial framing.
