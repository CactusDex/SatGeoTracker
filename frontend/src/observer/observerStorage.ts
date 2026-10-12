import type { ObserverLocation } from "./observerTypes";

const STORAGE_KEY = "satgeotracker.observer.v1";
const MIN_ELEVATION_KEY = "satgeotracker.observer.minElevation.v1";

export function loadObserver(): ObserverLocation | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<ObserverLocation>;
    const latitudeDeg = Number(parsed.latitudeDeg);
    const longitudeDeg = Number(parsed.longitudeDeg);
    const altitudeM = Number(parsed.altitudeM ?? 0);

    if (
      !Number.isFinite(latitudeDeg) ||
      latitudeDeg < -90 ||
      latitudeDeg > 90 ||
      !Number.isFinite(longitudeDeg) ||
      longitudeDeg < -180 ||
      longitudeDeg > 180 ||
      !Number.isFinite(altitudeM)
    ) {
      return null;
    }

    return {
      latitudeDeg,
      longitudeDeg,
      altitudeM,
      source: "saved",
      accuracyM:
        typeof parsed.accuracyM === "number" ? parsed.accuracyM : undefined,
    };
  } catch {
    return null;
  }
}

export function saveObserver(observer: ObserverLocation): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(observer));
  } catch {
    // Local storage can be disabled by browser/privacy policy. Observer mode
    // remains usable for the current session in that case.
  }
}

export function clearSavedObserver(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore browser storage policy failures.
  }
}

export function loadMinimumElevation(defaultValue = 10): number {
  try {
    const raw = window.localStorage.getItem(MIN_ELEVATION_KEY);
    if (raw === null) return defaultValue;

    const value = Number(raw);
    if (Number.isFinite(value) && value >= 0 && value <= 90) return value;
  } catch {
    // Ignore browser storage policy failures.
  }

  return defaultValue;
}

export function saveMinimumElevation(value: number): void {
  try {
    window.localStorage.setItem(MIN_ELEVATION_KEY, String(value));
  } catch {
    // Ignore browser storage policy failures.
  }
}
