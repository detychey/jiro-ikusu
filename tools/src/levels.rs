//! `jiro-tools level`: the level sources of `levels/src/` (plan M2.4), compiled by the core's
//! level codec (README §5).
//!
//! level build <src dir> <out dir> | validate <file>... | id <file>... | render <file>
//!
//! A source is the header, one `key=value` line per key of `KEYS` in that order, a blank line,
//! then the 60 × 60 field, row y on line 10 + y: `#` an obstacle, `.` an open cell, `m` a minion
//! spawn. The border is always claimed, so it is written `#`, or `m` for a spawn on it. A spawn
//! is a rail cell, so an `m` inside the border is an obstacle too. The minions take their slots
//! in row-major order. Sources are canonical, so each level has one source: the render of its
//! bytes.

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
use crate::vectors::rewrite;

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
    let level = parse(text)?;
    let bytes = encode(&level);
    check(&bytes).map_err(|error| locate(&level, error))?;
    Ok(bytes)
}

/// The canonical source of a valid level, or why no source writes it.
pub fn render(level: &Level) -> Result<String, String> {
    let spawns: Vec<usize> = level
        .minions()
        .map(|spawn| CellIndex::new(spawn).map(CellIndex::get))
        .collect::<Option<_>>()
        .ok_or("a minion spawn is outside the grid")?;
    if !spawns.is_sorted_by(|a, b| a < b) {
        return Err("its minion spawns are not in row-major order, so no source writes it".into());
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
        text.push(if spawns.contains(&cell.get()) {
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

fn parse(text: &str) -> Result<Level, SourceError> {
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
    minion_spawns[..spawns.len()].copy_from_slice(&spawns);
    Ok(Level {
        obstacles,
        boss_size,
        spawn: Rect { x0, y0, x1, y1 },
        boss_period,
        minion_count: u8::try_from(spawns.len()).expect("at most MINION_SLOTS spawns"),
        minion_spawns,
        minion_period,
        respawn_delay,
        time_limit,
        lives,
        target_bp,
    })
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
                if spawns.len() == MINION_SLOTS {
                    return Err(SourceError {
                        line: line_number,
                        rule: Some(Error::MinionCount.code()),
                        message: format!("at most {MINION_SLOTS} minions"),
                    });
                }
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

/// The source line where `level` breaks the rule of `error`, and the reason.
fn locate(level: &Level, error: Error) -> SourceError {
    let grid = Grid::level_start(level);
    let knob = |name: &str, rule: &str| {
        let index = KEYS.iter().position(|key| *key == name).unwrap_or(0);
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
        Error::MinionPeriod => knob("minion_period", "at least 1 with minions, 0 without"),
        Error::RespawnDelay => knob("respawn_delay", "at least 1 with minions, 0 without"),
        Error::TimeLimit => knob("time_limit", "1 to 2,700 ticks"),
        Error::Lives => knob("lives", "at least 1"),
        Error::Target => knob("target_bp", "1 to 10,000"),
        Error::OpenAreaSplit => match cut_off(&grid) {
            Some(pos) => (
                row(pos),
                format!(
                    "the open area is not one region: ({}, {}) is cut off",
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
        Error::BossSpawn => match body_obstacle(level, &grid) {
            Some(pos) => (
                row(pos),
                format!(
                    "the boss body can cover the obstacle at ({}, {})",
                    pos.x, pos.y
                ),
            ),
            None => knob("boss_spawn", "the boss body can cover an obstacle"),
        },
        Error::MinionSpawnRail => match level.minions().find(|&spawn| !grid.is_rail(spawn)) {
            Some(pos) => (
                row(pos),
                format!(
                    "the minion spawn ({}, {}) is not a rail cell: it has no open neighbor",
                    pos.x, pos.y
                ),
            ),
            None => (FIELD_LINE, "a minion spawn is not a rail cell".to_string()),
        },
        Error::PlayerStartRail => (
            row(PLAYER_START),
            "the player start (30, 59) is not a rail cell: it has no open neighbor".to_string(),
        ),
        other => (1, format!("{other:?}")),
    };
    SourceError {
        line,
        rule: Some(error.code()),
        message,
    }
}

/// The first open cell, in row-major order, outside the region of the first open cell.
fn cut_off(grid: &Grid) -> Option<Pos> {
    let mut grid = grid.clone();
    let first = CellIndex::all().find(|&cell| grid.get(cell) == Cell::Empty)?;
    grid.mark_boss_zone([first], &mut [0; CAPTURE_STACK])?;
    CellIndex::all()
        .find(|&cell| grid.get(cell) == Cell::Empty)
        .map(CellIndex::pos)
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
/// broken source fails the build, and nothing is written.
fn build_dir(src: &Path, out: &Path) -> Result<(), String> {
    let mut sources = Vec::new();
    for entry in fs::read_dir(src).map_err(|e| format!("{}: {e}", src.display()))? {
        let path = entry.map_err(|e| e.to_string())?.path();
        if path.extension().is_some_and(|ext| ext == "txt") {
            sources.push(path);
        }
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
    files.insert("README.md".to_string(), table(&built).into_bytes());
    rewrite(out, &["bin", "md"], &files)
}

/// The index NN of a stem `NN-name`, if the stem has that form.
fn level_index(stem: &str) -> Option<u8> {
    let (index, name) = stem.split_once('-')?;
    let two_digits = index.len() == 2 && index.chars().all(|c| c.is_ascii_digit());
    let valid_name = !name.is_empty()
        && name
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-');
    let index: u8 = index.parse().ok()?;
    (two_digits && valid_name && (1..=SEASON_LEVELS).contains(&usize::from(index))).then_some(index)
}

fn table(built: &[Built]) -> String {
    let keys: Vec<String> = KEYS.iter().map(|key| format!("`{key}`")).collect();
    let mut text = TABLE_INTRO.replace("{keys}", &keys.join(", "));
    for level in built {
        let l = &level.level;
        let Rect { x0, y0, x1, y1 } = l.spawn;
        let (index, name) = level.stem.split_once('-').expect("checked by level_index");
        text.push_str(&format!(
            "| {index} | {name} | `{}` | {} | ({x0}, {y0})-({x1}, {y1}) | {} | {} | {} | {} | {} | {} | {} bp | – | – |\n",
            hex(&level_id(&level.bytes)),
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
        let field = level
            .source
            .split_once("\n\n")
            .map_or("", |(_, field)| field);
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
too. The minions take their slots in row-major order. `jiro-tools level render <file.bin>`
writes a level's source.

The target and measured clear rates come from the playtest bots (plan M2.6) and the play test
(plan M2.9).

| # | Name | `level_id` | B | Boss spawn | Boss period | Minions | Minion period | R | T | Lives | Target | Target clear rate | Measured clear rate |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
";

#[cfg(test)]
mod tests {
    use super::*;

    /// L01, the open-field level of README §5.
    fn l01() -> String {
        fs::read_to_string(crate::repo_root().join("levels/src/01-open.txt")).expect("L01")
    }

    fn with_line(text: &str, line: usize, replacement: &str) -> String {
        let mut lines: Vec<&str> = text.split('\n').collect();
        lines[line - 1] = replacement;
        lines.join("\n")
    }

    fn with_cells(text: &str, cells: &[(usize, usize, char)]) -> String {
        let mut lines: Vec<String> = text.split('\n').map(String::from).collect();
        for &(x, y, symbol) in cells {
            let row = &mut lines[FIELD_LINE - 1 + y];
            row.replace_range(x..=x, &symbol.to_string());
        }
        lines.join("\n")
    }

    /// `text` with minion spawns at `cells`, and the minion knobs that minions need.
    fn with_minions(text: &str, cells: &[(usize, usize, char)]) -> String {
        let text = with_line(text, 4, "minion_period=1");
        with_cells(&with_line(&text, 5, "respawn_delay=1"), cells)
    }

    fn sources() -> Vec<(String, String)> {
        let dir = crate::repo_root().join("levels/src");
        let mut sources: Vec<(String, String)> = fs::read_dir(&dir)
            .expect("levels/src")
            .map(|entry| entry.expect("entry").path())
            .filter(|path| path.extension().is_some_and(|ext| ext == "txt"))
            .map(|path| {
                let text = fs::read_to_string(&path).expect("source");
                (path.display().to_string(), text)
            })
            .collect();
        sources.sort();
        sources
    }

    #[test]
    fn every_source_is_the_render_of_its_bytes() {
        for (file, text) in sources() {
            let bytes = build(&text).unwrap_or_else(|error| panic!("{}", error.describe(&file)));
            let level = decode(&bytes).expect("built bytes decode");
            assert_eq!(render(&level).as_deref(), Ok(text.as_str()), "{file}");
        }
    }

    #[test]
    fn l01_is_the_open_field_level_of_readme_section_5() {
        let bytes = build(&l01()).expect("L01 is valid");
        assert_eq!(
            hex(&level_id(&bytes)),
            "0x04e24fd698778a8dbcf62ab0c9ed0228d67be3ddd3aeb682f4a67a53410dacc9"
        );
    }

    #[test]
    fn the_levels_table_lists_the_id_of_every_bin_file() {
        let levels = crate::repo_root().join("levels");
        let table = fs::read_to_string(levels.join("README.md")).expect("levels/README.md");
        for (file, _) in sources() {
            let stem = Path::new(&file)
                .file_stem()
                .expect("stem")
                .to_string_lossy()
                .into_owned();
            let bytes = fs::read(levels.join(format!("{stem}.bin"))).expect("bin");
            let (index, name) = stem.split_once('-').expect("NN-name");
            let row = format!("| {index} | {name} | `{}` |", hex(&level_id(&bytes)));
            assert!(table.contains(&row), "{row}");
        }
    }

    /// Each rule of README §5 that a source can break, at the line that breaks it.
    #[test]
    fn each_broken_rule_is_reported_at_its_line() {
        let l01 = l01();
        let wall: Vec<(usize, usize, char)> = (1..59).map(|y| (10, y, '#')).collect();
        let crowded: Vec<(usize, usize, char)> = (1..31)
            .flat_map(|y| (1..59).map(move |x| (x, y, '#')))
            .collect();
        let boxed_spawn: Vec<(usize, usize, char)> = (9..12)
            .flat_map(|y| (9..12).map(move |x| (x, y, if (x, y) == (10, 10) { 'm' } else { '#' })))
            .collect();
        let cases: Vec<(&str, String, usize, Error)> = vec![
            (
                "boss size",
                with_line(&l01, 1, "boss_size=9"),
                1,
                Error::BossSize,
            ),
            (
                "spawn order",
                with_line(&l01, 2, "boss_spawn=34,20,20,34"),
                2,
                Error::SpawnOrder,
            ),
            (
                "spawn bounds",
                with_line(&l01, 2, "boss_spawn=0,20,34,34"),
                2,
                Error::SpawnBounds,
            ),
            (
                "boss period",
                with_line(&l01, 3, "boss_period=0"),
                3,
                Error::BossPeriod,
            ),
            (
                "minion count",
                with_cells(&l01, &[(1, 0, 'm'), (2, 0, 'm'), (3, 0, 'm'), (4, 0, 'm')]),
                FIELD_LINE,
                Error::MinionCount,
            ),
            (
                "minion period",
                with_line(&l01, 4, "minion_period=1"),
                4,
                Error::MinionPeriod,
            ),
            (
                "respawn delay",
                with_line(&l01, 5, "respawn_delay=1"),
                5,
                Error::RespawnDelay,
            ),
            (
                "time limit",
                with_line(&l01, 6, "time_limit=2701"),
                6,
                Error::TimeLimit,
            ),
            ("lives", with_line(&l01, 7, "lives=0"), 7, Error::Lives),
            (
                "target",
                with_line(&l01, 8, "target_bp=10001"),
                8,
                Error::Target,
            ),
            (
                "split open area",
                with_cells(&l01, &wall),
                FIELD_LINE + 1,
                Error::OpenAreaSplit,
            ),
            (
                "small open area",
                with_cells(&l01, &crowded),
                FIELD_LINE,
                Error::OpenAreaSmall,
            ),
            (
                "boss spawn",
                with_cells(&l01, &[(25, 25, '#')]),
                FIELD_LINE + 25,
                Error::BossSpawn,
            ),
            (
                "minion rail",
                with_minions(&l01, &boxed_spawn),
                FIELD_LINE + 10,
                Error::MinionSpawnRail,
            ),
            (
                "player start",
                with_cells(&l01, &[(29, 58, '#'), (30, 58, '#'), (31, 58, '#')]),
                FIELD_LINE + 59,
                Error::PlayerStartRail,
            ),
        ];
        for (name, text, line, rule) in cases {
            let error = build(&text).expect_err(name);
            assert_eq!(
                (error.line, error.rule),
                (line, Some(rule.code())),
                "{name}: {error:?}"
            );
        }
    }

    /// Each malformed source, at the line that breaks the format.
    #[test]
    fn each_malformed_source_is_reported_at_its_line() {
        let l01 = l01();
        let truncated: String = l01.split_inclusive('\n').take(FIELD_LINE + 30).collect();
        let cases: Vec<(&str, String, usize)> = vec![
            ("unknown key", with_line(&l01, 1, "size=5"), 1),
            (
                "keys out of order",
                with_line(&l01, 3, "minion_period=0"),
                3,
            ),
            ("leading zero", with_line(&l01, 1, "boss_size=05"), 1),
            (
                "out of the field's type",
                with_line(&l01, 1, "boss_size=300"),
                1,
            ),
            (
                "three spawn numbers",
                with_line(&l01, 2, "boss_spawn=20,20,34"),
                2,
            ),
            (
                "no blank line",
                with_line(&l01, FIELD_LINE - 1, "x"),
                FIELD_LINE - 1,
            ),
            (
                "short row",
                with_line(&l01, FIELD_LINE + 5, &"#".repeat(59)),
                FIELD_LINE + 5,
            ),
            (
                "unknown cell",
                with_cells(&l01, &[(5, 5, 'x')]),
                FIELD_LINE + 5,
            ),
            (
                "open border",
                with_cells(&l01, &[(0, 5, '.')]),
                FIELD_LINE + 5,
            ),
            ("missing rows", truncated, FIELD_LINE + 31),
            ("line after the field", format!("{l01}\n"), FIELD_LINE + 60),
            (
                "no final newline",
                l01.trim_end().to_string(),
                FIELD_LINE + 59,
            ),
        ];
        for (name, text, line) in cases {
            let error = build(&text).expect_err(name);
            assert_eq!((error.line, error.rule), (line, None), "{name}: {error:?}");
        }
    }

    #[test]
    fn render_refuses_minion_spawns_out_of_row_major_order() {
        let text = with_minions(&l01(), &[(1, 0, 'm'), (2, 0, 'm')]);
        let mut level = decode(&build(&text).expect("two minions")).expect("decode");
        level.minion_spawns.swap(0, 1);
        assert!(render(&level).is_err());
    }
}
