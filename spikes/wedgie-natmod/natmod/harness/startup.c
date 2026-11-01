// Bare-metal Cortex-M0 startup for qemu -M microbit: vector table, .data/.bss setup, SysTick
// as an instruction clock under -icount, and ARM semihosting (BKPT 0xAB) for files and output.

#include <stdint.h>
#include "harness.h"

extern uint32_t _estack, _sidata, _sdata, _edata, _sbss, _ebss;
int main(void);

#define SYSTICK_CSR (*(volatile uint32_t *)0xE000E010)
#define SYSTICK_RVR (*(volatile uint32_t *)0xE000E014)
#define SYSTICK_CVR (*(volatile uint32_t *)0xE000E018)

static volatile uint32_t systick_wraps;

void systick_handler(void) {
    systick_wraps++;
}

uint64_t clock_now(void) {
    uint32_t wraps, value;
    do {
        wraps = systick_wraps;
        value = SYSTICK_CVR;
    } while (wraps != systick_wraps);
    return ((uint64_t)wraps << 24) + (0xFFFFFFu - value);
}

static uint32_t semihost(uint32_t op, void *arg) {
    register uint32_t r0 __asm__("r0") = op;
    register void *r1 __asm__("r1") = arg;
    __asm__ volatile ("bkpt 0xab" : "+r"(r0) : "r"(r1) : "memory");
    return r0;
}

void put(const char *s) {
    semihost(0x04, (void *)s);
}

void put_u(uint32_t value) {
    char buf[11];
    int i = 10;
    buf[i] = 0;
    do {
        buf[--i] = (char)('0' + value % 10);
        value /= 10;
    } while (value);
    put(&buf[i]);
}

void put_hex(const uint8_t *bytes, uint32_t len) {
    static const char digits[] = "0123456789abcdef";
    char buf[2 * 32 + 1];
    uint32_t n = len > 32 ? 32 : len;
    for (uint32_t i = 0; i < n; i++) {
        buf[2 * i] = digits[bytes[i] >> 4];
        buf[2 * i + 1] = digits[bytes[i] & 15];
    }
    buf[2 * n] = 0;
    put(buf);
}

int32_t file_open(const char *path) {
    uint32_t len = 0;
    while (path[len]) {
        len++;
    }
    uint32_t args[3] = {(uint32_t)path, 1 /* "rb" */, len};
    return (int32_t)semihost(0x01, args);
}

int32_t file_len(int32_t handle) {
    uint32_t args[1] = {(uint32_t)handle};
    return (int32_t)semihost(0x0C, args);
}

// Reads exactly len bytes; returns 0 on success.
int file_read(int32_t handle, void *buf, uint32_t len) {
    uint32_t args[3] = {(uint32_t)handle, (uint32_t)buf, len};
    return semihost(0x06, args) != 0;
}

void file_close(int32_t handle) {
    uint32_t args[1] = {(uint32_t)handle};
    semihost(0x02, args);
}

void exit_with(int ok) {
    // ADP_Stopped_ApplicationExit (qemu exits 0) or ADP_Stopped_InternalError (exits 1).
    semihost(0x18, (void *)(ok ? 0x20026u : 0x20024u));
    for (;;) {
    }
}

void fault_handler(void) {
    put("HARD FAULT\n");
    exit_with(0);
}

void reset_handler(void) {
    uint32_t *src = &_sidata;
    for (uint32_t *dst = &_sdata; dst < &_edata;) {
        *dst++ = *src++;
    }
    for (uint32_t *dst = &_sbss; dst < &_ebss;) {
        *dst++ = 0;
    }
    SYSTICK_RVR = 0xFFFFFF;
    SYSTICK_CVR = 0;
    SYSTICK_CSR = 7; // enable, interrupt, processor clock
    exit_with(main() == 0);
}

__attribute__((section(".isr_vector"), used))
static const void *const vector_table[16] = {
    &_estack,
    reset_handler,
    fault_handler, // NMI
    fault_handler, // HardFault
    0, 0, 0, 0, 0, 0, 0,
    fault_handler, // SVC
    0, 0,
    fault_handler, // PendSV
    systick_handler,
};

// jiro_rust.o brings memcpy and memcmp (compiler_builtins) but not memset; MicroPython's
// mp_fun_table provides it to a natmod.
void *memset(void *dst, int value, size_t len) {
    uint8_t *p = dst;
    while (len--) {
        *p++ = (uint8_t)value;
    }
    return dst;
}
