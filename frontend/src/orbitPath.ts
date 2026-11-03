/**
 * TEME / approximate inertial coordinates -> Cesium Earth-fixed frame.
 *
 * A sampled 3D orbit is a set of satellite positions at different UTC dates,
 * but ALL positions must be transformed with the same Earth orientation.
 * Using the sample's own GMST instead yields an Earth-relative ground track,
 * which is almost stationary for GEO satellites and is not a spatial orbit.
 *
 * Inputs are in kilometres, outputs in metres (Cesium Cartesian3 units).
 * This small module has no runtime dependencies so the frame math can be
 * regression-tested independently from WebGL and satellite.js.
 */
export interface OrbitVectorKm {
  x: number;
  y: number;
  z: number;
}

export interface OrbitPointMeters {
  x: number;
  y: number;
  z: number;
}

export function temeToEarthFixedMeters(
  temePositionKm: OrbitVectorKm,
  gmstRadiansAtReference: number
): OrbitPointMeters {
  const cosGmst = Math.cos(gmstRadiansAtReference);
  const sinGmst = Math.sin(gmstRadiansAtReference);

  return {
    // TEME -> pseudo Earth-fixed rotation (matching satellite.js eciToEcf).
    x: (temePositionKm.x * cosGmst + temePositionKm.y * sinGmst) * 1000,
    y: (-temePositionKm.x * sinGmst + temePositionKm.y * cosGmst) * 1000,
    z: temePositionKm.z * 1000,
  };
}

export function sampleOrbitInEarthFixedFrame(
  dates: readonly Date[],
  gmstRadiansAtReference: number,
  temePositionAt: (date: Date) => OrbitVectorKm | null
): OrbitPointMeters[] {
  if (!Number.isFinite(gmstRadiansAtReference)) return [];

  const positions: OrbitPointMeters[] = [];
  for (const date of dates) {
    const teme = temePositionAt(date);
    if (!teme || ![teme.x, teme.y, teme.z].every(Number.isFinite)) continue;
    positions.push(temeToEarthFixedMeters(teme, gmstRadiansAtReference));
  }
  return positions;
}
