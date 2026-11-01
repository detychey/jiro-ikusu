// MicroPython dynamic native module "jiro_core": jiro-core (natmod/rust, linked in as
// build/jiro_rust.o) behind a Python API. The caller owns all memory: a stack buffer (the rp2
// port's C stack is 8 KB; starting a level needs about 63 KB, a replay 44 KB) and the Recorder
// buffer, both bytearrays made once at import while the heap is whole.
//
//   rules_version() -> int
//   recorder_size() -> int
//   start(recorder, level, mode, run_nonce, level_index, stack) -> code (0 or README §5/§6.3)
//   step(recorder, mask) -> 0 running, 1-4 end reason, 0x100 + code on error (308 B of stack)
//   journal(recorder) -> bytes, the journal so far (no state hash: little stack)
//   state_hash(recorder, stack) -> bytes (32)
//   replay(level, journal, weight_bp, stack[, trace]) -> (code, outcome, ticks, trace_keccak,
//                                                        last_hash)

#include "py/dynruntime.h"
#include "jiro_api.h"

#define STACK_MIN (64 * 1024)

void jiro_glue_panic(void) {
    mp_raise_msg(&mp_type_RuntimeError, MP_ERROR_TEXT("jiro-core panic"));
}

static void *stack_top(mp_obj_t stack_obj) {
    mp_buffer_info_t stack;
    mp_get_buffer_raise(stack_obj, &stack, MP_BUFFER_RW);
    if (stack.len < STACK_MIN) {
        mp_raise_ValueError(MP_ERROR_TEXT("stack buffer under 64 KB"));
    }
    return (void *)(((uintptr_t)stack.buf + stack.len) & ~(uintptr_t)7);
}

static void *recorder_buf(mp_obj_t recorder_obj) {
    mp_buffer_info_t recorder;
    mp_get_buffer_raise(recorder_obj, &recorder, MP_BUFFER_RW);
    if (recorder.len < jiro_recorder_size() || ((uintptr_t)recorder.buf & (jiro_recorder_align() - 1))) {
        mp_raise_ValueError(MP_ERROR_TEXT("recorder buffer too small or misaligned"));
    }
    return recorder.buf;
}

static mp_obj_t rules_version(void) {
    return mp_obj_new_int(jiro_rules_version());
}
static MP_DEFINE_CONST_FUN_OBJ_0(rules_version_obj, rules_version);

static mp_obj_t recorder_size(void) {
    return mp_obj_new_int(jiro_recorder_size());
}
static MP_DEFINE_CONST_FUN_OBJ_0(recorder_size_obj, recorder_size);

static mp_obj_t start(size_t n_args, const mp_obj_t *args) {
    mp_buffer_info_t level, nonce;
    mp_get_buffer_raise(args[1], &level, MP_BUFFER_READ);
    mp_get_buffer_raise(args[3], &nonce, MP_BUFFER_READ);
    if (nonce.len != JIRO_HASH_LEN) {
        mp_raise_ValueError(MP_ERROR_TEXT("run_nonce is 32 bytes"));
    }
    jiro_start_args_t start_args = {
        .recorder = recorder_buf(args[0]),
        .level = level.buf,
        .level_len = level.len,
        .run_nonce = nonce.buf,
        .mode = mp_obj_get_int(args[2]),
        .level_index = mp_obj_get_int(args[4]),
    };
    uint32_t code = jiro_call_on_stack(&start_args, stack_top(args[5]), (jiro_entry_t)jiro_recorder_start);
    return mp_obj_new_int(code);
}
static MP_DEFINE_CONST_FUN_OBJ_VAR_BETWEEN(start_obj, 6, 6, start);

static mp_obj_t step(mp_obj_t recorder_obj, mp_obj_t mask_obj) {
    jiro_step_args_t step_args = {
        .recorder = recorder_buf(recorder_obj),
        .mask = mp_obj_get_int(mask_obj),
    };
    return mp_obj_new_int(jiro_recorder_step(&step_args));
}
static MP_DEFINE_CONST_FUN_OBJ_2(step_obj, step);

static mp_obj_t journal(mp_obj_t recorder_obj) {
    jiro_view_args_t view = {.recorder = recorder_buf(recorder_obj), .state_hash = NULL};
    jiro_recorder_view(&view);
    return mp_obj_new_bytes(view.journal, view.journal_len);
}
static MP_DEFINE_CONST_FUN_OBJ_1(journal_obj, journal);

static mp_obj_t state_hash(mp_obj_t recorder_obj, mp_obj_t stack_obj) {
    uint8_t hash[JIRO_HASH_LEN];
    jiro_view_args_t view = {.recorder = recorder_buf(recorder_obj), .state_hash = hash};
    jiro_call_on_stack(&view, stack_top(stack_obj), (jiro_entry_t)jiro_recorder_view);
    return mp_obj_new_bytes(hash, JIRO_HASH_LEN);
}
static MP_DEFINE_CONST_FUN_OBJ_2(state_hash_obj, state_hash);

static mp_obj_t replay(size_t n_args, const mp_obj_t *args) {
    mp_buffer_info_t level, journal_buf, trace = {.buf = NULL, .len = 0};
    mp_get_buffer_raise(args[0], &level, MP_BUFFER_READ);
    mp_get_buffer_raise(args[1], &journal_buf, MP_BUFFER_READ);
    if (n_args > 4 && args[4] != mp_const_none) {
        mp_get_buffer_raise(args[4], &trace, MP_BUFFER_RW);
    }
    uint8_t outcome[JIRO_OUTCOME_LEN], keccak[JIRO_HASH_LEN], last[JIRO_HASH_LEN];
    jiro_replay_args_t replay_args = {
        .level = level.buf,
        .level_len = level.len,
        .journal = journal_buf.buf,
        .journal_len = journal_buf.len,
        .weight_bp = mp_obj_get_int(args[2]),
        .outcome = outcome,
        .trace = trace.buf,
        .trace_cap = trace.len / JIRO_HASH_LEN,
        .trace_keccak = keccak,
        .last_hash = last,
    };
    uint32_t code = jiro_call_on_stack(&replay_args, stack_top(args[3]), (jiro_entry_t)jiro_replay);
    mp_obj_t items[5] = {
        mp_obj_new_int(code),
        mp_obj_new_bytes(outcome, JIRO_OUTCOME_LEN),
        mp_obj_new_int(replay_args.ticks),
        mp_obj_new_bytes(keccak, JIRO_HASH_LEN),
        mp_obj_new_bytes(last, JIRO_HASH_LEN),
    };
    return mp_obj_new_tuple(5, items);
}
static MP_DEFINE_CONST_FUN_OBJ_VAR_BETWEEN(replay_obj, 4, 5, replay);

mp_obj_t mpy_init(mp_obj_fun_bc_t *self, size_t n_args, size_t n_kw, mp_obj_t *args) {
    MP_DYNRUNTIME_INIT_ENTRY

    mp_store_global(MP_QSTR_rules_version, MP_OBJ_FROM_PTR(&rules_version_obj));
    mp_store_global(MP_QSTR_recorder_size, MP_OBJ_FROM_PTR(&recorder_size_obj));
    mp_store_global(MP_QSTR_start, MP_OBJ_FROM_PTR(&start_obj));
    mp_store_global(MP_QSTR_step, MP_OBJ_FROM_PTR(&step_obj));
    mp_store_global(MP_QSTR_journal, MP_OBJ_FROM_PTR(&journal_obj));
    mp_store_global(MP_QSTR_state_hash, MP_OBJ_FROM_PTR(&state_hash_obj));
    mp_store_global(MP_QSTR_replay, MP_OBJ_FROM_PTR(&replay_obj));

    MP_DYNRUNTIME_INIT_EXIT
}
