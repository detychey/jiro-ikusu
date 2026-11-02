@ uint32_t jiro_call_on_stack(void *arg, void *stack_top, uint32_t (*fn)(void *))
@ Calls fn(arg) with sp = stack_top (8-byte aligned), then restores the caller's sp. The rp2
@ port's C stack is 8 KB; jiro-core needs more, so the glue runs it on a heap buffer.
    .syntax unified
    .cpu cortex-m0
    .thumb
    .section .text.jiro_call_on_stack,"ax",%progbits
    .global jiro_call_on_stack
    .type jiro_call_on_stack, %function
    .thumb_func
jiro_call_on_stack:
    push {r4, lr}
    mov r4, sp
    mov sp, r1
    blx r2
    mov sp, r4
    pop {r4, pc}
    .size jiro_call_on_stack, .-jiro_call_on_stack
