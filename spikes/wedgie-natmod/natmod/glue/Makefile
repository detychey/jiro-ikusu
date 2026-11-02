# Builds jiro_core.mpy (armv6m) with MicroPython v1.29.0's py/dynruntime.mk and tools/mpy_ld.py.
# Run scripts/build-core.sh first (it writes build/jiro_rust.o).
# Needs pyelftools >= 0.25 for mpy_ld.py.
SPIKE := $(abspath ../..)
MPY_DIR = $(SPIKE)/dl/micropython
MOD = jiro_core
ARCH = armv6m
SRC = jiro.c call_on_stack.S
include $(MPY_DIR)/py/dynruntime.mk
# The partially linked Rust object goes after the glue's objects: mpy_ld v1.29.0 builds the armv6m
# entry trampoline before it lays out sections, so the section holding mpy_init must come first.
$(BUILD)/$(MOD).mpy: $(SPIKE)/build/jiro_rust.o
