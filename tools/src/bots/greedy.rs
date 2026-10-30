//! Greedy: from the rail, the largest rectangle it can cut out while the boss and the minions stay
//! clear of it, cut with A held. With no such rectangle in reach, it walks along the rail.

use jiro_core::boss::Boss;
use jiro_core::game::Game;
use jiro_core::grid::Grid;
use jiro_core::minion::State;
use jiro_core::types::{Cell, CellIndex, Dir, InputMask, Pos};

use crate::scenarios::play::{Plan, Rng, distance, mask, reverse, walk_rail};

#[cfg(test)]
mod tests;

/// The depths and widths Greedy weighs, in cells.
const LEGS: [u8; 12] = [1, 2, 3, 5, 8, 12, 17, 23, 30, 38, 47, 57];

/// Cells kept between the boss and a rectangle, on top of the cells the boss can move while the
/// cut is open.
const BOSS_MARGIN: i16 = 2;

/// Cells kept between a minion and a rectangle deeper than one cell. A strip one cell deep is
/// exempt: minions move only on the rail, so a minion right behind the player would otherwise
/// block every cut, and the strip, cut along the rail, captures the rail ahead of the minion.
const MINION_MARGIN: i16 = 3;

pub struct Greedy {
    rng: Rng,
    cut: Option<Cut>,
    walk: Dir,
}

/// A planned cut and its leg: out from the rail, sideways, then back until the cut closes. The
/// leg only moves forward, so the player never retraces a leg.
#[derive(Clone, Copy)]
struct Cut {
    plan: Plan,
    leg: Leg,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Leg {
    Out,
    Side,
    Back,
}

impl Cut {
    /// The mask that carries the cut on: the leg's direction, with A while at least two cells of
    /// the leg are left, so that the double step of a fast cut never overshoots a corner.
    fn mask(&mut self, game: &Game) -> InputMask {
        let plan = self.plan;
        let travelled = |dir: Dir| distance(plan.start, game.player.pos, dir);
        if self.leg == Leg::Out && travelled(plan.out) >= i16::from(plan.depth) {
            self.leg = Leg::Side;
        }
        if self.leg == Leg::Side && travelled(plan.side) >= i16::from(plan.width) {
            self.leg = Leg::Back;
        }
        let (dir, left) = match self.leg {
            Leg::Out => (plan.out, i16::from(plan.depth) - travelled(plan.out)),
            Leg::Side => (plan.side, i16::from(plan.width) - travelled(plan.side)),
            Leg::Back => (reverse(plan.out), travelled(plan.out)),
        };
        if left >= 2 {
            mask(&[dir.mask(), InputMask::A])
        } else {
            dir.mask()
        }
    }
}

impl Greedy {
    pub fn new(seed: u64) -> Self {
        Self {
            rng: Rng::new(seed),
            cut: None,
            walk: Dir::Left,
        }
    }

    pub fn mask(&mut self, game: &Game) -> InputMask {
        if game.player.cutting
            && let Some(cut) = &mut self.cut
        {
            return cut.mask(game);
        }
        self.cut = best_cut(game).map(|plan| Cut {
            plan,
            leg: Leg::Out,
        });
        match self.cut {
            Some(cut) => cut.plan.out.mask(),
            None => {
                let order = self.rng.shuffled(Dir::PRIORITY);
                walk_rail(&mut self.walk, &mut self.rng, game, order).mask()
            }
        }
    }
}

/// The largest safe rectangle the player can cut from its rail cell: open cells only, on a
/// straight run of claimed cells that closes the cut, far enough from the boss for the time the
/// cut takes, and from the minions.
fn best_cut(game: &Game) -> Option<Plan> {
    let open = OpenCells::new(&game.grid);
    let start = game.player.pos;
    let boss = Area::of_boss(&game.boss);
    let minions: Vec<Area> = game
        .minions
        .slots
        .iter()
        .flatten()
        .filter_map(|minion| match minion.state {
            State::Live { pos, .. } => Some(Area::cell(pos)),
            State::Destroyed { .. } => None,
        })
        .collect();
    let mut best: Option<(i16, Plan)> = None;
    for out in Dir::PRIORITY {
        for side in [out.clockwise(), reverse(out.clockwise())] {
            for depth in LEGS {
                for width in LEGS {
                    let (Some(rectangle), Some(base)) = (
                        Area::spanned(start, out, side, depth, width),
                        Area::spanned(start, side, side, 0, width),
                    ) else {
                        continue;
                    };
                    let cells = rectangle.cells();
                    if open.count(rectangle) != cells || open.count(base) != 0 {
                        continue;
                    }
                    let ticks = (2 * i16::from(depth) + i16::from(width)) / 2 + 1;
                    let margin = ticks / i16::from(game.boss.period) + BOSS_MARGIN;
                    let safe = boss.gap(rectangle) >= margin
                        && (depth == 1
                            || minions
                                .iter()
                                .all(|minion| minion.gap(rectangle) >= MINION_MARGIN));
                    if safe && best.is_none_or(|(area, _)| cells > area) {
                        let plan = Plan {
                            out,
                            side,
                            start,
                            depth,
                            width,
                        };
                        best = Some((cells, plan));
                    }
                }
            }
        }
    }
    best.map(|(_, plan)| plan)
}

/// An inclusive rectangle of cells.
#[derive(Clone, Copy)]
struct Area {
    x0: i16,
    y0: i16,
    x1: i16,
    y1: i16,
}

impl Area {
    fn cell(pos: Pos) -> Self {
        let (x, y) = (i16::from(pos.x), i16::from(pos.y));
        Self {
            x0: x,
            y0: y,
            x1: x,
            y1: y,
        }
    }

    fn of_boss(boss: &Boss) -> Self {
        let size = i16::from(boss.size) - 1;
        let corner = Self::cell(boss.pos);
        Self {
            x1: corner.x0 + size,
            y1: corner.y0 + size,
            ..corner
        }
    }

    /// The cells `start` + i × `out` + j × `side`, for i in 1..=`depth` (0 when `depth` is 0)
    /// and j in 0..=`width`, or `None` if one is outside the grid.
    fn spanned(start: Pos, out: Dir, side: Dir, depth: u8, width: u8) -> Option<Self> {
        let (ox, oy) = out.offset();
        let (sx, sy) = side.offset();
        let near = i16::from(depth.min(1));
        let (x, y) = (i16::from(start.x), i16::from(start.y));
        let (ax, ay) = (x + i16::from(ox) * near, y + i16::from(oy) * near);
        let (bx, by) = (
            x + i16::from(ox) * i16::from(depth) + i16::from(sx) * i16::from(width),
            y + i16::from(oy) * i16::from(depth) + i16::from(sy) * i16::from(width),
        );
        let inside = |v: i16| (0..60).contains(&v);
        [ax, ay, bx, by].into_iter().all(inside).then_some(Self {
            x0: ax.min(bx),
            y0: ay.min(by),
            x1: ax.max(bx),
            y1: ay.max(by),
        })
    }

    fn cells(self) -> i16 {
        (self.x1 - self.x0 + 1) * (self.y1 - self.y0 + 1)
    }

    /// The Chebyshev distance between the nearest cells of the two areas: 0 when they overlap,
    /// 1 when they touch.
    fn gap(self, other: Self) -> i16 {
        let axis = |a0: i16, a1: i16, b0: i16, b1: i16| (b0 - a1).max(a0 - b1).max(0);
        axis(self.x0, self.x1, other.x0, other.x1).max(axis(self.y0, self.y1, other.y0, other.y1))
    }
}

/// Counts of `EMPTY` cells over any rectangle, from prefix sums.
struct OpenCells {
    sums: Vec<i16>,
}

impl OpenCells {
    const SIDE: usize = 61;

    fn new(grid: &Grid) -> Self {
        let mut sums = vec![0; Self::SIDE * Self::SIDE];
        for cell in CellIndex::all() {
            let Pos { x, y } = cell.pos();
            let (x, y) = (usize::from(x) + 1, usize::from(y) + 1);
            let open = i16::from(grid.get(cell) == Cell::Empty);
            sums[y * Self::SIDE + x] =
                open + sums[(y - 1) * Self::SIDE + x] + sums[y * Self::SIDE + x - 1]
                    - sums[(y - 1) * Self::SIDE + x - 1];
        }
        Self { sums }
    }

    fn count(&self, area: Area) -> i16 {
        let at = |x: i16, y: i16| self.sums[y as usize * Self::SIDE + x as usize];
        let (x0, y0, x1, y1) = (area.x0, area.y0, area.x1 + 1, area.y1 + 1);
        at(x1, y1) - at(x0, y1) - at(x1, y0) + at(x0, y0)
    }
}
