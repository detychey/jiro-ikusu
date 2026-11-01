// Replays every game vector with the jiro-core object built for the natmod (jiro_rust.o), on an
// emulated Cortex-M0, and checks the error code or the Outcome, every tick's state hash against
// the vector's .trace file, and traceKeccak. For each vector with an Outcome it then plays the
// journal's per-tick masks through the Recorder, as a live game would, and checks that the
// recorded journal is the vector's and that the final state hash and end reason match.
// It measures the stack each entry point needs (painted stack) and, under qemu -icount, the
// instructions each call takes.

#include <string.h>
#include "harness.h"

#define MAX_TICKS 2700
#define CASE_CAP (16 * 1024)
#define ALT_STACK_SIZE (64 * 1024)
#define PAINT 0xA5

static uint8_t alt_stack[ALT_STACK_SIZE] __attribute__((aligned(8)));
static uint8_t trace[MAX_TICKS * JIRO_HASH_LEN];
static uint8_t chunk[4096];
static uint8_t case_buf[CASE_CAP];
static char manifest[24 * 1024];
static uint8_t recorder[24 * 1024] __attribute__((aligned(8)));

static void *alt_top(void) {
    return alt_stack + ALT_STACK_SIZE;
}

static void paint(void) {
    memset(alt_stack, PAINT, ALT_STACK_SIZE);
}

static uint32_t stack_used(void) {
    uint32_t untouched = 0;
    while (untouched < ALT_STACK_SIZE && alt_stack[untouched] == PAINT) {
        untouched++;
    }
    return ALT_STACK_SIZE - untouched;
}

static uint32_t rd32(const uint8_t *p) {
    return (uint32_t)p[0] | (uint32_t)p[1] << 8 | (uint32_t)p[2] << 16 | (uint32_t)p[3] << 24;
}

// Clock units to instructions, from a calibration loop: instructions = clocks * num / den.
static uint64_t cal_num = 1, cal_den = 1;

static uint32_t insns(uint64_t clocks) {
    return (uint32_t)(clocks * cal_num / cal_den);
}

static void calibrate(void) {
    const uint32_t n = 2000000;
    uint64_t t0 = clock_now();
    jiro_spin(n);
    uint64_t t1 = clock_now();
    cal_num = 2ull * n + 2;
    cal_den = t1 - t0 ? t1 - t0 : 1;
    put("calibration: ");
    put_u((uint32_t)(t1 - t0));
    put(" clock units for ");
    put_u((uint32_t)cal_num);
    put(" instructions\n");
}

static int read_file(const char *path, void *buf, uint32_t cap, uint32_t *len) {
    int32_t h = file_open(path);
    if (h < 0) {
        return 1;
    }
    int32_t n = file_len(h);
    if (n < 0 || (uint32_t)n > cap || file_read(h, buf, (uint32_t)n)) {
        file_close(h);
        return 1;
    }
    file_close(h);
    *len = (uint32_t)n;
    return 0;
}

// The first tick whose recorded hash differs from the computed one, or -1 if all of the
// shorter trace agree; *recorded_ticks gets the file's length in ticks.
static int32_t first_trace_difference(const char *path, uint32_t ticks, uint32_t *recorded_ticks) {
    int32_t h = file_open(path);
    if (h < 0) {
        return -2;
    }
    uint32_t len = (uint32_t)file_len(h);
    *recorded_ticks = len / JIRO_HASH_LEN;
    uint32_t common = len < ticks * JIRO_HASH_LEN ? len : ticks * JIRO_HASH_LEN;
    for (uint32_t off = 0; off < common; off += sizeof(chunk)) {
        uint32_t n = common - off < sizeof(chunk) ? common - off : sizeof(chunk);
        if (file_read(h, chunk, n)) {
            file_close(h);
            return -2;
        }
        for (uint32_t i = 0; i < n; i++) {
            if (chunk[i] != trace[off + i]) {
                file_close(h);
                return (int32_t)((off + i) / JIRO_HASH_LEN);
            }
        }
    }
    file_close(h);
    return -1;
}

typedef struct {
    uint32_t replay_stack, start_stack, step_stack, view_stack;
    uint32_t step_max, view_max, start_max, replay_max_per_tick;
    uint64_t step_sum, step_count;
    char step_max_case[96];
    uint32_t step_max_tick;
    // Ticks costing more than 50k, 200k, 500k and 1M instructions.
    uint32_t over[4];
} stats_t;

static const uint32_t thresholds[4] = {50000, 200000, 500000, 1000000};

static stats_t stats;

static void copy_name(char *dst, const char *src) {
    uint32_t i = 0;
    for (; src[i] && i < 95; i++) {
        dst[i] = src[i];
    }
    dst[i] = 0;
}

// Plays the journal's masks tick by tick through the Recorder. Returns 0 if the recorded
// journal, the final state hash and the end reason match.
static int check_recorder(const char *name, const uint8_t *level, uint32_t level_len,
    const uint8_t *journal, uint32_t journal_len, const uint8_t *outcome, const uint8_t *last_hash) {
    jiro_start_args_t start = {
        .recorder = recorder,
        .level = level,
        .level_len = level_len,
        .run_nonce = journal + 4,
        .mode = journal[3],
        .level_index = journal[68],
    };
    paint();
    uint64_t t0 = clock_now();
    uint32_t code = jiro_call_on_stack(&start, alt_top(), (jiro_entry_t)jiro_recorder_start);
    uint32_t start_insns = insns(clock_now() - t0);
    uint32_t used = stack_used();
    if (used > stats.start_stack) {
        stats.start_stack = used;
    }
    if (start_insns > stats.start_max) {
        stats.start_max = start_insns;
    }
    if (code != 0) {
        put("  recorder start failed: ");
        put_u(code);
        put("\n");
        return 1;
    }
    uint32_t events = (uint32_t)journal[69] << 8 | journal[70];
    const uint8_t *event = journal + 71;
    uint32_t next = 0, mask = 0, end = 0, tick = 0, local_max = 0, local_max_tick = 0;
    uint64_t local_sum = 0;
    paint();
    for (; tick < MAX_TICKS && end == 0; tick++) {
        if (next < events && ((uint32_t)event[3 * next] << 8 | event[3 * next + 1]) == tick) {
            mask = event[3 * next + 2];
            next++;
        }
        jiro_step_args_t step = {.recorder = recorder, .mask = mask};
        uint64_t s0 = clock_now();
        end = jiro_call_on_stack(&step, alt_top(), (jiro_entry_t)jiro_recorder_step);
        uint32_t cost = insns(clock_now() - s0);
        stats.step_sum += cost;
        stats.step_count++;
        local_sum += cost;
        if (cost > local_max) {
            local_max = cost;
            local_max_tick = tick;
        }
        for (int b = 0; b < 4; b++) {
            stats.over[b] += cost > thresholds[b];
        }
        if (cost > stats.step_max) {
            stats.step_max = cost;
            stats.step_max_tick = tick;
            copy_name(stats.step_max_case, name);
        }
    }
    put("     recorder: start ");
    put_u(start_insns);
    put(" insns, step max ");
    put_u(local_max);
    put(" at tick ");
    put_u(local_max_tick);
    put(", step mean ");
    put_u(tick ? (uint32_t)(local_sum / tick) : 0);
    put("\n");
    used = stack_used();
    if (used > stats.step_stack) {
        stats.step_stack = used;
    }
    uint8_t hash[JIRO_HASH_LEN];
    jiro_view_args_t view = {.recorder = recorder, .state_hash = hash};
    paint();
    t0 = clock_now();
    jiro_call_on_stack(&view, alt_top(), (jiro_entry_t)jiro_recorder_view);
    uint32_t view_insns = insns(clock_now() - t0);
    used = stack_used();
    if (used > stats.view_stack) {
        stats.view_stack = used;
    }
    if (view_insns > stats.view_max) {
        stats.view_max = view_insns;
    }
    int bad = 0;
    if (end != outcome[101]) {
        put("  recorder end reason ");
        put_u(end);
        put(" != ");
        put_u(outcome[101]);
        put("\n");
        bad = 1;
    }
    if (view.journal_len != journal_len || memcmp(view.journal, journal, journal_len) != 0) {
        put("  recorder journal differs from the vector's journal\n");
        bad = 1;
    }
    if (memcmp(hash, last_hash, JIRO_HASH_LEN) != 0) {
        put("  recorder final state hash differs\n");
        bad = 1;
    }
    return bad;
}

static int run_case(const char *case_path, const char *trace_path, const char *name) {
    uint32_t len;
    if (read_file(case_path, case_buf, sizeof(case_buf), &len) || len < 168 || memcmp(case_buf, "JCAS", 4)) {
        put("  cannot read case\n");
        return 1;
    }
    uint32_t level_len = rd32(case_buf + 4), journal_len = rd32(case_buf + 8);
    uint32_t weight_bp = rd32(case_buf + 12), expected = rd32(case_buf + 16);
    const uint8_t *expected_outcome = case_buf + 24;
    const uint8_t *expected_keccak = case_buf + 24 + 112;
    const uint8_t *level = case_buf + 168;
    const uint8_t *journal = level + level_len;
    if (168 + level_len + journal_len != len) {
        put("  malformed case\n");
        return 1;
    }
    uint8_t outcome[JIRO_OUTCOME_LEN], keccak[JIRO_HASH_LEN], last[JIRO_HASH_LEN];
    jiro_replay_args_t args = {
        .level = level,
        .level_len = level_len,
        .journal = journal,
        .journal_len = journal_len,
        .weight_bp = weight_bp,
        .outcome = outcome,
        .trace = trace,
        .trace_cap = MAX_TICKS,
        .trace_keccak = keccak,
        .last_hash = last,
    };
    paint();
    uint64_t t0 = clock_now();
    uint32_t code = jiro_call_on_stack(&args, alt_top(), (jiro_entry_t)jiro_replay);
    uint32_t cost = insns(clock_now() - t0);
    uint32_t used = stack_used();
    if (used > stats.replay_stack) {
        stats.replay_stack = used;
    }
    if (args.ticks && cost / args.ticks > stats.replay_max_per_tick) {
        stats.replay_max_per_tick = cost / args.ticks;
    }
    int bad = 0;
    if (code != expected) {
        put("  code ");
        put_u(code);
        put(" != expected ");
        put_u(expected);
        put("\n");
        bad = 1;
    }
    if (expected == 0 && memcmp(outcome, expected_outcome, JIRO_OUTCOME_LEN) != 0) {
        put("  outcome differs: ");
        put_hex(outcome + 96, 14);
        put(" vs ");
        put_hex(expected_outcome + 96, 14);
        put("\n");
        bad = 1;
    }
    uint32_t recorded_ticks = 0;
    int32_t diff = first_trace_difference(trace_path, args.ticks, &recorded_ticks);
    if (diff != -1 || recorded_ticks != args.ticks) {
        put("  trace: first differing tick ");
        put_u(diff < 0 ? (recorded_ticks < args.ticks ? recorded_ticks : args.ticks) : (uint32_t)diff);
        put(" (");
        put_u(args.ticks);
        put(" ticks here, ");
        put_u(recorded_ticks);
        put(" recorded)\n");
        bad = 1;
    }
    if (memcmp(keccak, expected_keccak, JIRO_HASH_LEN) != 0) {
        put("  traceKeccak differs\n");
        bad = 1;
    }
    put(bad ? "FAIL " : "ok   ");
    put(name);
    put(": code ");
    put_u(code);
    put(", ticks ");
    put_u(args.ticks);
    put(", replay insns ");
    put_u(cost);
    put(", stack ");
    put_u(used);
    put(", final hash ");
    put_hex(last, 8);
    put("\n");
    if (!bad && expected == 0) {
        bad = check_recorder(name, level, level_len, journal, journal_len, expected_outcome, last);
    }
    return bad;
}

int main(void) {
    put("jiro-core on Cortex-M0 (qemu microbit), rules version ");
    put_u(jiro_rules_version());
    put(", Recorder ");
    put_u((uint32_t)jiro_recorder_size());
    put(" bytes, align ");
    put_u((uint32_t)jiro_recorder_align());
    put("\n");
    if (jiro_recorder_size() > sizeof(recorder) || jiro_recorder_align() > 8) {
        put("recorder buffer too small\n");
        return 1;
    }
    calibrate();
    uint32_t len;
    if (read_file(JIRO_MANIFEST, manifest, sizeof(manifest) - 1, &len)) {
        put("cannot read manifest " JIRO_MANIFEST "\n");
        return 1;
    }
    manifest[len] = 0;
    uint32_t total = 0, failed = 0;
    char *line = manifest;
    while (*line) {
        char *fields[3] = {0};
        char *p = line;
        for (int f = 0; f < 3; f++) {
            fields[f] = p;
            while (*p && *p != ' ' && *p != '\n') {
                p++;
            }
            if (f < 2 && *p == ' ') {
                *p++ = 0;
            }
        }
        while (*p && *p != '\n') {
            p++;
        }
        if (*p == '\n') {
            *p++ = 0;
        }
        line = p;
        if (!*fields[0]) {
            continue;
        }
        total++;
        failed += run_case(fields[0], fields[1], fields[2]) != 0;
    }
    put("\nvectors: ");
    put_u(total);
    put(", failed: ");
    put_u(failed);
    put("\nstack bytes: replay ");
    put_u(stats.replay_stack);
    put(", recorder start ");
    put_u(stats.start_stack);
    put(", recorder step ");
    put_u(stats.step_stack);
    put(", recorder view (state hash) ");
    put_u(stats.view_stack);
    put("\ninstructions: recorder start max ");
    put_u(stats.start_max);
    put(", step max ");
    put_u(stats.step_max);
    put(" (");
    put(stats.step_max_case);
    put(" tick ");
    put_u(stats.step_max_tick);
    put("), step mean ");
    put_u(stats.step_count ? (uint32_t)(stats.step_sum / stats.step_count) : 0);
    put(" over ");
    put_u((uint32_t)stats.step_count);
    put(" ticks, view (state hash) max ");
    put_u(stats.view_max);
    put(", ticks over 50k/200k/500k/1M insns: ");
    for (int b = 0; b < 4; b++) {
        put_u(stats.over[b]);
        put(b < 3 ? "/" : "");
    }
    put(", replay with trace hashing max per tick ");
    put_u(stats.replay_max_per_tick);
    put("\n");
    return failed != 0 || total == 0;
}

// The Rust panic handler's hook; in the natmod the glue raises a MicroPython exception.
void jiro_glue_panic(void) {
    put("RUST PANIC\n");
    exit_with(0);
}
