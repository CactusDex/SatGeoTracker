# Local development

## Supported local workflow

The project currently targets Windows development.

### First time

```powershell
.\setup.cmd
```

### Start everything

```powershell
.\dev.cmd
```

The launcher:

1. checks required installed dependencies;
2. runs setup automatically if `.venv`, Vite, or Cesium runtime assets are missing;
3. stops old SGT processes recorded in `.run/`;
4. starts FastAPI and Vite in separate PowerShell windows;
5. waits for both services;
6. opens `http://127.0.0.1:5173/`.

### Stop

```powershell
.\stop-dev.cmd
```

## Why Node can work even when `node` is not in PATH

The scripts explicitly check:

```text
C:\Program Files\nodejs\node.exe
C:\Program Files\nodejs\npm.cmd
```

so the project does not depend on a freshly restarted shell after Node installation.

## Ports

Fixed development ports:

- `5173` — Vite frontend.
- `8000` — FastAPI backend.

Vite uses `strictPort`, so it does not silently move to 5174 and break assumptions.

## CelesTrak debugging

Check backend health:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
```

Check satellite endpoint directly:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/satellites
```

If the large ACTIVE query fails, test the full pipeline with ISS:

```powershell
$env:CELESTRAK_URL="https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=JSON"
.\stop-dev.cmd
.\dev.cmd
```

## Typical error meanings

### `ERR_CONNECTION_REFUSED :5173`

Vite is not running.

### Vite says `Port 5173 is in use`

Run:

```powershell
.\stop-dev.cmd
```

If another unrelated program owns 5173, identify it before terminating it.

### UI says `Backend is unavailable`

FastAPI did not start or Vite proxy cannot reach port 8000.

### UI says `Backend HTTP 502`

Frontend and backend are connected; the problem is now upstream CelesTrak or its payload. Inspect the detailed message returned by FastAPI.


## Shared CelesTrak cache

Camera/project version upgrades no longer require a new ACTIVE download. On Windows the cache is stored at:

```text
%LOCALAPPDATA%\SatGeoTracker\cache\celestrak-active.json
```

`/health` reports the resolved `cache_path`. A legacy `backend/.cache/celestrak-active.json` is copied into the shared location automatically when present.

## Camera v0.4 debugging

Press `F8` in the viewer to show/hide camera mode, target, heading, pitch, range, and controller ownership.
