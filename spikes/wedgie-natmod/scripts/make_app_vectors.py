"""Writes app/jiro_vectors.json: what the wedgie test app replays and the results it must reproduce,
taken from the repository's game vectors. Usage: python3 -I make_app_vectors.py <repo> <out> <vector>..."""

import json
import sys
from pathlib import Path

OUTCOME_INTS = [("levelIndex", 1), ("drawSlot", 1), ("mode", 1), ("rulesVersion", 2), ("endReason", 1),
                ("claimBp", 2), ("ticksUsed", 2), ("levelScore", 4)]


def masks(journal, ticks):
    count = int.from_bytes(journal[69:71], "big")
    events = {int.from_bytes(journal[71 + 3 * i:73 + 3 * i], "big"): journal[73 + 3 * i] for i in range(count)}
    out, mask = bytearray(), 0
    for tick in range(ticks):
        mask = events.get(tick, mask)
        out.append(mask)
    return bytes(out)


def entry(repo, name):
    vector = json.loads((repo / "vectors" / "game" / f"{name}.json").read_text())
    trace = (repo / "vectors" / "game" / vector["trace"]).read_bytes()
    journal = bytes.fromhex(vector["journal"][2:])
    ticks = len(trace) // 32
    case = {"name": name, "level": vector["level"][2:], "journal": vector["journal"][2:],
            "weight": vector["weightBp"], "code": vector.get("error", 0), "ticks": ticks,
            "trace_keccak": vector["traceKeccak"][2:], "last_hash": trace[-32:].hex() if ticks else ""}
    if "outcome" in vector:
        o = vector["outcome"]
        case["outcome"] = o["journalHash"][2:] + o["levelId"][2:] + o["runNonce"][2:] + "".join(
            o[key].to_bytes(width, "big").hex() for key, width in OUTCOME_INTS)
        case["end_reason"] = o["endReason"]
        case["masks"] = masks(journal, ticks).hex()
    return case


repo, out, names = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3:]
out.write_text(json.dumps([entry(repo, name) for name in names], separators=(",", ":")))
print(f"wrote {out}: {len(names)} vectors, {out.stat().st_size} bytes")
