/// A rejection, with the stable code of README §6.3 (journal) or §5 (level).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u8)]
pub enum Error {
    Truncated = 1,
    TrailingBytes = 2,
    Version = 3,
    RulesVersion = 4,
    Mode = 5,
    LevelIndex = 6,
    EventCount = 7,
    TickLimit = 8,
    TickOrder = 9,
    ReservedBit = 10,
    UnchangedMask = 11,
    LevelLength = 20,
    LevelVersion = 21,
    BorderObstacle = 22,
    BossSize = 23,
    SpawnOrder = 24,
    SpawnBounds = 25,
    BossPeriod = 26,
    MinionCount = 27,
    MinionSpawn = 28,
    MinionSlot = 29,
    MinionPeriod = 30,
    RespawnDelay = 31,
    TimeLimit = 32,
    Lives = 33,
    Target = 34,
    OpenAreaSplit = 35,
    OpenAreaSmall = 36,
    BossSpawn = 37,
    MinionSpawnRail = 38,
    PlayerStartRail = 39,
}

impl Error {
    pub const fn code(self) -> u8 {
        self as u8
    }
}
