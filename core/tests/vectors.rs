//! Every format vector of vectors/format/ (README §6.6) against the core: a malformed input is
//! rejected with its recorded code, and a valid one re-encodes to its recorded bytes, which are
//! its input (encode(decode(x)) == x).

use std::path::PathBuf;

use jiro_core::consts::{CAPTURE_STACK, MAX_JOURNAL_LEN};
use jiro_core::journal::{self, Event};
use jiro_core::level::{self, level_id};
use serde_json::Value;

fn format_vectors() -> Vec<(String, Value)> {
    let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../vectors/format");
    let mut vectors: Vec<(String, Value)> = std::fs::read_dir(&dir)
        .unwrap()
        .map(|entry| entry.unwrap().path())
        .filter(|path| path.extension().is_some_and(|ext| ext == "json"))
        .map(|path| {
            let name = path.file_name().unwrap().to_string_lossy().into_owned();
            let text = std::fs::read_to_string(&path).unwrap();
            (name, serde_json::from_str(&text).unwrap())
        })
        .collect();
    vectors.sort_by(|a, b| a.0.cmp(&b.0));
    vectors
}

fn bytes(value: &Value) -> Vec<u8> {
    let hex = value.as_str().unwrap().strip_prefix("0x").unwrap();
    (0..hex.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&hex[i..i + 2], 16).unwrap())
        .collect()
}

/// The `error` code a vector records, or None for a valid vector.
fn recorded_error(vector: &Value) -> Option<u8> {
    vector
        .get("error")
        .map(|code| u8::try_from(code.as_u64().unwrap()).unwrap())
}

fn check_journal(file: &str, vector: &Value) {
    let input = bytes(&vector["input"]);
    match (journal::decode(&input), recorded_error(vector)) {
        (Err(error), Some(code)) => assert_eq!(error.code(), code, "{file}: field error"),
        (Ok(decoded), None) => {
            let events: Vec<Event> = decoded.events().collect();
            let mut out = [0; MAX_JOURNAL_LEN];
            let reencoded = journal::encode(&decoded.header, &events, &mut out).unwrap();
            assert_eq!(
                reencoded,
                bytes(&vector["reencoded"]),
                "{file}: field reencoded"
            );
            assert_eq!(
                reencoded,
                input.as_slice(),
                "{file}: reencoded differs from input"
            );
        }
        (actual, code) => panic!(
            "{file}: field error: the core returns {:?}, the vector records {code:?}",
            actual.map(|_| ())
        ),
    }
}

fn check_level(file: &str, vector: &Value) {
    let input = bytes(&vector["input"]);
    let mut stack = [0; CAPTURE_STACK];
    let result = level::decode(&input)
        .and_then(|decoded| level::validate(&decoded, &mut stack).map(|_| decoded));
    match (result, recorded_error(vector)) {
        (Err(error), Some(code)) => assert_eq!(error.code(), code, "{file}: field error"),
        (Ok(decoded), None) => {
            assert_eq!(
                level_id(&input).to_vec(),
                bytes(&vector["levelId"]),
                "{file}: field levelId"
            );
            let reencoded = level::encode(&decoded);
            assert_eq!(
                reencoded.to_vec(),
                bytes(&vector["reencoded"]),
                "{file}: field reencoded"
            );
            assert_eq!(
                reencoded.to_vec(),
                input,
                "{file}: reencoded differs from input"
            );
        }
        (actual, code) => panic!(
            "{file}: field error: the core returns {:?}, the vector records {code:?}",
            actual.map(|_| ())
        ),
    }
}

#[test]
fn every_format_vector_matches_the_core() {
    let vectors = format_vectors();
    assert!(!vectors.is_empty(), "no vectors in vectors/format");
    for (file, vector) in &vectors {
        match vector["kind"].as_str() {
            Some("journal") => check_journal(file, vector),
            Some("level") => check_level(file, vector),
            other => panic!("{file}: field kind: unknown kind {other:?}"),
        }
    }
}

/// Every journal rejection code of README §6.3 (1-11) and level code of §5 (20-39) has a vector.
#[test]
fn every_decoder_and_validity_code_has_a_vector() {
    let mut codes: Vec<u8> = format_vectors()
        .iter()
        .filter_map(|(_, vector)| recorded_error(vector))
        .collect();
    codes.sort_unstable();
    codes.dedup();
    let expected: Vec<u8> = (1..=11).chain(20..=39).collect();
    assert_eq!(codes, expected);
}
