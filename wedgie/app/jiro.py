# Jiro Training (README §8.1): the 16 levels, offline, at 15 Hz, with local best scores. The
# core's buffers come first, while the heap is least fragmented: the stack needs 64 KB in one
# block. Then all the app holds from level to level, so that playing allocates nothing sizable:
# the level buffer, the level file, open once (a file on a wedgie's littlefs is a 1,148-byte
# object), and the bests, which save.load reads through another. The stack is passed in a list, so
# that the app can lend its block to save.store between levels. The game's code is precompiled in
# jiro_app.mpy, because compiling it from source here would scatter its parse tree over that heap.
import gc

STACK_BYTES = 65536  # the core needs up to 63 KB of stack; the rp2 C stack is 8 KB
RECORDER_BYTES = 18568  # jiro_core.recorder_size(), which jiro_app checks
SHADOW_BYTES = 3600  # jiro_core.shadow_size(), which jiro_app checks
LEVEL_BYTES = 472  # a level's bytes in the level file, which jiro_app checks
LEVELS = "jiro_levels.bin"


def heap(stages, stage):
    """Measures the free heap and the largest bytearray it can hold, to 16 bytes, after a
    collection; prints them and records them in `stages` under `stage`."""
    gc.collect()
    free = gc.mem_free()
    low, high = 0, free
    while high - low > 16:
        size = (low + high) // 2
        try:
            block = bytearray(size)
        except MemoryError:
            high = size
        else:
            del block
            low = size
    gc.collect()
    stages[stage] = (free, low)
    print("jiro: heap %s: free %d B, largest block %d B" % (stage, free, low))


def run():
    stages = {}
    heap(stages, "run")
    stack, recorder, shadow = [bytearray(STACK_BYTES)], bytearray(RECORDER_BYTES), bytearray(SHADOW_BYTES)
    level = bytearray(LEVEL_BYTES)
    import save
    bests = save.load("bests", {})
    heap(stages, "buf")
    import jiro_core  # its 18 KB of code next, then jiro_app's objects fill the holes it leaves
    level_file = open(LEVELS, "rb")  # in the hole of the file jiro_core was read through
    import jiro_app
    heap(stages, "imp")
    jiro_app.main(stack, recorder, shadow, level, level_file, bests, heap, stages)
