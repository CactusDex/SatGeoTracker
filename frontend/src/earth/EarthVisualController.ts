import {
  ArcGisMapServerImageryProvider,
  Color,
  Ellipsoid,
  GeographicTilingScheme,
  ImageryLayer,
  ImageryProvider,
  JulianDate,
  SkyAtmosphere,
  UrlTemplateImageryProvider,
  Viewer,
} from "cesium";

import {
  ARCGIS_WORLD_IMAGERY_URLS,
  EARTH_ADAPTIVE_LOD_BANDS,
  EARTH_TILE_CACHE_SIZE,
  EARTH_VISUAL_PROFILES,
  type EarthQuality,
} from "./earthConfig";
import { LocalMapContextController } from "./LocalMapContextController";

export interface EarthVisualStatus {
  quality: EarthQuality;
  source: "ARCGIS" | "LOCAL" | "LOADING";
  label: string;
}

export interface EarthVisualControllerOptions {
  onStatusChange?: (status: EarthVisualStatus) => void;
}

/**
 * Earth-only visual subsystem.
 *
 * v0.5.7 restores the Cesium/ArcGIS path that produced the best imagery in
 * v0.5, but uses Cesium's asynchronous ImageryLayer helper so provider
 * metadata never blocks the rest of the application. The bundled Natural
 * Earth layer remains underneath while the real ArcGIS layer initializes.
 *
 * Close-up fidelity is driven by Cesium's own globe LOD controls rather than
 * by manually guessing tile URLs. Country borders/cities remain fully local.
 * Camera System v0.4.1 is not touched.
 */
export class EarthVisualController {
  private localImageryLayer: ImageryLayer | null = null;
  private remoteImageryLayer: ImageryLayer | null = null;
  private readonly mapContext: LocalMapContextController;
  private quality: EarthQuality = "HIGH";
  private destroyed = false;
  private remoteReady = false;
  private mapContextReady = false;
  private remoteInitializationFailed = false;
  private imageryErrors = 0;
  private lastLodBucket = -1;
  private tileQueueBusy: boolean | null = null;

  constructor(
    private readonly viewer: Viewer,
    private readonly options: EarthVisualControllerOptions = {}
  ) {
    this.ensureAtmosphere();
    this.mapContext = new LocalMapContextController(viewer);

    this.viewer.scene.postRender.addEventListener(this.updateAdaptiveLod);
    this.viewer.scene.globe.tileLoadProgressEvent.addEventListener(
      this.onTileLoadProgress
    );
  }

  async initialize(initialQuality: EarthQuality = "HIGH"): Promise<void> {
    if (this.destroyed) return;

    this.quality = initialQuality;
    this.applyVisualProfile("HIGH");

    // Instant visual baseline. It never blocks ArcGIS initialization and stays
    // underneath the high-resolution layer to avoid a black/blue flash.
    this.ensureLocalBaseline();

    // Cesium-native async layer. The ArcGIS metadata handshake happens in the
    // background; the layer starts requesting its own cached high-resolution
    // tiles as soon as the provider is ready.
    this.ensureHighResolutionImagery();

    this.emitCombinedStatus();

    // Borders / country labels / city labels are local and independent from
    // the remote imagery service.
    void this.mapContext.initialize().then(() => {
      if (this.destroyed) return;
      this.mapContextReady = true;
      this.emitCombinedStatus();
    });
  }

  // Kept only for API compatibility. The public viewer is HIGH-only.
  async setQuality(_quality: EarthQuality): Promise<void> {
    if (this.destroyed) return;
    this.quality = "HIGH";
    this.applyVisualProfile("HIGH");
    this.ensureLocalBaseline();
    this.ensureHighResolutionImagery();
  }

  setTime(date: Date): void {
    if (this.destroyed || this.viewer.isDestroyed()) return;
    this.viewer.clock.currentTime = JulianDate.fromDate(date);
  }

  destroy(): void {
    this.destroyed = true;

    if (!this.viewer.isDestroyed()) {
      this.viewer.scene.postRender.removeEventListener(this.updateAdaptiveLod);
      this.viewer.scene.globe.tileLoadProgressEvent.removeEventListener(
        this.onTileLoadProgress
      );

      this.mapContext.destroy();

      if (this.remoteImageryLayer) {
        this.viewer.imageryLayers.remove(this.remoteImageryLayer, true);
      }
      if (this.localImageryLayer) {
        this.viewer.imageryLayers.remove(this.localImageryLayer, true);
      }
    }

    this.remoteImageryLayer = null;
    this.localImageryLayer = null;
  }

  private ensureLocalBaseline(): void {
    if (this.localImageryLayer || this.destroyed || this.viewer.isDestroyed()) {
      return;
    }

    const provider = new UrlTemplateImageryProvider({
      url: "/cesium/Assets/Textures/NaturalEarthII/{z}/{x}/{reverseY}.jpg",
      tilingScheme: new GeographicTilingScheme(),
      maximumLevel: 5,
      hasAlphaChannel: false,
      enablePickFeatures: false,
      credit: "Natural Earth II",
    });

    const layer = new ImageryLayer(provider);
    this.applyImageryProfile(layer);
    this.viewer.imageryLayers.add(layer, 0);
    this.localImageryLayer = layer;
  }

  private ensureHighResolutionImagery(): void {
    if (this.remoteImageryLayer || this.destroyed || this.viewer.isDestroyed()) {
      return;
    }

    const providerPromise = this.createArcGisProvider();

    // This API is designed specifically for asynchronous providers. We can add
    // the layer now and Cesium begins rendering it automatically once ready.
    const layer = ImageryLayer.fromProviderAsync(providerPromise);
    this.applyImageryProfile(layer);
    layer.alpha = 1.0;
    layer.show = true;

    layer.readyEvent.addEventListener((provider: ImageryProvider) => {
      if (this.destroyed) return;

      this.remoteReady = true;
      this.remoteInitializationFailed = false;
      this.imageryErrors = 0;

      provider.errorEvent.addEventListener((error) => {
        this.imageryErrors += 1;
        // Missing/transient tiles must not unload the whole high-resolution
        // layer. Cesium can retry relevant requests as the camera changes.
        console.warn("SatGeoTracker: ArcGIS imagery tile error.", error);
        if (this.imageryErrors === 3) {
          this.emitCombinedStatus();
        }
      });

      this.emitCombinedStatus();
    });

    layer.errorEvent.addEventListener((error) => {
      if (this.destroyed) return;
      this.remoteInitializationFailed = true;
      console.warn("SatGeoTracker: ArcGIS imagery provider failed to initialize.", error);
      this.emitCombinedStatus();
    });

    const insertIndex = this.localImageryLayer ? 1 : 0;
    this.viewer.imageryLayers.add(layer, insertIndex);
    this.remoteImageryLayer = layer;
  }

  private async createArcGisProvider(): Promise<ImageryProvider> {
    let lastError: unknown = null;

    for (const url of ARCGIS_WORLD_IMAGERY_URLS) {
      try {
        return await ArcGisMapServerImageryProvider.fromUrl(url, {
          enablePickFeatures: false,
          usePreCachedTilesIfAvailable: true,
        });
      } catch (error) {
        lastError = error;
        console.warn(`SatGeoTracker: ArcGIS endpoint unavailable: ${url}`, error);
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("No ArcGIS World Imagery endpoint could be initialized");
  }

  private applyImageryProfile(layer: ImageryLayer): void {
    const profile = EARTH_VISUAL_PROFILES.HIGH;
    layer.brightness = profile.imageryBrightness;
    layer.contrast = profile.imageryContrast;
    layer.saturation = profile.imagerySaturation;
    layer.gamma = profile.imageryGamma;
  }

  private ensureAtmosphere(): void {
    const scene = this.viewer.scene;

    if (!scene.skyAtmosphere) {
      scene.skyAtmosphere = new SkyAtmosphere(Ellipsoid.WGS84);
    }

    scene.skyAtmosphere.show = true;
    scene.backgroundColor = Color.BLACK;

    if (scene.skyBox) scene.skyBox.show = true;
    if (scene.sun) scene.sun.show = true;
  }

  private applyVisualProfile(_quality: EarthQuality): void {
    const profile = EARTH_VISUAL_PROFILES.HIGH;
    const scene = this.viewer.scene;
    const globe = scene.globe;
    const skyAtmosphere = scene.skyAtmosphere;

    // Full device-pixel rendering. Cesium documents that false here makes the
    // viewer render in device pixels instead of forcing CSS-pixel resolution.
    this.viewer.resolutionScale = profile.resolutionScale;
    this.viewer.useBrowserRecommendedResolution =
      profile.useBrowserRecommendedResolution;

    globe.maximumScreenSpaceError = profile.maximumScreenSpaceError;

    // Retain more recently visited globe tiles. This does not force extra
    // requests for invisible areas; it mainly improves zoom-back/pan-back.
    globe.tileCacheSize = EARTH_TILE_CACHE_SIZE;
    globe.preloadAncestors = true;
    globe.preloadSiblings = false;

    globe.enableLighting = true;
    globe.showGroundAtmosphere = true;
    globe.dynamicAtmosphereLighting = true;
    globe.dynamicAtmosphereLightingFromSun = true;
    globe.atmosphereLightIntensity = profile.groundAtmosphereLightIntensity;

    globe.atmosphereHueShift = -0.015;
    globe.atmosphereSaturationShift = 0.08;
    globe.atmosphereBrightnessShift = -0.035;

    if (skyAtmosphere) {
      skyAtmosphere.atmosphereLightIntensity = profile.atmosphereLightIntensity;
      skyAtmosphere.hueShift = -0.015;
      skyAtmosphere.saturationShift = 0.1;
      skyAtmosphere.brightnessShift = -0.025;
    }

    scene.fog.enabled = true;
    scene.sunBloom = true;
    scene.highDynamicRange = profile.hdr && scene.highDynamicRangeSupported;
    scene.gamma = 2.15;

    if (this.localImageryLayer) this.applyImageryProfile(this.localImageryLayer);
    if (this.remoteImageryLayer) this.applyImageryProfile(this.remoteImageryLayer);

    this.lastLodBucket = -1;
    this.updateAdaptiveLod();
  }

  private readonly updateAdaptiveLod = (): void => {
    if (this.destroyed || this.viewer.isDestroyed()) return;

    const cartographic = Ellipsoid.WGS84.cartesianToCartographic(
      this.viewer.camera.positionWC
    );
    if (!cartographic) return;

    const height = Math.max(0, cartographic.height);
    const bucket = EARTH_ADAPTIVE_LOD_BANDS.findIndex(
      (band) => height <= band.maxCameraHeightMeters
    );

    if (bucket < 0 || bucket === this.lastLodBucket) return;
    this.lastLodBucket = bucket;

    this.viewer.scene.globe.maximumScreenSpaceError =
      EARTH_ADAPTIVE_LOD_BANDS[bucket].maximumScreenSpaceError;
  };

  private readonly onTileLoadProgress = (remaining: number): void => {
    if (this.destroyed || !this.remoteReady) return;

    const busy = remaining > 0;
    if (busy === this.tileQueueBusy) return;

    this.tileQueueBusy = busy;
    if (!busy) this.imageryErrors = 0;
    this.emitCombinedStatus();
  };

  private emitCombinedStatus(): void {
    if (this.destroyed) return;

    const mapContext = this.mapContextReady ? " · borders / cities" : "";

    if (this.remoteReady) {
      const refinement = this.tileQueueBusy === false ? " · detailed" : " · refining";
      const warning = this.imageryErrors >= 3 ? " · some tiles retrying" : "";
      this.emitStatus(
        "ARCGIS",
        `ArcGIS World Imagery · adaptive LOD${refinement}${mapContext}${warning}`
      );
      return;
    }

    if (this.remoteInitializationFailed) {
      this.emitStatus(
        "LOCAL",
        `Natural Earth II · ArcGIS unavailable${mapContext}`
      );
      return;
    }

    this.emitStatus(
      "LOADING",
      `Natural Earth II · loading ArcGIS high-resolution imagery${mapContext}`
    );
  }

  private emitStatus(
    source: EarthVisualStatus["source"],
    label: string
  ): void {
    this.options.onStatusChange?.({
      quality: "HIGH",
      source,
      label,
    });
  }
}
