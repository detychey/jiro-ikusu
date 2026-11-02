//! jiro-core for a MicroPython dynamic native module (armv6m). Every entry point but
//! `jiro_rules_version` has the shape `fn(*mut Args) -> u32`, so that the C glue can call it on a
//! stack of its own (the rp2 port's C stack is 8 KB; a Game alone is 10 KB). No statics: mpy_ld
//! links no .data and rejects a PC-relative reference to .bss, so every buffer comes from the
//! caller.

#![no_std]

use core::mem::{MaybeUninit, align_of, size_of};
use core::slice;

use jiro_core::Error;
use jiro_core::consts::RULES_VERSION;
use jiro_core::hash::state_hash;
use jiro_core::journal::{Header, Mode};
use jiro_core::level::{self, level_id};
use jiro_core::recorder::Recorder;
use jiro_core::replay::{Outcome, replay_observed};
use jiro_core::types::InputMask;
use tiny_keccak::{Hasher, Keccak};

/// The Outcome of README §7.3 in field order, integers big-endian, as jiro-wasm encodes it.
pub const OUTCOME_LEN: usize = 110;
const HASH_LEN: usize = 32;
/// A call the interface does not allow (a weight above 65,535, a mask or mode out of range).
pub const MISUSE: u32 = 255;
/// `jiro_recorder_step` adds this to an error code, to tell it from an end reason (1 to 4).
pub const STEP_ERROR: u32 = 0x100;

unsafe extern "C" {
    /// Raises a MicroPython exception; never returns.
    fn jiro_glue_panic() -> !;
}

#[panic_handler]
fn panic(_: &core::panic::PanicInfo) -> ! {
    // SAFETY: the glue raises, which unwinds to the MicroPython caller's nlr frame.
    unsafe { jiro_glue_panic() }
}

#[unsafe(no_mangle)]
pub extern "C" fn jiro_rules_version() -> u32 {
    u32::from(RULES_VERSION)
}

#[repr(C)]
pub struct ReplayArgs {
    pub level: *const u8,
    pub level_len: usize,
    pub journal: *const u8,
    pub journal_len: usize,
    pub weight_bp: u32,
    /// OUTCOME_LEN bytes, all zero when replay returns an error.
    pub outcome: *mut u8,
    /// `trace_cap` state hashes of 32 bytes, or null.
    pub trace: *mut u8,
    pub trace_cap: usize,
    /// keccak256 of the whole trace, as a vector's `traceKeccak`.
    pub trace_keccak: *mut u8,
    /// The state hash of the last processed tick.
    pub last_hash: *mut u8,
    /// Out: the ticks processed.
    pub ticks: u32,
}

/// Replays a journal on a level (README §6.3): 0 and the Outcome, or the error code.
///
/// # Safety
/// Every pointer of `args` is valid for its length.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn jiro_replay(args: *mut ReplayArgs) -> u32 {
    // SAFETY: the caller's contract.
    let args = unsafe { &mut *args };
    let level = unsafe { slice::from_raw_parts(args.level, args.level_len) };
    let journal = unsafe { slice::from_raw_parts(args.journal, args.journal_len) };
    let outcome_out = unsafe { &mut *args.outcome.cast::<[u8; OUTCOME_LEN]>() };
    let trace: &mut [u8] = if args.trace.is_null() {
        &mut []
    } else {
        unsafe { slice::from_raw_parts_mut(args.trace, args.trace_cap.saturating_mul(HASH_LEN)) }
    };
    let Ok(weight_bp) = u16::try_from(args.weight_bp) else {
        return MISUSE;
    };
    let mut slots = trace.as_chunks_mut::<HASH_LEN>().0.iter_mut();
    let mut keccak = Keccak::v256();
    let mut last = [0; HASH_LEN];
    let mut ticks: u32 = 0;
    let result = replay_observed(level, journal, weight_bp, |game| {
        let hash = state_hash(game);
        keccak.update(&hash);
        if let Some(slot) = slots.next() {
            *slot = hash;
        }
        last = hash;
        ticks = ticks.saturating_add(1);
    });
    keccak.finalize(unsafe { &mut *args.trace_keccak.cast::<[u8; HASH_LEN]>() });
    unsafe { *args.last_hash.cast::<[u8; HASH_LEN]>() = last };
    args.ticks = ticks;
    *outcome_out = result.as_ref().map_or([0; OUTCOME_LEN], encode_outcome);
    code(result.map(|_| ()))
}

#[unsafe(no_mangle)]
pub extern "C" fn jiro_recorder_size() -> usize {
    size_of::<Recorder>()
}

#[unsafe(no_mangle)]
pub extern "C" fn jiro_recorder_align() -> usize {
    align_of::<Recorder>()
}

#[repr(C)]
pub struct StartArgs {
    /// `jiro_recorder_size()` bytes aligned to `jiro_recorder_align()`.
    pub recorder: *mut MaybeUninit<Recorder>,
    pub level: *const u8,
    pub level_len: usize,
    /// 32 bytes.
    pub run_nonce: *const u8,
    pub mode: u32,
    pub level_index: u32,
}

/// Starts a level for live play through the Recorder (README §6.2): 0, or the level's or the
/// header's error code. On 0 the recorder buffer holds a Recorder.
///
/// # Safety
/// Every pointer of `args` is valid for its length.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn jiro_recorder_start(args: *mut StartArgs) -> u32 {
    let args = unsafe { &mut *args };
    let level_bytes = unsafe { slice::from_raw_parts(args.level, args.level_len) };
    let run_nonce = unsafe { *args.run_nonce.cast::<[u8; HASH_LEN]>() };
    let mode = match args.mode {
        0 => Mode::Training,
        1 => Mode::Challenge,
        _ => return MISUSE,
    };
    let Ok(level_index) = u8::try_from(args.level_index) else {
        return MISUSE;
    };
    let header = Header {
        mode,
        run_nonce,
        level_id: level_id(level_bytes),
        level_index,
    };
    let result = level::decode(level_bytes).and_then(|level| Recorder::new(&level, &header));
    match result {
        Ok(recorder) => {
            unsafe { (*args.recorder).write(recorder) };
            0
        }
        Err(error) => u32::from(error.code()),
    }
}

#[repr(C)]
pub struct StepArgs {
    pub recorder: *mut Recorder,
    /// The raw input mask of this tick (README §6.1).
    pub mask: u32,
}

/// One tick: 0 while the level runs, its end reason (1 to 4) once it ended, or STEP_ERROR plus
/// an error code.
///
/// # Safety
/// `recorder` holds a Recorder that `jiro_recorder_start` wrote.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn jiro_recorder_step(args: *mut StepArgs) -> u32 {
    let args = unsafe { &mut *args };
    let recorder = unsafe { &mut *args.recorder };
    let Some(mask) = u8::try_from(args.mask).ok().and_then(InputMask::new) else {
        return MISUSE;
    };
    match recorder.step(mask) {
        Ok(None) => 0,
        Ok(Some(end)) => end as u32,
        Err(error) => STEP_ERROR.saturating_add(u32::from(error.code())),
    }
}

#[repr(C)]
pub struct ViewArgs {
    pub recorder: *const Recorder,
    /// Out: the journal so far, inside the recorder buffer.
    pub journal: *const u8,
    pub journal_len: usize,
    /// 32 bytes for the state hash after the last tick (README §6.4), or null to skip it.
    pub state_hash: *mut u8,
    /// Out: ticks processed.
    pub ticks: u32,
}

/// The journal so far and the state hash: always 0.
///
/// # Safety
/// `recorder` holds a Recorder that `jiro_recorder_start` wrote; `state_hash` is null or 32
/// bytes.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn jiro_recorder_view(args: *mut ViewArgs) -> u32 {
    let args = unsafe { &mut *args };
    let recorder = unsafe { &*args.recorder };
    let journal = recorder.journal();
    args.journal = journal.as_ptr();
    args.journal_len = journal.len();
    if !args.state_hash.is_null() {
        unsafe { *args.state_hash.cast::<[u8; HASH_LEN]>() = state_hash(recorder.game()) };
    }
    args.ticks = u32::from(recorder.game().ticks_used);
    0
}

fn code(result: Result<(), Error>) -> u32 {
    result.map_or_else(|error| u32::from(error.code()), |()| 0)
}

fn encode_outcome(outcome: &Outcome) -> [u8; OUTCOME_LEN] {
    let fields: [&[u8]; 11] = [
        &outcome.journal_hash,
        &outcome.level_id,
        &outcome.run_nonce,
        &[outcome.level_index],
        &[outcome.draw_slot],
        &[outcome.mode as u8],
        &outcome.rules_version.to_be_bytes(),
        &[outcome.end_reason as u8],
        &outcome.claim_bp.to_be_bytes(),
        &outcome.ticks_used.to_be_bytes(),
        &outcome.level_score.to_be_bytes(),
    ];
    let mut out = [0; OUTCOME_LEN];
    for (slot, byte) in out.iter_mut().zip(fields.into_iter().flatten()) {
        *slot = *byte;
    }
    out
}
