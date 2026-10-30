//! The random cases of differential fuzzing (plan M1.10): a valid level with B from 2 to 8, and a
//! journal of random play recorded through the Recorder. `jiro-tools difffuzz` writes them with
//! the native outcome for every target's differential test, and jiro-core's property tests draw
//! the same cases.

use jiro_core::consts::{
    BP, CAPTURE_STACK, LEVEL_LEN, MAX_BOSS_SIZE, MAX_TICKS, MIN_BOSS_SIZE, MINION_SLOTS,
    OBSTACLE_BYTES, RUN_LEVELS, W,
};
use jiro_core::grid::Grid;
use jiro_core::journal::{Header, Mode};
use jiro_core::keccak::keccak256;
use jiro_core::level::{Level, Rect, decode, encode, level_id, validate};
use jiro_core::recorder::Recorder;
use jiro_core::types::Pos;

use crate::random::{Rng, random_play};

#[cfg(test)]
mod tests;

/// The level bytes, the journal and the level's weight of one case.
pub struct Case {
    pub level: [u8; LEVEL_LEN],
    pub journal: Vec<u8>,
    pub weight_bp: u16,
}

/// Case `index` of the set drawn from `seed`. Its run nonce is keccak256("jiro.difffuzz." ‖ seed
/// u64 BE ‖ index u32 BE), and the nonce's first 8 bytes seed the rest of the draw.
pub fn case(seed: u64, index: u32) -> Case {
    let run_nonce = keccak256(&[b"jiro.difffuzz.", &seed.to_be_bytes(), &index.to_be_bytes()]);
    let mut rng = Rng::new(u64::from_be_bytes(
        run_nonce[..8].try_into().expect("8 bytes"),
    ));
    let level = (0..)
        .find_map(|_| random_level(&mut rng))
        .expect("a valid level");
    let bytes = encode(&level);
    let header = Header {
        mode: if rng.one_in(2) {
            Mode::Training
        } else {
            Mode::Challenge
        },
        run_nonce,
        level_id: level_id(&bytes),
        level_index: rng.range(0, RUN_LEVELS as u8 - 1),
    };
    let mut recorder = Recorder::new(&level, &header).expect("a valid level");
    let mut policy = random_play(rng.next_u64(), u64::from(rng.range(1, 30)), 500, true);
    while recorder
        .step(policy(recorder.game()))
        .expect("stepping a valid level")
        .is_none()
    {}
    Case {
        level: bytes,
        journal: recorder.journal().to_vec(),
        weight_bp: rng.next_u64() as u16,
    }
}

/// Sets the obstacle bit of each (x, y) cell.
pub fn with_obstacles(mut level: Level, cells: impl IntoIterator<Item = (u8, u8)>) -> Level {
    for (x, y) in cells {
        let cell = usize::from(y) * 60 + usize::from(x);
        level.obstacles[cell / 8] |= 0x80 >> (cell % 8);
    }
    level
}

/// A random level, or `None` when the draw breaks the ranges or the validity of README §5: up to
/// 7 obstacle blocks, a spawn area for a body of 2 to 8 cells, and up to 3 minions on rail cells.
fn random_level(rng: &mut Rng) -> Option<Level> {
    let mut blocks = Vec::new();
    for _ in 0..rng.below(8) {
        let (width, height) = (rng.range(1, 12), rng.range(1, 12));
        let (x0, y0) = (rng.range(1, W - 1 - width), rng.range(1, W - 1 - height));
        for y in y0..y0 + height {
            blocks.extend((x0..x0 + width).map(|x| (x, y)));
        }
    }
    let boss_size = rng.range(MIN_BOSS_SIZE, MAX_BOSS_SIZE);
    let last = W - 1 - boss_size;
    let (x0, y0) = (rng.range(1, last), rng.range(1, last));
    let spawn = Rect {
        x0,
        y0,
        x1: rng.range(x0, last.min(x0 + 10)),
        y1: rng.range(y0, last.min(y0 + 10)),
    };
    let time_limit = if rng.one_in(8) {
        1 + rng.below(100)
    } else {
        1 + rng.below(u64::from(MAX_TICKS))
    };
    let level = Level {
        obstacles: [0; OBSTACLE_BYTES],
        boss_size,
        spawn,
        boss_period: rng.range(1, 8),
        minion_count: 0,
        minion_spawns: [Pos { x: 0, y: 0 }; MINION_SLOTS],
        minion_period: 0,
        respawn_delay: 0,
        time_limit: u16::try_from(time_limit).expect("at most 2,700 ticks"),
        lives: rng.range(1, 5),
        target_bp: u16::try_from(1 + rng.below(u64::from(BP))).expect("at most 10,000 bp"),
    };
    let mut level = with_obstacles(level, blocks);
    let mut stack = [0; CAPTURE_STACK];
    let start = validate(&level, &mut stack).ok()?;
    let count = rng.range(0, MINION_SLOTS as u8);
    if count > 0 {
        for slot in &mut level.minion_spawns[..usize::from(count)] {
            *slot = rail_cell(rng, &start.grid);
        }
        level.minion_count = count;
        level.minion_period = rng.range(1, 8);
        level.respawn_delay = u16::try_from(1 + rng.below(600)).expect("at most 600 ticks");
    }
    let level = decode(&encode(&level)).ok()?;
    validate(&level, &mut stack).ok().map(|_| level)
}

/// A random rail cell of `grid`.
fn rail_cell(rng: &mut Rng, grid: &Grid) -> Pos {
    loop {
        let pos = Pos {
            x: rng.range(0, W - 1),
            y: rng.range(0, W - 1),
        };
        if grid.is_rail(pos) {
            return pos;
        }
    }
}
