from __future__ import annotations

import asyncio
import json
import os
import shutil
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware

APP_DIR = Path(__file__).resolve().parent
LEGACY_CACHE_DIR = APP_DIR.parent / ".cache"
LEGACY_CACHE_FILE = LEGACY_CACHE_DIR / "celestrak-active.json"


def _shared_cache_dir() -> Path:
    local_app_data = os.getenv("LOCALAPPDATA")
    if local_app_data:
        return Path(local_app_data) / "SatGeoTracker" / "cache"
    return Path.home() / ".cache" / "satgeotracker"


CACHE_DIR = _shared_cache_dir()
CACHE_FILE = CACHE_DIR / "celestrak-active.json"
MAP_TILE_CACHE_DIR = CACHE_DIR / "map-tiles" / "world-imagery"
MODEL_CACHE_DIR = CACHE_DIR / "models"
ISS_MODEL_CACHE_FILE = MODEL_CACHE_DIR / "iss-nasa-b.glb"
SATNOGS_CACHE_FILE = CACHE_DIR / "satnogs-transmitters.json"
SATNOGS_TRANSMITTERS_URL = os.getenv(
    "SATNOGS_TRANSMITTERS_URL",
    "https://db.satnogs.org/api/transmitters/?format=json",
)
SATNOGS_CACHE_TTL_SECONDS = int(os.getenv("SATNOGS_CACHE_TTL_SECONDS", str(6 * 60 * 60)))

# Official NASA 3D Resources mirrors. v0.6 intentionally proxies the asset
# through FastAPI so Cesium has a same-origin URL and the model is cached once
# in %LOCALAPPDATA%\SatGeoTracker\cache\models.
NASA_ISS_MODEL_URLS = tuple(
    item.strip()
    for item in os.getenv(
        "NASA_ISS_MODEL_URLS",
        ",".join(
            [
                "https://raw.githubusercontent.com/nasa/NASA-3D-Resources/master/3D%20Models/International%20Space%20Station%20(ISS)%20(B)/International%20Space%20Station%20(ISS)%20(B).glb",
                "https://assets.science.nasa.gov/content/dam/science/cds/3d/resources/model/international-space-station-%28iss%29-%28b%29/International%20Space%20Station%20%28ISS%29%20%28B%29.glb",
            ]
        ),
    ).split(",")
    if item.strip()
)


def _migrate_legacy_cache() -> None:
    """Preserve the working CelesTrak cache when upgrading project versions."""
    if CACHE_FILE.exists() or not LEGACY_CACHE_FILE.exists():
        return

    try:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        shutil.copy2(LEGACY_CACHE_FILE, CACHE_FILE)
    except OSError:
        # Cache migration is a reliability optimization, never a startup blocker.
        pass


_migrate_legacy_cache()

DEFAULT_CELESTRAK_URL = (
    "https://celestrak.org/NORAD/elements/gp.php"
    "?GROUP=ACTIVE&FORMAT=JSON"
)
CELESTRAK_URL = os.getenv("CELESTRAK_URL", DEFAULT_CELESTRAK_URL)
CACHE_TTL_SECONDS = int(os.getenv("CELESTRAK_CACHE_TTL_SECONDS", "7200"))

# Cesium requests ArcGIS cached map tiles using WebMercator z/y/x coordinates.
# We intentionally proxy these through FastAPI so the browser never depends on
# third-party CORS/metadata initialization. Successful tiles are persisted in
# the shared SatGeoTracker cache and reused between project versions.
ARCGIS_WORLD_IMAGERY_SERVERS = tuple(
    item.strip().rstrip("/")
    for item in os.getenv(
        "ARCGIS_WORLD_IMAGERY_SERVERS",
        ",".join(
            [
                "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
                "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
            ]
        ),
    ).split(",")
    if item.strip()
)
MAP_TILE_CACHE_TTL_SECONDS = int(
    os.getenv("MAP_TILE_CACHE_TTL_SECONDS", str(30 * 24 * 60 * 60))
)
MAP_MAX_LEVEL = int(os.getenv("MAP_MAX_LEVEL", "21"))
map_tile_semaphore = asyncio.Semaphore(24)
iss_model_lock = asyncio.Lock()
satnogs_lock = asyncio.Lock()


@asynccontextmanager
async def lifespan(app: FastAPI):
    timeout = httpx.Timeout(15.0, connect=6.0, read=12.0, write=12.0, pool=6.0)
    limits = httpx.Limits(max_connections=48, max_keepalive_connections=24)
    app.state.map_http_client = httpx.AsyncClient(
        timeout=timeout,
        limits=limits,
        follow_redirects=True,
        headers={
            "User-Agent": "SatGeoTracker-MVP/0.8 educational-project",
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        },
    )
    app.state.asset_http_client = httpx.AsyncClient(
        timeout=httpx.Timeout(20.0, connect=8.0, read=18.0, write=10.0, pool=6.0),
        limits=httpx.Limits(max_connections=8, max_keepalive_connections=4),
        follow_redirects=True,
        headers={
            "User-Agent": "SatGeoTracker-MVP/0.8 educational-project",
            "Accept": "model/gltf-binary,application/octet-stream,*/*;q=0.8",
        },
    )
    try:
        yield
    finally:
        await app.state.asset_http_client.aclose()
        await app.state.map_http_client.aclose()


app = FastAPI(
    title="SatGeoTracker API",
    version="0.8",
    lifespan=lifespan,
)

sync_lock = asyncio.Lock()

# The Vite development server proxies /api to FastAPI, so CORS is not required
# for normal local development. These origins are retained for direct API calls.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)


def _read_cache() -> list[dict[str, Any]] | None:
    if not CACHE_FILE.exists():
        return None

    try:
        data = json.loads(CACHE_FILE.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else None
    except (OSError, json.JSONDecodeError):
        return None


def _cache_age_seconds() -> float | None:
    if not CACHE_FILE.exists():
        return None
    return time.time() - CACHE_FILE.stat().st_mtime


def _write_cache(data: list[dict[str, Any]]) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    CACHE_FILE.write_text(
        json.dumps(data, ensure_ascii=False),
        encoding="utf-8",
    )


def _upstream_error_detail(
    *,
    kind: str,
    message: str,
    upstream_status: int | None = None,
) -> dict[str, Any]:
    return {
        "source": "celestrak",
        "kind": kind,
        "upstream_status": upstream_status,
        "message": message,
        "url": CELESTRAK_URL,
    }


async def get_active_satellites() -> tuple[list[dict[str, Any]], str]:
    cached = _read_cache()
    age = _cache_age_seconds()

    if cached is not None and age is not None and age < CACHE_TTL_SECONDS:
        return cached, "cache"

    # Do not let simultaneous browser requests trigger duplicate upstream fetches.
    async with sync_lock:
        cached = _read_cache()
        age = _cache_age_seconds()

        if cached is not None and age is not None and age < CACHE_TTL_SECONDS:
            return cached, "cache"

        timeout = httpx.Timeout(30.0, connect=10.0)
        headers = {
            "User-Agent": "SatGeoTracker-MVP/0.8 educational-project",
            "Accept": "application/json",
        }

        try:
            async with httpx.AsyncClient(
                timeout=timeout,
                headers=headers,
                follow_redirects=True,
            ) as client:
                response = await client.get(CELESTRAK_URL)
                response.raise_for_status()
                data = response.json()

            if not isinstance(data, list):
                raise ValueError("Unexpected CelesTrak response: expected JSON array")

            _write_cache(data)
            return data, "celestrak"

        except httpx.HTTPStatusError as exc:
            if cached is not None:
                return cached, "stale-cache"

            body = exc.response.text.strip().replace("\n", " ")[:500]
            raise HTTPException(
                status_code=502,
                detail=_upstream_error_detail(
                    kind="http_status",
                    upstream_status=exc.response.status_code,
                    message=body or str(exc),
                ),
            ) from exc

        except httpx.RequestError as exc:
            if cached is not None:
                return cached, "stale-cache"

            raise HTTPException(
                status_code=502,
                detail=_upstream_error_detail(
                    kind="network",
                    message=str(exc),
                ),
            ) from exc

        except (ValueError, json.JSONDecodeError) as exc:
            if cached is not None:
                return cached, "stale-cache"

            raise HTTPException(
                status_code=502,
                detail=_upstream_error_detail(
                    kind="invalid_payload",
                    message=str(exc),
                ),
            ) from exc


def _validate_tile_coordinates(level: int, row: int, column: int) -> None:
    if level < 0 or level > MAP_MAX_LEVEL:
        raise HTTPException(status_code=404, detail="Unsupported map zoom level")

    tile_count = 1 << level
    if row < 0 or column < 0 or row >= tile_count or column >= tile_count:
        raise HTTPException(status_code=404, detail="Map tile outside valid range")


def _map_tile_cache_path(level: int, row: int, column: int) -> Path:
    return MAP_TILE_CACHE_DIR / str(level) / str(row) / f"{column}.jpg"


def _read_map_tile(path: Path) -> tuple[bytes | None, bool]:
    if not path.exists():
        return None, False

    try:
        data = path.read_bytes()
        fresh = (time.time() - path.stat().st_mtime) < MAP_TILE_CACHE_TTL_SECONDS
        return data, fresh
    except OSError:
        return None, False


def _write_map_tile(path: Path, data: bytes) -> None:
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        temp_path = path.with_suffix(f".{os.getpid()}.{time.time_ns()}.tmp")
        temp_path.write_bytes(data)
        os.replace(temp_path, path)
    except OSError:
        # Tile caching accelerates repeat views but must never make rendering fail.
        pass



def _looks_like_image(data: bytes, content_type: str) -> bool:
    if content_type.lower().startswith("image/"):
        return True
    return data.startswith(b"\xff\xd8\xff") or data.startswith(b"\x89PNG\r\n\x1a\n")


def _map_tile_response(data: bytes, source: str) -> Response:
    return Response(
        content=data,
        media_type="image/jpeg",
        headers={
            "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
            "X-SGT-Map-Source": source,
        },
    )


async def _get_world_imagery_tile(
    request: Request,
    level: int,
    row: int,
    column: int,
) -> Response:
    _validate_tile_coordinates(level, row, column)

    cache_path = _map_tile_cache_path(level, row, column)
    cached, fresh = _read_map_tile(cache_path)
    if cached is not None and fresh:
        return _map_tile_response(cached, "disk-cache")

    errors: list[str] = []
    client: httpx.AsyncClient = request.app.state.map_http_client

    async with map_tile_semaphore:
        # Another request may have filled the cache while this request waited.
        cached_after_wait, fresh_after_wait = _read_map_tile(cache_path)
        if cached_after_wait is not None and fresh_after_wait:
            return _map_tile_response(cached_after_wait, "disk-cache")

        for base_url in ARCGIS_WORLD_IMAGERY_SERVERS:
            tile_url = f"{base_url}/tile/{level}/{row}/{column}"
            try:
                response = await client.get(tile_url, params={"blankTile": "false"})
            except httpx.RequestError as exc:
                errors.append(f"{base_url}: {exc}")
                continue

            if response.status_code == 200 and response.content:
                content_type = response.headers.get("content-type", "")
                if _looks_like_image(response.content, content_type):
                    _write_map_tile(cache_path, response.content)
                    return _map_tile_response(response.content, "arcgis")

            errors.append(f"{base_url}: HTTP {response.status_code}")

    # A stale successful tile is better than a blank globe when the upstream is
    # temporarily unavailable.
    if cached is not None:
        return _map_tile_response(cached, "stale-disk-cache")

    raise HTTPException(
        status_code=502,
        detail={
            "source": "arcgis-world-imagery",
            "message": "Unable to fetch map tile",
            "tile": {"level": level, "row": row, "column": column},
            "errors": errors[-4:],
        },
    )


def _looks_like_glb(data: bytes) -> bool:
    # Binary glTF 2.0 starts with ASCII magic `glTF`.
    return len(data) >= 20 and data[:4] == b"glTF"


def _read_cached_iss_model() -> bytes | None:
    if not ISS_MODEL_CACHE_FILE.exists():
        return None

    try:
        data = ISS_MODEL_CACHE_FILE.read_bytes()
    except OSError:
        return None

    return data if _looks_like_glb(data) else None


def _write_cached_iss_model(data: bytes) -> None:
    try:
        MODEL_CACHE_DIR.mkdir(parents=True, exist_ok=True)
        temp_path = ISS_MODEL_CACHE_FILE.with_suffix(
            f".{os.getpid()}.{time.time_ns()}.tmp"
        )
        temp_path.write_bytes(data)
        os.replace(temp_path, ISS_MODEL_CACHE_FILE)
    except OSError:
        # Runtime model rendering can still use the downloaded response even if
        # persistent caching fails.
        pass


def _iss_model_response(data: bytes, source: str) -> Response:
    return Response(
        content=data,
        media_type="model/gltf-binary",
        headers={
            "Cache-Control": "public, max-age=31536000, immutable",
            "X-SGT-Model-Source": source,
            "X-SGT-Model-Credit": "NASA / Michael D. Carbajal",
        },
    )


async def _get_iss_model(request: Request) -> Response:
    cached = _read_cached_iss_model()
    if cached is not None:
        return _iss_model_response(cached, "disk-cache")

    async with iss_model_lock:
        cached = _read_cached_iss_model()
        if cached is not None:
            return _iss_model_response(cached, "disk-cache")

        errors: list[str] = []
        client: httpx.AsyncClient = request.app.state.asset_http_client

        for url in NASA_ISS_MODEL_URLS:
            try:
                response = await client.get(url)
            except httpx.RequestError as exc:
                errors.append(f"{url}: {exc}")
                continue

            if response.status_code == 200 and _looks_like_glb(response.content):
                _write_cached_iss_model(response.content)
                return _iss_model_response(response.content, "nasa")

            errors.append(
                f"{url}: HTTP {response.status_code}, {len(response.content)} bytes"
            )

    raise HTTPException(
        status_code=502,
        detail={
            "source": "nasa-3d-resources",
            "message": "Unable to download the official ISS GLB",
            "errors": errors[-4:],
        },
    )


def _read_satnogs_cache() -> list[dict[str, Any]] | None:
    if not SATNOGS_CACHE_FILE.exists():
        return None
    try:
        payload = json.loads(SATNOGS_CACHE_FILE.read_text(encoding="utf-8"))
        return payload if isinstance(payload, list) else None
    except (OSError, json.JSONDecodeError):
        return None


def _satnogs_cache_age_seconds() -> float | None:
    if not SATNOGS_CACHE_FILE.exists():
        return None
    try:
        return time.time() - SATNOGS_CACHE_FILE.stat().st_mtime
    except OSError:
        return None


def _write_satnogs_cache(data: list[dict[str, Any]]) -> None:
    try:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        temp_path = SATNOGS_CACHE_FILE.with_suffix(f".{os.getpid()}.{time.time_ns()}.tmp")
        temp_path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        os.replace(temp_path, SATNOGS_CACHE_FILE)
    except OSError:
        pass


def _normalize_satnogs_payload(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        rows = payload
    elif isinstance(payload, dict) and isinstance(payload.get("results"), list):
        rows = payload["results"]
    else:
        raise ValueError("Unexpected SatNOGS response: expected JSON array/results")

    normalized: list[dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        norad = row.get("norad_cat_id")
        try:
            norad_id = int(norad)
        except (TypeError, ValueError):
            continue
        if norad_id <= 0:
            continue

        item = dict(row)
        item["norad_cat_id"] = norad_id
        normalized.append(item)
    return normalized


async def get_satnogs_transmitters(request: Request) -> tuple[list[dict[str, Any]], str]:
    cached = _read_satnogs_cache()
    age = _satnogs_cache_age_seconds()
    if cached is not None and age is not None and age < SATNOGS_CACHE_TTL_SECONDS:
        return cached, "cache"

    async with satnogs_lock:
        cached = _read_satnogs_cache()
        age = _satnogs_cache_age_seconds()
        if cached is not None and age is not None and age < SATNOGS_CACHE_TTL_SECONDS:
            return cached, "cache"

        client: httpx.AsyncClient = request.app.state.asset_http_client
        try:
            response = await client.get(
                SATNOGS_TRANSMITTERS_URL,
                headers={"Accept": "application/json"},
            )
            response.raise_for_status()
            data = _normalize_satnogs_payload(response.json())
            _write_satnogs_cache(data)
            return data, "satnogs"
        except (httpx.RequestError, httpx.HTTPStatusError, ValueError, json.JSONDecodeError) as exc:
            if cached is not None:
                return cached, "stale-cache"
            status = exc.response.status_code if isinstance(exc, httpx.HTTPStatusError) else None
            raise HTTPException(
                status_code=502,
                detail={
                    "source": "satnogs-db",
                    "upstream_status": status,
                    "message": str(exc),
                    "url": SATNOGS_TRANSMITTERS_URL,
                },
            ) from exc


@app.get("/health")
async def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "cache_exists": CACHE_FILE.exists(),
        "cache_age_seconds": _cache_age_seconds(),
        "cache_path": str(CACHE_FILE),
        "map_tile_cache_path": str(MAP_TILE_CACHE_DIR),
        "iss_model_cached": ISS_MODEL_CACHE_FILE.exists(),
        "iss_model_cache_path": str(ISS_MODEL_CACHE_FILE),
        "satnogs_cache_exists": SATNOGS_CACHE_FILE.exists(),
        "satnogs_cache_age_seconds": _satnogs_cache_age_seconds(),
        "satnogs_cache_path": str(SATNOGS_CACHE_FILE),
    }


@app.get("/api/models/iss.glb")
async def iss_model(request: Request) -> Response:
    return await _get_iss_model(request)


@app.get("/api/satellites")
async def satellites() -> dict[str, Any]:
    data, source = await get_active_satellites()

    return {
        "count": len(data),
        "source": source,
        "data": data,
    }


@app.get("/api/sdr/transmitters")
async def sdr_transmitters(request: Request) -> dict[str, Any]:
    data, source = await get_satnogs_transmitters(request)
    return {
        "count": len(data),
        "source": source,
        "data": data,
    }


@app.get("/api/map/imagery/{level}/{row}/{column}")
async def world_imagery_tile(
    request: Request,
    level: int,
    row: int,
    column: int,
) -> Response:
    return await _get_world_imagery_tile(request, level, row, column)
