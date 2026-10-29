/// A rejection, with the stable code of README §6.3.
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
}

impl Error {
    pub const fn code(self) -> u8 {
        self as u8
    }
}
