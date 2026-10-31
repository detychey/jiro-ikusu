# playtest-human-1

The user's play test of the 16 levels (plan M2.9, round D6), on the preview of PR #36, https://pr-36.jiro-ikusu.pages.dev, at commit 02cc2dc. The user's result, copied from their message of 2026-10-31:

> playtest looks good

No level was reported as feeling wrong, so no level changes.

## Journals

The user shared two journals from the play test, kept in `playtest-human-1/`. Both replay natively, at the weight of 10,000 bp that the game page plays at:

| Journal | Level | End | Claim | Ticks | Journal hash |
|---|---|---|---|---|---|
| `11-labyrinth.jrn` | `levels/11-labyrinth.bin` | Cleared | 8444 bp | 163 | `0xcf4b17de7975f0ed35475ba10f6fc51b1cfb8aa24d09e6f518eab30bd9934867` |
| `open-field.jrn` | the game page's "Open field", `vectors/format/level-open-field.json` | Cleared | 8644 bp | 333 | `0xf4094f1ca89097a6e4ca95bb939fec69208bcfcfaa9c164dbcaf9c11602c38ba` |

Reproduce with `cargo run -p jiro-tools --locked -- replay --level levels/11-labyrinth.bin --journal reports/playtest-human-1/11-labyrinth.jrn`. The open field's level bytes are the `input` of its format vector.
