# Vectors

Golden vectors that every target of the core must reproduce (README §6.6). They are generated;
never edit them by hand. CI regenerates them and fails on any difference (`scripts/check-drift.sh vectors/`).

| Path | Content | Written by |
|---|---|---|
| `format/journal-*.json` | Journal bytes v1 (README §6.3): valid journals, and one malformed journal per decoder rule | `cargo run -p jiro-tools --locked -- vectors` |
| `format/level-*.json` | Level bytes v1 (README §5): valid levels, one invalid level per range and validity rule, and the §5 worked examples | `cargo run -p jiro-tools --locked -- vectors` |
| `game/*.json`, `game/*.trace` | Game vectors (README §6.6): a level and a journal, with the Outcome or error that replay returns, and the trace of state hashes v1 | `cargo run -p jiro-tools --locked -- vectors` |
| `derivations.json` | Level seeds and deflection keys, level ids, boss starts, draws and run commitments (README §6.4, §8.2), computed with ethers | `node tools/xcheck/derivations.mjs --write` |

Kinds and fields:

- **`journal`:** `kind`, `name`, `input`, then `reencoded` (the decoded journal encoded again, equal to `input`) or `error` (the code of README §6.3).
- **`level`:** `kind`, `name`, `input`, then `levelId` and `reencoded`, or `error` (the code of README §5).
- **`game`:** `kind`, `name`, `covers` (README sections and rule tags), the replay inputs `rulesVersion`, `level`, `runNonce`, `levelIndex`, `mode`, `weightBp` and `journal`, then `outcome` (the eleven fields of README §7.3) or `error` (the code of README §6.3), then `trace` and `traceKeccak`. A trace holds the 32-byte state hash of every processed tick, in tick order.

Byte strings are lowercase hex with a `0x` prefix, and integers are JSON numbers.

The scenarios live in `tools/src/scenarios/`. Each states what the core must return for its bytes, and generation stops if the core disagrees. `core/tests/vectors.rs` and `core/tests/derivations.rs` check the core against every file here.

To regenerate after a change that is meant to move them (see the sync table in `CLAUDE.md`):

```bash
cargo run -p jiro-tools --locked -- vectors
npm --prefix tools/xcheck ci && node tools/xcheck/derivations.mjs --write
```
