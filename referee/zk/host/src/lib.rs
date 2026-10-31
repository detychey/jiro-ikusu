//! The host of the SP1 trial (plan M1.16): feeds game vectors (README §6.6, vectors/README.md) to
//! the guests and checks what they commit against what each vector records.

use std::path::Path;

use serde_json::Value;
use sp1_sdk::{Elf, SP1Stdin, include_elf};

/// Commits `(uint16 weightBp, Outcome)` as ABI words per level, and halts on a rejected journal.
pub const VERIFY_ELF: Elf = include_elf!("verify");
/// Test only: commits the error code, the trace digest and the encoded Outcome per level.
pub const TRACE_ELF: Elf = include_elf!("trace");

pub const WORD: usize = 32;
pub const OUTCOME_LEN: usize = 12 * WORD;
pub const TRACED_LEN: usize = 1 + WORD + OUTCOME_LEN;

/// The Outcome's fields in ABI order (README §7.3); the first three are bytes32.
const OUTCOME_FIELDS: [&str; 11] = [
    "journalHash",
    "levelId",
    "runNonce",
    "levelIndex",
    "drawSlot",
    "mode",
    "rulesVersion",
    "endReason",
    "claimBp",
    "ticksUsed",
    "levelScore",
];
const BYTES32_FIELDS: usize = 3;

pub fn read_vector(path: &Path) -> Result<Value, String> {
    let text =
        std::fs::read_to_string(path).map_err(|error| format!("{}: {error}", path.display()))?;
    let vector: Value =
        serde_json::from_str(&text).map_err(|error| format!("{}: {error}", path.display()))?;
    match vector["kind"].as_str() {
        Some("game") => Ok(vector),
        other => Err(format!(
            "{}: kind {other:?} is not a game vector",
            path.display()
        )),
    }
}

/// The guests' input stream: the number of levels, then each vector's level bytes, journal bytes
/// and weightBp.
pub fn stdin(vectors: &[&Value]) -> Result<SP1Stdin, String> {
    let mut stdin = SP1Stdin::new();
    let count = u8::try_from(vectors.len()).map_err(|error| error.to_string())?;
    stdin.write(&count);
    for vector in vectors {
        stdin.write_vec(bytes(&vector["level"])?);
        stdin.write_vec(bytes(&vector["journal"])?);
        stdin.write(&weight_bp(vector)?);
    }
    Ok(stdin)
}

/// Checks one level of the trace guest's values: the error code, `traceKeccak`, and the Outcome.
pub fn check_traced(vector: &Value, values: &[u8]) -> Result<(), String> {
    let (code, rest) = values.split_first().ok_or("no values committed")?;
    let (trace_keccak, outcome) = rest.split_at(WORD);
    let recorded_code = vector.get("error").map_or(Some(0), Value::as_u64);
    if Some(u64::from(*code)) != recorded_code {
        return Err(format!(
            "error code {code}, the vector records {recorded_code:?}"
        ));
    }
    let digest = format!("0x{}", hex::encode(trace_keccak));
    if vector["traceKeccak"].as_str() != Some(digest.as_str()) {
        return Err(format!(
            "traceKeccak {digest}, the vector records {}",
            vector["traceKeccak"]
        ));
    }
    match code {
        0 => check_outcome(vector, outcome),
        _ if outcome.iter().all(|byte| *byte == 0) => Ok(()),
        _ => Err("a rejected level committed an Outcome".into()),
    }
}

/// Checks one level's `(uint16 weightBp, Outcome)` words against the vector.
pub fn check_outcome(vector: &Value, words: &[u8]) -> Result<(), String> {
    if words.len() != OUTCOME_LEN {
        return Err(format!(
            "{} bytes of Outcome, expected {OUTCOME_LEN}",
            words.len()
        ));
    }
    let (weight, fields) = words.split_at(WORD);
    if uint(weight)? != u64::from(weight_bp(vector)?) {
        return Err(format!(
            "weightBp {}, the vector records {}",
            uint(weight)?,
            vector["weightBp"]
        ));
    }
    for (index, (name, word)) in OUTCOME_FIELDS.iter().zip(fields.chunks(WORD)).enumerate() {
        let value = if index < BYTES32_FIELDS {
            Value::from(format!("0x{}", hex::encode(word)))
        } else {
            Value::from(uint(word)?)
        };
        if vector["outcome"][name] != value {
            return Err(format!(
                "outcome.{name} {value}, the vector records {}",
                vector["outcome"][name]
            ));
        }
    }
    Ok(())
}

fn uint(word: &[u8]) -> Result<u64, String> {
    let (padding, value) = word.split_at(WORD - 8);
    if padding.iter().any(|byte| *byte != 0) {
        return Err(format!("word 0x{} exceeds u64", hex::encode(word)));
    }
    Ok(u64::from_be_bytes(
        value.try_into().map_err(|_| "short word")?,
    ))
}

fn bytes(value: &Value) -> Result<Vec<u8>, String> {
    let text = value
        .as_str()
        .and_then(|text| text.strip_prefix("0x"))
        .ok_or("not a 0x string")?;
    hex::decode(text).map_err(|error| error.to_string())
}

fn weight_bp(vector: &Value) -> Result<u16, String> {
    let weight = vector["weightBp"].as_u64().ok_or("no weightBp")?;
    u16::try_from(weight).map_err(|error| error.to_string())
}
