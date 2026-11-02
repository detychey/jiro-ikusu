//! Search (plan M4.13): a nonce-aware lookahead bot. The game a bot reads holds the boss's state
//! and the deflection key of the level seed (README §6.4), so the core, stepped on a copy, shows
//! exactly what any masks will do, and a plan plays exactly as simulated.
//!
//! A decision first pads half the ticks the level can spare beyond `RESERVE_TICKS`, dodging the
//! minions: README §7.2's deadline follows the ticks used, so padding costs only the fewer-ticks
//! tiebreak, and the units it accrues pay for the search. The search then looks two captures
//! deep, a setup and a finisher, for the clear that leaves the boss the smallest region: the
//! level score is the claim of the capture that clears the level.
//!
//! Compute is counted in work units, never measured, so the bot plays the same on every machine.
//! Each operation is charged before it runs and refused when the units left cannot cover it.
//! Units accrue at `units_per_tick` per tick played, and a search spends only those accrued since
//! the state it searches from became known: the pad before it is planned whole, from the end of
//! the previous plan, and a search forfeits the units it leaves.

use std::cmp::Reverse;

use jiro_core::consts::CELLS;
use jiro_core::game::{EndReason, Game};
use jiro_core::hash::state_hash;
use jiro_core::types::{Cell, CellIndex, Dir, InputMask};

use super::greedy::LEGS;
use crate::scenarios::play::{distance, in_boss, mask, neighbor, reverse};

#[cfg(test)]
mod tests;

/// Work units per tick played: at most 0.75 s of compute per game second on one container core,
/// since a unit costs at most `WORST_NS_PER_UNIT` there.
pub const UNITS_PER_TICK: u64 = COMPUTE_NS_PER_TICK / WORST_NS_PER_UNIT;

/// 0.75 s of compute per game second, in ns per tick at 15 ticks a second.
const COMPUTE_NS_PER_TICK: u64 = 50_000_000;

/// The cost of a unit on the worst of the 16 levels, one thread on an idle container core,
/// rounded up: measured by the ignored test `no_level_spends_more_than_the_worst_ns_per_unit`
/// (plan M4.13: 55.2 ns on L15 swarm, rustc 1.98.0, load average under 1.4).
pub const WORST_NS_PER_UNIT: u64 = 56;

const STEP_UNITS: u64 = 1;
/// A copy of the game, 10,388 bytes.
const CLONE_UNITS: u64 = 4;
/// Added to a step that captured: the flood fill and the pass over the 3,600 cells.
const CAPTURE_UNITS: u64 = 280;
/// Added to a step that lost a life, which erases the trail over the whole grid.
const LOSS_UNITS: u64 = 20;
const MAX_STEP_UNITS: u64 = STEP_UNITS + CAPTURE_UNITS + LOSS_UNITS;

/// The ticks a decision leaves unpadded at the end of the level, to play its captures in.
pub const RESERVE_TICKS: u16 = 300;
/// A pad is planned in chunks of at most this many ticks, each from where the last one ends.
const PAD_CHUNK: u16 = 64;
/// How far along the rail a pad chunk walks, at most, to get out of a minion's way.
const PAD_RADIUS: u16 = 20;
/// How far along the rail a search walks, at most, before it starts a cut.
const WALK_RADIUS: u16 = 60;
/// The ticks a search waits, at each cell it walks to, before it starts a cut.
const WAITS: [u16; 6] = [0, 3, 7, 12, 20, 32];
/// The setups a search keeps to look for finishers from, best first.
const SETUPS: usize = 128;
/// The share of a search's units that the setups get: a quarter.
const SETUP_SHARE: u64 = 4;

pub struct Search {
    units_per_tick: u64,
    /// The units accrued, and neither spent nor forfeited.
    bank: u64,
    accrued: u64,
    spent: u64,
    /// The masks left to play, last first.
    plan: Vec<InputMask>,
    /// The state hash the plan ends on, when it was simulated.
    expected: Option<[u8; 32]>,
    /// Whether the plan is a pad, so that the next decision searches.
    padding: bool,
}

impl Search {
    pub fn new(units_per_tick: u64) -> Self {
        Self {
            units_per_tick,
            bank: 0,
            accrued: 0,
            spent: 0,
            plan: Vec::new(),
            expected: None,
            padding: false,
        }
    }

    /// The mask of the next tick. Its units accrue first: the mask of tick t is computed during
    /// tick t's 1/15 s.
    pub fn mask(&mut self, game: &Game) -> InputMask {
        self.bank += self.units_per_tick;
        self.accrued += self.units_per_tick;
        if self.plan.is_empty() {
            if let Some(expected) = self.expected {
                assert_eq!(
                    state_hash(game),
                    expected,
                    "search: the game diverged from its simulation at tick {}",
                    game.ticks_used
                );
            }
            self.decide(game);
        }
        self.plan.pop().expect("a decision plans at least one tick")
    }

    fn decide(&mut self, game: &Game) {
        let mut budget = Budget { left: self.bank };
        let pad = match self.padding {
            true => None,
            false => pad(&mut budget, game, spare_ticks(game) / 2),
        };
        self.padding = pad.is_some();
        let line = pad.or_else(|| search(&mut budget, game));
        self.spent += self.bank - budget.left;
        // The units a search leaves were accrued before the state the next search starts from
        // was known.
        self.bank = if self.padding { budget.left } else { 0 };
        self.expected = line.as_ref().map(|line| state_hash(&line.game));
        self.plan = match line {
            Some(line) => line.plan.stack(),
            None => vec![fallback(game)],
        };
    }
}

/// The ticks left beyond the reserve.
fn spare_ticks(game: &Game) -> u16 {
    (game.time_limit - game.ticks_used).saturating_sub(RESERVE_TICKS)
}

/// The mask when no line keeps every life: X at the last life, which banks the claim rather
/// than lose the level (D5), and otherwise one tick standing.
fn fallback(game: &Game) -> InputMask {
    match game.player.lives {
        1 => InputMask::X,
        _ => InputMask::NONE,
    }
}

/// Masks, run-length: each with the ticks it is held for.
#[derive(Clone, Debug, Default)]
struct Plan(Vec<(InputMask, u16)>);

impl Plan {
    fn push(&mut self, mask: InputMask) {
        match self.0.last_mut() {
            Some((last, ticks)) if *last == mask => *ticks += 1,
            _ => self.0.push((mask, 1)),
        }
    }

    /// The masks, last first, to pop one a tick.
    fn stack(&self) -> Vec<InputMask> {
        self.0
            .iter()
            .rev()
            .flat_map(|&(mask, ticks)| std::iter::repeat_n(mask, usize::from(ticks)))
            .collect()
    }
}

/// A simulated future: the game after the plan's masks.
struct Line {
    game: Game,
    plan: Plan,
}

/// The units a decision may still spend. `None` from an operation: the units left cannot cover
/// it, and it did not run.
struct Budget {
    left: u64,
}

impl Budget {
    fn charge(&mut self, units: u64) -> Option<()> {
        self.left = self.left.checked_sub(units)?;
        Some(())
    }

    /// A line with no masks yet, on a copy of `game`.
    fn root(&mut self, game: &Game) -> Option<Line> {
        self.charge(CLONE_UNITS)?;
        Some(Line {
            game: game.clone(),
            plan: Plan::default(),
        })
    }

    fn fork(&mut self, line: &Line) -> Option<Line> {
        self.charge(CLONE_UNITS)?;
        Some(Line {
            game: line.game.clone(),
            plan: line.plan.clone(),
        })
    }

    /// Steps `line` one tick with `mask`, and returns whether every life was kept.
    fn advance(&mut self, line: &mut Line, mask: InputMask) -> Option<bool> {
        if self.left < MAX_STEP_UNITS {
            return None;
        }
        let (captured, lives) = (line.game.captured, line.game.player.lives);
        line.game
            .step(mask)
            .expect("the core takes any mask: an error is a broken invariant");
        line.plan.push(mask);
        let kept = line.game.player.lives == lives;
        let capture = if line.game.captured > captured {
            CAPTURE_UNITS
        } else {
            0
        };
        let loss = if kept { 0 } else { LOSS_UNITS };
        self.left -= STEP_UNITS + capture + loss;
        Some(kept)
    }
}

/// How good the end of a line is, best last: a clear before any other end, then the larger
/// claim, which is the level score at the level's fixed weight, then the fewer ticks.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
struct Key {
    cleared: bool,
    claim_bp: u16,
    fewer_ticks: Reverse<u16>,
}

impl Key {
    fn of(game: &Game) -> Self {
        Self {
            cleared: game.end == Some(EndReason::Cleared),
            claim_bp: game.claim_bp().expect("a claim is at most 10,000 bp"),
            fewer_ticks: Reverse(game.ticks_used),
        }
    }
}

/// What a search keeps of the captures it simulates: the best line that clears the level, and
/// the `keep` best that do not, best first. Of equal keys, the line found first ranks first.
struct Found {
    clear: Option<(Key, Line)>,
    setups: Vec<(Key, Line)>,
    keep: usize,
}

impl Found {
    fn new(keep: usize) -> Self {
        Self {
            clear: None,
            setups: Vec::new(),
            keep,
        }
    }

    fn record(&mut self, line: Line) {
        let key = Key::of(&line.game);
        if key.cleared {
            if self.clear.as_ref().is_none_or(|(best, _)| key > *best) {
                self.clear = Some((key, line));
            }
        } else if self.setups.len() < self.keep
            || self.setups.last().is_some_and(|(last, _)| key > *last)
        {
            let at = self.setups.partition_point(|(other, _)| *other >= key);
            self.setups.insert(at, (key, line));
            self.setups.truncate(self.keep);
        }
    }
}

/// The best line from `game`, two captures deep: a quarter of the budget finds the setups, and
/// the rest looks for a finisher from each in rank order, until it runs out. With no clear in
/// sight, the best setup alone. `None` if no capture keeps every life.
fn search(budget: &mut Budget, game: &Game) -> Option<Line> {
    let root = budget.root(game)?;
    let mut found = Found::new(SETUPS);
    let mut setups = Budget {
        left: budget.left / SETUP_SHARE,
    };
    budget.left -= setups.left;
    // A budget that runs out ends the enumeration; what it found stands.
    let _ = enumerate(&mut setups, &root, &mut found);
    budget.left += setups.left;
    let mut best = found.clear.take();
    for (_, setup) in &found.setups {
        if setup.game.end.is_some() {
            continue;
        }
        let mut finishers = Found::new(0);
        let enumerated = enumerate(budget, setup, &mut finishers);
        if let Some(finisher) = finishers.clear
            && best.as_ref().is_none_or(|(key, _)| finisher.0 > *key)
        {
            best = Some(finisher);
        }
        if enumerated.is_none() {
            break;
        }
    }
    best.or_else(|| found.setups.into_iter().next())
        .map(|(_, line)| line)
}

/// Records in `found` every cut that starts from a walk of `root` beside open field, after each
/// wait of `WAITS`.
fn enumerate(budget: &mut Budget, root: &Line, found: &mut Found) -> Option<()> {
    walks(budget, root, WALK_RADIUS, |budget, node| {
        if !Dir::PRIORITY.into_iter().any(|dir| opens(&node.game, dir)) {
            return Some(true);
        }
        let mut waiting = budget.fork(node)?;
        let start = waiting.game.ticks_used;
        for wait in WAITS {
            while waiting.game.ticks_used - start < wait {
                if !budget.advance(&mut waiting, InputMask::NONE)? || waiting.game.end.is_some() {
                    return Some(true);
                }
            }
            for out in Dir::PRIORITY {
                if opens(&waiting.game, out) {
                    leg(budget, &waiting, out, out, Stage::Out, found)?;
                }
            }
        }
        Some(true)
    })
}

/// Visits `root`, then the lines that walk from it over claimed cells, a step a tick, breadth
/// first, up to `radius` steps and each cell once. A step that loses a life, ends the level or
/// leaves the player where it was (the core keeps it on the rail) drops what would follow it.
/// `visit` returns whether to walk on, and `None` when the budget runs out, as `walks` does.
fn walks(
    budget: &mut Budget,
    root: &Line,
    radius: u16,
    mut visit: impl FnMut(&mut Budget, &Line) -> Option<bool>,
) -> Option<()> {
    let index = |pos| CellIndex::new(pos).expect("a walk stays on the grid").get();
    let mut seen = vec![false; CELLS];
    seen[index(root.game.player.pos)] = true;
    let mut frontier = vec![budget.fork(root)?];
    for steps in 0..=radius {
        for node in &frontier {
            if !visit(budget, node)? {
                return Some(());
            }
        }
        let mut next = Vec::new();
        for node in frontier.iter().filter(|_| steps < radius) {
            for dir in Dir::PRIORITY {
                let Some(cell) = neighbor(node.game.player.pos, dir) else {
                    continue;
                };
                if seen[index(cell)] || node.game.grid.at(cell) != Some(Cell::Claimed) {
                    continue;
                }
                let mut walked = budget.fork(node)?;
                if budget.advance(&mut walked, dir.mask())?
                    && walked.game.end.is_none()
                    && walked.game.player.pos == cell
                {
                    seen[index(cell)] = true;
                    next.push(walked);
                }
            }
        }
        if next.is_empty() {
            break;
        }
        frontier = next;
    }
    Some(())
}

/// Whether the cell beside the player in `dir` is open field, where a cut starts.
fn opens(game: &Game, dir: Dir) -> bool {
    neighbor(game.player.pos, dir).and_then(|cell| game.grid.at(cell)) == Some(Cell::Empty)
}

/// The open cells in a row ahead of the player in `dir`, outside the boss's body, and whether
/// claimed ground ends them, where a leg closes the cut.
fn open_run(game: &Game, dir: Dir) -> (u8, bool) {
    let mut run = 0;
    let mut pos = game.player.pos;
    while let Some(next) = neighbor(pos, dir) {
        match game.grid.at(next) {
            Some(Cell::Empty) if !in_boss(game, next) => {
                run += 1;
                pos = next;
            }
            Some(Cell::Claimed) => return (run, true),
            _ => break,
        }
    }
    (run, false)
}

/// The legs of a cut: out from the rail, across, then back to claimed ground, or on outward.
#[derive(Clone, Copy, PartialEq, Eq)]
enum Stage {
    Out,
    Side,
    Back,
}

impl Stage {
    /// The stage that follows a leg in `dir` of a cut that went `out` first, and its two
    /// directions.
    fn next(self, dir: Dir, out: Dir) -> Option<(Self, [Dir; 2])> {
        match self {
            Self::Out => Some((Self::Side, [dir.clockwise(), reverse(dir.clockwise())])),
            Self::Side => Some((Self::Back, [reverse(out), out])),
            Self::Back => None,
        }
    }
}

/// A leg of a cut from `start` in `dir`, with A held so that the cut runs two cells a tick. Each
/// length of `LEGS` within the open run ahead turns into the next stage; a length that a double
/// step would overshoot takes its last cell without A (PIN-04 keeps A safe on the closing
/// sub-step). When claimed ground ends the run, the leg also runs on until the cut closes, and
/// `found` records the capture.
fn leg(
    budget: &mut Budget,
    start: &Line,
    dir: Dir,
    out: Dir,
    stage: Stage,
    found: &mut Found,
) -> Option<()> {
    let from = start.game.player.pos;
    let (run, closes) = open_run(&start.game, dir);
    let moves = run > 0 || (closes && start.game.player.cutting);
    if !moves || (stage == Stage::Back && !closes) {
        return Some(());
    }
    let mut line = budget.fork(start)?;
    loop {
        let done = distance(from, line.game.player.pos, dir);
        if let Some((next, dirs)) = stage.next(dir, out) {
            for length in LEGS.into_iter().take_while(|&length| length <= run) {
                let length = i16::from(length);
                if length == done && done > 0 {
                    for turn in dirs {
                        leg(budget, &line, turn, out, next, found)?;
                    }
                } else if length == done + 1 && line.game.player.cutting {
                    let mut last = budget.fork(&line)?;
                    if budget.advance(&mut last, dir.mask())?
                        && last.game.end.is_none()
                        && distance(from, last.game.player.pos, dir) == length
                    {
                        for turn in dirs {
                            leg(budget, &last, turn, out, next, found)?;
                        }
                    }
                }
            }
        }
        if !closes && done + 1 >= i16::from(run) {
            return Some(());
        }
        let captured = line.game.captured;
        if !budget.advance(&mut line, mask(&[dir.mask(), InputMask::A]))? {
            return Some(());
        }
        if line.game.captured > captured || line.game.end.is_some() {
            if closes {
                found.record(line);
            }
            return Some(());
        }
        if distance(from, line.game.player.pos, dir) == done {
            return Some(());
        }
    }
}

/// A pad of up to `ticks` ticks from `game`, planned whole, chunk after chunk of at most
/// `PAD_CHUNK` ticks from where the last one ends. `None` if no tick can be padded.
fn pad(budget: &mut Budget, game: &Game, ticks: u16) -> Option<Line> {
    let end = game.ticks_used + ticks;
    let mut line = budget.root(game)?;
    while line.game.ticks_used < end {
        let chunk_end = end.min(line.game.ticks_used + PAD_CHUNK);
        match longest_stand(budget, &line, chunk_end) {
            Some(longer) if longer.game.ticks_used > line.game.ticks_used => line = longer,
            _ => break,
        }
    }
    (line.game.ticks_used > game.ticks_used).then_some(line)
}

/// The longest line from `start`, up to tick `end`, that walks along the rail at most
/// `PAD_RADIUS` steps, then stands, keeping every life: the first of equal length.
fn longest_stand(budget: &mut Budget, start: &Line, end: u16) -> Option<Line> {
    let mut best: Option<Line> = None;
    // A budget that runs out ends the walks; the longest line by then stands.
    let _ = walks(budget, start, PAD_RADIUS, |budget, node| {
        if node.game.ticks_used > end {
            return Some(false);
        }
        let mut standing = budget.fork(node)?;
        while standing.game.ticks_used < end {
            let mut next = budget.fork(&standing)?;
            if !budget.advance(&mut next, InputMask::NONE)? || next.game.end.is_some() {
                break;
            }
            standing = next;
        }
        if best
            .as_ref()
            .is_none_or(|best| standing.game.ticks_used > best.game.ticks_used)
        {
            best = Some(standing);
        }
        Some(best.as_ref().is_some_and(|best| best.game.ticks_used < end))
    });
    best
}
