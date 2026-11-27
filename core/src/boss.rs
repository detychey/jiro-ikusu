//! The boss (README §4.6): a B × B body that moves one axis at a time, testing its whole
//! leading edge, with the seeded deflections of D14. A level has one boss, or two that bounce off
//! each other's bodies.

use crate::grid::Grid;
use crate::level::{BossRecord, Level};
use crate::seed::{FIRST_BOSS_SEED, SECOND_BOSS_SEED, SeedBytes, boss_start, deflection_key};
use crate::types::{Cell, Pos};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Boss {
    /// The top-left cell of the body [R4.6-1].
    pub pos: Pos,
    pub size: u8,
    /// +1 or −1.
    pub vx: i8,
    /// +1 or −1.
    pub vy: i8,
    pub period: u8,
    /// A level constant from the level seed, not boss state (R4.6-11).
    pub deflection_key: u32,
}

#[derive(Clone, Copy)]
enum Axis {
    X,
    Y,
}

/// Every boss of a level: boss 0, and boss 1 on a level with two.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Bosses {
    pub first: Boss,
    pub second: Option<Boss>,
}

impl Bosses {
    /// The bosses at level start, each from its own seed bytes (R4.6-5, R4.6-7). `None` if a
    /// spawn rectangle is empty, which level validity rules out.
    pub fn start(level: &Level, seed: &[u8; 32]) -> Option<Self> {
        let second = match level.second_boss {
            Some(record) => Some(Boss::start(&record, seed, &SECOND_BOSS_SEED)?),
            None => None,
        };
        Some(Self {
            first: Boss::start(&level.first_boss(), seed, &FIRST_BOSS_SEED)?,
            second,
        })
    }

    /// Boss 0, then boss 1.
    pub fn iter(&self) -> impl Iterator<Item = &Boss> {
        core::iter::once(&self.first).chain(&self.second)
    }

    /// Whether a boss's body covers `pos`.
    pub fn covers(&self, pos: Pos) -> bool {
        self.iter().any(|boss| boss.covers(pos))
    }

    /// Step 4 of the tick (R4.4-9, R4.6-13, R4.6-14): boss 0 moves, with boss 1's body as a wall,
    /// then boss 1, with boss 0's new body as a wall. Returns whether a leading edge held `TRAIL`,
    /// which hits the player.
    pub fn step(&mut self, grid: &Grid, tick: u16) -> bool {
        let first_hit = self.first.step(grid, tick, self.second.as_ref());
        let second_hit = self
            .second
            .as_mut()
            .is_some_and(|second| second.step(grid, tick, Some(&self.first)));
        first_hit || second_hit
    }
}

impl Boss {
    /// A boss at level start: its start and direction from its seed bytes of the level seed
    /// (R4.6-5), and its deflection key (R4.6-7). `None` if the spawn rectangle is empty, which
    /// level validity rules out.
    fn start(record: &BossRecord, seed: &[u8; 32], bytes: &SeedBytes) -> Option<Self> {
        let start = boss_start(&record.spawn, seed, bytes)?;
        Some(Self {
            pos: start.pos,
            size: record.size,
            vx: start.vx,
            vy: start.vy,
            period: record.period,
            deflection_key: deflection_key(seed, bytes),
        })
    }

    /// Whether the body covers `pos`.
    pub fn covers(&self, pos: Pos) -> bool {
        let inside = |at: u8, from: u8| {
            at.checked_sub(from)
                .is_some_and(|offset| offset < self.size)
        };
        inside(pos.x, self.pos.x) && inside(pos.y, self.pos.y)
    }

    /// The cells under the body, row by row.
    pub fn body(&self) -> impl Iterator<Item = Pos> {
        let Self { pos, size, .. } = *self;
        (0..size).flat_map(move |dy| {
            (0..size).filter_map(move |dx| {
                Some(Pos {
                    x: pos.x.checked_add(dx)?,
                    y: pos.y.checked_add(dy)?,
                })
            })
        })
    }

    /// On a tick the boss moves, the deflection draw of R4.6-7, then the edge tests of R4.6-3, x
    /// first, with the `other` boss's body as a wall (R4.6-14). Returns whether a leading edge
    /// held `TRAIL`, which hits the player.
    pub fn step(&mut self, grid: &Grid, tick: u16, other: Option<&Boss>) -> bool {
        if tick.checked_rem(u16::from(self.period)) != Some(0) {
            return false;
        }
        match deflection_draw(self.deflection_key, tick) {
            0 => self.vx = self.vx.wrapping_neg(),
            1 => self.vy = self.vy.wrapping_neg(),
            _ => {}
        }
        let hit_x = self.move_axis(grid, other, Axis::X);
        let hit_y = self.move_axis(grid, other, Axis::Y);
        hit_x || hit_y
    }

    /// Tests the B cells the body would enter on `axis`: if any is `CLAIMED` or `TRAIL`, or under
    /// the `other` boss's body, the velocity component inverts, and otherwise the body moves one
    /// cell. A cell outside the grid blocks like the border, though the border keeps the body
    /// from ever reaching it.
    fn move_axis(&mut self, grid: &Grid, other: Option<&Boss>, axis: Axis) -> bool {
        let (along, across, velocity) = match axis {
            Axis::X => (self.pos.x, self.pos.y, self.vx),
            Axis::Y => (self.pos.y, self.pos.x, self.vy),
        };
        let edge = if velocity > 0 {
            along.checked_add(self.size)
        } else {
            along.checked_sub(1)
        };
        let (mut blocked, mut trail) = (false, false);
        for offset in 0..self.size {
            let pos = edge
                .zip(across.checked_add(offset))
                .map(|(edge, across)| match axis {
                    Axis::X => Pos { x: edge, y: across },
                    Axis::Y => Pos { x: across, y: edge },
                });
            if pos.is_some_and(|pos| other.is_some_and(|other| other.covers(pos))) {
                blocked = true;
            }
            match pos.and_then(|pos| grid.at(pos)) {
                Some(Cell::Trail) => (blocked, trail) = (true, true),
                Some(Cell::Claimed) | None => blocked = true,
                Some(Cell::Empty | Cell::BossZone) => {}
            }
        }
        match (blocked, along.checked_add_signed(velocity), axis) {
            (false, Some(next), Axis::X) => self.pos.x = next,
            (false, Some(next), Axis::Y) => self.pos.y = next,
            (_, _, Axis::X) => self.vx = self.vx.wrapping_neg(),
            (_, _, Axis::Y) => self.vy = self.vy.wrapping_neg(),
        }
        trail
    }
}

/// r = fmix32(key XOR tick) >> 26, from 0 to 63: 0 inverts vx and 1 inverts vy (R4.6-7).
pub fn deflection_draw(key: u32, tick: u16) -> u32 {
    fmix32(key ^ u32::from(tick)) >> 26
}

/// The 32-bit finalizer of MurmurHash3, with wrapping multiplications (R4.6-9).
pub fn fmix32(mut h: u32) -> u32 {
    h ^= h >> 16;
    h = h.wrapping_mul(0x85eb_ca6b);
    h ^= h >> 13;
    h = h.wrapping_mul(0xc2b2_ae35);
    h ^ (h >> 16)
}
