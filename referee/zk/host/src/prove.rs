//! `zk-host prove`: a real proof of the verify guest on the CPU, in level mode (one level, for
//! `verify`) or run mode (six levels, for `verifyRun`), wrapped into the Groth16 seal that RISC
//! Zero's verifier contract checks (README §7.3). The segment proofs and their recursion run in
//! this process; the Groth16 step runs RISC Zero's prover image in Docker. The measurements and
//! the proof fixture are printed between log markers (plan §1.3).

use std::time::Instant;

use risc0_zkvm::sha::{Digest, Digestible};
use risc0_zkvm::{ProverOpts, default_prover};
use serde_json::json;
use zk_host::{VERIFY_ELF, VERIFY_ID, check_outcomes, env, read_games};

use crate::USAGE;

/// The router's seal is the verifier selector, the first four bytes of the verifier parameters'
/// digest, followed by the Groth16 seal (risc0-ethereum's `encode_seal`).
const SELECTOR_LEN: usize = 4;

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
    let (mode, files) = match args {
        [flag, file @ ..] if flag == "--level" && file.len() == 1 => ("level", file),
        [flag, files @ ..] if flag == "--run" && files.len() == 6 => ("run", files),
        _ => return Err(USAGE.into()),
    };
    let (vectors, inputs) = read_games(files)?;
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
    check_outcomes(&vectors, public_values)?;
    let groth16_receipt = groth16
        .inner
        .groth16()
        .map_err(|error| format!("not a Groth16 receipt: {error}"))?;
    let selector = &groth16_receipt.verifier_parameters.as_bytes()[..SELECTOR_LEN];
    let seal = [selector, groth16_receipt.seal.as_slice()].concat();
    let image_id = format!("0x{}", Digest::from(VERIFY_ID));
    let stats = &composite.stats;
    println!("=== BEGIN zk-prove ===");
    println!("mode: {mode}");
    println!("vectors: {}", files.join(" "));
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
        hex::encode(selector)
    );
    println!(
        "public values: {} bytes, sha256 0x{}",
        public_values.len(),
        groth16.journal.digest()
    );
    println!("verified: yes");
    println!("=== END zk-prove ===");
    println!("=== BEGIN zk-fixture ===");
    println!(
        "{}",
        json!({
            "mode": mode,
            "vectors": files,
            "imageId": image_id,
            "seal": format!("0x{}", hex::encode(&seal)),
            "publicValues": format!("0x{}", hex::encode(public_values)),
        })
    );
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
