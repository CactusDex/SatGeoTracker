import { useEffect, useMemo, useState } from "react";

import { cardinalDirection } from "./observerMath";
import type { SatellitePass } from "./observerTypes";
import type { ObserverPassSystem } from "./useObserverPasses";
import type { SdrTransmitter } from "../sdr";
import { formatFrequency, transmitterFrequencyHz } from "../sdr";

interface PassStripProps {
  system: ObserverPassSystem;
  now: Date;
  onSelectSatellite: (noradId: number) => void;
  sdrMode?: boolean;
  radioByNorad?: Map<number, SdrTransmitter[]>;
  allowedNorads?: Set<number>;
}

const DISPLAY_STEP = 20;

export function PassStrip({
  system,
  now,
  onSelectSatellite,
  sdrMode = false,
  radioByNorad,
  allowedNorads,
}: PassStripProps) {
  const [displayLimit, setDisplayLimit] = useState(DISPLAY_STEP);
  const [expanded, setExpanded] = useState(false);

  const passes = useMemo(() => {
    return system.passes.filter((pass) => {
      if (allowedNorads && !allowedNorads.has(pass.noradId)) return false;
      if (sdrMode && radioByNorad && !radioByNorad.has(pass.noradId)) return false;
      return true;
    });
  }, [system.passes, sdrMode, radioByNorad, allowedNorads]);

  useEffect(() => {
    setDisplayLimit(DISPLAY_STEP);
  }, [passes]);

  const visiblePasses = useMemo(
    () => passes.slice(0, displayLimit),
    [passes, displayLimit]
  );

  if (!system.observer) return null;

  return (
    <section className={`pass-strip glass ${sdrMode ? "sdr-mode" : ""} ${expanded ? "expanded" : "collapsed"}`}>
      <div className="pass-strip-head">
        <div className="pass-strip-title">
          <span className="tool-kicker">БЛИЖАЙШИЕ {system.horizonMinutes} МИН</span>
          <strong>{sdrMode ? "РАДИОПРОЛЁТЫ" : "БЛИЖАЙШИЕ ПРОЛЁТЫ"}</strong>
          <span className="pass-count">{passes.length.toLocaleString()}</span>
        </div>
        <div className="pass-strip-meta">
          <span className={`prediction-state ${system.predictionState}`}>
            {sdrMode && system.predictionState === "ready"
              ? `${passes.length.toLocaleString()} радиопролётов`
              : system.predictionMessage}
          </span>
          <button onClick={system.refreshPasses} title="Пересчитать пролёты" aria-label="Пересчитать пролёты">
            ↻
          </button>
          <button
            className="pass-expand-button"
            onClick={() => setExpanded((value) => !value)}
            title={expanded ? "Свернуть список пролётов" : "Развернуть список пролётов"}
            aria-label={expanded ? "Свернуть список пролётов" : "Развернуть список пролётов"}
            aria-expanded={expanded}
          >
            {expanded ? "⌄" : "⌃"}
          </button>
        </div>
      </div>

      {system.predictionState === "calculating" && system.passes.length === 0 ? (
        <div className="pass-empty">Расчёт пролётов в зоне видимости…</div>
      ) : passes.length === 0 ? (
        <div className="pass-empty">
          {sdrMode
            ? `Нет подходящих радиопролётов выше ${system.minElevationDeg}° в ближайшие ${system.horizonMinutes} мин.`
            : `Нет пролётов выше ${system.minElevationDeg}° в ближайшие ${system.horizonMinutes} мин.`}
        </div>
      ) : (
        <div className="pass-cards">
          {visiblePasses.map((pass) => (
            <PassCard
              key={`${pass.noradId}-${pass.aosMs}`}
              pass={pass}
              nowMs={now.getTime()}
              onSelect={() => onSelectSatellite(pass.noradId)}
              transmitter={sdrMode ? radioByNorad?.get(pass.noradId)?.[0] : undefined}
              expanded={expanded}
            />
          ))}

          {displayLimit < passes.length && (
            <button
              className="pass-more"
              onClick={() =>
                setDisplayLimit((value) => Math.min(passes.length, value + DISPLAY_STEP))
              }
            >
              <strong>+{Math.min(DISPLAY_STEP, passes.length - displayLimit)}</strong>
              <span>ещё {passes.length - displayLimit}</span>
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function PassCard({
  pass,
  nowMs,
  onSelect,
  transmitter,
  expanded,
}: {
  pass: SatellitePass;
  nowMs: number;
  onSelect: () => void;
  transmitter?: SdrTransmitter;
  expanded: boolean;
}) {
  const active = nowMs >= pass.aosMs && nowMs <= pass.losMs;
  const untilAosMinutes = Math.max(0, Math.ceil((pass.aosMs - nowMs) / 60_000));
  const remainingMinutes = Math.max(0, Math.ceil((pass.losMs - nowMs) / 60_000));

  return (
    <button className={`pass-card ${active ? "active" : ""}`} onClick={onSelect}>
      <div className="pass-card-top">
        <span>{active ? "СЕЙЧАС" : `+${untilAosMinutes} МИН`}</span>
        {expanded && <small>NORAD {pass.noradId}</small>}
      </div>
      <div className="pass-card-mainline">
        <strong title={pass.name}>{pass.name}</strong>
        <span>МАКС {pass.maxElevationDeg.toFixed(0)}°</span>
        <span>{active ? `ОСТ. ${remainingMinutes} МИН` : formatTime(pass.aosMs)}</span>
      </div>
      {expanded && (
        <>
          {transmitter && (
            <div className="pass-radio-line">
              <b>{formatFrequency(transmitterFrequencyHz(transmitter))}</b>
              <span>{transmitter.mode || "—"}</span>
            </div>
          )}
          <div className="pass-card-data">
            <span>
              АЗ <b>{cardinalDirection(pass.azimuthAtTcaDeg)} {pass.azimuthAtTcaDeg.toFixed(0)}°</b>
            </span>
            <span>
              UTC <b>{formatTime(pass.aosMs)}–{formatTime(pass.losMs)}</b>
            </span>
          </div>
        </>
      )}
    </button>
  );
}

function formatTime(timeMs: number) {
  return new Date(timeMs).toISOString().slice(11, 16);
}
