//! The zk referee's host (README §7.3, plan M1.12): feeds vectors (README §6.6,
//! vectors/README.md) to the guests and checks what they commit against what each vector records.

use std::path::Path;

use risc0_zkvm::ExecutorEnv;
use serde_json::Value;

// The guests, built by risc0-build: `VERIFY_ELF` and `VERIFY_ID` commit `(uint16 weightBp,
// Outcome)` as ABI words per level and panic on a rejected journal; `TRACE_ELF` and `TRACE_ID`,
// test only, commit the error code, the trace digest and the encoded Outcome per level.
include!(concat!(env!("OUT_DIR"), "/methods.rs"));

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
const LEVEL_ID_FIELD: usize = 1;

const VECTOR_KINDS: [&str; 3] = ["game", "journal", "level"];
/// The journal header's levelId offset (README §6.3).
const JOURNAL_LEVEL_ID_AT: usize = 36;
/// The journal decoder's codes (README §6.3): a valid journal never gets one.
const DECODER_CODES: std::ops::RangeInclusive<u8> = 1..=11;
/// The weight of a format vector's replay, which has none of its own.
const FORMAT_WEIGHT_BP: u16 = 10_000;

/// One level of a guest's input: what `verify` takes per level.
pub struct Input {
    pub level: Vec<u8>,
    pub journal: Vec<u8>,
    pub weight_bp: u16,
}

impl Input {
    pub fn of_game(vector: &Value) -> Result<Input, String> {
        Ok(Input {
            level: bytes(&vector["level"])?,
            journal: bytes(&vector["journal"])?,
            weight_bp: weight_bp(vector)?,
        })
    }
}

/// The format vectors that the other format vectors are replayed with, as web/test/vectors.mjs
/// pairs them: a journal on the open-field level, and a level with the open-field-empty journal
/// made to name that level's id.
pub struct FormatFixtures {
    open_field: Vec<u8>,
    open_field_journal: Vec<u8>,
}

impl FormatFixtures {
    pub fn find(vectors: &[Value]) -> Result<FormatFixtures, String> {
        let input = |kind: &str, name: &str| {
            vectors
                .iter()
                .find(|vector| vector["kind"] == kind && vector["name"] == name)
                .ok_or(format!(
                    "format/{kind}-{name}.json is missing: format vectors replay with it"
                ))
                .and_then(|vector| bytes(&vector["input"]))
        };
        Ok(FormatFixtures {
            open_field: input("level", "open-field")?,
            open_field_journal: input("journal", "open-field-empty")?,
        })
    }

    pub fn input(&self, vector: &Value) -> Result<Input, String> {
        let given = bytes(&vector["input"])?;
        let (level, journal) = match vector["kind"].as_str() {
            Some("journal") => (self.open_field.clone(), given),
            Some("level") => {
                let mut journal = self.open_field_journal.clone();
                let level_id = match vector.get("levelId") {
                    Some(level_id) => bytes(level_id)?,
                    None => vec![0; WORD],
                };
                journal[JOURNAL_LEVEL_ID_AT..JOURNAL_LEVEL_ID_AT + WORD].copy_from_slice(&level_id);
                (given, journal)
            }
            other => return Err(format!("kind {other:?} is not a format vector")),
        };
        Ok(Input {
            level,
            journal,
            weight_bp: FORMAT_WEIGHT_BP,
        })
    }
}

pub fn read_vector(path: &Path) -> Result<Value, String> {
    let text =
        std::fs::read_to_string(path).map_err(|error| format!("{}: {error}", path.display()))?;
    let vector: Value =
        serde_json::from_str(&text).map_err(|error| format!("{}: {error}", path.display()))?;
    match vector["kind"].as_str() {
        Some(kind) if VECTOR_KINDS.contains(&kind) => Ok(vector),
        other => Err(format!(
            "{}: kind {other:?} is not a vector",
            path.display()
        )),
    }
}

/// The guests' input stream, as raw little-endian u32 words: the number of levels, then each
/// level's bytes and journal bytes, each after its length, and weightBp.
pub fn env(inputs: &[Input]) -> Result<ExecutorEnv<'static>, String> {
    let mut builder = ExecutorEnv::builder();
    builder.write_slice(&[word(inputs.len())?]);
    for input in inputs {
        for bytes in [&input.level, &input.journal] {
            builder.write_slice(&[word(bytes.len())?]);
            builder.write_slice(bytes);
        }
        builder.write_slice(&[u32::from(input.weight_bp)]);
    }
    builder.build().map_err(|error| error.to_string())
}

fn word(length: usize) -> Result<u32, String> {
    u32::try_from(length).map_err(|error| error.to_string())
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
    let (weight, fields) = split_outcome(words)?;
    if weight != u64::from(weight_bp(vector)?) {
        return Err(format!(
            "weightBp {weight}, the vector records {}",
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

/// Checks the verify guest's result on a format vector: the recorded code, or, for a valid level,
/// acceptance with the recorded levelId; a valid journal may be rejected, but not by the decoder.
pub fn check_format(vector: &Value, result: Result<&[u8], u8>) -> Result<(), String> {
    let recorded_code = match vector.get("error") {
        Some(code) => Some(code.as_u64().ok_or("error is not a number")?),
        None => None,
    };
    match (vector["kind"].as_str(), recorded_code, result) {
        (_, Some(recorded), Err(code)) if u64::from(code) == recorded => Ok(()),
        (_, Some(recorded), Err(code)) => Err(format!(
            "verify guest rejects with code {code}, the vector records error {recorded}"
        )),
        (_, Some(recorded), Ok(_)) => Err(format!(
            "verify guest accepts, the vector records error {recorded}"
        )),
        (Some("journal"), None, Err(code)) if DECODER_CODES.contains(&code) => Err(format!(
            "verify guest rejects a valid journal with decoder code {code}"
        )),
        (Some("journal"), None, Err(_)) => Ok(()),
        (Some("journal"), None, Ok(words)) => split_outcome(words).map(|_| ()),
        (_, None, Err(code)) => Err(format!(
            "verify guest rejects a valid level with code {code}"
        )),
        (_, None, Ok(words)) => {
            let (_, fields) = split_outcome(words)?;
            let level_id = &fields[LEVEL_ID_FIELD * WORD..(LEVEL_ID_FIELD + 1) * WORD];
            let level_id = format!("0x{}", hex::encode(level_id));
            match vector["levelId"].as_str() == Some(level_id.as_str()) {
                true => Ok(()),
                false => Err(format!(
                    "levelId {level_id}, the vector records {}",
                    vector["levelId"]
                )),
            }
        }
    }
}

/// The weightBp word and the Outcome's words of one level.
fn split_outcome(words: &[u8]) -> Result<(u64, &[u8]), String> {
    if words.len() != OUTCOME_LEN {
        return Err(format!(
            "{} bytes of Outcome, expected {OUTCOME_LEN}",
            words.len()
        ));
    }
    let (weight, fields) = words.split_at(WORD);
    Ok((uint(weight)?, fields))
}

/// Replay's error code in the verify guest's panic message, `replay rejects: code N`.
pub fn rejection_code(message: &str) -> Option<u8> {
    let (_, after) = message.split_once("replay rejects: code ")?;
    let digits: String = after.chars().take_while(char::is_ascii_digit).collect();
    digits.parse().ok()
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
