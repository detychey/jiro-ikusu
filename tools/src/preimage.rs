//! Reads a state-hash v1 preimage (README §6.4) field by field, for diagnosis: `replay
//! --dump-tick` prints it, and `--diff` names the fields that differ from another target's.

/// How a field's bytes read.
#[derive(Clone, Copy)]
enum Kind {
    Byte,
    Word,
    Mask,
    Grid,
    Cell,
    Direction,
    Velocity,
    Minion,
}

/// The fields of the README §6.4 table, in order, with their widths.
const FIELDS: [(&str, usize, Kind); 22] = [
    ("version", 1, Kind::Byte),
    ("tick", 2, Kind::Word),
    ("input mask", 1, Kind::Mask),
    ("grid", 900, Kind::Grid),
    ("player position", 2, Kind::Cell),
    ("cutting", 1, Kind::Byte),
    ("cut start", 2, Kind::Cell),
    ("lives", 1, Kind::Byte),
    ("shield charges", 1, Kind::Byte),
    ("invulnerability ticks", 1, Kind::Byte),
    ("previous direction", 1, Kind::Direction),
    ("press_tick", 2, Kind::Word),
    ("boss position", 2, Kind::Cell),
    ("boss body size B", 1, Kind::Byte),
    ("vx, vy", 2, Kind::Velocity),
    ("boss move period", 1, Kind::Byte),
    ("minion slot 0", 7, Kind::Minion),
    ("minion slot 1", 7, Kind::Minion),
    ("minion slot 2", 7, Kind::Minion),
    ("captured cells", 2, Kind::Word),
    ("claimable cells", 2, Kind::Word),
    ("next event index", 2, Kind::Word),
];

pub const PREIMAGE_LEN: usize = 948;

/// A field of a preimage: its name, how it reads, and its bytes.
struct Field<'a> {
    name: &'static str,
    kind: Kind,
    bytes: &'a [u8],
}

/// Each field of `preimage`, or an error if `preimage` has the wrong length.
fn fields(preimage: &[u8]) -> Result<Vec<Field<'_>>, String> {
    if preimage.len() != PREIMAGE_LEN {
        return Err(format!(
            "a preimage is {PREIMAGE_LEN} bytes, not {}",
            preimage.len()
        ));
    }
    let mut rest = preimage;
    Ok(FIELDS
        .iter()
        .map(|&(name, width, kind)| {
            let (bytes, tail) = rest.split_at(width);
            rest = tail;
            Field { name, kind, bytes }
        })
        .collect())
}

/// One line per field: `name: value`.
pub fn describe(preimage: &[u8]) -> Result<Vec<String>, String> {
    Ok(fields(preimage)?
        .into_iter()
        .map(|field| format!("{}: {}", field.name, value(field.kind, field.bytes)))
        .collect())
}

/// One line per field that differs between `ours` and `theirs`; for the grid, one per cell.
pub fn diff(ours: &[u8], theirs: &[u8]) -> Result<Vec<String>, String> {
    let mut lines = Vec::new();
    for (field, other) in fields(ours)?.into_iter().zip(fields(theirs)?) {
        let (name, kind, a, b) = (field.name, field.kind, field.bytes, other.bytes);
        if a == b {
            continue;
        }
        match kind {
            Kind::Grid => {
                let cells = (0..3_600).filter_map(|i| {
                    let (ours, theirs) = (cell(a, i), cell(b, i));
                    (ours != theirs).then(|| {
                        format!(
                            "grid cell ({}, {}): {ours} here, {theirs} there",
                            i % 60,
                            i / 60
                        )
                    })
                });
                lines.extend(cells);
            }
            _ => lines.push(format!(
                "{name}: {} here, {} there",
                value(kind, a),
                value(kind, b)
            )),
        }
    }
    Ok(lines)
}

/// The value of cell `i`: 2 bits, the high bit at bit 7 − 2 × (i % 4) of byte i / 4.
fn cell(grid: &[u8], i: usize) -> u8 {
    (grid[i / 4] >> (6 - 2 * (i % 4))) & 0b11
}

fn value(kind: Kind, bytes: &[u8]) -> String {
    let word = |at: usize| u16::from_be_bytes([bytes[at], bytes[at + 1]]);
    match kind {
        Kind::Byte => bytes[0].to_string(),
        Kind::Word => word(0).to_string(),
        Kind::Mask => format!("0x{:02x}", bytes[0]),
        Kind::Cell => format!("({}, {})", bytes[0], bytes[1]),
        Kind::Direction => ["none", "up", "down", "left", "right"]
            .get(usize::from(bytes[0]))
            .map_or_else(|| format!("invalid {}", bytes[0]), |name| name.to_string()),
        Kind::Velocity => format!("{}, {}", bytes[0] as i8, bytes[1] as i8),
        Kind::Grid => {
            let mut counts = [0; 4];
            for i in 0..3_600 {
                counts[usize::from(cell(bytes, i))] += 1;
            }
            format!(
                "{} empty, {} claimed, {} trail, {} boss zone",
                counts[0], counts[1], counts[2], counts[3]
            )
        }
        Kind::Minion => format!(
            "presence {}, ({}, {}), heading {}, period {}, countdown {}",
            bytes[0],
            bytes[1],
            bytes[2],
            bytes[3],
            bytes[4],
            word(5)
        ),
    }
}
