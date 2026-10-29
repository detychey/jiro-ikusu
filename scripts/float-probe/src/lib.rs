#![no_std]

// Links jiro-core into the archive, so check-no-float.sh scans it, and calls replay, so the
// code that replay reaches is scanned even if dead-code elimination changes.
use jiro_core::consts::{LEVEL_LEN, MAX_JOURNAL_LEN};
use jiro_core::replay::replay;

#[unsafe(no_mangle)]
pub extern "C" fn float_probe_replay(
    level: &[u8; LEVEL_LEN],
    journal: &[u8; MAX_JOURNAL_LEN],
    weight_bp: u16,
) -> u32 {
    replay(level, journal, weight_bp).map_or(0, |outcome| outcome.level_score)
}

#[panic_handler]
fn panic(_: &core::panic::PanicInfo) -> ! {
    loop {}
}
