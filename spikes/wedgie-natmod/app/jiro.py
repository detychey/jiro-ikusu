# Jiro core test: replays four golden vectors through jiro_core.mpy, the Rust core built as a native
# module, and checks what the referee would compute. The result shows on the screen and goes to USB.
# The core's two buffers come first, while the heap is least fragmented: the stack needs 64 KB in one
# block. The test's code is precompiled in jiro_app.mpy, because compiling it from source here would
# scatter its parse tree over that heap.
import gc

STACK_BYTES = 65536  # the core needs up to 63 KB of stack; the rp2 C stack is 8 KB
RECORDER_BYTES = 18564  # jiro_core.recorder_size(), which jiro_app checks


def run():
    gc.collect()
    free_before = gc.mem_free()
    stack, recorder = bytearray(STACK_BYTES), bytearray(RECORDER_BYTES)
    import jiro_core  # its 15.6 KB of code next, then jiro_app's small objects fill the holes it leaves
    import jiro_app
    lines, failed = jiro_app.check_all(stack, recorder, free_before)
    del stack, recorder
    jiro_app.show(lines, failed)
