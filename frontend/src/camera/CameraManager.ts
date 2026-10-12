import {
  BoundingSphere,
  Cartesian2,
  Cartesian3,
  Color,
  EasingFunction,
  Ellipsoid,
  HeadingPitchRange,
  Matrix4,
  Math as CesiumMath,
  Viewer,
} from "cesium";

import { CAMERA_CONFIG } from "./cameraConfig";
import {
  clamp,
  distance2d,
  expSmoothingAlpha,
  normalizeAngle,
  shortestAngleDelta,
} from "./cameraMath";
import type {
  CameraDebugState,
  CameraManagerOptions,
  CameraMode,
  CameraOrbitState,
  CameraTargetSample,
} from "./cameraTypes";

/**
 * Deterministic KSP-style target camera.
 *
 * Hard invariant: exactly one camera owner exists at a time.
 * - EARTH      -> Cesium's mature globe controller owns input.
 * - TRANSITION -> all camera input is disabled during the flight.
 * - SATELLITE  -> this manager owns target + heading + pitch + range.
 *
 * React never participates in per-frame camera physics.
 */
export class CameraManager {
  private mode: CameraMode = "EARTH";
  private targetId: number | null = null;
  private targetLabel: string | null = null;
  private orbit: CameraOrbitState = {
    heading: 0,
    pitch: CAMERA_CONFIG.satellite.initialPitch,
    range: 1_000_000,
    targetHeading: 0,
    targetPitch: CAMERA_CONFIG.satellite.initialPitch,
    targetRange: 1_000_000,
  };

  private destroyed = false;
  private transitionGeneration = 0;
  private lastFrameMs = performance.now();
  private latestTarget: CameraTargetSample | null = null;

  private pointerDown = false;
  private draggingSatellite = false;
  private pointerId: number | null = null;
  private downX = 0;
  private downY = 0;
  private lastX = 0;
  private lastY = 0;

  private hoverRaf = 0;
  private pendingHoverPosition: Cartesian2 | null = null;
  private hoveredId: number | null = null;

  private debugVisible = false;
  private debugElement: HTMLDivElement | null = null;
  private lastDebugUpdateMs = 0;

  private currentFov = CAMERA_CONFIG.lens.defaultFov;
  private targetFov = CAMERA_CONFIG.lens.defaultFov;
  private fovHudElement: HTMLDivElement | null = null;
  private fovHudTimer: number | null = null;

  private readonly removePostUpdate: () => void;

  constructor(
    private readonly viewer: Viewer,
    private readonly options: CameraManagerOptions
  ) {
    this.configureEarthController();
    this.initializeLensFromCamera();
    this.bindDomEvents();

    this.removePostUpdate = viewer.scene.postUpdate.addEventListener(() => {
      this.onPostUpdate();
    });
  }

  getMode(): CameraMode {
    return this.mode;
  }

  getTargetId(): number | null {
    return this.targetId;
  }

  focusSatellite(noradId: number): void {
    if (this.destroyed) return;

    if (
      this.targetId === noradId &&
      (this.mode === "SATELLITE" || this.mode === "TRANSITION")
    ) {
      return;
    }

    const sample = this.options.updateTarget(noradId, new Date());
    if (!sample) return;

    // Invalidate any completion/cancel callback belonging to an older flight
    // before cancelFlight() can invoke it.
    const generation = ++this.transitionGeneration;
    this.viewer.camera.cancelFlight();

    this.resetToEarthFixedFrame();

    this.targetId = noradId;
    this.targetLabel = sample.label ?? `NORAD ${noradId}`;
    this.latestTarget = sample;
    this.mode = "TRANSITION";
    this.setCesiumInputs(false);
    this.resetPointerState();

    const initialRange = clamp(
      sample.preferredInitialRangeMeters ??
        this.computeInitialRange(sample.altitudeMeters),
      CAMERA_CONFIG.satellite.minRange,
      CAMERA_CONFIG.satellite.maxRange
    );
    const rawHeading = this.viewer.camera.heading;
    const heading = Number.isFinite(rawHeading)
      ? normalizeAngle(rawHeading)
      : 0;
    const pitch = CAMERA_CONFIG.satellite.initialPitch;

    this.orbit = {
      heading,
      pitch,
      range: initialRange,
      targetHeading: heading,
      targetPitch: pitch,
      targetRange: initialRange,
    };

    this.viewer.camera.flyToBoundingSphere(
      new BoundingSphere(sample.position, 1),
      {
        duration: CAMERA_CONFIG.satellite.transitionSeconds,
        offset: new HeadingPitchRange(heading, pitch, initialRange),
        maximumHeight: Math.max(
          sample.altitudeMeters + initialRange * 1.2,
          4_000_000
        ),
        pitchAdjustHeight: 3_500_000,
        easingFunction: EasingFunction.CUBIC_IN_OUT,
        complete: () => {
          if (
            this.destroyed ||
            generation !== this.transitionGeneration ||
            this.targetId !== noradId
          ) {
            return;
          }

          this.mode = "SATELLITE";
          this.lastFrameMs = performance.now();
          this.setCesiumInputs(false);
        },
        cancel: () => {
          // A newer focus request owns the state. Do not mutate it here.
          if (generation !== this.transitionGeneration || this.destroyed) return;

          // Defensive fallback: an unexpected external cancellation must never
          // leave the app stuck in TRANSITION with all inputs disabled.
          this.resetToEarthFixedFrame();
          this.mode = "EARTH";
          this.targetId = null;
          this.targetLabel = null;
          this.latestTarget = null;
          this.setCesiumInputs(true);
          this.hoveredId = null;
          this.options.onHoverSatellite?.(null);
          this.options.onEarthFocus();
        },
      }
    );
  }

  focusEarth(): void {
    if (this.destroyed) return;

    // If Earth already owns the camera, do not create a second flight.
    if (this.mode === "EARTH" && this.targetId === null) {
      this.resetToEarthFixedFrame();
      this.setCesiumInputs(true);
      return;
    }

    // An Earth-return flight already owns the camera. Repeated Earth clicks /
    // ESC presses must not restart it and accumulate transition callbacks.
    if (this.mode === "TRANSITION" && this.targetId === null) {
      return;
    }

    // Invalidate the previous satellite/transition callback before cancelFlight
    // can invoke it. This makes target switching deterministic.
    const generation = ++this.transitionGeneration;
    this.viewer.camera.cancelFlight();

    // Camera.lookAt() places Cesium in the target's local ENU frame. Cesium's
    // documented way to restore normal globe controls is to reset the camera
    // transform to Matrix4.IDENTITY. Do this BEFORE constructing the Earth
    // return flight. Do not re-apply the previous setView afterwards: that can
    // reintroduce a stale local-frame orientation.
    this.resetToEarthFixedFrame();

    this.targetId = null;
    this.targetLabel = null;
    this.latestTarget = null;
    this.resetPointerState();
    this.hoveredId = null;
    this.options.onHoverSatellite?.(null);

    // UI selection/orbit is released immediately, while camera ownership stays
    // TRANSITION until the Earth framing flight completes.
    this.options.onEarthFocus();

    this.mode = "TRANSITION";
    this.setCesiumInputs(false);

    const earthView = this.computeEarthReturnView();

    this.viewer.camera.flyTo({
      destination: earthView.destination,
      orientation: {
        direction: earthView.direction,
        up: earthView.up,
      },
      duration: CAMERA_CONFIG.earth.returnTransitionSeconds,
      easingFunction: EasingFunction.CUBIC_IN_OUT,
      complete: () => {
        if (
          this.destroyed ||
          generation !== this.transitionGeneration ||
          this.targetId !== null
        ) {
          return;
        }

        // flyTo runs in the Earth-fixed frame. Reassert IDENTITY defensively
        // before handing control back to ScreenSpaceCameraController.
        this.resetToEarthFixedFrame();
        this.mode = "EARTH";
        this.lastFrameMs = performance.now();
        this.setCesiumInputs(true);
      },
      cancel: () => {
        if (this.destroyed || generation !== this.transitionGeneration) return;

        // An external cancellation must never leave the globe with inputs off.
        this.resetToEarthFixedFrame();
        this.mode = "EARTH";
        this.targetId = null;
        this.targetLabel = null;
        this.latestTarget = null;
        this.setCesiumInputs(true);
      },
    });
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    ++this.transitionGeneration;
    this.viewer.camera.cancelFlight();
    this.resetToEarthFixedFrame();
    this.setCesiumInputs(true);

    this.removePostUpdate();
    this.unbindDomEvents();

    if (this.hoverRaf) {
      cancelAnimationFrame(this.hoverRaf);
      this.hoverRaf = 0;
    }

    if (this.fovHudTimer !== null) {
      window.clearTimeout(this.fovHudTimer);
      this.fovHudTimer = null;
    }

    this.fovHudElement?.remove();
    this.fovHudElement = null;

    this.debugElement?.remove();
    this.debugElement = null;
  }

  getDebugState(): CameraDebugState {
    return {
      mode: this.mode,
      targetId: this.targetId,
      targetLabel: this.targetLabel,
      headingDeg: CesiumMath.toDegrees(this.orbit.heading),
      pitchDeg: CesiumMath.toDegrees(this.orbit.pitch),
      rangeKm: this.orbit.range / 1000,
      fovDeg: CesiumMath.toDegrees(this.currentFov),
      cesiumInputs:
        this.viewer.scene.screenSpaceCameraController.enableInputs,
      customInputs: this.mode === "SATELLITE",
    };
  }

  private configureEarthController(): void {
    const controller = this.viewer.scene.screenSpaceCameraController;

    controller.enableInputs = true;
    controller.enableRotate = true;
    controller.enableTilt = true;
    controller.enableZoom = true;
    controller.enableLook = false;
    controller.enableTranslate = true;
    controller.enableCollisionDetection = true;

    controller.inertiaSpin = CAMERA_CONFIG.earth.inertiaSpin;
    controller.inertiaZoom = CAMERA_CONFIG.earth.inertiaZoom;
    controller.zoomFactor = CAMERA_CONFIG.earth.zoomFactor;
    controller.maximumMovementRatio =
      CAMERA_CONFIG.earth.maximumMovementRatio;
    controller.minimumZoomDistance = CAMERA_CONFIG.earth.minimumZoomDistance;
    controller.maximumZoomDistance = CAMERA_CONFIG.earth.maximumZoomDistance;
  }

  private setCesiumInputs(enabled: boolean): void {
    this.viewer.scene.screenSpaceCameraController.enableInputs = enabled;
  }

  private getPerspectiveFrustum(): { fov: number } | null {
    const frustum = this.viewer.camera.frustum as unknown as { fov?: unknown };
    return typeof frustum.fov === "number" && Number.isFinite(frustum.fov)
      ? (frustum as { fov: number })
      : null;
  }

  private initializeLensFromCamera(): void {
    const frustum = this.getPerspectiveFrustum();
    const initialFov = clamp(
      frustum?.fov ?? CAMERA_CONFIG.lens.defaultFov,
      CAMERA_CONFIG.lens.minFov,
      CAMERA_CONFIG.lens.maxFov
    );

    this.currentFov = initialFov;
    this.targetFov = initialFov;

    if (frustum) {
      frustum.fov = initialFov;
    }
  }

  private updateLens(dtSeconds: number): void {
    const frustum = this.getPerspectiveFrustum();
    if (!frustum) return;

    const alpha = expSmoothingAlpha(
      CAMERA_CONFIG.lens.smoothingRate,
      dtSeconds
    );

    this.currentFov += (this.targetFov - this.currentFov) * alpha;
    if (Math.abs(this.targetFov - this.currentFov) < 1e-5) {
      this.currentFov = this.targetFov;
    }

    frustum.fov = clamp(
      this.currentFov,
      CAMERA_CONFIG.lens.minFov,
      CAMERA_CONFIG.lens.maxFov
    );
  }

  private adjustFovFromWheel(event: WheelEvent): void {
    const lineScale = 16;
    const pageScale = Math.max(window.innerHeight, 1);
    const deltaScale =
      event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? lineScale
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? pageScale
          : 1;
    const normalizedDelta = clamp(event.deltaY * deltaScale, -240, 240);
    const deltaDegrees =
      normalizedDelta * CAMERA_CONFIG.lens.wheelDegreesPerPixel;

    this.targetFov = clamp(
      this.targetFov + CesiumMath.toRadians(deltaDegrees),
      CAMERA_CONFIG.lens.minFov,
      CAMERA_CONFIG.lens.maxFov
    );

    this.showFovHud(this.targetFov);
  }

  private resetFov(): void {
    this.targetFov = CAMERA_CONFIG.lens.defaultFov;
    this.showFovHud(this.targetFov);
  }

  private ensureFovHudElement(): void {
    if (this.fovHudElement) return;

    const element = document.createElement("div");
    element.style.position = "absolute";
    element.style.left = "50%";
    element.style.top = "86px";
    element.style.transform = "translateX(-50%)";
    element.style.zIndex = "130";
    element.style.padding = "8px 12px";
    element.style.border = "1px solid rgba(255, 255, 255, 0.12)";
    element.style.borderRadius = "7px";
    element.style.background = "rgba(15, 18, 21, 0.92)";
    element.style.boxShadow = "0 10px 28px rgba(0, 0, 0, 0.24)";
    element.style.color = "#f2f4f5";
    element.style.font = '600 11px/1.2 "SFMono-Regular", Consolas, monospace';
    element.style.letterSpacing = "0.08em";
    element.style.pointerEvents = "none";
    element.style.opacity = "0";
    element.style.transition = "opacity 120ms ease";

    this.viewer.container.appendChild(element);
    this.fovHudElement = element;
  }

  private showFovHud(fovRadians: number): void {
    this.ensureFovHudElement();
    if (!this.fovHudElement) return;

    this.fovHudElement.textContent = `FOV ${Math.round(
      CesiumMath.toDegrees(fovRadians)
    )}°`;
    this.fovHudElement.style.opacity = "1";

    if (this.fovHudTimer !== null) {
      window.clearTimeout(this.fovHudTimer);
    }

    this.fovHudTimer = window.setTimeout(() => {
      if (this.fovHudElement) {
        this.fovHudElement.style.opacity = "0";
      }
      this.fovHudTimer = null;
    }, CAMERA_CONFIG.lens.hudHideDelayMs);
  }

  private bindDomEvents(): void {
    const canvas = this.viewer.scene.canvas;

    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerCancel);
    canvas.addEventListener("pointerleave", this.onPointerLeave);
    canvas.addEventListener("wheel", this.onWheel, {
      passive: false,
      capture: true,
    });
    window.addEventListener("keydown", this.onKeyDown);
  }

  private unbindDomEvents(): void {
    const canvas = this.viewer.scene.canvas;

    canvas.removeEventListener("pointerdown", this.onPointerDown);
    canvas.removeEventListener("pointermove", this.onPointerMove);
    canvas.removeEventListener("pointerup", this.onPointerUp);
    canvas.removeEventListener("pointercancel", this.onPointerCancel);
    canvas.removeEventListener("pointerleave", this.onPointerLeave);
    canvas.removeEventListener("wheel", this.onWheel, true);
    window.removeEventListener("keydown", this.onKeyDown);
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;

    this.pointerDown = true;
    this.pointerId = event.pointerId;
    this.downX = event.clientX;
    this.downY = event.clientY;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    this.draggingSatellite = false;

    if (this.mode === "SATELLITE") {
      this.viewer.scene.canvas.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    }
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (this.pointerDown && event.pointerId === this.pointerId) {
      const moved = distance2d(
        this.downX,
        this.downY,
        event.clientX,
        event.clientY
      );

      if (
        this.mode === "SATELLITE" &&
        moved >= CAMERA_CONFIG.interaction.clickMoveThresholdPx
      ) {
        this.draggingSatellite = true;
      }

      if (this.mode === "SATELLITE" && this.draggingSatellite) {
        const dx = event.clientX - this.lastX;
        const dy = event.clientY - this.lastY;

        this.orbit.targetHeading = normalizeAngle(
          this.orbit.targetHeading -
            dx * CAMERA_CONFIG.satellite.headingSensitivity
        );

        this.orbit.targetPitch +=
          dy * CAMERA_CONFIG.satellite.pitchSensitivity;

        this.orbit.targetPitch = clamp(
          this.orbit.targetPitch,
          CAMERA_CONFIG.satellite.minPitch,
          CAMERA_CONFIG.satellite.hardMaxPitch
        );

        event.preventDefault();
      }

      this.lastX = event.clientX;
      this.lastY = event.clientY;
    }

    if (!this.pointerDown) {
      this.scheduleHoverPick(this.toCanvasPosition(event));
    }
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.button !== 0 || event.pointerId !== this.pointerId) return;

    const wasDragging =
      this.draggingSatellite ||
      distance2d(
        this.downX,
        this.downY,
        event.clientX,
        event.clientY
      ) >= CAMERA_CONFIG.interaction.clickMoveThresholdPx;

    if (this.mode === "SATELLITE") {
      try {
        this.viewer.scene.canvas.releasePointerCapture?.(event.pointerId);
      } catch {
        // Pointer capture may already have been released by the browser.
      }
      event.preventDefault();
    }

    this.resetPointerState();

    if (!wasDragging) {
      this.handleCanvasClick(this.toCanvasPosition(event));
    }
  };

  private readonly onPointerCancel = (): void => {
    this.resetPointerState();
  };

  private readonly onPointerLeave = (): void => {
    // Earth mode does not use pointer capture because Cesium owns the drag. If
    // the pointer leaves the canvas, forget our click bookkeeping so a later
    // pointer-up cannot be misinterpreted as a click.
    if (this.mode !== "SATELLITE" && this.pointerDown) {
      this.resetPointerState();
    }

    if (this.hoveredId !== null) {
      this.hoveredId = null;
      this.options.onHoverSatellite?.(null);
    }
  };

  private readonly onWheel = (event: WheelEvent): void => {
    if (event.ctrlKey && this.getPerspectiveFrustum()) {
      // Capture Ctrl+Wheel before Cesium/browser zoom so it exclusively owns
      // lens FOV. Picking remains correct because this is still a standard
      // perspective projection rather than a post-process fisheye warp.
      event.preventDefault();
      event.stopImmediatePropagation();
      this.adjustFovFromWheel(event);
      return;
    }

    if (this.mode !== "SATELLITE") return;

    event.preventDefault();

    const multiplier = Math.exp(
      event.deltaY * CAMERA_CONFIG.satellite.wheelExponent
    );

    this.orbit.targetRange = clamp(
      this.orbit.targetRange * multiplier,
      CAMERA_CONFIG.satellite.minRange,
      CAMERA_CONFIG.satellite.maxRange
    );
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (
      event.ctrlKey &&
      !event.altKey &&
      (event.code === "Digit0" || event.code === "Numpad0")
    ) {
      event.preventDefault();
      this.resetFov();
      return;
    }

    if (event.key === "Escape" && this.mode !== "EARTH") {
      this.focusEarth();
      return;
    }

    if (event.key === "F8") {
      event.preventDefault();
      this.debugVisible = !this.debugVisible;
      this.ensureDebugElement();
      if (this.debugElement) {
        this.debugElement.style.display = this.debugVisible ? "block" : "none";
      }
    }
  };

  private handleCanvasClick(position: Cartesian2): void {
    const satelliteId = this.pickSatelliteId(position);

    if (satelliteId !== null) {
      this.options.onSatelliteClick(satelliteId);
      return;
    }

    const ray = this.viewer.camera.getPickRay(position);
    if (!ray) return;

    const earthPosition = this.viewer.scene.globe.pick(
      ray,
      this.viewer.scene
    );

    if (earthPosition) {
      this.focusEarth();
    }
  }

  private pickSatelliteId(position: Cartesian2): number | null {
    const picked = this.viewer.scene.pick(position) as
      | { id?: unknown; primitive?: { id?: unknown } }
      | undefined;

    const rawId = picked?.id ?? picked?.primitive?.id;
    const noradId = Number(rawId);

    return Number.isFinite(noradId) ? noradId : null;
  }

  private scheduleHoverPick(position: Cartesian2): void {
    this.pendingHoverPosition = position;
    if (this.hoverRaf) return;

    this.hoverRaf = requestAnimationFrame(() => {
      this.hoverRaf = 0;
      const pending = this.pendingHoverPosition;
      this.pendingHoverPosition = null;
      if (!pending || this.destroyed) return;

      const nextId = this.pickSatelliteId(pending);
      if (nextId === this.hoveredId) return;

      this.hoveredId = nextId;
      this.options.onHoverSatellite?.(nextId);
    });
  }

  private onPostUpdate(): void {
    if (this.destroyed) return;

    const nowMs = performance.now();
    const dtSeconds = clamp((nowMs - this.lastFrameMs) / 1000, 0, 0.1);
    this.lastFrameMs = nowMs;

    this.updateLens(dtSeconds);

    if (
      (this.mode === "TRANSITION" || this.mode === "SATELLITE") &&
      this.targetId !== null
    ) {
      this.latestTarget = this.options.updateTarget(
        this.targetId,
        new Date()
      );
    }

    if (
      this.mode === "SATELLITE" &&
      this.targetId !== null &&
      this.latestTarget
    ) {
      this.updateSatelliteCamera(this.latestTarget, dtSeconds);
    }

    if (this.debugVisible && nowMs - this.lastDebugUpdateMs > 100) {
      this.lastDebugUpdateMs = nowMs;
      this.updateDebugElement();
    }
  }

  private updateSatelliteCamera(
    target: CameraTargetSample,
    dtSeconds: number
  ): void {
    const angularAlpha = expSmoothingAlpha(
      CAMERA_CONFIG.satellite.angularSmoothingRate,
      dtSeconds
    );
    const rangeAlpha = expSmoothingAlpha(
      CAMERA_CONFIG.satellite.rangeSmoothingRate,
      dtSeconds
    );

    const headingDelta = shortestAngleDelta(
      this.orbit.heading,
      this.orbit.targetHeading
    );

    this.orbit.heading = normalizeAngle(
      this.orbit.heading + headingDelta * angularAlpha
    );
    this.orbit.pitch +=
      (this.orbit.targetPitch - this.orbit.pitch) * angularAlpha;
    this.orbit.range +=
      (this.orbit.targetRange - this.orbit.range) * rangeAlpha;

    const maxPitch = this.computeEarthSafeMaxPitch(
      target.altitudeMeters,
      this.orbit.range
    );

    this.orbit.targetPitch = clamp(
      this.orbit.targetPitch,
      CAMERA_CONFIG.satellite.minPitch,
      maxPitch
    );
    this.orbit.pitch = clamp(
      this.orbit.pitch,
      CAMERA_CONFIG.satellite.minPitch,
      maxPitch
    );

    this.viewer.camera.lookAt(
      target.position,
      new HeadingPitchRange(
        this.orbit.heading,
        this.orbit.pitch,
        this.orbit.range
      )
    );
  }

  private computeInitialRange(altitudeMeters: number): number {
    return clamp(
      700_000 + Math.max(0, altitudeMeters) * 0.22,
      700_000,
      7_000_000
    );
  }

  private computeEarthSafeMaxPitch(
    altitudeMeters: number,
    rangeMeters: number
  ): number {
    const availableDownwardDistance = Math.max(
      0,
      altitudeMeters - CAMERA_CONFIG.satellite.earthClearanceMeters
    );

    if (availableDownwardDistance >= rangeMeters) {
      return CAMERA_CONFIG.satellite.hardMaxPitch;
    }

    const ratio = clamp(
      availableDownwardDistance / Math.max(rangeMeters, 1),
      0,
      1
    );

    return Math.min(
      CAMERA_CONFIG.satellite.hardMaxPitch,
      Math.asin(ratio)
    );
  }

  /**
   * Return Cesium from a target-local ENU reference frame to the normal
   * Earth-fixed frame. With no offset, lookAtTransform transforms the current
   * camera pose into the new frame, so no extra setView() is required.
   */
  private resetToEarthFixedFrame(): void {
    this.viewer.camera.lookAtTransform(Matrix4.IDENTITY);
  }

  /**
   * Build a stable, roll-free Earth view from the current hemisphere. The
   * camera keeps roughly the same radial side of the planet, but is pushed out
   * to a sane altitude if satellite tracking left it too close to the surface.
   */
  private computeEarthReturnView(): {
    destination: Cartesian3;
    direction: Cartesian3;
    up: Cartesian3;
  } {
    const cameraPosition = Cartesian3.clone(this.viewer.camera.positionWC);
    const earthRadius = Ellipsoid.WGS84.maximumRadius;

    let radial = Cartesian3.clone(cameraPosition);
    if (Cartesian3.magnitudeSquared(radial) < 1) {
      radial = Cartesian3.clone(Cartesian3.UNIT_X);
    } else {
      Cartesian3.normalize(radial, radial);
    }

    const currentAltitude = Math.max(
      0,
      Cartesian3.magnitude(cameraPosition) - earthRadius
    );
    const returnAltitude = clamp(
      currentAltitude,
      CAMERA_CONFIG.earth.minimumReturnAltitude,
      CAMERA_CONFIG.earth.maximumReturnAltitude
    );

    const destination = Cartesian3.multiplyByScalar(
      radial,
      earthRadius + returnAltitude,
      new Cartesian3()
    );

    const direction = Cartesian3.negate(destination, new Cartesian3());
    Cartesian3.normalize(direction, direction);

    // Use geographic north as the preferred screen-up direction, projected
    // into the plane perpendicular to the view. Fall back near the poles.
    let right = Cartesian3.cross(
      direction,
      Cartesian3.UNIT_Z,
      new Cartesian3()
    );

    if (Cartesian3.magnitudeSquared(right) < 1e-10) {
      right = Cartesian3.cross(
        direction,
        Cartesian3.UNIT_Y,
        right
      );
    }

    Cartesian3.normalize(right, right);
    const up = Cartesian3.cross(right, direction, new Cartesian3());
    Cartesian3.normalize(up, up);

    return { destination, direction, up };
  }

  private resetPointerState(): void {
    this.pointerDown = false;
    this.draggingSatellite = false;
    this.pointerId = null;
  }

  private toCanvasPosition(event: MouseEvent | PointerEvent): Cartesian2 {
    const rect = this.viewer.scene.canvas.getBoundingClientRect();
    return new Cartesian2(
      event.clientX - rect.left,
      event.clientY - rect.top
    );
  }

  private ensureDebugElement(): void {
    if (this.debugElement) return;

    const element = document.createElement("div");
    element.style.position = "absolute";
    element.style.right = "24px";
    element.style.bottom = "28px";
    element.style.zIndex = "100";
    element.style.minWidth = "210px";
    element.style.padding = "12px 14px";
    element.style.border = "1px solid rgba(142, 223, 255, 0.24)";
    element.style.borderRadius = "10px";
    element.style.background = "rgba(4, 9, 16, 0.88)";
    element.style.backdropFilter = "blur(10px)";
    element.style.color = Color.CYAN.toCssColorString();
    element.style.font = '11px/1.55 "SFMono-Regular", Consolas, monospace';
    element.style.whiteSpace = "pre";
    element.style.pointerEvents = "none";
    element.style.display = "none";

    this.viewer.container.appendChild(element);
    this.debugElement = element;
  }

  private updateDebugElement(): void {
    this.ensureDebugElement();
    if (!this.debugElement) return;

    const state = this.getDebugState();
    this.debugElement.textContent = [
      "CAMERA DEBUG · F8",
      `MODE       ${state.mode}`,
      `TARGET     ${state.targetLabel ?? "EARTH"}`,
      `NORAD      ${state.targetId ?? "—"}`,
      `HEADING    ${state.headingDeg.toFixed(1)}°`,
      `PITCH      ${state.pitchDeg.toFixed(1)}°`,
      `RANGE      ${state.rangeKm.toFixed(1)} km`,
      `FOV        ${state.fovDeg.toFixed(1)}°`,
      `CESIUM IN  ${state.cesiumInputs ? "ON" : "OFF"}`,
      `CUSTOM IN  ${state.customInputs ? "ON" : "OFF"}`,
    ].join("\n");
  }
}
