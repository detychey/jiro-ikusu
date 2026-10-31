//! jiro-wasm, the browser build of the core (README §3): a raw `extern "C"` interface over one
//! static engine, with no wasm-bindgen (plan P7). The only way to play is `tick`, which goes
//! through the core's Recorder, so the single input path of README §6.2 holds by construction.
//!
//! The host and the module exchange bytes through wasm memory. The host writes inputs into the
//! input buffer (`input_ptr`, `input_capacity` bytes) before the call that reads them, and reads
//! outputs at the pointers that the exports return. Every call that can fail returns 0 on
//! success, otherwise an error code: the codes of README §5 and §6.3, or `MISUSE` for a call the
//! interface does not allow. Scalar getters return 0 when no level is in play; the pointer
//! getters `grid_ptr`, `state_hash` and `state_preimage` then point at their buffers as last left.

#![cfg_attr(target_arch = "wasm32", no_std)]
#![cfg_attr(
    not(test),
    deny(
        clippy::float_arithmetic,
        clippy::unwrap_used,
        clippy::expect_used,
        clippy::panic,
        clippy::arithmetic_side_effects,
        clippy::indexing_slicing
    )
)]

use core::cell::UnsafeCell;

use jiro_core::Error;
use jiro_core::consts::{CAPTURE_STACK, CELLS, LEVEL_LEN, MAX_TICKS, RULES_VERSION};
use jiro_core::game::Game;
use jiro_core::grid;
use jiro_core::hash::{self, PREIMAGE_LEN, heading_code, preimage};
use jiro_core::journal::{Header, Mode};
use jiro_core::level::{self, Level, Rect};
use jiro_core::minion::State;
use jiro_core::recorder::Recorder;
use jiro_core::replay::{Outcome, replay_observed};
use jiro_core::types::{CellIndex, InputMask, Pos};
use jiro_shell::dirty::DirtyCells;

/// The code of a call the interface does not allow: a level or a journal longer than the input
/// buffer, a weight above 65,535, `start` before `load_level`, `tick` before `start`, or an edit
/// cell other than 0 or 1 or an edit field wider than its bytes (`encode_level`). The core's
/// codes are all below it.
pub const MISUSE: u32 = 255;
/// The input buffer holds a level and a journal side by side, malformed ones included.
const INPUT_CAPACITY: usize = 16 * 1024;
const HASH_LEN: usize = 32;
const TRACE_CAPACITY: usize = MAX_TICKS as usize * HASH_LEN;
/// The Outcome of README §7.3 in the order of its fields: journalHash, levelId and runNonce
/// (32 bytes each), levelIndex, drawSlot and mode (1 byte each), rulesVersion (2), endReason
/// (1), claimBp (2), ticksUsed (2) and levelScore (4), integers big-endian.
const OUTCOME_LEN: usize = 110;
/// The editor's fields of a level besides its obstacles, as u32 values in this order: boss size,
/// spawn x0, y0, x1 and y1, boss period, minion count, the x and y of each minion slot, minion
/// period, respawn delay, time limit, lives and target.
const EDIT_FIELDS: usize = 18;

struct Engine {
    input: [u8; INPUT_CAPACITY],
    /// The level that `load_level` accepted, and its bytes, which give its id.
    level: Option<(Level, [u8; LEVEL_LEN])>,
    play: Play,
    grid: [u8; CELLS],
    /// The cells changed since the last `dirty_cells` call, for redrawing (not consensus).
    dirty: DirtyCells,
    hash: [u8; HASH_LEN],
    level_id: [u8; HASH_LEN],
    /// The editor's level (plan M2.5): one byte per cell in row-major order, 1 for an obstacle.
    edit_cells: [u8; CELLS],
    /// The editor's other fields, in the order of `EDIT_FIELDS`.
    edit_fields: [u32; EDIT_FIELDS],
    /// The level bytes that the last `encode_level` call wrote.
    level_out: [u8; LEVEL_LEN],
    preimage: [u8; PREIMAGE_LEN],
    trace: [u8; TRACE_CAPACITY],
    trace_ticks: u16,
    outcome: [u8; OUTCOME_LEN],
}

/// The level in play: `Option<Recorder>` with an explicit tag of 0 for no level, so that the
/// engine starts as all zero bytes and stays out of the module's data segment, which would
/// otherwise carry its 127 KB.
#[repr(u8)]
#[allow(
    clippy::large_enum_variant,
    reason = "a static without a heap: the space of the largest variant is reserved anyway"
)]
enum Play {
    Idle,
    Running(Recorder),
}

impl Play {
    fn recorder(&self) -> Option<&Recorder> {
        match self {
            Self::Idle => None,
            Self::Running(recorder) => Some(recorder),
        }
    }
}

/// The engine's only instance.
struct Static(UnsafeCell<Engine>);

// SAFETY: a wasm32 module without threads runs one export at a time, and every export takes
// the engine once, through `engine`, and drops it before returning. Host builds compile the
// exports, for the lints and tests of the workspace, but never call them.
unsafe impl Sync for Static {}

static ENGINE: Static = Static(UnsafeCell::new(Engine {
    input: [0; INPUT_CAPACITY],
    level: None,
    play: Play::Idle,
    grid: [0; CELLS],
    dirty: DirtyCells::new(),
    hash: [0; HASH_LEN],
    level_id: [0; HASH_LEN],
    edit_cells: [0; CELLS],
    edit_fields: [0; EDIT_FIELDS],
    level_out: [0; LEVEL_LEN],
    preimage: [0; PREIMAGE_LEN],
    trace: [0; TRACE_CAPACITY],
    trace_ticks: 0,
    outcome: [0; OUTCOME_LEN],
}));

fn engine() -> &'static mut Engine {
    // SAFETY: see `Sync` above: no two references to the engine are alive at once.
    unsafe { &mut *ENGINE.0.get() }
}

fn code(result: Result<(), Error>) -> u32 {
    result.map_or_else(|error| u32::from(error.code()), |()| 0)
}

fn game(play: &Play) -> Option<&Game> {
    play.recorder().map(Recorder::game)
}

/// The first `len` bytes of the input buffer.
fn input(input: &[u8; INPUT_CAPACITY], len: u32) -> Option<&[u8]> {
    input.get(..usize::try_from(len).ok()?)
}

/// A level of `level_len` bytes followed by a journal of `journal_len` bytes.
fn level_and_journal(
    input: &[u8; INPUT_CAPACITY],
    level_len: u32,
    journal_len: u32,
) -> Option<(&[u8], &[u8])> {
    let both = level_len.checked_add(journal_len)?;
    let (level, journal) =
        self::input(input, both)?.split_at_checked(usize::try_from(level_len).ok()?)?;
    Some((level, journal))
}

/// Level bytes v1 that decode and are valid (README §5).
fn checked_level(bytes: &[u8]) -> Result<Level, Error> {
    let level = level::decode(bytes)?;
    level::validate(&level, &mut [0; CAPTURE_STACK])?;
    Ok(level)
}

#[cfg(target_arch = "wasm32")]
#[panic_handler]
fn panic(_: &core::panic::PanicInfo) -> ! {
    core::arch::wasm32::unreachable()
}

/// The input buffer, `input_capacity()` bytes, which the next call that takes lengths reads.
#[unsafe(no_mangle)]
pub extern "C" fn input_ptr() -> *mut u8 {
    engine().input.as_mut_ptr()
}

#[unsafe(no_mangle)]
pub extern "C" fn input_capacity() -> u32 {
    INPUT_CAPACITY as u32
}

/// The core's `RULES_VERSION`, which journals carry (README §6.3).
#[unsafe(no_mangle)]
pub extern "C" fn rules_version() -> u32 {
    u32::from(RULES_VERSION)
}

/// Checks the level bytes in the first `len` bytes of the input buffer: 0 for a valid level,
/// otherwise the first broken rule's code (20 to 39).
#[unsafe(no_mangle)]
pub extern "C" fn validate_level(len: u32) -> u32 {
    match input(&engine().input, len) {
        Some(bytes) => code(checked_level(bytes).map(|_| ())),
        None => MISUSE,
    }
}

/// Computes keccak256 of the first `len` bytes of the input buffer, the level id of level bytes
/// (README §5), valid or not, into the 32 bytes at `level_id_ptr`.
#[unsafe(no_mangle)]
pub extern "C" fn level_id(len: u32) -> u32 {
    let Engine {
        input, level_id, ..
    } = engine();
    match self::input(input, len) {
        Some(bytes) => {
            *level_id = level::level_id(bytes);
            0
        }
        None => MISUSE,
    }
}

/// The level id that the last `level_id` call computed.
#[unsafe(no_mangle)]
pub extern "C" fn level_id_ptr() -> *const u8 {
    engine().level_id.as_ptr()
}

/// Decodes the level bytes in the first `len` bytes of the input buffer with the core's codec
/// (README §5) into the editor's buffers, `edit_cells_ptr` and `edit_fields_ptr`. Returns 0, or
/// the code of the first rule the decoder checks that the bytes break (20 to 34), leaving the
/// buffers as they were.
#[unsafe(no_mangle)]
pub extern "C" fn decode_level(len: u32) -> u32 {
    let Engine {
        input,
        edit_cells,
        edit_fields,
        ..
    } = engine();
    let Some(bytes) = self::input(input, len) else {
        return MISUSE;
    };
    match level::decode(bytes) {
        Ok(level) => {
            for (cell, obstacle) in edit_cells.iter_mut().zip(level.obstacle_bits()) {
                *cell = u8::from(obstacle);
            }
            *edit_fields = edit_fields_of(&level);
            0
        }
        Err(error) => u32::from(error.code()),
    }
}

/// Encodes the editor's buffers with the core's codec (README §5) into the 472 bytes at
/// `level_out_ptr`, valid or not. Returns 0, or `MISUSE` when a cell is neither 0 nor 1, or a
/// field does not fit its width in the level bytes.
#[unsafe(no_mangle)]
pub extern "C" fn encode_level() -> u32 {
    let Engine {
        edit_cells,
        edit_fields,
        level_out,
        ..
    } = engine();
    match edited_level(edit_cells, edit_fields) {
        Some(edited) => {
            *level_out = level::encode(&edited);
            0
        }
        None => MISUSE,
    }
}

/// The editor's cells, `CELLS` bytes, which `decode_level` writes and `encode_level` reads.
#[unsafe(no_mangle)]
pub extern "C" fn edit_cells_ptr() -> *mut u8 {
    engine().edit_cells.as_mut_ptr()
}

/// The editor's fields, `EDIT_FIELDS` u32 values, which `decode_level` writes and
/// `encode_level` reads.
#[unsafe(no_mangle)]
pub extern "C" fn edit_fields_ptr() -> *mut u32 {
    engine().edit_fields.as_mut_ptr()
}

#[unsafe(no_mangle)]
pub extern "C" fn level_out_ptr() -> *const u8 {
    engine().level_out.as_ptr()
}

fn edit_fields_of(level: &Level) -> [u32; EDIT_FIELDS] {
    let [m0, m1, m2] = level.minion_spawns;
    let Rect { x0, y0, x1, y1 } = level.spawn;
    [
        u32::from(level.boss_size),
        u32::from(x0),
        u32::from(y0),
        u32::from(x1),
        u32::from(y1),
        u32::from(level.boss_period),
        u32::from(level.minion_count),
        u32::from(m0.x),
        u32::from(m0.y),
        u32::from(m1.x),
        u32::from(m1.y),
        u32::from(m2.x),
        u32::from(m2.y),
        u32::from(level.minion_period),
        u32::from(level.respawn_delay),
        u32::from(level.time_limit),
        u32::from(level.lives),
        u32::from(level.target_bp),
    ]
}

/// The level of the editor's buffers, or `None` when a value does not fit.
fn edited_level(cells: &[u8; CELLS], fields: &[u32; EDIT_FIELDS]) -> Option<Level> {
    let mut obstacles = [false; CELLS];
    for (obstacle, &cell) in obstacles.iter_mut().zip(cells) {
        *obstacle = match cell {
            0 => false,
            1 => true,
            _ => return None,
        };
    }
    let [
        boss_size,
        x0,
        y0,
        x1,
        y1,
        boss_period,
        minion_count,
        m0x,
        m0y,
        m1x,
        m1y,
        m2x,
        m2y,
        minion_period,
        respawn_delay,
        time_limit,
        lives,
        target_bp,
    ] = *fields;
    let byte = |value: u32| u8::try_from(value).ok();
    let word = |value: u32| u16::try_from(value).ok();
    let pos = |x: u32, y: u32| {
        Some(Pos {
            x: byte(x)?,
            y: byte(y)?,
        })
    };
    Some(Level {
        obstacles: Level::obstacle_bitmap(&obstacles),
        boss_size: byte(boss_size)?,
        spawn: Rect {
            x0: byte(x0)?,
            y0: byte(y0)?,
            x1: byte(x1)?,
            y1: byte(y1)?,
        },
        boss_period: byte(boss_period)?,
        minion_count: byte(minion_count)?,
        minion_spawns: [pos(m0x, m0y)?, pos(m1x, m1y)?, pos(m2x, m2y)?],
        minion_period: byte(minion_period)?,
        respawn_delay: word(respawn_delay)?,
        time_limit: word(time_limit)?,
        lives: byte(lives)?,
        target_bp: word(target_bp)?,
    })
}

/// Checks the level in the first `len` bytes of the input buffer, as `validate_level` does,
/// and, if valid, makes it the level that `start` plays, ending any level in play. A rejected
/// level changes nothing.
#[unsafe(no_mangle)]
pub extern "C" fn load_level(len: u32) -> u32 {
    let Engine {
        input, level, play, ..
    } = engine();
    let Some(bytes) = self::input(input, len) else {
        return MISUSE;
    };
    let Ok(level_bytes) = <[u8; LEVEL_LEN]>::try_from(bytes) else {
        return code(Err(Error::LevelLength));
    };
    match checked_level(bytes) {
        Ok(checked) => {
            *level = Some((checked, level_bytes));
            *play = Play::Idle;
            0
        }
        Err(error) => code(Err(error)),
    }
}

/// Starts the loaded level for a run nonce written in the first 32 bytes of the input buffer,
/// in `mode` (0 Training, 1 Challenge) at `level_index` (0 to 5), with an empty journal whose
/// level id is keccak256 of the level bytes.
#[unsafe(no_mangle)]
pub extern "C" fn start(mode: u32, level_index: u32) -> u32 {
    let Engine {
        input,
        level,
        play,
        dirty,
        ..
    } = engine();
    let Some((level, level_bytes)) = level else {
        return MISUSE;
    };
    let mode = match mode {
        0 => Mode::Training,
        1 => Mode::Challenge,
        _ => return code(Err(Error::Mode)),
    };
    let Ok(level_index) = u8::try_from(level_index) else {
        return code(Err(Error::LevelIndex));
    };
    let Some(&run_nonce) = input.first_chunk::<32>() else {
        return MISUSE;
    };
    let header = Header {
        mode,
        run_nonce,
        level_id: level::level_id(level_bytes),
        level_index,
    };
    match Recorder::new(level, &header) {
        Ok(started) => {
            *play = Play::Running(started);
            *dirty = DirtyCells::new();
            0
        }
        Err(error) => code(Err(error)),
    }
}

/// Processes the next tick with `raw_mask` (the input bits of README §6.1) through the
/// Recorder: journaled if it changed, then played. A mask with bit 7 or a higher bit set is
/// rejected with code 10. Ticking an ended level changes nothing.
#[unsafe(no_mangle)]
pub extern "C" fn tick(raw_mask: u32) -> u32 {
    let Play::Running(recorder) = &mut engine().play else {
        return MISUSE;
    };
    let Some(mask) = u8::try_from(raw_mask).ok().and_then(InputMask::new) else {
        return code(Err(Error::ReservedBit));
    };
    code(recorder.step(mask).map(|_| ()))
}

/// How the level ended (README §7.3: 1 Committed, 2 Cleared, 3 out of lives, 4 time limit),
/// or 0 while it goes on.
#[unsafe(no_mangle)]
pub extern "C" fn end_reason() -> u32 {
    game(&engine().play)
        .and_then(|game| game.end)
        .map_or(0, |end| end as u32)
}

/// The grid of the level in play, refreshed by this call: 3,600 bytes in row-major order, one
/// cell value of README §4.1 each (0 `EMPTY`, 1 `CLAIMED`, 2 `TRAIL`).
#[unsafe(no_mangle)]
pub extern "C" fn grid_ptr() -> *const u8 {
    let Engine { play, grid, .. } = engine();
    if let Some(game) = game(play) {
        for (byte, cell) in grid.iter_mut().zip(CellIndex::all()) {
            *byte = game.grid.get(cell) as u8;
        }
    }
    grid.as_ptr()
}

/// Compares the grid in play with the cells last reported, and returns how many changed: every
/// cell on the first call after `start`. Their indices, row-major, are at `dirty_ptr`, as u16.
#[unsafe(no_mangle)]
pub extern "C" fn dirty_cells() -> u32 {
    let Engine { play, dirty, .. } = engine();
    game(play).map_or(0, |game| {
        u32::try_from(dirty.update(&game.grid).len()).unwrap_or(0)
    })
}

#[unsafe(no_mangle)]
pub extern "C" fn dirty_ptr() -> *const u16 {
    engine().dirty.changed().as_ptr()
}

fn with_game(read: impl FnOnce(&Game) -> u32) -> u32 {
    game(&engine().play).map_or(0, read)
}

#[unsafe(no_mangle)]
pub extern "C" fn player_x() -> u32 {
    with_game(|game| u32::from(game.player.pos.x))
}

#[unsafe(no_mangle)]
pub extern "C" fn player_y() -> u32 {
    with_game(|game| u32::from(game.player.pos.y))
}

/// 1 while the player is cutting, else 0.
#[unsafe(no_mangle)]
pub extern "C" fn player_cutting() -> u32 {
    with_game(|game| u32::from(game.player.cutting))
}

#[unsafe(no_mangle)]
pub extern "C" fn lives() -> u32 {
    with_game(|game| u32::from(game.player.lives))
}

/// Shield charges left (D6).
#[unsafe(no_mangle)]
pub extern "C" fn shield() -> u32 {
    with_game(|game| u32::from(game.player.shield))
}

/// Protected ticks left (README §4.3).
#[unsafe(no_mangle)]
pub extern "C" fn invulnerable() -> u32 {
    with_game(|game| u32::from(game.player.invulnerable))
}

/// The top-left cell of the boss's body.
#[unsafe(no_mangle)]
pub extern "C" fn boss_x() -> u32 {
    with_game(|game| u32::from(game.boss.pos.x))
}

#[unsafe(no_mangle)]
pub extern "C" fn boss_y() -> u32 {
    with_game(|game| u32::from(game.boss.pos.y))
}

/// B, the side of the boss's body in cells.
#[unsafe(no_mangle)]
pub extern "C" fn boss_size() -> u32 {
    with_game(|game| u32::from(game.boss.size))
}

fn with_minion(slot: u32, read: impl FnOnce(&State) -> u32) -> u32 {
    with_game(|game| {
        usize::try_from(slot)
            .ok()
            .and_then(|slot| game.minions.slots.get(slot))
            .and_then(|minion| minion.as_ref())
            .map_or(0, |minion| read(&minion.state))
    })
}

/// Minion `slot` (0 to 2): 0 unused, 1 live, 2 destroyed.
#[unsafe(no_mangle)]
pub extern "C" fn minion_state(slot: u32) -> u32 {
    with_minion(slot, |state| match state {
        State::Live { .. } => 1,
        State::Destroyed { .. } => 2,
    })
}

/// The cell of live minion `slot`; 0 for any other slot.
#[unsafe(no_mangle)]
pub extern "C" fn minion_x(slot: u32) -> u32 {
    with_minion(slot, |state| match state {
        State::Live { pos, .. } => u32::from(pos.x),
        State::Destroyed { .. } => 0,
    })
}

#[unsafe(no_mangle)]
pub extern "C" fn minion_y(slot: u32) -> u32 {
    with_minion(slot, |state| match state {
        State::Live { pos, .. } => u32::from(pos.y),
        State::Destroyed { .. } => 0,
    })
}

/// The heading of live minion `slot`: 0 N, 1 E, 2 S, 3 W; 0 for any other slot.
#[unsafe(no_mangle)]
pub extern "C" fn minion_heading(slot: u32) -> u32 {
    with_minion(slot, |state| match state {
        State::Live { heading, .. } => u32::from(heading_code(*heading)),
        State::Destroyed { .. } => 0,
    })
}

/// The claim in basis points (README §4.1).
#[unsafe(no_mangle)]
pub extern "C" fn claim_bp() -> u32 {
    with_game(|game| grid::claim_bp(game.captured, game.claimable))
}

/// The level's target in basis points.
#[unsafe(no_mangle)]
pub extern "C" fn target_bp() -> u32 {
    with_game(|game| u32::from(game.target_bp))
}

/// The ticks processed so far (README §4.10).
#[unsafe(no_mangle)]
pub extern "C" fn ticks_used() -> u32 {
    with_game(|game| u32::from(game.ticks_used))
}

/// The ticks left before the time limit.
#[unsafe(no_mangle)]
pub extern "C" fn ticks_left() -> u32 {
    with_game(|game| u32::from(game.time_limit.saturating_sub(game.ticks_used)))
}

/// The state hash v1 of the level in play after its last tick (README §6.4): 32 bytes.
#[unsafe(no_mangle)]
pub extern "C" fn state_hash() -> *const u8 {
    let Engine {
        play, hash: buffer, ..
    } = engine();
    if let Some(game) = game(play) {
        *buffer = hash::state_hash(game);
    }
    buffer.as_ptr()
}

/// The state-hash preimage of the level in play after its last tick, `preimage_len()` bytes,
/// in the buffer that `preimage_ptr` also reads.
#[unsafe(no_mangle)]
pub extern "C" fn state_preimage() -> *const u8 {
    let Engine {
        play,
        preimage: buffer,
        ..
    } = engine();
    if let Some(game) = game(play) {
        *buffer = preimage(game);
    }
    buffer.as_ptr()
}

/// The preimage buffer as the last `state_preimage` or `replay_preimage` left it.
#[unsafe(no_mangle)]
pub extern "C" fn preimage_ptr() -> *const u8 {
    engine().preimage.as_ptr()
}

#[unsafe(no_mangle)]
pub extern "C" fn preimage_len() -> u32 {
    PREIMAGE_LEN as u32
}

/// The journal of the level in play so far (README §6.3).
#[unsafe(no_mangle)]
pub extern "C" fn journal_ptr() -> *const u8 {
    engine()
        .play
        .recorder()
        .map_or(core::ptr::null(), |recorder| recorder.journal().as_ptr())
}

#[unsafe(no_mangle)]
pub extern "C" fn journal_len() -> u32 {
    // A journal is at most MAX_JOURNAL_LEN bytes, so the length fits in u32.
    engine()
        .play
        .recorder()
        .map_or(0, |recorder| recorder.journal().len() as u32)
}

/// Replays a level of `level_len` bytes followed in the input buffer by a journal of
/// `journal_len` bytes, scored with `weight_bp` (README §7.3). Returns 0 and fills the Outcome
/// (`outcome_ptr`), or the code replay returns, with the Outcome all zero. Either way the trace
/// (`trace_ptr`) holds the state hash of every tick played.
#[unsafe(no_mangle)]
pub extern "C" fn replay(level_len: u32, journal_len: u32, weight_bp: u32) -> u32 {
    let Engine {
        input,
        trace,
        trace_ticks,
        outcome,
        ..
    } = engine();
    let Some((level, journal)) = level_and_journal(input, level_len, journal_len) else {
        return MISUSE;
    };
    let Ok(weight_bp) = u16::try_from(weight_bp) else {
        return MISUSE;
    };
    let mut slots = trace.as_chunks_mut::<HASH_LEN>().0.iter_mut();
    let mut ticks: u16 = 0;
    let result = replay_observed(level, journal, weight_bp, |game| {
        if let Some(slot) = slots.next() {
            *slot = hash::state_hash(game);
            ticks = ticks.saturating_add(1);
        }
    });
    *trace_ticks = ticks;
    *outcome = result.as_ref().map_or([0; OUTCOME_LEN], encode_outcome);
    code(result.map(|_| ()))
}

/// The Outcome of the last `replay`, `OUTCOME_LEN` (110) bytes in the order of README §7.3.
#[unsafe(no_mangle)]
pub extern "C" fn outcome_ptr() -> *const u8 {
    engine().outcome.as_ptr()
}

/// The trace of the last `replay`: `trace_ticks()` state hashes of 32 bytes, in tick order.
#[unsafe(no_mangle)]
pub extern "C" fn trace_ptr() -> *const u8 {
    engine().trace.as_ptr()
}

#[unsafe(no_mangle)]
pub extern "C" fn trace_ticks() -> u32 {
    u32::from(engine().trace_ticks)
}

/// Replays as `replay` does, but records only the state-hash preimage of tick `tick` into the
/// preimage buffer (`preimage_ptr`), for diagnosis (README §6.6); all zero if the replay never
/// reached that tick. Returns replay's code.
#[unsafe(no_mangle)]
pub extern "C" fn replay_preimage(
    level_len: u32,
    journal_len: u32,
    weight_bp: u32,
    tick: u32,
) -> u32 {
    let Engine {
        input,
        preimage: buffer,
        ..
    } = engine();
    let Some((level, journal)) = level_and_journal(input, level_len, journal_len) else {
        return MISUSE;
    };
    let Ok(weight_bp) = u16::try_from(weight_bp) else {
        return MISUSE;
    };
    *buffer = [0; PREIMAGE_LEN];
    let result = replay_observed(level, journal, weight_bp, |game| {
        if game.ticks_used.checked_sub(1).map(u32::from) == Some(tick) {
            *buffer = preimage(game);
        }
    });
    code(result.map(|_| ()))
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
