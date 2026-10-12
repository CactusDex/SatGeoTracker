import type { Cartesian3 } from "cesium";

export type CameraMode = "EARTH" | "TRANSITION" | "SATELLITE";

export interface CameraTargetSample {
  position: Cartesian3;
  altitudeMeters: number;
  label?: string;

  /** Optional closer framing for a real-scale 3D model target. */
  preferredInitialRangeMeters?: number;
}

export interface CameraOrbitState {
  heading: number;
  pitch: number;
  range: number;
  targetHeading: number;
  targetPitch: number;
  targetRange: number;
}

export interface CameraManagerOptions {
  /**
   * Re-propagate the selected satellite for the supplied UTC time and return
   * exactly the position that was also written to its PointPrimitive.
   */
  updateTarget: (
    noradId: number,
    date: Date
  ) => CameraTargetSample | null;

  /** Called when a satellite point was clicked on the Cesium canvas. */
  onSatelliteClick: (noradId: number) => void;

  /** Called after the camera has returned to Earth mode. */
  onEarthFocus: () => void;

  /** Hover never changes focus. It is UI-only. */
  onHoverSatellite?: (noradId: number | null) => void;
}

export interface CameraDebugState {
  mode: CameraMode;
  targetId: number | null;
  targetLabel: string | null;
  headingDeg: number;
  pitchDeg: number;
  rangeKm: number;
  fovDeg: number;
  cesiumInputs: boolean;
  customInputs: boolean;
}
