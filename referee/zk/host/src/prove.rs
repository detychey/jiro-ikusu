//! `zk-host prove`: a real proof of the verify guest on the CPU, in level mode (one level, for
//! `verify`) or run mode (six levels, for `verifyRun`), wrapped into the Groth16 seal that RISC
//! Zero's verifier contract checks (README §7.3). The segment proofs and their recursion run in
//! this process; the Groth16 step runs RISC Zero's prover image in Docker. With `RISC0_DEV_MODE=1`
//! the receipt is fake, and its seal is the one RISC Zero's mock verifier contract checks. The
//! measurements and the proof fixture are printed between log markers (plan §1.3).

use std::path::Path;
use std::time::Instant;

use risc0_zkvm::sha::{Digest, Digestible};
use risc0_zkvm::{InnerReceipt, ProverOpts, default_prover};
use serde_json::json;
use zk_host::{
    OUTCOME_FIELDS, RUN_FIELDS, VERIFY_ELF, VERIFY_ID, check_levels, env, read_games, read_run,
};

use crate::{USAGE, run};

/// The router's seal is the verifier selector, the first four bytes of the verifier parameters'
/// digest, followed by the Groth16 seal; a fake receipt's is the mock selector followed by the
/// claim's digest (risc0-ethereum's `encode_seal`).
const SELECTOR_LEN: usize = 4;
const MOCK_SELECTOR: [u8; SELECTOR_LEN] = [0xff; SELECTOR_LEN];

pub fn prove(args: &[String]) -> Result<(), String> {
    let (args, segment_limit_po2) = match args {
        [rest @ .., flag, po2] if flag == "--segment-po2" => {
            let po2 = po2
                .parse()
                .map_err(|_| format!("--segment-po2 {po2}: not a whole number"))?;
            (rest, Some(po2))
        }
        _ => (args, None),
    };
    let (mode, (records, inputs), fields, given) = match args {
        [flag, run_file, season_flag, season] if flag == "--run" && season_flag == "--season" => (
            "run",
            read_run(Path::new(run_file), Path::new(season))?,
            &RUN_FIELDS[..],
            json!({ "runFile": run_file, "season": season }),
        ),
        [flag, file @ ..] if flag == "--level" && file.len() == 1 => (
            "level",
            read_games(file)?,
            &OUTCOME_FIELDS[..],
            json!({ "vectors": file }),
        ),
        [flag, files @ ..] if flag == "--run" && files.len() == 6 => (
            "run",
            read_games(files)?,
            &OUTCOME_FIELDS[..],
            json!({ "vectors": files }),
        ),
        _ => return Err(USAGE.into()),
    };
    // The executor checks the inputs in seconds, before the hour of proving.
    check_levels(&records, &run(VERIFY_ELF, &inputs)?.journal.bytes, fields)?;
    let prover = default_prover();
    let started = Instant::now();
    let composite = prover
        .prove_with_opts(
            env(&inputs, segment_limit_po2)?,
            VERIFY_ELF,
            &ProverOpts::composite(),
        )
        .map_err(|error| format!("segment proving failed: {error:#}"))?;
    let composite_seconds = started.elapsed().as_secs_f64();
    let succinct = prover
        .compress(&ProverOpts::succinct(), &composite.receipt)
        .map_err(|error| format!("recursion failed: {error:#}"))?;
    let succinct_seconds = started.elapsed().as_secs_f64() - composite_seconds;
    let groth16 = prover
        .compress(&ProverOpts::groth16(), &succinct)
        .map_err(|error| format!("Groth16 wrapping failed: {error:#}"))?;
    let total_seconds = started.elapsed().as_secs_f64();
    groth16
        .verify(VERIFY_ID)
        .map_err(|error| format!("the Groth16 receipt does not verify: {error}"))?;
    let public_values = &groth16.journal.bytes;
    check_levels(&records, public_values, fields)?;
    let seal = match &groth16.inner {
        InnerReceipt::Groth16(receipt) => [
            &receipt.verifier_parameters.as_bytes()[..SELECTOR_LEN],
            receipt.seal.as_slice(),
        ]
        .concat(),
        InnerReceipt::Fake(receipt) => {
            [&MOCK_SELECTOR[..], receipt.claim.digest().as_bytes()].concat()
        }
        _ => return Err("neither a Groth16 nor a dev-mode receipt".into()),
    };
    let image_id = format!("0x{}", Digest::from(VERIFY_ID));
    let stats = &composite.stats;
    println!("=== BEGIN zk-prove ===");
    println!("mode: {mode}");
    println!("inputs: {given}");
    println!("image id: {image_id}");
    println!(
        "segment limit: 2^{}",
        segment_limit_po2.map_or_else(|| "20 (default)".into(), |po2: u32| po2.to_string())
    );
    println!(
        "segments: {}, total cycles: {}, user cycles: {}, paging cycles: {}",
        stats.segments, stats.total_cycles, stats.user_cycles, stats.paging_cycles
    );
    println!("segment proofs: {composite_seconds:.1} s");
    println!("recursion to one succinct receipt: {succinct_seconds:.1} s");
    println!(
        "Groth16 wrapping: {:.1} s",
        total_seconds - composite_seconds - succinct_seconds
    );
    println!("total: {total_seconds:.1} s");
    println!("peak RSS of this process (VmHWM): {}", peak_rss()?);
    println!(
        "seal: {} bytes, selector 0x{}",
        seal.len(),
        hex::encode(&seal[..SELECTOR_LEN])
    );
    println!(
        "public values: {} bytes, sha256 0x{}",
        public_values.len(),
        groth16.journal.digest()
    );
    println!("verified: yes");
    println!("=== END zk-prove ===");
    println!("=== BEGIN zk-fixture ===");
    let mut fixture = given;
    fixture["mode"] = json!(mode);
    fixture["imageId"] = json!(image_id);
    fixture["seal"] = json!(format!("0x{}", hex::encode(&seal)));
    fixture["publicValues"] = json!(format!("0x{}", hex::encode(public_values)));
    println!("{fixture}");
    println!("=== END zk-fixture ===");
    Ok(())
}

/// This process's peak resident memory; the Docker container of the Groth16 step is measured
/// from outside, by peak-memory.sh.
fn peak_rss() -> Result<String, String> {
    let status = std::fs::read_to_string("/proc/self/status").map_err(|error| error.to_string())?;
    status
        .lines()
        .find_map(|line| line.strip_prefix("VmHWM:"))
        .map(|value| value.trim().to_string())
        .ok_or_else(|| "no VmHWM in /proc/self/status".into())
}
