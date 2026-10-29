//! Writes vectors/format/ (README §6.6) from the scenarios, after checking each case against
//! the core. The directory is rewritten whole, so a removed or renamed case leaves no file.

use std::collections::BTreeMap;
use std::fs;
use std::path::Path;

use jiro_core::consts::{CAPTURE_STACK, MAX_JOURNAL_LEN};
use jiro_core::journal::{self, Event};
use jiro_core::level::{self, level_id};

use crate::json::{Value, hex, object};
use crate::scenarios::{self, Case};

pub fn write(vectors: &Path) -> Result<(), String> {
    let mut files = BTreeMap::new();
    for case in scenarios::journal::cases()? {
        add(
            &mut files,
            format!("journal-{}.json", case.name),
            journal_vector(&case)?,
        )?;
    }
    for case in scenarios::level::cases()? {
        add(
            &mut files,
            format!("level-{}.json", case.name),
            level_vector(&case)?,
        )?;
    }
    let format = vectors.join("format");
    fs::create_dir_all(&format).map_err(|e| format!("{}: {e}", format.display()))?;
    for entry in fs::read_dir(&format).map_err(|e| format!("{}: {e}", format.display()))? {
        let path = entry.map_err(|e| e.to_string())?.path();
        if path.extension().is_some_and(|ext| ext == "json") {
            fs::remove_file(&path).map_err(|e| format!("{}: {e}", path.display()))?;
        }
    }
    for (name, text) in &files {
        let path = format.join(name);
        fs::write(&path, text).map_err(|e| format!("{}: {e}", path.display()))?;
    }
    println!("wrote {} vectors to {}", files.len(), format.display());
    Ok(())
}

fn add(files: &mut BTreeMap<String, String>, name: String, text: String) -> Result<(), String> {
    match files.insert(name.clone(), text) {
        None => Ok(()),
        Some(_) => Err(format!("two scenarios are named {name}")),
    }
}

fn journal_vector(case: &Case) -> Result<String, String> {
    let mut fields = header_fields("journal", case);
    match (journal::decode(&case.input), case.expect) {
        (Ok(decoded), Ok(())) => {
            let events: Vec<Event> = decoded.events().collect();
            let mut out = [0; MAX_JOURNAL_LEN];
            let reencoded = journal::encode(&decoded.header, &events, &mut out)
                .map_err(|error| format!("journal {}: encode returns {error:?}", case.name))?;
            fields.push(("reencoded", Value::Str(hex(reencoded))));
        }
        (Err(error), Err(expected)) if error == expected => {
            fields.push(("error", Value::Int(u64::from(error.code()))));
        }
        (actual, expected) => {
            return Err(format!(
                "journal {}: the core returns {:?}, the scenario expects {expected:?}",
                case.name,
                actual.map(|_| ())
            ));
        }
    }
    object(&fields)
}

fn level_vector(case: &Case) -> Result<String, String> {
    let mut fields = header_fields("level", case);
    let mut stack = [0; CAPTURE_STACK];
    let result = level::decode(&case.input)
        .and_then(|decoded| level::validate(&decoded, &mut stack).map(|_| decoded));
    match (result, case.expect) {
        (Ok(decoded), Ok(())) => {
            fields.push(("levelId", Value::Str(hex(&level_id(&case.input)))));
            fields.push(("reencoded", Value::Str(hex(&level::encode(&decoded)))));
        }
        (Err(error), Err(expected)) if error == expected => {
            fields.push(("error", Value::Int(u64::from(error.code()))));
        }
        (actual, expected) => {
            return Err(format!(
                "level {}: the core returns {:?}, the scenario expects {expected:?}",
                case.name,
                actual.map(|_| ())
            ));
        }
    }
    object(&fields)
}

fn header_fields<'a>(kind: &str, case: &Case) -> Vec<(&'a str, Value)> {
    vec![
        ("kind", Value::Str(kind.to_string())),
        ("name", Value::Str(case.name.clone())),
        ("input", Value::Str(hex(&case.input))),
    ]
}
