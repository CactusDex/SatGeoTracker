"""Independent SGP4 numerical check against satellite.js audit JSON.

Requirement (only for this optional QA script):
    python -m pip install sgp4

Usage from the project root:
    python scripts/compare_sgp4.py frontend/sgp4-audit-output.json

Uses the independently maintained python-sgp4 library, OMM elements,
WGS72 default gravity model and identical UTC time stamps. No arbitrary
accuracy PASS tolerance is applied: prints measured differences, epoch age.
"""
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path


def iso_utc(value: str) -> datetime:
    dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)


def compare(path: Path) -> int:
    try:
        from sgp4.api import Satrec, jday
        from sgp4 import omm
    except ImportError:
        print('Missing optional dependency: run `python -m pip install sgp4`', file=sys.stderr)
        return 2

    report = json.loads(path.read_text(encoding='utf-8'))
    if report.get('schema') != 'satgeotracker.sg4audit.v1':
        raise ValueError('Unsupported audit JSON format')
    total, errors = 0, 0
    for case in report['cases']:
        sat = Satrec()
        omm.initialize(sat, case['omm'])
        name = case['name']
        epoch = iso_utc(case['omm']['EPOCH'])
        generated = iso_utc(report['generatedUtc'])
        age_days = (generated - epoch).total_seconds() / 86400
        print(f'\nNORAD {case["norad"]}  {name}  OMM age: {age_days:+.2f} days')
        max_pos = max_vel = 0.0
        for row in case['samples']:
            if 'temePositionKm' not in row:
                print('  JavaScript propagation failed at', row['utc'])
                errors += 1
                continue
            at = iso_utc(row['utc'])
            jd, fr = jday(at.year, at.month, at.day, at.hour, at.minute,
                          at.second + at.microsecond / 1e6)
            code, pos, vel = sat.sgp4(jd, fr)
            if code != 0:
                print(f'  Python SGP4 error {code} at {row["utc"]}')
                errors += 1
                continue
            def diff(a, b):
                return math.sqrt(sum((float(x) - float(y)) ** 2 for x, y in zip(a, b)))
            js_pos = row['temePositionKm']
            js_vel = row['temeVelocityKmS']
            dp = diff(pos, (js_pos['x'], js_pos['y'], js_pos['z']))
            dv = diff(vel, (js_vel['x'], js_vel['y'], js_vel['z']))
            max_pos = max(max_pos, dp)
            max_vel = max(max_vel, dv)
            total += 1
            print(f'  {at.isoformat()}  Δpos={dp:.8f} km  Δvel={dv:.10f} km/s')
        print(f'  MAX: Δpos={max_pos:.8f} km; Δvel={max_vel:.10f} km/s')
    print(f'\nNumerical comparisons: {total}; propagation errors: {errors}')
    print('This is agreement BETWEEN TWO implementations, not proof of real-world orbit accuracy.')
    print('Fresh OMM and reliable UTC are essential; do not set an arbitrary pass/fail tolerance.')
    return 0 if total and not errors else 1


if __name__ == '__main__':
    if len(sys.argv) != 2:
        print('Usage: python scripts/compare_sgp4.py frontend/sgp4-audit-output.json')
        sys.exit(2)
    sys.exit(compare(Path(sys.argv[1])))
