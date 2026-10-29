/// Grid width and height in cells (README §4.1).
pub const W: u8 = 60;
/// Cells in the grid: 60 × 60 (README §2).
pub const CELLS: usize = 3_600;
/// Capture stack capacity: the 58 × 58 interior (README §2, §4.8).
pub const CAPTURE_STACK: usize = 3_364;
/// Highest time limit, so every tick of a level is below it (README §5, §6.3).
pub const MAX_TICKS: u16 = 2_700;
/// Events in a journal: at most one per tick (README §6.2).
pub const MAX_EVENTS: u16 = 2_700;
/// Ticks per second (README §2, §6.1).
pub const TICK_HZ: u8 = 15;
/// The rules version journals are played under (README §6.3, PIN-13).
pub const RULES_VERSION: u16 = 1;
/// Levels in a run; `levelIndex` stays below it (README §6.3).
pub const RUN_LEVELS: usize = 6;
/// Journal format version (README §6.3).
pub const JOURNAL_VERSION: u8 = 1;
/// Journal header bytes (README §6.3).
pub const HEADER_LEN: usize = 71;
/// Bytes per journal event: u16 tick, u8 mask (README §6.2).
pub const EVENT_LEN: usize = 3;
/// A journal with `MAX_EVENTS` events: the header and the 8,100-byte event area (README §2).
pub const MAX_JOURNAL_LEN: usize = HEADER_LEN + 8_100;
