"""The Training app's play test (plan M3.9): runs wedgie/app/jiro.py's run(), unmodified, on
MicroPython v1.29.0's qemu MICROBIT port (scripts/build-qemu.sh builds it), with the wedgie's
lcd, ui, save and wedgie modules stubbed and the app's files served from a RAM filesystem. A
ballast fills the heap down to the given free bytes, the free RAM a wedgie reports with no app,
before run() starts. The scripted inputs pick level 1, play it with two captures and commit, up
to the summary screen. Then it checks:

- the journal the app printed: its header (Training, the stub's run nonce, level 1's id from
  seasons/calibration-1.json, levelIndex 0) and its events, which must be the changes of the
  README §6.1 mask that the scripted keys give under D8, Y and the joystick press never in it;
- the app's end reason, claim, ticks and score against native replay of that journal
  (`jiro-tools replay` with level 1's weight), and that it captured something;
- the best score it stored, the free heap and largest free block it printed, and no overrun.

It prints the app's step, render and tick maxima in qemu microseconds and in instructions. qemu
runs with -icount shift=3, 8 ns of virtual time per instruction, and the port's ticks assume a
25 MHz SysTick that qemu's nRF51 clocks at 16 MHz, so one microsecond the app measures is
1,562.5 / 8 = 195.3 instructions (measured with an inline-assembler loop of known length).

Usage: python3 -I qemu_app_check.py <firmware.elf> <app dir> <free bytes>

Run it under a timeout: a module that hard-faults hangs qemu. Exit status 0 when every check
passes.
"""

import ast
import base64
import importlib.util
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

spec = importlib.util.spec_from_file_location("qemu_natmod_vectors", Path(__file__).parent / "qemu_natmod_vectors.py")
qemu_natmod_vectors = importlib.util.module_from_spec(spec)
spec.loader.exec_module(qemu_natmod_vectors)

ICOUNT_SHIFT = 3
INSTRUCTIONS_PER_US = 1562.5 / 2 ** ICOUNT_SHIFT
RP2040_MHZ = 125
ROW_PUSH_US = 45  # a show_rect row on a wedgie (wedgie.dev/code.md)
RUN_NONCE = bytes.fromhex("277b9e3cebd776c6d46a8b4eb9b83ac165961f4b46a79baef5df1514bb5219cd")
LEVEL = "levels/01-open.bin"
HEADER_LEN = 71

# README §6.1 bits of the wedgie's key names (D8); Y and press are not controls.
BITS = {"up": 1, "down": 2, "left": 4, "right": 8, "A": 16, "B": 32, "X": 64}
# (ticks, keys held, keys tapped) from the player's start at (30, 59), the bottom rail.
SCRIPT = [
    (5, (), ()),
    (3, ("Y", "press"), ()),            # never in the mask
    (20, ("left",), ()),                # along the rail to (10, 59)
    (4, ("up",), ()),                   # a cut up to (10, 55)
    (8, ("left", "A"), ()),             # a fast cut that closes on the left border: a capture
    (1, (), ("B",)),                    # a tap shorter than a tick
    (15, ("up",), ()),                  # along the left border to (0, 40)
    (12, ("right",), ()),               # a cut to (12, 40)
    (19, ("down",), ()),                # closes on the bottom border: a second capture
    (1, ("X",), ()),                    # commit
]

# The menu presses before play: green on the level select picks level 1.
MENU = [["A"]]

STUBS = {
    "lcd.py": """\
import framebuf
_BUF = bytearray(28800)
_PALETTE = ((0, 0, 0), (255, 255, 255), (40, 100, 230), (255, 42, 42), (255, 220, 0), (60, 255, 120),
            (154, 154, 154), (34, 196, 82), (90, 90, 90))
def color(r, g, b):
  return min(range(len(_PALETTE)), key=lambda i: sum((a - b) ** 2 for a, b in zip(_PALETTE[i], (r, g, b))))
_rows = [0, 0]
class LCD(framebuf.FrameBuffer):
  def __init__(s):
    super().__init__(_BUF, 240, 240, framebuf.GS4_HMSB)
    s.buffer = _BUF
  def show(s, *a):
    _rows[0] += 240
  def show_rect(s, x, y, w, h):
    if not (0 <= x and 0 <= y and w > 0 and h > 0 and x + w <= 240 and y + h <= 240):
      raise ValueError('show_rect off the screen: %r' % ((x, y, w, h),))
    _rows[0] += h
  def center_text(s, t, y, c, scale=1):
    s.text(t, (240 - 8 * len(t)) // 2, y, c)
class ScriptDone(Exception):
  pass
_menu, _script, _tick, _play = MENU, SCRIPT, [0], [False]
class Keys:
  def held(s, name):
    _play[0] = True
    return _tick[0] < len(_script) and name in _script[_tick[0]][0]
  def pressed(s):
    if not _play[0]:
      return _menu.pop(0) if _menu else []
    if _tick[0] >= len(_script):
      raise ScriptDone('scripted inputs done; most rows pushed in a tick: %d' % _rows[1])
    if _tick[0]:
      _rows[1] = max(_rows[1], _rows[0])  # what the previous tick pushed
    _rows[0] = 0
    _tick[0] += 1
    return list(_script[_tick[0] - 1][1])
""",
    "ui.py": """\
WHITE, INK, MUTED, GREEN, GREEN_D, GREY, RED = 1, 0, 6, 7, 7, 8, 3
def page(screen, head, lines, hint):
  print('ui.page', repr(head), repr([line[0] for line in lines]), repr(hint))
""",
    "save.py": """\
_saves = {}
def load(name, default):
  return _saves.get(name, default)
def store(name, value):
  _saves[name] = value
  print('save.store', repr(name), repr(value))
""",
    "wedgie.py": """\
def rand(n):
  return NONCE[:n]
def rand_source():
  return 'qemu stub'
""",
}

# A RAM filesystem over _FILES, with the seek the app's level reads need.
VFS = """\
import sys, io, vfs, os
class _F(io.IOBase):
  def __init__(s, d): s.d = d; s.o = 0
  def __enter__(s): return s
  def __exit__(s, *a): pass
  def ioctl(s, r, a): return 0 if r == 4 else -1
  def readinto(s, b):
    n = min(len(b), len(s.d) - s.o); b[:n] = memoryview(s.d)[s.o:s.o + n]; s.o += n; return n
  def read(s, n=-1):
    n = len(s.d) - s.o if n < 0 else min(n, len(s.d) - s.o); s.o += n; return bytes(memoryview(s.d)[s.o - n:s.o])
  def seek(s, o, w=0):
    s.o = o if w == 0 else s.o + o if w == 1 else len(s.d) + o; return s.o
class _FS:
  def mount(s, r, m): pass
  def umount(s): pass
  def chdir(s, p): pass
  def getcwd(s): return ''
  def stat(s, p):
    if p.lstrip('/') in _FILES: return (0x8000, 0, 0, 0, 0, 0, len(_FILES[p.lstrip('/')]), 0, 0, 0)
    raise OSError(2)
  def open(s, p, m):
    if p.lstrip('/') not in _FILES: raise OSError(2)
    return _F(_FILES[p.lstrip('/')])
vfs.mount(_FS(), '/ram'); os.chdir('/ram'); sys.path.insert(0, '/ram')
"""

# Allocation is first fit: 512-byte chunks fill the heap's holes first, then the start of its top
# block, which a last buffer then trims to leave about `free` bytes, in one block at the top.
BALLAST = """\
import gc
gc.collect()
_B = [None] * (gc.mem_free() // 512)
i = 0
while gc.mem_free() > {free} + 2048:
  _B[i] = bytearray(512); i += 1
_P = bytearray(max(1, gc.mem_free() - {free} - 16))
gc.collect()
print('heap free with ballast', gc.mem_free())
"""


def upload_files(repl, files, chunk=3000):
    # Every buffer is allocated before any is filled, so the base64 chunks don't fragment the heap.
    repl.exec("_FILES.update({" + ", ".join(f"'{name}': bytearray({len(data)})" for name, data in files.items()) + "})")
    for name, data in files.items():
        for off in range(0, len(data), chunk):
            part = data[off:off + chunk]
            repl.exec(f"import binascii; _FILES['{name}'][{off}:{off + len(part)}] = "
                      f"binascii.a2b_base64('{base64.b64encode(part).decode()}')")


def run_app(repl):
    """Runs the app until the stub's scripted inputs end; returns its output and its error."""
    repl.p.stdin.write(b"import jiro; jiro.run()\x04")
    repl.p.stdin.flush()
    if repl.read_until(b"OK") != b"":
        raise SystemExit("raw REPL did not acknowledge the code")
    return repl.read_until(b"\x04").decode(), repl.read_until(b"\x04").decode()


def scripted_masks():
    masks = []
    for ticks, held, tapped in SCRIPT:
        masks += [sum(BITS.get(name, 0) for name in set(held) | set(tapped))] * ticks
    return masks


def expected_events(ticks_used):
    events, mask = b"", 0
    for tick, held in enumerate(scripted_masks()[:ticks_used]):
        if held != mask:
            events += tick.to_bytes(2, "big") + bytes([held])
            mask = held
    return events


def native_replay(repo, journal, weight):
    with tempfile.TemporaryDirectory() as scratch:
        path = Path(scratch) / "level1.jrn"
        path.write_bytes(journal)
        result = subprocess.run(["cargo", "run", "-q", "-p", "jiro-tools", "--locked", "--", "replay", "--level",
                                 str(repo / LEVEL), "--journal", str(path), "--weight", str(weight)],
                                cwd=repo, capture_output=True, text=True)
    if result.returncode != 0:
        raise SystemExit(f"FAIL: native replay of the app's journal: {result.stderr.strip()}")
    out = result.stdout
    return {line.split()[0]: int(line.split()[1]) for line in out.splitlines()
            if line.split()[0] in ("endReason", "claimBp", "ticksUsed", "levelScore")}


def fields(line, *names):
    words = line.split()
    return [int(words[words.index(name) + 1]) for name in names]


def check(out, err, repo):
    lines = out.splitlines()
    calibration = json.loads((repo / "seasons" / "calibration-1.json").read_text())
    level_id, weight = bytes.fromhex(calibration["levelIds"][0][2:]), calibration["weightsBp"][0]
    problems = []
    if "ScriptDone" not in err:
        problems.append("the app did not run to the end of the scripted inputs: " + err.strip()[-400:])
    heap = [line for line in lines if line.startswith("jiro: free heap")]
    level = [line for line in lines if line.startswith("jiro: level 1 ")]
    timing = [line for line in lines if line.startswith("jiro: step max")]
    if not (heap and level and timing):
        return problems + ["the app printed no heap, level or timing line"]
    end, claim, ticks, score = fields(level[0], "end", "claim_bp", "ticks", "score")
    journal = bytes.fromhex("".join(line.split()[2] for line in lines if line.startswith("jiro: journal ")))
    replayed = native_replay(repo, journal, weight)
    if [end, claim, ticks, score] != [replayed[key] for key in ("endReason", "claimBp", "ticksUsed", "levelScore")]:
        problems.append(f"the app shows end {end}, claim {claim}, ticks {ticks}, score {score}; native replay {replayed}")
    if claim == 0:
        problems.append("the scripted play captured nothing")
    header = (bytes([1]) + calibration["rulesVersion"].to_bytes(2, "big") + bytes([0]) + RUN_NONCE + level_id
              + bytes([0]) + (len(expected_events(ticks)) // 3).to_bytes(2, "big"))
    if journal[:HEADER_LEN] != header:
        problems.append(f"journal header {journal[:HEADER_LEN].hex()}")
    if journal[HEADER_LEN:] != expected_events(ticks):
        problems.append(f"journal events {journal[HEADER_LEN:].hex()}, expected {expected_events(ticks).hex()}")
    stored = [ast.literal_eval(line.split(" ", 2)[2]) for line in lines if line.startswith("save.store 'bests'")]
    key = f"{calibration['rulesVersion']}/0x{level_id.hex()}/{weight}"
    if not stored or stored[-1].get(key) != score:
        problems.append(f"stored bests {stored}, expected {key}: {score}")
    if not any(line.startswith("ui.page") and "'{g} next'" in line for line in lines):
        problems.append("the app showed no summary screen")
    step_us, render_us, tick_us, overruns = map(int, re.findall(r"\d+", timing[0]))
    if overruns:
        problems.append(f"{overruns} overruns")
    print(f"level 1: end {end}, claim {claim} bp, ticks {ticks}, score {score}; native replay agrees" if not problems
          else f"level 1: end {end}, claim {claim} bp, ticks {ticks}, score {score}")
    for name, us in (("step", step_us), ("render", render_us), ("tick", tick_us)):
        instructions = us * INSTRUCTIONS_PER_US
        print(f"worst {name}: {us} us on qemu, {instructions / 1e6:.2f} M instructions, "
              f"{instructions / RP2040_MHZ / 1000:.1f} ms at {RP2040_MHZ} MHz and one instruction per cycle")
    return problems


def main(firmware, app, free_bytes):
    repo = Path(__file__).resolve().parents[2]
    names = json.loads((app / "wedgie.json").read_text())["apps"][0]["files"]
    files = {name: (app / name).read_bytes() for name in names}
    stubs = dict(STUBS)
    stubs["lcd.py"] = f"MENU = {MENU!r}\nSCRIPT = {[(held, tapped) for ticks, held, tapped in SCRIPT for _ in range(ticks)]!r}\n" + stubs["lcd.py"]
    stubs["wedgie.py"] = f"NONCE = {RUN_NONCE!r}\n" + stubs["wedgie.py"]
    files.update({name: text.encode() for name, text in stubs.items()})
    qemu = qemu_natmod_vectors.QEMU
    qemu[qemu.index("shift=0")] = f"shift={ICOUNT_SHIFT}"
    repl = qemu_natmod_vectors.RawRepl(firmware)
    try:
        # The filesystem's objects first, then the files, then the firmware's modules (the stubs,
        # with the 28,800-byte screen buffer), all before the ballast: on a wedgie the files are
        # in flash, and the free RAM it reports already excludes the firmware's modules.
        repl.exec("_FILES = {}\n" + VFS)
        upload_files(repl, files)
        repl.exec("import lcd, ui, save, wedgie")
        print(repl.exec(BALLAST.format(free=free_bytes)), end="")
        out, err = run_app(repl)
    finally:
        repl.p.kill()
    print(out, end="")
    print(err.strip().splitlines()[-1] if err.strip() else "")
    problems = check(out, err, repo)
    for problem in problems:
        print("FAIL:", problem)
    print("qemu play test:", "PASS" if not problems else f"FAIL ({len(problems)})")
    return 1 if problems else 0


if __name__ == "__main__":
    if len(sys.argv) != 4:
        raise SystemExit(__doc__)
    sys.exit(main(sys.argv[1], Path(sys.argv[2]), int(sys.argv[3])))
