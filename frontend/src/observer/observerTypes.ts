import type { OmmRecord } from "../types";

export type ObserverSource = "browser" | "manual" | "saved";

export interface ObserverLocation {
  latitudeDeg: number;
  longitudeDeg: number;
  altitudeM: number;
  source: ObserverSource;
  accuracyM?: number;
}

export interface LookAngles {
  azimuthDeg: number;
  elevationDeg: number;
  rangeKm: number;
}

export interface SatellitePass {
  noradId: number;
  name: string;
  internationalId: string;
  aosMs: number;
  tcaMs: number;
  losMs: number;
  maxElevationDeg: number;
  azimuthAtTcaDeg: number;
  startsBeforeWindow: boolean;
  endsAfterWindow: boolean;
}

export interface PassPredictionRequest {
  type: "predict";
  requestId: number;
  records: OmmRecord[];
  observer: ObserverLocation;
  startMs: number;
  horizonMinutes: number;
  minElevationDeg: number;
}

export interface PassPredictionResult {
  type: "result";
  requestId: number;
  passes: SatellitePass[];
  elapsedMs: number;
}

export interface PassPredictionFailure {
  type: "error";
  requestId: number;
  message: string;
}

export type PassPredictionResponse =
  | PassPredictionResult
  | PassPredictionFailure;
