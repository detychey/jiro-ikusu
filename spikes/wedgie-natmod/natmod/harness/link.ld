/* qemu -M microbit with -global nrf51-soc.flash-size=1048576 -global nrf51-soc.sram-size=262144 */
MEMORY
{
    FLASH (rx) : ORIGIN = 0x00000000, LENGTH = 1M
    RAM (rwx)  : ORIGIN = 0x20000000, LENGTH = 256K
}
_estack = ORIGIN(RAM) + LENGTH(RAM);
/* The rp2 port's C stack: 8 KB (PICO_STACK_SIZE=0x2000). */
_main_stack_size = 8K;
ENTRY(reset_handler)
SECTIONS
{
    .isr_vector : { KEEP(*(.isr_vector)) } > FLASH
    .text : { *(.text*) *(.rodata*) *(.data.rel.ro*) . = ALIGN(4); } > FLASH
    .got : { *(.got*) } > FLASH
    _sidata = LOADADDR(.data);
    .data : { _sdata = .; *(.data*) . = ALIGN(4); _edata = .; } > RAM AT > FLASH
    .bss (NOLOAD) : { _sbss = .; *(.bss*) *(COMMON) . = ALIGN(4); _ebss = .; } > RAM
    ASSERT(_ebss <= _estack - _main_stack_size, "RAM overflows into the 8 KB main stack")
    /DISCARD/ : { *(.ARM.exidx*) *(.ARM.extab*) }
}
