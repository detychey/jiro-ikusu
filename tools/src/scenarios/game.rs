//! Game vectors (README §6.6): a level and a journal, with the Outcome or error that replay
//! returns and the trace of state hashes. Each scenario plays its journal through the Recorder
//! and checks that the run does what the vector is named for, so a scenario that stops
//! exercising its rule stops the build of `vectors/`.

use jiro_core::Error;
use jiro_core::consts::PLAYER_START;
use jiro_core::game::{EndReason, Game};
use jiro_core::journal::{Event, Header};
use jiro_core::level::{Level, Rect, encode};
use jiro_core::minion::State;
use jiro_core::types::{Cell, InputMask, Pos};

use super::play::{Run, header, record, script};
use super::{game_cuts, game_hits, game_long, journal, level};

pub struct GameCase {
    pub name: String,
    /// The README sections and rule tags the vector exercises.
    pub covers: Vec<String>,
    pub level: Vec<u8>,
    pub header: Header,
    pub journal: Vec<u8>,
    pub weight_bp: u16,
    pub expect: Result<EndReason, Error>,
    /// A README worked example for the state hash of tick 0, if any.
    pub tick_0_hash: Option<&'static str>,
}

pub fn game_case(
    name: &str,
    covers: &[&str],
    level: &Level,
    header: Header,
    journal: Vec<u8>,
    expect: Result<EndReason, Error>,
) -> GameCase {
    GameCase {
        name: name.to_string(),
        covers: covers.iter().map(|cover| cover.to_string()).collect(),
        level: encode(level).to_vec(),
        header,
        journal,
        weight_bp: 10_000,
        expect,
        tick_0_hash: None,
    }
}

/// The case of a recorded run, which must end as `expect`.
pub fn recorded(
    name: &str,
    covers: &[&str],
    level: &Level,
    header: Header,
    run: Run,
    expect: EndReason,
) -> Result<GameCase, String> {
    check(
        name,
        run.last().end == Some(expect),
        &format!("ends {expect:?}"),
    )?;
    Ok(game_case(
        name,
        covers,
        level,
        header,
        run.journal,
        Ok(expect),
    ))
}

/// Fails generation with what the scenario no longer does.
pub fn check(name: &str, holds: bool, what: &str) -> Result<(), String> {
    if holds {
        Ok(())
    } else {
        Err(format!("game {name}: the run no longer {what}"))
    }
}

/// The open-field level with its boss held still: the body starts at `spawn` and moves on ticks
/// 0, 255, 510 and so on.
pub fn calm(spawn: (u8, u8)) -> Level {
    let (x, y) = spawn;
    Level {
        spawn: Rect {
            x0: x,
            y0: y,
            x1: x,
            y1: y,
        },
        boss_period: 255,
        ..level::open_field()
    }
}

pub fn minion_pos(game: &Game, slot: usize) -> Option<Pos> {
    match game.minions.slots[slot]?.state {
        State::Live { pos, .. } => Some(pos),
        State::Destroyed { .. } => None,
    }
}

pub fn cases() -> Result<Vec<GameCase>, String> {
    let open_field_header = journal::header();
    let open_field_empty = GameCase {
        tick_0_hash: Some("0xc9775c491d677d941c3ac733e1b47b51a64024cb4da22f9c05ceea58d93c76d1"),
        ..game_case(
            "open-field-empty",
            &["§6.4", "R4.4-1", "R4.10-4", "PIN-08"],
            &level::open_field(),
            open_field_header,
            journal::encoded(&open_field_header, &[]),
            Ok(EndReason::TimeLimit),
        )
    };
    let mut cases = vec![open_field_empty];
    cases.extend(ends()?);
    cases.extend(rejections());
    cases.extend(game_cuts::cases()?);
    cases.extend(game_hits::cases()?);
    cases.extend(game_long::cases()?);
    Ok(cases)
}

/// Commit, the time limit, and end conditions meeting on one tick (README §4.10).
fn ends() -> Result<Vec<GameCase>, String> {
    let open_field = level::open_field();
    let open_field_header = journal::header();
    let commit_at_tick_0 = record(&open_field, &open_field_header, script(&[], InputMask::X))?;
    check(
        "commit-at-tick-0",
        commit_at_tick_0.last().ticks_used == 1 && commit_at_tick_0.last().captured == 0,
        "commits with claim 0 after one tick",
    )?;

    let calm = calm((25, 10));
    let calm_header = header(&calm, journal::header().run_nonce);
    let commit_during_cut = record(
        &calm,
        &calm_header,
        script(&[(InputMask::UP, 5)], InputMask::X),
    )?;
    let last = commit_during_cut.last();
    check(
        "commit-during-cut",
        last.grid.count(Cell::Trail) == 0 && last.player.pos == PLAYER_START && last.captured == 0,
        "erases the trail of the unfinished cut and returns to the cut start",
    )?;

    let short = Level {
        time_limit: 20,
        ..calm
    };
    let short_header = header(&short, journal::header().run_nonce);
    let at_last_tick = record(&short, &short_header, |game| {
        if game.ticks_used == 19 {
            InputMask::RIGHT
        } else {
            game.mask
        }
    })?;
    check(
        "event-at-last-tick",
        at_last_tick.events() == 1 && at_last_tick.last().ticks_used == 20,
        "applies an event at tick T − 1",
    )?;

    Ok(vec![
        recorded(
            "commit-at-tick-0",
            &[
                "§4.10", "R4.10-1", "R4.10-2", "R4.4-7", "PIN-07", "PIN-08", "COV-11",
            ],
            &open_field,
            open_field_header,
            commit_at_tick_0,
            EndReason::Committed,
        )?,
        recorded(
            "commit-during-cut",
            &["§4.10", "R4.4-4", "R4.4-7", "R4.10-2", "COV-11"],
            &calm,
            calm_header,
            commit_during_cut,
            EndReason::Committed,
        )?,
        recorded(
            "event-at-last-tick",
            &["§4.4", "R4.4-1", "R4.4-12", "R4.10-4", "COV-12"],
            &short,
            short_header,
            at_last_tick,
            EndReason::TimeLimit,
        )?,
    ])
}

/// Journals that replay rejects (README §6.3): codes 12, 13 and 14, and a level that fails its
/// checks before its id is compared.
fn rejections() -> Vec<GameCase> {
    let open_field = level::open_field();
    let open_field_header = journal::header();
    let short = Level {
        time_limit: 20,
        ..calm((25, 10))
    };
    let short_header = header(&short, journal::header().run_nonce);
    let no_lives = Level {
        lives: 0,
        ..open_field
    };
    let no_lives_header = header(&no_lives, journal::header().run_nonce);
    let event = |tick, mask| Event { tick, mask };
    vec![
        game_case(
            "rejected-level-id",
            &["§6.3", "§7.3"],
            &calm((25, 10)),
            open_field_header,
            journal::encoded(&open_field_header, &[]),
            Err(Error::LevelId),
        ),
        game_case(
            "rejected-event-at-time-limit",
            &["§6.3", "R4.4-1", "COV-12"],
            &short,
            short_header,
            journal::encoded(&short_header, &[event(20, InputMask::RIGHT)]),
            Err(Error::EventPastTimeLimit),
        ),
        game_case(
            "rejected-event-after-end",
            &["§6.3", "R4.4-4"],
            &open_field,
            open_field_header,
            journal::encoded(
                &open_field_header,
                &[event(0, InputMask::X), event(5, InputMask::UP)],
            ),
            Err(Error::EventAfterEnd),
        ),
        game_case(
            "rejected-level-before-its-id",
            &["§5", "§6.3"],
            &no_lives,
            no_lives_header,
            // The open field's id, not this level's: the level's own check (33) comes first.
            journal::encoded(&journal::header(), &[]),
            Err(Error::Lives),
        ),
    ]
}
