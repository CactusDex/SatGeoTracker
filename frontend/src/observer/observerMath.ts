import * as satellite from "satellite.js";

import type { SatelliteRuntime } from "../types";
import type { LookAngles, ObserverLocation } from "./observerTypes";

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

export function computeLookAngles(
  sat: SatelliteRuntime,
  observer: ObserverLocation,
  date: Date
): LookAngles | null {
  const pv = satellite.propagate(sat.satrec, date);
  if (!pv?.position) return null;

  const gmst = satellite.gstime(date);
  const ecf = satellite.eciToEcf(pv.position, gmst);
  const observerGd = {
    longitude: observer.longitudeDeg * DEG2RAD,
    latitude: observer.latitudeDeg * DEG2RAD,
    height: observer.altitudeM / 1000,
  };
  const look = satellite.ecfToLookAngles(observerGd, ecf);

  return {
    azimuthDeg: normalizeDegrees(look.azimuth * RAD2DEG),
    elevationDeg: look.elevation * RAD2DEG,
    rangeKm: look.rangeSat,
  };
}

export function normalizeDegrees(value: number): number {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

export function cardinalDirection(azimuthDeg: number): string {
  const directions = ["С", "СВ", "В", "ЮВ", "Ю", "ЮЗ", "З", "СЗ"];
  const index = Math.round(normalizeDegrees(azimuthDeg) / 45) % directions.length;
  return directions[index];
}
