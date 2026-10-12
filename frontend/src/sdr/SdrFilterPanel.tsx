import type { SdrDataSystem } from "./useSdrData";
import type { SdrBand } from "./sdrTypes";

interface SdrFilterPanelProps {
  system: SdrDataSystem;
  observerAvailable: boolean;
}

const BANDS: SdrBand[] = ["ALL", "VHF", "UHF", "L", "S", "X"];

export function SdrFilterPanel({ system, observerAvailable }: SdrFilterPanelProps) {
  return (
    <section className="sdr-filter-panel glass">
      <div className="sdr-filter-heading">
        <div>
          <span className="tool-kicker">ФИЛЬТРЫ SDR</span>
          <strong>{system.state === "ready" ? system.message : "Каталог радиоканалов"}</strong>
        </div>
        <span className={`sdr-state-dot ${system.state}`} />
      </div>

      <div className="sdr-band-grid">
        {BANDS.map((band) => (
          <button
            key={band}
            className={system.filters.band === band ? "active" : ""}
            onClick={() => system.setFilters((value) => ({ ...value, band }))}
          >
            {band === "ALL" ? "ВСЕ" : band}
          </button>
        ))}
      </div>

      <div className="sdr-select-grid">
        <label>
          <span>РЕЖИМ</span>
          <select
            value={system.filters.mode}
            onChange={(event) =>
              system.setFilters((value) => ({ ...value, mode: event.target.value }))
            }
          >
            <option value="ALL">ВСЕ</option>
            {system.modes.map((mode) => (
              <option key={mode} value={mode}>{mode}</option>
            ))}
          </select>
        </label>

        <label>
          <span>СЕРВИС</span>
          <select
            value={system.filters.service}
            onChange={(event) =>
              system.setFilters((value) => ({ ...value, service: event.target.value }))
            }
          >
            <option value="ALL">ВСЕ</option>
            {system.services.map((service) => (
              <option key={service} value={service}>{service}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="sdr-toggle-row">
        <input
          type="checkbox"
          checked={system.filters.activeOnly}
          onChange={(event) =>
            system.setFilters((value) => ({ ...value, activeOnly: event.target.checked }))
          }
        />
        <span>ТОЛЬКО АКТИВНЫЕ ПЕРЕДАТЧИКИ</span>
      </label>

      <label className={`sdr-toggle-row ${observerAvailable ? "" : "disabled"}`}>
        <input
          type="checkbox"
          checked={system.filters.visibleNowOnly}
          disabled={!observerAvailable}
          onChange={(event) =>
            system.setFilters((value) => ({ ...value, visibleNowOnly: event.target.checked }))
          }
        />
        <span>СЕЙЧАС ВЫШЕ МАСКИ НАБЛЮДАТЕЛЯ</span>
      </label>

      <div className="sdr-filter-footer">
        <span>{system.source ? `ИСТОЧНИК · ${system.source.toUpperCase()}` : system.message}</span>
        <button onClick={system.refresh} title="Обновить каталог SDR">↻</button>
      </div>
    </section>
  );
}
