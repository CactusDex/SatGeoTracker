import type { SatelliteRuntime } from "../types";
import { computeLookAngles } from "../observer";
import type { ObserverLocation } from "../observer";
import type { DopplerResult, SdrBand, SdrTransmitter } from "./sdrTypes";

const SPEED_OF_LIGHT_MPS = 299_792_458;

export function transmitterFrequencyHz(tx: SdrTransmitter): number | null {
  const low = finiteNumber(tx.downlink_low);
  const high = finiteNumber(tx.downlink_high);

  if (low !== null && high !== null) return (low + high) / 2;
  return low ?? high;
}

export function frequencyBand(frequencyHz: number | null): Exclude<SdrBand, "ALL"> | "OTHER" {
  if (frequencyHz === null) return "OTHER";
  if (frequencyHz >= 30e6 && frequencyHz < 300e6) return "VHF";
  if (frequencyHz >= 300e6 && frequencyHz < 1e9) return "UHF";
  if (frequencyHz >= 1e9 && frequencyHz < 2e9) return "L";
  if (frequencyHz >= 2e9 && frequencyHz < 4e9) return "S";
  if (frequencyHz >= 8e9 && frequencyHz < 12e9) return "X";
  return "OTHER";
}

export function formatFrequency(frequencyHz: number | null): string {
  if (frequencyHz === null || !Number.isFinite(frequencyHz)) return "—";
  if (frequencyHz >= 1e9) return `${(frequencyHz / 1e9).toFixed(6).replace(/0+$/, "").replace(/\.$/, "")} GHz`;
  if (frequencyHz >= 1e6) return `${(frequencyHz / 1e6).toFixed(6).replace(/0+$/, "").replace(/\.$/, "")} MHz`;
  if (frequencyHz >= 1e3) return `${(frequencyHz / 1e3).toFixed(3).replace(/0+$/, "").replace(/\.$/, "")} kHz`;
  return `${frequencyHz.toFixed(0)} Hz`;
}

export function computeDoppler(
  sat: SatelliteRuntime,
  observer: ObserverLocation,
  date: Date,
  carrierHz: number
): DopplerResult | null {
  if (!Number.isFinite(carrierHz) || carrierHz <= 0) return null;

  const halfWindowMs = 500;
  const before = computeLookAngles(sat, observer, new Date(date.getTime() - halfWindowMs));
  const after = computeLookAngles(sat, observer, new Date(date.getTime() + halfWindowMs));
  if (!before || !after) return null;

  const radialVelocityMps = (after.rangeKm - before.rangeKm) * 1000;
  const shiftHz = -(carrierHz * radialVelocityMps) / SPEED_OF_LIGHT_MPS;

  return {
    carrierHz,
    radialVelocityMps,
    shiftHz,
    receiveHz: carrierHz + shiftHz,
  };
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
