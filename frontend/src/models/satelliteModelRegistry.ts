import type { SatelliteModelDefinition } from "./modelTypes";

/**
 * v0.6 model registry.
 *
 * Keep asset selection out of App.tsx. Future Starlink/Hubble/generic entries
 * can be added here without changing the rendering/tracking architecture.
 */
export const SATELLITE_MODEL_DEFINITIONS: readonly SatelliteModelDefinition[] = [
  {
    key: "iss-nasa-b",
    noradIds: [25544],
    label: "ISS 3D",
    url: "/api/models/iss.glb",
    credit: "NASA / Michael D. Carbajal",

    // NASA lists the ISS as 109 m end-to-end. The source GLB is normalized at
    // load time so its world-space reference diameter is 109 m.
    physicalSpanMeters: 109,

    // A real-scale 109 m object is tiny from the old ~800 km tracking range.
    // Only model-backed targets request a closer transition; ordinary points
    // keep the existing camera behavior.
    preferredInitialRangeMeters: 4_000,

    // Keep the familiar cyan point while the real-scale model is too small to
    // read. Close to the target the point disappears and only the 3D asset is
    // rendered. Hysteresis avoids flicker around the threshold.
    pointSuppressEnterDistanceMeters: 20_000,
    pointSuppressExitDistanceMeters: 30_000,
  },
] as const;

export function getSatelliteModelDefinition(
  noradId: number
): SatelliteModelDefinition | null {
  return (
    SATELLITE_MODEL_DEFINITIONS.find((definition) =>
      definition.noradIds.includes(noradId)
    ) ?? null
  );
}

export function getPreferredModelCameraRangeMeters(
  noradId: number
): number | undefined {
  return getSatelliteModelDefinition(noradId)?.preferredInitialRangeMeters;
}
