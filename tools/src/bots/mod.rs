//! The playtest bots (plan M2.6), modeled on ethblockdigger's `src/sim/policies`. A bot reads the
//! game as the previous tick left it and returns the raw input mask of the next tick, which the
//! Recorder journals.

mod greedy;

use jiro_core::game::Game;
use jiro_core::types::InputMask;

use crate::scenarios::play::{CaptureBot, random_play};
use greedy::Greedy;

#[cfg(test)]
mod tests;

/// EdgeNibbler's longest leg, in cells.
const NIBBLE_LEG: u8 = 3;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Policy {
    /// Small U-shaped cuts from the rail; never commits.
    EdgeNibbler,
    /// The largest rectangle away from the boss and the minions; never commits.
    Greedy,
    /// Greedy's cuts, and banks the claim with X once a lost life leaves it at its last one,
    /// rather than risk a level that scores zero (D5).
    Committer,
    /// Random directions, the baseline.
    RandomWalk,
}

impl Policy {
    pub const ALL: [Self; 4] = [
        Self::EdgeNibbler,
        Self::Greedy,
        Self::Committer,
        Self::RandomWalk,
    ];

    pub fn name(self) -> &'static str {
        match self {
            Self::EdgeNibbler => "edge-nibbler",
            Self::Greedy => "greedy",
            Self::Committer => "committer",
            Self::RandomWalk => "random-walk",
        }
    }

    pub fn parse(name: &str) -> Result<Self, String> {
        Self::ALL
            .into_iter()
            .find(|policy| policy.name() == name)
            .ok_or_else(|| {
                let names: Vec<&str> = Self::ALL.iter().map(|policy| policy.name()).collect();
                format!("unknown policy {name:?}: one of {}", names.join(", "))
            })
    }

    /// A bot of this policy, its randomness seeded with `seed`.
    pub fn bot(self, seed: u64) -> Box<dyn FnMut(&Game) -> InputMask> {
        match self {
            Self::EdgeNibbler => {
                let mut bot = CaptureBot::new(seed, NIBBLE_LEG);
                Box::new(move |game| bot.direction(game).mask())
            }
            Self::Greedy => {
                let mut bot = Greedy::new(seed);
                Box::new(move |game| bot.mask(game))
            }
            Self::Committer => {
                let mut bot = Greedy::new(seed);
                let mut start_lives = None;
                Box::new(move |game| {
                    let start = *start_lives.get_or_insert(game.player.lives);
                    if game.player.lives == 1 && start > 1 {
                        InputMask::X
                    } else {
                        bot.mask(game)
                    }
                })
            }
            Self::RandomWalk => Box::new(random_play(seed, 8, u64::MAX, false)),
        }
    }
}
