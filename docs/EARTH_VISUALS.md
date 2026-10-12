# Earth Visual System — v0.5.7

SatGeoTracker v0.5.7 restores the high-resolution imagery path that visually worked best in v0.5, then improves it using Cesium's own asynchronous imagery and globe LOD controls.

## High-resolution imagery

The browser once again uses Cesium `ArcGisMapServerImageryProvider.fromUrl(...)` directly for Esri World Imagery. This matters because the provider reads the ArcGIS service metadata and uses the service's real cached tiling scheme / available levels instead of forcing a manually guessed URL template.

The provider is wrapped with `ImageryLayer.fromProviderAsync(...)`, so its metadata initialization runs in the background and never blocks the rest of the viewer. A bundled Natural Earth II layer is mounted immediately underneath as the visual placeholder/fallback.

Primary endpoint:

```text
https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer
```

Secondary endpoint is tried only if provider initialization fails:

```text
https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer
```

`usePreCachedTilesIfAvailable=true` is kept so Cesium uses ArcGIS cached imagery tiles.

The FastAPI `/api/map/imagery/...` proxy from v0.5.6 is left in the backend for diagnostics/backward compatibility but is not the default browser imagery path in v0.5.7.

## Adaptive close-up detail

Cesium's globe `maximumScreenSpaceError` controls tile refinement. Lower values mean more detailed tiles. v0.5.7 changes this value by camera height instead of using one value for all scales:

```text
> 10,000 km      SSE 1.25
4,000–10,000 km SSE 1.00
1,500–4,000 km  SSE 0.80
500–1,500 km    SSE 0.65
< 500 km        SSE 0.55
```

This is intentionally adaptive: orbital overview stays responsive, while approaching the surface asks Cesium to refine to finer imagery.

Additional globe tuning:

```text
tileCacheSize = 256
preloadAncestors = true
preloadSiblings = false
```

The larger tile cache improves returning to recently viewed regions. Sibling preloading stays off so bandwidth is focused on the current view instead of invisible adjacent tiles.

HIGH also keeps:

```text
useBrowserRecommendedResolution = false
resolutionScale = 1.0
```

so Cesium renders at device-pixel resolution rather than forcing CSS-pixel resolution.

## Countries, borders and cities

Geographic context remains fully local and independent from the imagery provider:

```text
frontend/public/map-data/country-borders.geojson
frontend/public/map-data/map-labels.json
```

This means countries/cities continue to work even while ArcGIS imagery is still initializing or if the remote imagery service is temporarily unavailable.

Approximate visibility policy:

```text
> 18,000 km  clean globe
< 18,000 km  country borders
< 13,000 km  country labels
<  6,500 km  city labels begin
closer        progressively more city labels
```

## Loading status

The Earth status now distinguishes provider readiness and Cesium tile refinement:

```text
Natural Earth II · loading ArcGIS high-resolution imagery
ArcGIS World Imagery · adaptive LOD · refining
ArcGIS World Imagery · adaptive LOD · detailed
```

The status is informational only and never blocks the viewer.

## Locked camera baseline

`frontend/src/camera/*` remains Camera v0.4.1 and is not modified by this release.
