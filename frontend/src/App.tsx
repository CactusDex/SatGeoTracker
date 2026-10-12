import {
  Cartesian3,
  Color,
  Ellipsoid,
  Entity,
  PointPrimitive,
  PointPrimitiveCollection,
  Viewer,
} from "cesium";
import { useEffect, useMemo, useRef, useState } from "react";
import * as satellite from "satellite.js";

import { loadSatellites } from "./api";
import { EarthVisualController } from "./earth";
import { CameraManager } from "./camera";
import type { CameraTargetSample } from "./camera";
import {
  getPreferredModelCameraRangeMeters,
  SatelliteModelManager,
} from "./models";
import type { SatelliteModelStatus } from "./models";
import {
  makeRuntimeSatellite,
  orbitSampleDates,
  updateSatellite,
} from "./orbit";
import type { OmmRecord, OrbitType, SatelliteRuntime } from "./types";
import {
  cardinalDirection,
  computeLookAngles,
  ObserverPanel,
  PassStrip,
  useObserverPasses,
} from "./observer";
import {
  formatFrequency,
  SdrFilterPanel,
  SdrRadioPanel,
  transmitterFrequencyHz,
  useSdrData,
} from "./sdr";

type OrbitFilter = "ALL" | OrbitType;
type AppMode = "MAP" | "SDR" | "PASSES";

const UPDATE_INTERVAL_MS = 1000;
const MAX_INITIAL_POINTS = 16500;
const DEFAULT_POINT_COLOR = "#8ea8ff";
const HOVER_POINT_COLOR = "#d5f5ff";

export default function App() {
  const globeRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const cameraManagerRef = useRef<CameraManager | null>(null);
  const earthVisualsRef = useRef<EarthVisualController | null>(null);
  const satelliteModelsRef = useRef<SatelliteModelManager | null>(null);
  const collectionRef = useRef<PointPrimitiveCollection | null>(null);
  const pointsByNoradRef = useRef(new Map<number, PointPrimitive>());
  const satellitesByNoradRef = useRef(new Map<number, SatelliteRuntime>());
  const satellitesRef = useRef<SatelliteRuntime[]>([]);
  const orbitEntityRef = useRef<Entity | null>(null);
  const observerEntityRef = useRef<Entity | null>(null);
  const selectedIdRef = useRef<number | null>(null);
  const hoveredIdRef = useRef<number | null>(null);
  const orbitFilterRef = useRef<OrbitFilter>("ALL");
  const appModeRef = useRef<AppMode>("MAP");
  const effectiveSdrNoradsRef = useRef(new Set<number>());
  const passModeNoradsRef = useRef(new Set<number>());

  const [satellites, setSatellites] = useState<SatelliteRuntime[]>([]);
  const [predictionRecords, setPredictionRecords] = useState<OmmRecord[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [clock, setClock] = useState(new Date());
  const [appMode, setAppMode] = useState<AppMode>("MAP");
  const [toolsOpen, setToolsOpen] = useState(false);
  const [panelVisible, setPanelVisible] = useState(false);
  const [query, setQuery] = useState("");
  const [orbitFilter, setOrbitFilter] = useState<OrbitFilter>("ALL");
  const [loadingText, setLoadingText] = useState("Загрузка орбитальных данных…");
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<string>("");
  const [earthSource, setEarthSource] = useState("Инициализация…");
  const [modelStatus, setModelStatus] = useState<SatelliteModelStatus | null>(null);

  const observerSystem = useObserverPasses(predictionRecords);
  const sdrSystem = useSdrData();

  const selected = useMemo(
    () => satellites.find((sat) => sat.noradId === selectedId) ?? null,
    [satellites, selectedId]
  );

  const hovered = useMemo(
    () => satellites.find((sat) => sat.noradId === hoveredId) ?? null,
    [satellites, hoveredId]
  );

  const activePassNorads = useMemo(() => {
    const nowMs = clock.getTime();
    return new Set(
      observerSystem.passes
        .filter((pass) => nowMs >= pass.aosMs && nowMs <= pass.losMs)
        .map((pass) => pass.noradId)
    );
  }, [observerSystem.passes, clock]);

  const effectiveSdrByNorad = useMemo(() => {
    if (!sdrSystem.filters.visibleNowOnly || !observerSystem.observer) {
      return sdrSystem.filteredByNorad;
    }

    const result = new Map<number, typeof sdrSystem.transmitters>();
    for (const [noradId, transmitters] of sdrSystem.filteredByNorad) {
      if (activePassNorads.has(noradId)) result.set(noradId, transmitters);
    }
    return result;
  }, [
    sdrSystem.filteredByNorad,
    sdrSystem.filters.visibleNowOnly,
    sdrSystem.transmitters,
    observerSystem.observer,
    activePassNorads,
  ]);

  const hoveredLookAngles = useMemo(() => {
    if (!hovered || !observerSystem.observer) return null;
    return computeLookAngles(hovered, observerSystem.observer, clock);
  }, [hovered, observerSystem.observer, clock]);

  const hoveredRadio = useMemo(
    () => (hovered ? effectiveSdrByNorad.get(hovered.noradId)?.[0] ?? null : null),
    [hovered, effectiveSdrByNorad]
  );

  const selectedLookAngles = useMemo(() => {
    if (!selected || !observerSystem.observer) return null;
    return computeLookAngles(selected, observerSystem.observer, clock);
  }, [selected, observerSystem.observer, clock]);

  const selectedPass = useMemo(() => {
    if (!selected) return null;
    const nowMs = clock.getTime();
    return (
      observerSystem.passes.find(
        (pass) => pass.noradId === selected.noradId && pass.losMs >= nowMs
      ) ?? null
    );
  }, [selected, observerSystem.passes, clock]);

  const orbitAllowedNorads = useMemo(() => {
    return new Set(
      satellitesRef.current
        .filter((sat) => orbitFilter === "ALL" || sat.orbitType === orbitFilter)
        .map((sat) => sat.noradId)
    );
  }, [satellites.length, orbitFilter]);

  const passModeNorads = useMemo(() => {
    return new Set(
      observerSystem.passes
        .filter((pass) => orbitAllowedNorads.has(pass.noradId))
        .map((pass) => pass.noradId)
    );
  }, [observerSystem.passes, orbitAllowedNorads]);

  const filteredPassCount = useMemo(
    () => observerSystem.passes.filter((pass) => orbitAllowedNorads.has(pass.noradId)).length,
    [observerSystem.passes, orbitAllowedNorads]
  );

  const activePassCount = useMemo(() => {
    const nowMs = clock.getTime();
    return observerSystem.passes.filter(
      (pass) =>
        orbitAllowedNorads.has(pass.noradId) &&
        nowMs >= pass.aosMs &&
        nowMs <= pass.losMs
    ).length;
  }, [observerSystem.passes, orbitAllowedNorads, clock]);

  const visibleObjectCount = useMemo(() => {
    if (appMode === "SDR") {
      let count = 0;
      for (const noradId of effectiveSdrByNorad.keys()) {
        if (orbitAllowedNorads.has(noradId)) count += 1;
      }
      return count;
    }
    if (appMode === "PASSES") return passModeNorads.size;
    return orbitAllowedNorads.size;
  }, [appMode, effectiveSdrByNorad, orbitAllowedNorads, passModeNorads]);

  const searchResults = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];

    return satellites
      .filter((sat) => {
        const haystack =
          `${sat.name} ${sat.noradId} ${sat.internationalId}`.toLowerCase();
        const modeAllowed =
          appMode === "MAP" ||
          (appMode === "SDR" && effectiveSdrByNorad.has(sat.noradId)) ||
          (appMode === "PASSES" && passModeNorads.has(sat.noradId));
        return modeAllowed && haystack.includes(normalized);
      })
      .slice(0, 8);
  }, [query, satellites, appMode, effectiveSdrByNorad, passModeNorads]);

  useEffect(() => {
    if (!globeRef.current) return;

    let destroyed = false;

    const viewer = new Viewer(globeRef.current, {
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
      baseLayer: false,
      shouldAnimate: false,
    });

    viewer.scene.globe.baseColor = Color.fromCssColorString("#07111d");
    viewer.scene.backgroundColor = Color.BLACK;

    const earthVisuals = new EarthVisualController(viewer, {
      onStatusChange: (status) => {
        if (!destroyed) setEarthSource(status.label);
      },
    });
    earthVisualsRef.current = earthVisuals;
    void earthVisuals.initialize("HIGH");

    viewer.camera.setView({
      destination: Cartesian3.fromDegrees(30, 20, 24_000_000),
    });

    viewerRef.current = viewer;

    const points = new PointPrimitiveCollection();
    viewer.scene.primitives.add(points);
    collectionRef.current = points;

    const satelliteModels = new SatelliteModelManager(viewer, {
      onStatusChange: (status) => {
        if (!destroyed) setModelStatus(status);
      },
    });
    satelliteModelsRef.current = satelliteModels;

    // The official NASA ISS model is small enough to compile in the background.
    // Preloading keeps the first ISS selection responsive while rendering no
    // additional model until the object is actually selected.
    satelliteModels.preloadByNorad(25544);

    const cameraManager = new CameraManager(viewer, {
      updateTarget: updateTrackedSatellite,
      onSatelliteClick: selectSatellite,
      onEarthFocus: clearSelectionOnly,
      onHoverSatellite: setHoveredSatellite,
    });
    cameraManagerRef.current = cameraManager;

    return () => {
      destroyed = true;
      cameraManager.destroy();
      satelliteModels.destroy();
      earthVisuals.destroy();

      if (!viewer.isDestroyed()) {
        viewer.destroy();
      }

      cameraManagerRef.current = null;
      earthVisualsRef.current = null;
      satelliteModelsRef.current = null;
      viewerRef.current = null;
      collectionRef.current = null;
      pointsByNoradRef.current.clear();
      satellitesByNoradRef.current.clear();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await loadSatellites();

        if (cancelled) return;

        setDataSource(response.source);
        setLoadingText(`Подготовка спутников: ${response.count.toLocaleString()}…`);

        const activeRecords = response.data.slice(0, MAX_INITIAL_POINTS);
        setPredictionRecords(activeRecords);

        const parsed: SatelliteRuntime[] = [];

        for (const record of activeRecords) {
          const runtime = makeRuntimeSatellite(record);
          if (runtime) parsed.push(runtime);
        }

        const now = new Date();
        const valid: SatelliteRuntime[] = [];

        for (const sat of parsed) {
          if (updateSatellite(sat, now)) valid.push(sat);
        }

        if (cancelled) return;

        satellitesRef.current = valid;
        satellitesByNoradRef.current = new Map(
          valid.map((sat) => [sat.noradId, sat])
        );
        setSatellites([...valid]);
        rebuildPointCollection(valid);
        setLoadingText("");
      } catch (cause) {
        if (cancelled) return;
        setError(
          cause instanceof Error ? cause.message : "Не удалось загрузить спутники"
        );
        setLoadingText("");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    if (observerEntityRef.current) {
      viewer.entities.remove(observerEntityRef.current);
      observerEntityRef.current = null;
    }

    const observer = observerSystem.observer;
    if (!observer) return;

    observerEntityRef.current = viewer.entities.add({
      name: "Станция наблюдателя",
      position: Cartesian3.fromDegrees(
        observer.longitudeDeg,
        observer.latitudeDeg,
        Math.max(-500, observer.altitudeM) + 20
      ),
      point: {
        pixelSize: 10,
        color: Color.fromCssColorString("#74f2b5"),
        outlineColor: Color.fromCssColorString("#06100c"),
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
  }, [observerSystem.observer]);

  useEffect(() => {
    appModeRef.current = appMode;
    effectiveSdrNoradsRef.current = new Set(effectiveSdrByNorad.keys());
    passModeNoradsRef.current = passModeNorads;
  }, [appMode, effectiveSdrByNorad, passModeNorads]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = new Date();
      setClock(now);
      earthVisualsRef.current?.setTime(now);

      for (const sat of satellitesRef.current) {
        const point = pointsByNoradRef.current.get(sat.noradId);
        if (!point) continue;

        const selectedNow = sat.noradId === selectedIdRef.current;
        const orbitAllowed = orbitFilter === "ALL" || sat.orbitType === orbitFilter;
        const modeAllowed =
          appMode === "MAP" ||
          (appMode === "SDR" && effectiveSdrByNorad.has(sat.noradId)) ||
          (appMode === "PASSES" && passModeNorads.has(sat.noradId));
        const allowed = selectedNow || (orbitAllowed && modeAllowed);

        // The tracked object belongs exclusively to CameraManager's render-frame
        // propagation loop. Never overwrite it from this 1 Hz global loop. A
        // model-backed target may also suppress its cyan PointPrimitive once
        // the camera is close enough to read the real-scale 3D asset.
        if (selectedNow) {
          point.show =
            !satelliteModelsRef.current?.isPointSuppressed(sat.noradId);
          continue;
        }

        point.show = allowed;

        const updated = updateSatellite(sat, now);
        if (!updated) continue;

        point.position = Cartesian3.fromDegrees(
          sat.longitudeDeg,
          sat.latitudeDeg,
          Math.max(0, sat.altitudeKm) * 1000
        );
      }

      // UI metrics/search only need a fresh React snapshot once per second.
      // The selected runtime object is already being mutated per-frame by the
      // camera tracking loop, so this also refreshes its panel metrics.
      setSatellites([...satellitesRef.current]);
    }, UPDATE_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [orbitFilter, appMode, effectiveSdrByNorad, passModeNorads]);

  useEffect(() => {
    orbitFilterRef.current = orbitFilter;

    for (const sat of satellitesRef.current) {
      const point = pointsByNoradRef.current.get(sat.noradId);
      if (!point) continue;

      if (sat.noradId === selectedIdRef.current) {
        point.show =
          !satelliteModelsRef.current?.isPointSuppressed(sat.noradId);
        continue;
      }

      const orbitAllowed = orbitFilter === "ALL" || sat.orbitType === orbitFilter;
      const modeAllowed =
        appMode === "MAP" ||
        (appMode === "SDR" && effectiveSdrByNorad.has(sat.noradId)) ||
        (appMode === "PASSES" && passModeNorads.has(sat.noradId));
      point.show = orbitAllowed && modeAllowed;
    }
  }, [orbitFilter, appMode, effectiveSdrByNorad, passModeNorads]);

  function rebuildPointCollection(items: SatelliteRuntime[]) {
    const collection = collectionRef.current;
    if (!collection) return;

    collection.removeAll();
    pointsByNoradRef.current.clear();

    for (const sat of items) {
      const point = collection.add({
        position: Cartesian3.fromDegrees(
          sat.longitudeDeg,
          sat.latitudeDeg,
          Math.max(0, sat.altitudeKm) * 1000
        ),
        pixelSize: 3,
        color: Color.fromCssColorString(DEFAULT_POINT_COLOR).withAlpha(0.82),
        outlineColor: Color.TRANSPARENT,
        outlineWidth: 0,
        id: sat.noradId,
      });

      pointsByNoradRef.current.set(sat.noradId, point);
    }
  }

  function updateTrackedSatellite(
    noradId: number,
    date: Date
  ): CameraTargetSample | null {
    const sat = satellitesByNoradRef.current.get(noradId);
    if (!sat) return null;

    const updated = updateSatellite(sat, date);
    if (!updated) return null;

    const altitudeMeters = Math.max(0, sat.altitudeKm) * 1000;
    const position = Cartesian3.fromDegrees(
      sat.longitudeDeg,
      sat.latitudeDeg,
      altitudeMeters
    );

    const suppressPoint =
      satelliteModelsRef.current?.updateTrackedSatellite(
        noradId,
        date,
        position
      ) ?? false;

    const point = pointsByNoradRef.current.get(noradId);
    if (point) {
      // This exact position is also returned to CameraManager and the detailed
      // model manager, guaranteeing that marker/model/camera target cannot
      // disagree within the frame.
      point.position = position;
      point.show = !suppressPoint;
    }

    return {
      position,
      altitudeMeters,
      label: sat.name,
      preferredInitialRangeMeters:
        getPreferredModelCameraRangeMeters(noradId),
    };
  }

  function selectSatellite(noradId: number) {
    const sat = satellitesByNoradRef.current.get(noradId);
    if (!sat) return;

    const previousId = selectedIdRef.current;
    selectedIdRef.current = noradId;

    if (previousId !== null && previousId !== noradId) {
      refreshPointStyle(previousId);
    }

    setSelectedId(noradId);
    setPanelVisible(true);
    setToolsOpen(false);
    refreshPointStyle(noradId);
    drawOrbit(sat);

    satelliteModelsRef.current?.selectSatellite(noradId);
    cameraManagerRef.current?.focusSatellite(noradId);
  }

  function setHoveredSatellite(noradId: number | null) {
    const previousId = hoveredIdRef.current;
    hoveredIdRef.current = noradId;
    setHoveredId(noradId);

    if (previousId !== null && previousId !== noradId) {
      refreshPointStyle(previousId);
    }

    if (noradId !== null) {
      refreshPointStyle(noradId);
    }
  }

  function refreshPointStyle(noradId: number) {
    const point = pointsByNoradRef.current.get(noradId);
    if (!point) return;

    if (selectedIdRef.current === noradId) {
      point.pixelSize = 10;
      point.color = Color.CYAN;
      return;
    }

    if (hoveredIdRef.current === noradId) {
      point.pixelSize = 7;
      point.color = Color.fromCssColorString(HOVER_POINT_COLOR).withAlpha(0.96);
      return;
    }

    point.pixelSize = 3;
    point.color = Color.fromCssColorString(DEFAULT_POINT_COLOR).withAlpha(0.82);
  }

  function drawOrbit(sat: SatelliteRuntime) {
    const viewer = viewerRef.current;
    if (!viewer) return;

    if (orbitEntityRef.current) {
      viewer.entities.remove(orbitEntityRef.current);
      orbitEntityRef.current = null;
    }

    const positions: Cartesian3[] = [];

    for (const date of orbitSampleDates(sat, new Date(), 220)) {
      const pv = satellite.propagate(sat.satrec, date);

      if (!pv) continue;

      const gmst = satellite.gstime(date);
      const geodetic = satellite.eciToGeodetic(pv.position, gmst);

      positions.push(
        Cartesian3.fromRadians(
          geodetic.longitude,
          geodetic.latitude,
          Math.max(0, geodetic.height) * 1000,
          Ellipsoid.WGS84
        )
      );
    }

    if (positions.length < 2) return;

    orbitEntityRef.current = viewer.entities.add({
      polyline: {
        positions,
        width: 1.6,
        material: Color.CYAN.withAlpha(0.72),
      },
    });
  }

  function clearSelectionOnly() {
    const previousId = selectedIdRef.current;

    satelliteModelsRef.current?.clearSelection();
    selectedIdRef.current = null;
    setSelectedId(null);

    if (previousId !== null) {
      refreshPointStyle(previousId);

      const previousSat = satellitesByNoradRef.current.get(previousId);
      const previousPoint = pointsByNoradRef.current.get(previousId);
      if (previousSat && previousPoint) {
        const filter = orbitFilterRef.current;
        const orbitAllowed = filter === "ALL" || previousSat.orbitType === filter;
        const mode = appModeRef.current;
        const modeAllowed =
          mode === "MAP" ||
          (mode === "SDR" && effectiveSdrNoradsRef.current.has(previousId)) ||
          (mode === "PASSES" && passModeNoradsRef.current.has(previousId));
        previousPoint.show = orbitAllowed && modeAllowed;
      }
    }

    const viewer = viewerRef.current;
    if (viewer && orbitEntityRef.current) {
      viewer.entities.remove(orbitEntityRef.current);
      orbitEntityRef.current = null;
    }
  }

  function closePanel() {
    setPanelVisible(false);
  }

  function releaseTracking() {
    // CameraManager owns the EARTH transition and calls onEarthFocus exactly
    // once, which clears selection/orbit through clearSelectionOnly().
    cameraManagerRef.current?.focusEarth();
  }

  return (
    <main className={`app-shell ${appMode.toLowerCase()}-mode`}>
      <div ref={globeRef} className="globe" />

      <header className="topbar">
        <div className="brand" aria-label="SatGeoTracker">
          <span className="brand-name">SatGeoTracker</span>
          <span className="brand-version">v0.8.5</span>
        </div>

        <nav className="mode-switch" aria-label="Режим работы">
          {(["MAP", "SDR", "PASSES"] as AppMode[]).map((mode) => (
            <button
              key={mode}
              className={appMode === mode ? "active" : ""}
              onClick={() => {
                setAppMode(mode);
                setToolsOpen(false);
                setQuery("");
              }}
            >
              {modeLabel(mode)}
            </button>
          ))}
        </nav>

        <div className="search-wrap">
          <span className="search-icon" aria-hidden="true">⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              appMode === "SDR"
                ? "Поиск спутника с радиоканалом…"
                : appMode === "PASSES"
                  ? "Поиск ближайшего пролёта…"
                  : "Поиск по имени, NORAD или ID…"
            }
          />

          {searchResults.length > 0 && (
            <div className="search-results surface-card">
              {searchResults.map((sat) => (
                <button
                  key={sat.noradId}
                  onClick={() => {
                    selectSatellite(sat.noradId);
                    setQuery("");
                  }}
                >
                  <span>{sat.name}</span>
                  <small>
                    NORAD {sat.noradId} · {sat.orbitType}
                  </small>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="topbar-actions">
          <button
            className={`shell-button ${toolsOpen ? "active" : ""}`}
            onClick={() => {
              const next = !toolsOpen;
              setToolsOpen(next);
              if (next) setPanelVisible(false);
            }}
            aria-expanded={toolsOpen}
            aria-haspopup="dialog"
          >
            ИНСТРУМЕНТЫ
          </button>
          <button
            className={`shell-button ${panelVisible ? "active" : ""}`}
            onClick={() => {
              const next = !panelVisible;
              setPanelVisible(next);
              if (next) setToolsOpen(false);
            }}
            aria-expanded={panelVisible}
            title="Показать или скрыть рабочую панель"
          >
            ПАНЕЛЬ
          </button>

        {toolsOpen && (
          <section className="tools-menu surface-card">
            <div className="tools-menu-head">
              <div>
                <span className="tool-kicker">{modeLabel(appMode)} · РАБОЧАЯ ОБЛАСТЬ</span>
                <strong>{modeLabel(appMode)} · ИНСТРУМЕНТЫ</strong>
              </div>
              <button className="icon-button" onClick={() => setToolsOpen(false)} aria-label="Закрыть инструменты">
                ×
              </button>
            </div>
        
            {appMode === "SDR" && (
              <div className="tools-section embedded-tool mode-primary-tool">
                <SdrFilterPanel
                  system={sdrSystem}
                  observerAvailable={Boolean(observerSystem.observer)}
                />
              </div>
            )}
        
            <div className="tools-section">
              <span className="tools-section-label">
                {appMode === "PASSES" ? "ФИЛЬТР ОРБИТ ПРОЛЁТОВ" : "ФИЛЬТР ОРБИТЫ"}
              </span>
              <div className="filters tools-filters">
                {(["ALL", "LEO", "MEO", "GEO"] as OrbitFilter[]).map((filter) => (
                  <button
                    key={filter}
                    className={orbitFilter === filter ? "active" : ""}
                    onClick={() => {
                      setOrbitFilter(filter);
                      setToolsOpen(false);
                    }}
                  >
                    {orbitFilterLabel(filter)}
                  </button>
                ))}
              </div>
            </div>
        
            <div className="tools-section embedded-tool">
              <ObserverPanel system={observerSystem} />
            </div>
        
          </section>
        )}
        </div>

        <div className="live-block">
          <span className="live-dot" />
          <div>
            <strong>UTC · СЕЙЧАС</strong>
            <span>{formatUtc(clock)}</span>
          </div>
        </div>
      </header>

      {appMode === "PASSES" && observerSystem.observer && (
        <PassStrip
          system={observerSystem}
          now={clock}
          onSelectSatellite={selectSatellite}
          sdrMode={false}
          radioByNorad={effectiveSdrByNorad}
          allowedNorads={orbitAllowedNorads}
        />
      )}

      {appMode === "SDR" && observerSystem.observer && (
        <PassStrip
          system={observerSystem}
          now={clock}
          onSelectSatellite={selectSatellite}
          sdrMode
          radioByNorad={effectiveSdrByNorad}
          allowedNorads={orbitAllowedNorads}
        />
      )}

      {appMode === "PASSES" && !observerSystem.observer && (
        <section className="passes-setup surface-card">
          <span className="tool-kicker">РАСЧЁТ ПРОЛЁТОВ</span>
          <strong>Нужно задать наблюдателя</strong>
          <p>Задайте координаты станции в ИНСТРУМЕНТАХ, чтобы рассчитывать и отображать пролёты.</p>
          <button className="shell-button" onClick={() => { setPanelVisible(false); setToolsOpen(true); }}>ОТКРЫТЬ ИНСТРУМЕНТЫ</button>
        </section>
      )}

      {appMode === "SDR" && hovered && hoveredRadio && hovered.noradId !== selectedId && (
        <div className="sdr-hover-card surface-card">
          <span className="tool-kicker">SDR · ЦЕЛЬ</span>
          <strong>{hovered.name}</strong>
          <div className="sdr-hover-frequency">
            {formatFrequency(transmitterFrequencyHz(hoveredRadio))}
          </div>
          <div className="sdr-hover-meta">
            <span>{hoveredRadio.mode || "—"}</span>
            <span>{hoveredRadio.service || "Сервис не указан"}</span>
            {hoveredLookAngles && (
              <span>{hoveredLookAngles.elevationDeg.toFixed(1)}° EL</span>
            )}
          </div>
        </div>
      )}

      {(loadingText || error) && (
        <div className={`loading surface-card ${error ? "error" : ""}`}>
          <div className="loading-orb" />
          <div>
            <strong>{error ? "ОШИБКА ДАННЫХ" : "ЗАПУСК SGT"}</strong>
            <span>{error || loadingText}</span>
          </div>
        </div>
      )}

      <aside className={`sat-panel surface-card ${panelVisible ? "open" : ""}`}>
        {selected ? (
          <>
            <div className="panel-actions">
              <button className="panel-action" onClick={releaseTracking} title="Завершить слежение">
                ЗЕМЛЯ
              </button>
              <button className="close-btn" onClick={closePanel} aria-label="Скрыть панель">
                ×
              </button>
            </div>

            <div className="eyebrow">
              {appMode === "SDR"
                ? "SDR ЦЕЛЬ · СЛЕЖЕНИЕ"
                : appMode === "PASSES"
                  ? "ЦЕЛЬ ПРОЛЁТА · СЛЕЖЕНИЕ"
                  : "ВЫБРАННЫЙ ОБЪЕКТ · СЛЕЖЕНИЕ"}
            </div>
            <h1>{selected.name}</h1>
            <div className="orbit-pill">{selected.orbitType}</div>

            {modelStatus?.noradId === selected.noradId && (
              <div className={`model-status ${modelStatus.state.toLowerCase()}`}>
                <span>3D МОДЕЛЬ</span>
                <strong>
                  {modelStatus.state === "READY"
                    ? `NASA · реальный масштаб ${modelStatus.physicalSpanMeters} м`
                    : modelStatus.state === "LOADING"
                      ? "NASA · загрузка…"
                      : `Точка вместо модели · ${modelStatus.message ?? "3D-модель недоступна"}`}
                </strong>
              </div>
            )}

            <div className="telemetry-strip primary-telemetry">
              <Telemetry label="ВЫСОТА" value={`${selected.altitudeKm.toFixed(1)} км`} />
              <Telemetry label="СКОРОСТЬ" value={`${selected.speedKmS.toFixed(3)} км/с`} />
            </div>

            {appMode === "SDR" && (
              <>
                <div className="mode-context-card">
                  <span>РАДИО-КОНТЕКСТ</span>
                  <strong>
                    {formatChannelCount((effectiveSdrByNorad.get(selected.noradId) ?? []).length)}
                  </strong>
                  <small>
                    {observerSystem.observer
                      ? "Наблюдатель задан · коррекция Доплера включена"
                      : "Задайте наблюдателя в ИНСТРУМЕНТАХ для расчёта Доплера"}
                  </small>
                </div>
                <SdrRadioPanel
                  satellite={selected}
                  transmitters={effectiveSdrByNorad.get(selected.noradId) ?? []}
                  observer={observerSystem.observer}
                  now={clock}
                />
              </>
            )}

            {appMode === "PASSES" && (
              <div className="mode-context-card">
                <span>ПРОЛЁТ</span>
                <strong>
                  {selectedPass ? formatPassSummary(selectedPass, clock) : "Нет пролёта в текущем горизонте"}
                </strong>
                <small>
                  {selectedPass
                    ? `Макс. высота ${selectedPass.maxElevationDeg.toFixed(1)}° · ${formatUtcTime(selectedPass.aosMs)}–${formatUtcTime(selectedPass.losMs)} UTC`
                    : `Горизонт прогноза ${observerSystem.horizonMinutes} мин`}
                </small>
              </div>
            )}

            {observerSystem.observer && selectedLookAngles && (
              <div className="observer-geometry">
                <div className="section-heading">
                  <span>ГЕОМЕТРИЯ НАБЛЮДАТЕЛЯ</span>
                  <strong>СЕЙЧАС</strong>
                </div>
                <div className="telemetry-strip geometry-telemetry">
                  <Telemetry label="УГОЛ" value={`${selectedLookAngles.elevationDeg.toFixed(1)}°`} />
                  <Telemetry label="АЗИМУТ" value={`${selectedLookAngles.azimuthDeg.toFixed(0)}° ${cardinalDirection(selectedLookAngles.azimuthDeg)}`} />
                  <Telemetry label="ДАЛЬН." value={`${selectedLookAngles.rangeKm.toFixed(0)} км`} />
                </div>
                <div className="details compact">
                  <Detail
                    label="Видимость"
                    value={
                      selectedLookAngles.elevationDeg >= observerSystem.minElevationDeg
                        ? `ВЫШЕ ${observerSystem.minElevationDeg}°`
                        : `НИЖЕ ${observerSystem.minElevationDeg}°`
                    }
                  />
                  <Detail
                    label="Ближайший пролёт"
                    value={selectedPass ? formatPassSummary(selectedPass, clock) : `Нет в ближайшие ${observerSystem.horizonMinutes} мин`}
                  />
                  {selectedPass && (
                    <Detail
                      label="Макс. высота"
                      value={`${selectedPass.maxElevationDeg.toFixed(1)}°`}
                    />
                  )}
                </div>
              </div>
            )}

            <details className="technical-details">
              <summary>ТЕХНИЧЕСКИЕ ДАННЫЕ</summary>
              <div className="details">
                <Detail label="NORAD ID" value={String(selected.noradId)} />
                <Detail label="Международный ID" value={selected.internationalId} />
                <Detail label="Широта" value={`${selected.latitudeDeg.toFixed(3)}°`} />
                <Detail label="Долгота" value={`${selected.longitudeDeg.toFixed(3)}°`} />
                <Detail label="Эпоха орбиты" value={formatEpoch(selected.omm.EPOCH)} />
              </div>
            </details>
          </>
        ) : (
          <>
            <div className="panel-actions">
              <button className="close-btn" onClick={closePanel} aria-label="Скрыть панель">
                ×
              </button>
            </div>
            <div className="workspace-overview">
              <div className="eyebrow">{modeLabel(appMode)} · РАБОЧАЯ ОБЛАСТЬ</div>
              <h1>
                {appMode === "SDR"
                  ? "Радиоцели"
                  : appMode === "PASSES"
                    ? "Планировщик пролётов"
                    : "Орбитальная карта"}
              </h1>
              <p className="workspace-copy">
                {appMode === "SDR"
                  ? "Карта и поиск показывают спутники, подходящие под активные SDR-фильтры."
                  : appMode === "PASSES"
                    ? "Карта и поиск показывают спутники с рассчитанными пролётами в текущем горизонте наблюдения."
                    : "Просматривайте орбитальный каталог, фильтруйте классы орбит и выбирайте объект для слежения."}
              </p>

              <div className="metric-grid workspace-metrics">
                <Metric label="Каталог" value={satellites.length.toLocaleString()} />
                <Metric label="На карте" value={visibleObjectCount.toLocaleString()} />
              </div>

              <div className="details workspace-details">
                <Detail label="Фильтр орбиты" value={orbitFilterLabel(orbitFilter)} />
                {appMode === "SDR" && (
                  <>
                    <Detail label="Спутники с радио" value={effectiveSdrByNorad.size.toLocaleString()} />
                    <Detail label="Каталог SDR" value={sdrStateLabel(sdrSystem.state)} />
                  </>
                )}
                {appMode === "PASSES" && (
                  <>
                    <Detail label="Рассчитано пролётов" value={filteredPassCount.toLocaleString()} />
                    <Detail label="Активны сейчас" value={activePassCount.toLocaleString()} />
                  </>
                )}
                <Detail
                  label="Наблюдатель"
                  value={observerSystem.observer ? `МАСКА ${observerSystem.minElevationDeg}°` : "НЕ ЗАДАН"}
                />
              </div>

              {(appMode === "PASSES" && !observerSystem.observer) || appMode === "SDR" ? (
                <button className="panel-primary-button" onClick={() => { setPanelVisible(false); setToolsOpen(true); }}>
                  {appMode === "SDR" ? "ОТКРЫТЬ SDR-ИНСТРУМЕНТЫ" : "ОТКРЫТЬ ИНСТРУМЕНТЫ ПРОЛЁТОВ"}
                </button>
              ) : null}
            </div>
          </>
        )}
      </aside>

      <div className="footer-caption">
        SGP4 / OMM · CAMERA v0.4.2 · EARTH v0.5.7 · MODEL v0.6.2 · OBSERVER v0.7.0 · SDR v0.8.0 · SHELL v0.8.4
      </div>
    </main>
  );

}

function Telemetry({ label, value }: { label: string; value: string }) {
  return (
    <div className="telemetry-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function modeLabel(mode: AppMode): string {
  if (mode === "MAP") return "КАРТА";
  if (mode === "PASSES") return "ПРОЛЁТЫ";
  return "SDR";
}

function orbitFilterLabel(filter: OrbitFilter): string {
  return filter === "ALL" ? "ВСЕ" : filter;
}

function sdrStateLabel(state: string): string {
  if (state === "ready") return "ГОТОВ";
  if (state === "loading") return "ЗАГРУЗКА";
  if (state === "error") return "ОШИБКА";
  return "ОЖИДАНИЕ";
}

function formatChannelCount(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  const word = mod10 === 1 && mod100 !== 11
    ? "подходящий канал"
    : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
      ? "подходящих канала"
      : "подходящих каналов";
  return `${count} ${word}`;
}

function formatUtc(date: Date) {
  return date.toISOString().replace("T", " ").replace("Z", "").slice(0, 19);
}

function formatPassSummary(
  pass: { aosMs: number; losMs: number; startsBeforeWindow: boolean },
  now: Date
) {
  const nowMs = now.getTime();
  if (nowMs >= pass.aosMs && nowMs <= pass.losMs) {
    const remaining = Math.max(0, Math.ceil((pass.losMs - nowMs) / 60_000));
    return `СЕЙЧАС · осталось ${remaining} мин`;
  }

  const minutes = Math.max(0, Math.ceil((pass.aosMs - nowMs) / 60_000));
  return `${formatUtcTime(pass.aosMs)} UTC · через ${minutes} мин`;
}

function formatUtcTime(timeMs: number) {
  return new Date(timeMs).toISOString().slice(11, 16);
}

function formatEpoch(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toISOString().replace("T", " ").replace("Z", " UTC");
}
