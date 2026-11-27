//! A level in play (README §4.4): the whole state, and one tick of the seven steps.

use core::num::NonZeroU16;

use crate::Error;
use crate::boss::Bosses;
use crate::consts::{CAPTURE_STACK, WORK_BUDGET};
use crate::grid::{Grid, claim_bp};
use crate::hits::{minion_hits, resolve};
use crate::level::{Level, validate};
use crate::minion::Minions;
use crate::player::Player;
use crate::seed::level_seed;
use crate::types::InputMask;

/// How a level ended (README §4.10), with the `endReason` codes of the Outcome (§7.3).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u8)]
pub enum EndReason {
    Committed = 1,
    Cleared = 2,
    OutOfLives = 3,
    TimeLimit = 4,
    WorkBudget = 5,
}

#[derive(Clone, Debug)]
pub struct Game {
    pub grid: Grid,
    pub player: Player,
    pub bosses: Bosses,
    pub minions: Minions,
    /// The mask in force, from the last journal event (R4.4-6).
    pub mask: InputMask,
    /// The ticks processed so far, which is also the next tick to process (PIN-08).
    pub ticks_used: u16,
    /// The journal events applied so far. Every event changes the mask (README §6.2), so this
    /// counts the changes of mask.
    pub events_applied: u16,
    /// The cells captured so far in the level.
    pub captured: u16,
    /// The level's work so far [R4.11-1].
    pub work: u32,
    /// The cells `EMPTY` at level start [R4.1-8].
    pub claimable: NonZeroU16,
    pub target_bp: u16,
    pub time_limit: u16,
    /// A capture separated the two bosses, which clears the level [R4.8-6].
    pub separated: bool,
    pub end: Option<EndReason>,
    stack: [u16; CAPTURE_STACK],
}

impl Game {
    /// The level before tick 0, with the boss starts and deflection keys of the level seed of
    /// `run_nonce` and `level_index` (README §6.4). Rejects a level that fails validity (35 to
    /// 39, 44 and 45).
    pub fn new(level: &Level, run_nonce: &[u8; 32], level_index: u8) -> Result<Self, Error> {
        let mut stack = [0; CAPTURE_STACK];
        let start = validate(level, &mut stack)?;
        let bosses =
            Bosses::start(level, &level_seed(run_nonce, level_index)).ok_or(Error::SpawnOrder)?;
        Ok(Self {
            minions: Minions::start(level, &start.grid),
            grid: start.grid,
            player: Player::start(level.lives),
            bosses,
            mask: InputMask::NONE,
            ticks_used: 0,
            events_applied: 0,
            captured: 0,
            work: 0,
            claimable: start.claimable,
            target_bp: level.target_bp,
            time_limit: level.time_limit,
            separated: false,
            end: None,
            stack,
        })
    }

    /// The claim in basis points: captured × 10,000 / claimable, rounded down [R4.1-8], raised
    /// to the target once the bosses are separated [R4.8-6].
    pub fn claim_bp(&self) -> Result<u16, Error> {
        let claim =
            u16::try_from(claim_bp(self.captured, self.claimable)).map_err(|_| Error::Invariant)?;
        Ok(if self.separated {
            claim.max(self.target_bp)
        } else {
            claim
        })
    }

    /// Processes the next tick with `mask` in force, steps 1 to 7, and returns how the level
    /// ended, if it did on this tick or before. An ended level does not change.
    pub fn step(&mut self, mask: InputMask) -> Result<Option<EndReason>, Error> {
        if self.end.is_none() {
            let tick = self.ticks_used;
            // tick < time_limit ≤ 2,700, so the count cannot saturate.
            self.ticks_used = tick.saturating_add(1);
            self.end = self.tick(tick, mask)?;
        }
        Ok(self.end)
    }

    /// The steps of R4.4-5, stopping at the first that ends the level [R4.4-4].
    fn tick(&mut self, tick: u16, mask: InputMask) -> Result<Option<EndReason>, Error> {
        self.input(mask);
        if mask.contains(InputMask::X) {
            self.player.abandon_cut(&mut self.grid);
            return Ok(Some(EndReason::Committed));
        }
        let moves = self
            .player
            .step(&mut self.grid, &self.bosses, mask, &mut self.stack)
            .ok_or(Error::Invariant)?;
        if let Some(done) = moves.captured {
            self.captured = self.captured.saturating_add(done.size);
            self.work = self.work.saturating_add(done.work());
            self.separated = done.separated;
            self.minions.after_capture(&self.grid);
            if self.claim_bp()? >= self.target_bp {
                return Ok(Some(EndReason::Cleared));
            }
        }
        let boss_hit = self.bosses.step(&self.grid, tick);
        let minions = self.minions.step(&self.grid, tick);
        self.work = self.work.saturating_add(minions.work);
        let hit = moves.hit || boss_hit || minion_hits(&moves, &minions.moved);
        if resolve(&mut self.player, &mut self.grid, hit) && self.player.lives == 0 {
            return Ok(Some(EndReason::OutOfLives));
        }
        Ok(self.time_and_work(tick))
    }

    /// Step 7: the time limit, then the work budget [R4.4-12, R4.11-4].
    fn time_and_work(&self, tick: u16) -> Option<EndReason> {
        if self.time_limit.checked_sub(1) == Some(tick) {
            Some(EndReason::TimeLimit)
        } else if self.work >= WORK_BUDGET {
            Some(EndReason::WorkBudget)
        } else {
            None
        }
    }

    /// Step 1: the mask of this tick's event, if any, replaces the mask in force [R4.4-6].
    fn input(&mut self, mask: InputMask) {
        if mask != self.mask {
            self.events_applied = self.events_applied.saturating_add(1);
        }
        self.mask = mask;
    }
}
