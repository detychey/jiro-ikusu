//! Game vectors (README §6.6): a level and a journal, with the Outcome or error that replay
//! returns and the trace of state hashes.

use jiro_core::Error;
use jiro_core::game::EndReason;
use jiro_core::journal::Header;
use jiro_core::level::{Level, encode};

use super::{journal, level};

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

fn game_case(
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

pub fn cases() -> Vec<GameCase> {
    let header = journal::header();
    let open_field_empty = GameCase {
        tick_0_hash: Some("0xc9775c491d677d941c3ac733e1b47b51a64024cb4da22f9c05ceea58d93c76d1"),
        ..game_case(
            "open-field-empty",
            &["§6.4", "R4.4-1", "R4.10-4", "PIN-08"],
            &level::open_field(),
            header,
            journal::encoded(&header, &[]),
            Ok(EndReason::TimeLimit),
        )
    };
    vec![open_field_empty]
}
