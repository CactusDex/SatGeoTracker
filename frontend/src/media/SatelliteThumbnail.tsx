import { useState } from "react";
import type { SatelliteMedia } from "./useSatelliteMedia";

export function SatelliteThumbnail({ media, name }: { media: SatelliteMedia | null; name: string }) {
  const [failed, setFailed] = useState(false);
  if (!media?.image_url || !media.source_url || failed) return null;

  return (
    <a
      className="satellite-thumbnail"
      href={media.source_url}
      target="_blank"
      rel="noopener noreferrer"
      title={`Изображение ${name} — SatNOGS DB`}
      aria-label={`Открыть источник изображения ${name} на SatNOGS DB`}
    >
      <img
        src={media.image_url}
        alt={`Изображение спутника ${name}`}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
      <small>SatNOGS DB</small>
    </a>
  );
}
