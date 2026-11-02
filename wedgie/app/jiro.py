# Jiro Training (README §8.1): the 16 levels, offline, at 15 Hz, with local best scores. The
# core's buffers come first, while the heap is least fragmented: the stack needs 64 KB in one
# block. The game's code is precompiled in jiro_app.mpy, because compiling it from source here
# would scatter its parse tree over that heap.
import gc

STACK_BYTES = 65536  # the core needs up to 63 KB of stack; the rp2 C stack is 8 KB
RECORDER_BYTES = 18568  # jiro_core.recorder_size(), which jiro_app checks
SHADOW_BYTES = 3600  # jiro_core.shadow_size(), which jiro_app checks


def run():
    gc.collect()
    free_before = gc.mem_free()
    stack, recorder, shadow = bytearray(STACK_BYTES), bytearray(RECORDER_BYTES), bytearray(SHADOW_BYTES)
    import jiro_core  # its 18 KB of code next, then jiro_app's objects fill the holes it leaves
    import jiro_app
    jiro_app.main(stack, recorder, shadow, free_before)
