//! Capture (README §4.8): a cut that reaches `CLAIMED` claims every region the boss is not in.

use crate::consts::{CAPTURE_PASS_WORK, CAPTURE_STACK};
use crate::grid::Grid;
use crate::types::{Cell, CellIndex};

/// What a capture did.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Capture {
    /// The capture size: the cells that became `CLAIMED` [R4.8-4].
    pub size: u16,
    /// The cells its fill marked `BOSS_ZONE` [R4.8-2, R4.8-3].
    pub boss_zone: u16,
}

impl Capture {
    /// The work the capture adds: 150 plus its `BOSS_ZONE` cells [R4.11-2].
    pub fn work(self) -> u32 {
        CAPTURE_PASS_WORK.saturating_add(u32::from(self.boss_zone))
    }
}

/// Marks the boss's body and the `EMPTY` cells 4-connected to it as `BOSS_ZONE`, then makes one
/// pass: `BOSS_ZONE` becomes `EMPTY`, and `EMPTY` and `TRAIL` become `CLAIMED` [R4.8-1 to
/// R4.8-4]. `body` holds the body cells of every boss. `None` only if `stack` overflowed, which
/// `Grid::mark_boss_zone` rules out.
pub fn capture(
    grid: &mut Grid,
    body: impl IntoIterator<Item = CellIndex>,
    stack: &mut [u16; CAPTURE_STACK],
) -> Option<Capture> {
    grid.mark_boss_zone(body, stack)?;
    let mut done = Capture {
        size: 0,
        boss_zone: 0,
    };
    for cell in CellIndex::all() {
        match grid.get(cell) {
            Cell::BossZone => {
                grid.set(cell, Cell::Empty);
                done.boss_zone = done.boss_zone.checked_add(1)?;
            }
            Cell::Empty | Cell::Trail => {
                grid.set(cell, Cell::Claimed);
                done.size = done.size.checked_add(1)?;
            }
            Cell::Claimed => {}
        }
    }
    Some(done)
}
