export type EarthQuality = "LOW" | "MEDIUM" | "HIGH";

export interface EarthVisualProfile {
  resolutionScale: number;
  useBrowserRecommendedResolution: boolean;
  maximumScreenSpaceError: number;
  hdr: boolean;
  imageryBrightness: number;
  imageryContrast: number;
  imagerySaturation: number;
  imageryGamma: number;
  atmosphereLightIntensity: number;
  groundAtmosphereLightIntensity: number;
}

export interface EarthLodBand {
  maxCameraHeightMeters: number;
  maximumScreenSpaceError: number;
}

export const ARCGIS_WORLD_IMAGERY_URLS = [
  "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
] as const;

// Cesium uses globe maximumScreenSpaceError to decide when to refine tiles.
// Lower values request finer detail. We only tighten it as the camera approaches
// Earth so the orbital overview stays lightweight while close views sharpen.
export const EARTH_ADAPTIVE_LOD_BANDS: readonly EarthLodBand[] = [
  { maxCameraHeightMeters: 500_000, maximumScreenSpaceError: 0.55 },
  { maxCameraHeightMeters: 1_500_000, maximumScreenSpaceError: 0.65 },
  { maxCameraHeightMeters: 4_000_000, maximumScreenSpaceError: 0.8 },
  { maxCameraHeightMeters: 10_000_000, maximumScreenSpaceError: 1.0 },
  { maxCameraHeightMeters: Number.POSITIVE_INFINITY, maximumScreenSpaceError: 1.25 },
] as const;

export const EARTH_TILE_CACHE_SIZE = 256;

// LOW/MEDIUM profiles remain for internal/API compatibility only. The public
// UI is HIGH-only from v0.5.4 onward.
export const EARTH_VISUAL_PROFILES: Record<EarthQuality, EarthVisualProfile> = {
  LOW: {
    resolutionScale: 0.8,
    useBrowserRecommendedResolution: true,
    maximumScreenSpaceError: 4.0,
    hdr: false,
    imageryBrightness: 0.92,
    imageryContrast: 1.02,
    imagerySaturation: 0.92,
    imageryGamma: 1.0,
    atmosphereLightIntensity: 38.0,
    groundAtmosphereLightIntensity: 8.0,
  },
  MEDIUM: {
    resolutionScale: 1.0,
    useBrowserRecommendedResolution: true,
    maximumScreenSpaceError: 2.0,
    hdr: true,
    imageryBrightness: 0.94,
    imageryContrast: 1.05,
    imagerySaturation: 1.02,
    imageryGamma: 1.0,
    atmosphereLightIntensity: 46.0,
    groundAtmosphereLightIntensity: 10.0,
  },
  HIGH: {
    resolutionScale: 1.0,
    useBrowserRecommendedResolution: false,
    maximumScreenSpaceError: 1.25,
    hdr: true,
    imageryBrightness: 0.96,
    imageryContrast: 1.08,
    imagerySaturation: 1.06,
    imageryGamma: 0.98,
    atmosphereLightIntensity: 52.0,
    groundAtmosphereLightIntensity: 12.0,
  },
};
