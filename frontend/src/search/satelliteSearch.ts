import type { SatelliteRuntime } from "../types";

/** Stable, predictable ordering without merging distinct NORAD objects. */
type SearchSatellite = Pick<SatelliteRuntime, "noradId" | "name" | "internationalId">;

const nameComparator = new Intl.Collator("ru", { numeric: true, sensitivity: "base" });

function normalizeName(value: string): string {
  // Treat punctuation/parentheses as separators: "ISS (ZARYA)" matches "iss z".
  return value.toLocaleUpperCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function relevance(sat: SearchSatellite, query: string, numeric: boolean): number {
  const norad = String(sat.noradId);
  const name = normalizeName(sat.name);
  const internationalId = normalizeName(sat.internationalId ?? "");

  if (numeric && norad === query) return 0;
  // NORAD 25544 is the main ISS orbital object; other ISS modules retain their own IDs.
  if (query === "ISS" && sat.noradId === 25544) return 1;
  if (name === query) return 2;
  if (numeric && norad.startsWith(query)) return 3;
  if (name.startsWith(query)) return 4;
  if (name.split(" ").some((word) => word.startsWith(query))) return 5;
  if (internationalId === query || internationalId.startsWith(query)) return 6;
  if (name.includes(query)) return 7;
  if (internationalId.includes(query)) return 8;
  if (numeric && norad.includes(query)) return 9;
  return Number.POSITIVE_INFINITY;
}

export function searchSatellites<T extends SearchSatellite>(
  satellites: readonly T[],
  input: string,
  isAllowed: (satellite: T) => boolean = () => true,
  limit = 8
): T[] {
  const query = normalizeName(input);
  if (!query || limit <= 0) return [];
  const numeric = /^\d+$/.test(query);
  const unique = new Map<number, { satellite: T; score: number }>();

  for (const satellite of satellites) {
    if (!isAllowed(satellite)) continue;
    const score = relevance(satellite, query, numeric);
    if (!Number.isFinite(score)) continue;
    const prev = unique.get(satellite.noradId);
    if (!prev || score < prev.score) {
      unique.set(satellite.noradId, { satellite, score });
    }
  }

  return [...unique.values()]
    .sort((a, b) =>
      a.score - b.score ||
      nameComparator.compare(a.satellite.name, b.satellite.name) ||
      a.satellite.noradId - b.satellite.noradId
    )
    .slice(0, limit)
    .map((item) => item.satellite);
}
