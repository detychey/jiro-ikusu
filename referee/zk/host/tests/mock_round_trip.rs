//! The dev-mode round trip: a mock Groth16 proof of the verify guest on `open-field-capture`,
//! verified against the program's verifying key and decoded to the vector's Outcome.

use std::path::Path;

use sp1_sdk::ProvingKey;
use sp1_sdk::blocking::{ProveRequest, Prover, ProverClient};
use zk_host::{VERIFY_ELF, check_outcome, read_vector, stdin};

#[test]
fn a_mock_proof_round_trips_to_the_vector_outcome() {
    let path =
        Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../vectors/game/open-field-capture.json");
    let vector = read_vector(&path).unwrap();
    let client = ProverClient::builder().mock().build();
    let pk = client.setup(VERIFY_ELF).unwrap();
    let proof = client
        .prove(&pk, stdin(&[&vector]).unwrap())
        .groth16()
        .run()
        .unwrap();
    client.verify(&proof, pk.verifying_key(), None).unwrap();
    check_outcome(&vector, proof.public_values.as_slice()).unwrap();
}
