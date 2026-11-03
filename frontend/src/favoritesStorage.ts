/**
 * Favorites are per-browser preferences, not orbital data.
 * Only NORAD IDs and display labels are persisted. A missing satellite remains
 * in the list until the user explicitly removes it.
 */
export const FAVORITES_STORAGE_KEY = "sgt:favorites:v1";
export const MAX_FAVORITES = 250;

export interface FavoriteSatellite {
  noradId: number;
  name: string;
}

export function sanitizeFavorites(value: unknown): FavoriteSatellite[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<number>();
  const entries: FavoriteSatellite[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const noradId = record.noradId;
    if (
      typeof noradId !== "number" ||
      !Number.isSafeInteger(noradId) ||
      noradId <= 0 ||
      noradId > 999_999_999 ||
      seen.has(noradId)
    ) continue;
    seen.add(noradId);
    entries.push({
      noradId,
      name:
        typeof record.name === "string" && record.name.trim()
          ? record.name.trim().slice(0, 120)
          : `NORAD ${noradId}`,
    });
    if (entries.length >= MAX_FAVORITES) break;
  }
  return entries;
}

export function parseFavorites(raw: string | null): FavoriteSatellite[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return sanitizeFavorites(parsed);
  } catch {
    return [];
  }
}

export function addFavorite(
  items: readonly FavoriteSatellite[],
  favorite: FavoriteSatellite
): FavoriteSatellite[] {
  if (items.some((item) => item.noradId === favorite.noradId)) return [...items];
  return sanitizeFavorites([...items, favorite]);
}

export function removeFavorite(items: readonly FavoriteSatellite[], noradId: number): FavoriteSatellite[] {
  return items.filter((item) => item.noradId !== noradId);
}
