//! Minions (README §4.7): the right-hand rule on the rail, the orientation step, and the
//! lifecycle of PIN-17. Headings are directions: N is up, E right, S down, W left.

use crate::consts::MINION_SLOTS;
use crate::grid::Grid;
use crate::level::Level;
use crate::types::{Cell, CellIndex, Dir, Pos};

/// The headings in the order the orientation step tests them: N, E, S, W [R4.7-3].
const ORIENTATION_ORDER: [Dir; 4] = [Dir::Up, Dir::Right, Dir::Down, Dir::Left];

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum State {
    Live {
        pos: Pos,
        heading: Dir,
    },
    /// Destroyed by a capture; respawns when the countdown reaches zero (PIN-17).
    Destroyed {
        countdown: u16,
    },
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Minion {
    pub spawn: Pos,
    pub state: State,
}

/// A minion's cell at the start and at the end of step 5, for the hit predicate (PIN-15).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Moved {
    pub from: Pos,
    pub to: Pos,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Minions {
    pub slots: [Option<Minion>; MINION_SLOTS],
    pub period: u8,
    pub respawn_delay: u16,
}

impl Minions {
    /// The level's minions at their spawn cells, each facing N, then oriented (PIN-16).
    pub fn start(level: &Level, grid: &Grid) -> Self {
        let mut slots = [None; MINION_SLOTS];
        for (slot, spawn) in slots.iter_mut().zip(level.minions()) {
            *slot = Some(Minion {
                spawn,
                state: State::Live {
                    pos: spawn,
                    heading: orient(grid, spawn, Dir::Up),
                },
            });
        }
        Self {
            slots,
            period: level.minion_period,
            respawn_delay: level.respawn_delay,
        }
    }

    /// Step 3, after a capture: a live minion whose cell is no longer a rail cell is destroyed,
    /// with its countdown set to R; every other live minion runs the orientation step
    /// [R4.7-7, R4.7-8].
    pub fn after_capture(&mut self, grid: &Grid) {
        for minion in self.slots.iter_mut().flatten() {
            if let State::Live { pos, heading } = minion.state {
                minion.state = if grid.is_rail(pos) {
                    State::Live {
                        pos,
                        heading: orient(grid, pos, heading),
                    }
                } else {
                    State::Destroyed {
                        countdown: self.respawn_delay,
                    }
                };
            }
        }
    }

    /// Step 5, in index order: a destroyed minion counts down and respawns, oriented and without
    /// moving, at zero; a live one takes one right-hand step on the ticks that are multiples of
    /// the period [R4.7-9, R4.7-10]. Returns each present minion's cells for the hit predicate.
    pub fn step(&mut self, grid: &Grid, tick: u16) -> [Option<Moved>; MINION_SLOTS] {
        let moves_now = tick.checked_rem(u16::from(self.period)) == Some(0);
        let mut moved = [None; MINION_SLOTS];
        for (slot, moved) in self.slots.iter_mut().zip(moved.iter_mut()) {
            let Some(minion) = slot else { continue };
            minion.state = match minion.state {
                State::Destroyed { countdown } => match countdown.checked_sub(1) {
                    Some(0) | None => respawn(grid, minion.spawn).map_or(
                        State::Destroyed { countdown: 0 },
                        |pos| State::Live {
                            pos,
                            heading: orient(grid, pos, Dir::Up),
                        },
                    ),
                    Some(countdown) => State::Destroyed { countdown },
                },
                State::Live { pos, heading } if moves_now => {
                    let (to, heading) = right_hand_step(grid, pos, heading);
                    *moved = Some(Moved { from: pos, to });
                    State::Live { pos: to, heading }
                }
                live => live,
            };
            if let (State::Live { pos, .. }, None) = (minion.state, *moved) {
                *moved = Some(Moved { from: pos, to: pos });
            }
        }
        moved
    }
}

/// The first heading, in the order N, E, S, W, with open field on its right and a rail cell
/// ahead; `current` if none qualifies [R4.7-3, PIN-06].
pub fn orient(grid: &Grid, pos: Pos, current: Dir) -> Dir {
    ORIENTATION_ORDER
        .into_iter()
        .find(|&heading| {
            let right = neighbor(pos, heading.clockwise()).and_then(|cell| grid.at(cell));
            let ahead = neighbor(pos, heading).is_some_and(|cell| grid.is_rail(cell));
            matches!(right, Some(Cell::Empty | Cell::Trail)) && ahead
        })
        .unwrap_or(current)
}

/// Right, then straight, then left, then back: the first direction whose target is a rail cell.
/// With none, the minion stays and keeps its heading [R4.7-2, PIN-18].
pub fn right_hand_step(grid: &Grid, pos: Pos, heading: Dir) -> (Pos, Dir) {
    let right = heading.clockwise();
    let back = right.clockwise();
    let left = back.clockwise();
    [right, heading, left, back]
        .into_iter()
        .find_map(|direction| {
            neighbor(pos, direction)
                .filter(|&target| grid.is_rail(target))
                .map(|target| (target, direction))
        })
        .unwrap_or((pos, heading))
}

/// The spawn cell if it is a rail cell, else the first rail cell in row-major order [R4.7-7].
fn respawn(grid: &Grid, spawn: Pos) -> Option<Pos> {
    if grid.is_rail(spawn) {
        return Some(spawn);
    }
    CellIndex::all()
        .map(CellIndex::pos)
        .find(|&pos| grid.is_rail(pos))
}

fn neighbor(pos: Pos, direction: Dir) -> Option<Pos> {
    let (dx, dy) = direction.offset();
    pos.offset(dx, dy)
}
