//! The flat JSON objects of README §6.6: string and integer fields, in a fixed order.

pub enum Value {
    Str(String),
    Int(u64),
}

/// One object per file, two-space indent, fields in the given order, trailing newline.
pub fn object(fields: &[(&str, Value)]) -> Result<String, String> {
    let lines: Result<Vec<String>, String> = fields
        .iter()
        .map(|(key, value)| {
            let value = match value {
                Value::Str(text)
                    if text.contains(['"', '\\']) || text.chars().any(char::is_control) =>
                {
                    return Err(format!("{key}: string needs escaping: {text}"));
                }
                Value::Str(text) => format!("\"{text}\""),
                Value::Int(number) => number.to_string(),
            };
            Ok(format!("  \"{key}\": {value}"))
        })
        .collect();
    Ok(format!("{{\n{}\n}}\n", lines?.join(",\n")))
}

pub fn hex(bytes: &[u8]) -> String {
    let digits: String = bytes.iter().map(|byte| format!("{byte:02x}")).collect();
    format!("0x{digits}")
}
