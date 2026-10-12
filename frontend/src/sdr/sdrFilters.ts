import type { SdrBand, SdrFilters, SdrTransmitter } from "./sdrTypes";
import { frequencyBand, transmitterFrequencyHz } from "./sdrMath";

export function transmitterMatchesFilters(
  tx: SdrTransmitter,
  filters: SdrFilters
): boolean {
  const frequencyHz = transmitterFrequencyHz(tx);
  if (frequencyHz === null) return false;

  if (filters.activeOnly && normalize(tx.status) !== "active") return false;
  if (filters.band !== "ALL" && frequencyBand(frequencyHz) !== filters.band) return false;
  if (filters.mode !== "ALL" && normalize(tx.mode) !== normalize(filters.mode)) return false;
  if (
    filters.service !== "ALL" &&
    normalize(tx.service) !== normalize(filters.service)
  ) {
    return false;
  }

  return true;
}

export function groupTransmittersByNorad(
  transmitters: SdrTransmitter[],
  filters?: SdrFilters
): Map<number, SdrTransmitter[]> {
  const result = new Map<number, SdrTransmitter[]>();

  for (const tx of transmitters) {
    if (filters && !transmitterMatchesFilters(tx, filters)) continue;
    const noradId = Number(tx.norad_cat_id);
    if (!Number.isFinite(noradId)) continue;
    const list = result.get(noradId);
    if (list) list.push(tx);
    else result.set(noradId, [tx]);
  }

  for (const list of result.values()) {
    list.sort((a, b) => {
      const activeDelta = activeRank(a) - activeRank(b);
      if (activeDelta !== 0) return activeDelta;
      return (transmitterFrequencyHz(a) ?? Number.POSITIVE_INFINITY) -
        (transmitterFrequencyHz(b) ?? Number.POSITIVE_INFINITY);
    });
  }

  return result;
}

export function availableModes(transmitters: SdrTransmitter[]): string[] {
  return uniqueSorted(transmitters.map((tx) => tx.mode));
}

export function availableServices(transmitters: SdrTransmitter[]): string[] {
  return uniqueSorted(transmitters.map((tx) => tx.service));
}

function activeRank(tx: SdrTransmitter): number {
  return normalize(tx.status) === "active" ? 0 : 1;
}

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))
  ).sort((a, b) => a.localeCompare(b));
}

function normalize(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}
