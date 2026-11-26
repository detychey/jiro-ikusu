#!/usr/bin/env python3
# M5.9's GPU benchmark (referee/zk/README.md, Proving on a GPU), in Python 3.11's standard library
# only, since it runs on the rented machine. gpu-measure.sh calls its three commands:
#   plan <out> [--segment-po2 <n>] [--rounds <n>] [--redo <input>]...
#     prints the proofs left to make, one per line: the proof's id, then zk-host prove's arguments;
#   record <out> <id> <exit status> [--left <id>...]
#     reads <out>/proofs/<id>.log, .err and .gpu.csv into one JSON line of <out>/results.jsonl;
#   summary <out> [--segment-po2 <n>] [--price-usd-per-hour <p>] [--eth-usd <p>] [--gas-gwei <p>]
#     prints the summary into <out>/summary.md, lists the proofs for gpu-onchain.sh in
#     <out>/onchain.txt, and exits 1 when an acceptance criterion fails.
# A proof's id is <input>-p<segment po2>-<tag>, its tag r<round> on the ladder, sweep, or
# cold<session> and sentinel<session>. The newest record of an id is the one that counts.
import argparse
import hashlib
import json
import math
import re
import statistics
import sys
from datetime import datetime, timezone
from functools import reduce
from operator import or_
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
PROOF_OF_RECORD = REPO_ROOT / "seasons/testnet-0/runs/run-1.proof.json"
SEASON = REPO_ROOT / "seasons/testnet-1.json"
RUN_1_SCORE = 20310
SEAL_BYTES = 260
# RISC Zero's 97-bit security target allows segments of at most 2^21 cycles.
MIN_PO2, MAX_PO2 = 16, 21
WARM_ROLES = ("ladder", "sweep")
MIN_REPEATS = 3

SMALL_VECTORS = ("commit-at-tick-0", "commit-during-cut", "fast-cut", "event-at-last-tick", "slow-shield", "last-life-on-last-tick")
# The ladder: committed run-mode inputs of 7 to about 177 segments of 2^20 cycles, smallest first.
INPUTS = {
    "small": [f"vectors/game/{name}.json" for name in SMALL_VECTORS],
    "run1": ["seasons/testnet-0/runs/run-1.json", "--season", "seasons/testnet-0.json"],
    "mid": [f"vectors/levels/{level:02d}-worst.json" for level in (5, 6, 9, 11, 12, 13)],
    "high": [f"vectors/levels/{level:02d}-synthetic.json" for level in (1, 2, 7, 9, 12, 15)],
    "heaviest": [f"vectors/levels/{name}.json" for name in ("10-worst", "16-worst", "04-worst", "08-worst", "03-worst", "14-synthetic")],
    "overcap": ["vectors/levels/10-worst.json"] * 6,
}
# Each round in another order, so that a drift of the card is not tied to the size.
ROUND_ORDERS = (
    ["small", "run1", "mid", "high", "heaviest", "overcap"],
    ["overcap", "heaviest", "high", "mid", "run1", "small"],
    ["mid", "overcap", "small", "heaviest", "run1", "high"],
)
SWEEP_INPUTS = ("run1", "heaviest")
# 4 CPUs: docs/VERIFICATION.md (Proving) for small, docs/DEPLOYMENT.md for run 1.
CPU_SECONDS = {
    "small": {"segment_proofs_s": 2772.9, "recursion_s": 357.0, "groth16_s": 167.3, "total_s": 3297.2},
    "run1": {"segment_proofs_s": 3831.8, "recursion_s": 561.0, "groth16_s": 122.5, "total_s": 4515.3},
}
# Proving cycles of scripted players' runs, estimated from cycle fits, not people.
PLAYER_RUNS = (
    ("search bot, mean", 16.0e6),
    ("random-walk, mean", 20.6e6),
    ("random-walk, max", 42e6),
    ("bold/committer, mean", 44.6e6),
    ("bold/committer, max", 61e6),
    ("greedy bot, mean", 54.4e6),
    ("greedy bot, max", 79e6),
    ("edge-nibbler, mean", 69.7e6),
    ("edge-nibbler, max", 102e6),
    ("proposed cap", 150e6),
    ("cost-maximising legal run (estimate)", 2.9e9),
)
SETTLE_GAS = 530_256  # settleRun of testnet-0's run 1 through ZkReferee (docs/DEPLOYMENT.md)
HOUSE_SHARE_OF_RAKE = 0.8

TOLERANCE = 0.05
FLOOR_S = 3.0
MIN_R2 = 0.99
IDLE_GPU_MIB = 1024
BUSY_UTILIZATION = 50
# nvidia-smi's clock event reasons: hardware slowdown, software thermal, hardware thermal, power brake.
SLOWDOWN_REASONS = 0x8 | 0x20 | 0x40 | 0x80
POWER_CAP_REASON = 0x4
NEXT_SIZE_GPU_SHARE, NEXT_SIZE_HOST_SHARE, NEXT_SIZE_GAIN = 0.90, 0.70, 0.10

ID = re.compile(r"(?P<input>[a-z0-9]+)-p(?P<po2>\d+)-(?P<tag>r(?P<round>\d+)|sweep|cold\d+|sentinel\d+)")
LOG_FIELDS = {
    "image_id": (r"^image id: (0x[0-9a-f]+)$", str),
    "segments": (r"^segments: (\d+),", int),
    "total_cycles": (r"^segments: .*total cycles: (\d+)", int),
    "user_cycles": (r"^segments: .*user cycles: (\d+)", int),
    "segment_proofs_s": (r"^segment proofs: ([\d.]+) s$", float),
    "recursion_s": (r"^recursion to one succinct receipt: ([\d.]+) s$", float),
    "groth16_s": (r"^Groth16 wrapping: ([\d.]+) s$", float),
    "total_s": (r"^total: ([\d.]+) s$", float),
    "vmhwm_kib": (r"^peak RSS of this process \(VmHWM\): (\d+) kB$", int),
    "seal_bytes": (r"^seal: (\d+) bytes", int),
    "selector": (r"^seal: .*selector (0x[0-9a-f]+)$", str),
    "public_values_sha256": (r"^public values: \d+ bytes, sha256 (0x[0-9a-f]+)$", str),
    "wall_s": (r"^wall time: ([\d.]+) s$", float),
    "tree_rss_mib": (r"^peak RSS, command tree: (\d+) MiB$", int),
    "gpu_peak_mib": (r"^peak GPU memory in use, every process: (\d+) MiB", int),
    "gpu_before_mib": (r"^peak GPU memory in use, .*\((\d+) MiB before the command\)$", int),
}
VERIFY_FAILURE = re.compile(r"does not verify|outcome\.\w+ .*, expected|weightBp \d+, expected|verify guest committed \d+ bytes")
GPU_OUT_OF_MEMORY = re.compile(r"out of memory|OUT_OF_MEMORY|MemoryAllocation", re.IGNORECASE)
KILLED = 137


def parse_id(proof_id):
    match = ID.fullmatch(proof_id)
    if match is None or match["input"] not in INPUTS:
        raise ValueError(f"not a proof id: {proof_id}")
    role = "ladder" if match["round"] else re.sub(r"\d+$", "", match["tag"])
    return match["input"], int(match["po2"]), role, int(match["round"]) if match["round"] else None


def prove_args(proof_id):
    name, po2, _, _ = parse_id(proof_id)
    return ["--run", *INPUTS[name], "--segment-po2", str(po2)]


def read_json(path):
    return json.loads(Path(path).read_text())


def read_records(out):
    results = Path(out) / "results.jsonl"
    return [json.loads(line) for line in results.read_text().splitlines()] if results.exists() else []


def latest_records(out):
    return list({record["id"]: record for record in read_records(out)}.values())


def machine_files(out):
    return sorted(Path(out).glob("machine-s*.txt"), key=lambda path: int(re.search(r"\d+", path.name)[0]))


def read_machine(path):
    return dict(line.split(": ", 1) for line in path.read_text().splitlines() if ": " in line)


def plan(out, po2, rounds, redo):
    done = {record["id"] for record in read_records(out)}
    ladder = [f"{name}-p{po2}-r{n}" for n in range(1, rounds + 1) for name in ROUND_ORDERS[(n - 1) % len(ROUND_ORDERS)]]
    sweep = [f"{name}-p{size}-sweep" for size in (po2 - 1, po2 + 1) if size <= MAX_PO2 for name in SWEEP_INPUTS]
    pending = [proof_id for proof_id in ladder + sweep if proof_id not in done or parse_id(proof_id)[0] in redo]
    if not pending:
        return []
    session = len(machine_files(out))
    return [f"small-p{po2}-cold{session}", *pending, f"small-p{po2}-sentinel{session}"]


def parse_log(log):
    fields = {}
    for name, (pattern, kind) in LOG_FIELDS.items():
        match = re.search(pattern, log, re.MULTILINE)
        if match:
            fields[name] = kind(match[1])
    fields["verified"] = re.search(r"^verified: yes$", log, re.MULTILINE) is not None
    return fields


def telemetry(csv_text):
    samples, malformed = [], 0
    for line in csv_text.splitlines():
        try:
            _, sm_clock, temperature, power, utilization, memory, reasons = (cell.strip() for cell in line.split(","))
            samples.append((float(sm_clock), float(temperature), float(power), float(utilization), float(memory), int(reasons, 16)))
        except ValueError:
            malformed += 1
    if not samples:
        return {"samples": 0, "malformed_samples": malformed}
    sm_clock, temperature, power, utilization, memory, reasons = zip(*samples)
    busy_clocks = [clock for clock, busy in zip(sm_clock, utilization) if busy >= BUSY_UTILIZATION]
    return {
        "samples": len(samples),
        "malformed_samples": malformed,
        "sm_clock_busy_median_mhz": statistics.median(busy_clocks) if busy_clocks else None,
        "temperature_max_c": max(temperature),
        "power_max_w": max(power),
        "utilization_median_pct": statistics.median(utilization),
        "gpu_memory_max_mib": max(memory),
        "clock_event_reasons": hex(reduce(or_, reasons)),
        "slowdown_samples": sum(1 for bits in reasons if bits & SLOWDOWN_REASONS),
        "power_cap_samples": sum(1 for bits in reasons if bits & POWER_CAP_REASON),
    }


def classify(exit_status, fields, err, expected):
    """The proof's status and, unless it is ok, why."""
    if exit_status == 0:
        selector = expected["seal"][: 2 + 8]
        problems = [
            problem
            for failed, problem in (
                (not fields["verified"], "no 'verified: yes'"),
                (fields.get("image_id") != expected["imageId"], f"image id {fields.get('image_id')}, expected {expected['imageId']}"),
                (fields.get("seal_bytes") != SEAL_BYTES, f"seal of {fields.get('seal_bytes')} bytes, expected {SEAL_BYTES}"),
                (fields.get("selector") != selector, f"selector {fields.get('selector')}, expected {selector}"),
            )
            if failed
        ]
        return ("verify-fail", "; ".join(problems)) if problems else ("ok", "")
    lines = [line for line in err.splitlines() if line.strip()]
    message = next((line for line in lines if line.startswith("zk-host:")), lines[-1] if lines else f"exit status {exit_status}")
    if VERIFY_FAILURE.search(err):
        return "verify-fail", message
    if exit_status == KILLED:
        return "oom-host", f"{message} (exit status {KILLED}: killed, as by the out-of-memory killer)"
    if GPU_OUT_OF_MEMORY.search(err) and "Guest panicked" not in err:
        return "oom-gpu", message
    return "error", message


def record(out, proof_id, exit_status, left):
    name, po2, role, round_number = parse_id(proof_id)
    proofs = Path(out) / "proofs"
    fields = parse_log((proofs / f"{proof_id}.log").read_text())
    status, error = classify(exit_status, fields, (proofs / f"{proof_id}.err").read_text(), read_json(PROOF_OF_RECORD))
    entry = {
        "id": proof_id,
        "input": name,
        "po2": po2,
        "role": role,
        "round": round_number,
        "session": len(machine_files(out)),
        "utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "exit": exit_status,
        "status": status,
        "error": error,
        **fields,
        **telemetry((proofs / f"{proof_id}.gpu.csv").read_text()),
    }
    with (Path(out) / "results.jsonl").open("a") as results:
        results.write(json.dumps(entry) + "\n")
    wall = f", wall {entry['wall_s']:.1f} s" if "wall_s" in entry else ""
    print(f"gpu-bench: {proof_id}: {status}{wall}{f': {error}' if error else ''}")
    print(f"gpu-bench: {remaining(latest_records(out), left)}")
    return entry


def remaining(records, left):
    """The time left, estimated from the proofs of the same input already made."""
    walls = {}
    for entry in records:
        if entry["status"] == "ok":
            walls.setdefault((entry["input"], entry["po2"]), []).append(entry["wall_s"])
            walls.setdefault(entry["input"], []).append(entry["wall_s"])
    seconds, untimed = 0.0, 0
    for proof_id in left:
        name, po2, _, _ = parse_id(proof_id)
        timed = walls.get((name, po2)) or walls.get(name)
        if timed:
            seconds += statistics.median(timed)
        else:
            untimed += 1
    untimed_text = f", plus {untimed} not yet timed" if untimed else ""
    return f"{len(left)} proofs left, about {seconds / 60:.0f} min (estimate){untimed_text}"


def fit(points):
    """wall = a + b x segments, by least squares: (a, b, R^2)."""
    xs, ys = zip(*points)
    slope, intercept = statistics.linear_regression(xs, ys)
    residual = sum((y - intercept - slope * x) ** 2 for x, y in points)
    total = sum((y - statistics.fmean(ys)) ** 2 for y in ys)
    return intercept, slope, 1 - residual / total if total else 1.0


def warm_by_input(records, po2):
    warm = {}
    for entry in records:
        if entry["status"] == "ok" and entry["po2"] == po2 and entry["role"] in WARM_ROLES:
            warm.setdefault(entry["input"], []).append(entry)
    return {name: warm[name] for name in INPUTS if name in warm}


def median_of(entries, field):
    values = [entry[field] for entry in entries if entry.get(field) is not None]
    return statistics.median(values) if values else None


def within(value, reference, floor=0.0):
    return abs(value - reference) <= max(TOLERANCE * reference, floor)


def verdict(passed, detail):
    return ("PASS" if passed else "FAIL", detail)


def check_image_id(records, expected):
    wrong = [entry["id"] for entry in records if entry.get("image_id", expected["imageId"]) != expected["imageId"]]
    return verdict(not wrong, f"other image id: {', '.join(wrong)}" if wrong else f"every proof: {expected['imageId']}")


def check_local_proofs(records, expected):
    problems = [f"{entry['id']}: {entry['error']}" for entry in records if entry["status"] == "verify-fail"]
    for name in INPUTS:
        hashes = {entry["public_values_sha256"] for entry in records if entry["input"] == name and entry["status"] == "ok"}
        if len(hashes) > 1:
            problems.append(f"{name}: {len(hashes)} different public values")
    of_record = "0x" + hashlib.sha256(bytes.fromhex(expected["publicValues"][2:])).hexdigest()
    run1 = {entry["public_values_sha256"] for entry in records if entry["input"] == "run1" and entry["status"] == "ok"}
    if run1 - {of_record}:
        problems.append("run1: public values differ from the CPU proof of record")
    passed = "verified with a 260-byte seal, the same public values per input, run 1's equal to the CPU proof's"
    return verdict(not problems, "; ".join(problems) or passed)


def check_spread(warm):
    spreads, wide = [], []
    for name, entries in warm.items():
        if len(entries) < 2:
            continue
        walls = [entry["wall_s"] for entry in entries]
        middle = statistics.median(walls)
        spreads.append(f"{name} {(max(walls) - min(walls)) / middle:.1%}")
        if max(walls) - min(walls) > max(TOLERANCE * middle, FLOOR_S):
            wide.append(name)
    if not spreads:
        return verdict(False, "no input proven twice")
    return verdict(not wide, ("too wide: " + ", ".join(wide) + "; " if wide else "") + ", ".join(spreads))


def check_throttling(included, machine):
    problems = []
    for entry in included:
        if not entry.get("samples"):
            problems.append(f"{entry['id']}: no telemetry")
        if entry.get("slowdown_samples"):
            problems.append(f"{entry['id']}: {entry['slowdown_samples']} samples slowed down ({entry['clock_event_reasons']})")
        if entry.get("gpu_before_mib") is None or entry["gpu_before_mib"] >= IDLE_GPU_MIB:
            problems.append(f"{entry['id']}: {entry.get('gpu_before_mib')} MiB in use before")
    clocks = {entry["id"]: entry["sm_clock_busy_median_mhz"] for entry in included if entry.get("sm_clock_busy_median_mhz")}
    if clocks:
        middle = statistics.median(clocks.values())
        problems += [f"{proof_id}: SM clock {clock:.0f} MHz against {middle:.0f}" for proof_id, clock in clocks.items() if not within(clock, middle)]
    limit, default = machine.get("gpu power.limit"), machine.get("gpu power.default_limit")
    power = f"; power limit {limit} W, default {default} W" if limit else ""
    return verdict(bool(included) and not problems, ("; ".join(problems) or f"{len(included)} proofs, no slowdown") + power)


def check_model(points):
    if len(points) < 3:
        return verdict(False, f"{len(points)} inputs measured, 3 needed"), None
    model = fit(points.values())
    intercept, slope, r2 = model
    off = [name for name, (x, y) in points.items() if not within(y, intercept + slope * x, FLOOR_S)]
    largest = max(points, key=lambda name: points[name][0])
    rest_intercept, rest_slope, _ = fit([point for name, point in points.items() if name != largest])
    x, y = points[largest]
    error = (rest_intercept + rest_slope * x - y) / y
    passed = r2 >= MIN_R2 and not off and abs(error) <= TOLERANCE
    detail = f"R^2 {r2:.4f}; residuals over 5% and 3 s: {', '.join(off) or 'none'}; {largest} predicted without it within {error:+.1%}"
    return verdict(passed, detail), model


def check_complete(records, warm, po2):
    short = [f"{name} ({len(warm.get(name, []))})" for name in INPUTS if len(warm.get(name, [])) < MIN_REPEATS]
    upper_tried = po2 + 1 > MAX_PO2 or any(entry["input"] == "heaviest" and entry["po2"] == po2 + 1 for entry in records)
    problems = [f"fewer than {MIN_REPEATS} warm proofs: {', '.join(short)}"] if short else []
    if not upper_tried:
        problems.append(f"heaviest at 2^{po2 + 1} not tried")
    return verdict(not problems, "; ".join(problems) or f"{MIN_REPEATS} or more warm proofs of every input")


def check_drift(records, warm, po2):
    if "small" not in warm:
        return verdict(False, "no warm proof of small")
    small = median_of(warm["small"], "wall_s")
    sentinels = [entry for entry in records if entry["role"] == "sentinel" and entry["po2"] == po2 and entry["status"] == "ok"]
    problems = [f"{entry['id']} {entry['wall_s']:.1f} s against {small:.1f} s" for entry in sentinels if not within(entry["wall_s"], small, FLOOR_S)]
    if not sentinels:
        problems.append("no sentinel")
    medians = {name: median_of(entries, "wall_s") for name, entries in warm.items()}
    ratios = {}
    for name, entries in warm.items():
        for entry in entries:
            if entry["role"] == "ladder":
                ratios.setdefault(entry["round"], []).append(entry["wall_s"] / medians[name])
    rounds = {number: statistics.median(values) for number, values in sorted(ratios.items())}
    problems += [f"round {number} at {ratio:.1%} of the medians" for number, ratio in rounds.items() if not within(ratio, 1.0)]
    return verdict(not problems, "; ".join(problems) or f"{len(sentinels)} sentinel(s) and {len(rounds)} round(s) within 5%")


def segment_size_rule(records, warm, machine, po2):
    upper = po2 + 1
    if upper > MAX_PO2:
        return f"2^{po2} is the largest size allowed"
    tried = [entry for entry in records if entry["input"] == "heaviest" and entry["po2"] == upper]
    if not tried or "heaviest" not in warm:
        return f"undecided: heaviest at 2^{upper} and 2^{po2} not both tried"
    entry, base = tried[-1], median_of(warm["heaviest"], "wall_s")
    if entry["status"] != "ok":
        return f"stay at 2^{po2}: heaviest at 2^{upper} ended {entry['status']}"
    vram_mib = float(machine["gpu memory.total"])
    limit = machine.get("cgroup memory.max", "max")
    host_kib = min(int(machine["memory"].split()[0]), int(limit) // 1024 if limit.isdigit() else math.inf)
    conditions = [
        (entry["gpu_peak_mib"] <= NEXT_SIZE_GPU_SHARE * vram_mib, f"GPU peak {entry['gpu_peak_mib']} of {vram_mib:.0f} MiB"),
        (entry["vmhwm_kib"] <= NEXT_SIZE_HOST_SHARE * host_kib, f"VmHWM {entry['vmhwm_kib'] / 2**20:.1f} of {host_kib / 2**20:.1f} GiB"),
        (entry["wall_s"] <= (1 - NEXT_SIZE_GAIN) * base, f"wall {entry['wall_s']:.1f} s against {base:.1f} s"),
    ]
    detail = ", ".join(text for _, text in conditions)
    if all(passed for passed, _ in conditions):
        return f"use 2^{upper} once gpu-onchain.sh accepts {entry['id']}, after a ladder at 2^{upper}: {detail}"
    return f"stay at 2^{po2}: {detail}"


def table(rows):
    return [f"| {' | '.join(rows[0])} |", f"|{'---|' * len(rows[0])}", *(f"| {' | '.join(row)} |" for row in rows[1:])]


def number(value, digits=1):
    return "—" if value is None else f"{value:,.{digits}f}"


def proofs_table(records):
    groups = {}
    for entry in records:
        if entry["status"] == "ok" and entry["role"] in WARM_ROLES:
            groups.setdefault((entry["po2"], list(INPUTS).index(entry["input"])), []).append(entry)
    rows = [[
        "Input", "Segment limit", "Segments", "Proving cycles", "Proofs", "Wall s, median (min–max)", "Segment proofs s",
        "Recursion s", "Groth16 s", "Wall s per segment", "Peak GPU MiB", "VmHWM GiB", "SM clock MHz", "Max °C",
    ]]
    for (po2, _), entries in sorted(groups.items()):
        walls = [entry["wall_s"] for entry in entries]
        first = entries[0]
        rows.append([
            first["input"], f"2^{po2}", str(first["segments"]), f"{first['total_cycles']:,}", str(len(entries)),
            f"{statistics.median(walls):,.1f} ({min(walls):,.1f}–{max(walls):,.1f})",
            number(median_of(entries, "segment_proofs_s")), number(median_of(entries, "recursion_s")), number(median_of(entries, "groth16_s")),
            number(statistics.median(walls) / first["segments"], 2), number(max(entry.get("gpu_peak_mib", 0) for entry in entries), 0),
            number(max(entry.get("vmhwm_kib", 0) for entry in entries) / 2**20), number(median_of(entries, "sm_clock_busy_median_mhz"), 0),
            number(max(entry.get("temperature_max_c", 0) for entry in entries), 0),
        ])
    return table(rows)


def build_seconds(out):
    logs = machine_files(out) + sorted((Path(out) / "previous").glob("*.log"))
    seconds = [int(match[1]) for path in logs for match in re.finditer(r"^set-up and build: (\d+) s$", path.read_text(), re.MULTILINE)]
    return max(seconds) if seconds else None


def cost_rows(warm, po2, model, model_passed, prices):
    """The measured inputs at their median wall time, then the players' runs at the model's."""
    price, eth_usd, settle_eth, rake_eth, grace_s, overhead_s = prices
    largest = max(entries[0]["segments"] for entries in warm.values())
    sizes = [(name, entries[0]["total_cycles"], entries[0]["segments"], median_of(entries, "wall_s")) for name, entries in warm.items()]
    for name, cycles in PLAYER_RUNS:
        segments = math.ceil(cycles / 2**po2)
        inside = segments <= largest
        # A model that failed A6 prices nothing beyond the measured range.
        wall = model[0] + model[1] * segments if inside or model_passed else None
        sizes.append((name if inside else f"{name}, extrapolated {segments / largest:.0f}x", int(cycles), segments, wall))
    rows = [[
        "Run", "Proving cycles", "Segments", "Wall s", "Runs per hour", "Proving USD", "Proving + settling ETH",
        "Runs' rake at 80% to pay it", "Runs in the grace, margin 2",
    ]]
    for label, cycles, segments, wall in sizes:
        if wall is None:
            rows.append([label, f"{cycles:,}", str(segments), "—", "—", "—", "—", "—", "—"])
            continue
        prove_usd = price * wall / 3600
        total_eth = prove_usd / eth_usd + settle_eth
        rows.append([
            label, f"{cycles:,}", str(segments), number(wall), number(3600 / wall), f"{prove_usd:.4f}", f"{total_eth:.7f}",
            number(total_eth / (HOUSE_SHARE_OF_RAKE * rake_eth)), f"{math.floor((grace_s - overhead_s) / (2 * wall)):,}",
        ])
    return table(rows)


def summary(out, po2, price, eth_usd, gas_gwei):
    out = Path(out)
    records, expected, season = latest_records(out), read_json(PROOF_OF_RECORD), read_json(SEASON)
    machines = machine_files(out)
    machine = read_machine(machines[-1]) if machines else {}
    warm = warm_by_input(records, po2)
    points = {name: (entries[0]["segments"], median_of(entries, "wall_s")) for name, entries in warm.items()}
    model_verdict, model = check_model(points)
    included = [entry for entries in warm.values() for entry in entries] + [
        entry for entry in records if entry["role"] == "sentinel" and entry["po2"] == po2 and entry["status"] == "ok"
    ]
    criteria = [
        ("A1", "image id", check_image_id(records, expected), True),
        ("A2", "local proofs (C2, C3, C4)", check_local_proofs(records, expected), True),
        ("A3", "onchain (C5)", ("PENDING", f"off the pod: bash referee/zk/gpu-onchain.sh {out.name}, run 1 at {RUN_1_SCORE}"), False),
        ("A4", "repeat spread within 5% or 3 s", check_spread(warm), False),
        ("A5", "no slowdown, steady clock, idle card before each proof", check_throttling(included, machine), False),
        ("A6", "linear model", model_verdict, False),
        ("A7", "complete", check_complete(records, warm, po2), False),
        ("A8", "drift within 5% (the sentinel: or 3 s)", check_drift(records, warm, po2), False),
    ]
    loud = [key for key, _, (result, _), is_loud in criteria if is_loud and result == "FAIL"]
    colds = [entry["wall_s"] for entry in records if entry["role"] == "cold" and entry["po2"] == po2 and entry["status"] == "ok"]
    cold_extra = statistics.median(colds) - median_of(warm["small"], "wall_s") if colds and "small" in warm else None
    build = build_seconds(out)
    overhead_s = (build or 0) + (cold_extra or 0)
    settle_eth = SETTLE_GAS * gas_gwei * 1e-9
    rake_eth = int(season["runFee"]) * season["rakeBp"] / 10_000 / 1e18
    prices = (price, eth_usd, settle_eth, rake_eth, season["grace"], overhead_s)

    lines = ["# GPU benchmark summary", ""]
    if loud:
        lines += [f"**LOUD: {' and '.join(loud)} failed. Do not settle with these proofs until it is explained.**", ""]
    for path in machines:
        info = read_machine(path)
        lines.append(
            f"- Session {info.get('session')}: {info.get('utc')}, commit {info.get('commit', '')[:7]}"
            f" ({info.get('tracked files changed')} tracked files changed), {info.get('gpu name')} {info.get('gpu uuid')},"
            f" {info.get('gpu memory.total')} MiB, driver {info.get('gpu driver_version')}, {info.get('cpus')} CPUs,"
            f" zk-host sha256 {info.get('zk-host sha256', '')[:12]}, set-up and build {info.get('set-up and build')}"
        )
    lines += ["", "## Warm proofs, at every segment size", "", *proofs_table(records), ""]
    others = [entry for entry in records if entry["status"] != "ok" or entry["role"] not in WARM_ROLES]
    lines += [f"- {entry['id']}: {entry['status']}, wall {number(entry.get('wall_s'))} s" + (f": {entry['error']}" if entry["error"] else "") for entry in others]
    lines += ["", f"## Model at 2^{po2}: wall = a + b × segments", ""]
    if model:
        lines.append(f"Fit on each input's median wall time: a = {model[0]:.1f} s, b = {model[1]:.2f} s per segment, R² = {model[2]:.4f}.")
        lines += [f"- {name}: {x} segments, {y:.1f} s, fit {model[0] + model[1] * x:.1f} s" for name, (x, y) in points.items()]
        lines += ["", "Per phase, on the same medians:"]
        for field in ("total_s", "segment_proofs_s", "recursion_s", "groth16_s", "vmhwm_kib"):
            phase_points = [(entries[0]["segments"], median_of(entries, field)) for entries in warm.values() if median_of(entries, field) is not None]
            if len(phase_points) >= 2:
                a, b, r2 = fit(phase_points)
                lines.append(f"- {field}: a = {a:,.1f}, b = {b:,.2f} per segment, R² = {r2:.4f}")
    else:
        lines.append("Not enough inputs measured for a fit.")
    lines += ["", f"Segment size: {segment_size_rule(records, warm, machine, po2)}.", ""]
    lines += [
        f"## Cost per run at {price} USD an hour, ETH at {eth_usd:,.0f} USD (estimates)",
        "",
        f"Settling one run: {SETTLE_GAS:,} gas × {gas_gwei} gwei = {settle_eth:.7f} ETH ({settle_eth * eth_usd:.4f} USD), without an L1 data fee. "
        f"Rake of one run on testnet-1: {rake_eth:.7f} ETH ({rake_eth * eth_usd:.4f} USD), 80% of it {HOUSE_SHARE_OF_RAKE * rake_eth:.7f} ETH.",
        f"Session overhead: set-up and build {number(build, 0)} s, cold start {number(cold_extra)} s more than a warm proof:"
        f" {overhead_s:,.0f} s, {price * overhead_s / 3600:.3f} USD. Grace of {season['grace']:,} s.",
        "",
        *(cost_rows(warm, po2, model, model_verdict[0] == "PASS", prices) if model else ["No model, so no cost per run."]),
        "",
        "## Against 4 CPUs",
        "",
    ]
    for name, cpu in CPU_SECONDS.items():
        if name not in warm:
            continue
        for field, seconds in cpu.items():
            here = median_of(warm[name], field)
            lines.append(f"- {name}, {field}: {seconds:,.1f} s on 4 CPUs, {here:,.1f} s here, {seconds / here:,.0f}x")
    rows = [[key, name, result, detail] for key, name, (result, detail), _ in criteria]
    lines += ["", "## Acceptance criteria", "", *table([["#", "Criterion", "Verdict", "Detail"], *rows])]
    text = "\n".join(lines) + "\n"
    (out / "summary.md").write_text(text)
    (out / "onchain.txt").write_text("".join(onchain_line(entry) + "\n" for entry in onchain_order(records, po2)))
    print(text, end="")
    return 1 if any(result == "FAIL" for _, _, (result, _), _ in criteria) else 0


def onchain_order(records, po2):
    """Run 1 first, then each input's first round and the sweep: the calls that matter most."""

    def rank(entry):
        if entry["id"] == f"run1-p{po2}-r1":
            return 0
        if entry["round"] == 1:
            return 1
        return {"sweep": 2, "ladder": 3}.get(entry["role"], 4)

    return sorted((entry for entry in records if entry["status"] == "ok"), key=rank)


def onchain_line(entry):
    """<id> <expected run score> <verify-proof.mjs arguments>, for gpu-onchain.sh."""
    files = INPUTS[entry["input"]]
    if "--season" in files:
        return f"{entry['id']} {RUN_1_SCORE} --run {' '.join(files)}"
    score = sum(read_json(REPO_ROOT / file)["outcome"]["levelScore"] for file in files)
    return f"{entry['id']} {score} --vectors {' '.join(files)}"


def main(argv):
    parser = argparse.ArgumentParser(description="M5.9's GPU benchmark: its plan, its records and its summary.")
    commands = parser.add_subparsers(dest="command", required=True)
    po2_choices = range(MIN_PO2, MAX_PO2 + 1)
    plan_parser = commands.add_parser("plan")
    plan_parser.add_argument("out")
    plan_parser.add_argument("--segment-po2", type=int, default=20, choices=po2_choices)
    plan_parser.add_argument("--rounds", type=int, default=MIN_REPEATS, choices=range(1, 10))
    plan_parser.add_argument("--redo", action="append", default=[], choices=list(INPUTS))
    record_parser = commands.add_parser("record")
    record_parser.add_argument("out")
    record_parser.add_argument("id")
    record_parser.add_argument("exit_status", type=int)
    record_parser.add_argument("--left", nargs="*", default=[])
    summary_parser = commands.add_parser("summary")
    summary_parser.add_argument("out")
    summary_parser.add_argument("--segment-po2", type=int, default=20, choices=po2_choices)
    summary_parser.add_argument("--price-usd-per-hour", type=float, default=0.34)
    summary_parser.add_argument("--eth-usd", type=float, default=1700.0)
    summary_parser.add_argument("--gas-gwei", type=float, default=0.02)
    args = parser.parse_args(argv)
    if args.command == "plan":
        for proof_id in plan(args.out, args.segment_po2, args.rounds, args.redo):
            print(proof_id, *prove_args(proof_id))
        return 0
    if args.command == "record":
        record(args.out, args.id, args.exit_status, args.left)
        return 0
    return summary(args.out, args.segment_po2, args.price_usd_per_hour, args.eth_usd, args.gas_gwei)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
