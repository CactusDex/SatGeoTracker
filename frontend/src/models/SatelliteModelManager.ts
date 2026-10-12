import {
  Cartesian3,
  Matrix4,
  Model,
  ShadowMode,
  Viewer,
} from "cesium";

import { buildOrbitalModelMatrix } from "./modelOrientation";
import { getSatelliteModelDefinition } from "./satelliteModelRegistry";
import type {
  SatelliteModelDefinition,
  SatelliteModelManagerOptions,
  SatelliteModelStatus,
} from "./modelTypes";

interface LoadedSatelliteModel {
  definition: SatelliteModelDefinition;
  model: Model;
}

function formatModelLoadError(cause: unknown): string {
  if (cause instanceof Error) {
    return `${cause.name}: ${cause.message}`;
  }
  return String(cause || "Unable to load 3D model");
}

function waitForModelReady(
  model: Model,
  viewer: Viewer,
  timeoutMs: number
): Promise<void> {
  if (model.ready) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    let settled = false;

    const finish = (error?: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      removeReady();
      removeError();
      if (error !== undefined) reject(error);
      else resolve();
    };

    const removeReady = model.readyEvent.addEventListener(() => finish());
    const removeError = model.errorEvent.addEventListener((error) => finish(error));
    const timeoutId = window.setTimeout(() => {
      finish(new Error(`Timed out waiting for Cesium Model.ready after ${timeoutMs} ms`));
    }, timeoutMs);

    // Make sure request-render configurations still advance model processing.
    if (!viewer.isDestroyed()) viewer.scene.requestRender();
  });
}

/**
 * Owns the optional detailed model for the currently selected satellite.
 *
 * Performance invariant: the ~16k satellite cloud remains PointPrimitive based.
 * At most one detailed spacecraft model is visible in v0.6.
 */
export class SatelliteModelManager {
  private readonly loaded = new Map<string, LoadedSatelliteModel>();
  private readonly loading = new Map<string, Promise<LoadedSatelliteModel>>();

  private activeNoradId: number | null = null;
  private activeDefinition: SatelliteModelDefinition | null = null;
  private previousPosition: Cartesian3 | null = null;
  private previousSampleMs = 0;
  private latestPosition: Cartesian3 | null = null;
  private latestSampleMs = 0;
  private pointSuppressed = false;
  private activePoseFaulted = false;
  private generation = 0;
  private destroyed = false;

  constructor(
    private readonly viewer: Viewer,
    private readonly options: SatelliteModelManagerOptions = {}
  ) {}

  /** Start downloading/compiling a known model without making it visible. */
  preloadByNorad(noradId: number): void {
    const definition = getSatelliteModelDefinition(noradId);
    if (!definition || this.destroyed) return;

    void this.ensureLoaded(definition).catch((cause) => {
      // Preload is best-effort, but keep the real cause visible in devtools.
      // A later explicit selection will retry and surface the same message in UI.
      console.warn("SatGeoTracker: 3D model preload failed", cause);
    });
  }

  selectSatellite(noradId: number): void {
    if (this.destroyed) return;

    ++this.generation;
    this.hideActiveModel();

    this.activeNoradId = noradId;
    this.activeDefinition = getSatelliteModelDefinition(noradId);
    this.previousPosition = null;
    this.previousSampleMs = 0;
    this.latestPosition = null;
    this.latestSampleMs = 0;
    this.pointSuppressed = false;
    this.activePoseFaulted = false;

    const definition = this.activeDefinition;
    if (!definition) {
      this.options.onStatusChange?.(null);
      return;
    }

    const loaded = this.loaded.get(definition.key);
    if (loaded) {
      // Keep it hidden until updateTrackedSatellite() supplies the new target's
      // exact current SGP4 position. This prevents a stale-pose flash.
      loaded.model.show = false;
      this.emitStatus(definition, "READY");
      return;
    }

    const generation = this.generation;
    this.emitStatus(definition, "LOADING");

    void this.ensureLoaded(definition)
      .then((entry) => {
        if (
          this.destroyed ||
          generation !== this.generation ||
          this.activeNoradId !== noradId ||
          this.activeDefinition?.key !== definition.key
        ) {
          entry.model.show = false;
          return;
        }

        if (this.latestPosition) {
          try {
            this.applyPose(entry.model, this.latestPosition, this.latestSampleMs);
            entry.model.show = true;
          } catch (cause) {
            this.handlePoseFailure(definition, entry.model, cause);
            return;
          }
        } else {
          entry.model.show = false;
        }
        this.emitStatus(definition, "READY");
      })
      .catch((cause) => {
        if (
          this.destroyed ||
          generation !== this.generation ||
          this.activeNoradId !== noradId
        ) {
          return;
        }

        console.error("SatGeoTracker: 3D model load failed", cause);
        this.pointSuppressed = false;
        this.emitStatus(
          definition,
          "ERROR",
          formatModelLoadError(cause)
        );
      });
  }

  /**
   * Called from App.updateTrackedSatellite() with the exact Cartesian3 that is
   * returned to CameraManager in the same render frame.
   *
   * Returns true when the PointPrimitive should be hidden because the detailed
   * model is loaded and close enough to read at its real world scale.
   */
  updateTrackedSatellite(
    noradId: number,
    date: Date,
    position: Cartesian3
  ): boolean {
    if (
      this.destroyed ||
      this.activeNoradId !== noradId ||
      !this.activeDefinition ||
      this.activePoseFaulted
    ) {
      return false;
    }

    this.latestPosition = Cartesian3.clone(position, this.latestPosition ?? undefined);
    this.latestSampleMs = date.getTime();

    const entry = this.loaded.get(this.activeDefinition.key);
    if (!entry) {
      this.pointSuppressed = false;
      return false;
    }

    entry.model.show = true;
    try {
      this.applyPose(entry.model, position, date.getTime());
    } catch (cause) {
      this.handlePoseFailure(this.activeDefinition, entry.model, cause);
      return false;
    }

    const cameraDistance = Cartesian3.distance(
      this.viewer.camera.positionWC,
      position
    );

    if (this.pointSuppressed) {
      if (
        cameraDistance >
        this.activeDefinition.pointSuppressExitDistanceMeters
      ) {
        this.pointSuppressed = false;
      }
    } else if (
      cameraDistance < this.activeDefinition.pointSuppressEnterDistanceMeters
    ) {
      this.pointSuppressed = true;
    }

    return this.pointSuppressed;
  }

  isPointSuppressed(noradId: number): boolean {
    return this.activeNoradId === noradId && this.pointSuppressed;
  }

  clearSelection(): void {
    if (this.destroyed) return;

    ++this.generation;
    this.hideActiveModel();
    this.activeNoradId = null;
    this.activeDefinition = null;
    this.previousPosition = null;
    this.previousSampleMs = 0;
    this.latestPosition = null;
    this.latestSampleMs = 0;
    this.pointSuppressed = false;
    this.activePoseFaulted = false;
    this.options.onStatusChange?.(null);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    ++this.generation;

    this.hideActiveModel();

    for (const entry of this.loaded.values()) {
      if (!entry.model.isDestroyed()) {
        this.viewer.scene.primitives.remove(entry.model);
      }
    }

    this.loaded.clear();
    this.loading.clear();
    this.options.onStatusChange?.(null);
  }

  private hideActiveModel(): void {
    if (!this.activeDefinition) return;
    const entry = this.loaded.get(this.activeDefinition.key);
    if (entry) entry.model.show = false;
  }

  private applyPose(model: Model, position: Cartesian3, sampleMs: number): void {
    // Treat a large gap (tab suspension / target switch) as a fresh sample so a
    // stale previous position cannot rotate the spacecraft wildly.
    const dtMs = sampleMs - this.previousSampleMs;
    const previous =
      this.previousPosition && dtMs > 0 && dtMs < 2_000
        ? this.previousPosition
        : null;

    const modelMatrix = buildOrbitalModelMatrix(position, previous);
    model.modelMatrix = Matrix4.clone(modelMatrix, model.modelMatrix);

    this.previousPosition = Cartesian3.clone(
      position,
      this.previousPosition ?? undefined
    );
    this.previousSampleMs = sampleMs;
  }

  private handlePoseFailure(
    definition: SatelliteModelDefinition,
    model: Model,
    cause: unknown
  ): void {
    // A detailed model is optional UI. A pose/math failure must never escape
    // through scene.postUpdate and stop Cesium's entire render loop.
    this.activePoseFaulted = true;
    this.pointSuppressed = false;
    model.show = false;

    const message = `Pose error: ${formatModelLoadError(cause)}`;
    console.error("SatGeoTracker: 3D model pose failed; using point fallback", cause);
    this.emitStatus(definition, "ERROR", message);
  }

  private ensureLoaded(
    definition: SatelliteModelDefinition
  ): Promise<LoadedSatelliteModel> {
    const existing = this.loaded.get(definition.key);
    if (existing) return Promise.resolve(existing);

    const pending = this.loading.get(definition.key);
    if (pending) return pending;

    const promise = (async () => {
      let model: Model | null = null;
      let addedToScene = false;

      try {
        model = await Model.fromGltfAsync({
          url: definition.url,
          show: false,
          id: definition.noradIds[0],
          allowPicking: true,
          incrementallyLoadTextures: true,
          minimumPixelSize: 0,
          shadows: ShadowMode.ENABLED,
          scene: this.viewer.scene,
          credit: definition.credit,
          showCreditsOnScreen: false,
        });

        if (this.destroyed || this.viewer.isDestroyed()) {
          throw new Error("3D model manager was destroyed during loading");
        }

        // Cesium's Model.fromGltfAsync() resolves after the glTF resource/loader
        // is created, but the Model still needs to participate in the scene render
        // loop before Model.ready becomes true. Accessing boundingSphere before
        // that point can throw. Add first, wait for ready, then normalize scale.
        this.viewer.scene.primitives.add(model);
        addedToScene = true;
        this.viewer.scene.requestRender();

        await waitForModelReady(model, this.viewer, 15_000);

        if (this.destroyed || this.viewer.isDestroyed()) {
          throw new Error("3D model manager was destroyed during loading");
        }

        // Normalize this source asset only after Model.ready. Keeping
        // minimumPixelSize at zero preserves true world-scale rendering.
        const intrinsicDiameter = Math.max(model.boundingSphere.radius * 2, 1e-6);
        model.scale = definition.physicalSpanMeters / intrinsicDiameter;
        model.show = false;

        const entry: LoadedSatelliteModel = { definition, model };
        this.loaded.set(definition.key, entry);
        return entry;
      } catch (cause) {
        if (model && !model.isDestroyed()) {
          if (addedToScene && !this.viewer.isDestroyed()) {
            this.viewer.scene.primitives.remove(model);
          } else {
            model.destroy();
          }
        }
        throw cause;
      }
    })();

    this.loading.set(definition.key, promise);

    return promise.finally(() => {
      if (this.loading.get(definition.key) === promise) {
        this.loading.delete(definition.key);
      }
    });
  }

  private emitStatus(
    definition: SatelliteModelDefinition,
    state: SatelliteModelStatus["state"],
    message?: string
  ): void {
    this.options.onStatusChange?.({
      noradId: this.activeNoradId ?? definition.noradIds[0],
      label: definition.label,
      state,
      physicalSpanMeters: definition.physicalSpanMeters,
      credit: definition.credit,
      message,
    });
  }
}
