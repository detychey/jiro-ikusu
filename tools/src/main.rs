//! jiro-tools, the native target (README §3): `vectors` writes vectors/format/.

mod json;
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
        ["vectors"] => vectors::write(&repo_root().join("vectors")),
        _ => Err("usage: jiro-tools vectors".to_string()),
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
