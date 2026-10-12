import type { SatRec } from "satellite.js";

export interface OmmRecord {
  OBJECT_NAME: string;
  OBJECT_ID?: string;
  EPOCH: string;
  MEAN_MOTION: number | string;
  ECCENTRICITY: number | string;
  INCLINATION: number | string;
  RA_OF_ASC_NODE: number | string;
  ARG_OF_PERICENTER: number | string;
  MEAN_ANOMALY: number | string;
  EPHEMERIS_TYPE?: number | string;
  CLASSIFICATION_TYPE?: string;
  NORAD_CAT_ID: number | string;
  ELEMENT_SET_NO?: number | string;
  REV_AT_EPOCH?: number | string;
  BSTAR?: number | string;
  MEAN_MOTION_DOT?: number | string;
  MEAN_MOTION_DDOT?: number | string;
}

export type OrbitType = "LEO" | "MEO" | "GEO" | "OTHER";

export interface SatelliteRuntime {
  omm: OmmRecord;
  satrec: SatRec;
  noradId: number;
  name: string;
  internationalId: string;

  latitudeDeg: number;
  longitudeDeg: number;
  altitudeKm: number;
  speedKmS: number;
  orbitType: OrbitType;
}
