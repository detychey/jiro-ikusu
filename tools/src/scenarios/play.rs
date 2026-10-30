//! Playing a level through the Recorder, the single input path, to produce the journals of the
//! game vectors: scripted mask schedules, reactive policies that read the game, a bot that cuts
//! small captures, and random play.

use jiro_core::game::Game;
use jiro_core::journal::{Header, Mode};
use jiro_core::keccak::keccak256;
use jiro_core::level::{Level, encode, level_id};
use jiro_core::recorder::Recorder;
use jiro_core::types::{Cell, Dir, InputMask, Pos};

/// A recorded run: the journal, and the game before tick 0 and after every processed tick.
pub struct Run {
    pub journal: Vec<u8>,
    pub states: Vec<Game>,
}

impl Run {
    /// Each processed tick as (the game before it, the mask it ran with, the game after it).
    pub fn ticks(&self) -> impl Iterator<Item = (&Game, InputMask, &Game)> {
        self.states
            .windows(2)
            .map(|pair| (&pair[0], pair[1].mask, &pair[1]))
    }

    pub fn last(&self) -> &Game {
        self.states
            .last()
            .expect("a run holds the game before tick 0")
    }

    /// The number of journal events.
    pub fn events(&self) -> usize {
        (self.journal.len() - jiro_core::consts::HEADER_LEN) / jiro_core::consts::EVENT_LEN
    }

    /// The ticks on which a capture happened.
    pub fn captures(&self) -> usize {
        self.ticks()
            .filter(|(before, _, after)| after.captured > before.captured)
            .count()
    }
}

/// The training header of `level` at levelIndex 0 with `run_nonce`.
pub fn header(level: &Level, run_nonce: [u8; 32]) -> Header {
    Header {
        mode: Mode::Training,
        run_nonce,
        level_id: level_id(&encode(level)),
        level_index: 0,
    }
}

/// The run nonce `k` of the vector `name`: keccak256("jiro.vector." ‖ name ‖ k).
pub fn nonce(name: &str, k: u32) -> [u8; 32] {
    keccak256(&[b"jiro.vector.", name.as_bytes(), &k.to_be_bytes()])
}

/// Plays `level` from tick 0 until it ends, through the Recorder, asking `policy` for each tick's
/// raw mask with the game as the previous tick left it. `observe` sees the game before tick 0 and
/// after every processed tick.
pub fn play(
    level: &Level,
    header: &Header,
    mut policy: impl FnMut(&Game) -> InputMask,
    mut observe: impl FnMut(&Game),
) -> Result<Recorder, String> {
    let mut recorder = Recorder::new(level, header).map_err(|error| format!("{error:?}"))?;
    observe(recorder.game());
    loop {
        let raw = policy(recorder.game());
        let end = recorder
            .step(raw)
            .map_err(|error| format!("recorder: {error:?}"))?;
        observe(recorder.game());
        if end.is_some() {
            return Ok(recorder);
        }
    }
}

/// Plays `level` like `play`, and keeps every state.
pub fn record(
    level: &Level,
    header: &Header,
    policy: impl FnMut(&Game) -> InputMask,
) -> Result<Run, String> {
    let mut states = Vec::new();
    let recorder = play(level, header, policy, |game| states.push(game.clone()))?;
    Ok(Run {
        journal: recorder.journal().to_vec(),
        states,
    })
}

/// The first run, over the nonces of `name`, that `wanted` accepts.
pub fn first_run(
    name: &str,
    level: &Level,
    mut policy: impl FnMut() -> Box<dyn FnMut(&Game) -> InputMask>,
    wanted: impl Fn(&Run) -> bool,
) -> Result<(Header, Run), String> {
    for k in 0..200 {
        let header = header(level, nonce(name, k));
        let run = record(level, &header, policy())?;
        if wanted(&run) {
            return Ok((header, run));
        }
    }
    Err(format!("{name}: no run nonce among 200 gives the scenario"))
}

pub fn mask(parts: &[InputMask]) -> InputMask {
    InputMask::new(parts.iter().fold(0, |bits, part| bits | part.bits()))
        .expect("scenario masks leave bit 7 clear")
}

/// Holds each mask of `steps` for its number of ticks, then `then` for the rest of the level.
pub fn script(steps: &[(InputMask, u16)], then: InputMask) -> impl FnMut(&Game) -> InputMask {
    let mut schedule: Vec<InputMask> = steps
        .iter()
        .flat_map(|&(mask, ticks)| std::iter::repeat_n(mask, usize::from(ticks)))
        .collect();
    schedule.reverse();
    move |_| schedule.pop().unwrap_or(then)
}

/// Changes the mask on every tick: when `policy` repeats the mask in force, A is toggled.
pub fn every_tick(mut policy: impl FnMut(&Game) -> InputMask) -> impl FnMut(&Game) -> InputMask {
    move |game| {
        let wanted = policy(game);
        if wanted != game.mask {
            return wanted;
        }
        let toggled = InputMask::new(wanted.bits() ^ InputMask::A.bits()).expect("bit 7 clear");
        if toggled == InputMask::NONE {
            InputMask::B
        } else {
            toggled
        }
    }
}

pub fn at(x: u8, y: u8) -> Pos {
    Pos { x, y }
}

pub fn neighbor(pos: Pos, dir: Dir) -> Option<Pos> {
    let (dx, dy) = dir.offset();
    pos.offset(dx, dy)
}

pub fn reverse(dir: Dir) -> Dir {
    dir.clockwise().clockwise()
}

pub fn in_boss(game: &Game, pos: Pos) -> bool {
    game.boss.body().any(|cell| cell == pos)
}

/// A xorshift64 generator for scripted randomness.
pub struct Rng(u64);

impl Rng {
    pub fn new(seed: u64) -> Self {
        Self(seed.wrapping_mul(0x9e37_79b9_7f4a_7c15) | 1)
    }

    pub fn next(&mut self) -> u64 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 7;
        self.0 ^= self.0 << 17;
        self.0
    }

    /// A number in `low..=high`.
    pub fn range(&mut self, low: u8, high: u8) -> u8 {
        low + (self.next() % u64::from(high - low + 1)) as u8
    }

    /// True with probability 1 / `odds`.
    pub fn one_in(&mut self, odds: u64) -> bool {
        self.next().is_multiple_of(odds)
    }

    pub fn shuffled(&mut self, mut dirs: [Dir; 4]) -> [Dir; 4] {
        for i in (1..4).rev() {
            dirs.swap(i, (self.next() % (i as u64 + 1)) as usize);
        }
        dirs
    }
}

/// A bot that cuts small U shapes off the rail: out from the rail, sideways, then back until the
/// cut closes. Off a cut it walks along the rail to the next cell with open field beside it.
pub struct CaptureBot {
    rng: Rng,
    plan: Option<Plan>,
    walk: Dir,
    max_leg: u8,
}

/// A U-shaped cut from the rail cell `start`: `depth` cells `out`, `width` cells to the `side`,
/// then back until the cut closes.
#[derive(Clone, Copy)]
pub struct Plan {
    pub out: Dir,
    pub side: Dir,
    pub start: Pos,
    pub depth: u8,
    pub width: u8,
}

impl CaptureBot {
    pub fn new(seed: u64, max_leg: u8) -> Self {
        Self {
            rng: Rng::new(seed),
            plan: None,
            walk: Dir::Left,
            max_leg,
        }
    }

    pub fn direction(&mut self, game: &Game) -> Dir {
        let player = game.player;
        if !player.cutting {
            self.plan = None;
            let order = self.rng.shuffled(Dir::PRIORITY);
            let open = order.into_iter().find(|&dir| {
                neighbor(player.pos, dir).is_some_and(|cell| {
                    game.grid.at(cell) == Some(Cell::Empty) && !in_boss(game, cell)
                })
            });
            if let Some(out) = open {
                let side = if self.rng.one_in(2) {
                    out.clockwise()
                } else {
                    reverse(out.clockwise())
                };
                self.plan = Some(Plan {
                    out,
                    side,
                    start: player.pos,
                    depth: self.rng.range(1, self.max_leg),
                    width: self.rng.range(1, self.max_leg),
                });
                return out;
            }
            return walk_rail(&mut self.walk, &mut self.rng, game, order);
        }
        let plan = *self.plan.get_or_insert(Plan {
            out: Dir::Up,
            side: Dir::Left,
            start: player.cut_start,
            depth: 0,
            width: 0,
        });
        let travelled = |dir: Dir| distance(plan.start, player.pos, dir);
        let phases = if travelled(plan.out) < i16::from(plan.depth) {
            [plan.out, plan.side, reverse(plan.out)]
        } else if travelled(plan.side) < i16::from(plan.width) {
            [plan.side, reverse(plan.out), plan.out]
        } else {
            [reverse(plan.out), plan.side, reverse(plan.side)]
        };
        phases
            .into_iter()
            .find(|&dir| {
                neighbor(player.pos, dir).is_some_and(|cell| {
                    game.grid.at(cell) != Some(Cell::Trail) && !in_boss(game, cell)
                })
            })
            .unwrap_or(reverse(plan.out))
    }
}

/// The direction along the rail: `walk` while it stays walkable, except for a turn one time in
/// 40, otherwise the first walkable direction of `order` that does not turn back.
pub fn walk_rail(walk: &mut Dir, rng: &mut Rng, game: &Game, order: [Dir; 4]) -> Dir {
    let pos = game.player.pos;
    let walkable = |dir: Dir| {
        neighbor(pos, dir).is_some_and(|cell| {
            game.grid.at(cell) == Some(Cell::Claimed)
                && (game.grid.is_rail(cell) || !game.grid.is_rail(pos))
        })
    };
    if !walkable(*walk) || rng.one_in(40) {
        *walk = order
            .into_iter()
            .find(|&dir| walkable(dir) && dir != reverse(*walk))
            .or_else(|| order.into_iter().find(|&dir| walkable(dir)))
            .unwrap_or(*walk);
    }
    *walk
}

/// How far `to` lies from `from` in the direction `dir`.
pub fn distance(from: Pos, to: Pos, dir: Dir) -> i16 {
    let (dx, dy) = dir.offset();
    (i16::from(to.x) - i16::from(from.x)) * i16::from(dx)
        + (i16::from(to.y) - i16::from(from.y)) * i16::from(dy)
}

/// Random masks: a new mask on about one tick in `hold`, with each direction bit set at
/// random, A and B (with `all_bits`) set one time in three, and X one time in `commit_odds`.
pub fn random_play(
    seed: u64,
    hold: u64,
    commit_odds: u64,
    all_bits: bool,
) -> impl FnMut(&Game) -> InputMask {
    let mut rng = Rng::new(seed);
    move |game| {
        if game.ticks_used > 0 && !rng.one_in(hold) {
            return game.mask;
        }
        let mut bits = (rng.next() & 0x0f) as u8;
        if all_bits {
            if rng.one_in(3) {
                bits |= InputMask::A.bits();
            }
            if rng.one_in(3) {
                bits |= InputMask::B.bits();
            }
        }
        if rng.one_in(commit_odds) {
            bits |= InputMask::X.bits();
        }
        InputMask::new(bits).expect("bit 7 clear")
    }
}
