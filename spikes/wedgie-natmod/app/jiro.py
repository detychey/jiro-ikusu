# Jiro core test: replays four golden vectors through jiro_core.mpy, the Rust core built as a native
# module, and checks what the referee would compute. The result shows on the screen and goes to USB.
import gc
import json
import time
from binascii import unhexlify

import lcd
import ui

STACK_BYTES = 65536  # the core needs up to 63 KB of stack; the rp2 C stack is 8 KB


def check(jc, case, stack):
    level, journal = unhexlify(case["level"]), unhexlify(case["journal"])
    start = time.ticks_us()
    code, outcome, ticks, keccak, last = jc.replay(level, journal, case["weight"], stack)
    replay_us = time.ticks_diff(time.ticks_us(), start)
    failures = [field for field, ok in [
        ("code", code == case["code"]),
        ("ticks", ticks == case["ticks"]),
        ("traceKeccak", keccak.hex() == case["trace_keccak"]),
        ("last hash", ticks == 0 or last.hex() == case["last_hash"]),
    ] if not ok]
    if "outcome" in case:
        if outcome.hex() != case["outcome"]:
            failures.append("outcome")
        failures += recorder_failures(jc, case, level, journal, stack)
    return failures, ticks, replay_us


def recorder_failures(jc, case, level, journal, stack):
    recorder = bytearray(jc.recorder_size())
    started = jc.start(recorder, level, journal[3], journal[4:36], journal[68], stack)
    if started != 0:
        return ["recorder start %d" % started]
    end = 0
    for mask in unhexlify(case["masks"]):
        end = jc.step(recorder, mask)
        if end:
            break
    failures = []
    if end != case["end_reason"]:
        failures.append("recorder end %d" % end)
    if jc.journal(recorder) != journal:
        failures.append("recorder journal")
    if jc.state_hash(recorder, stack).hex() != case["last_hash"]:
        failures.append("recorder hash")
    return failures


def run():
    screen = lcd.LCD()
    gc.collect()
    free_before = gc.mem_free()
    import jiro_core as jc
    stack = bytearray(STACK_BYTES)
    gc.collect()
    print("jiro_core rules version", jc.rules_version(), "free before", free_before, "after", gc.mem_free())
    with open("jiro_vectors.json") as f:
        cases = json.load(f)
    lines, failed = [], 0
    for case in cases:
        failures, ticks, replay_us = check(jc, case, stack)
        failed += bool(failures)
        verdict = "FAIL" if failures else "ok"
        print(verdict, case["name"], "ticks", ticks, "replay", replay_us, "us", failures)
        lines.append(("%s %s" % (verdict, case["name"][:18]), ui.RED if failures else ui.GREEN))
    summary = "PASS" if failed == 0 else "FAIL %d of %d" % (failed, len(cases))
    print("jiro core test:", summary)
    ui.page(screen, "Jiro " + summary, lines, "{g} run again")
    keys = lcd.Keys()
    while "A" not in keys.pressed():
        time.sleep_ms(50)
