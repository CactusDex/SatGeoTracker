"""Media endpoints must not misidentify a spacecraft or overload SatNOGS DB."""

import asyncio
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import httpx

from app import satellite_media


class SatelliteMediaTest(unittest.TestCase):
    def test_exact_norad_required(self):
        rows = [
            {"norad_cat_id": 25575, "image": "https://db-satnogs.freetls.fastly.net/media/satellites/incorrect.jpg"},
            {"norad_cat_id": 25544, "image": "https://db-satnogs.freetls.fastly.net/media/satellites/ISS.jpg"},
        ]
        result = satellite_media.extract_satellite_media(rows, 25544)
        self.assertTrue(result["image_url"].endswith("ISS.jpg"))
        self.assertEqual(result["source_url"], "https://db.satnogs.org/satellite/25544/")
        self.assertIsNone(satellite_media.extract_satellite_media(rows, 12345)["image_url"])

    def test_absent_image_and_untrusted_image_are_not_used(self):
        self.assertIsNone(satellite_media.extract_satellite_media([{"norad_cat_id": 1, "image": None}], 1)["image_url"])
        self.assertIsNone(satellite_media.extract_satellite_media([{"norad_cat_id": 1, "image": "http://127.0.0.1/private"}], 1)["image_url"])
        self.assertIsNone(satellite_media.extract_satellite_media([{"norad_cat_id": 1, "image": "https://evil.example/a.jpg"}], 1)["image_url"])
        self.assertEqual(satellite_media._image_url("/media/satellites/ISS.jpg"), "https://db.satnogs.org/media/satellites/ISS.jpg")

    def test_pagination_and_null_rows(self):
        result = satellite_media.extract_satellite_media({"results": [None, {"norad_cat_id": "123", "image": "/media/image.jpg"}]}, 123)
        self.assertEqual(result["norad_id"], 123)
        self.assertIsNotNone(result["image_url"])

    def test_fetch_uses_one_id_and_caches_absent_and_present(self):
        async def check():
            calls = []
            def handler(request: httpx.Request):
                calls.append(str(request.url))
                self.assertEqual(request.url.params["norad_cat_id"], "25544")
                return httpx.Response(200, json=[{"norad_cat_id": 25544, "image": "https://db-satnogs.freetls.fastly.net/media/satellites/ISS.jpg"}])
            with tempfile.TemporaryDirectory() as td, patch.object(satellite_media, "_media_cache_directory", return_value=Path(td)):
                async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
                    first = await satellite_media.fetch_satellite_media(25544, client)
                    second = await satellite_media.fetch_satellite_media(25544, client)
                    self.assertEqual(first["source"], "satnogs-db")
                    self.assertEqual(second["source"], "cache")
                    self.assertEqual(len(calls), 1)
            with tempfile.TemporaryDirectory() as td, patch.object(satellite_media, "_media_cache_directory", return_value=Path(td)):
                async with httpx.AsyncClient(transport=httpx.MockTransport(lambda _: httpx.Response(200,json=[]))) as client:
                    first = await satellite_media.fetch_satellite_media(123, client)
                    second = await satellite_media.fetch_satellite_media(123, client)
                    self.assertIsNone(first["image_url"])
                    self.assertEqual(second["source"], "cache")
        asyncio.run(check())

    def test_upstream_failure_does_not_break_inspector(self):
        async def check():
            with tempfile.TemporaryDirectory() as td, patch.object(satellite_media,"_media_cache_directory",return_value=Path(td)):
                async with httpx.AsyncClient(transport=httpx.MockTransport(lambda _: httpx.Response(503))) as client:
                    result = await satellite_media.fetch_satellite_media(500, client)
                    self.assertIsNone(result["image_url"])
                    self.assertEqual(result["source"], "unavailable")
        asyncio.run(check())


if __name__ == "__main__":
    unittest.main()
