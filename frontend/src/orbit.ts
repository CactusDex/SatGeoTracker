import * as satellite from "satellite.js";
import type { OmmRecord, OrbitType, SatelliteRuntime } from "./types";

const RAD2DEG = 180 / Math.PI;

export function makeRuntimeSatellite(omm: OmmRecord): SatelliteRuntime | null {
  try {
    const satrec = satellite.json2satrec(omm as never);

    return {
      omm,
      satrec,
      noradId: Number(omm.NORAD_CAT_ID),
      name: omm.OBJECT_NAME || `NORAD ${omm.NORAD_CAT_ID}`,
      internationalId: omm.OBJECT_ID || "—",
      latitudeDeg: 0,
      longitudeDeg: 0,
      altitudeKm: 0,
      speedKmS: 0,
      orbitType: classifyOrbit(Number(omm.MEAN_MOTION), 0),
    };
  } catch {
    return null;
  }
}

export function updateSatellite(
  sat: SatelliteRuntime,
  date: Date
): SatelliteRuntime | null {
  const pv = satellite.propagate(sat.satrec, date);

  if (!pv) {
    return null;
  }

  const gmst = satellite.gstime(date);
  const geodetic = satellite.eciToGeodetic(pv.position, gmst);

  const speedKmS = Math.sqrt(
    pv.velocity.x * pv.velocity.x +
      pv.velocity.y * pv.velocity.y +
      pv.velocity.z * pv.velocity.z
  );

  const altitudeKm = geodetic.height;

  sat.latitudeDeg = geodetic.latitude * RAD2DEG;
  sat.longitudeDeg = geodetic.longitude * RAD2DEG;
  sat.altitudeKm = altitudeKm;
  sat.speedKmS = speedKmS;
  sat.orbitType = classifyOrbit(Number(sat.omm.MEAN_MOTION), altitudeKm);

  return sat;
}

export function classifyOrbit(
  meanMotionRevPerDay: number,
  altitudeKm: number
): OrbitType {
  // Для MVP используем практическую классификацию по текущей высоте,
  // а GEO дополнительно распознаём по периоду ~ sidereal day.
  const periodMinutes =
    meanMotionRevPerDay > 0 ? 1440 / meanMotionRevPerDay : 0;

  if (
    altitudeKm >= 34000 &&
    altitudeKm <= 38000 &&
    periodMinutes >= 1300 &&
    periodMinutes <= 1500
  ) {
    return "GEO";
  }

  if (altitudeKm > 0 && altitudeKm < 2000) {
    return "LEO";
  }

  if (altitudeKm >= 2000 && altitudeKm < 34000) {
    return "MEO";
  }

  return "OTHER";
}

export function orbitSampleDates(
  sat: SatelliteRuntime,
  center: Date,
  samples = 180
): Date[] {
  const meanMotion = Number(sat.omm.MEAN_MOTION);
  const periodMinutes =
    Number.isFinite(meanMotion) && meanMotion > 0 ? 1440 / meanMotion : 90;

  const cappedPeriodMinutes = Math.min(Math.max(periodMinutes, 60), 1440);
  const halfPeriodMs = (cappedPeriodMinutes * 60_000) / 2;

  const start = center.getTime() - halfPeriodMs;
  const end = center.getTime() + halfPeriodMs;
  const step = (end - start) / (samples - 1);

  return Array.from(
    { length: samples },
    (_, index) => new Date(start + index * step)
  );
}
