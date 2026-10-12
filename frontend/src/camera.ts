/**
 * Compatibility entry point retained from camera v0.3.
 * Runtime implementation now lives in ./camera/ as a dedicated subsystem.
 */
export { CameraManager, CAMERA_CONFIG } from "./camera/index";
export type {
  CameraDebugState,
  CameraManagerOptions,
  CameraMode,
  CameraOrbitState,
  CameraTargetSample,
} from "./camera/index";
