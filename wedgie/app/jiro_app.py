# Jiro Training's code (README §8.1), which jiro.py runs once it holds the core's buffers. Shipped
# precompiled as jiro_app.mpy (wedgie/scripts/build-app.sh). The core is the referee: each tick's
# inputs go into the README §6.1 mask and through the core's Recorder, and the app only draws
# what the core reports. wedgie/scripts/qemu_app_check.py plays it on MicroPython's qemu port.
import gc
import struct
import time
from array import array
from binascii import hexlify

import jiro_core as jc
import lcd
import save
import ui
import wedgie

LEVELS = "jiro_levels.bin"
MAGIC = b"JL01"
LEVEL_BYTES = 472
TRAINING = 0
TRAINING_INDEX = 0  # Training plays at levelIndex 0, as in the browser
# Tick k is due at t0 + floor(k × 10^6 / 15) µs: 66,666 µs and two thirds, on an absolute schedule.
TICK_US = 66666
OVERLAY_MS = 1500
CELL_PX = 4

# The controls of README §2 (D8) and their bits of the README §6.1 mask. Y and the joystick press
# are not controls, so they never reach the mask.
CONTROLS = (("up", 1), ("down", 2), ("left", 4), ("right", 8), ("A", 16), ("B", 32), ("X", 64))
CONTROL_BITS = dict(CONTROLS)

# The colors of the cell states EMPTY, CLAIMED, TRAIL and BOSS_ZONE (README §4.1), and of the
# entities, as the browser draws them, as near as the screen's 16 colors come.
CELL_COLORS = bytes((lcd.color(0, 0, 0), lcd.color(40, 100, 230), lcd.color(255, 42, 42), lcd.color(0, 0, 0)))
BOSS = lcd.color(255, 220, 0)
MINION = lcd.color(60, 255, 120)
PLAYER = lcd.color(255, 255, 255)
PLAYER_PROTECTED = lcd.color(154, 154, 154)

# The fields of jc.status (jiro_status in natmod/rust/src/lib.rs), in its order.
END, TICKS, TIME_LIMIT, LIVES, SHIELD, INVULNERABLE, CUTTING, CLAIM, TARGET = range(9)
PLAYER_X, PLAYER_Y, BOSS_X, BOSS_Y, BOSS_SIZE = range(9, 14)
MINIONS = (14, 17, 20)  # each slot's state, then its x and y
STATUS_LEN = 23
LIVE = 1
STEP_ERROR = 0x100
END_TITLES = ("", "Committed", "Cleared", "Out of lives", "Time up")


def main(stack, recorder, shadow, free_before):
    if jc.recorder_size() > len(recorder) or jc.shadow_size() > len(shadow):
        raise ValueError("jiro_core needs a %d B Recorder and a %d B shadow" % (jc.recorder_size(), jc.shadow_size()))
    Training(stack, recorder, shadow, free_before).run()


def read_levels():
    """The level file's index: (name, weightBp, level id, offset of the level bytes) per level."""
    levels = []
    with open(LEVELS, "rb") as f:
        if f.read(4) != MAGIC:
            raise ValueError(LEVELS + " is not a JL01 level file")
        rules_version, count = struct.unpack(">HB", f.read(3))
        if rules_version != jc.rules_version():
            raise ValueError("the levels are scored for rules version %d, the core runs %d" % (rules_version, jc.rules_version()))
        offset = 7
        for _ in range(count):
            name = f.read(f.read(1)[0]).decode()
            weight = struct.unpack(">H", f.read(2))[0]
            level_id = f.read(32)
            offset += 1 + len(name) + 2 + 32
            levels.append((name, weight, level_id, offset))
            f.seek(LEVEL_BYTES, 1)
            offset += LEVEL_BYTES
    return levels


def largest_block():
    """The largest bytearray the heap can hold now, to 16 bytes."""
    low, high = 0, gc.mem_free()
    while high - low > 16:
        size = (low + high) // 2
        try:
            block = bytearray(size)
        except MemoryError:
            high = size
        else:
            del block
            low = size
    return low


def sample(keys):
    """The tick's input mask: the controls held now or pressed since the last sample, so a tap
    shorter than a tick counts once. Held keys are read first, then the presses."""
    mask = 0
    for name, bit in CONTROLS:
        if keys.held(name):
            mask |= bit
    for name in keys.pressed():
        mask |= CONTROL_BITS.get(name, 0)
    return mask


def wait_until(due):
    left = time.ticks_diff(due, time.ticks_us())
    if left > 2000:
        time.sleep_ms(left // 1000 - 1)  # the firmware answers USB in here
    while time.ticks_diff(due, time.ticks_us()) > 0:
        pass


def ms(us):
    return "%d.%d ms" % (us // 1000, us % 1000 // 100)


def push_box(show_rect, old_x, old_y, new_x, new_y, size):
    """Pushes the cells an entity of `size` × `size` cells left and entered."""
    x, y = min(old_x, new_x), min(old_y, new_y)
    show_rect(x * CELL_PX, y * CELL_PX, (max(old_x, new_x) - x + size) * CELL_PX, (max(old_y, new_y) - y + size) * CELL_PX)


class Training:
    def __init__(self, stack, recorder, shadow, free_before):
        self.stack, self.recorder, self.shadow = stack, recorder, shadow
        self.screen, self.keys = lcd.LCD(), lcd.Keys()
        self.frame = self.screen.buffer
        self.level = bytearray(LEVEL_BYTES)
        self.status, self.previous = array("H", [0] * STATUS_LEN), array("H", [0] * STATUS_LEN)
        self.rect = array("H", [0] * 4)
        self.levels = read_levels()
        self.bests = save.load("bests", {})
        if not isinstance(self.bests, dict):
            raise ValueError("the bests save is not a dict")
        gc.collect()
        free, block = gc.mem_free(), largest_block()
        print("jiro: free heap %d B before the app, %d B after start, largest free block %d B" % (free_before, free, block))
        print("jiro: random source", wedgie.rand_source())
        self.heap = "free %d B, block %d B" % (free, block)

    def best_key(self, index):
        """As the browser's Training page keys bests: the rules version, the level id and the
        weight, so a new calibration or rules version starts every level afresh."""
        _, weight, level_id, _ = self.levels[index]
        return "%d/0x%s/%d" % (jc.rules_version(), hexlify(level_id).decode(), weight)

    def run(self):
        index = 0
        while True:
            index = self.choose(index)
            end = self.play(index)
            if end == 2 and index + 1 < len(self.levels):
                index += 1

    def choose(self, index):
        """The level select, outside play and never journaled: the joystick picks, green plays."""
        count = len(self.levels)
        while True:
            best = self.bests.get(self.best_key(index))
            ui.page(self.screen, "Level %d of %d" % (index + 1, count),
                    [(self.levels[index][0], ui.INK),
                     ("no best yet" if best is None else "best %d" % best, ui.MUTED),
                     ("< > other levels", ui.MUTED),
                     (self.heap, ui.MUTED)], "{g} play")
            step = 0
            while not step:
                pressed = self.keys.pressed()
                if "A" in pressed:
                    return index
                step = ("right" in pressed or "down" in pressed) - ("left" in pressed or "up" in pressed)
                time.sleep_ms(30)
            index = (index + step) % count

    def start(self, index):
        name, _, level_id, offset = self.levels[index]
        with open(LEVELS, "rb") as f:
            f.seek(offset)
            f.readinto(self.level)
        code = jc.start(self.recorder, self.level, TRAINING, wedgie.rand(32), TRAINING_INDEX, self.stack)
        if code:
            raise RuntimeError("the core rejects level %s: code %d" % (name, code))
        if jc.journal(self.recorder, 36, 68) != level_id:
            raise ValueError("level %s is not the calibration's" % name)

    def redraw(self):
        """Paints every cell and the entities, and pushes the whole screen."""
        for i in range(len(self.shadow)):
            self.shadow[i] = 0
        jc.status(self.recorder, self.status)
        jc.paint(self.recorder, self.shadow, self.frame, CELL_COLORS, self.rect)
        self.draw(self.status)
        self.screen.show()

    def overlay(self, index):
        """The brief overlay at level start, before tick 0: the level, its target and the lives."""
        s, status = self.screen, self.status
        s.fill_rect(24, 80, 192, 80, ui.WHITE)
        s.center_text(self.levels[index][0], 92, ui.INK, 2)
        s.center_text("target %d %%" % (status[TARGET] // 100), 122, ui.MUTED, 1)
        s.center_text("%d lives" % status[LIVES], 138, ui.MUTED, 1)
        s.show()
        time.sleep_ms(OVERLAY_MS)

    def play(self, index):
        self.start(index)
        self.redraw()
        self.overlay(index)
        self.redraw()
        self.keys.pressed()  # presses made before tick 0 are not inputs
        gc.collect()
        end, timing = self.ticks()
        self.finish(index, end, timing)
        return end

    def ticks(self):
        """Steps the level once per tick until it ends, on an absolute schedule: a late tick is
        late, never skipped or stepped twice. Times the step and the drawing separately."""
        recorder, stack, keys, step = self.recorder, self.stack, self.keys, jc.step
        status, previous = self.status, self.previous
        step_max = render_max = tick_max = overruns = 0
        t0 = time.ticks_us()
        tick = 0
        while True:
            wait_until(time.ticks_add(t0, tick * TICK_US + tick * 2 // 3))
            started = time.ticks_us()
            end = step(recorder, sample(keys), stack)
            stepped = time.ticks_us()
            status, previous = previous, status
            self.render(status, previous)
            done = time.ticks_us()
            tick += 1
            step_max = max(step_max, time.ticks_diff(stepped, started))
            render_max = max(render_max, time.ticks_diff(done, stepped))
            tick_max = max(tick_max, time.ticks_diff(done, started))
            if time.ticks_diff(done, time.ticks_add(t0, tick * TICK_US + tick * 2 // 3)) > 0:
                overruns += 1
            if end >= STEP_ERROR:
                raise RuntimeError("jiro-core error %d on tick %d" % (end - STEP_ERROR, tick - 1))
            if end:
                self.status, self.previous = status, previous
                return end, (step_max, render_max, tick_max, overruns)

    def render(self, status, previous):
        """Erases the entities where they stood, paints the cells that changed, draws the
        entities, and pushes only the regions that changed."""
        recorder, frame, restore = self.recorder, self.frame, jc.restore
        jc.status(recorder, status)
        size = previous[BOSS_SIZE]
        restore(recorder, frame, CELL_COLORS, previous[BOSS_X], previous[BOSS_Y], size, size)
        for slot in MINIONS:
            if previous[slot] == LIVE:
                restore(recorder, frame, CELL_COLORS, previous[slot + 1], previous[slot + 2], 1, 1)
        restore(recorder, frame, CELL_COLORS, previous[PLAYER_X], previous[PLAYER_Y], 1, 1)
        changed = jc.paint(recorder, self.shadow, frame, CELL_COLORS, self.rect)
        self.draw(status)
        show_rect, rect = self.screen.show_rect, self.rect
        if changed:
            show_rect(rect[0], rect[1], rect[2], rect[3])
        push_box(show_rect, previous[BOSS_X], previous[BOSS_Y], status[BOSS_X], status[BOSS_Y], status[BOSS_SIZE])
        for slot in MINIONS:
            was, now = previous[slot] == LIVE, status[slot] == LIVE
            if was or now:
                old, new = previous if was else status, status if now else previous
                push_box(show_rect, old[slot + 1], old[slot + 2], new[slot + 1], new[slot + 2], 1)
        push_box(show_rect, previous[PLAYER_X], previous[PLAYER_Y], status[PLAYER_X], status[PLAYER_Y], 1)

    def draw(self, status):
        fill = self.screen.fill_rect
        size = status[BOSS_SIZE] * CELL_PX
        fill(status[BOSS_X] * CELL_PX, status[BOSS_Y] * CELL_PX, size, size, BOSS)
        for slot in MINIONS:
            if status[slot] == LIVE:
                fill(status[slot + 1] * CELL_PX, status[slot + 2] * CELL_PX, CELL_PX, CELL_PX, MINION)
        color = PLAYER_PROTECTED if status[INVULNERABLE] else PLAYER
        fill(status[PLAYER_X] * CELL_PX, status[PLAYER_Y] * CELL_PX, CELL_PX, CELL_PX, color)

    def finish(self, index, end, timing):
        """The between-level screen: the claim, the score and the lives, the best, and the
        timing. The score is the core's, with the calibration's weight."""
        name, weight, _, _ = self.levels[index]
        status, recorder = self.status, self.recorder
        score = jc.score(recorder, weight)
        step_max, render_max, tick_max, overruns = timing
        claim = "%d.%02d %%" % (status[CLAIM] // 100, status[CLAIM] % 100)
        print("jiro: level %d %s end %d claim_bp %d ticks %d lives %d score %d" % (
            index + 1, name, end, status[CLAIM], status[TICKS], status[LIVES], score))
        print("jiro: step max %d us, render max %d us, worst tick %d us, overruns %d" % timing)
        start = 0
        while True:
            chunk = jc.journal(recorder, start, start + 48)
            if not chunk:
                break
            print("jiro: journal", hexlify(chunk).decode())
            start += 48
        key = self.best_key(index)
        best = self.bests.get(key)
        if best is None or score > best:
            self.bests[key] = score
            try:
                save.store("bests", self.bests)
                best_line = "a new best"
            except OSError as error:
                best_line = "best not saved: %s" % error
        else:
            best_line = "best %d" % best
        ui.page(self.screen, END_TITLES[end],
                [("claim " + claim, ui.INK),
                 ("score %d, %s" % (score, best_line), ui.INK),
                 ("%d lives, %d ticks" % (status[LIVES], status[TICKS]), ui.MUTED),
                 ("step %s, draw %s" % (ms(step_max), ms(render_max)), ui.MUTED),
                 ("worst tick " + ms(tick_max), ui.MUTED),
                 ("overruns %d" % overruns, ui.GREEN_D if overruns == 0 else ui.RED)], "{g} next")
        while "A" not in self.keys.pressed():
            time.sleep_ms(30)
