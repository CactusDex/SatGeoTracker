"""Repair the known detached meshes in NASA's ISS (B) binary glTF.

The original NASA/Michael D. Carbajal GLB contains the actual station at
``polySurfa1/2/3`` and seven isolated construction meshes (bendedtru*/
pCylinder*) around y = 41 in source model coordinates. Those render as a
separate grey object next to the real station. Rather than modifying the
SGP4 model pose or scaling, remove ONLY these explicit nodes from the GLB
scene graph. The original NASA source remains the upstream asset.
"""

from __future__ import annotations

import json
import struct
from typing import Any

_JSON_CHUNK = 0x4E4F534A  # JSON
_DETACHED_MESH_NAMES = frozenset({
    "bendedtru1", "bendedtru2", "bendedtru3", "bendedtrus",
    "pCylinder1", "pCylinder2", "pCylinder8",
})
_KEEP_MESH_NAMES = frozenset({"polySurfa1", "polySurfa2", "polySurfa3"})


def clean_iss_glb(data: bytes) -> tuple[bytes, int]:
    """Return (GLB, removed_node_count). Leave unexpected assets unchanged."""
    if len(data) < 20 or data[:4] != b"glTF":
        return data, 0
    version, full_length, json_length, chunk_type = struct.unpack_from("<IIII", data, 4)
    if version != 2 or full_length != len(data) or chunk_type != _JSON_CHUNK:
        return data, 0
    if json_length < 2 or 20 + json_length > len(data):
        return data, 0

    try:
        gltf: dict[str, Any] = json.loads(data[20:20 + json_length].decode("utf-8"))
        nodes = gltf["nodes"]
        mesh_names = {str(mesh.get("name", "")) for mesh in gltf["meshes"]}
        scenes = gltf["scenes"]
        scene = scenes[gltf.get("scene", 0)]
        if not _KEEP_MESH_NAMES.issubset(mesh_names):
            return data, 0
        if len(scene.get("nodes", [])) != 1:
            return data, 0
        root = nodes[scene["nodes"][0]]
        if root.get("name") != "isscombine":
            return data, 0
        children = root.get("children")
        if not isinstance(children, list) or not children:
            return data, 0

        removed = 0
        keep = []
        for index in children:
            child = nodes[index]
            if child.get("name") in _DETACHED_MESH_NAMES and child.get("mesh") is not None:
                removed += 1
            else:
                keep.append(index)
        if not removed or not keep:
            return data, 0
        if not _KEEP_MESH_NAMES.issubset({nodes[index].get("name") for index in keep}):
            return data, 0

        root["children"] = keep
        serialized = json.dumps(gltf, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
        serialized += b" " * (-len(serialized) % 4)
        # Keep untouched BIN and any extension chunks byte-for-byte.
        remainder = data[20 + json_length:]
        result = bytearray(data[:12])
        result.extend(struct.pack("<II", len(serialized), _JSON_CHUNK))
        result.extend(serialized)
        result.extend(remainder)
        struct.pack_into("<I", result, 8, len(result))
        return bytes(result), removed
    except (ValueError, KeyError, TypeError, IndexError, UnicodeDecodeError):
        # Never corrupt or replace an unfamiliar upstream GLB.
        return data, 0
