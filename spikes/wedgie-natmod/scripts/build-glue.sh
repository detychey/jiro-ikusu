#!/usr/bin/env bash
# Compiles the natmod glue with the flags of MicroPython v1.29.0's py/dynruntime.mk for
# ARCH=armv6m (read from the file, not run), against the cloned tree's headers. The config
# header comes from make_config_h.py instead of `mpy_ld.py --preprocess`.
set -euo pipefail
S=$(cd "$(dirname "$0")/.." && pwd)
MPY=$S/dl/micropython
python3 -I "$S/scripts/make_config_h.py" "$MPY" "$S/build/jiro_core.config.h" "$S/natmod/glue/jiro.c"
CFLAGS="-I$S/natmod/glue -I$MPY -I$S -std=c99 -Os -Wall -Werror -DNDEBUG -DNO_QSTR
  -DMICROPY_ENABLE_DYNRUNTIME -DMP_CONFIGFILE=<build/jiro_core.config.h>
  -fpic -fno-common -U_FORTIFY_SOURCE -mthumb -mcpu=cortex-m0
  -DMICROPY_FLOAT_IMPL=MICROPY_FLOAT_IMPL_FLOAT"
arm-none-eabi-gcc $CFLAGS -c "$S/natmod/glue/jiro.c" -o "$S/build/jiro.o"
arm-none-eabi-gcc $CFLAGS -c "$S/natmod/glue/call_on_stack.S" -o "$S/build/call_on_stack.o"
arm-none-eabi-size "$S/build/jiro.o" "$S/build/call_on_stack.o"
