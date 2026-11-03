"""Independent reference pass times using python-sgp4 (optional QA tool).

This tool does NOT call the SGT Worker. It computes look angles independently
from the same OMM elements and the same observer/UTC elevation mask.
Requires: python -m pip install sgp4
Example:
python scripts/reference_passes.py --lat 61.254 --lon 73.396 --norad 25544
"""
import argparse
import json
import math
import os
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

TAU = 2.0 * math.pi
EARTH_A_KM = 6378.137
EARTH_F = 1 / 298.257223563
EARTH_E2 = EARTH_F * (2 - EARTH_F)


def utc_datetime(s: str) -> datetime:
    dt = datetime.fromisoformat(s.replace('Z', '+00:00'))
    return (dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None
            else dt.astimezone(timezone.utc))


def gmst_radians(jd: float) -> float:
    # Vallado 1982 sidereal-time polynomial, an independent reference
    # (Earth polar motion / UT1-UTC corrections omitted at this QA level).
    t = (jd - 2451545.0) / 36525.0
    seconds = (67310.54841 + (876600 * 3600 + 8640184.812866) * t
               + 0.093104 * t * t - 6.2e-6 * t * t * t)
    return ((seconds % 86400) / 86400) * TAU


def observer_ecef_km(lat_deg: float, lon_deg: float, alt_m: float):
    lat, lon = math.radians(lat_deg), math.radians(lon_deg)
    n = EARTH_A_KM / math.sqrt(1 - EARTH_E2 * math.sin(lat) ** 2)
    height = alt_m / 1000
    return (
        (n + height) * math.cos(lat) * math.cos(lon),
        (n + height) * math.cos(lat) * math.sin(lon),
        (n * (1 - EARTH_E2) + height) * math.sin(lat),
    )


def elevation_deg(sat_ecef, obs_ecef, lat_deg, lon_deg):
    lat, lon = math.radians(lat_deg), math.radians(lon_deg)
    dx, dy, dz = (sat_ecef[i] - obs_ecef[i] for i in range(3))
    dist = math.sqrt(dx * dx + dy * dy + dz * dz)
    if dist == 0:
        return None
    up = (math.cos(lat) * math.cos(lon) * dx
          + math.cos(lat) * math.sin(lon) * dy
          + math.sin(lat) * dz)
    return math.degrees(math.asin(max(-1, min(1, up / dist))))


def sky_elevation_function(record, lat_deg, lon_deg, alt_m):
    from sgp4.api import Satrec, jday
    from sgp4 import omm
    satrec = Satrec()
    omm.initialize(satrec, record)
    obs = observer_ecef_km(lat_deg, lon_deg, alt_m)

    def at(dt):
        jd, fr = jday(dt.year, dt.month, dt.day, dt.hour, dt.minute,
                      dt.second + dt.microsecond / 1e6)
        error, pos, _ = satrec.sgp4(jd, fr)
        if error:
            return None
        angle = gmst_radians(jd + fr)
        c, s = math.cos(angle), math.sin(angle)
        ecf = (pos[0] * c + pos[1] * s,
               -pos[0] * s + pos[1] * c,
               pos[2])
        return elevation_deg(ecf, obs, lat_deg, lon_deg)
    return at


def boundary(a, b, mask, elev):
    # Bisection of a known crossing to 1 ms UTC resolution.
    initial = elev(a)
    if initial is None:
        raise ValueError('SGP4 failed at interval boundary')
    begins_above = initial >= mask
    for _ in range(25):
        mid = a + (b - a) / 2
        value = elev(mid)
        if value is None:
            raise ValueError('SGP4 failed during refinement')
        if (value >= mask) == begins_above:
            a = mid
        else:
            b = mid
    return a + (b - a) / 2


def peak_time(a, b, elev):
    if b <= a:
        return a
    # Golden-section search for maximum elevation, independently from SGT's
    # 10-iteration ternary search. 35 loops gives subsecond resolution.
    factor = (math.sqrt(5) - 1) / 2
    t1 = b - (b - a) * factor
    t2 = a + (b - a) * factor
    e1, e2 = elev(t1), elev(t2)
    f1, f2 = (-90 if e1 is None else e1), (-90 if e2 is None else e2)
    for _ in range(35):
        if f1 < f2:
            a, t1, f1 = t1, t2, f2
            t2 = a + (b - a) * factor
            e2 = elev(t2)
            f2 = -90 if e2 is None else e2
        else:
            b, t2, f2 = t2, t1, f1
            t1 = b - (b - a) * factor
            e1 = elev(t1)
            f1 = -90 if e1 is None else e1
    return a + (b - a) / 2


def compute_passes(elev, start, end, mask, step_seconds=10):
    events = []
    before = elev(start)
    if before is None:
        raise ValueError('SGP4 failed at window start')
    inside = before >= mask
    aos = start if inside else None
    starts_inside = inside
    t = start
    while t < end:
        next_time = min(t + timedelta(seconds=step_seconds), end)
        current = elev(next_time)
        if current is None:
            raise ValueError('SGP4 failed in the scan window')
        if not inside and before < mask <= current:
            aos = boundary(t, next_time, mask, elev)
            inside, starts_inside = True, False
        elif inside and before >= mask > current:
            los = boundary(t, next_time, mask, elev)
            tca = peak_time(aos, los, elev)
            events.append((aos, tca, los, starts_inside, False, elev(tca)))
            aos = None
            inside, starts_inside = False, False
        before = current
        t = next_time
    continuous = False
    if inside and aos is not None:
        if starts_inside:
            continuous = True  # SGT intentionally excludes continuously visible GEO.
        else:
            tca = peak_time(aos, end, elev)
            events.append((aos, tca, end, starts_inside, True, elev(tca)))
    return events, continuous


def main():
    parser = argparse.ArgumentParser(description='SGT independent SGP4 pass reference')
    default_catalog = (Path(os.getenv('LOCALAPPDATA', str(Path.home() / 'AppData/Local')))
                       / 'SatGeoTracker/cache/celestrak-active.json'
                       if os.name == 'nt' else Path.home() / '.cache/satgeotracker/celestrak-active.json')
    parser.add_argument('--catalog', type=Path, default=default_catalog)
    parser.add_argument('--lat', type=float, required=True, help='Observer latitude, deg')
    parser.add_argument('--lon', type=float, required=True, help='Observer longitude, deg')
    parser.add_argument('--height', type=float, default=0, help='Observer altitude, meters')
    parser.add_argument('--mask', type=float, default=10, help='Elevation mask, deg')
    parser.add_argument('--minutes', type=int, default=60)
    parser.add_argument('--norad', type=int, action='append', required=True,
                        help='Satellite NORAD ID, repeatable')
    parser.add_argument('--start', type=str, default=None,
                        help='UTC start in ISO 8601, otherwise current time')
    args = parser.parse_args()
    if not (-90 <= args.lat <= 90 and -180 <= args.lon <= 180 and
            -10 <= args.mask <= 90 and 0 < args.minutes <= 1440):
        parser.error('Invalid observer coordinates, mask or horizon')
    try:
        from sgp4.api import Satrec  # noqa: F401
    except ImportError:
        parser.error('Missing dependency: run `python -m pip install sgp4`')
    records = json.loads(args.catalog.read_text(encoding='utf-8'))
    by_id = {int(r['NORAD_CAT_ID']): r for r in records}
    start = utc_datetime(args.start) if args.start else datetime.now(timezone.utc)
    end = start + timedelta(minutes=args.minutes)
    print(f'Observer lat={args.lat}, lon={args.lon}, height={args.height}m, '
          f'mask={args.mask}°, UTC {start.isoformat()} to {end.isoformat()}')
    print('Independent 10s scan; partial passes marked; compare using the SAME UTC/OMM in SGT.')
    for norad in args.norad:
        rec = by_id.get(norad)
        if not rec:
            print(f'\nNORAD {norad}: not found in cached OMM')
            continue
        print(f'\n{norad} {rec.get("OBJECT_NAME", "unknown")} — OMM epoch {rec.get("EPOCH")}')
        try:
            elev = sky_elevation_function(rec, args.lat, args.lon, args.height)
            events, continuous = compute_passes(elev, start, end, args.mask)
        except ValueError as exc:
            print(f'  computation failed: {exc}')
            continue
        if continuous:
            print('  Above mask throughout the window: SGT may intentionally omit it.')
        if not events:
            print('  No full or newly acquired pass in window.')
        for aos, tca, los, partial, cutoff, max_elev in events:
            print(f'  AOS={aos.isoformat()}  TCA={tca.isoformat()}  LOS={los.isoformat()} '
                  f'  max elevation={max_elev:.3f}deg  '
                  f'partial-start={partial} partial-end={cutoff}')
    print('\nCaution: same OMM agreement is numerical consistency, not ground-truth positioning.')


if __name__ == '__main__':
    main()
