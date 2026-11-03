/**
 * Bisection of a horizon-mask crossing, and bounded maximum-elevation search.
 * The predictor supplies SGP4-derived elevationAt(); these numeric methods
 * are isolated so their behavior can be tested independently of Web Workers.
 */
const CROSSING_ITERATIONS = 10;
const PEAK_ITERATIONS = 10;

export function refineCrossing(
  lowMs: number,
  highMs: number,
  thresholdDeg: number,
  rising: boolean,
  elevationAt: (timeMs: number) => number | null
): number {
  let low = lowMs;
  let high = highMs;

  for (let index = 0; index < CROSSING_ITERATIONS; index += 1) {
    const mid = (low + high) / 2;
    const elevation = elevationAt(mid);
    if (elevation === null) break;

    const above = elevation >= thresholdDeg;
    if (rising ? above : !above) {
      high = mid;
    } else {
      low = mid;
    }
  }

  return Math.round((low + high) / 2);
}

export function refinePeak(
  startMs: number,
  endMs: number,
  elevationAt: (timeMs: number) => number | null
): number {
  if (endMs <= startMs) return startMs;

  let low = startMs;
  let high = endMs;

  for (let index = 0; index < PEAK_ITERATIONS; index += 1) {
    const third = (high - low) / 3;
    const m1 = low + third;
    const m2 = high - third;
    const e1 = elevationAt(m1) ?? -90;
    const e2 = elevationAt(m2) ?? -90;

    if (e1 < e2) {
      low = m1;
    } else {
      high = m2;
    }
  }

  return Math.round((low + high) / 2);
}
