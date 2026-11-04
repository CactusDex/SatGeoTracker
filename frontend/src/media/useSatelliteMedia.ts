import { useEffect, useState } from "react";

export interface SatelliteMedia {
  norad_id: number;
  image_url: string | null;
  source_url: string | null;
  credit: string | null;
  source: string;
}

const sessionCache = new Map<number, SatelliteMedia>();
const MAX_SESSION_CACHE = 128;

function validMedia(value: unknown, noradId: number): SatelliteMedia | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Partial<SatelliteMedia>;
  if (data.norad_id !== noradId) return null;
  if (typeof data.image_url !== "string" || typeof data.source_url !== "string") return null;
  try {
    const image = new URL(data.image_url);
    const source = new URL(data.source_url);
    const allowed = ["db.satnogs.org", "db-satnogs.freetls.fastly.net"];
    if (image.protocol !== "https:" || !allowed.includes(image.hostname)) return null;
    if (source.protocol !== "https:" || source.hostname !== "db.satnogs.org") return null;
  } catch {
    return null;
  }
  return {
    norad_id: noradId,
    image_url: data.image_url,
    source_url: data.source_url,
    credit: typeof data.credit === "string" ? data.credit : "SatNOGS DB",
    source: typeof data.source === "string" ? data.source : "satnogs-db",
  };
}

/** Fetches media only when an inspector is visible and a satellite is selected. */
export function useSatelliteMedia(noradId: number | null): SatelliteMedia | null {
  const [media, setMedia] = useState<SatelliteMedia | null>(null);

  useEffect(() => {
    if (!noradId || !Number.isInteger(noradId) || noradId < 1) {
      setMedia(null);
      return;
    }
    let active = true;
    setMedia(sessionCache.get(noradId) ?? null);
    if (sessionCache.has(noradId)) return () => { active = false; };

    const controller = new AbortController();
    void fetch(`/api/satellites/${noradId}/media`, { signal: controller.signal })
      .then((res) => res.ok ? res.json() : null)
      .then((raw: unknown) => {
        if (!active) return;
        const result = validMedia(raw, noradId);
        if (result) {
          sessionCache.set(noradId, result);
          if (sessionCache.size > MAX_SESSION_CACHE) {
            const first = sessionCache.keys().next().value;
            if (first !== undefined) sessionCache.delete(first);
          }
        }
        setMedia(result);
      })
      .catch(() => { if (active) setMedia(null); });

    return () => {
      active = false;
      controller.abort();
    };
  }, [noradId]);

  return media;
}
