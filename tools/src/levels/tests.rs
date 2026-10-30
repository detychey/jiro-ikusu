use std::path::PathBuf;

use super::*;

/// The open-field level of README §5, as published in its worked example.
const OPEN_FIELD_ID: &str = "0x04e24fd698778a8dbcf62ab0c9ed0228d67be3ddd3aeb682f4a67a53410dacc9";

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

/// A level whose knobs all differ, with a bar of obstacles at y = 50 and three minions: on the
/// top border, on the right border, and on the bar.
fn rich() -> String {
    let mut text = l01();
    let knobs = [
        "boss_size=3",
        "boss_spawn=10,12,40,44",
        "boss_period=4",
        "minion_period=2",
        "respawn_delay=45",
        "time_limit=1800",
        "lives=2",
        "target_bp=6000",
    ];
    for (line, knob) in (1..).zip(knobs) {
        text = with_line(&text, line, knob);
    }
    let bar: Vec<(usize, usize, char)> = (10..=20)
        .map(|x| (x, 50, if x == 15 { 'm' } else { '#' }))
        .collect();
    with_cells(&with_cells(&text, &bar), &[(5, 0, 'm'), (59, 30, 'm')])
}

/// The level `rich` draws, written out from README §5's byte layout.
fn rich_level() -> Level {
    let mut obstacles = [0; OBSTACLE_BYTES];
    for x in 10..=20 {
        let cell: usize = 50 * 60 + x;
        obstacles[cell / 8] |= 0x80 >> (cell % 8);
    }
    Level {
        obstacles,
        boss_size: 3,
        spawn: Rect {
            x0: 10,
            y0: 12,
            x1: 40,
            y1: 44,
        },
        boss_period: 4,
        minion_count: 3,
        minion_spawns: [
            Pos { x: 5, y: 0 },
            Pos { x: 59, y: 30 },
            Pos { x: 15, y: 50 },
        ],
        minion_period: 2,
        respawn_delay: 45,
        time_limit: 1800,
        lives: 2,
        target_bp: 6000,
    }
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

/// A fresh directory with an empty `src` inside, for one test.
fn scratch(test: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("jiro-levels-{}-{test}", std::process::id()));
    if dir.exists() {
        fs::remove_dir_all(&dir).expect("clear the scratch directory");
    }
    fs::create_dir_all(dir.join("src")).expect("scratch directory");
    dir
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
fn a_source_builds_the_level_it_draws() {
    let bytes = build(&rich()).expect("the rich level is valid");
    assert_eq!(decode(&bytes), Ok(rich_level()));
}

#[test]
fn a_level_renders_to_the_source_that_draws_it() {
    assert_eq!(render(&rich_level()), Ok(rich()));
}

#[test]
fn the_open_field_level_of_readme_section_5_has_a_source() {
    let path = crate::repo_root().join("vectors/format/level-open-field.json");
    let vector: serde_json::Value =
        serde_json::from_str(&fs::read_to_string(path).expect("vector")).expect("json");
    let bytes = crate::json::parse_hex(vector["input"].as_str().expect("input")).expect("hex");
    let source = render(&decode(&bytes).expect("decode")).expect("render");
    let built = build(&source).expect("the rendered source builds");
    assert_eq!(
        (built.to_vec(), hex(&level_id(&built))),
        (bytes, OPEN_FIELD_ID.to_string())
    );
}

#[test]
fn the_levels_table_lists_the_id_of_every_bin_file() {
    let levels = crate::repo_root().join("levels");
    let table = fs::read_to_string(levels.join("README.md")).expect("levels/README.md");
    for entry in fs::read_dir(&levels).expect("levels") {
        let path = entry.expect("entry").path();
        if path.extension().is_none_or(|ext| ext != "bin") {
            continue;
        }
        let stem = path
            .file_stem()
            .expect("stem")
            .to_string_lossy()
            .into_owned();
        assert!(
            levels.join(format!("src/{stem}.txt")).exists(),
            "{stem} has a source"
        );
        let (index, name) = stem.split_once('-').expect("NN-name");
        let bytes = fs::read(&path).expect("bin");
        let row = format!("| {index} | {name} | `{}` |", hex(&level_id(&bytes)));
        assert!(table.contains(&row), "{row}");
    }
}

#[test]
fn the_table_shows_every_knob_and_the_field_of_a_level() {
    let source = rich();
    let bytes = build(&source).expect("the rich level is valid");
    let built = Built {
        stem: "07-rich".to_string(),
        level: decode(&bytes).expect("decode"),
        source: source.clone(),
        bytes,
    };
    let table = table(&[built], None);
    let row = format!(
        "| 07 | rich | `{}` | 3 | (10, 12)-(40, 44) | 4 | 3 | 2 | 45 | 1800 | 2 | 6000 bp | – | – |\n",
        hex(&level_id(&bytes))
    );
    let (_, field) = source.split_once("\n\n").expect("blank line");
    assert!(
        table.contains(&row) && table.contains(&format!("```text\n{field}```")),
        "{table}"
    );
}

/// Each rule of README §5 that a source can break, at the line that breaks it.
#[test]
fn each_broken_rule_is_reported_at_its_line() {
    let l01 = l01();
    let four_minions = [(1, 0, 'm'), (2, 0, 'm'), (3, 0, 'm'), (0, 30, 'm')];
    let wall: Vec<(usize, usize, char)> = (1..59).map(|y| (10, y, '#')).collect();
    let pocket: Vec<(usize, usize, char)> =
        (2..59).map(|x| (x, 1, '#')).chain([(1, 2, '#')]).collect();
    let crowded: Vec<(usize, usize, char)> = (1..31)
        .flat_map(|y| (1..59).map(move |x| (x, y, '#')))
        .collect();
    let boxed_second_minion: Vec<(usize, usize, char)> = (9..12)
        .flat_map(|y| (9..12).map(move |x| (x, y, if (x, y) == (10, 10) { 'm' } else { '#' })))
        .chain([(5, 0, 'm')])
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
            "minion count, at the extra spawn",
            with_cells(&l01, &four_minions),
            FIELD_LINE + 30,
            Error::MinionCount,
        ),
        (
            "boss size before minion count",
            with_cells(&with_line(&l01, 1, "boss_size=9"), &four_minions),
            1,
            Error::BossSize,
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
            "split open area, small region first",
            with_cells(&l01, &pocket),
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
            "boss spawn, at the body area's edge",
            with_cells(&l01, &[(39, 20, '#'), (38, 25, '#')]),
            FIELD_LINE + 25,
            Error::BossSpawn,
        ),
        (
            "minion rail, second minion",
            with_minions(&l01, &boxed_second_minion),
            FIELD_LINE + 10,
            Error::MinionSpawnRail,
        ),
        (
            "player start",
            with_cells(&l01, &[(29, 58, '#'), (30, 58, '#'), (31, 58, '#')]),
            FIELD_LINE + 58,
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
            "spawn coordinate with a leading zero",
            with_line(&l01, 2, "boss_spawn=20,020,34,34"),
            2,
        ),
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
            "long row",
            with_line(&l01, FIELD_LINE + 5, &format!("#{}#", ".".repeat(59))),
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
fn a_crlf_source_is_told_to_use_lf() {
    let error = build(&l01().replace('\n', "\r\n")).expect_err("CRLF");
    assert_eq!(error, SourceError::at(1, "use LF line endings, not CRLF"));
}

#[test]
fn a_source_with_a_byte_order_mark_is_told_to_remove_it() {
    let error = build(&format!("\u{feff}{}", l01())).expect_err("byte-order mark");
    assert_eq!(error, SourceError::at(1, "remove the byte-order mark"));
}

#[test]
fn render_refuses_minion_spawns_out_of_row_major_order() {
    let mut level = rich_level();
    level.minion_spawns.swap(0, 1);
    assert!(render(&level).is_err_and(|message| message.contains("row-major order")));
}

#[test]
fn render_refuses_two_minions_on_one_spawn() {
    let mut level = rich_level();
    level.minion_spawns[1] = level.minion_spawns[0];
    assert!(render(&level).is_err_and(|message| message.contains("share the spawn (5, 0)")));
}

/// Source names: NN from 01 to 16, a hyphen, then a-z, 0-9 and hyphens.
#[test]
fn level_index_accepts_only_nn_name_stems() {
    let cases = [
        ("01-open", Some(1)),
        ("16-x", Some(16)),
        ("01-open-2", Some(1)),
        ("1-open", None),
        ("001-open", None),
        ("00-open", None),
        ("17-open", None),
        ("01-Open", None),
        ("01-", None),
        ("open", None),
    ];
    for (stem, index) in cases {
        assert_eq!(level_index(stem), index, "{stem}");
    }
}

#[test]
fn build_removes_the_bin_file_of_a_removed_source() {
    let dir = scratch("removed-source");
    fs::write(dir.join("src/01-open.txt"), l01()).expect("source");
    fs::create_dir_all(dir.join("out")).expect("out");
    fs::write(dir.join("out/02-gone.bin"), [0]).expect("stale level");
    build_dir(&dir.join("src"), &dir.join("out")).expect("build");
    assert!(!dir.join("out/02-gone.bin").exists());
}

#[test]
fn build_keeps_the_files_it_does_not_write() {
    let dir = scratch("foreign-files");
    fs::write(dir.join("src/01-open.txt"), l01()).expect("source");
    fs::create_dir_all(dir.join("out")).expect("out");
    fs::write(dir.join("out/notes.md"), "notes").expect("notes");
    fs::write(dir.join("out/pack.bin"), [0]).expect("pack");
    build_dir(&dir.join("src"), &dir.join("out")).expect("build");
    assert!(dir.join("out/notes.md").exists() && dir.join("out/pack.bin").exists());
}

#[test]
fn build_writes_nothing_when_a_source_is_broken() {
    let dir = scratch("broken-source");
    fs::write(dir.join("src/01-open.txt"), l01()).expect("source");
    fs::write(
        dir.join("src/02-bad.txt"),
        with_line(&l01(), 3, "boss_period=0"),
    )
    .expect("broken source");
    assert!(build_dir(&dir.join("src"), &dir.join("out")).is_err());
    assert!(!dir.join("out").exists());
}

#[test]
fn build_names_the_file_and_line_of_a_broken_source() {
    let dir = scratch("broken-source-line");
    let bad = dir.join("src/02-bad.txt");
    fs::write(&bad, with_line(&l01(), 3, "boss_period=0")).expect("broken source");
    let error = build_dir(&dir.join("src"), &dir.join("out")).expect_err("broken");
    assert!(
        error.contains(&format!("{}:3: rule 26:", bad.display())),
        "{error}"
    );
}

#[test]
fn build_refuses_a_source_directory_without_sources() {
    let dir = scratch("no-sources");
    assert!(build_dir(&dir.join("src"), &dir.join("out")).is_err());
}

#[test]
fn build_refuses_two_sources_with_one_index() {
    let dir = scratch("one-index");
    fs::write(dir.join("src/01-open.txt"), l01()).expect("source");
    fs::write(dir.join("src/01-again.txt"), l01()).expect("source");
    let error = build_dir(&dir.join("src"), &dir.join("out")).expect_err("one index");
    assert!(error.contains("another source has index 01"), "{error}");
}
