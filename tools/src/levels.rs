//! `jiro-tools level`: the level sources of `levels/src/` (plan M2.4), compiled by the core's
//! level codec (README §5).
//!
//! level build <src dir> <out dir> | validate <file>... | id <file>... | render <file>
//!
//! A source is the header, one `key=value` line per key of `KEYS` in that order, a blank line,
//! then the 60 × 60 field, row y on line 10 + y: `#` an obstacle, `.` an open cell, `m` a minion
//! spawn. The border is always claimed, so it is written `#`, or `m` for a spawn on it. A spawn
//! is a rail cell, so an `m` inside the border is an obstacle too. The minions take their slots
//! in row-major order, one minion per cell. Sources are canonical, with LF line endings, so each
//! level has one source: the render of its bytes.

use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::Path;
use std::str::FromStr;

use jiro_core::Error;
use jiro_core::consts::{
    CAPTURE_STACK, LEVEL_LEN, MIN_OPEN_AREA, MINION_SLOTS, OBSTACLE_BYTES, PLAYER_START,
    SEASON_LEVELS, W,
};
use jiro_core::grid::Grid;
use jiro_core::level::{Level, Rect, decode, encode, level_id, validate};
use jiro_core::types::{Cell, CellIndex, Pos};

use crate::json::hex;
use crate::playtest::{Targets, levels_hash, percent};
use crate::vectors::rewrite;

#[cfg(test)]
mod tests;

const USAGE: &str = concat!(
    "usage: jiro-tools level build <src dir> <out dir> | level validate <file>... | ",
    "level id <file>... | level render <file>"
);

/// The header keys, in source order: line i + 1 holds `KEYS[i]`.
const KEYS: [&str; 8] = [
    "boss_size",
    "boss_spawn",
    "boss_period",
    "minion_period",
    "respawn_delay",
    "time_limit",
    "lives",
    "target_bp",
];

/// The line of field row 0, after the header and its blank line.
const FIELD_LINE: usize = KEYS.len() + 2;

const FIELD_WIDTH: usize = W as usize;

/// A broken source: the line, the README §5 rule when a level rule is broken, and why.
#[derive(Debug, PartialEq, Eq)]
pub struct SourceError {
    pub line: usize,
    pub rule: Option<u8>,
    pub message: String,
}

impl SourceError {
    fn at(line: usize, message: impl Into<String>) -> Self {
        Self {
            line,
            rule: None,
            message: message.into(),
        }
    }

    fn describe(&self, file: &str) -> String {
        match self.rule {
            Some(rule) => format!("{file}:{}: rule {rule}: {}", self.line, self.message),
            None => format!("{file}:{}: {}", self.line, self.message),
        }
    }
}

pub fn run(args: &[&str]) -> Result<(), String> {
    match args {
        ["build", src, out] => build_dir(Path::new(src), Path::new(out)),
        ["validate", files @ ..] if !files.is_empty() => {
            let mut errors = Vec::new();
            for file in files {
                match load(file) {
                    Ok(_) => println!("{file}: valid"),
                    Err(error) => errors.push(error),
                }
            }
            failures(errors)
        }
        ["id", files @ ..] if !files.is_empty() => {
            for file in files {
                println!("{} {file}", hex(&level_id(&load(file)?)));
            }
            Ok(())
        }
        ["render", file] => {
            let level = decode(&load(file)?).map_err(|error| rule_error(file, error))?;
            print!(
                "{}",
                render(&level).map_err(|message| format!("{file}: {message}"))?
            );
            Ok(())
        }
        _ => Err(USAGE.to_string()),
    }
}

/// The level bytes of a source, if the source is well formed and the level valid.
pub fn build(text: &str) -> Result<[u8; LEVEL_LEN], SourceError> {
    let (level, spawns) = parse(text)?;
    let bytes = encode(&level);
    check(&bytes).map_err(|error| locate(&level, &spawns, error))?;
    Ok(bytes)
}

/// The canonical source of a valid level, or why no source writes it.
pub fn render(level: &Level) -> Result<String, String> {
    let spawns: Vec<Pos> = level.minions().collect();
    let indices: Vec<usize> = spawns
        .iter()
        .map(|&spawn| {
            CellIndex::new(spawn)
                .expect("rule 28 keeps a spawn inside the grid")
                .get()
        })
        .collect();
    if !indices.is_sorted() {
        return Err("its minion spawns are not in row-major order, so no source writes it".into());
    }
    if let Some(pair) = spawns.windows(2).find(|pair| pair[0] == pair[1]) {
        return Err(format!(
            "two minions share the spawn ({}, {}), so no source writes it",
            pair[0].x, pair[0].y
        ));
    }
    let Rect { x0, y0, x1, y1 } = level.spawn;
    let values = [
        level.boss_size.to_string(),
        format!("{x0},{y0},{x1},{y1}"),
        level.boss_period.to_string(),
        level.minion_period.to_string(),
        level.respawn_delay.to_string(),
        level.time_limit.to_string(),
        level.lives.to_string(),
        level.target_bp.to_string(),
    ];
    let mut text = String::new();
    for (key, value) in KEYS.iter().zip(values) {
        text.push_str(&format!("{key}={value}\n"));
    }
    text.push('\n');
    for (cell, obstacle) in CellIndex::all().zip(level.obstacle_bits()) {
        text.push(if indices.contains(&cell.get()) {
            'm'
        } else if obstacle || cell.pos().is_border() {
            '#'
        } else {
            '.'
        });
        if cell.pos().x == W - 1 {
            text.push('\n');
        }
    }
    Ok(text)
}

/// The rules of README §5, in its order: the byte ranges, then validity.
fn check(bytes: &[u8]) -> Result<Level, Error> {
    let level = decode(bytes)?;
    validate(&level, &mut [0; CAPTURE_STACK])?;
    Ok(level)
}

/// The level a source draws, and every minion spawn it draws, more than `MINION_SLOTS` included:
/// the core's rule order decides when too many minions is the first broken rule.
fn parse(text: &str) -> Result<(Level, Vec<Pos>), SourceError> {
    if text.starts_with('\u{feff}') {
        return Err(SourceError::at(1, "remove the byte-order mark"));
    }
    if let Some(index) = text.split('\n').position(|line| line.contains('\r')) {
        return Err(SourceError::at(index + 1, "use LF line endings, not CRLF"));
    }
    let body = text
        .strip_suffix('\n')
        .ok_or_else(|| SourceError::at(text.split('\n').count(), "end the file with a newline"))?;
    let lines: Vec<&str> = body.split('\n').collect();
    let boss_size = knob(&lines, 0)?;
    let spawn: Vec<u8> = header_value(&lines, 1)?
        .split(',')
        .map(|text| number(2, text))
        .collect::<Result<_, _>>()?;
    let &[x0, y0, x1, y1] = spawn.as_slice() else {
        return Err(SourceError::at(2, "expected boss_spawn=x0,y0,x1,y1"));
    };
    let boss_period = knob(&lines, 2)?;
    let minion_period = knob(&lines, 3)?;
    let respawn_delay = knob(&lines, 4)?;
    let time_limit = knob(&lines, 5)?;
    let lives = knob(&lines, 6)?;
    let target_bp = knob(&lines, 7)?;
    if lines.get(FIELD_LINE - 2) != Some(&"") {
        return Err(SourceError::at(
            FIELD_LINE - 1,
            "expected a blank line before the field",
        ));
    }
    let (obstacles, spawns) = parse_field(&lines)?;
    let mut minion_spawns = [Pos { x: 0, y: 0 }; MINION_SLOTS];
    for (slot, &spawn) in minion_spawns.iter_mut().zip(&spawns) {
        *slot = spawn;
    }
    let level = Level {
        obstacles,
        boss_size,
        spawn: Rect { x0, y0, x1, y1 },
        boss_period,
        minion_count: u8::try_from(spawns.len()).unwrap_or(u8::MAX),
        minion_spawns,
        minion_period,
        respawn_delay,
        time_limit,
        lives,
        target_bp,
    };
    Ok((level, spawns))
}

/// The value of header line `index` + 1, which must hold the key `KEYS[index]`.
fn header_value<'a>(lines: &[&'a str], index: usize) -> Result<&'a str, SourceError> {
    let key = KEYS[index];
    lines
        .get(index)
        .and_then(|line| line.strip_prefix(key)?.strip_prefix('='))
        .ok_or_else(|| SourceError::at(index + 1, format!("expected {key}=<value>")))
}

fn knob<T: FromStr + ToString>(lines: &[&str], index: usize) -> Result<T, SourceError> {
    number(index + 1, header_value(lines, index)?)
}

/// A number written in its canonical form: decimal, no sign, no leading zero.
fn number<T: FromStr + ToString>(line: usize, text: &str) -> Result<T, SourceError> {
    match text.parse::<T>() {
        Ok(value) if value.to_string() == text => Ok(value),
        Ok(value) => Err(SourceError::at(
            line,
            format!("write {text:?} as {}", value.to_string()),
        )),
        Err(_) => Err(SourceError::at(
            line,
            format!("{text:?} is not a number in the field's range"),
        )),
    }
}

fn parse_field(lines: &[&str]) -> Result<([u8; OBSTACLE_BYTES], Vec<Pos>), SourceError> {
    let mut obstacles = [0; OBSTACLE_BYTES];
    let mut spawns = Vec::new();
    for (y, line_number) in (0..W).zip(FIELD_LINE..) {
        let row = lines.get(line_number - 1).ok_or_else(|| {
            SourceError::at(line_number, format!("expected {FIELD_WIDTH} field rows"))
        })?;
        if row.chars().count() != FIELD_WIDTH {
            return Err(SourceError::at(
                line_number,
                format!("a field row has {FIELD_WIDTH} cells"),
            ));
        }
        for (x, symbol) in (0..W).zip(row.chars()) {
            let pos = Pos { x, y };
            let obstacle = match (symbol, pos.is_border()) {
                ('#' | 'm', true) | ('.', false) => false,
                ('#' | 'm', false) => true,
                ('.', true) => {
                    return Err(SourceError::at(
                        line_number,
                        format!(
                            "({x}, {y}) is on the border, which is always claimed: write # or m"
                        ),
                    ));
                }
                _ => {
                    return Err(SourceError::at(
                        line_number,
                        format!("unknown cell {symbol:?} at ({x}, {y}): write #, . or m"),
                    ));
                }
            };
            if symbol == 'm' {
                spawns.push(pos);
            }
            if obstacle {
                let index = CellIndex::new(pos).expect("inside the grid").get();
                obstacles[index / 8] |= 0x80 >> (index % 8);
            }
        }
    }
    let after = FIELD_LINE + FIELD_WIDTH;
    if lines.len() >= after {
        return Err(SourceError::at(after, "unexpected line after the field"));
    }
    Ok((obstacles, spawns))
}

/// The source line where `level`, drawn with `spawns`, breaks the rule of `error`, and why.
fn locate(level: &Level, spawns: &[Pos], error: Error) -> SourceError {
    let grid = Grid::level_start(level);
    let knob = |name: &str, rule: &str| {
        let index = KEYS
            .iter()
            .position(|key| *key == name)
            .expect("a key of KEYS");
        (index + 1, format!("{name}: {rule}"))
    };
    let row = |pos: Pos| FIELD_LINE + usize::from(pos.y);
    let (line, message) = match error {
        Error::BossSize => knob("boss_size", "the body size B is 2 to 8"),
        Error::SpawnOrder => knob("boss_spawn", "x0 ≤ x1 and y0 ≤ y1"),
        Error::SpawnBounds => knob(
            "boss_spawn",
            "the body stays inside the border: x0, y0 ≥ 1 and x1, y1 ≤ 59 − B",
        ),
        Error::BossPeriod => knob("boss_period", "at least 1"),
        Error::MinionCount => {
            let extra = spawns[MINION_SLOTS];
            (
                row(extra),
                format!(
                    "at most {MINION_SLOTS} minions; the spawn ({}, {}) is one more",
                    extra.x, extra.y
                ),
            )
        }
        Error::MinionPeriod => knob("minion_period", "at least 1 with minions, 0 without"),
        Error::RespawnDelay => knob("respawn_delay", "at least 1 with minions, 0 without"),
        Error::TimeLimit => knob("time_limit", "1 to 2,700 ticks"),
        Error::Lives => knob("lives", "at least 1"),
        Error::Target => knob("target_bp", "1 to 10,000"),
        Error::OpenAreaSplit => match cut_off(&grid) {
            Some(pos) => (
                row(pos),
                format!(
                    "the open area is not one region: ({}, {}) is cut off from the largest one",
                    pos.x, pos.y
                ),
            ),
            None => (FIELD_LINE, "the field has no open cell".to_string()),
        },
        Error::OpenAreaSmall => (
            FIELD_LINE,
            format!(
                "the open area has {} cells, fewer than {MIN_OPEN_AREA}",
                grid.count(Cell::Empty)
            ),
        ),
        Error::BossSpawn => {
            let pos = body_obstacle(level, &grid).expect("rule 37 is broken by a claimed cell");
            (
                row(pos),
                format!(
                    "the boss body can cover the obstacle at ({}, {})",
                    pos.x, pos.y
                ),
            )
        }
        Error::MinionSpawnRail => {
            let pos = level
                .minions()
                .find(|&spawn| !grid.is_rail(spawn))
                .expect("rule 38 is broken by a spawn");
            (
                row(pos),
                format!(
                    "the minion spawn ({}, {}) is not a rail cell: it has no open neighbor",
                    pos.x, pos.y
                ),
            )
        }
        Error::PlayerStartRail => {
            let Pos { x, y } = PLAYER_START;
            let above = y - 1;
            (
                row(Pos { x, y: above }),
                format!(
                    "({}, {above}), ({x}, {above}) and ({}, {above}) are all claimed, so the \
                     player start ({x}, {y}) has no open neighbor",
                    x - 1,
                    x + 1
                ),
            )
        }
        other => unreachable!("a parsed source cannot break rule {}", other.code()),
    };
    SourceError {
        line,
        rule: Some(error.code()),
        message,
    }
}

/// The first open cell, in row-major order, outside the largest region of the open area, or
/// `None` when the field has no open cell.
fn cut_off(grid: &Grid) -> Option<Pos> {
    let mut grid = grid.clone();
    let mut regions = Vec::new();
    while let Some(first) = CellIndex::all().find(|&cell| grid.get(cell) == Cell::Empty) {
        let marked = grid.count(Cell::BossZone);
        grid.mark_boss_zone([first], &mut [0; CAPTURE_STACK])
            .expect("the open area fits the stack");
        regions.push((first.pos(), grid.count(Cell::BossZone) - marked));
    }
    let largest = (0..regions.len()).max_by_key(|&region| regions[region].1)?;
    (0..regions.len())
        .find(|&region| region != largest)
        .map(|region| regions[region].0)
}

/// The first claimed cell, in row-major order, that the boss body covers from some start.
fn body_obstacle(level: &Level, grid: &Grid) -> Option<Pos> {
    let Rect { x0, y0, x1, y1 } = level.spawn;
    let covered = |at: u8, start: u8, end: u8| at >= start && at < end + level.boss_size;
    CellIndex::all()
        .map(CellIndex::pos)
        .filter(|pos| covered(pos.x, x0, x1) && covered(pos.y, y0, y1))
        .find(|&pos| grid.at(pos) != Some(Cell::Empty))
}

/// The level bytes of a file: a `.txt` source built, or a `.bin` file checked.
fn load(file: &str) -> Result<Vec<u8>, String> {
    if file.ends_with(".txt") {
        let text = fs::read_to_string(file).map_err(|e| format!("{file}: {e}"))?;
        return build(&text)
            .map(Vec::from)
            .map_err(|error| error.describe(file));
    }
    let bytes = fs::read(file).map_err(|e| format!("{file}: {e}"))?;
    check(&bytes).map_err(|error| rule_error(file, error))?;
    Ok(bytes)
}

fn rule_error(file: &str, error: Error) -> String {
    format!("{file}: rule {} ({error:?})", error.code())
}

fn failures(errors: Vec<String>) -> Result<(), String> {
    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors.join("\n"))
    }
}

/// A built level: its file stem `NN-name`, its source and its bytes.
struct Built {
    stem: String,
    source: String,
    bytes: [u8; LEVEL_LEN],
    level: Level,
}

/// Builds every source of `src` into `out`: the `.bin` files and the generated README.md. A
/// broken source fails the build, and nothing is written. The build replaces only the level
/// files of `out`, so a `.bin` file whose source is gone does not survive.
fn build_dir(src: &Path, out: &Path) -> Result<(), String> {
    let mut sources = Vec::new();
    for entry in fs::read_dir(src).map_err(|e| format!("{}: {e}", src.display()))? {
        let path = entry.map_err(|e| e.to_string())?.path();
        if path.extension().is_some_and(|ext| ext == "txt") {
            sources.push(path);
        }
    }
    if sources.is_empty() {
        return Err(format!("{}: no NN-name.txt source", src.display()));
    }
    sources.sort();
    let mut built = Vec::new();
    let mut errors = Vec::new();
    let mut indices = BTreeSet::new();
    for path in &sources {
        let file = path.display().to_string();
        let stem = path
            .file_stem()
            .map(|s| s.to_string_lossy().into_owned())
            .unwrap_or_default();
        match level_index(&stem) {
            Some(index) if indices.insert(index) => {}
            Some(index) => errors.push(format!("{file}: another source has index {index:02}")),
            None => errors.push(format!(
                "{file}: name a source NN-name.txt, NN from 01 to {SEASON_LEVELS}, name in a-z, 0-9 and -"
            )),
        }
        let source = fs::read_to_string(path).map_err(|e| format!("{file}: {e}"))?;
        match build(&source) {
            Ok(bytes) => {
                let level = decode(&bytes).map_err(|error| rule_error(&file, error))?;
                built.push(Built {
                    stem,
                    source,
                    bytes,
                    level,
                });
            }
            Err(error) => errors.push(error.describe(&file)),
        }
    }
    failures(errors)?;
    let mut files = BTreeMap::new();
    for level in &built {
        files.insert(format!("{}.bin", level.stem), level.bytes.to_vec());
    }
    let targets_file = out.join("targets.json");
    let targets = targets_file
        .exists()
        .then(|| Targets::read(&targets_file))
        .transpose()?;
    let clear_rates = targets
        .as_ref()
        .map(|targets| targets.clear_rate_pct.as_slice());
    let ids: Vec<[u8; 32]> = built.iter().map(|level| level_id(&level.bytes)).collect();
    let report = out
        .parent()
        .unwrap_or(Path::new(""))
        .join("reports")
        .join(format!("playtest-{}.json", levels_hash(&ids)));
    let measured = report
        .exists()
        .then(|| measured_rates(&report))
        .transpose()?
        .unwrap_or_default();
    files.insert(
        "README.md".to_string(),
        table(&built, clear_rates, &measured).into_bytes(),
    );
    rewrite(out, is_level_file, &files)
}

/// The reference mix's clear rate of each level of a playtest report, in tenths of a percent, by
/// level id.
fn measured_rates(report: &Path) -> Result<BTreeMap<String, u32>, String> {
    let bad = || format!("{}: not a reference playtest report", report.display());
    let text = fs::read_to_string(report).map_err(|e| format!("{}: {e}", report.display()))?;
    let value: serde_json::Value = serde_json::from_str(&text).map_err(|_| bad())?;
    value["levels"]
        .as_array()
        .ok_or_else(bad)?
        .iter()
        .map(|level| {
            let id = level["levelId"].as_str().ok_or_else(bad)?;
            let rate = level["mix"]["clearRatePerMille"].as_u64().ok_or_else(bad)?;
            Ok((id.to_string(), u32::try_from(rate).map_err(|_| bad())?))
        })
        .collect()
}

/// A level's bytes, `NN-name.bin`, as `build_dir` writes them.
fn is_level_file(path: &Path) -> bool {
    path.extension().is_some_and(|ext| ext == "bin")
        && path
            .file_stem()
            .and_then(|stem| stem.to_str())
            .and_then(level_index)
            .is_some()
}

/// The index NN of a stem `NN-name`, if the stem has that form.
pub fn level_index(stem: &str) -> Option<u8> {
    let (index, name) = stem.split_once('-')?;
    let two_digits = index.len() == 2 && index.chars().all(|c| c.is_ascii_digit());
    let valid_name = !name.is_empty()
        && name
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-');
    let index: u8 = index.parse().ok()?;
    (two_digits && valid_name && (1..=SEASON_LEVELS).contains(&usize::from(index))).then_some(index)
}

/// The generated levels table, with each level's target clear rate from `clear_rates`, the
/// rates of `targets.json` by index, when there is one, and its measured clear rate from
/// `measured`, in tenths of a percent by level id.
fn table(built: &[Built], clear_rates: Option<&[u16]>, measured: &BTreeMap<String, u32>) -> String {
    let keys: Vec<String> = KEYS.iter().map(|key| format!("`{key}`")).collect();
    let mut text = TABLE_INTRO.replace("{keys}", &keys.join(", "));
    for level in built {
        let l = &level.level;
        let Rect { x0, y0, x1, y1 } = l.spawn;
        let (index, name) = level.stem.split_once('-').expect("checked by level_index");
        let target = clear_rates
            .and_then(|rates| rates.get(usize::from(level_index(&level.stem)?) - 1))
            .map_or("–".to_string(), |rate| format!("{rate} %"));
        let id = hex(&level_id(&level.bytes));
        let measured = measured
            .get(&id)
            .map_or("–".to_string(), |&per_mille| percent(per_mille));
        text.push_str(&format!(
            "| {index} | {name} | `{id}` | {} | ({x0}, {y0})-({x1}, {y1}) | {} | {} | {} | {} | {} | {} | {} bp | {target} | {measured} |\n",
            l.boss_size,
            l.boss_period,
            l.minion_count,
            l.minion_period,
            l.respawn_delay,
            l.time_limit,
            l.lives,
            l.target_bp,
        ));
    }
    for level in built {
        let (_, field) = level
            .source
            .split_once("\n\n")
            .expect("a built source has a blank line");
        text.push_str(&format!(
            "\n## {}\n\n`levels/src/{}.txt`\n\n```text\n{field}```\n",
            level.stem, level.stem
        ));
    }
    text
}

const TABLE_INTRO: &str = "\
# Levels

Generated by `cargo run -p jiro-tools --locked -- level build levels/src levels` from the
sources in `levels/src/`: edit a source, never this file or a `.bin` file. Each `NN-name.bin`
holds the level bytes v1 of README §5, and its `level_id` is keccak256 of the file.

A source is a header, one `key=value` line for each of {keys}, in this order, with
`boss_spawn=x0,y0,x1,y1`; a blank line; then the 60 × 60 field, row y on line 10 + y: `#` an
obstacle, `.` an open cell, `m` a minion spawn. The border is always claimed, so it is written
`#`, or `m` for a spawn on it. A spawn is a rail cell, so an `m` inside the border is an obstacle
too. The minions take their slots in row-major order, one minion per cell.
`jiro-tools level render <file.bin>` writes a level's source.

The target clear rate is that of the reference mix of playtest bots, from `levels/targets.json`
(plan M2.6, P11). The measured clear rate is the mix's in the reference playtest report of these
levels, `reports/playtest-<hash>.json`, which `jiro-tools playtest --check levels/targets.json`
writes: the runs on which `jiro-tools calibrate` sets the season weights (plan M2.9). It reads
`–` while no report of these levels exists.

| # | Name | `level_id` | B | Boss spawn | Boss period | Minions | Minion period | R | T | Lives | Target | Target clear rate | Measured clear rate |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
";
