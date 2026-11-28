use super::*;
use crate::playtest::tests::levels_dir;

const POLICIES: [Policy; 4] = [
    Policy::Bold,
    Policy::Committer,
    Policy::EdgeNibbler,
    Policy::RandomWalk,
];

/// Ten games of each policy on one level, at the given mean tickets in basis points.
fn tallies(tickets_bp: [u64; 4]) -> Vec<Vec<Tally>> {
    let tally = |ticket_bp: u64| Tally {
        games: 10,
        tickets_bp: 10 * ticket_bp,
        ..Tally::default()
    };
    vec![tickets_bp.map(tally).to_vec()]
}

fn report(tickets_bp: [u64; 4]) -> String {
    let levels: Vec<LevelFile> = load_levels(&levels_dir())
        .expect("levels")
        .into_iter()
        .take(1)
        .collect();
    markdown(&levels, &POLICIES, 2, &tallies(tickets_bp), 10, 1)
}

#[test]
fn a_ticket_above_the_target_is_capped_at_1() {
    assert_eq!(ticket_bp(7_200, 5_000), 10_000);
}

#[test]
fn a_ticket_below_the_target_is_its_share_of_the_target() {
    assert_eq!(ticket_bp(2_499, 5_000), 4_998);
}

#[test]
fn a_game_that_ran_out_of_lives_has_a_ticket_of_0() {
    let sample = Sample {
        end: EndReason::OutOfLives,
        effective_bp: 0,
        ticks_used: 900,
        events: 300,
        separated: false,
    };
    assert_eq!(Tally::of(&[sample], 5_000).tickets_bp, 0);
}

#[test]
fn twenty_percent_novices_weigh_the_mix_four_times_the_novices() {
    assert_eq!(population(4, 2, 20), [160, 160, 40, 40]);
}

#[test]
fn the_edge_is_a_perfect_ticket_over_people_s_average_ticket() {
    let text = report([10_000, 5_000, 0, 0]);
    let rows = [
        "| the reference mix | 0.750 | 1.333 |",
        "| 20 % novices | 0.600 | 1.666 |",
        "| 40 % novices | 0.450 | 2.222 |",
    ];
    assert!(rows.iter().all(|row| text.contains(row)), "{text}");
}

#[test]
fn people_whose_tickets_are_all_0_give_an_infinite_edge() {
    let text = report([0; 4]);
    assert!(text.contains("| the reference mix | 0.000 | ∞ |"), "{text}");
}
