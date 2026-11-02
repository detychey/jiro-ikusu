#!/usr/bin/env bash
# Precompiles app-src/jiro_app.py into app/jiro_app.mpy (bytecode, mpy v6) with MicroPython v1.29.0's
# mpy-cross, which scripts/build-qemu.sh builds: the wedgie runs MicroPython 1.29.0.
set -euo pipefail
S=$(cd "$(dirname "$0")/.." && pwd)
"$S/dl/micropython/mpy-cross/build/mpy-cross" -s jiro_app.py -o "$S/app/jiro_app.mpy" "$S/app-src/jiro_app.py"
ls -la "$S/app/jiro_app.mpy"
