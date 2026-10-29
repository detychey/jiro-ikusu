//! The coverage index, vectors/COVERAGE.md: every rule tag of README.md ([R4.*], [PIN-*]) and of
//! the parity-testing skill ([COV-*]) maps to game vectors or core tests that exist, and the
//! index names no other tag.

use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Path, PathBuf};

fn root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..")
}

fn read(path: &Path) -> String {
    fs::read_to_string(path).unwrap_or_else(|e| panic!("{}: {e}", path.display()))
}

fn is_tag(tag: &str) -> bool {
    let numbered = |rest: &str| !rest.is_empty() && rest.chars().all(|c| c.is_ascii_digit());
    match tag.strip_prefix("R4.") {
        Some(rest) => rest
            .split_once('-')
            .is_some_and(|(n, k)| numbered(n) && numbered(k)),
        None => ["PIN-", "COV-"]
            .iter()
            .any(|prefix| tag.strip_prefix(prefix).is_some_and(numbered)),
    }
}

/// The bracketed rule tags of `text`.
fn tags(text: &str) -> BTreeSet<String> {
    text.split('[')
        .skip(1)
        .filter_map(|part| part.split(']').next())
        .filter(|tag| is_tag(tag))
        .map(str::to_string)
        .collect()
}

/// The tags that README.md and the parity-testing skill define.
fn defined_tags() -> BTreeSet<String> {
    let root = root();
    let readme: BTreeSet<String> = tags(&read(&root.join("README.md")))
        .into_iter()
        .filter(|tag| !tag.starts_with("COV-"))
        .collect();
    let skill: BTreeSet<String> = tags(&read(&root.join(".claude/skills/parity-testing/SKILL.md")))
        .into_iter()
        .filter(|tag| tag.starts_with("COV-"))
        .collect();
    readme.union(&skill).cloned().collect()
}

/// The rows of the index: each tag and its entries.
fn index() -> BTreeMap<String, Vec<String>> {
    read(&root().join("vectors/COVERAGE.md"))
        .lines()
        .filter_map(|line| {
            let row = line.strip_prefix("| [")?.strip_suffix(" |")?;
            let (tag, entries) = row.split_once("] | ")?;
            Some((
                tag.to_string(),
                entries.split(", ").map(str::to_string).collect(),
            ))
        })
        .collect()
}

/// The names of the functions declared in the Rust files under `core/`.
fn core_functions() -> BTreeSet<String> {
    let root = root();
    ["core/src", "core/tests"]
        .iter()
        .flat_map(|dir| fs::read_dir(root.join(dir)).unwrap())
        .map(|entry| entry.unwrap().path())
        .filter(|path| path.extension().is_some_and(|ext| ext == "rs"))
        .flat_map(|path| {
            read(&path)
                .lines()
                .filter_map(|line| {
                    let rest = line.trim().strip_prefix("pub ").unwrap_or(line.trim());
                    Some(
                        rest.strip_prefix("fn ")?
                            .split(['(', '<'])
                            .next()?
                            .to_string(),
                    )
                })
                .collect::<Vec<_>>()
        })
        .collect()
}

#[test]
fn every_defined_tag_has_an_entry() {
    let index = index();
    let missing: Vec<String> = defined_tags()
        .into_iter()
        .filter(|tag| index.get(tag).is_none_or(Vec::is_empty))
        .collect();
    assert!(missing.is_empty(), "tags with no entry: {missing:?}");
}

#[test]
fn every_indexed_tag_is_defined() {
    let defined = defined_tags();
    let unknown: Vec<String> = index()
        .into_keys()
        .filter(|tag| !defined.contains(tag))
        .collect();
    assert!(
        unknown.is_empty(),
        "tags README.md and the skill do not define: {unknown:?}"
    );
}

#[test]
fn every_entry_exists() {
    let functions = core_functions();
    let game = root().join("vectors/game");
    let missing: Vec<String> = index()
        .into_iter()
        .flat_map(|(tag, entries)| entries.into_iter().map(move |entry| (tag.clone(), entry)))
        .filter(|(_, entry)| match entry.strip_prefix("test:") {
            Some(function) => !functions.contains(function),
            None => !game.join(format!("{entry}.json")).is_file(),
        })
        .map(|(tag, entry)| format!("{tag}: {entry}"))
        .collect();
    assert!(missing.is_empty(), "entries that do not exist: {missing:?}");
}
