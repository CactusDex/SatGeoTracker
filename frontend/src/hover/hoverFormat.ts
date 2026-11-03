/** Numeric hover telemetry has a neutral fallback for invalid samples. */
export function formatHoverAltitude(km: number): string {
  return Number.isFinite(km) && km >= 0 ? `${km.toFixed(1)} км` : "—";
}

export function formatHoverSpeed(kmS: number): string {
  return Number.isFinite(kmS) && kmS >= 0 ? `${kmS.toFixed(3)} км/с` : "—";
}
