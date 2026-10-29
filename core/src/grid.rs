use core::num::{NonZeroU16, NonZeroU32};

use crate::consts::{BP, CELLS};
use crate::level::Level;
use crate::types::{Cell, CellIndex, Pos};

const NEIGHBORS_8: [(i8, i8); 8] = [
    (-1, -1),
    (0, -1),
    (1, -1),
    (-1, 0),
    (1, 0),
    (-1, 1),
    (0, 1),
    (1, 1),
];

/// The 60 × 60 cells, row-major [R4.1-1].
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Grid {
    cells: [Cell; CELLS],
}

impl Grid {
    /// The border and the level's obstacles are `CLAIMED`, every other cell is `EMPTY`
    /// [R4.1-7].
    pub fn level_start(level: &Level) -> Self {
        let mut cells = [Cell::Empty; CELLS];
        let cells_in_order = cells.iter_mut().zip(CellIndex::all());
        for ((cell, index), obstacle) in cells_in_order.zip(level.obstacle_bits()) {
            if obstacle || index.pos().is_border() {
                *cell = Cell::Claimed;
            }
        }
        Self { cells }
    }

    #[allow(clippy::indexing_slicing, reason = "a CellIndex is below CELLS")]
    pub fn get(&self, index: CellIndex) -> Cell {
        self.cells[index.get()]
    }

    #[allow(clippy::indexing_slicing, reason = "a CellIndex is below CELLS")]
    pub fn set(&mut self, index: CellIndex, cell: Cell) {
        self.cells[index.get()] = cell;
    }

    /// The cell at `pos`, or `None` outside the grid.
    pub fn at(&self, pos: Pos) -> Option<Cell> {
        CellIndex::new(pos).map(|index| self.get(index))
    }

    /// A `CLAIMED` cell with an `EMPTY` or `TRAIL` cell among its 8 neighbors
    /// [R4.2-1, R4.2-2, R4.2-3].
    pub fn is_rail(&self, pos: Pos) -> bool {
        self.at(pos) == Some(Cell::Claimed)
            && NEIGHBORS_8.iter().any(|&(dx, dy)| {
                let neighbor = pos.offset(dx, dy).and_then(|next| self.at(next));
                matches!(neighbor, Some(Cell::Empty | Cell::Trail))
            })
    }

    pub fn count(&self, cell: Cell) -> u16 {
        self.cells.iter().filter(|&&other| other == cell).count() as u16
    }

    pub fn replace(&mut self, from: Cell, to: Cell) {
        for cell in &mut self.cells {
            if *cell == from {
                *cell = to;
            }
        }
    }
}

/// captured × 10,000 / claimable, with a single floor division [R4.1-8].
pub fn claim_bp(captured: u16, claimable: NonZeroU16) -> u32 {
    const WHOLE: u32 = BP as u32;
    u32::from(captured) * WHOLE / NonZeroU32::from(claimable)
}
