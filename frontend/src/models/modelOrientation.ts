import {
  Cartesian3,
  Matrix3,
  Matrix4,
  Transforms,
} from "cesium";

const EPSILON_SQUARED = 1e-6;

const motionScratch = new Cartesian3();
const upScratch = new Cartesian3();
const tangentScratch = new Cartesian3();
const projectionScratch = new Cartesian3();
const rightScratch = new Cartesian3();
const forwardScratch = new Cartesian3();
const rotationScratch = new Matrix3();

/**
 * Builds a stable orbital visual frame in Earth-fixed coordinates.
 *
 * glTF default axes are treated as:
 *   +X = right
 *   +Y = up (away from Earth)
 *   +Z = forward (along the ground-relative motion)
 *
 * This is a visual LVLH-like orientation derived from the propagated path. It
 * is deliberately NOT presented as real ISS attitude telemetry: OMM/SGP4 gives
 * us orbital state, not spacecraft body attitude.
 */
export function buildOrbitalModelMatrix(
  position: Cartesian3,
  previousPosition: Cartesian3 | null
): Matrix4 {
  if (!previousPosition) {
    return Transforms.eastNorthUpToFixedFrame(position);
  }

  Cartesian3.subtract(position, previousPosition, motionScratch);
  if (Cartesian3.magnitudeSquared(motionScratch) <= EPSILON_SQUARED) {
    return Transforms.eastNorthUpToFixedFrame(position);
  }

  Cartesian3.normalize(position, upScratch);
  Cartesian3.normalize(motionScratch, motionScratch);

  // Remove the radial component so the displayed forward axis stays tangent
  // to the local orbital plane instead of pointing slightly into/out of Earth.
  const radialComponent = Cartesian3.dot(motionScratch, upScratch);
  Cartesian3.multiplyByScalar(upScratch, radialComponent, projectionScratch);
  Cartesian3.subtract(motionScratch, projectionScratch, tangentScratch);

  if (Cartesian3.magnitudeSquared(tangentScratch) <= EPSILON_SQUARED) {
    return Transforms.eastNorthUpToFixedFrame(position);
  }

  Cartesian3.normalize(tangentScratch, forwardScratch);
  Cartesian3.cross(upScratch, forwardScratch, rightScratch);

  if (Cartesian3.magnitudeSquared(rightScratch) <= EPSILON_SQUARED) {
    return Transforms.eastNorthUpToFixedFrame(position);
  }

  Cartesian3.normalize(rightScratch, rightScratch);
  Cartesian3.cross(rightScratch, upScratch, forwardScratch);
  Cartesian3.normalize(forwardScratch, forwardScratch);

  // Cesium Matrix3 has no `fromColumns()` factory. Build the orthonormal
  // basis with the supported column API. Matrix3 is column-major, so the
  // resulting local axes are +X=right, +Y=up, +Z=forward.
  Matrix3.setColumn(rotationScratch, 0, rightScratch, rotationScratch);
  Matrix3.setColumn(rotationScratch, 1, upScratch, rotationScratch);
  Matrix3.setColumn(rotationScratch, 2, forwardScratch, rotationScratch);

  return Matrix4.fromRotationTranslation(rotationScratch, position);
}
