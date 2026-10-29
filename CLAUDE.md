# CLAUDE.md

@.claude/AGENTS_COMETH.md
@GUIDELINES.md

## Project

Jiro-ikusu: a territory-capture arcade game, played on a Raspberry Pi Pico or in the browser, with paid Challenge runs verified onchain on Arbitrum.

- [`README.md`](README.md) is the normative specification. If a skill, this file or the plan disagrees with it, the README wins.
- [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) is the work breakdown. Follow its §1 to pick up, claim and finish a work item: one item, one pull request.

## Project rules

- **ethskills.** Use the committed copies under `.claude/skills/`. Never fetch from or send anything to ethskills.com, including the `feedback` skill's POST and the "send a note via feedback" lines of other ethskills, unless the user asks for it in the current session.
- **Status lines.** Milestone-closing PRs update the README status line and the plan's status line.

### Keep related files in sync

**Behavior change** means a change that alters the outcome, error code or trace of a committed vector, or that implements an edit to README §4-§6 rule text made after that rule was first implemented. Implementing a frozen rule for the first time is not a behavior change: `RULES_VERSION` stays, and vectors are added, not modified. M1.9's version gate checks this.

| A change to | Also, in the same PR |
|---|---|
| `core/src/**` that changes behavior | Bump `RULES_VERSION`. Update README §4-§6, and §7.3, §8.2 or §8.4 where the Outcome, the draw or level scores change. Regenerate `vectors/` and explain the moved outcomes. Once M2.6 has merged, rerun the playtest and regenerate its report. Once M2.9 has merged, rerun `calibrate --check`: regenerate the calibration file in place until a season that references it has opened, and write a new calibration file for a new season after that. |
| a byte format | Bump the format's version; regenerate `vectors/format/` |
| `core/src/consts.rs` | README §2, §4 and §5 |
| `levels/src/**` | Rebuild `levels/*.bin` and `levels/README.md`. Once M2.6 has merged, the playtest report. Once M2.9 has merged, the calibration rule above. |
| `seasons/*.json` | README §8.4 and `docs/ECONOMY.md` |
| `contracts/src/**` | README §7 and §8, if a frozen rule or range changes; regenerate `contracts/abi/` (from M4.3); the threat table of `docs/ECONOMY.md`, if a mitigation moved |
| `vectors/**` | Regenerate `vectors/pack.bin` and `firmware/emu/transcripts/` (from M3.3) |

Owners of numbers: README §4 and §5 own the game's rule numbers and defaults; README §7 and §8 own those of runs, settlement and seasons, parameter ranges included; `levels/README.md`, generated from `levels/src/`, owns the per-level knobs; `seasons/*.json` own the season parameters; `docs/ECONOMY.md` derives from them and owns none.
