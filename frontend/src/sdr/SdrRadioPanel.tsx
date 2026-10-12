import type { SatelliteRuntime } from "../types";
import type { ObserverLocation } from "../observer";
import { computeDoppler, formatFrequency, frequencyBand, transmitterFrequencyHz } from "./sdrMath";
import type { SdrTransmitter } from "./sdrTypes";

interface SdrRadioPanelProps {
  satellite: SatelliteRuntime;
  transmitters: SdrTransmitter[];
  observer: ObserverLocation | null;
  now: Date;
}

export function SdrRadioPanel({ satellite, transmitters, observer, now }: SdrRadioPanelProps) {
  if (transmitters.length === 0) {
    return (
      <section className="radio-panel">
        <div className="section-heading">
          <span>SDR / РАДИО</span>
          <strong>НЕТ ПОДХОДЯЩЕГО КАНАЛА</strong>
        </div>
      </section>
    );
  }

  return (
    <section className="radio-panel">
      <div className="section-heading">
        <span>SDR / РАДИО</span>
        <strong>{formatLinkCount(transmitters.length)}</strong>
      </div>
      <div className="radio-list">
        {transmitters.slice(0, 8).map((tx) => {
          const carrierHz = transmitterFrequencyHz(tx);
          const doppler = observer && carrierHz
            ? computeDoppler(satellite, observer, now, carrierHz)
            : null;
          return (
            <div className="radio-card" key={tx.uuid}>
              <div className="radio-card-head">
                <strong>{formatFrequency(carrierHz)}</strong>
                <span>{frequencyBand(carrierHz)}</span>
              </div>
              <div className="radio-card-sub">
                <span>{tx.mode || "РЕЖИМ НЕИЗВЕСТЕН"}</span>
                <span>{tx.service || "Сервис не указан"}</span>
                <span className={String(tx.status).toLowerCase() === "active" ? "active" : ""}>
                  {formatStatus(tx.status)}
                </span>
              </div>
              {tx.description && <p>{tx.description}</p>}
              <div className="radio-card-data">
                <span>ТИП <b>{tx.type || "—"}</b></span>
                <span>БОД <b>{tx.baud ? Math.round(tx.baud).toLocaleString() : "—"}</b></span>
              </div>
              {doppler && (
                <div className="doppler-readout">
                  <div>
                    <span>RX СЕЙЧАС</span>
                    <strong>{formatFrequency(doppler.receiveHz)}</strong>
                  </div>
                  <div>
                    <span>ДОПЛЕР</span>
                    <strong>{formatSignedHz(doppler.shiftHz)}</strong>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function formatLinkCount(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  const word = mod10 === 1 && mod100 !== 11
    ? "КАНАЛ"
    : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
      ? "КАНАЛА"
      : "КАНАЛОВ";
  return `${count} ${word}`;
}

function formatStatus(status: string | null | undefined): string {
  const value = String(status ?? "").toLowerCase();
  if (value === "active") return "активен";
  if (value === "inactive") return "неактивен";
  if (value === "invalid") return "некорректен";
  return status || "неизвестно";
}

function formatSignedHz(value: number): string {
  const sign = value >= 0 ? "+" : "−";
  const abs = Math.abs(value);
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(2)} kHz`;
  return `${sign}${abs.toFixed(0)} Hz`;
}
