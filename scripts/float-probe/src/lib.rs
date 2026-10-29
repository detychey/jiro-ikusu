#![no_std]

// Links jiro-core into the archive, so check-no-float.sh scans it before the probe
// calls any of its functions. M1.8 adds an exported function that calls replay.
extern crate jiro_core;

#[panic_handler]
fn panic(_: &core::panic::PanicInfo) -> ! {
    loop {}
}
