//! The dev-mode round trip: a fake Groth16 receipt of the verify guest on `open-field-capture`,
//! verified against the program's image id in dev mode and decoded to the vector's Outcome.

use std::path::Path;

use risc0_zkvm::{ProverOpts, VerifierContext, default_prover};
use zk_host::{VERIFY_ELF, VERIFY_ID, check_outcome, env, read_vector};

#[test]
fn a_dev_mode_receipt_round_trips_to_the_vector_outcome() {
    let path =
        Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../vectors/game/open-field-capture.json");
    let vector = read_vector(&path).unwrap();
    let info = default_prover()
        .prove_with_opts(
            env(&[&vector], None).unwrap(),
            VERIFY_ELF,
            &ProverOpts::groth16().with_dev_mode(true),
        )
        .unwrap();
    info.receipt
        .verify_with_context(&VerifierContext::default().with_dev_mode(true), VERIFY_ID)
        .unwrap();
    check_outcome(&vector, &info.receipt.journal.bytes).unwrap();
}
