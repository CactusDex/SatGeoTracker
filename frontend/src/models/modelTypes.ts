export type SatelliteModelLoadState = "LOADING" | "READY" | "ERROR";

export interface SatelliteModelDefinition {
  key: string;
  noradIds: readonly number[];
  label: string;
  url: string;
  credit: string;
  physicalSpanMeters: number;
  preferredInitialRangeMeters: number;
  pointSuppressEnterDistanceMeters: number;
  pointSuppressExitDistanceMeters: number;
}

export interface SatelliteModelStatus {
  noradId: number;
  label: string;
  state: SatelliteModelLoadState;
  physicalSpanMeters: number;
  credit: string;
  message?: string;
}

export interface SatelliteModelManagerOptions {
  onStatusChange?: (status: SatelliteModelStatus | null) => void;
}
