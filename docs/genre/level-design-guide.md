# Level design guide

For Jiro-ikusu's level designers: a summary of the genre research in this folder (710 games in [`CATALOG.md`](CATALOG.md), 628 mechanic families in [`TAXONOMY.md`](TAXONOMY.md), 142 judged ideas in [`IDEAS.md`](IDEAS.md); [method](README.md#how-it-was-built)), plus the minimum how-to: today's knobs, tools and calibration chain.

**Status: non-normative.** README §4 and §5 own the rules, their defaults and the [level format](../../README.md#5-levels), §7 and §8 runs, settlement and seasons; [`levels/README.md`](../../levels/README.md) owns the per-level knobs; [`levels/targets.json`](../../levels/targets.json) the reference bot mix, target clear rates, tolerance and floor; `seasons/*.json` the season parameters ([`CLAUDE.md`](../../CLAUDE.md), Owners of numbers). They win over this guide. The research is "research notes, not a specification ... Nothing here is scheduled or decided" ([README.md](README.md), status line).

How to read it:

- **Today** marks what exists (level bytes v1, the 16 levels, tools, committed reports); **Proposal** marks research content, none built or scheduled.
- `reports/` numbers are measurements. Idea-page numbers are agents' estimates unless they cite a report; their trial runs "were not repeated and are not committed" ([Limits](README.md#the-taxonomy-and-the-ideas)): this guide marks them *scratch*. Their files (sim_boss.py, gen_levels.py, work/lv, 16-mines) are not in the repository: rebuild from the rule sketch. *Computed*: derived here from committed files (reports, calibration-1, `levels/src/`); *derived*: worked out from rule text; neither is measured.
- **Score** sums three judges' 1-5 scores, out of 15. **Gap** is the fairness judge's view of the search-versus-human gap, a judgment, not a measurement ([IDEAS.md](IDEAS.md)). Judges scored ten ideas at a time and batches were never compared ([Limits](README.md#the-taxonomy-and-the-ideas)); a one-point difference is noise (IDEAS.md).
- **Tiers:** T0 client only; T1 new levels on v1 knobs; T2 per-level fields in a format v2, "usually with T3"; T3 a new core rule. **Verdicts** in §4 are this guide's: **In the 16** (Today); **v1 knobs, not in the 16**, **Format v2**, **New core rule** (Proposal); **Out of scope**, a reading of README rules, not a research verdict.
- **Codes** ([README §13](../../README.md#13-open-decisions)): D4 trail blocks, no fuse; D5 no lives, score 0; D6 one shield charge; D9 one B × B boss; D13 game titles here only cite where a pattern comes from; D14 the seed keeps steering the boss, so no two runs share a game. P11: the mix, targets, tolerance and floor. R4.x, PIN-xx: README §4 tags; M-numbers: plan items.

**Making a board now?** Read [§1.2](#12-validity-and-what-no-tool-checks), [§3](#3-how-the-16-levels-ramp) (What moves the clear rate), [§6](#6-patterns-to-avoid), [§7.4](#74-d14-and-safe-pockets) and [§2.4](#24-steps-to-ship-a-board).

## 1. What a level is today

**Today.** A level is 472 bytes of level bytes v1; the core rejects the first broken rule with its code ([README §5](../../README.md#5-levels)). The 16 levels are frozen: after M2.9, "a level change or a `RULES_VERSION` bump follows the `CLAUDE.md` calibration rule, and its PR lists the measurements it invalidates" (IMPLEMENTATION_PLAN.md, M2.9).

### 1.1 The knobs

| Knob (source) | Allowed (code) | In play | The 16 use |
|---|---|---|---|
| Obstacles (`#`) | border bits 0 (22); validity 35-36 | `CLAIMED` (R4.1-7): walls, anchors, rail beside open field; never claimable (R4.1-8) | 6 levels, 83-256 cells (*computed*) |
| `boss_size` B | 2-8 (23); default 5 | B × B body bouncing off `CLAIMED` and `TRAIL` (R4.6-2, R4.6-3) | 4-8 |
| `boss_spawn=x0,y0,x1,y1` | ordered (24); x0, y0 ≥ 1, x1, y1 ≤ 59 − B (25); body on open cells (37) | Top-left start cells; the seed picks one; at most 3,249 (README §6.4) | 30 (maze) to 506 (comb) (*computed*) |
| `boss_period` | ≥ 1 (26) | Moves when `tick % N == 0`, global phase (R4.4-2) | 3, 2, then 1 from 05 |
| Minions (`m`) | 0-3 (27); on rail (38) | Row-major slots; rail only, right-hand rule, clockwise (R4.7-1 to R4.7-3) | 0-3, all on the border |
| `minion_period` | ≥ 1 with minions, else 0 (30) | One for all (R4.7-10) | 3, 2 or 1 |
| `respawn_delay` R | ≥ 1 with minions, else 0 (31); u16 | Stranded at tick t, back at t + R − 1 (R4.7-7 to R4.7-9) | 45, 60, 90 |
| `time_limit` T | 1-2,700 (32); default 2,700 = 3 min | Ends after tick T − 1, claim kept (R4.10-4) | 2,700 |
| `lives` | ≥ 1 (33); default 3 | Losing the last life scores 0 (D5) | 2-5 |
| `target_bp` | 1-10,000 (34); default 7,500 | Cleared when `claim_bp` reaches it (PIN-10) | 7,500-9,000 |

**Not knobs:** the 60 × 60 grid (R4.1-1); four cell states, so no lethal terrain (R4.1-2); the start (30, 59) and 1 shield charge (PIN-01, D6); one boss; one minion period and R; minion headings (R4.7-3). They need a new byte format and usually a rule change ([§8](#8-levers-that-may-come-proposals)).

### 1.2 Validity, and what no tool checks

**Today** ([README §5](../../README.md#5-levels), Validity): (35) the open area (`EMPTY` at start) is one 4-connected region (36) of at least 1,682 cells; (37) the body fits on open cells from every spawn cell; (38) each minion spawn is a `CLAIMED` cell with an open 8-neighbor; (39) the start (30, 59) is rail: keep one of (29, 58), (30, 58), (31, 58) open.

Check these, and boss-free pockets ([§7.4](#74-d14-and-safe-pockets)), yourself; no tool does:

- **Target above the ceiling** (claimable − B²) × 10,000 / claimable ([bot-advantage](../../reports/bot-advantage.md#score-ceiling)); maze's 9,000 is under its 9,884. `level build` accepts it (rule 34 allows up to 10,000); only `playtest --check` catches it, indirectly, as a 0 % clear rate.
- **Walls one cell thick stay rail.** Rail counts all 8 neighbors (R4.2-1); a minion is stranded only when its cell loses every open 8-neighbor. *Scratch* (a top-border comb, 3-wide bays): sealing a bay between 1-cell bars left all 11 wall cells on each side on the rail (the 3 back-wall cells left it); with 2-cell bars every wall cell left it ([Stranded minions](ideas/capture-rules.md#stranded-minions-never-respawn), core engineer). To strand, make walls at least 2 thick (Stranded minions, core engineer and play) and enclose islands so that no open 8-neighbor remains (Guarded islands, core engineer). Comb's teeth are 1 thick.
- **An island is a bridge before it is a capture.** A cut that closes on an island separates no region: it claims its trail, plus any pocket the path wraps, and joins the island to your rail, opening it to border minions ([Low target](ideas/scoring-and-risk.md#low-target-where-the-crossing-cut-decides-the-score), core engineer and play).
- **Where a stranded minion comes back.** At its spawn or, if that left the rail, at the first rail cell in row-major order, usually top-left, where it can hit a player (PIN-11): "Bots know this and humans won't" ([Guarded islands](ideas/edge-and-claimed-enemies.md#guarded-islands-release-or-remove-the-guard), fairness). R ≥ T avoids it.
- **Patrol direction.** Minions circle clockwise (R4.7-3), west along the bottom border. One spawned at (31, 59) steps onto the start at tick 0 and hits a player standing still; one at (30, 59) steps to (29, 59) and hits a player stepping west (*derived*, R4.7-3, R4.4-2, R4.9-9). A bottom-border minion "must not spawn on or next to the player start" ([Lesson ladder](ideas/level-structure-and-progression.md#lesson-ladder), fairness).

### 1.3 What the seed decides

**Today.** The level seed ([README §6.4](../../README.md#64-seeds-and-commitments)) picks the boss's start and diagonal, and the deflection key: a quarter turn on 1 move in 32, "about 42 times in a 2,700-tick level at move period 2"; with deflections the open-field body "passes over 95% of the interior" ([README §4.6](../../README.md#46-boss), Play). It cannot undo a layout's pockets ([§7.4](#74-d14-and-safe-pockets)), and nothing about minions is seeded.

**Count boss moves.** The boss moves on ticks 0, p, 2p, … up to T − 1 (R4.4-1, R4.4-2). R4.6-12's divergence bound (N = 400 moves) holds "by tick 399 × the move period in a level that lasts that long", so keep T > 399 × period: T ≥ 799 at period 2, T ≥ 1,198 at period 3 (*derived*); at T 2,700, period 1-6, the range M1.5 tests. Below 400 moves, two runs end on the same trajectory with probability 6 × 10^−10 at period 8 and 2 × 10^−5 at period 16 (README §4.6, Limits of N). For T 900 at period 3 (300 moves), one fairness judge judged the risk "still negligible, but the README should say so" ([Short, forgiving set](ideas/human-edge.md#short-forgiving-high-target-level-set)).

### 1.4 Claim, clear and score

- `claim_bp = captured × 10,000 / claimable`, rounded down; claimable = cells `EMPTY` at start (R4.1-8). **Ceiling** on an open field: 9,952 for B 4, 9,925 for B 5, 9,809 for B 8 ([bot-advantage](../../reports/bot-advantage.md#per-level)).
- **Cut time.** The first step off the rail is single (R4.5-6): an 8-cell seal took 5 ticks, not 4 ([Boss-trap rooms](ideas/multiplayer-and-competition.md#boss-trap-rooms-sealed-at-the-door), core engineer).
- **Ends**, first met: X, target reached (Cleared), no lives (score 0), tick T − 1; all but no lives keep the claim ([README §4.10](../../README.md#410-end-of-level)).
- **Effective claim** = `claim_bp`, or 0 when the lives ran out; playtest and calibration use it.
- **Level score** = `claim_bp × weight_bp / 10,000`, rounded down, and 0 when the lives ran out ([README §8.4](../../README.md#84-season-scoring)). The clearing capture's overshoot is score.

## 2. Making a level today

### 2.1 Source and tools

**Today.** `levels/src/NN-name.txt`, NN 01-16: the eight `key=value` knobs of §1.1 in its order, a blank line, then 60 rows of 60 cells (`#` obstacle, `.` open, `m` minion spawn), LF line endings and a final newline ([`levels/README.md`](../../levels/README.md)). The browser **level editor** reads and writes `.bin` and hex ([web/README.md](../../web/README.md#level-editor)): save `level render <file.bin>` as the source, since CI requires each source to be exactly that render. **Browser Training** plays any other level unscored and offers each attempt's journal ([web/README.md](../../web/README.md#training)); `replay --level <bin> --journal <jrn>` replays them ([playtest-human-1](../../reports/playtest-human-1.md)).

Run `cargo run -p jiro-tools --release --locked -- <command>` (nightly.yml uses `--release` for playtest and calibrate; `level build` is the same without it):

- `level build <src> <out>` writes `NN-name.bin` and the README (a broken source writes nothing); also `level validate`, `id`, `render`.
- `playtest` (`--levels --only --runs --seed --policy --out --check <targets.json>`) plays the mix (default 1,000 runs, seed 1) or one policy; `--check` fails a level outside its band or with a median at or below the floor. Only the default mix run may omit `--out`.
- `calibrate --out <file>` (`--levels <dir> --check`) needs 01-16 and `<levels>/targets.json`; it writes `--out`, a report and the gate set `vectors/levels/NN-worst`, `NN-synthetic` under the directory above `--out`'s.

**Iterate on a scratch copy** ([bold-sweep](../../reports/bold-sweep.md)): sources in `<dir>/src`, `level build <dir>/src <dir>`, `levels/targets.json` copied into `<dir>`, then `playtest --levels <dir> --runs 300 --seed 1 --out <dir>/out`, adding `--check <dir>/targets.json` with your slot's NN. To preview weights, build all 16 into `<dir>` and run `calibrate --levels <dir> --out <dir>/seasons/x.json`. Locally: playtest about 30 s, `calibrate --check` about 75 s ([TOOLING.md](../TOOLING.md)).

### 2.2 The sync chain and the version gate

**Today.** Per [`CLAUDE.md`](../../CLAUDE.md), a change to `levels/src/**` reruns steps 3-5 and 7 of [§2.4](#24-steps-to-ship-a-board), one to `levels/targets.json` or `tools/src/bots/**` steps 4-5 and 7. Step 7 rewrites `seasons/calibration-1.json`, so CLAUDE.md's `seasons/*.json` row asks for README §8.4 and `docs/ECONOMY.md` in the same PR. [bot-advantage](../../reports/bot-advantage.md) scores its runs at calibration-1's weights and [ECONOMY.md](../ECONOMY.md#5-bot-advantage-m413) quotes it, so both go stale: list them as invalidated, or rerun the study (about 15 h on 4 CPUs, plan M4.13). ci.yml rebuilds and drift-checks `levels/`, validates every source and `.bin`, and fails if a source differs from its `.bin`'s `level render`; nightly.yml reruns steps 4, 5 and 7 weekly.

**The version gate.** `calibrate` rewrites `vectors/levels/NN-worst` and `NN-synthetic` in place (tools/src/calibrate.rs). `scripts/check-rules-version.sh`, in ci.yml's vectors-drift step (pushes to main, and PRs touching a `rust`-filter path, `levels/` and `vectors/` included), fails when a file under `vectors/game/` or `vectors/levels/` is modified or deleted unless `RULES_VERSION` changes, and then needs every game vector regenerated at the new version. A bump costs "regenerated vectors, a playtest rerun, recalibration, a new ZkReferee image and a new season" ([Sequencing](README.md#sequencing), step 5). Agree with the owner first: a bump, or a gate or tools change in its own work item. The research's [New boards on v1 knobs](README.md#new-boards-on-v1-knobs) ("no RULES_VERSION bump") and Sequencing step 4 ("rules still 2") assume a new gate set beside the old one ([Topology season](ideas/v1-levels.md#topology-season-one-field-shape-per-slot), core engineer, Cost); today's calibrate does not.

**The calibration file** is regenerated in place "until a season that references it has opened" (CLAUDE.md); none has: no public deployment record is committed ([deployments](../../deployments/README.md#networks)). M4.14 opens `testnet-0` with calibration-1's ids and weights; after that a level change writes a new calibration file and reaches players only through a new season. The Training page, the contract scripts and tools/src/playtest/shard.rs read `seasons/calibration-1.json` by name, so a second file also needs a tools change ([§8.4](#84-tools-prerequisites)).

### 2.3 Season slots and the 16-level limit

**Today.** No 17th or Training-only slot exists: the level tool, playtest, calibrate, `core/src/consts.rs` and Training ("All 16 levels", [README §8.1](../../README.md#81-training-free)) expect 16. Browser Training throws if its bundled levels are not the calibration's 16 (web/src/pages/training.ts), so an extra `.bin` in `levels/` breaks it; the Challenge page checks the same files against the open season's ids (web/src/run/season.ts).

**Pick the slot.** A new board replaces one slot: its NN selects `clear_rate_pct[NN − 1]` (playtest.rs, `check`). Hit that band, or change the curve: P11 keeps it non-increasing, from at least 90 % at level 1 to about 15 % at level 16, within ±5 points over 1,000 seeds, and the owner approves the curve and the floor (plan M2.6); then retune every level. **Proposal:** generalize the tools first ([§8.4](#84-tools-prerequisites)).

### 2.4 Steps to ship a board

**Today.**

0. **Get a work item** of its own ([README.md](README.md), status line), one per PR (CLAUDE.md). Settle the version gate with the owner ([§2.2](#22-the-sync-chain-and-the-version-gate)).
1. **Pick the slot** whose band the board hits ([§2.3](#23-season-slots-and-the-16-level-limit); fits in [§5](#5-board-patterns-on-v1-knobs-proposals)).
2. **Author** the board; pick knobs from [§3](#3-how-the-16-levels-ramp); pass codes 20-39; run the checks of [§1.2](#12-validity-and-what-no-tool-checks), [§6](#6-patterns-to-avoid), [§7.4](#74-d14-and-safe-pockets) and [§7.6](#76-research-recommendations-proposals); iterate on scratch.
3. `level build levels/src levels`; record the new `level_id`.
4. `playtest --levels levels --check levels/targets.json`: clear rate in target ± 5, median above 500 bp. It writes `reports/playtest-<hash>`, the hash covering the level ids; delete the old `.md` and `.json` by hand.
5. `level build` again, for the measured clear rates.
6. **Owner approval** of the layout (`levels/README.md` preview) and bot numbers, playable on the PR preview (plan M2.7).
7. `calibrate --check --out seasons/calibration-1.json`: compare your weight with 13,692-64,620; P moves when the lowest median moves ([§7.2](#72-weights-p-and-the-floor)). In place only while no season references it; update README §8.4 and `docs/ECONOMY.md`.
8. Commit the regenerated files. Then, on a clean tree, rerun steps 3-5 and 7 and run `bash scripts/check-drift.sh seasons/ levels/ vectors/ reports/` (it fails on any uncommitted, staged or untracked change), then `bash scripts/check-rules-version.sh`.
9. **Gate-set cost.** `10-worst`, the heaviest today, takes 29.6 million RISC Zero user cycles and 11.6 million Stylus gas (README §13, D2). Measure the new `NN-worst` and `NN-synthetic`: `bash scripts/bootstrap.sh zk`, `cargo build --release --locked --manifest-path referee/zk/Cargo.toml -p zk-host` (a clean build takes about an hour, [VERIFICATION.md](../VERIFICATION.md#m112-the-choice)), then `referee/zk/target/release/zk-host execute vectors/levels` ([cycles per vector](../VERIFICATION.md#executor-cycles-per-vector-1)). The research's bar: neither above `10-worst`, else raise the target or cut T ([Tree maze](ideas/v1-levels.md#tree-maze-every-seal-cuts-off-a-subtree), core engineer).
10. List invalidated measurements in the PR: gate-set cycles and gas, bot-advantage, ECONOMY.md's results.
11. **The clients ship one level set.** The site bundles `levels/*.bin` for Training, Challenge and settlement (web/src/shipped.ts, pages/season.ts); Challenge refuses a run unless the 16 shipped levels are the open season's `levelIds`, slot by slot ([web/README.md](../../web/README.md#challenge)); `main` deploys production on every push (pages.yml). Once a season is open (M4.14 opens `testnet-0` with calibration-1's ids), merging a board into `levels/` stops the site playing and settling that season: merge only at a season boundary agreed with the owner, or after a tools and web change. **Proposal:** a level directory per season ([New boards on v1 knobs](README.md#new-boards-on-v1-knobs), step 5; Topology season, core engineer).

## 3. How the 16 levels ramp

**Today.** Knobs from `levels/README.md`; mix clear rate, deaths and median ticks from the [playtest report](../../reports/playtest-449f231636aa.md); weight from [calibration-1](../../reports/calibration-1.md); obstacle cells *computed*. T = 2,700 everywhere.

| # | Name | B | Boss P | Minions × P (R) | Lives | Target | Layout (obstacle cells) | Clear % target / mix | Mix deaths % / ticks | Weight |
|---|---|---|---|---|---|---|---|---|---|---|
| 01 | open | 5 | 3 | none | 5 | 7,500 | open | 95 / 94.8 | 1.5 / 352 | 15,503 |
| 02 | sentry | 5 | 3 | 1 × 3 (90) | 4 | 7,500 | open | 90 / 87.1 | 3.7 / 345 | 15,586 |
| 03 | heavy | 8 | 2 | 1 × 3 (90) | 5 | 7,500 | open | 85 / 83.8 | 5.1 / 431 | 15,770 |
| 04 | pair | 4 | 2 | 2 × 3 (90) | 4 | 7,500 | open | 80 / 79.4 | 6.6 / 368 | 15,758 |
| 05 | comb | 5 | 1 | 2 × 2 (60) | 4 | 7,500 | teeth, 7-wide corridors (204) | 74 / 72.9 | 9.7 / 481 | 15,841 |
| 06 | serpent | 6 | 1 | 2 × 2 (60) | 3 | 7,500 | 3 bars, 12-cell doors (138) | 68 / 66.4 | 12.1 / 410 | 15,879 |
| 07 | rush | 5 | 1 | 2 × 2 (60) | 5 | 8,000 | open | 62 / 60.1 | 15.2 / 619 | 14,962 |
| 08 | storm | 6 | 1 | 2 × 1 (90) | 5 | 8,000 | open | 56 / 55.8 | 17.3 / 619 | 14,979 |
| 09 | cross | 6 | 1 | 2 × 2 (60) | 3 | 8,000 | 4 rooms, 8-cell doors (83) | 50 / 52.7 | 17.8 / 500 | 14,994 |
| 10 | maze | 6 | 1 | 3 × 1 (45) | 3 | 9,000 | 5 bars, 10-cell doors (240) | 44 / 46.5 | 21.6 / 621 | 13,692 |
| 11 | labyrinth | 7 | 1 | 3 × 1 (45) | 2 | 8,000 | 3 bars, 8-cell doors (150) | 38 / 39.2 | 23.5 / 314 | 18,888 |
| 12 | ring | 7 | 1 | 3 × 1 (45) | 3 | 7,650 | 16 × 16 island (256) | 33 / 33.4 | 28.4 / 404 | 21,586 |
| 13 | trio | 5 | 1 | 3 × 2 (60) | 3 | 7,500 | open | 28 / 29.8 | 30.4 / 358 | 35,513 |
| 14 | titan | 8 | 1 | 2 × 1 (45) | 4 | 8,150 | open | 23 / 22.8 | 34.9 / 516 | 28,591 |
| 15 | swarm | 7 | 1 | 3 × 1 (45) | 3 | 7,500 | open | 19 / 19.7 | 36.3 / 354 | 50,590 |
| 16 | doom | 8 | 1 | 3 × 1 (45) | 3 | 7,500 | open | 15 / 15.3 | 38.9 / 332 | 64,620 |

**What moves the clear rate** ([bold-sweep](../../reports/bold-sweep.md): 01's source, B 5, spawn (20, 20)-(34, 34), 3 lives unless stated, 300 runs; the B 8 and comb rows also move the spawn):

| Change | Mix clear | Mix median (bp) |
|---|---|---|
| Period 3, 5 lives (L01) | 95.5 % | 7,749 |
| Period 3 / 2 / 1 | 72.5 / 56.5 / 36.8 % | 7,636 / 7,517 / 4,714 |
| Period 1, three period-1 minions, R 30 | 28.8 % | 3,504 |
| B 7, period 1 | 19.8 % | 2,488 |
| B 7, period 1, two period-1 minions, R 45 | 19.5 % | 2,607 |
| B 8, period 1, three period-1 minions, R 30 | 18.6 % | 2,461 |
| The same, 5 lives | 54.1 % | 7,508 |
| B 4, period 1, comb teeth | 66.6 % | 7,560 |

*Computed:* lives 3 → 5 add 23 points at period 3 and 35.5 on the B 8 row; three period-1 minions take 8 points at B 5, two take 0.3 at B 7; the comb row also drops B from 5 to 4, so not all of its gain over 36.8 % comes from the corridors. Greedy clears 95.3-100.0 %. Corridors raise the rate (bold-sweep), so a corridor level "needs a faster or larger boss, or more minions, to stay in its band" (IMPLEMENTATION_PLAN.md, M2.7).

**Left unused:** T below 2,700; B 2-3; periods above 3; R outside 45-90; 1 life or more than 5; targets outside 7,500-9,000; minions off the border. A median mix run scores 11,999 on every level ([§7.2](#72-weights-p-and-the-floor)): a new level must be distinct and calibratable, not merely harder.

## 4. Lessons from the genre

Game counts are "an estimate, not a census" ([TAXONOMY.md](TAXONOMY.md)).

### 4.1 Terrain

- [Non-rectangular outlines](taxonomy/terrain-and-geometry.md#non-rectangular-field-outlines) (18 games): **v1 knobs, not in the 16.** Fill the outside with `#`: the outline becomes rail and anchor, and the claim counts only the shape. Drawing it as void, not captured land (R4.1-4), is T0 ([Shaped arenas](ideas/terrain-and-geometry.md#shaped-arena-outlines)).
- [Interior obstacles](taxonomy/terrain-and-geometry.md#interior-obstacles-and-walls) (28): **In the 16** (6 levels); walls are anchors, but a first cut onto an island claims little ([§1.2](#12-validity-and-what-no-tool-checks)). Walls that cannot close a cut (Fortix 2009): **New core rule**.
- Pre-claimed territory (11): islands **In the 16** (12 ring); starting on one, **Format v2** + PIN-01 ([Island start](ideas/terrain-and-geometry.md#island-start)).
- [Lethal terrain](taxonomy/terrain-and-geometry.md#lethal-static-terrain-and-traps) (15), mines: **New core rule.** v1 stand-in: an `m` on a one-cell pillar never moves (PIN-18); closing a cut on it is a hit and wakes it (Pillar lattice, core engineer).
- Obstacles removed by enclosure (5): **New core rule.** v1 stand-in: enclosing an island strands its guard (R4.7-7) if no open cell touches the island afterwards.
- [Lane lattice of boxes](taxonomy/terrain-and-geometry.md#lane-lattice-of-boxes) (6; Amidar 1982), [pocketing and herding walls](taxonomy/capture-rules.md#pocketing-and-herding-walls) (8): corridors and rooms **In the 16** (05, 06, 09-11); line-and-box capture **Out of scope** (v1 approximations in [§5](#5-board-patterns-on-v1-knobs-proposals)).
- Field size (9): **Out of scope** (R4.1-1). Wrap-around (2), shrinking areas (5), fault lines (2): **New core rule** (`CLAIMED` never reverts, R4.8-4).

### 4.2 Enemies

**The boss.** The genre has bouncing balls (57 games), homing chasers (45) and patterned movers (15). Jiro's boss bounces; it hits you when it bumps your trail (R4.9-2) or you step onto its body (R4.9-3). You set B, period and spawn zone, not the route (**In the 16**). A learnable fixed route: **Out of scope** in Challenge (D14); for Training only the research keeps it as **New core rule** ([Fixed-path puzzle rooms](ideas/modes-and-meta.md#fixed-path-puzzle-rooms), 11, neutral), whose play judge notes that level bytes plus a fixed run nonce already replay identically. A per-level deflection rate: **Format v2**. Homing, shots, phases, a second boss (D9): **New core rule**.

**Minions.** [Border patrollers](taxonomy/edge-and-claimed-enemies.md#border-patrollers-sparx) appear in 62 games; Qix's (1981) [Super Sparx](taxonomy/edge-and-claimed-enemies.md#escalating-and-timer-released-patrollers-super-sparx) chase onto the unfinished line. Jiro's minions walk rail only, cover their rail component (PIN-14) and never hit a player standing on the trail (R4.7-1, R4.9-8). **The patrol route is the geometry:** on comb a border minion runs down and up every tooth; an island is a separate track.

- A guard circling an island rim, released onto your rail when you annex the island (R4.7-4, R4.7-8): **v1 knobs, not in the 16** (Guarded islands).
- Permanent kill by enclosure: **v1 knobs, not in the 16**, R ≥ T, e.g. R 3,000 with T 2,700 (Stranded minions), for a minion whose cell keeps no open 8-neighbor.
- Opposite-direction, timer-released or trail-chasing patrollers: **New core rule** (D4 for the trail). Speeds per minion: **Format v2** ([§8.2](#82-level-format-v2-per-level-knobs)). More than 3: both (bytes and state hash hold 3).

### 4.3 Ramps, goals and timers

The genre default is a [per-level enemy ramp](taxonomy/level-structure-and-progression.md#per-level-enemy-ramp) (85 games) toward an area threshold, with new types staged in (25) and a rising threshold (15).

- More, faster enemies (Xonix 1984); rising threshold (Trix 1988); lives per level (JezzBall 1992); boss stages (28): **In the 16**.
- Set-piece breaks (Frenzy 1984): **v1 knobs, not in the 16**; a low-target first-cut jackpot is excluded ([§6](#6-patterns-to-avoid)).
- New enemy types staged in (Styx 1983), boss scripts, phases at claim thresholds: **New core rule**, seeded (D14); v1 stages only geometry and knob mixes.
- Full coverage (18): **Out of scope** (the body's cells are never claimed). Overfill bonus (28): **In the 16**.
- [Level countdown](taxonomy/controls-time-and-pacing.md#level-countdown-timer) (80; Zoo Keeper 1983 scores what is enclosed at expiry, as Jiro does): **v1 knobs, not in the 16** (T below 2,700).
- [Time-driven escalation](taxonomy/controls-time-and-pacing.md#time-driven-escalation), refills, fuses: **New core rule.** The fuse-like ideas of [open question 5](README.md#open-questions-for-the-owner) (stall fuse, rail rider, breath limit, restless boss) were all judged to widen the gap; Rising tide is rated neutral and Boss hit lights a fuse narrows ([IDEAS.md](IDEAS.md#t3-new-core-rule-68)).

**The clock today** almost never ends a reference-mix run: the mix's time-limit rate is 0.0 % on all 16 levels (one bold run of 1,000 on maze, 0.1 %, did time out), and mix median ticks are 314-621 ([playtest report](../../reports/playtest-449f231636aa.md)). A human cleared labyrinth in 163 ticks at 8,444 bp, against a mix median of 6,353 ([playtest-human-1](../../reports/playtest-human-1.md)). At boss period 1, greedy cleared 49 % with a 700-tick limit and 76 % with 900; the owner chose a bolder bot instead (IMPLEMENTATION_PLAN.md, M2.11).

## 5. Board patterns on v1 knobs (proposals)

**Proposal**, unscheduled. These ten, with (score, gap), are the research's [New boards on v1 knobs](README.md#new-boards-on-v1-knobs) package; **SL #n** marks a [shortlist](README.md#shortlist) item (Lesson ladder, SL #4, is in [§8.3](#83-training-layer-content)). Kept T1 ideas outside it: [Short, forgiving set](ideas/human-edge.md#short-forgiving-high-target-level-set) (10, narrows), [Stranded minions](ideas/capture-rules.md#stranded-minions-never-respawn) (9, neutral), [Boss-trap rooms](ideas/multiplayer-and-competition.md#boss-trap-rooms-sealed-at-the-door) (7, widens). **Fit** is the research's *scratch* mix clear rate against a slot's target.

- **[Slow giant, fast patrol](ideas/v1-levels.md#slow-giant-fast-patrol-hide-in-the-field)** (13, neutral; SL #11). Open field, B 8 at period 5, three period-1 minions, R 30: the field is safe from minions, and stopping mid-cut is a tactic. *Scratch* per-seed boss coverage: 68-96 % over 200 keys. **Fit:** about 64.5 %, slot 07 (62 %). Fixes: target about 8,500, or boss period 4 so a parked cut has a clock (play); before Challenge, a trail-parking policy or human journals, and boss-only coverage at period 5 (fairness).
- **[Street grid](ideas/v1-levels.md#street-grid-seal-segments-to-pen-the-boss)** (13, widens; SL #10). Nine 10 × 10 blocks, 7-wide streets, B 5 at period 1, guards on blocks, R 2,700. **Fit:** about 61.5 %, slot 07. Search solves its two-seal min-cut exactly; "the reference mix seals streets only by accident". Fixes: target about 9,000 (play); boss period 2, and a street-sealing policy or human journals (fairness).
- **[Guarded islands](ideas/edge-and-claimed-enemies.md#guarded-islands-release-or-remove-the-guard)** (12, neutral; SL #12). Annex the island (its guard joins your rail), enclose it (guard destroyed, back after R) or ignore it; a guard threatens only cuts that close on its island and, once annexed, your rail (core engineer). *Scratch* (one 100-run mix trial: two 6 × 6 islands, sentries on the rims, one border minion, R 600): 50.5 % clears, 18 % deaths, median effective claim 7,500 bp; slot 09's target is 50 %. Fixes: R ≥ 600 or ≥ T; gaps at least B wide or patrolled, B + 1 on one side (play).
- **[Shaped arena outlines](ideas/terrain-and-geometry.md#shaped-arena-outlines)** (12, neutral). Disc, octagon, letterbox, plus, twin rooms; arms, necks and lanes at least B + 2. A plus arm is about 19 %; only the twin-room neck gives one cut of about 50 %, "nearly risk-free on many seeds" through an 8-wide neck at B 5 (core engineer). Greedy needs a straight claimed base, so the judges expect calibration to over-weight disc and octagon until greedy is staircase-aware. On staircase rims the core engineer finds no boss-free slivers, the play judge thin bands where notches are narrower than B. Fixes (core engineer): Training first; a staircase-aware greedy; a higher twin-room target or a wider neck.
- **[Short-clock sprint levels](ideas/controls-time-and-pacing.md#short-clock-sprint-levels)** (12, unclear). T 600-900; a late big cut becomes a gamble. On T the judges disagree: 1.2-1.5 × the mix's median ticks (core engineer; §3), or "near the reference mix's median clear tick", e.g. "T 300-450 on an open field and 600 on comb or titan variants", rejecting a level whose time-limit share stays near zero (play). At period 2, T 600 gives 300 boss moves, T 900 450, T 300-450 150-225 (*derived*; under 400, say so in the PR). Keep targets at 7,500 or more and one-life variants out of Challenge (fairness); ship 2-3 (play). The owner chose a bolder bot over short limits (M2.11, [§4.3](#43-ramps-goals-and-timers)): this reopens that decision.
- **[Letterbox band](ideas/v1-levels.md#letterbox-band-one-axis-squeeze)** (11, narrows). Top half solid, B 8 at period 2. **Fit:** about 27.5 %, slot 13 (28 %, core engineer). Fixes: keep period 2 as the dial (fairness); a teaching level early, or for a later slot B 6-7 at period 1, or the band centred on rows 15-44 (play).
- **[Pillar lattice](ideas/wild-combinations.md#pillar-lattice-of-mid-field-anchors)** (11, widens). 36 one-cell pillars; a minion on one is a static mine (PIN-18). Each hop claims only its own trail, and the fence becomes a road for border minions (play). *Scratch:* 71 % mix clears in 100 runs, median 7,551. Fixes: R ≥ T + 1 or no mines; 16-25 pillars.
- **[Tree maze](ideas/v1-levels.md#tree-maze-every-seal-cuts-off-a-subtree)** (11, narrows). Loop-free 3-wide corridors, B 2, target 9,700; the boss visits about 49 % of the maze per level (*scratch*). **Fit:** about 83.6 %, slot 03 (85 %). Fixes: the synthetic policy in the zk executor first (core); lives 2 and target 9,800 at the easy end (fairness); or an 8 × 8 lattice, 5-wide corridors, B 3, one or two loops (play).
- **[Topology season](ideas/v1-levels.md#topology-season-one-field-shape-per-slot)** (12, neutral; SL #13). Sixteen board kinds, scratch mix rates 83.6 % to 25.8 %. Seal-dependent slots grow from 6 to about 10 of 16, the max/min weight from 4.7× to about 5.2×; keep seal-heavy boards Training-only until a seal-aware policy exists (judges).
- **[Calibrated library](ideas/level-structure-and-progression.md#season-levels-drawn-from-a-calibrated-library)** (12, neutral). An offline generator a designer curates.

## 6. Patterns to avoid

| Pattern | Why (source) |
|---|---|
| Target above the ceiling or 10,000 | Never clears; median under the floor, weight about 15 times an ordinary level's ([Bank it](ideas/v1-levels.md#bank-it-a-level-that-never-clears), rejected) |
| Very low targets | One-cut (1 bp): a median near the floor would force P from 12,000 to 3,000 and, drawn in 37.5 % of runs, decide rankings (fairness estimate). Sprint-cage (2,500 bp, 1 life): "a second doom" on a slot weighted about 50k (fairness), or a median of 0 failing `--check`, as the committer never commits with one life (core engineer) ([Low target](ideas/scoring-and-risk.md#low-target-where-the-crossing-cut-decides-the-score), excluded) |
| All-or-nothing seals timed against the boss | A deflection comes during about 8 % of 5-tick seals (fairness estimate); search sees it, humans cannot ([Racetrack](ideas/v1-levels.md#racetrack-loop-two-seals-trap-the-train), excluded) |
| Gates the boss rarely crosses | *Scratch* (B 5, player still, 2,000 seeds): an 8-row gate was crossed in 54 % of runs at boss period 2 (median tick 692), 79 % at period 1; a 16-row gate in 92 % at period 2 (tick 420); a 20-row gate in 99.8 % at period 1 (tick 174) (Boss-trap rooms, core engineer). The body crosses only when aligned: 4 of about 54 rows for B 5 and 8 rows (fairness); cross (8, B 6) leaves 3, labyrinth (8, B 7) 2 (*computed*): measure first. Fix: a 12-20-row gate, period 1, or both (core engineer) |
| Lanes, bays or notches narrower than B | Boss-free on every seed (D14); judges disagree on patrolled ones ([§7.4](#74-d14-and-safe-pockets)) |
| 5-6 lives everywhere | D5's zero rarely binds, so Commit loses its purpose (Short, forgiving set) |
| Difficulty from period-1 minions and R 30 first | Rewards bots' reaction speed; use obstacles, B and minion count first (same) |
| Spirals, 1-cell doors, a 15 × 15 maze | Busy or nearly invisible (Calibrated library, Tree maze). Doors and corridors at least 3 wide, at least B + 1 where the boss travels, no 1-cell slivers or single-cell islands (Calibrated library, play). Half the field solid is "a lot of dead screen" (Letterbox, play) |

## 7. Fairness and calibration

### 7.1 What the reference mix plays

**Today.** The mix is `bold` + `committer` (`levels/targets.json`). From tools/src/bots/: greedy cuts the largest open rectangle on a straight claimed base (`best_cut`), out of the boss's reach plus 2 cells and 3 cells from minions, with directions and A only. Bold is greedy at 75 % of the reach plus 1 cell and never commits; committer is bold, pressing X once its lives first drop to 1. Search simulates the core; the reference playtest report and calibrate never play it, `playtest --policy search` and the bot-advantage study do.

**The reference mix never deliberately** holds B, seals a door (it seals only by accident), cuts from a staircase, hunts minions, banks early, hides mid-cut or plays the clock, "so any mechanic it ignores is mispriced, and drawing that level becomes luck in the six-level draw" ([The bot gap](README.md#the-bot-gap)). Greedy plans U-shaped cuts on open legs; a leg that reaches a pillar or island closes early (R4.5-5), so on anchor boards the mix's rate may say little about human difficulty ([Pillar lattice](ideas/wild-combinations.md#pillar-lattice-of-mid-field-anchors), fairness).

### 7.2 Weights, P and the floor

**Today.** `weight_bp = P × 10,000 / max(m, floor)`, rounded down, m the mix's median effective claim, P the largest multiple of 1,000 keeping every weight in a u16 ([README §8.4](../../README.md#84-season-scoring)); the rounding is why a median run scores 11,999. P = 12,000, floor 500 bp, weights 13,692 (maze) to 64,620 (doom), a 4.7× spread ([calibration-1.json](../../seasons/calibration-1.json)).

*Computed* from calibrate.rs (`weights`) and calibration-1:

- Only ratios matter: weight_i / weight_j = m_j / m_i.
- **The lowest median sets P.** P = 12,000 while it is 1,832 to 1,983 bp; 13,000 from 1,984; 15,000 if doom (1,857) left and swarm (2,372) became the lowest; 9,000 at 1,500. P scales every weight alike and the pot is shared pro-rata by score ([README §8.2](../../README.md#82-challenge-000005-eth-per-run), Rewards), so P changes a player's share only through rounding; shares move with a slot's weight relative to the others.
- **The floor is a backstop**: `--check` already rejects medians at or below 500. If it bound, P would be 3,000, that weight 60,000.
- **Weight follows the median, not the clear rate:** trio (29.8 %, median 3,379) outweighs titan (22.8 %, 4,197). Maze's 9,000 target lifts its median to 8,764, the lowest weight.

### 7.3 The bot gap by level

**Today.** Search's run score is 2.032 times the mix's; it clears every level and reaches 0.985 of the ceiling ([bot-advantage](../../reports/bot-advantage.md)). *Computed* from its per-level mean claims, draw counts and the weights: search over the mix's mean claim runs from 1.28 (01) to 4.10 (16), over the mix *median* from 1.12 (maze, 9,816 / 8,764) to 5.16 (doom, 9,580 / 1,857); levels 13-16 hold about 61 % of the per-run points gap (16: 23.1 %). The gap "comes mostly from D5 zeros and low commits on the hard levels, multiplied by their large weights" (The bot gap); on 12-16 bold's median is 0 ([calibration-1](../../reports/calibration-1.md#every-policy)).

### 7.4 D14 and safe pockets

**Today** nothing checks coverage. The boss tests its whole leading edge (R4.6-3), so it cannot enter a pocket narrower than its body, yet the pocket stays open on capture ([README §4.8](../../README.md#48-capture), rationale): a lane, bay, notch or room behind a door narrower than B is boss-free on every seed. Comb's corridors are 7 wide at B 5, except a 10-wide one at the right edge; labyrinth's doors are 8 wide at B 7; maze's bands are 9 tall at B 6, the bottom one 8 (*computed*).

**Patrolled pockets: judges disagree.** The Guarded islands fairness judge accepts a narrow lane "only where a minion patrols it". The Stranded minions fairness judge rated even patrolled bays "D14 needs-seeding" ("minion patrols are not seeded"); its fix: bays at least B wide, or a T2 field seeding the minions' spawn bays or start phase.

**Minion-only timing.** Minions are not seeded (README §6.4), so a play timed only against them in a boss-free area (a bay hunt, a guard's lap) is the same in every run: learned in Training, replayed in Challenge (Stranded minions, fairness).

**Proposal:** lanes and bays at least B wide, arms and necks B + 2, or patrolled; a count of cells the body never reaches ([§7.6](#76-research-recommendations-proposals); corner slivers are "worth little", Shaped arenas, fairness). Where one early capture is most of the score, avoid a seed-independent safe opening (Low target, fairness: with spawn (20, 20)-(33, 33) "the outer ring is boss-free for the first 20-40 ticks on every seed").

### 7.5 Draw variance and minClears

Each level is in 37.5 % of runs; a run draws 0-4 of levels 13-16 with 11.5, 39.6, 37.1, 11.0 and 0.8 % (*computed*, all 8,008 draws). Under best-run ranking "extra variance rewards buying more runs" (Boss-trap rooms). The mix clears 4 or more levels in 39.2 % of runs ([bot-advantage](../../reports/bot-advantage.md#qualification-d10)); a higher `minClears` "only widens the bot's advantage over the mix" ([ECONOMY.md](../ECONOMY.md)).

### 7.6 Research recommendations (proposals)

**Proposal.** The research's acceptance checks, beyond [§2.4](#24-steps-to-ship-a-board):

1. No seed-independent boss-free zone larger than a few cells, the threshold measured on today's 16 (Calibrated library); a per-seed coverage floor (Topology season, fairness).
2. Measure the seed variance of the key event; reject bimodal levels and rare jackpots.
3. If the key play is a seal, staircase cut, hide, hunt, early bank or clock gamble: add a scripted policy, check human journals, or keep the level Training-only (after [§8.4](#84-tools-prerequisites)).
4. Keep each slot's search mean over mix median within today's 1.12-5.16 (Short-clock, fairness), the claim spread no wider than comparable levels, and max/min weight no wider than today's 4.7× ([Topology season](ideas/v1-levels.md#topology-season-one-field-shape-per-slot), fairness: "Refuse a set that widens either").
5. Targets of 7,500 or more; no 1-life levels in Challenge; boss period 2 for seal or timing boards; T of 1,350 or more where the target is 9,000 bp or more, until human journals show clears fit (Short, forgiving set, fairness). If lives rise to 5-6, keep one or two levels at 3 (fairness) or several at 2-3 (play), so D5's zero binds; today 8 of the 16 have 2 or 3.
6. Collect human journals ([§2.1](#21-source-and-tools); today one on a season level, labyrinth, and one on the worked-example open field). Testnet journals never feed mainnet weights (README §8.4).

This guide adds, from README §4.6 (Limits of N) and M1.5: boss period at most 6 and T > 399 × period ([§1.3](#13-what-the-seed-decides)).

## 8. Levers that may come (proposals)

**Proposal, all of it.** Rules are at `RULES_VERSION` 2, format v1. T2 is not "no rule change": implementing an edit to already-built README §4-§6 rule text bumps `RULES_VERSION`, and a new level byte format bumps its own version and regenerates `vectors/format/` ([`CLAUDE.md`](../../CLAUDE.md)).

### 8.1 Sequencing

From [Sequencing](README.md#sequencing): Training layer and level-set tools now; new v1 boards in Training during the first testnet seasons, then new mix policies and a new calibration file; calibrated new boards at a season boundary after M5.6; then rules v3 with the format half of level format v2.

### 8.2 Level format v2: per-level knobs

"One level bytes v2 that still decodes the 472-byte v1, so the 16 level ids survive" ([Level format v2: living rail](README.md#level-format-v2-living-rail)). T2 levers (score, gap): mixed-speed minion roster (12, neutral); island start, with a PIN-01 rewrite (13, narrows); rule dials (11, unclear); per-level draw speeds (10, widens); shield stock (10, widens). T3: counter-rotating patrols, rail hunters, sweepers (12, neutral); overtime, ramming slow minions (12, narrows); twin bosses (11, unclear).

### 8.3 Training layer content

**Proposal**, no consensus impact ([Training arcade layer](README.md#training-arcade-layer)): a seven-lesson Lesson ladder (T1, 13), checked by greedy, not calibrated, in its own directory (in `levels/src` it would fire the chain); Endless climb, Proven level codes and Per-level medal tiers (T0, 13).

### 8.4 Tools prerequisites

**Proposal:** level-set directories with their own `targets.json`, a Training level list and a pocket-width check ([New boards on v1 knobs](README.md#new-boards-on-v1-knobs), steps 1 and 6); lesson ids refused by the season tool ([Lesson ladder](ideas/level-structure-and-progression.md#lesson-ladder), fairness); one level directory per season ([Topology season](ideas/v1-levels.md#topology-season-one-field-shape-per-slot), core engineer).

## 9. Open questions that affect level design

The owner's ([questions](README.md#open-questions-for-the-owner)):

- **Q6:** should the mix gain policies (hold B, seal, hunt, ram, overtime exit)? Changing it "moves every level's weight and needs a new calibration file".
- **Q7:** rotate level sets? Each needs a new calibration.
- **Q2 (D5):** which single softening, if any: overtime after the clear, the last-life lifeline, a salvage share (a core constant) or a crown line. **Q4 (D6):** shield stock. **Q5 (D4):** fuse-like pressure. **Q9 (D9):** twin bosses. **Q1:** foresight aids "raise human medians unevenly against bot-derived weights".

"No mechanic closes the roughly 2x pot-share gap" (The bot gap).

## 10. Further reading

The research's [shortlist](README.md#shortlist), [untried design space](README.md#untried-design-space) and [ideas/v1-levels.md](ideas/v1-levels.md).
