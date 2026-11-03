# SatGeoTracker v0.9.1 — Release verification

## User acceptance

- [x] v0.8.8 confirmed stable by user.
- [x] v0.9.0 features: Favorites / Graphite Glass / identity / pass drawer passed basic QA.
- [x] v0.9.0 RC2: search and mobile layout fixes implemented and automated checks passed.
- [x] v0.9.1: universal hover cards tested by user and accepted.

## Engineering validation

- [x] `npm run test:all` in this environment.
- [x] TypeScript typecheck.
- [ ] Windows production `npm run build` (not independently confirmed).
- [ ] Browser DevTools Console, long session, Cesium Worker availability.
- [ ] Independent SGP4 reference comparison with current OMM data.

This document distinguishes verified checks from outstanding work. It must not be used to claim unperformed tests as PASS.
