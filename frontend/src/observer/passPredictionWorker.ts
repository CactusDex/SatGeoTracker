import * as satellite from "satellite.js";

import type { OmmRecord } from "../types";
import type {
  ObserverLocation,
  PassPredictionRequest,
  PassPredictionResponse,
  SatellitePass,
} from "./observerTypes";

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const SAMPLE_STEP_MS = 60_000;
const CROSSING_ITERATIONS = 10;
const PEAK_ITERATIONS = 10;

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<PassPredictionRequest>) => void) | null;
  postMessage: (message: PassPredictionResponse) => void;
};

workerScope.onmessage = (event) => {
  const request = event.data;
  if (!request || request.type !== "predict") return;

  const startedAt = performance.now();

  try {
    const passes: SatellitePass[] = [];
    const endMs = request.startMs + request.horizonMinutes * 60_000;

    for (const record of request.records) {
      const predicted = predictRecordPasses(
        record,
        request.observer,
        request.startMs,
        endMs,
        request.minElevationDeg
      );
      passes.push(...predicted);
    }

    passes.sort((a, b) => {
      const aActive = a.startsBeforeWindow ? 0 : 1;
      const bActive = b.startsBeforeWindow ? 0 : 1;
      return (
        aActive - bActive ||
        a.aosMs - b.aosMs ||
        b.maxElevationDeg - a.maxElevationDeg
      );
    });

    workerScope.postMessage({
      type: "result",
      requestId: request.requestId,
      passes,
      elapsedMs: performance.now() - startedAt,
    });
  } catch (cause) {
    workerScope.postMessage({
      type: "error",
      requestId: request.requestId,
      message: formatError(cause),
    });
  }
};

function predictRecordPasses(
  record: OmmRecord,
  observer: ObserverLocation,
  startMs: number,
  endMs: number,
  minElevationDeg: number
): SatellitePass[] {
  let satrec: ReturnType<typeof satellite.json2satrec>;

  try {
    satrec = satellite.json2satrec(record as never);
  } catch {
    return [];
  }

  const observerGd = {
    longitude: observer.longitudeDeg * DEG2RAD,
    latitude: observer.latitudeDeg * DEG2RAD,
    height: observer.altitudeM / 1000,
  };

  const elevationAt = (timeMs: number): number | null => {
    const pv = satellite.propagate(satrec, new Date(timeMs));
    if (!pv?.position) return null;

    const gmst = satellite.gstime(new Date(timeMs));
    const ecf = satellite.eciToEcf(pv.position, gmst);
    const look = satellite.ecfToLookAngles(observerGd, ecf);
    const elevation = look.elevation * RAD2DEG;
    return Number.isFinite(elevation) ? elevation : null;
  };

  const azimuthAt = (timeMs: number): number => {
    const pv = satellite.propagate(satrec, new Date(timeMs));
    if (!pv?.position) return 0;

    const gmst = satellite.gstime(new Date(timeMs));
    const ecf = satellite.eciToEcf(pv.position, gmst);
    const look = satellite.ecfToLookAngles(observerGd, ecf);
    const degrees = look.azimuth * RAD2DEG;
    const normalized = degrees % 360;
    return normalized < 0 ? normalized + 360 : normalized;
  };

  const results: SatellitePass[] = [];
  let previousTime = startMs;
  let previousElevation = elevationAt(previousTime);
  if (previousElevation === null) return results;

  let inside = previousElevation >= minElevationDeg;
  let currentAosMs: number | null = inside ? startMs : null;
  let startsBeforeWindow = inside;
  let enteredDuringWindow = false;

  for (
    let currentTime = Math.min(startMs + SAMPLE_STEP_MS, endMs);
    currentTime <= endMs;
    currentTime = Math.min(currentTime + SAMPLE_STEP_MS, endMs)
  ) {
    const currentElevation = elevationAt(currentTime);

    if (currentElevation !== null) {
      if (!inside && previousElevation < minElevationDeg && currentElevation >= minElevationDeg) {
        currentAosMs = refineCrossing(
          previousTime,
          currentTime,
          minElevationDeg,
          true,
          elevationAt
        );
        inside = true;
        startsBeforeWindow = false;
        enteredDuringWindow = true;
      }

      if (inside && previousElevation >= minElevationDeg && currentElevation < minElevationDeg) {
        const losMs = refineCrossing(
          previousTime,
          currentTime,
          minElevationDeg,
          false,
          elevationAt
        );

        if (currentAosMs !== null) {
          results.push(
            buildPass(
              record,
              currentAosMs,
              losMs,
              startsBeforeWindow,
              false,
              elevationAt,
              azimuthAt
            )
          );
        }

        inside = false;
        currentAosMs = null;
        startsBeforeWindow = false;
      }

      previousElevation = currentElevation;
    }

    previousTime = currentTime;
    if (currentTime === endMs) break;
  }

  if (inside && currentAosMs !== null) {
    // A GEO-like object that stays above the threshold for the complete window
    // is not a "pass in the next hour". Keep current/partial or newly acquired
    // passes, but omit continuous visibility that would swamp the pass list.
    if (!(startsBeforeWindow && !enteredDuringWindow)) {
      results.push(
        buildPass(
          record,
          currentAosMs,
          endMs,
          startsBeforeWindow,
          true,
          elevationAt,
          azimuthAt
        )
      );
    }
  }

  return results;
}

function refineCrossing(
  lowMs: number,
  highMs: number,
  thresholdDeg: number,
  rising: boolean,
  elevationAt: (timeMs: number) => number | null
): number {
  let low = lowMs;
  let high = highMs;

  for (let index = 0; index < CROSSING_ITERATIONS; index += 1) {
    const mid = (low + high) / 2;
    const elevation = elevationAt(mid);
    if (elevation === null) break;

    const above = elevation >= thresholdDeg;
    if (rising ? above : !above) {
      high = mid;
    } else {
      low = mid;
    }
  }

  return Math.round((low + high) / 2);
}

function buildPass(
  record: OmmRecord,
  aosMs: number,
  losMs: number,
  startsBeforeWindow: boolean,
  endsAfterWindow: boolean,
  elevationAt: (timeMs: number) => number | null,
  azimuthAt: (timeMs: number) => number
): SatellitePass {
  const tcaMs = refinePeak(aosMs, losMs, elevationAt);
  const maxElevationDeg = elevationAt(tcaMs) ?? 0;

  return {
    noradId: Number(record.NORAD_CAT_ID),
    name: record.OBJECT_NAME || `NORAD ${record.NORAD_CAT_ID}`,
    internationalId: record.OBJECT_ID || "—",
    aosMs,
    tcaMs,
    losMs,
    maxElevationDeg,
    azimuthAtTcaDeg: azimuthAt(tcaMs),
    startsBeforeWindow,
    endsAfterWindow,
  };
}

function refinePeak(
  startMs: number,
  endMs: number,
  elevationAt: (timeMs: number) => number | null
): number {
  if (endMs <= startMs) return startMs;

  let low = startMs;
  let high = endMs;

  for (let index = 0; index < PEAK_ITERATIONS; index += 1) {
    const third = (high - low) / 3;
    const m1 = low + third;
    const m2 = high - third;
    const e1 = elevationAt(m1) ?? -90;
    const e2 = elevationAt(m2) ?? -90;

    if (e1 < e2) {
      low = m1;
    } else {
      high = m2;
    }
  }

  return Math.round((low + high) / 2);
}

function formatError(cause: unknown): string {
  if (cause instanceof Error) return `${cause.name}: ${cause.message}`;
  if (typeof cause === "string") return cause;
  try {
    return JSON.stringify(cause);
  } catch {
    return "Не удалось рассчитать пролёты";
  }
}
