//! Splitter (plan M5.18): on a level with two bosses, a straight cut from the rail that would
//! leave the bosses in different regions, the dividing wall of README §4.8, whenever one is out of
//! both bosses' reach as Bold reckons it; otherwise, and on a level with one boss, it plays Bold.
//! It judges a cut on the grid as it stands, with the bosses where they are, as a person would.

use jiro_core::consts::CAPTURE_STACK;
use jiro_core::game::Game;
use jiro_core::types::{Cell, CellIndex, Dir, InputMask, Pos};

use super::greedy::{Area, Caution, Greedy};
use crate::scenarios::play::{in_boss, neighbor};

#[cfg(test)]
mod tests;

pub struct Splitter {
    bold: Greedy,
    /// The direction of the separating cut in progress.
    cut: Option<Dir>,
}

impl Splitter {
    pub fn new(seed: u64) -> Self {
        Self {
            bold: Greedy::new(seed, Caution::BOLD),
            cut: None,
        }
    }

    pub fn mask(&mut self, game: &Game) -> InputMask {
        if !game.player.cutting {
            self.cut = splitting_cut(game);
        }
        match self.cut {
            Some(dir) => dir.mask(),
            None => self.bold.mask(game),
        }
    }
}

/// The shortest straight cut from the player's rail cell that separates the bosses and that
/// both stay clear of, by Bold's margin, for the ticks it takes.
fn splitting_cut(game: &Game) -> Option<Dir> {
    let second = game.bosses.second?;
    Dir::PRIORITY
        .into_iter()
        .filter_map(|dir| Some((dir, straight_cut(game, dir)?)))
        .filter(|(dir, cells)| safe(game, *dir, cells.len()) && separates(game, cells, second.pos))
        .min_by_key(|(_, cells)| cells.len())
        .map(|(dir, _)| dir)
}

/// The open cells a cut straight out in `dir` crosses before it reaches `CLAIMED`, or `None` if
/// it starts on no open cell or meets a boss's body, `TRAIL` or the edge of the grid first.
fn straight_cut(game: &Game, dir: Dir) -> Option<Vec<Pos>> {
    let mut cells = Vec::new();
    let mut pos = game.player.pos;
    loop {
        pos = neighbor(pos, dir)?;
        match game.grid.at(pos)? {
            Cell::Empty if !in_boss(game, pos) => cells.push(pos),
            Cell::Claimed if !cells.is_empty() => return Some(cells),
            _ => return None,
        }
    }
}

/// Whether each boss stays Bold's margin away from the cut's cells for the ticks it takes: one
/// to enter the field, then two cells a tick.
fn safe(game: &Game, dir: Dir, length: usize) -> bool {
    let Ok(depth) = u8::try_from(length) else {
        return false;
    };
    let Some(line) = Area::spanned(game.player.pos, dir, dir, depth, 0) else {
        return false;
    };
    let ticks = i16::from(depth) / 2 + 1;
    game.bosses
        .iter()
        .all(|boss| Area::of_boss(boss).gap(line) >= Caution::BOLD.margin(ticks, boss.period))
}

/// Whether the trail `cells` would leave the second boss, whose top-left cell is `second`, out of
/// the first boss's region: the test of README §4.8, R4.8-5, on a copy of the grid.
fn separates(game: &Game, cells: &[Pos], second: Pos) -> bool {
    let mut grid = game.grid.clone();
    for &pos in cells {
        if let Some(cell) = CellIndex::new(pos) {
            grid.set(cell, Cell::Trail);
        }
    }
    let first = game.bosses.first.body().filter_map(CellIndex::new);
    grid.mark_boss_zone(first, &mut [0; CAPTURE_STACK])
        .expect("the fill fits the stack");
    grid.at(second) != Some(Cell::BossZone)
}
