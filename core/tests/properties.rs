//! The parity-testing properties over the random cases of `jiro_tools::cases`, drawn from seed 1,
//! whose first 200 cases are difffuzz's fixed set (plan M1.10). `JIRO_CASES` sets the case count
//! per property, 2,000 by default: CI's rust-release job runs that, and nightly.yml runs 100,000.

use jiro_core::Error;
use jiro_core::consts::LEVEL_LEN;
use jiro_core::game::Game;
use jiro_core::hash::state_hash;
use jiro_core::level::level_id;
use jiro_core::minion::State;
use jiro_core::replay::replay_observed;
use jiro_core::types::Cell;
use jiro_tools::cases::{Case, case};
use jiro_tools::random::Rng;

const SEED: u64 = 1;

fn case_count() -> u32 {
    std::env::var("JIRO_CASES").map_or(2_000, |count| {
        count
            .parse()
            .unwrap_or_else(|_| panic!("JIRO_CASES: not a case count: {count}"))
    })
}

/// Replays every case, calling `check` with the case's index after each processed tick.
fn observe_every_case(mut check: impl FnMut(u32, &Game)) {
    for index in 0..case_count() {
        let Case {
            level,
            journal,
            weight_bp,
        } = case(SEED, index);
        replay_observed(&level, &journal, weight_bp, |game| check(index, game))
            .unwrap_or_else(|error| panic!("case {index}: replay gives {error:?}"));
    }
}

/// [R4.1-8] Captured cells only grow, so `claim_bp` never decreases within a level.
#[test]
#[cfg_attr(debug_assertions, ignore)]
fn claim_bp_never_decreases_within_a_level() {
    let mut last = (0, 0);
    observe_every_case(|index, game| {
        let claim = game.claim_bp().expect("claim_bp");
        if last.0 == index {
            assert!(
                claim >= last.1,
                "case {index}, tick {}: claim_bp {} -> {claim}",
                game.ticks_used,
                last.1
            );
        }
        last = (index, claim);
    });
}

/// [R4.6-1] No cell of the boss's body is ever `CLAIMED` or `TRAIL`.
#[test]
#[cfg_attr(debug_assertions, ignore)]
fn no_cell_of_the_boss_body_is_ever_claimed_or_trail() {
    observe_every_case(|index, game| {
        for pos in game.boss.body() {
            let cell = game.grid.at(pos).expect("the body is inside the grid");
            assert!(
                cell != Cell::Claimed && cell != Cell::Trail,
                "case {index}, tick {}: the boss body covers {cell:?} at {pos:?}",
                game.ticks_used
            );
        }
    });
}

/// [R4.7-1] Minions stay on rail cells.
#[test]
#[cfg_attr(debug_assertions, ignore)]
fn minions_stay_on_rail_cells() {
    observe_every_case(|index, game| {
        for minion in game.minions.slots.iter().flatten() {
            if let State::Live { pos, .. } = minion.state {
                assert!(
                    game.grid.is_rail(pos),
                    "case {index}, tick {}: a minion is off the rail at {pos:?}",
                    game.ticks_used
                );
            }
        }
    });
}

/// Replay returns an Outcome or an Error on arbitrary bytes, and never code 15, which no input
/// reaches (README §6.3). Half of the inputs are random bytes; the other half are cases with
/// bytes changed at random, and the journal's level id then follows the changed level, so that
/// a level the changes leave valid is played.
#[test]
#[cfg_attr(debug_assertions, ignore)]
fn replay_returns_an_outcome_or_an_error_on_arbitrary_bytes() {
    for index in 0..case_count() {
        let mut rng = Rng::new(u64::from(index));
        let (level, journal) = if rng.one_in(2) {
            (
                random_bytes(&mut rng, LEVEL_LEN + 2),
                random_bytes(&mut rng, 600),
            )
        } else {
            changed_case(&mut rng, index)
        };
        let result = replay_observed(&level, &journal, rng.next_u64() as u16, |_| {});
        assert_ne!(result.err(), Some(Error::Invariant), "case {index}");
    }
}

/// Two replays of the same input give the same Outcome and the same state hash on every tick.
#[test]
#[cfg_attr(debug_assertions, ignore)]
fn two_replays_of_the_same_input_are_identical() {
    for index in 0..case_count() {
        let Case {
            level,
            journal,
            weight_bp,
        } = case(SEED, index);
        let traced = || {
            let mut trace = Vec::new();
            let result = replay_observed(&level, &journal, weight_bp, |game| {
                trace.push(state_hash(game))
            });
            (result, trace)
        };
        assert_eq!(traced(), traced(), "case {index}");
    }
}

/// Up to `max` random bytes; one time in four exactly `max`, the length of a whole level.
fn random_bytes(rng: &mut Rng, max: usize) -> Vec<u8> {
    let len = if rng.one_in(4) {
        max
    } else {
        rng.below(max as u64 + 1) as usize
    };
    (0..len).map(|_| rng.next_u64() as u8).collect()
}

/// A case with 1 to 8 random bytes of its level or journal replaced, the level's first byte
/// kept at the version one time in two, and the journal's level id rewritten to the changed level.
fn changed_case(rng: &mut Rng, index: u32) -> (Vec<u8>, Vec<u8>) {
    let Case { level, journal, .. } = case(SEED, index);
    let (mut level, mut journal) = (level.to_vec(), journal);
    for _ in 0..rng.range(1, 8) {
        let bytes = if rng.one_in(2) {
            &mut level
        } else {
            &mut journal
        };
        let at = rng.below(bytes.len() as u64) as usize;
        bytes[at] = rng.next_u64() as u8;
    }
    if rng.one_in(2) {
        level[0] = 1;
    }
    journal[36..68].copy_from_slice(&level_id(&level));
    (level, journal)
}
