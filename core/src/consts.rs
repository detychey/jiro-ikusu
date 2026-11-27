use crate::types::Pos;

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
pub const RULES_VERSION: u16 = 4;
/// Levels in a run; `levelIndex` stays below it (README §6.3).
pub const RUN_LEVELS: usize = 6;
/// Levels in a season, the deck the draw picks from (README §8.2).
pub const SEASON_LEVELS: usize = 16;
/// Journal format version (README §6.3).
pub const JOURNAL_VERSION: u8 = 1;
/// Journal header bytes (README §6.3).
pub const HEADER_LEN: usize = 71;
/// Bytes per journal event: u16 tick, u8 mask (README §6.2).
pub const EVENT_LEN: usize = 3;
/// A journal with `MAX_EVENTS` events: the header and the 8,100-byte event area (README §2).
pub const MAX_JOURNAL_LEN: usize = HEADER_LEN + 8_100;
/// Level bytes v1, a level with one boss (README §5).
pub const LEVEL_LEN: usize = 472;
/// Level bytes v2, a level with two bosses: v1's fields, then the second boss's 6 bytes
/// (README §5).
pub const LEVEL_V2_LEN: usize = 478;
/// The newest level format version (README §5); the core reads v1 and v2.
pub const LEVEL_VERSION: u8 = 2;
/// The obstacle bitmap: one bit per cell (README §5).
pub const OBSTACLE_BYTES: usize = 450;
/// Smallest and largest boss body size B (README §5, D9).
pub const MIN_BOSS_SIZE: u8 = 2;
pub const MAX_BOSS_SIZE: u8 = 8;
/// Minion slots in a level (README §5).
pub const MINION_SLOTS: usize = 3;
/// Smallest open area: half of the 3,364-cell interior (README §5).
pub const MIN_OPEN_AREA: u16 = 1_682;
/// Basis points in a whole (README §4.1).
pub const BP: u16 = 10_000;
/// The player's cell at level start (README §4.5, PIN-01).
pub const PLAYER_START: Pos = Pos { x: 30, y: 59 };
/// The protected ticks after a life is lost (R4.9-17, PIN-02).
pub const INVULNERABLE_TICKS: u8 = 30;
/// The work at which a level ends (R4.11-4).
pub const WORK_BUDGET: u32 = 300_000;
/// The work a capture adds besides its `BOSS_ZONE` cells: the share of the pass over every
/// cell (R4.11-2).
pub const CAPTURE_PASS_WORK: u32 = 150;
