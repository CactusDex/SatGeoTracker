# Satellite 3D Models — v0.6.2

## ISS readiness hotfix

Cesium `Model.fromGltfAsync()` returns a `Model` before it has necessarily completed the scene-side processing required for `Model.ready`. The model must be inserted into the scene and allowed to advance through render frames before readiness-dependent properties such as `boundingSphere` are used.

v0.6.2 therefore loads in this order:

`fromGltfAsync -> add to scene -> wait Model.ready / readyEvent -> read boundingSphere -> normalize to 109 m -> show when selected`.

Model errors are now logged to the browser console and surfaced in the selected-object panel instead of being replaced by a generic fallback message.

Camera v0.4.1 and Earth v0.5.7 are intentionally unchanged.
