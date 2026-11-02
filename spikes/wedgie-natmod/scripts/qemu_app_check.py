"""Runs the wedgie test app's own checks (app/jiro.py's run(), unmodified) on MicroPython's qemu
MICROBIT port, with the wedgie's lcd and ui modules stubbed. The app's files and jiro_core.mpy
are served from a RAM filesystem. Usage:

  python3 -I -B qemu_app_check.py <firmware.elf> <app dir> <jiro_core.mpy> [free bytes]

With [free bytes], a ballast is allocated first so that about that much heap stays free, to
approximate the wedgie's RAM. Exit status 0 when the app prints PASS.
"""

import base64
import importlib.util
import sys
from pathlib import Path

spec = importlib.util.spec_from_file_location("qemu_natmod_vectors", Path(__file__).parent / "qemu_natmod_vectors.py")
qemu_natmod_vectors = importlib.util.module_from_spec(spec)
spec.loader.exec_module(qemu_natmod_vectors)

LCD_STUB = b"class LCD:\n  pass\nclass Keys:\n  def pressed(self):\n    return 'A'\n"
UI_STUB = b"RED = 1\nGREEN = 2\ndef page(screen, title, lines, hint):\n  print('ui.page', title, lines)\n"

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
    if n < 0: n = len(s.d) - s.o
    r = bytes(memoryview(s.d)[s.o:s.o + n]); s.o += len(r); return r.decode()
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


def upload_files(repl, files, chunk=3000):
    # Every buffer is allocated before any is filled, so the base64 chunks don't fragment the heap.
    repl.exec("_FILES.update({" + ", ".join(f"'{name}': bytearray({len(data)})" for name, data in files.items()) + "})")
    for name, data in files.items():
        for off in range(0, len(data), chunk):
            part = data[off:off + chunk]
            repl.exec(f"import binascii; _FILES['{name}'][{off}:{off + len(part)}] = "
                      f"binascii.a2b_base64('{base64.b64encode(part).decode()}')")


def main(firmware, app, mpy, free_bytes):
    files = {"jiro.py": (app / "jiro.py").read_bytes(), "jiro_vectors.json": (app / "jiro_vectors.json").read_bytes(),
             "jiro_core.mpy": Path(mpy).read_bytes(), "lcd.py": LCD_STUB, "ui.py": UI_STUB}
    repl = qemu_natmod_vectors.RawRepl(firmware)
    try:
        # The filesystem's objects first, then the files, so that the free heap stays in one piece as on
        # the wedgie, whose files are in flash.
        repl.exec("_FILES = {}\n" + VFS)
        upload_files(repl, files)
        print(repl.exec("import gc; gc.collect(); print('heap free after upload', gc.mem_free())"), end="")
        if free_bytes:
            print(repl.exec(f"_BALLAST = bytearray(gc.mem_free() - {free_bytes} - 64); gc.collect(); "
                            "print('heap free with ballast', gc.mem_free())"), end="")
        out = repl.exec("import jiro; jiro.run()")
        print(out, end="")
        return 0 if "jiro core test: PASS" in out else 1
    finally:
        repl.p.kill()


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], Path(sys.argv[2]), sys.argv[3], int(sys.argv[4]) if len(sys.argv) > 4 else 0))
