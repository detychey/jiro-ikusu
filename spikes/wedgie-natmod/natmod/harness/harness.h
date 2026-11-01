#ifndef JIRO_HARNESS_H
#define JIRO_HARNESS_H

#include <stddef.h>
#include <stdint.h>

#include "../glue/jiro_api.h"

uint64_t clock_now(void);
void put(const char *s);
void put_u(uint32_t value);
void put_hex(const uint8_t *bytes, uint32_t len);
int32_t file_open(const char *path);
int32_t file_len(int32_t handle);
int file_read(int32_t handle, void *buf, uint32_t len);
void file_close(int32_t handle);
void exit_with(int ok);

#endif
