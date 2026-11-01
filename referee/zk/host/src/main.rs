use std::path::{Path, PathBuf};
use std::time::Instant;

use risc0_zkvm::sha::Digest;
use risc0_zkvm::{ExitCode, ProverOpts, SessionInfo, default_executor, default_prover};
use serde_json::Value;
use zk_host::{
    OUTCOME_LEN, TRACE_ELF, TRACED_LEN, VERIFY_ELF, VERIFY_ID, check_outcome, check_traced, env,
    read_vector,
};

const USAGE: &str = "usage: zk-host execute <vector file or directory>...
       zk-host execute-run <six vector files>
       zk-host prove <composite|succinct|groth16> <vector file> [segment po2]";

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let result = match args.split_first() {
        Some((command, rest)) if command == "execute" => execute(rest),
        Some((command, rest)) if command == "execute-run" => execute_run(rest),
        Some((command, rest)) if command == "prove" => prove(rest),
        _ => Err(USAGE.into()),
    };
    if let Err(error) = result {
        eprintln!("zk-host: {error}");
        std::process::exit(1);
    }
}

/// Every game vector through both guests: the trace guest must reproduce the vector's error code,
/// `traceKeccak` and Outcome, and the verify guest its Outcome, or panic with replay's error code
/// on a rejected journal.
fn execute(paths: &[String]) -> Result<(), String> {
    let files = vector_files(paths)?;
    let mut failures = 0;
    println!("=== BEGIN zk-exec ===");
    println!(
        "| vector | result | ticks used or error | user cycles | proving cycles | segments | trace-guest user cycles |"
    );
    println!("|---|---|---|---|---|---|---|");
    for file in &files {
        let vector = read_vector(file)?;
        let name = file
            .file_stem()
            .map_or_else(String::new, |stem| stem.to_string_lossy().into_owned());
        let ending = vector["outcome"]["ticksUsed"].as_u64().map_or_else(
            || format!("error {}", vector["error"]),
            |ticks| ticks.to_string(),
        );
        match execute_one(&vector) {
            Ok((verify, trace)) => println!(
                "| {name} | PASS | {ending} | {} | {} | {} | {} |",
                verify.as_ref().map_or_else(|| "rejected".into(), |info| info.cycles().to_string()),
                verify.as_ref().map_or_else(String::new, |info| proving_cycles(info).to_string()),
                verify.as_ref().map_or_else(String::new, |info| info.segments.len().to_string()),
                trace.cycles()
            ),
            Err(error) => {
                failures += 1;
                println!("| {name} | FAIL: {error} | {ending} | | | | |");
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

/// The verify guest's session, `None` for a rejected journal, and the trace guest's session.
fn execute_one(vector: &Value) -> Result<(Option<SessionInfo>, SessionInfo), String> {
    let trace = run(TRACE_ELF, &[vector])?;
    if trace.journal.bytes.len() != TRACED_LEN {
        return Err(format!(
            "trace guest committed {} bytes",
            trace.journal.bytes.len()
        ));
    }
    check_traced(vector, &trace.journal.bytes)?;
    match (vector.get("error"), run(VERIFY_ELF, &[vector])) {
        (None, Ok(info)) => {
            check_outcome(vector, &info.journal.bytes)?;
            Ok((Some(info), trace))
        }
        (None, Err(error)) => Err(error),
        (Some(_), Ok(_)) => Err("verify guest accepted a rejected journal".into()),
        (Some(code), Err(error)) if error.contains(&format!("replay rejects: code {code}")) => {
            Ok((None, trace))
        }
        (Some(code), Err(error)) => Err(format!(
            "verify guest failed without replay's code {code}: {error}"
        )),
    }
}

/// One `verifyRun`: six levels in one execution of the verify guest.
fn execute_run(paths: &[String]) -> Result<(), String> {
    if paths.len() != 6 {
        return Err(USAGE.into());
    }
    let vectors = paths
        .iter()
        .map(|path| read_vector(Path::new(path)))
        .collect::<Result<Vec<_>, _>>()?;
    let vectors: Vec<&Value> = vectors.iter().collect();
    let info = run(VERIFY_ELF, &vectors)?;
    if info.journal.bytes.len() != 6 * OUTCOME_LEN {
        return Err(format!(
            "verify guest committed {} bytes",
            info.journal.bytes.len()
        ));
    }
    for ((path, vector), words) in paths
        .iter()
        .zip(&vectors)
        .zip(info.journal.bytes.chunks(OUTCOME_LEN))
    {
        check_outcome(vector, words).map_err(|error| format!("{path}: {error}"))?;
    }
    println!("=== BEGIN zk-run ===");
    println!("levels: {}", paths.join(" "));
    println!("user cycles: {}", info.cycles());
    println!("proving cycles: {}", proving_cycles(&info));
    println!("segments: {}", info.segments.len());
    println!("=== END zk-run ===");
    Ok(())
}

/// Proves one level with the verify guest on the CPU, verifies the receipt, and prints the
/// timings and this process's peak resident memory. Groth16 runs RISC Zero's Docker prover.
fn prove(args: &[String]) -> Result<(), String> {
    let (mode, file, segment_po2) = match args {
        [mode, file] => (mode, file, None),
        [mode, file, po2] => (mode, file, Some(po2.parse().map_err(|_| USAGE)?)),
        _ => return Err(USAGE.into()),
    };
    let opts = match mode.as_str() {
        "composite" => ProverOpts::composite(),
        "succinct" => ProverOpts::succinct(),
        "groth16" => ProverOpts::groth16(),
        _ => return Err(USAGE.into()),
    };
    let vector = read_vector(Path::new(file))?;
    let started = Instant::now();
    let info = default_prover()
        .prove_with_opts(env(&[&vector], segment_po2)?, VERIFY_ELF, &opts)
        .map_err(|error| format!("proving failed: {error:#}"))?;
    let prove_seconds = started.elapsed().as_secs_f64();
    info.receipt
        .verify(VERIFY_ID)
        .map_err(|error| format!("verification failed: {error}"))?;
    check_outcome(&vector, &info.receipt.journal.bytes)?;
    println!("=== BEGIN zk-prove ===");
    println!("vector: {file}");
    println!("mode: {mode}");
    println!("segment po2 limit: {segment_po2:?}");
    println!(
        "segments: {}, total cycles: {}, user cycles: {}, paging cycles: {}",
        info.stats.segments,
        info.stats.total_cycles,
        info.stats.user_cycles,
        info.stats.paging_cycles
    );
    println!("prove: {prove_seconds:.1} s");
    println!("verified: yes");
    println!("seal: {} bytes", info.receipt.seal_size());
    println!("image id: {}", Digest::from(VERIFY_ID));
    println!("peak RSS of this process (VmHWM): {}", peak_rss()?);
    if let Ok(groth16) = info.receipt.inner.groth16() {
        println!("groth16 seal: 0x{}", hex::encode(&groth16.seal));
        println!("verifier parameters: {}", groth16.verifier_parameters);
        println!("journal: 0x{}", hex::encode(&info.receipt.journal.bytes));
    }
    println!("=== END zk-prove ===");
    Ok(())
}

/// Executes a guest and requires it to halt with exit code 0.
fn run(elf: &[u8], vectors: &[&Value]) -> Result<SessionInfo, String> {
    let info = default_executor()
        .execute(env(vectors, None)?, elf)
        .map_err(|error| format!("execution failed: {error:#}"))?;
    match info.exit_code {
        ExitCode::Halted(0) => Ok(info),
        code => Err(format!("guest exit code {code:?}")),
    }
}

/// The cycles the prover pays for: each segment padded to its power of two.
fn proving_cycles(info: &SessionInfo) -> u64 {
    info.segments.iter().map(|segment| 1u64 << segment.po2).sum()
}

fn vector_files(paths: &[String]) -> Result<Vec<PathBuf>, String> {
    let mut files = Vec::new();
    for path in paths.iter().map(PathBuf::from) {
        if path.is_dir() {
            let entries =
                std::fs::read_dir(&path).map_err(|error| format!("{}: {error}", path.display()))?;
            let mut jsons = entries
                .map(|entry| {
                    entry
                        .map(|entry| entry.path())
                        .map_err(|error| error.to_string())
                })
                .collect::<Result<Vec<_>, _>>()?;
            jsons.retain(|file| {
                file.extension()
                    .is_some_and(|extension| extension == "json")
            });
            jsons.sort();
            files.extend(jsons);
        } else {
            files.push(path);
        }
    }
    match files.is_empty() {
        true => Err("no vector files".into()),
        false => Ok(files),
    }
}

fn peak_rss() -> Result<String, String> {
    let status = std::fs::read_to_string("/proc/self/status").map_err(|error| error.to_string())?;
    status
        .lines()
        .find_map(|line| line.strip_prefix("VmHWM:"))
        .map(|value| value.trim().to_string())
        .ok_or_else(|| "no VmHWM in /proc/self/status".into())
}
