import { useEffect, useState, type ChangeEvent } from "react";

import type { ObserverPassSystem } from "./useObserverPasses";

interface ObserverPanelProps {
  system: ObserverPassSystem;
}

export function ObserverPanel({ system }: ObserverPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [altitude, setAltitude] = useState("0");
  const [manualError, setManualError] = useState("");

  useEffect(() => {
    if (!system.observer) return;
    setLatitude(system.observer.latitudeDeg.toFixed(6));
    setLongitude(system.observer.longitudeDeg.toFixed(6));
    setAltitude(system.observer.altitudeM.toFixed(0));
  }, [system.observer]);

  const applyManual = () => {
    if (!latitude.trim() || !longitude.trim()) {
      setManualError("Укажите широту и долготу");
      return;
    }

    const error = system.setManualLocation(
      Number(latitude.replace(",", ".")),
      Number(longitude.replace(",", ".")),
      altitude.trim() ? Number(altitude.replace(",", ".")) : 0
    );

    setManualError(error ?? "");
    if (!error) setExpanded(false);
  };

  return (
    <section className="observer-panel glass">
      <div className="observer-heading">
        <div>
          <span className="tool-kicker">НАБЛЮДАТЕЛЬ</span>
          <strong>{system.observer ? "Станция активна" : "Нужны координаты"}</strong>
        </div>
        <span className={`observer-state-dot ${system.observer ? "active" : ""}`} />
      </div>

      {system.observer ? (
        <>
          <button
            className="observer-coordinates"
            onClick={() => setExpanded((value) => !value)}
            title="Изменить координаты наблюдателя"
          >
            <span>
              {system.observer.latitudeDeg.toFixed(4)}° · {system.observer.longitudeDeg.toFixed(4)}°
            </span>
            <small>
              {system.observer.altitudeM.toFixed(0)} м · {sourceLabel(system.observer.source)}
            </small>
          </button>

          <div className="elevation-filter">
            <span>МИН. УГОЛ</span>
            <div>
              {[5, 10, 20, 30].map((value) => (
                <button
                  key={value}
                  className={system.minElevationDeg === value ? "active" : ""}
                  onClick={() => system.setMinimumElevation(value)}
                >
                  {value}°
                </button>
              ))}
            </div>
          </div>

          <div className="observer-actions">
            <button onClick={system.requestDeviceLocation}>ОБНОВИТЬ КООРД.</button>
            <button onClick={() => setExpanded((value) => !value)}>ВРУЧНУЮ</button>
          </div>
        </>
      ) : (
        <>
          <p className="observer-copy">
            Нужен для азимута, высоты над горизонтом, дальности и прогноза пролётов.
          </p>
          <div className="observer-actions primary">
            <button onClick={system.requestDeviceLocation}>ГЕОЛОКАЦИЯ</button>
            <button onClick={() => setExpanded((value) => !value)}>ВРУЧНУЮ</button>
          </div>
        </>
      )}

      {system.locationMessage && (
        <div className="observer-message">{system.locationMessage}</div>
      )}

      {expanded && (
        <div className="manual-location-form">
          <label>
            <span>ШИРОТА</span>
            <input
              inputMode="decimal"
              value={latitude}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setLatitude(event.target.value)}
              placeholder="61.2540"
            />
          </label>
          <label>
            <span>ДОЛГОТА</span>
            <input
              inputMode="decimal"
              value={longitude}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setLongitude(event.target.value)}
              placeholder="73.3962"
            />
          </label>
          <label className="altitude-field">
            <span>ВЫСОТА, М</span>
            <input
              inputMode="decimal"
              value={altitude}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setAltitude(event.target.value)}
              placeholder="0"
            />
          </label>
          {manualError && <div className="manual-location-error">{manualError}</div>}
          <div className="manual-location-buttons">
            <button onClick={applyManual}>ПРИМЕНИТЬ</button>
            {system.observer && (
              <button className="danger" onClick={system.clearObserver}>
                ОЧИСТИТЬ
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function sourceLabel(source: "browser" | "manual" | "saved") {
  if (source === "browser") return "УСТРОЙСТВО";
  if (source === "manual") return "ВРУЧНУЮ";
  return "СОХРАНЕНО";
}
