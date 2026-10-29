//! DirtyCells: the cells whose state changed since the last redraw, found by comparing the
//! core grid with a shadow copy, in row-major order.

use jiro_core::consts::CELLS;
use jiro_core::grid::Grid;
use jiro_core::types::CellIndex;

pub struct DirtyCells {
    /// Each cell's state plus one, as last reported; 0 for a cell never reported. All zero at
    /// first, so a static `DirtyCells` needs no initialized data.
    shadow: [u8; CELLS],
    changed: [u16; CELLS],
    count: u16,
}

impl Default for DirtyCells {
    fn default() -> Self {
        Self::new()
    }
}

impl DirtyCells {
    /// A shadow that matches no grid, so the first `update` reports every cell.
    pub const fn new() -> Self {
        Self {
            shadow: [0; CELLS],
            changed: [0; CELLS],
            count: 0,
        }
    }

    /// Compares `grid` with the shadow, records the indices of the cells that differ, and
    /// copies them into the shadow. Returns their indices, in row-major order.
    pub fn update(&mut self, grid: &Grid) -> &[u16] {
        self.count = 0;
        for ((cell, shadow), index) in CellIndex::all().zip(self.shadow.iter_mut()).zip(0_u16..) {
            let state = (grid.get(cell) as u8).saturating_add(1);
            if *shadow != state {
                *shadow = state;
                if let Some(slot) = self.changed.get_mut(usize::from(self.count)) {
                    *slot = index;
                    self.count = self.count.saturating_add(1);
                }
            }
        }
        self.changed()
    }

    /// The indices that the last `update` found.
    pub fn changed(&self) -> &[u16] {
        self.changed
            .get(..usize::from(self.count))
            .unwrap_or(&self.changed)
    }
}
