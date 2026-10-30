//! The JSON objects of README §6.6: string, integer, string-list and object fields, in a fixed
//! order.

pub enum Value {
    Str(String),
    Int(u64),
    List(Vec<String>),
    Object(Vec<(&'static str, Value)>),
}

/// One object per file, two-space indent, fields in the given order, trailing newline.
pub fn object(fields: &[(&str, Value)]) -> Result<String, String> {
    Ok(format!("{}\n", render_object(fields, 0)?))
}

fn render_object(fields: &[(&str, Value)], depth: usize) -> Result<String, String> {
    let indent = "  ".repeat(depth + 1);
    let lines: Result<Vec<String>, String> = fields
        .iter()
        .map(|(key, value)| Ok(format!("{indent}\"{key}\": {}", render(key, value, depth)?)))
        .collect();
    Ok(format!(
        "{{\n{}\n{}}}",
        lines?.join(",\n"),
        "  ".repeat(depth)
    ))
}

fn render(key: &str, value: &Value, depth: usize) -> Result<String, String> {
    Ok(match value {
        Value::Str(text) => string(key, text)?,
        Value::Int(number) => number.to_string(),
        Value::List(items) => {
            let items: Result<Vec<String>, String> =
                items.iter().map(|item| string(key, item)).collect();
            format!("[{}]", items?.join(", "))
        }
        Value::Object(fields) => render_object(fields, depth + 1)?,
    })
}

fn string(key: &str, text: &str) -> Result<String, String> {
    if text.contains(['"', '\\']) || text.chars().any(char::is_control) {
        return Err(format!("{key}: string needs escaping: {text}"));
    }
    Ok(format!("\"{text}\""))
}

pub fn hex(bytes: &[u8]) -> String {
    let digits: String = bytes.iter().map(|byte| format!("{byte:02x}")).collect();
    format!("0x{digits}")
}

/// The bytes of a lowercase or uppercase hex string with a `0x` prefix.
pub fn parse_hex(text: &str) -> Result<Vec<u8>, String> {
    let digits = text
        .strip_prefix("0x")
        .filter(|digits| digits.is_ascii() && digits.len() % 2 == 0)
        .ok_or(format!("not 0x-prefixed hex bytes: {text}"))?;
    (0..digits.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&digits[i..i + 2], 16).map_err(|_| format!("not hex: {text}")))
        .collect()
}
