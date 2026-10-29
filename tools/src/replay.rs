//! `jiro-tools replay`: replays a level and a journal natively, prints the Outcome and the final
//! state hash, and helps find where another target disagrees (README §6.6, Diagnosis).
//!
//! replay (--vector <file> [--journal <file>] | --level <file> --journal <file> [--weight <bp>])
//!        [--dump-tick <t> [--diff <hex>]]

use std::fs;

use jiro_core::hash::{preimage, state_hash};
use jiro_core::replay::{Outcome, replay_observed};

use crate::json::{hex, parse_hex};
use crate::preimage;

const USAGE: &str = concat!(
    "usage: jiro-tools replay (--vector <file> [--journal <file>] | --level <file> ",
    "--journal <file> [--weight <bp>]) [--dump-tick <t> [--diff <hex>]]"
);

#[derive(Default)]
struct Args {
    vector: Option<String>,
    level: Option<String>,
    journal: Option<String>,
    weight: Option<u16>,
    dump_tick: Option<u16>,
    diff: Option<String>,
}

pub fn run(args: &[&str]) -> Result<(), String> {
    let args = parse(args)?;
    let (level, journal, weight_bp) = inputs(&args)?;
    let mut hashes = Vec::new();
    let mut dumped = None;
    let result = replay_observed(&level, &journal, weight_bp, |game| {
        let tick = game.ticks_used - 1;
        if args.dump_tick == Some(tick) {
            dumped = Some(preimage(game));
        }
        hashes.push(state_hash(game));
    });
    let outcome = result.map_err(|error| {
        format!(
            "replay rejects the journal: error {} ({error:?})",
            error.code()
        )
    })?;
    print_outcome(&outcome);
    if let Some(tick) = args.dump_tick {
        let ours = dumped.ok_or(format!("the level ended before tick {tick}"))?;
        println!("tick {tick} preimage: {}", hex(&ours));
        for line in preimage::describe(&ours)? {
            println!("  {line}");
        }
        if let Some(theirs) = &args.diff {
            let differing = preimage::diff(&ours, &parse_hex(theirs)?)?;
            println!(
                "fields that differ from the other preimage: {}",
                differing.len()
            );
            for line in differing {
                println!("  {line}");
            }
        }
    }
    let last = hashes.last().ok_or("no tick was played")?;
    println!("final state hash:");
    println!("{}", hex(last));
    Ok(())
}

fn parse(args: &[&str]) -> Result<Args, String> {
    let mut parsed = Args::default();
    let mut rest = args.iter();
    while let Some(&flag) = rest.next() {
        let value = rest
            .next()
            .ok_or(format!("{flag} needs a value; {USAGE}"))?
            .to_string();
        let number = |value: &str| {
            value
                .parse()
                .map_err(|_| format!("{flag}: not a number: {value}"))
        };
        match flag {
            "--vector" => parsed.vector = Some(value),
            "--level" => parsed.level = Some(value),
            "--journal" => parsed.journal = Some(value),
            "--weight" => parsed.weight = Some(number(&value)?),
            "--dump-tick" => parsed.dump_tick = Some(number(&value)?),
            "--diff" => parsed.diff = Some(value),
            _ => return Err(format!("unknown flag {flag}; {USAGE}")),
        }
    }
    if parsed.diff.is_some() && parsed.dump_tick.is_none() {
        return Err(format!("--diff needs --dump-tick; {USAGE}"));
    }
    Ok(parsed)
}

/// The level bytes, the journal bytes and the weight: from the vector, with its journal replaced
/// by `--journal` if given, or from the level and journal files.
fn inputs(args: &Args) -> Result<(Vec<u8>, Vec<u8>, u16), String> {
    let read = |path: &str| fs::read(path).map_err(|e| format!("{path}: {e}"));
    match (&args.vector, &args.level, &args.journal) {
        (Some(path), None, journal) => {
            let text = fs::read_to_string(path).map_err(|e| format!("{path}: {e}"))?;
            let vector: serde_json::Value =
                serde_json::from_str(&text).map_err(|e| format!("{path}: {e}"))?;
            let field = |name: &str| {
                vector[name]
                    .as_str()
                    .ok_or(format!("{path}: no field {name}"))
            };
            let journal = match journal {
                Some(journal) => read(journal)?,
                None => parse_hex(field("journal")?)?,
            };
            let weight = vector["weightBp"]
                .as_u64()
                .and_then(|weight| u16::try_from(weight).ok())
                .ok_or(format!("{path}: no field weightBp"))?;
            Ok((
                parse_hex(field("level")?)?,
                journal,
                args.weight.unwrap_or(weight),
            ))
        }
        (None, Some(level), Some(journal)) => {
            Ok((read(level)?, read(journal)?, args.weight.unwrap_or(10_000)))
        }
        _ => Err(USAGE.to_string()),
    }
}

fn print_outcome(outcome: &Outcome) {
    println!("journalHash {}", hex(&outcome.journal_hash));
    println!("levelId {}", hex(&outcome.level_id));
    println!("runNonce {}", hex(&outcome.run_nonce));
    println!("levelIndex {}", outcome.level_index);
    println!("drawSlot {}", outcome.draw_slot);
    println!("mode {}", outcome.mode as u8);
    println!("rulesVersion {}", outcome.rules_version);
    println!(
        "endReason {} ({:?})",
        outcome.end_reason as u8, outcome.end_reason
    );
    println!("claimBp {}", outcome.claim_bp);
    println!("ticksUsed {}", outcome.ticks_used);
    println!("levelScore {}", outcome.level_score);
}
