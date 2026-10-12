import { Math as CesiumMath } from "cesium";

/**
 * Camera v0.4.2 tuning lives here so feel can be adjusted without touching the
 * state machine or React integration.
 */
export const CAMERA_CONFIG = {
  earth: {
    inertiaSpin: 0.88,
    inertiaZoom: 0.84,
    zoomFactor: 3.0,
    maximumMovementRatio: 0.08,
    minimumZoomDistance: 120,
    maximumZoomDistance: 90_000_000,

    // Leaving satellite tracking is a real camera transition, not just a
    // transform reset. This prevents the default globe controller from
    // inheriting a satellite-local pose that feels "broken".
    returnTransitionSeconds: 0.65,
    minimumReturnAltitude: 1_200_000,
    maximumReturnAltitude: 30_000_000,
  },

  lens: {
    // Perspective FOV is intentionally kept within a wide but non-fisheye
    // range so Cesium picking and the normal perspective projection remain
    // accurate. Ctrl+Wheel adjusts targetFov; render-frame smoothing applies it.
    defaultFov: CesiumMath.toRadians(60),
    minFov: CesiumMath.toRadians(25),
    maxFov: CesiumMath.toRadians(110),
    wheelDegreesPerPixel: 0.04,
    smoothingRate: 14,
    hudHideDelayMs: 900,
  },

  satellite: {
    transitionSeconds: 0.85,

    initialPitch: CesiumMath.toRadians(-25),
    minPitch: CesiumMath.toRadians(-88),
    hardMaxPitch: CesiumMath.toRadians(85),

    // v0.6: real-scale spacecraft models need true close approach. The camera
    // state machine is unchanged; only the lower zoom bound is extended.
    minRange: 250,
    maxRange: 40_000_000,

    // Mouse pixels -> target angles.
    headingSensitivity: 0.0042,
    pitchSensitivity: 0.0036,

    // Native wheel delta -> multiplicative/logarithmic target range.
    wheelExponent: 0.00135,

    // Frame-rate independent exponential response rates.
    angularSmoothingRate: 18,
    rangeSmoothingRate: 10,

    // Prevent the camera from being driven through the Earth when looking
    // "below" the satellite's local tangent plane.
    earthClearanceMeters: 50_000,
  },

  interaction: {
    clickMoveThresholdPx: 5,
  },
} as const;
