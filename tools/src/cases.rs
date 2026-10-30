//! The random cases of differential fuzzing (plan M1.10): a valid level with B from 2 to 8, and a
//! journal of random play recorded through the Recorder. `jiro-tools difffuzz` writes them with
//! the native outcome for every target's differential test, and jiro-core's property tests draw
//! the same cases.

use jiro_core::Error;
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

/// The most levels one case draws. About one draw in four breaks a validity rule of README §5,
/// and no case of seed 1 among its first 100,000 needs more than 8 draws.
const MAX_DRAWS: u32 = 100;

/// The level bytes, the journal with its header, and the level's weight of one case.
pub struct Case {
    pub level: [u8; LEVEL_LEN],
    pub header: Header,
    pub journal: Vec<u8>,
    pub weight_bp: u16,
}

/// Case `index` of the set drawn from `seed`. Its run nonce is keccak256("jiro.difffuzz." ‖ seed
/// u64 BE ‖ index u32 BE), and the nonce's first 8 bytes seed the rest of the draw. An error is
/// a core bug that the case reproduces: a level valid by construction refused, or a recorded
/// tick that fails.
pub fn case(seed: u64, index: u32) -> Result<Case, String> {
    let failed = |what: &str, error: Error| format!("case {seed}/{index}: {what} gives {error:?}");
    let run_nonce = keccak256(&[b"jiro.difffuzz.", &seed.to_be_bytes(), &index.to_be_bytes()]);
    let mut rng = Rng::new(u64::from_be_bytes(
        run_nonce[..8].try_into().expect("8 bytes"),
    ));
    let level = (0..MAX_DRAWS)
        .find_map(|_| random_level(&mut rng).transpose())
        .ok_or_else(|| format!("case {seed}/{index}: no valid level in {MAX_DRAWS} draws"))?
        .map_err(|error| failed("a level valid by construction", error))?;
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
    let mut recorder =
        Recorder::new(&level, &header).map_err(|error| failed("a valid level", error))?;
    let mut policy = random_play(rng.next_u64(), u64::from(rng.range(1, 30)), 500, true);
    while recorder
        .step(policy(recorder.game()))
        .map_err(|error| {
            let tick = recorder.game().ticks_used.saturating_sub(1);
            failed(&format!("tick {tick}"), error)
        })?
        .is_none()
    {}
    Ok(Case {
        level: bytes,
        header,
        journal: recorder.journal().to_vec(),
        weight_bp: rng.next_u64() as u16,
    })
}

/// Sets the obstacle bit of each (x, y) cell.
pub fn with_obstacles(mut level: Level, cells: impl IntoIterator<Item = (u8, u8)>) -> Level {
    for (x, y) in cells {
        let cell = usize::from(y) * 60 + usize::from(x);
        level.obstacles[cell / 8] |= 0x80 >> (cell % 8);
    }
    level
}

/// A random level, or `None` when the draw breaks a validity rule of README §5 that the draw does
/// not exclude (codes 35, 36, 37 and 39): up to 7 obstacle blocks, a spawn area for a B × B body
/// with B from 2 to 8, and up to 3 minions on rail cells. The ranges hold by construction, so any
/// other error is a core bug.
fn random_level(rng: &mut Rng) -> Result<Option<Level>, Error> {
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
    let start = match validate(&level, &mut stack) {
        Ok(start) => start,
        Err(
            Error::OpenAreaSplit | Error::OpenAreaSmall | Error::BossSpawn | Error::PlayerStartRail,
        ) => return Ok(None),
        Err(error) => return Err(error),
    };
    let count = rng.range(0, MINION_SLOTS as u8);
    if count > 0 {
        for slot in &mut level.minion_spawns[..usize::from(count)] {
            *slot = rail_cell(rng, &start.grid);
        }
        level.minion_count = count;
        level.minion_period = rng.range(1, 8);
        level.respawn_delay = u16::try_from(1 + rng.below(600)).expect("at most 600 ticks");
    }
    let level = decode(&encode(&level))?;
    validate(&level, &mut stack)?;
    Ok(Some(level))
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
