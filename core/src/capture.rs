//! Capture (README §4.8): a cut that reaches `CLAIMED` claims every region no boss is in, and
//! a cut that leaves two bosses in different regions separates them.

use crate::boss::{Boss, Bosses};
use crate::consts::{CAPTURE_PASS_WORK, CAPTURE_STACK};
use crate::grid::Grid;
use crate::types::{Cell, CellIndex};

/// What a capture did.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Capture {
    /// The capture size: the cells that became `CLAIMED` [R4.8-4].
    pub size: u16,
    /// The cells its fills marked `BOSS_ZONE` [R4.8-2, R4.8-3].
    pub boss_zone: u16,
    /// Boss 1's body was not reached by the fill from boss 0's [R4.8-5].
    pub separated: bool,
}

impl Capture {
    /// The work the capture adds: 150 plus its `BOSS_ZONE` cells [R4.11-2].
    pub fn work(self) -> u32 {
        CAPTURE_PASS_WORK.saturating_add(u32::from(self.boss_zone))
    }
}

/// Marks boss 0's body and the `EMPTY` cells 4-connected to it as `BOSS_ZONE`. If boss 1's
/// top-left cell is not `BOSS_ZONE` then, the bosses are separated, and boss 1's body and its
/// region are marked the same way. Then one pass: `BOSS_ZONE` becomes `EMPTY`, and `EMPTY` and
/// `TRAIL` become `CLAIMED` [R4.8-1 to R4.8-5]. `None` only if `stack` overflowed, which
/// `Grid::mark_boss_zone` rules out.
pub fn capture(
    grid: &mut Grid,
    bosses: &Bosses,
    stack: &mut [u16; CAPTURE_STACK],
) -> Option<Capture> {
    grid.mark_boss_zone(body(&bosses.first), stack)?;
    let separated = bosses.second.is_some_and(|second| {
        CellIndex::new(second.pos).is_some_and(|cell| grid.get(cell) != Cell::BossZone)
    });
    if let Some(second) = bosses.second.filter(|_| separated) {
        grid.mark_boss_zone(body(&second), stack)?;
    }
    let mut done = Capture {
        size: 0,
        boss_zone: 0,
        separated,
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

fn body(boss: &Boss) -> impl Iterator<Item = CellIndex> {
    boss.body().filter_map(CellIndex::new)
}
