use std::collections::BTreeSet;

use jiro_core::consts::{BP, MAX_BOSS_SIZE, MIN_BOSS_SIZE};
use jiro_core::game::EndReason;
use jiro_core::level::decode;
use jiro_core::replay::replay;

use super::*;

/// The fixed set of plan M1.10: seed 1, 200 cases.
fn fixed_set() -> impl Iterator<Item = Case> {
    (0..200).map(|index| drawn(1, index))
}

fn drawn(seed: u64, index: u32) -> Case {
    case(seed, index).expect("a case")
}

#[test]
fn a_case_is_drawn_the_same_every_time() {
    let (first, second) = (drawn(1, 7), drawn(1, 7));
    assert_eq!(
        (first.level, first.header, first.journal, first.weight_bp),
        (
            second.level,
            second.header,
            second.journal,
            second.weight_bp
        )
    );
}

#[test]
fn the_fixed_set_draws_every_boss_size() {
    let sizes: BTreeSet<u8> = fixed_set()
        .map(|case| decode(&case.level).expect("valid level").boss_size)
        .collect();
    assert_eq!(sizes, (MIN_BOSS_SIZE..=MAX_BOSS_SIZE).collect());
}

#[test]
fn the_fixed_set_draws_every_minion_count() {
    let counts: BTreeSet<u8> = fixed_set()
        .map(|case| decode(&case.level).expect("valid level").minion_count)
        .collect();
    assert_eq!(counts, (0..=3).collect());
}

#[test]
fn the_fixed_set_ends_in_every_way() {
    let ends: BTreeSet<u8> = fixed_set()
        .map(|case| {
            replay(&case.level, &case.journal, BP)
                .expect("replays")
                .end_reason as u8
        })
        .collect();
    let all = [
        EndReason::Committed,
        EndReason::Cleared,
        EndReason::OutOfLives,
        EndReason::TimeLimit,
    ];
    assert_eq!(ends, all.into_iter().map(|end| end as u8).collect());
}
