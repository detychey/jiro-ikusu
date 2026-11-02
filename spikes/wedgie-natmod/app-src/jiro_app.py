# The Jiro core test's code, which app/jiro.py runs once it holds the core's buffers. Shipped
# precompiled as app/jiro_app.mpy (scripts/build-app.sh), so that loading it builds no parse tree.
import gc
import json
import time
from binascii import unhexlify

import lcd
import ui

def check(jc, case, stack, recorder):
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
        failures += recorder_failures(jc, case, level, journal, stack, recorder)
    return failures, ticks, replay_us


def recorder_failures(jc, case, level, journal, stack, recorder):
    started = jc.start(recorder, level, journal[3], journal[4:36], journal[68], stack)
    if started != 0:
        return ["recorder start %d" % started]
    # The journal's input events (tick: 2 bytes, mask: 1 byte) give the mask held at each tick.
    event, events_end = 71, 71 + 3 * (journal[69] << 8 | journal[70])
    mask = end = 0
    for tick in range(case["ticks"]):
        if event < events_end and journal[event] << 8 | journal[event + 1] == tick:
            mask = journal[event + 2]
            event += 3
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


def check_all(stack, recorder, free_before):
    import jiro_core as jc
    if jc.recorder_size() > len(recorder):
        raise ValueError("jiro_core needs a %d B Recorder" % jc.recorder_size())
    gc.collect()
    print("jiro_core rules version", jc.rules_version(), "free before", free_before, "after", gc.mem_free())
    lines, failed = [], 0
    # One case per line, so only one case is in RAM at a time.
    with open("jiro_vectors.jsonl") as f:
        for line in f:
            case = json.loads(line)
            del line
            failures, ticks, replay_us = check(jc, case, stack, recorder)
            failed += bool(failures)
            verdict = "FAIL" if failures else "ok"
            print(verdict, case["name"], "ticks", ticks, "replay", replay_us, "us", failures)
            lines.append(("%s %s" % (verdict, case["name"][:18]), ui.RED if failures else ui.GREEN))
            del case
            gc.collect()
    return lines, failed


def show(lines, failed):
    gc.collect()
    summary = "PASS" if failed == 0 else "FAIL %d of %d" % (failed, len(lines))
    print("jiro core test:", summary)
    screen = lcd.LCD()
    ui.page(screen, "Jiro " + summary, lines, "{g} run again")
    keys = lcd.Keys()
    while "A" not in keys.pressed():
        time.sleep_ms(50)
