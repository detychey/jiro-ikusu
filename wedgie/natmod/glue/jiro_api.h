// The extern "C" interface of natmod/rust/src/lib.rs, for the MicroPython glue.
#ifndef JIRO_API_H
#define JIRO_API_H

#include <stddef.h>
#include <stdint.h>

#define JIRO_OUTCOME_LEN 110
#define JIRO_HASH_LEN 32
#define JIRO_MISUSE 255
#define JIRO_STEP_ERROR 0x100

typedef struct {
    const uint8_t *level;
    size_t level_len;
    const uint8_t *journal;
    size_t journal_len;
    uint32_t weight_bp;
    uint8_t *outcome;
    uint8_t *trace;
    size_t trace_cap;
    uint8_t *trace_keccak;
    uint8_t *last_hash;
    uint32_t ticks;
} jiro_replay_args_t;

typedef struct {
    void *recorder;
    const uint8_t *level;
    size_t level_len;
    const uint8_t *run_nonce;
    uint32_t mode;
    uint32_t level_index;
} jiro_start_args_t;

typedef struct {
    void *recorder;
    uint32_t mask;
} jiro_step_args_t;

typedef struct {
    const void *recorder;
    const uint8_t *journal;
    size_t journal_len;
    uint8_t *state_hash;
    uint32_t ticks;
} jiro_view_args_t;

uint32_t jiro_rules_version(void);
uint32_t jiro_replay(jiro_replay_args_t *args);
size_t jiro_recorder_size(void);
size_t jiro_recorder_align(void);
uint32_t jiro_recorder_start(jiro_start_args_t *args);
uint32_t jiro_recorder_step(jiro_step_args_t *args);
uint32_t jiro_recorder_view(jiro_view_args_t *args);

typedef uint32_t (*jiro_entry_t)(void *args);
uint32_t jiro_call_on_stack(void *arg, void *stack_top, jiro_entry_t fn);

#endif
