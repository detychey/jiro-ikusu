# Builds jiro_core.mpy (armv6m) with MicroPython v1.29.0's py/dynruntime.mk and tools/mpy_ld.py.
# NOT RUN in the spike: building/running the downloaded MicroPython tree was denied by the
# permission classifier. Run scripts/build-core.sh first (it writes build/jiro_rust.o).
# Needs pyelftools >= 0.25 for mpy_ld.py.
SPIKE := $(abspath ../..)
MPY_DIR = $(SPIKE)/dl/micropython
MOD = jiro_core
ARCH = armv6m
SRC = jiro.c call_on_stack.S
# The partially linked Rust object; dynruntime.mk appends the glue's objects with +=.
SRC_O = $(SPIKE)/build/jiro_rust.o
include $(MPY_DIR)/py/dynruntime.mk
