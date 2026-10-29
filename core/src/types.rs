use crate::consts::W;

/// A cell state [R4.1-2].
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u8)]
pub enum Cell {
    Empty = 0,
    Claimed = 1,
    Trail = 2,
    BossZone = 3,
}

/// A cell position; (0, 0) is the top-left corner [R4.1-1].
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Pos {
    pub x: u8,
    pub y: u8,
}

/// A direction, in the order of the input mask bits and of direction priority [R4.5-1].
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Dir {
    Up,
    Down,
    Left,
    Right,
}

/// The input mask of README §6.1. Bit 7 is reserved, so a mask never has it set.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct InputMask(pub(crate) u8);

impl InputMask {
    pub const NONE: Self = Self(0);
    pub const UP: Self = Self(1 << 0);
    pub const DOWN: Self = Self(1 << 1);
    pub const LEFT: Self = Self(1 << 2);
    pub const RIGHT: Self = Self(1 << 3);
    pub const A: Self = Self(1 << 4);
    pub const B: Self = Self(1 << 5);
    pub const X: Self = Self(1 << 6);
    const RESERVED: u8 = 1 << 7;

    /// The mask of these bits, or `None` if the reserved bit 7 is set.
    pub const fn new(bits: u8) -> Option<Self> {
        if bits & Self::RESERVED == 0 {
            Some(Self(bits))
        } else {
            None
        }
    }

    pub const fn bits(self) -> u8 {
        self.0
    }

    pub const fn contains(self, other: Self) -> bool {
        self.0 & other.0 == other.0
    }
}

/// The index `y × 60 + x` of a cell inside the grid, so always below `CELLS` [R4.1-1].
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct CellIndex(u16);

impl CellIndex {
    /// The index of `pos`, or `None` if `pos` is outside the grid.
    pub fn new(pos: Pos) -> Option<Self> {
        if pos.x >= W || pos.y >= W {
            return None;
        }
        u16::from(pos.y)
            .checked_mul(u16::from(W))
            .and_then(|row| row.checked_add(u16::from(pos.x)))
            .map(Self)
    }

    pub fn get(self) -> usize {
        usize::from(self.0)
    }
}
