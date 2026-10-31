use std::path::{Path, PathBuf};
use std::time::Instant;

use serde_json::Value;
use sp1_sdk::blocking::{ProveRequest, Prover, ProverClient};
use sp1_sdk::{ExecutionReport, HashableKey, ProvingKey, SP1ProofMode, SP1PublicValues};
use zk_host::{
    OUTCOME_LEN, TRACE_ELF, TRACED_LEN, VERIFY_ELF, check_outcome, check_traced, read_vector, stdin,
};

const USAGE: &str = "usage: zk-host execute <vector file or directory>...
       zk-host execute-run <six vector files>
       zk-host prove <core|compressed|plonk|groth16> <vector file>";

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
/// `traceKeccak` and Outcome, and the verify guest its Outcome, or halt on a rejected journal.
fn execute(paths: &[String]) -> Result<(), String> {
    let files = vector_files(paths)?;
    let client = ProverClient::builder().mock().build();
    let mut failures = 0;
    println!("=== BEGIN zk-exec ===");
    println!(
        "| vector | result | ticks used or error | cycles | prover gas | trace-guest cycles |"
    );
    println!("|---|---|---|---|---|---|");
    for file in &files {
        let vector = read_vector(file)?;
        let name = file
            .file_stem()
            .map_or_else(String::new, |stem| stem.to_string_lossy().into_owned());
        let ending = vector["outcome"]["ticksUsed"].as_u64().map_or_else(
            || format!("error {}", vector["error"]),
            |ticks| ticks.to_string(),
        );
        match execute_one(&client, &vector) {
            Ok((report, trace_report)) => println!(
                "| {name} | PASS | {ending} | {} | {} | {} |",
                report.total_instruction_count(),
                gas(&report)?,
                trace_report.total_instruction_count()
            ),
            Err(error) => {
                failures += 1;
                println!("| {name} | FAIL: {error} | {ending} | | | |");
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

fn execute_one(
    client: &impl Prover,
    vector: &Value,
) -> Result<(ExecutionReport, ExecutionReport), String> {
    let (traced, trace_report) = run(client, TRACE_ELF, &[vector])?;
    if trace_report.exit_code != 0 {
        return Err(format!("trace guest exit code {}", trace_report.exit_code));
    }
    if traced.as_slice().len() != TRACED_LEN {
        return Err(format!(
            "trace guest committed {} bytes",
            traced.as_slice().len()
        ));
    }
    check_traced(vector, traced.as_slice())?;
    let (values, report) = run(client, VERIFY_ELF, &[vector])?;
    match (vector.get("error"), report.exit_code) {
        (None, 0) => check_outcome(vector, values.as_slice())?,
        (Some(_), 0) => return Err("verify guest accepted a rejected journal".into()),
        (Some(_), _) if values.as_slice().is_empty() => {}
        (Some(_), _) => return Err("verify guest committed values before halting".into()),
        (None, code) => return Err(format!("verify guest exit code {code}")),
    }
    Ok((report, trace_report))
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
    let client = ProverClient::builder().mock().build();
    let (values, report) = run(&client, VERIFY_ELF, &vectors)?;
    if report.exit_code != 0 {
        return Err(format!("verify guest exit code {}", report.exit_code));
    }
    if values.as_slice().len() != 6 * OUTCOME_LEN {
        return Err(format!(
            "verify guest committed {} bytes",
            values.as_slice().len()
        ));
    }
    for ((path, vector), words) in paths
        .iter()
        .zip(&vectors)
        .zip(values.as_slice().chunks(OUTCOME_LEN))
    {
        check_outcome(vector, words).map_err(|error| format!("{path}: {error}"))?;
    }
    println!("=== BEGIN zk-run ===");
    println!("levels: {}", paths.join(" "));
    println!("cycles: {}", report.total_instruction_count());
    println!("prover gas: {}", gas(&report)?);
    println!("=== END zk-run ===");
    Ok(())
}

/// Proves one level with the verify guest on the CPU, verifies the proof, and prints the timings
/// and this process's peak resident memory.
fn prove(args: &[String]) -> Result<(), String> {
    let [mode, file] = args else {
        return Err(USAGE.into());
    };
    let mode = match mode.as_str() {
        "core" => SP1ProofMode::Core,
        "compressed" => SP1ProofMode::Compressed,
        "plonk" => SP1ProofMode::Plonk,
        "groth16" => SP1ProofMode::Groth16,
        _ => return Err(USAGE.into()),
    };
    let vector = read_vector(Path::new(file))?;
    let client = ProverClient::builder().cpu().build();
    let started = Instant::now();
    let pk = client
        .setup(VERIFY_ELF)
        .map_err(|error| error.to_string())?;
    let setup_seconds = started.elapsed().as_secs_f64();
    let started = Instant::now();
    let proof = client
        .prove(&pk, stdin(&[&vector])?)
        .mode(mode)
        .run()
        .map_err(|error| error.to_string())?;
    let prove_seconds = started.elapsed().as_secs_f64();
    client
        .verify(&proof, pk.verifying_key(), None)
        .map_err(|error| error.to_string())?;
    check_outcome(&vector, proof.public_values.as_slice())?;
    let serialized = bincode_size(&proof)?;
    println!("=== BEGIN zk-prove ===");
    println!("vector: {file}");
    println!("mode: {mode:?}");
    println!("setup: {setup_seconds:.1} s");
    println!("prove: {prove_seconds:.1} s");
    println!("verified: yes");
    println!("serialized proof: {serialized} bytes");
    println!("program vkey: {}", pk.verifying_key().bytes32());
    println!("peak RSS of this process (VmHWM): {}", peak_rss()?);
    if matches!(mode, SP1ProofMode::Plonk | SP1ProofMode::Groth16) {
        println!("onchain proof bytes: 0x{}", hex::encode(proof.bytes()));
        println!(
            "public values: 0x{}",
            hex::encode(proof.public_values.as_slice())
        );
    }
    println!("=== END zk-prove ===");
    Ok(())
}

fn run(
    client: &impl Prover,
    elf: sp1_sdk::Elf,
    vectors: &[&Value],
) -> Result<(SP1PublicValues, ExecutionReport), String> {
    client
        .execute(elf, stdin(vectors)?)
        .calculate_gas(true)
        .run()
        .map_err(|error| format!("execution failed: {error}"))
}

fn gas(report: &ExecutionReport) -> Result<u64, String> {
    report
        .gas()
        .ok_or_else(|| "the executor computed no prover gas".into())
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

fn bincode_size(proof: &sp1_sdk::SP1ProofWithPublicValues) -> Result<u64, String> {
    let path = std::env::temp_dir().join(format!("zk-host-proof-{}.bin", std::process::id()));
    proof.save(&path).map_err(|error| error.to_string())?;
    let size = std::fs::metadata(&path)
        .map_err(|error| error.to_string())?
        .len();
    std::fs::remove_file(&path).map_err(|error| error.to_string())?;
    Ok(size)
}

fn peak_rss() -> Result<String, String> {
    let status = std::fs::read_to_string("/proc/self/status").map_err(|error| error.to_string())?;
    status
        .lines()
        .find_map(|line| line.strip_prefix("VmHWM:"))
        .map(|value| value.trim().to_string())
        .ok_or_else(|| "no VmHWM in /proc/self/status".into())
}
