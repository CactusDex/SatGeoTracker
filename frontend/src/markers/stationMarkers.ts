/** Satellite marker palette and the small set of crewed space stations.
 * Regular satellites use a warm amber that stands out on oceans, land and sky.
 * Stations have a distinctive magenta symbol, not just a different color.
 */
export const TRACKER_COLOR = "#FFD166";
export const TRACKER_HOVER_COLOR = "#FFF0B0";
export const TRACKER_SELECTED_COLOR = "#FFF2C4";
export const STATION_COLOR = "#F58CE0";
export const TRACKER_OUTLINE_COLOR = "#111319";

const STATION_NORAD_IDS = new Set([25544, 48274]); // ISS, Tiangong core module

export function isSpaceStation(noradId: number, name: string): boolean {
  return STATION_NORAD_IDS.has(noradId) ||
    /\b(?:ISS|TIANGONG|TIANHE|CHINESE SPACE STATION|CSS)\b/i.test(name);
}

/** Canvas avoids asynchronous network requests and font-dependent emoji icons. */
export function createStationIcon(): HTMLCanvasElement | null {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Dark outline circle keeps the icon readable on bright Earth imagery.
  ctx.beginPath();
  ctx.arc(32, 32, 29, 0, Math.PI * 2);
  ctx.fillStyle = "#111319";
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = STATION_COLOR;
  ctx.stroke();

  // Silhouette: central inhabited module + two solar-panel wings.
  ctx.fillStyle = STATION_COLOR;
  ctx.fillRect(4, 25, 17, 14);
  ctx.fillRect(43, 25, 17, 14);
  ctx.strokeStyle = "#111319";
  ctx.lineWidth = 2;
  for (const x of [9, 14, 48, 53]) {
    ctx.beginPath();
    ctx.moveTo(x, 26);
    ctx.lineTo(x, 38);
    ctx.stroke();
  }
  ctx.fillStyle = "#FFE9FB";
  ctx.fillRect(26, 21, 12, 22);
  ctx.fillRect(21, 29, 22, 6);
  ctx.fillRect(30, 16, 4, 32);
  return canvas;
}
