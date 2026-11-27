//! State hash v3 (README §6.4): keccak256 of a fixed-order, fixed-width serialization of the
//! whole state, for traces and diagnosis. Stepping never computes it.

use crate::boss::Boss;
use crate::game::Game;
use crate::keccak::keccak256;
use crate::minion::{Minion, State};
use crate::types::{CellIndex, Dir};

pub const STATE_HASH_VERSION: u8 = 3;
pub const PREIMAGE_LEN: usize = 955;

/// The state-hash preimage after the tick just processed, field by field in the order of the
/// README §6.4 table.
pub fn preimage(game: &Game) -> [u8; PREIMAGE_LEN] {
    let Game {
        player,
        bosses,
        minions,
        ..
    } = game;
    let [tick_high, tick_low] = game.ticks_used.saturating_sub(1).to_be_bytes();
    let [captured_high, captured_low] = game.captured.to_be_bytes();
    let [work_0, work_1, work_2, work_3] = game.work.to_be_bytes();
    let [claimable_high, claimable_low] = game.claimable.get().to_be_bytes();
    let [event_high, event_low] = game.events_applied.to_be_bytes();
    let head = [STATE_HASH_VERSION, tick_high, tick_low, game.mask.bits()];
    let player_fields = [
        player.pos.x,
        player.pos.y,
        u8::from(player.cutting),
        player.cut_start.x,
        player.cut_start.y,
        player.lives,
        player.invulnerable,
        player.direction.map_or(0, direction_code),
    ];
    let boss_fields = boss_bytes(Some(bosses.first))
        .into_iter()
        .chain(boss_bytes(bosses.second));
    let minion_slots = minions
        .slots
        .iter()
        .flat_map(|slot| minion_bytes(*slot, minions.period));
    let counters = [
        captured_high,
        captured_low,
        work_0,
        work_1,
        work_2,
        work_3,
        claimable_high,
        claimable_low,
        event_high,
        event_low,
    ];
    let bytes = head
        .into_iter()
        .chain(grid_bytes(game))
        .chain(player_fields)
        .chain(boss_fields)
        .chain(minion_slots)
        .chain(counters);
    let mut out = [0; PREIMAGE_LEN];
    for (slot, byte) in out.iter_mut().zip(bytes) {
        *slot = byte;
    }
    out
}

/// keccak256 of the preimage.
pub fn state_hash(game: &Game) -> [u8; 32] {
    keccak256(&[&preimage(game)])
}

/// 2 bits per cell, row-major: cell i in byte i / 4, its value's high bit at bit 7 − 2 × (i % 4).
fn grid_bytes(game: &Game) -> impl Iterator<Item = u8> + '_ {
    let mut cells = CellIndex::all().map(|cell| game.grid.get(cell) as u8);
    core::iter::from_fn(move || {
        let [a, b, c, d] = [cells.next()?, cells.next()?, cells.next()?, cells.next()?];
        Some(a << 6 | b << 4 | c << 2 | d)
    })
}

/// x, y, body size B, vx, vy (i8, two's complement) and move period; all zero for no boss.
fn boss_bytes(boss: Option<Boss>) -> [u8; 6] {
    boss.map_or([0; 6], |boss| {
        [
            boss.pos.x,
            boss.pos.y,
            boss.size,
            boss.vx.to_be_bytes()[0],
            boss.vy.to_be_bytes()[0],
            boss.period,
        ]
    })
}

/// Presence (0 unused, 1 live, 2 destroyed), x, y, heading, move period, and the u16 respawn
/// countdown. A destroyed minion's cell and heading are 0, a live one's countdown is 0, and an
/// unused slot is all zero (R4.3-5).
fn minion_bytes(slot: Option<Minion>, period: u8) -> [u8; 7] {
    match slot.map(|minion| minion.state) {
        None => [0; 7],
        Some(State::Live { pos, heading }) => {
            [1, pos.x, pos.y, heading_code(heading), period, 0, 0]
        }
        Some(State::Destroyed { countdown }) => {
            let [high, low] = countdown.to_be_bytes();
            [2, 0, 0, 0, period, high, low]
        }
    }
}

/// 1 up, 2 down, 3 left, 4 right; 0 is no direction.
fn direction_code(direction: Dir) -> u8 {
    match direction {
        Dir::Up => 1,
        Dir::Down => 2,
        Dir::Left => 3,
        Dir::Right => 4,
    }
}

/// 0 N, 1 E, 2 S, 3 W, as the state hash and the targets encode a minion's heading.
pub fn heading_code(heading: Dir) -> u8 {
    match heading {
        Dir::Up => 0,
        Dir::Right => 1,
        Dir::Down => 2,
        Dir::Left => 3,
    }
}
