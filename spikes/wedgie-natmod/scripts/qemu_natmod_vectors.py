"""Loads jiro_core.mpy into MicroPython's qemu MICROBIT port (Cortex-M0) and checks game vectors:
replay's code, Outcome, tick count, traceKeccak and last state hash, then the Recorder path
(start, one step per tick, journal and final state hash), on the firmware scripts/build-qemu.sh
builds. Usage:

  python3 -I qemu_natmod_vectors.py <firmware.elf> <jiro_core.mpy> <repo> <vector name>...

e.g. game/open-field-empty game/open-field-capture game/worst-case game/rejected-level-id
It stops qemu when it ends, but hangs if the module hard-faults: run it under a timeout.
"""

import base64
import json
import subprocess
import sys
from pathlib import Path

QEMU = ["qemu-system-arm", "-M", "microbit", "-global", "nrf51-soc.flash-size=1048576",
        "-global", "nrf51-soc.sram-size=262144", "-nographic", "-monitor", "null",
        "-serial", "stdio", "-semihosting", "-icount", "shift=0", "-kernel"]

# A RAM filesystem holding one file, as tests/run-natmodtests.py injects an .mpy.
VFS = """\
import sys, io, vfs
class _F(io.IOBase):
  def __init__(s): s.o = 0
  def ioctl(s, r, a): return 0 if r == 4 else -1
  def readinto(s, b):
    b[:] = memoryview(_MPY)[s.o:s.o + len(b)]; s.o += len(b); return len(b)
class _FS:
  def mount(s, r, m): pass
  def chdir(s, p): pass
  def stat(s, p):
    if p == '/jiro_core.mpy': return tuple(0 for _ in range(10))
    raise OSError(-2)
  def open(s, p, m): return _F()
vfs.mount(_FS(), '/ram'); sys.path.insert(0, '/ram')
"""


class RawRepl:
    def __init__(self, firmware):
        self.p = subprocess.Popen(QEMU + [firmware], stdin=subprocess.PIPE, stdout=subprocess.PIPE)
        self.read_until(b">>> ")
        self.p.stdin.write(b"\r\x01")
        self.p.stdin.flush()
        self.read_until(b"raw REPL; CTRL-B to exit\r\n>")

    def read_until(self, end):
        data = b""
        while not data.endswith(end):
            byte = self.p.stdout.read(1)
            if not byte:
                raise SystemExit(f"qemu exited; output so far: {data[-400:]!r}")
            data += byte
        return data[: -len(end)]

    def exec(self, code):
        self.p.stdin.write(code.encode() + b"\x04")
        self.p.stdin.flush()
        assert self.read_until(b"OK") == b""
        out, err = self.read_until(b"\x04"), self.read_until(b"\x04")
        self.read_until(b">")
        if err:
            raise SystemExit(f"device error: {err.decode()}")
        return out.decode()

    def upload(self, name, data, chunk=3000):
        self.exec(f"{name} = bytearray({len(data)})")
        for off in range(0, len(data), chunk):
            b64 = base64.b64encode(data[off:off + chunk]).decode()
            self.exec(f"import binascii; {name}[{off}:{off + min(chunk, len(data) - off)}] = binascii.a2b_base64('{b64}')")


def masks(journal, ticks):
    count = int.from_bytes(journal[69:71], "big")
    events = {int.from_bytes(journal[71 + 3 * i:73 + 3 * i], "big"): journal[73 + 3 * i] for i in range(count)}
    out, mask = bytearray(), 0
    for tick in range(ticks):
        mask = events.get(tick, mask)
        out.append(mask)
    return bytes(out)


def main(firmware, mpy, repo, names):
    repl = RawRepl(firmware)
    repl.upload("_MPY", Path(mpy).read_bytes())
    repl.exec(VFS)
    print(repl.exec("import gc; gc.collect(); f0 = gc.mem_free(); import jiro_core as jc; gc.collect(); "
                    "stack = bytearray(65536); rec = bytearray(jc.recorder_size()); "
                    "print('rules', jc.rules_version(), 'module bytes', f0 - gc.mem_free() - 65536 - len(rec))"))
    failed = 0
    for name in names:
        kind, stem = name.split("/")
        vector = json.loads((Path(repo) / "vectors" / kind / f"{stem}.json").read_text())
        trace = (Path(repo) / "vectors" / kind / vector["trace"]).read_bytes()
        level, journal = bytes.fromhex(vector["level"][2:]), bytes.fromhex(vector["journal"][2:])
        repl.upload("L", level)
        repl.upload("J", journal)
        out = repl.exec(f"import time; t = time.ticks_us(); r = jc.replay(L, J, {vector['weightBp']}, stack); "
                        "t = time.ticks_diff(time.ticks_us(), t); "
                        "print(r[0], r[1].hex(), r[2], r[3].hex(), r[4].hex(), t)").split()
        code, outcome, ticks, keccak, last, us = int(out[0]), out[1], int(out[2]), out[3], out[4], int(out[5])
        want_code = vector.get("error", 0)
        bad = [k for k, ok in [("code", code == want_code), ("ticks", ticks == len(trace) // 32),
               ("traceKeccak", "0x" + keccak == vector["traceKeccak"]),
               ("last hash", ticks == 0 or bytes.fromhex(last) == trace[-32:])] if not ok]
        if want_code == 0:
            o = vector["outcome"]
            fields = [o["journalHash"][2:], o["levelId"][2:], o["runNonce"][2:]] + [
                o[k].to_bytes(w, "big").hex() for k, w in [("levelIndex", 1), ("drawSlot", 1), ("mode", 1),
                ("rulesVersion", 2), ("endReason", 1), ("claimBp", 2), ("ticksUsed", 2), ("levelScore", 4)]]
            if outcome != "".join(fields):
                bad.append("outcome")
            repl.upload("M", masks(journal, ticks))
            rec = repl.exec(f"c = jc.start(rec, L, {journal[3]}, J[4:36], {journal[68]}, stack); e = 0\n"
                            "for m in M:\n  e = jc.step(rec, m)\n  if e: break\n"
                            "print(c, e, jc.journal(rec) == J, jc.state_hash(rec, stack).hex())").split()
            if rec[0] != "0" or int(rec[1]) != o["endReason"] or rec[2] != "True" or bytes.fromhex(rec[3]) != trace[-32:]:
                bad.append(f"recorder {rec}")
        failed += bool(bad)
        print(("FAIL " if bad else "ok   ") + f"{name}: code {code}, ticks {ticks}, {us} us (icount) {bad or ''}")
    print(f"vectors: {len(names)}, failed: {failed}")
    repl.p.kill()
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4:]))
