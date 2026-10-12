export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeAngle(angle: number): number {
  const twoPi = Math.PI * 2;
  let normalized = (angle + Math.PI) % twoPi;
  if (normalized < 0) normalized += twoPi;
  return normalized - Math.PI;
}

export function shortestAngleDelta(from: number, to: number): number {
  return normalizeAngle(to - from);
}

export function expSmoothingAlpha(rate: number, dtSeconds: number): number {
  if (dtSeconds <= 0) return 0;
  return 1 - Math.exp(-rate * dtSeconds);
}

export function distance2d(
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  return Math.hypot(bx - ax, by - ay);
}
