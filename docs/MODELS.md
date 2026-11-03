# Satellite 3D Models — v0.6.2

## ISS readiness hotfix

Cesium `Model.fromGltfAsync()` returns a `Model` before it has necessarily completed the scene-side processing required for `Model.ready`. The model must be inserted into the scene and allowed to advance through render frames before readiness-dependent properties such as `boundingSphere` are used.

v0.6.2 therefore loads in this order:

`fromGltfAsync -> add to scene -> wait Model.ready / readyEvent -> read boundingSphere -> normalize to 109 m -> show when selected`.

Model errors are now logged to the browser console and surfaced in the selected-object panel instead of being replaced by a generic fallback message.

Camera v0.4.1 and Earth v0.5.7 are intentionally unchanged.


## v0.8.8 — NASA GLB scene cleanup

Original NASA `isscombine` scene contains seven nonstation construction meshes
(`bendedtru*`, `pCylinder*`) at y ~= 41 in source coordinates, displaced from
the true ISS mesh. They produce a detached cluster when loaded at true scale.
`backend/app/iss_model_cleanup.py` removes **only their scene references**
while retaining all original binary vertex data. Unknown GLB layouts pass
through unchanged. Correction is applied on download and on existing cache,
while `/api/models/iss.glb?v=0.8.8` bypasses previous browser immutable cache.
All credit remains NASA / Michael D. Carbajal.
