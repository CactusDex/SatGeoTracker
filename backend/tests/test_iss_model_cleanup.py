"""Run: python -m unittest discover -s backend/tests -v"""
import json
import struct
import unittest
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.iss_model_cleanup import clean_iss_glb


def make_glb(extras=True):
    names = ["bendedtru1", "bendedtru2", "bendedtru3", "bendedtrus",
             "pCylinder1", "pCylinder2", "pCylinder8", "polySurfa1", "polySurfa2", "polySurfa3"]
    nodes = [{"name": n, "mesh": i} for i, n in enumerate(names)]
    nodes.append({"name": "isscombine", "children": list(range(10)) if extras else [7, 8, 9]})
    payload = {"scene": 0, "scenes": [{"nodes": [10]}], "nodes": nodes, "meshes": [{"name": n} for n in names], "asset": {"version": "2.0"}, "buffers": [{"byteLength": 4}]}
    data = json.dumps(payload).encode()
    data += b" " * (-len(data) % 4)
    binary = struct.pack("<II", 4, 0x004E4942) + b"1234"
    return b"glTF" + struct.pack("<II", 2, 20 + len(data) + len(binary)) + struct.pack("<II", len(data), 0x4E4F534A) + data + binary


class TestIssCleanup(unittest.TestCase):
    def test_removes_only_detached_components(self):
        patched, removed = clean_iss_glb(make_glb())
        self.assertEqual(removed, 7)
        self.assertEqual(struct.unpack_from("<I", patched, 8)[0], len(patched))
        length = struct.unpack_from("<I", patched, 12)[0]
        self.assertEqual(json.loads(patched[20:20 + length])["nodes"][10]["children"], [7, 8, 9])
        self.assertTrue(patched.endswith(b"1234"))

    def test_idempotent(self):
        once, count = clean_iss_glb(make_glb())
        again, count2 = clean_iss_glb(once)
        self.assertEqual(count, 7)
        self.assertEqual(count2, 0)
        self.assertEqual(once, again)

    def test_unknown_asset_not_modified(self):
        data = make_glb().replace(b"isscombine", b"notissmod_")
        cleaned, removed = clean_iss_glb(data)
        self.assertEqual(removed, 0)
        self.assertEqual(cleaned, data)

    def test_invalid_asset_preserved(self):
        bad = b"this is not a GLB"
        self.assertEqual(clean_iss_glb(bad), (bad, 0))


if __name__ == "__main__":
    unittest.main()
