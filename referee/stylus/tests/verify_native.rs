//! The Stylus referee through stylus-test's TestVM (plan M4.1), which runs the contract's code
//! natively; M4.2 runs its wasm build. Every vector of vectors/ and the 200 fixed difffuzz cases
//! of M1.10 replay to their recorded Outcome, or revert with their recorded code. The cases are
//! generated first, and this test fails without them:
//! `cargo run -p jiro-tools --release --locked -- difffuzz --seed 1 --cases 200 --out target/difffuzz`.

use std::path::{Path, PathBuf};

use jiro_core::consts::{RULES_VERSION, RUN_LEVELS};
use jiro_referee_stylus::{Outcome, Referee};
use serde_json::{Value, json};
use stylus_sdk::abi::Bytes;
use stylus_sdk::alloy_sol_types::{Revert, SolError};
use stylus_sdk::testing::*;

const FULL_WEIGHT: u16 = 10_000;
const LEVEL_ID_AT: usize = 36;

fn repo() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")
}

/// The JSON files of `dir`, by name.
fn json_files(dir: &Path) -> Vec<(String, Value)> {
    let mut files: Vec<(String, Value)> = std::fs::read_dir(dir)
        .unwrap_or_else(|error| panic!("{}: {error}", dir.display()))
        .map(|entry| entry.expect("entry").path())
        .filter(|path| path.extension().is_some_and(|ext| ext == "json"))
        .map(|path| {
            let name = path
                .file_name()
                .expect("name")
                .to_string_lossy()
                .into_owned();
            let text = std::fs::read_to_string(&path).expect("read");
            (name, serde_json::from_str(&text).expect("JSON"))
        })
        .collect();
    files.sort_by(|a, b| a.0.cmp(&b.0));
    files
}

fn vectors(kind: &str) -> Vec<(String, Value)> {
    json_files(&repo().join("vectors").join(kind))
}

fn format_vector(name: &str) -> Value {
    vectors("format")
        .into_iter()
        .find(|(file, _)| file == &format!("{name}.json"))
        .unwrap_or_else(|| panic!("vectors/format/{name}.json not found"))
        .1
}

fn bytes(hex: &Value) -> Vec<u8> {
    let hex = hex.as_str().expect("a hex string");
    let digits = hex.strip_prefix("0x").expect("0x prefix");
    (0..digits.len())
        .step_by(2)
        .map(|at| u8::from_str_radix(&digits[at..at + 2], 16).expect("hex digit"))
        .collect()
}

fn hex(bytes: &[u8]) -> String {
    let digits: String = bytes.iter().map(|byte| format!("{byte:02x}")).collect();
    format!("0x{digits}")
}

fn weight(vector: &Value) -> u16 {
    u16::try_from(vector["weightBp"].as_u64().expect("weightBp")).expect("a u16 weight")
}

/// The Outcome as a vector records it (README §6.6, §7.3).
fn recorded(outcome: &Outcome) -> Value {
    json!({
        "journalHash": hex(outcome.0.as_slice()),
        "levelId": hex(outcome.1.as_slice()),
        "runNonce": hex(outcome.2.as_slice()),
        "levelIndex": outcome.3,
        "drawSlot": outcome.4,
        "mode": outcome.5,
        "rulesVersion": outcome.6,
        "endReason": outcome.7,
        "claimBp": outcome.8,
        "ticksUsed": outcome.9,
        "levelScore": outcome.10,
    })
}

/// The reason of a revert, which must be Solidity's `Error(string)`.
fn reason(data: &[u8]) -> String {
    assert_eq!(
        data.get(..4),
        Some(Revert::SELECTOR.as_slice()),
        "revert data {data:02x?}"
    );
    Revert::abi_decode(data).expect("an Error(string)").reason
}

fn verify(level: &[u8], journal: &[u8], weight_bp: u16) -> Result<Outcome, String> {
    let vm = TestVM::default();
    Referee::from(&vm)
        .verify(
            level.to_vec().into(),
            journal.to_vec().into(),
            weight_bp,
            Bytes::default(),
        )
        .map_err(|data| reason(&data))
}

/// A journal that decodes, made to name `level_id`.
fn journal_for(level_id: &[u8]) -> Vec<u8> {
    let mut journal = bytes(&format_vector("journal-open-field-empty")["input"]);
    journal[LEVEL_ID_AT..LEVEL_ID_AT + 32].copy_from_slice(level_id);
    journal
}

/// The six level, journal and weight inputs of the first six played game vectors.
fn six_games() -> Vec<Value> {
    vectors("game")
        .into_iter()
        .map(|(_, vector)| vector)
        .filter(|vector| vector.get("outcome").is_some())
        .take(RUN_LEVELS)
        .collect()
}

fn verify_run(games: &[Value]) -> Result<[Outcome; RUN_LEVELS], String> {
    let vm = TestVM::default();
    let input = |field: &str| -> [Bytes; RUN_LEVELS] {
        std::array::from_fn(|i| bytes(&games[i][field]).into())
    };
    Referee::from(&vm)
        .verify_run(
            input("level"),
            input("journal"),
            std::array::from_fn(|i| weight(&games[i])),
            Bytes::default(),
        )
        .map_err(|data| reason(&data))
}

#[test]
fn every_game_vector_verifies_to_its_outcome_or_reverts_with_its_code() {
    let games = vectors("game");
    for (name, vector) in &games {
        let result = verify(
            &bytes(&vector["level"]),
            &bytes(&vector["journal"]),
            weight(vector),
        );
        match vector.get("error") {
            None => assert_eq!(
                result.map(|o| recorded(&o)).as_ref(),
                Ok(&vector["outcome"]),
                "{name}"
            ),
            Some(code) => assert_eq!(
                result.map(|_| ()),
                Err(format!("replay error {code}")),
                "{name}"
            ),
        }
    }
    assert_eq!(games.len(), 43, "vectors/game holds 43 vectors");
}

#[test]
fn every_malformed_journal_vector_reverts_with_its_code() {
    let open_field = bytes(&format_vector("level-open-field")["input"]);
    let malformed: Vec<(String, Value)> = vectors("format")
        .into_iter()
        .filter(|(name, vector)| name.starts_with("journal-") && vector.get("error").is_some())
        .collect();
    for (name, vector) in &malformed {
        let result = verify(&open_field, &bytes(&vector["input"]), FULL_WEIGHT);
        assert_eq!(
            result.map(|_| ()),
            Err(format!("replay error {}", vector["error"])),
            "{name}"
        );
    }
    assert_eq!(
        malformed.len(),
        15,
        "vectors/format holds 15 malformed journals"
    );
}

#[test]
fn every_valid_journal_vector_passes_the_decoder() {
    let open_field = bytes(&format_vector("level-open-field")["input"]);
    let decoder_codes: Vec<String> = (1..=11)
        .map(|code| format!("replay error {code}"))
        .collect();
    for (name, vector) in vectors("format") {
        if !name.starts_with("journal-") || vector.get("error").is_some() {
            continue;
        }
        if let Err(reason) = verify(&open_field, &bytes(&vector["input"]), FULL_WEIGHT) {
            assert!(!decoder_codes.contains(&reason), "{name}: {reason}");
        }
    }
}

#[test]
fn every_malformed_level_vector_reverts_with_its_code() {
    let journal = bytes(&format_vector("journal-open-field-empty")["input"]);
    let malformed: Vec<(String, Value)> = vectors("format")
        .into_iter()
        .filter(|(name, vector)| name.starts_with("level-") && vector.get("error").is_some())
        .collect();
    for (name, vector) in &malformed {
        let result = verify(&bytes(&vector["input"]), &journal, FULL_WEIGHT);
        assert_eq!(
            result.map(|_| ()),
            Err(format!("replay error {}", vector["error"])),
            "{name}"
        );
    }
    assert_eq!(
        malformed.len(),
        25,
        "vectors/format holds 25 malformed levels"
    );
}

#[test]
fn every_valid_level_vector_verifies_under_its_level_id() {
    for (name, vector) in vectors("format") {
        if !name.starts_with("level-") || vector.get("error").is_some() {
            continue;
        }
        let level_id = bytes(&vector["levelId"]);
        let outcome = verify(
            &bytes(&vector["input"]),
            &journal_for(&level_id),
            FULL_WEIGHT,
        )
        .unwrap_or_else(|reason| panic!("{name}: {reason}"));
        assert_eq!(outcome.1.as_slice(), level_id.as_slice(), "{name}");
    }
}

#[test]
fn every_fixed_difffuzz_case_verifies_to_its_outcome() {
    let dir = repo().join("target/difffuzz");
    assert!(
        dir.is_dir(),
        "{} is missing: run `cargo run -p jiro-tools --release --locked -- difffuzz --seed 1 \
         --cases 200 --out target/difffuzz` first",
        dir.display()
    );
    let cases = json_files(&dir);
    for (name, case) in &cases {
        let outcome = verify(
            &bytes(&case["level"]),
            &bytes(&case["journal"]),
            weight(case),
        )
        .unwrap_or_else(|reason| panic!("{name}: {reason}"));
        assert_eq!(recorded(&outcome), case["outcome"], "{name}");
    }
    assert_eq!(cases.len(), 200, "the fixed set holds 200 cases");
}

#[test]
fn verify_run_returns_the_outcomes_of_six_game_vectors() {
    let games = six_games();
    let outcomes = verify_run(&games).expect("six played games");
    let expected: Vec<Value> = games.iter().map(|game| game["outcome"].clone()).collect();
    assert_eq!(outcomes.iter().map(recorded).collect::<Vec<_>>(), expected);
}

#[test]
fn verify_run_reverts_with_the_index_of_a_rejected_level() {
    let mut games = six_games();
    games[4]["journal"] = json!("0x01");
    assert_eq!(
        verify_run(&games),
        Err("level 4: replay error 1".to_string())
    );
}

#[test]
fn verify_reverts_on_a_non_empty_proof() {
    let game = &six_games()[0];
    let vm = TestVM::default();
    let result = Referee::from(&vm).verify(
        bytes(&game["level"]).into(),
        bytes(&game["journal"]).into(),
        weight(game),
        vec![0].into(),
    );
    assert_eq!(
        result.map_err(|data| reason(&data)),
        Err("proof not empty".to_string())
    );
}

#[test]
fn verify_run_reverts_on_a_non_empty_proof() {
    let games = six_games();
    let vm = TestVM::default();
    let input = |field: &str| -> [Bytes; RUN_LEVELS] {
        std::array::from_fn(|i| bytes(&games[i][field]).into())
    };
    let result = Referee::from(&vm).verify_run(
        input("level"),
        input("journal"),
        std::array::from_fn(|i| weight(&games[i])),
        vec![0].into(),
    );
    assert_eq!(
        result.map_err(|data| reason(&data)),
        Err("proof not empty".to_string())
    );
}

#[test]
fn rules_version_is_the_core_s() {
    let vm = TestVM::default();
    assert_eq!(Referee::from(&vm).rules_version(), RULES_VERSION);
}
