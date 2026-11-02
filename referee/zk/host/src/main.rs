use std::path::{Path, PathBuf};

use risc0_zkvm::sha::Digest;
use risc0_zkvm::{ExitCode, SessionInfo, default_executor};
use serde_json::Value;
use zk_host::{
    FormatFixtures, Input, TRACE_ELF, TRACE_ID, TRACED_LEN, VERIFY_ELF, VERIFY_ID, check_format,
    check_outcome, check_outcomes, check_traced, env, read_games, read_vector, rejection_code,
};

mod prove;

const USAGE: &str = "usage: zk-host execute <vector file or directory>...
       zk-host execute-run <six game vector files>
       zk-host difffuzz <cases directory>
       zk-host prove --level <game vector file> [--segment-po2 <n>]
       zk-host prove --run <six game vector files> [--segment-po2 <n>]";

/// The one JSON file under vectors/ that is not a vector (vectors/README.md).
const NOT_A_VECTOR: &str = "derivations.json";

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let result = match args.split_first() {
        Some((command, rest)) if command == "execute" => execute(rest),
        Some((command, rest)) if command == "execute-run" => execute_run(rest),
        Some((command, rest)) if command == "difffuzz" => difffuzz(rest),
        Some((command, rest)) if command == "prove" => prove::prove(rest),
        _ => Err(USAGE.into()),
    };
    if let Err(error) = result {
        eprintln!("zk-host: {error}");
        std::process::exit(1);
    }
}

/// One vector's row of the cycle table: how the level ended, and the guests' sessions. The
/// verify guest has none on a rejected journal; the trace guest runs on game vectors only.
struct Row {
    ending: String,
    verify: Option<SessionInfo>,
    trace: Option<SessionInfo>,
}

/// Every vector through the guests. A game vector goes through both: the trace guest must
/// reproduce its error code, `traceKeccak` and Outcome, and the verify guest its Outcome, or panic
/// with replay's error code on a rejected journal. A format vector goes through the verify guest,
/// which must give its recorded code (`check_format`).
fn execute(paths: &[String]) -> Result<(), String> {
    let files = vector_files(paths)?;
    let vectors = files
        .iter()
        .map(|file| read_vector(file))
        .collect::<Result<Vec<_>, _>>()?;
    let fixtures = FormatFixtures::find(&vectors);
    let mut failures = 0;
    println!("=== BEGIN zk-exec ===");
    println!("verify image id: 0x{}", Digest::from(VERIFY_ID));
    println!("trace image id: 0x{}", Digest::from(TRACE_ID));
    println!(
        "| vector | result | ticks used or error | user cycles | proving cycles | segments | trace-guest user cycles |"
    );
    println!("|---|---|---|---|---|---|---|");
    for (file, vector) in files.iter().zip(&vectors) {
        let name = file
            .file_stem()
            .map_or_else(String::new, |stem| stem.to_string_lossy().into_owned());
        let row = match vector["kind"].as_str() {
            Some("game" | "difffuzz") => execute_game(vector),
            _ => fixtures
                .as_ref()
                .map_err(Clone::clone)
                .and_then(|fixtures| execute_format(vector, fixtures)),
        };
        match row {
            Ok(row) => println!(
                "| {name} | PASS | {} | {} | {} | {} | {} |",
                row.ending,
                row.verify
                    .as_ref()
                    .map_or_else(|| "rejected".into(), |info| info.cycles().to_string()),
                row.verify
                    .as_ref()
                    .map_or_else(String::new, |info| proving_cycles(info).to_string()),
                row.verify
                    .as_ref()
                    .map_or_else(String::new, |info| info.segments.len().to_string()),
                row.trace
                    .as_ref()
                    .map_or_else(String::new, |info| info.cycles().to_string()),
            ),
            Err(error) => {
                failures += 1;
                println!("| {name} | FAIL: {error} | | | | | |");
            }
        }
    }
    println!("=== END zk-exec ===");
    println!("{} vectors, {failures} failed", files.len());
    match failures {
        0 => Ok(()),
        _ => Err(format!("{failures} of {} vectors failed", files.len())),
    }
}

fn execute_game(vector: &Value) -> Result<Row, String> {
    let ending = vector["outcome"]["ticksUsed"].as_u64().map_or_else(
        || format!("error {}", vector["error"]),
        |ticks| ticks.to_string(),
    );
    let trace = run(TRACE_ELF, &[Input::of_game(vector)?])?;
    if trace.journal.bytes.len() != TRACED_LEN {
        return Err(format!(
            "trace guest committed {} bytes",
            trace.journal.bytes.len()
        ));
    }
    check_traced(vector, &trace.journal.bytes)?;
    let recorded_code = vector.get("error").map(Value::as_u64);
    let verify = match (recorded_code, run(VERIFY_ELF, &[Input::of_game(vector)?])) {
        (None, Ok(info)) => {
            check_outcome(vector, &info.journal.bytes)?;
            Some(info)
        }
        (None, Err(error)) => return Err(error),
        (Some(_), Ok(_)) => return Err("verify guest accepted a rejected journal".into()),
        (Some(code), Err(error)) if rejection_code(&error).map(u64::from) == code => None,
        (Some(code), Err(error)) => {
            return Err(format!(
                "verify guest failed without replay's code {code:?}: {error}"
            ));
        }
    };
    Ok(Row {
        ending,
        verify,
        trace: Some(trace),
    })
}

fn execute_format(vector: &Value, fixtures: &FormatFixtures) -> Result<Row, String> {
    match run(VERIFY_ELF, &[fixtures.input(vector)?]) {
        Ok(info) => {
            check_format(vector, Ok(&info.journal.bytes))?;
            Ok(Row {
                ending: "accepted".into(),
                verify: Some(info),
                trace: None,
            })
        }
        Err(error) => {
            let code = rejection_code(&error).ok_or(format!(
                "verify guest failed without replay's code: {error}"
            ))?;
            check_format(vector, Err(code))?;
            Ok(Row {
                ending: format!("error {code}"),
                verify: None,
                trace: None,
            })
        }
    }
}

/// One `verifyRun`: six levels in one execution of the verify guest.
fn execute_run(paths: &[String]) -> Result<(), String> {
    if paths.len() != 6 {
        return Err(USAGE.into());
    }
    let (vectors, inputs) = read_games(paths)?;
    let info = run(VERIFY_ELF, &inputs)?;
    check_outcomes(&vectors, &info.journal.bytes)?;
    println!("=== BEGIN zk-run ===");
    println!("levels: {}", paths.join(" "));
    println!("user cycles: {}", info.cycles());
    println!("proving cycles: {}", proving_cycles(&info));
    println!("segments: {}", info.segments.len());
    println!("=== END zk-run ===");
    Ok(())
}

/// M1.10's random cases, as `jiro-tools difffuzz` writes them to `dir`, through both guests as
/// `execute` runs a game vector (plan M1.13). A case that disagrees with the native core's
/// results is copied to `dir/mismatch/`, named after the case, and its path printed.
fn difffuzz(args: &[String]) -> Result<(), String> {
    let [dir] = args else {
        return Err(USAGE.into());
    };
    let dir = Path::new(dir);
    let mismatch_dir = dir.join("mismatch");
    let cases: Vec<PathBuf> = vector_files(args)?
        .into_iter()
        .filter(|file| file.parent() == Some(dir))
        .collect();
    if cases.is_empty() {
        return Err(format!("{}: no cases", dir.display()));
    }
    let mut mismatches = 0;
    for file in &cases {
        let vector = read_vector(file)?;
        if let Err(error) = execute_game(&vector) {
            mismatches += 1;
            let name = vector["name"]
                .as_str()
                .ok_or(format!("{}: no name", file.display()))?;
            let saved = mismatch_dir.join(format!("{name}.json"));
            std::fs::create_dir_all(&mismatch_dir)
                .and_then(|()| std::fs::copy(file, &saved))
                .map_err(|error| format!("{}: {error}", saved.display()))?;
            println!("mismatch: {}: {error}", saved.display());
        }
    }
    println!(
        "zk executor: {} difffuzz cases, {mismatches} mismatches",
        cases.len()
    );
    match mismatches {
        0 => Ok(()),
        _ => Err(format!(
            "{mismatches} of {} cases disagree with native",
            cases.len()
        )),
    }
}

/// Executes a guest and requires it to halt with exit code 0.
fn run(elf: &[u8], inputs: &[Input]) -> Result<SessionInfo, String> {
    let info = default_executor()
        .execute(env(inputs, None)?, elf)
        .map_err(|error| format!("execution failed: {error:#}"))?;
    match info.exit_code {
        ExitCode::Halted(0) => Ok(info),
        code => Err(format!("guest exit code {code:?}")),
    }
}

/// The cycles the prover pays for: each segment padded to its power of two.
fn proving_cycles(info: &SessionInfo) -> u64 {
    info.segments
        .iter()
        .map(|segment| 1u64 << segment.po2)
        .sum()
}

/// The given files, and the vectors under the given directories, sorted per directory.
fn vector_files(paths: &[String]) -> Result<Vec<PathBuf>, String> {
    let mut files = Vec::new();
    for path in paths.iter().map(PathBuf::from) {
        collect_vectors(path, &mut files)?;
    }
    match files.is_empty() {
        true => Err("no vector files".into()),
        false => Ok(files),
    }
}

fn collect_vectors(path: PathBuf, files: &mut Vec<PathBuf>) -> Result<(), String> {
    if !path.is_dir() {
        files.push(path);
        return Ok(());
    }
    let mut entries = std::fs::read_dir(&path)
        .map_err(|error| format!("{}: {error}", path.display()))?
        .map(|entry| {
            entry
                .map(|entry| entry.path())
                .map_err(|error| error.to_string())
        })
        .collect::<Result<Vec<_>, _>>()?;
    entries.sort();
    for entry in entries {
        let is_vector = entry
            .extension()
            .is_some_and(|extension| extension == "json")
            && entry.file_name().is_some_and(|name| name != NOT_A_VECTOR);
        if entry.is_dir() || is_vector {
            collect_vectors(entry, files)?;
        }
    }
    Ok(())
}
