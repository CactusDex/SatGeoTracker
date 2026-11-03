"""Optional SatNOGS image metadata for a selected satellite (not a bulk-catalog sync)."""

from __future__ import annotations

import asyncio
import json
import os
import time
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlsplit

import httpx

BASE_URL = "https://db.satnogs.org"
API_URL = f"{BASE_URL}/api/satellites/"
IMAGE_HOSTS = {"db.satnogs.org", "db-satnogs.freetls.fastly.net"}
POSITIVE_TTL_SECONDS = 24 * 3600
NEGATIVE_TTL_SECONDS = 6 * 3600
MAX_RESPONSE_BYTES = 1024 * 1024
_locks: dict[int, asyncio.Lock] = {}


def _media_cache_directory() -> Path:
    local_app_data = os.getenv("LOCALAPPDATA")
    root = Path(local_app_data) / "SatGeoTracker" / "cache" if local_app_data else Path.home() / ".cache" / "satgeotracker"
    return root / "satellite-media"


def _image_url(value: Any) -> str | None:
    if isinstance(value, dict):
        value = value.get("url") or value.get("image") or value.get("thumbnail")
    if not isinstance(value, str) or not value.strip():
        return None
    value = value.strip()
    if value.startswith("/media/"):
        value = urljoin(BASE_URL, value)
    if value.startswith("//"):
        value = "https:" + value
    try:
        parsed = urlsplit(value)
    except ValueError:
        return None
    if parsed.scheme != "https" or parsed.hostname not in IMAGE_HOSTS or parsed.username or parsed.password:
        return None
    return value


def extract_satellite_media(payload: Any, norad_id: int) -> dict[str, Any]:
    """Reject incorrect NORAD matches; never show another spacecraft's photo."""
    if isinstance(payload, list):
        rows = payload
    elif isinstance(payload, dict) and isinstance(payload.get("results"), list):
        rows = payload["results"]
    elif isinstance(payload, dict) and "norad_cat_id" in payload:
        rows = [payload]
    else:
        rows = []

    for item in rows:
        if not isinstance(item, dict):
            continue
        try:
            if int(item.get("norad_cat_id")) != norad_id:
                continue
        except (TypeError, ValueError):
            continue
        image = _image_url(item.get("image")) or _image_url(item.get("image_url"))
        if image:
            return {
                "norad_id": norad_id,
                "image_url": image,
                "source_url": f"{BASE_URL}/satellite/{norad_id}/",
                "credit": "SatNOGS DB",
            }
    return {"norad_id": norad_id, "image_url": None, "source_url": None, "credit": None}


def _read_cache(norad_id: int) -> tuple[dict[str, Any], float] | None:
    path = _media_cache_directory() / f"{norad_id}.json"
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
        payload, recorded = value["data"], float(value["timestamp"])
        if payload.get("norad_id") == norad_id and isinstance(payload.get("image_url"), (str, type(None))):
            return payload, time.time() - recorded
    except (OSError, KeyError, ValueError, TypeError, AttributeError, json.JSONDecodeError):
        return None
    return None


def _write_cache(norad_id: int, payload: dict[str, Any]) -> None:
    try:
        directory = _media_cache_directory()
        directory.mkdir(parents=True, exist_ok=True)
        destination = directory / f"{norad_id}.json"
        temp = directory / f"{norad_id}.{os.getpid()}.{time.time_ns()}.tmp"
        temp.write_text(json.dumps({"timestamp": time.time(), "data": payload}, ensure_ascii=False), encoding="utf-8")
        os.replace(temp, destination)
    except OSError:
        pass  # Cache is optional, never block the selected satellite panel.


def _ttl(payload: dict[str, Any]) -> int:
    return POSITIVE_TTL_SECONDS if payload.get("image_url") else NEGATIVE_TTL_SECONDS


async def fetch_satellite_media(norad_id: int, client: httpx.AsyncClient) -> dict[str, Any]:
    if not 1 <= norad_id <= 999_999_999:
        raise ValueError("Invalid NORAD ID")
    cached = _read_cache(norad_id)
    if cached and 0 <= cached[1] < _ttl(cached[0]):
        return {**cached[0], "source": "cache"}

    lock = _locks.setdefault(norad_id, asyncio.Lock())
    try:
        async with lock:
            cached = _read_cache(norad_id)
            if cached and 0 <= cached[1] < _ttl(cached[0]):
                return {**cached[0], "source": "cache"}
            try:
                response = await client.get(API_URL, params={"format": "json", "norad_cat_id": norad_id}, headers={"Accept": "application/json"})
                response.raise_for_status()
                if len(response.content) > MAX_RESPONSE_BYTES:
                    raise ValueError("SatNOGS response is too large")
                data = extract_satellite_media(response.json(), norad_id)
                _write_cache(norad_id, data)
                return {**data, "source": "satnogs-db"}
            except (httpx.RequestError, httpx.HTTPStatusError, ValueError, json.JSONDecodeError):
                if cached:
                    return {**cached[0], "source": "stale-cache"}
                return {**extract_satellite_media([], norad_id), "source": "unavailable"}
    finally:
        if not lock.locked() and _locks.get(norad_id) is lock:
            _locks.pop(norad_id, None)
