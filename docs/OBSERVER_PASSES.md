# Observer & Pass Engine v0.7.0

## Purpose

The observer subsystem converts SatGeoTracker from a geocentric catalog viewer into a location-aware receiving tool.

It answers three practical questions for a ground station:

1. Where is the selected spacecraft in my local sky?
2. Is it above my configured elevation mask now?
3. Which spacecraft will cross that mask during the next hour?

## Observer location

The user can choose either:

- browser geolocation (requires browser permission), or
- manual latitude / longitude / altitude.

Coordinates are stored only in browser `localStorage` by the frontend. The observer position is not sent to FastAPI by v0.7.0.

## Local look angles

For a selected satellite:

```text
OMM + UTC
   ↓
SGP4
   ↓
ECI
   ↓ GMST
ECF
   ↓ observer geodetic position
Topocentric look angles
   ├─ azimuth
   ├─ elevation
   └─ slant range
```

The implementation uses `satellite.js` coordinate transforms and keeps the existing SGP4 runtime model unchanged.

## Pass prediction

Prediction runs in `passPredictionWorker.ts`, not in the render thread.

Default parameters:

- horizon: 60 minutes;
- coarse scan step: 60 seconds;
- threshold crossing refinement: binary refinement;
- TCA/max-elevation refinement: bounded peak search;
- minimum elevation mask: user selectable 5°, 10°, 20° or 30°;
- automatic refresh: every 5 minutes.

A pass contains:

```text
AOS  acquisition of signal / elevation-mask entry
TCA  peak elevation inside the pass
LOS  loss of signal / elevation-mask exit
```

Objects continuously above the mask for the full prediction window are intentionally omitted from the "overhead passes" list. This prevents GEO-like continuous visibility from flooding a list intended for upcoming crossing events.

## UI behavior

- Green globe point: observer station.
- Observer panel: coordinates, source, elevation mask, device/manual controls.
- Selected satellite panel: live elevation, azimuth, range, visibility and next pass.
- Bottom pass strip: upcoming/active passes; clicking a pass selects and tracks that satellite.

## SDR roadmap dependency

v0.7.0 intentionally contains no RF database yet. The next SDR layer can join transmitter metadata to the existing NORAD ID and use this observer/pass engine for:

- receivable-now filters;
- downlink frequencies and modes;
- pass-quality filters;
- Doppler correction;
- future rotator/SDR control integration.
