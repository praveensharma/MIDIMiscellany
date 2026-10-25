#!/usr/bin/env python3
"""Build and verify MIDIMiscellany in Ableton's Max4Live User Library.

Max MIDI effects use an AMPF container whose ``ptch`` chunk contains the Max
patch JSON. This project has no opaque template dependency: a MIDI-effect AMXD
with only a ptch chunk is sufficient, matching Max's own saved container shape.
"""

from __future__ import annotations

import argparse
import json
import os
import struct
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
DEVICE_DIR = ROOT / "device"
SOURCE = DEVICE_DIR / "MIDIMiscellany.maxpat"
INSTALL_DIR = Path.home() / "Music/Ableton/User Library/Max4Live/MIDIMiscellany"
OUTPUT = INSTALL_DIR / "MIDIMiscellany.amxd"
DEPENDENCIES = (
    (DEVICE_DIR / "midimiscellany.js", "midimiscellany_runtime_v23.js"),
    (DEVICE_DIR / "retrospective_core.js", "retrospective_core.js"),
)
PREFIX = b"ampf" + struct.pack("<I", 4) + b"mmmm"


def source_payload() -> tuple[bytes, object]:
    raw = SOURCE.read_bytes().rstrip(b"\0")
    parsed = json.loads(raw.decode("utf-8"))
    if not isinstance(parsed, dict) or "patcher" not in parsed:
        raise ValueError("source JSON does not contain a patcher")
    if not raw.endswith(b"\n"):
        raw += b"\n"
    return raw + b"\0", parsed


def encode(patch: bytes) -> bytes:
    return PREFIX + b"ptch" + struct.pack("<I", len(patch)) + patch


def decode(payload: bytes) -> object:
    if len(payload) < 20 or payload[:12] != PREFIX or payload[12:16] != b"ptch":
        raise ValueError("not the expected AMPF/ptch container")
    size = struct.unpack_from("<I", payload, 16)[0]
    if 20 + size != len(payload):
        raise ValueError("ptch size does not match file length")
    return json.loads(payload[20:].rstrip(b"\0").decode("utf-8"))


def atomic_write(path: Path, payload: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}.", suffix=".tmp", dir=path.parent
    )
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def build() -> None:
    patch, parsed = source_payload()
    payload = encode(patch)
    if decode(payload) != parsed:
        raise ValueError("generated patch differs from source")
    INSTALL_DIR.mkdir(parents=True, exist_ok=True)
    atomic_write(OUTPUT, payload)
    for dependency, installed_name in DEPENDENCIES:
        atomic_write(INSTALL_DIR / installed_name, dependency.read_bytes())
    verify()
    print(f"built {OUTPUT} ({OUTPUT.stat().st_size} bytes)")


def verify() -> None:
    _, parsed = source_payload()
    if decode(OUTPUT.read_bytes()) != parsed:
        raise ValueError("embedded patch differs from source")
    for dependency, installed_name in DEPENDENCIES:
        copied = INSTALL_DIR / installed_name
        if not copied.exists() or copied.read_bytes() != dependency.read_bytes():
            raise ValueError(f"dependency mismatch: {installed_name}")
    print("verified AMXD patch JSON and JavaScript dependencies")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--verify", action="store_true", help="verify the installed User Library device"
    )
    parser.add_argument("--output-dir", type=Path, help="build locally instead of installing")
    args = parser.parse_args()
    global INSTALL_DIR, OUTPUT
    if args.output_dir:
        INSTALL_DIR = args.output_dir.resolve()
        OUTPUT = INSTALL_DIR / "MIDIMiscellany.amxd"
    verify() if args.verify else build()


if __name__ == "__main__":
    main()
