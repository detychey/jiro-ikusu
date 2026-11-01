"""Turns the repository's game vectors into binary cases for the Cortex-M0 harness.

Usage: python3 -I make_cases.py <repo> <out_dir>

Each case file (little-endian u32 fields): magic b"JCAS", level_len, journal_len, weight_bp,
expected code (0 for an Outcome, else the vector's error), recorded trace ticks, then the
110-byte Outcome (zeros for an error vector) and 2 pad bytes, the 32-byte traceKeccak, the
level bytes and the journal bytes. manifest.txt lists "<case path> <trace path> <name>" per line.
"""

import json
import struct
import sys
from pathlib import Path

OUTCOME_FIELDS = [
    ("journalHash", 32),
    ("levelId", 32),
    ("runNonce", 32),
    ("levelIndex", 1),
    ("drawSlot", 1),
    ("mode", 1),
    ("rulesVersion", 2),
    ("endReason", 1),
    ("claimBp", 2),
    ("ticksUsed", 2),
    ("levelScore", 4),
]


def hex_bytes(value):
    assert value.startswith("0x"), value
    return bytes.fromhex(value[2:])


def outcome_bytes(outcome):
    out = b""
    for key, width in OUTCOME_FIELDS:
        value = outcome[key]
        out += hex_bytes(value) if width == 32 else value.to_bytes(width, "big")
    assert len(out) == 110
    assert len(outcome) == 11, sorted(outcome)
    return out


def main(repo, out_dir):
    out_dir.mkdir(parents=True, exist_ok=True)
    lines = []
    for kind in ("game", "levels"):
        for path in sorted((repo / "vectors" / kind).glob("*.json")):
            vector = json.loads(path.read_text())
            assert vector["kind"] == "game", path
            level = hex_bytes(vector["level"])
            journal = hex_bytes(vector["journal"])
            trace_path = path.parent / vector["trace"]
            trace_ticks = trace_path.stat().st_size // 32
            if "error" in vector:
                code, outcome = vector["error"], bytes(110)
            else:
                code, outcome = 0, outcome_bytes(vector["outcome"])
            case = struct.pack(
                "<4s5I",
                b"JCAS",
                len(level),
                len(journal),
                vector["weightBp"],
                code,
                trace_ticks,
            )
            case += outcome + b"\0\0" + hex_bytes(vector["traceKeccak"]) + level + journal
            name = f"{kind}/{path.stem}"
            case_path = out_dir / f"{kind}-{path.stem}.bin"
            case_path.write_bytes(case)
            lines.append(f"{case_path} {trace_path} {name}")
    (out_dir / "manifest.txt").write_text("\n".join(lines) + "\n")
    print(f"{len(lines)} cases in {out_dir}")


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
