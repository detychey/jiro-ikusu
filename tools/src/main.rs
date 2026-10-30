//! jiro-tools, the native target (README §3): `vectors` writes vectors/, `replay` replays a
//! journal and diagnoses another target's disagreement, and `level` builds the level sources.

mod coverage;
mod json;
mod levels;
mod preimage;
mod replay;
mod scenarios;
mod vectors;

use std::path::PathBuf;
use std::process::ExitCode;

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let result = match args
        .iter()
        .map(String::as_str)
        .collect::<Vec<_>>()
        .as_slice()
    {
        ["vectors"] => vectors::write(&repo_root()),
        ["replay", rest @ ..] => replay::run(rest),
        ["level", rest @ ..] => levels::run(rest),
        _ => Err(
            "usage: jiro-tools vectors | jiro-tools replay ... | jiro-tools level ...".to_string(),
        ),
    };
    match result {
        Ok(()) => ExitCode::SUCCESS,
        Err(message) => {
            eprintln!("jiro-tools: {message}");
            ExitCode::FAILURE
        }
    }
}

fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..")
}
