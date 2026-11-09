# Ideas: capture rules

The 10 ideas proposed from the axis of the [taxonomy](../TAXONOMY.md) *capture rules*: what a closed cut claims and how: the enemy-free side, the smaller side, several enemies, splitting enemies into regions, area thresholds, bonuses for big captures, captures that kill or trap enemies. Sorted by score. The [index](../IDEAS.md) lists every idea by tier and score, and [`README.md`](../README.md#the-taxonomy-and-the-ideas) explains the judges.

## Figure ground: only marked cells count

`capture-rules#9` · T3 New core rule · score 12 (core 4, fairness 4, play 4) · gap: unclear · D14: compliant

Only the shape outlined on the field counts toward the target. The rest is just ground to cut through, and the best play shuts the boss outside the shape.

**Rule sketch.** Level bytes v2 add a figure: up to 16 rectangles (x0, y0, x1, y1), unused slots zero, 64 bytes. At load, every cell inside their union that is EMPTY gets a static flag. The grid's \[Cell; 3,600\] becomes 3,600 bytes with the state in bits 0-1 and static flags in spare high bits. Cell reads mask the flags, the state hash still packs the 2-bit state, and the flag is a function of the level bytes. claimable = the number of flagged cells. The capture pass of R4.8-4 adds to captured only the flagged cells it turns CLAIMED, and claim_bp = captured \* 10,000 / claimable as in R4.1-8. Everything else is unchanged: unflagged ground is captured and walled as usual but does not count. Validity: the figure holds at least 841 cells (a quarter of the interior). Since the boss can be shut into unflagged ground, a claim of 10,000 is reachable.

**Inspired by:** Gals Panic (1990), Silhouette Stories (1996), Panic (Y.O.S.) (2002), Landgrab - Line Cutting Arcade (2026). **Mechanic families:** [Silhouette-only coverage](../taxonomy/capture-rules.md#silhouette-only-coverage), [Area-percentage clear threshold](../taxonomy/capture-rules.md#area-percentage-clear-threshold). **Touches:** level-format, level-data, rules, presentation, tools-bots.

**Decisions it reopens:** R4.1-8; R4.1-2.

**Bot effect.** Depends on the figure, which level design controls. A compact figure away from the boss spawn makes 100% reachable with a rough fence, which narrows the gap because precision stops paying. A figure wrapped around the spawn rewards an exact squeeze, which widens it. The figure is fixed but the boss is seeded, so there is no safe zone (D14).

**Budget.** 64 bytes of level data; no new RAM (spare grid bits); one bit test per cell in the capture pass. State-hash layout unchanged; zk cost negligible. Screen: 2 more palette entries (figure unclaimed, figure revealed), still within the 16-colour buffer; a picture reveal is T0 on top.

**Variety.** Where you cut matters, not just how much: players decide which ground is worth claiming, herd the boss into barren ground and fence the shape. Level designers get shapes (rings, islands, letters) as a new axis beside obstacles.

**Core engineer: feasible, 4 of 5, tier 3.** Keeping the flag in the grid's spare bit is the right design. Grid is already \[Cell; 3,600\] of u8 (a repr(u8) enum), so a static flag in bit 7 costs no RAM. A separate 450-byte bitmap would eat about 1 to 1.5 KB of the wedgie's roughly 2.7 KB stack margin, because start peaks at 62,784 of 65,536 bytes and Game is copied during Game::new until M3.10.

The refactor stays inside grid.rs. get, at, set, count, replace and mark_boss_zone must mask the flag and preserve it, and the state hash packs only bits 0-1. 'captured' and 'claimable' keep their place in the state hash but change meaning, and R4.1-8 must say so.

Validity needs codes for: canonical zero slots, x0 ≤ x1, rectangles inside the interior, and at least 841 flagged cells.

The design risk is in level design. A compact figure away from the boss's spawn can be fenced off by one straight cut for 100%, so figure placement decides difficulty more than any other knob, and every figure needs its own playtest. Level sources and the editor need a figure layer, still through the one codec (P10).

*Fixes.* Keep the flags in the grid's spare bit, never in a separate bitmap. Add the figure's validity codes. Count only flagged cells toward 'captured', and keep the raw capture size if another rule needs it.

*Cost.* Level format v2 +64 B (536 B). 0 B RAM. One AND per cell read in the fill and rail checks, and one bit test per cell in the pass; zk +1-3%. State hash layout unchanged. RULES_VERSION bump; new vectors. levels/src and the editor gain a figure layer; 2 more palette entries.

*Conflicts.* R4.1-8; R4.1-2; R4.8-4; §5 level bytes v1

**Fairness: ok, 4 of 5; gap unclear; D14 compliant.** D14: kept. The figure is static level data like obstacles, it does not affect boss motion, and the boss stays seeded, so no seed-independent safe zone appears and nothing can be precomputed. Gap: depends on level design, as the pitch says honestly. A compact figure away from the spawn turns a rough fence into 10,000 bp for anyone who clears, which strongly narrows. A figure around the spawn rewards the exact squeeze, which widens. Because shutting the boss in unflagged ground reaches 10,000, the ceiling becomes 10,000 for search on every figure level. Calibration: scripted bots must value captures by flagged cells, a small change to greedy. Without it the mix misjudges figure levels and the weights skew. Draw variance: per-level search uplift will differ widely between figure designs. Median-based weights fix the mix's difficulty, not search's relative edge, so the design rule matters. Costs are small: the masked cell reads touch every grid access, so test that change hard for parity.

*Fixes.* Add a level-design or validity rule: the figure lies away from the boss spawn rectangle, and no single short cut from the rail can capture it before the boss can reach it. Add figure-weighted scoring to the scripted bots. Report search uplift per figure level in bot-advantage and reject designs that widen it.

**Play: strong, 4 of 5.** A new design axis: obstacles shape where the player can go, and the figure shapes what is worth taking. Cuts acquire purpose: wall the boss into barren ground, use unflagged captures as tactical walls, fence the figure. The core loop and capture rule are untouched, so it keeps the feel. The flags fit in the spare bits of the existing u8 cells, are derived from the level and not hashed, so the cost is low. The risk is degenerate figures: a compact figure next to a border can be fenced with one rectangle cut for an instant 100% clear, and a figure wrapped around the spawn rewards search's exact squeeze. That has to be handled by level validity or playtest, not left to taste. The bots need figure-aware policies (greedy must weigh flagged cells), which is easy to script.

*Fixes.* Add a validity or playtest gate: no single capture by a scripted bot from the start state may reach the target, and require the figure to overlap the boss spawn rectangle in part, so the boss starts on it and must be herded off. Tie the 841-cell floor to the target, so a clear needs most of the figure.

*Readability.* Good if the palette is chosen with care: figure EMPTY as the dark grey already in the palette, and figure CLAIMED as a hue distinct from the claimed blue and from the minion green. Shapes built from rectangles read well at 4 px.

## Heavy blow: big captures shrink the boss

`capture-rules#5` · T3 New core rule · score 11 (core 4, fairness 4, play 3) · gap: neutral · D14: compliant

Carve out a big enough chunk in one cut and the boss loses a cell on each side. A risky long cut early buys a smaller, less dangerous boss for the rest of the level.

**Rule sketch.** Level bytes v2 add blow_cells (u16; 0 = off) and min_b (u8, 2..B). At step 3, after a capture of size s (R4.8-4) and its minion step: if blow_cells > 0, s >= blow_cells and B > min_b, then B = B - 1, keeping the top-left cell (x, y). The body drops its last column and last row, which were EMPTY cells, so R4.6-1 still holds and the edge tests of R4.6-3 keep their meaning. The capture's fill already ran from the old body, so the freed cells stay in the boss's region. The body shrinks one step per capture; a variant shrinks it floor(s / blow_cells) steps. Suggested blow_cells: about 12% of the open field (400 cells). B is already in state hash v1, so the layout is unchanged; RULES_VERSION is bumped for levels v2.

**Inspired by:** Gals Panic S - Extra Edition (1997), Beauty Territory - Qix Fantasy (unreleased), Volfi: Cyber Territory Arcade (2026). **Mechanic families:** [Captures damage the boss](../taxonomy/capture-rules.md#captures-damage-the-boss), [Type-specific enclosure outcome](../taxonomy/capture-rules.md#type-specific-enclosure-outcome). **Touches:** level-format, rules, tools-bots, presentation.

**Decisions it reopens:** D9; R4.3-3; R4.6-1.

**Bot effect.** Narrows the gap slightly. Search is near the ceiling and gains at most (B\*B - min_b\*min_b) cells of ceiling, 60 of 3,364 cells (1.8%) for B = 8 shrinking to 2. Humans gain survivability, which is where they lose most of their points. Search will still pick the best moment for the blow. D14 is intact: the deflection draws are unchanged.

**Budget.** One compare per capture; 3 bytes of level data; no RAM. The state-hash layout is unchanged, because B is already serialized, but new vectors are needed. zk cycles unchanged. Screen: redraw the freed body cells.

**Variety.** Makes cut size a strategic choice: many safe nibbles keep a big boss, while one long exposed cut weakens it for good. On levels with B = 8, such as heavy and titan, 'when do I go big' becomes the central decision.

**Core engineer: feasible, 4 of 5, tier 3.** It is clean. Dropping the last column and row leaves the body on EMPTY cells inside the boss's region (the fill ran from the old body), so R4.6-1 and the edge tests hold. Boss::body, move_axis, the step-onto-body hit test and capture() all read boss.size at run time, and B is already serialized in state hash v1, so the layout stays. D14 is intact: the draws do not change, and two runs capture identically until their first differing draw, so they also shrink identically and R4.6-12's argument holds.

Side effects, all benign: the freed cells always open on the right and bottom; a smaller body hits trails less (its leading edge is shorter) and can now enter pockets it could not enter before. The capture size counts TRAIL cells (R4.8-4), so a long thin cut counts toward the blow too. The ceiling gain, at most (B² − min_b²)/claimable, is right: 60 cells, 1.8%, for B 8 → 2.

*Fixes.* None needed. State the step order: capture, then the minion step (R4.7-8), then the shrink, then the target test (PIN-10). Say that the capture size includes trail cells. Validity: blow_cells is 0 or at most claimable; min_b is 2..B when blow_cells > 0, and 0 otherwise (canonical bytes).

*Cost.* Level format v2 +3 B. 1 compare per capture; 0 B RAM. State hash v1 unchanged (B is already in it); zk unchanged. RULES_VERSION bump; new vectors. The wedgie redraws 2B−1 freed cells once per blow.

*Conflicts.* D9; R4.3-3; §5 level bytes v1

**Fairness: ok, 4 of 5; gap neutral; D14 compliant.** D14: kept. The deflection draws are unchanged, and B is already in state hash v1. The geometry is sound: the dropped column and row were EMPTY body cells, and the capture's fill already ran from the old body, so R4.6-1 and the single-region invariant hold. Gap: about neutral, against the pitch's 'narrows slightly'. Search makes 400-cell cuts at will and times them best, and it gains up to 1.8% of ceiling (B = 8 to 2, though two or three shrinks are realistic, about 0.8 to 1.3%). Humans who already make big cuts (the playtest journals cleared labyrinth in 163 ticks) gain survivability from a smaller body. Humans cannot count cells mid-cut, though, so a fixed 400-cell threshold is a precision edge for search. Calibration: easy. Greedy already makes large rectangles, and a size-aware variant is trivial. The draw: B = 8 levels (heavy, titan, doom) change most, which is fine after recalibration. Within a level, whether a big safe cut is available depends on the seeded boss path, which is existing variance.

*Fixes.* Show the would-be capture size during a cut, and whether it reaches the blow threshold, as browser-only T0 HUD. That removes search's counting edge. Consider expressing blow_cells as a share of the remaining open cells rather than an absolute count, so the blow stays reachable late in the level. Measure with bot-advantage.

**Play: ok, 3 of 5.** It fits the genre well (wound the boss) and gives a level an arc: with B = 8, as on heavy, titan and doom, a big early capture makes the rest of the level easier. The decision is real but mostly sharpens one that already exists (nibble safely or cut big, the committer against bold split), adding a compounding payoff on top of the claim. One interesting twist for level design: on maze, labyrinth and comb a smaller boss fits through more corridors, so shrinking it is not always good. The rule is mechanically sound: dropping the last row and column only removes cells from the body, so it stays on EMPTY cells, and D14 is intact. At 400 absolute cells, blows are mostly early-level events, because the open field shrinks. The clearing capture often crosses 400 too, but the level ends there, so that blow is wasted.

*Fixes.* Set the threshold as a share of the open field at the time of the capture (for example 25%), so a late big cut can still trigger a blow. Shrink toward the body's centre, alternating corners by tick parity, rather than always keeping the top-left cell, so the shrink looks like damage and not a jump. In the browser, show the size the open cut would capture, so players learn the threshold.

*Readability.* Good. A shrink from 32 to 28 px is visible, and a flash marks it. The 400-cell threshold is invisible on the wedgie, which has no HUD, so players learn it roughly, as about an eighth of the field.

## Seeded relics: stasis and fury

`capture-rules#12` · T3 New core rule · score 10 (core 3, fairness 3, play 4) · gap: narrows · D14: compliant

A glowing relic sits in the open field. Fence it in to freeze the boss for a few seconds, but fence in a red one by mistake and the boss runs at full speed.

**Rule sketch.** Level bytes v2 add relic_count (0 to 2), each slot's kind (stasis or fury) and effect_ticks (u16). New state, in a state hash v2: per slot u8 x, u8 y, u8 live, plus boss stasis and fury countdowns (u16 each). Placement, at level start and right after a collection at step 3: r = fmix32(relic_key XOR (tick\*2 + slot)) mod 3,600, with relic_key = the big-endian u32 of seed bytes 17 to 20. The relic goes on the first cell at or after r in row-major order, wrapping, that is EMPTY, outside the boss body and has all 8 neighbours EMPTY, so it is never next to the rail. If no such cell exists, the slot stays dead. Collection: after a capture's pass, a live relic whose cell is now CLAIMED is collected; enclosing it counts, touching it does not. Stasis sets the stasis countdown to effect_ticks: while it is above 0 the boss neither moves nor draws a deflection, and stepping onto its body still hits (R4.9-3). Fury sets the fury countdown: while it is above 0 the boss moves on every tick, as if its period were 1. Both countdowns drop by 1 at step 4. The collected relic is then placed again.

**Inspired by:** Laser Strixx 2 (1995), Qix Adventure (1999), Dino Master (2005), Love Me (c. 2018), NEON CUT (2026), Libble Rabble (1983). **Mechanic families:** [Enclosed pickups and objectives](../taxonomy/capture-rules.md#enclosed-pickups-and-objectives), [Selective enclosure](../taxonomy/capture-rules.md#selective-enclosure), [Minimal-enclosure treasure](../taxonomy/capture-rules.md#minimal-enclosure-treasure). **Touches:** level-format, rules, state-hash, tools-bots, presentation.

**Decisions it reopens:** R4.4-2; R4.6-6; R4.6-12; §6.4 unused seed bytes.

**Bot effect.** Narrows the gap modestly. Search is already near the ceiling, so a freeze adds little to its score, while a human gets a visible safe window. Search will still time its collections best. Relics must stay visible: a hidden relic found with a detector would widen the gap, since a bot reads the seed. D14 is kept: the relic key makes placements seed-driven, and a frozen boss only skips draws, while R4.6-12's divergence counts moves, not ticks.

**Budget.** About 10 bytes of state and a state hash v2; two countdown checks per tick. Placement scans at most 3,600 cells x 9 reads, only on a collection. zk cost negligible. Screen: 1 or 2 blinking cells.

**Variety.** Adds selective enclosure: shape cuts to take the good relic and leave the bad one, decide which detours are worth their risk, and decide how to spend a freeze, such as a deep cut beside a frozen boss.

**Core engineer: feasible with changes, 3 of 5, tier 3.** It is compatible with D14. Placements are stateless fmix32 draws from the free seed bytes 17-20 and the tick. A frozen boss skips draws, but R4.6-12 counts moves, not ticks, so divergence still holds. Under fury the boss draws on every tick, and the draws stay pure.

Gaps in the sketch:
(a) Two live relics can land on the same cell: slot 1's scan can wrap around to slot 0's cell, especially late in a level when few cells qualify. Enclosing both at once starts stasis and fury together, and that overlap is unspecified.
(b) 'Touching it does not count' contradicts the rule as written. A trail laid over the relic becomes CLAIMED at the capture and collects it.
(c) Fury overrides R4.4-2's global movement phase while it lasts. That is fine, but the rule text must say so.
(d) Stasis lets the player lay trail flush against a frozen body and pen it tightly. A freeze followed by a rail-to-rail pen gives a near-ceiling final capture, and search times it best, so the claim that the gap narrows is optimistic. Measure it.

The placement scan reads at most 3,600 + 8·(EMPTY cells) cells with early exit. It runs at most twice on a capture tick, which adds about one extra fill to the worst tick.

State: 2 × (x, y, live) plus 2 × u16 countdowns = 10 B, so state hash v2.

*Fixes.* Make placement also skip a cell that holds a live relic. Define the overlap: stasis wins, and both countdowns keep counting. State that a trail laid over a relic collects it at capture. Define the countdowns at step 4, decremented before the move test, and say in the rule text that fury overrides R4.4-2's phase.

*Cost.* About 10 B of state; state hash v2 (+10 B). Level format v2 +4-5 B. 2 countdown checks per tick. Placement reads at most about 30k cells, only at level start and on a collection (at most 2 per capture tick). zk under +1%. RULES_VERSION bump; new vectors; 1 or 2 blinking cells on screen.

*Conflicts.* R4.4-2; R4.6-6; R4.3-3; §6.4 unused seed bytes; state hash v1

**Fairness: concerns, 3 of 5; gap narrows; D14 compliant.** D14: kept. Placement uses unused seed bytes 17 to 20, and stasis skips draws without breaking R4.6-12, which counts moves. Gap: stasis narrows it at the top, since a frozen boss lets a human make the precise finisher squeeze that is search's main edge today. Two problems push back. (1) Re-placement is keyed by the collection tick, fmix32(key XOR (tick\*2 + slot)), so search, which knows relic_key, can delay or advance a collection to place the next relic where it wants, for example a stasis relic next to the rail. Humans cannot do that. (2) Fury rewards cut shaping that leaves out the red relic, which is a precision task where search never errs. Draw variance: a seeded stasis spot can be easy or hard to enclose, and a stasis can swing a human's level by more than 1,000 bp. Relic luck therefore compounds the six-level draw, in a way median-based weights only average out. Calibration: a collect-stasis, avoid-fury, exploit-freeze policy is scriptable. The costs (state hash v2, a 3,600-cell scan per collection) are acceptable.

*Fixes.* Key re-placement by a per-slot collection counter (fmix32(key XOR (n\*2 + slot))), not the tick, so search cannot steer placement. Constrain placement to a band of similar enclosure cost (for example, a fixed distance range from the current rail) to cut placement luck. Consider dropping fury, or making it a visible opt-in risk with a reward. Add a relic policy to the mix and measure per-run variance as well as the means.

**Play: strong, 4 of 5.** Selective enclosure is a real new decision: shape a cut to take the stasis relic and leave the fury one, judge which detours are worth the exposure, and spend a freeze on a deep cut beside a frozen boss. It is in the genre's spirit (power-ups revealed by claiming) and adds situations no level knob can. Placement is seeded and stateless, D14 is respected, and the cost is small. One flaw matters a lot: fury makes the boss move every tick, but levels 05 to 16 already have boss period 1, so fury does nothing on 12 of the 16 levels, and the 'avoid the red one' decision disappears there. A relic under the boss body also needs a defined draw order.

*Fixes.* Redefine fury so it works at period 1: for example, deflections on 1 move in 4 (a more erratic boss) for effect_ticks, or B + 1 where the body fits. Otherwise allow fury slots only on levels with boss period 2 or more. Tell the two kinds apart by shape as well as colour: a solid 4x4 cell for one and a hollow 4x4 ring for the other, in colours that are not the trail's red (magenta maps to it on the wedgie) or the boss's yellow.

*Readability.* Workable. One blinking 4x4 px cell catches the eye on black, but two kinds need a second cue (solid against hollow) because the 16-colour palette has few free warm colours that stay apart from the red trail and the yellow boss.

## Spur: bank half a cut as a wall (Y)

`capture-rules#13` · T4 Input or journal · score 10 (core 3, fairness 3, play 4) · gap: narrows · D14: compliant

Press Y mid-cut to set your trail into a permanent wall and stand on its tip: half a cut banked as safe ground, a limited number of times per level.

**Rule sketch.** Level bytes v2 add spur_charges (u8; 0 = Y does nothing), and journal v2 records Y (mask bit 3; D8). At step 3, before any move, a spur happens if Y is in this tick's mask but not in the previous tick's mask (the mask in force is already state), the player is cutting, and a charge is left. The cut then ends where the player stands, and the capture procedure R4.8-1 to R4.8-4 runs unchanged. The trail touches the rail only at its start, so the boss's flood reaches all open field except pockets the trail closed against itself. Normally only the trail cells, plus any such pockets, become CLAIMED: a peninsula. The player stays on the trail's last cell, now CLAIMED and a rail cell (or off the rail, R4.5-3), and spends the charge. The minion step (R4.7-8) and the target test run as after any capture, and the player moves no further that tick.

**Inspired by:** Xonix (1984), Quark Panic (unknown), Land Breaker (1999), Araña (1990). **Mechanic families:** [Pocketing and herding walls](../taxonomy/capture-rules.md#pocketing-and-herding-walls), [Trail-enclosure claim](../taxonomy/capture-rules.md#trail-enclosure-claim). **Touches:** input, journal, level-format, rules, state-hash, tools-bots.

**Decisions it reopens:** D8; D4; R4.5-5; R4.4-8; §6.1 input mask.

**Bot effect.** Widens the gap. Spurs multiply the shapes search can build against a trajectory it knows exactly, such as funnels timed to the deflection draws. Humans gain safety, but less than search gains in construction. The charge count limits the effect. Y is an action, not a pause, so D8's concern about free thinking time does not apply, but D8 changes because Y becomes journaled.

**Budget.** 1 byte of state (charges), a state hash v2 and journal v2 with Y. Each spur costs one capture, at most the number of charges per level. No new RAM; no new screen elements.

**Variety.** Adds herding walls and stepping stones: break a long cut into safe stages, build funnels that steer the bouncing boss, or wall it into a pocket you prepared. It is a new resource beside the shield.

**Core engineer: feasible with changes, 3 of 5, tier 4.** The rule itself is sound. It reuses capture() unchanged, a tick still has at most one capture (the worst tick stays at about 22 ms), and the core already sees the rising edge of Y, because Game::input passes the previous mask to Player::input the same way press_tick does for B. Problems with the sketch as written: (1) 'mask bit 3' is Right (README §6.1). Y is Key3 in D8, which is not mask bit 3. The only free bit is bit 7, which journal v1 rejects with code 10, so Y would use up the last reserved bit, and any later input (the joystick press) would force a u16 mask and 4-byte events. (2) The capture is more general than 'half a cut': the trail seals 4-connected pockets against any CLAIMED cell it runs beside or touches diagonally, not only against itself. A spur is therefore a close-anywhere capture that saves the 1 or 2 steps back to a wall. This is harmless, because R4.8 handles it, but the pitch undersells it. (3) The rule must pin that the direction is still resolved and stored on a spur tick (PIN-05, and the previous direction is in the state hash). (4) The bot claim is probably backwards. Search already scores 0.985 of the ceiling, so spurs leave it little headroom, while humans and scripted bots get a panic button that banks a doomed cut. In score terms the gap more likely narrows. The 1-cell peninsulas keep the D7 boundary argument intact: a minion walks out along the spur and back. Even so, the M1.7/M1.15 coverage test should rerun on boards with spurs.

*Fixes.* Put Y on mask bit 7, the reserved bit. Journal v2 accepts bit 7 and still rejects it in v1. Get an owner amendment of D8 (Y as an action, not a pause). Pin direction resolution on spur ticks. Show the remaining charges on the HUD. Add scripted-bot use of Y (bold and committer at least) before calibration, or the reference mix understates every level that has charges.

*Cost.* State +1 B (state hash v2, 949 B); level bytes v2 +1 B (473); journal v2 changes no width, only the meaning of bit 7. RAM +1 B in Player. Per tick, one bit test; zk cycles about 0 per tick, plus at most `charges` extra captures per level at the cost of an ordinary capture. Natmod code a few hundred bytes. RULES_VERSION bump, regenerated game and format vectors, playtest and recalibration. Uses the last free mask bit.

*Conflicts.* D8; §6.1 reserved bit 7 / journal v1 code 10; R4.4-8; R4.5-5; R4.8-1; PIN-05

**Fairness: concerns, 3 of 5; gap narrows; D14 compliant.** D14 holds. The boss is still steered by seeded deflections. A spur only turns the trail into CLAIMED through the unchanged R4.8 procedure, so the field stays one region, and a run's spurs depend on its own boss path, so nothing can be precomputed or copied. I disagree with the pitch that it widens the gap. Search already scores 0.985 of the ceiling (reports/bot-advantage.md), and the ceiling is fixed at claimable minus B squared, which spurs do not change. Search can gain at most about 1.5% from new constructions such as funnels. Humans gain a lot: a spur is a reactive panic button that turns a trail the boss is about to bump into wall. It also lets them build a spine into the field and cut short from its tip. The human-like mix loses most of its score to lives lost on long cuts (D5 zeroes the level), so spurs most likely raise humans more than search, and the score ratio narrows. The fairness risk is calibration. No scripted bot presses Y, so the reference mix would understate how easy spur levels are. If spur_charges differ between levels, the weights are biased level by level, and drawing a level with many charges becomes lucky. D8 is not reopened, because Y is an edge-triggered action, not a pause. Journal v2 and state hash v2 are the real cost.

*Fixes.* Before calibrating, give bold and committer a spur step: press Y mid-cut when the boss's reach margin (Caution::margin) falls below the distance to the trail. Keep spur_charges the same on all 16 Challenge levels, so a miscalibration cannot vary by level. Pin the case where Y and a closing sub-step fall on the same tick (the spur runs first, as the sketch says) and the case of a one-cell trail. Restate the bot_effect: the gap narrows in score terms because search is bounded by the ceiling.

**Play: strong, 4 of 5.** This adds a new resource next to the shield. The shield absorbs one hit; a spur turns a risky open cut into permanent geometry. That gives several decisions the game lacks today: bank a long cut in stages when the boss turns toward it, build funnels and partial walls that change where the bouncing boss can go, or make 1-wide corridors the boss (B >= 2) cannot enter. Spurs also change the minions' rail: a spur is a 1-wide rail peninsula that minions walk out along and back. A player on a spur tip faces a minion coming out with only two exits, back along the spur or a new cut into the field. That is a good new situation. The cost is the core tension: Qix-style play is about the exposed line, and a panic button that saves half of it weakens that, so the charge count matters. It fits the rule set without new cell states. The capture procedure is reused as is, and the tip is an ordinary rail cell, so R4.5-3 and the minion step need nothing new. None of the 16 levels can do anything like this, because they vary only boss, minion and obstacle knobs. The bot gap note is honest: search will build exact funnels against deflection draws it can compute.

*Fixes.* Cap charges at 1-2 on Challenge levels and keep Y edge-triggered as sketched. Require a minimum trail length (for example 3 cells) so a spur cannot become a 1-cell stepping stone spammed at the rail. Show the charges as pips in the HUD. Re-run the PIN-14 coverage test on boards with 1-wide spurs: right-hand walks out and back along dead ends should hold, but the test has never seen that topology. Consider not journaling Y on Training-only builds until Challenge levels actually use spurs, so D8 changes only once.

*Readability.* Good. A spur is a 1-cell-wide CLAIMED line drawn in the claimed colour, as clear as the border at 4x4 px. The player on the tip is visible as today. The only new element is a charge counter (1-3 pips), which fits the HUD. No new colours are needed.

## Twin bosses: split to banish

`capture-rules#8` · T3 New core rule · score 10 (core 3, fairness 3, play 4) · gap: widens · D14: compliant

Two smaller bosses share the field. Close a cut that leaves them on different sides, and the one with less room is banished and its whole side becomes yours.

**Rule sketch.** Level bytes v2 add a boss count (1 or 2) and, for boss 1, its own size B1, spawn rectangle and move period. Boss 1's start index is the big-endian u32 of seed bytes 13 to 16 modulo its candidates, its direction comes from bits 2 and 3 of seed byte 4, and its deflection key is seed bytes 9 to 12, used as in R4.6-7. Step 4 moves boss 0, then boss 1. Each tests only grid cells, so the bodies may overlap, and each can hit the trail (R4.6-3); stepping onto either body is a hit. Capture: (1) flood from boss 0's body as in R4.8-2 and R4.8-3, counting n0. (2) If boss 1's top-left cell is BOSS_ZONE, the bosses share a region and the pass runs as in R4.8-4. (3) Otherwise the cut split them: flood from boss 1's body with a transient mark, counting n1. The boss with the smaller region (boss 1 on a tie) is banished: the pass claims its region, body cells included, as if unmarked, and reverts the other region to EMPTY. The banished boss leaves the level (presence 0 in the state), so one region and one boss remain, and D7 holds. The capture size includes the banished region. A variant where both regions stay open would break D7's single-region patrol argument, so it is rejected.

**Inspired by:** Qix (1981), Styx (1983), Kix (BBC Micro) (1986), Volfied (1989), Mix (2022), Stake That Claim (2026). **Mechanic families:** [Splitting enemies into separate regions](../taxonomy/capture-rules.md#splitting-enemies-into-separate-regions), [Enemy-free regions are claimed](../taxonomy/capture-rules.md#enemy-free-regions-are-claimed), [Smaller side is claimed](../taxonomy/capture-rules.md#smaller-side-is-claimed). **Touches:** level-format, rules, state-hash, tools-bots, presentation.

**Decisions it reopens:** D9; D14; R4.3-3; R4.6-5; R4.6-7; R4.8-2.

**Bot effect.** Widens the gap modestly. A split needs a joint prediction of two seeded trajectories for as long as a long cut takes, which search does exactly and humans only approximate. Humans still get very large captures when they pull one off. Measure it with the bot-advantage report before adopting. D14 is kept: the second key keeps both bosses seed-driven.

**Budget.** About 8 bytes of entity state and a state hash v2 (+8 bytes). A second boss move per tick (2 edge tests of B1 cells). A second flood runs only on a split, and the total pushes stay at most the open cells. zk cycles up a few percent. Screen: a second body, up to 64 cells redrawn per move.

**Variety.** Adds a goal that is not area: wait for the two bosses to drift apart and drive one long cut between them under two threats at once, or nibble around the pair. After a split the level changes character: one boss and a big claim already banked.

**Core engineer: feasible, 3 of 5, tier 3.** It holds. Each boss tests only grid cells, and overlapping bodies are harmless because both stay on EMPTY. A body is 4-connected, so it lies inside one region, and 'boss 1's top-left cell is BOSS_ZONE' is a correct test for a shared region. Banishing leaves one region and one boss (D7). Total pushes stay at most the open cells, so the worst capture is about today's. The seed material is free: bits 2-3 of byte 4 and bytes 9 to 16.

The costs are real but moderate:

- Boss gains a presence flag, and Game holds a second Boss (about 12 B).
- State hash v2 (+8 B) and level format v2 (+7 B: count, B1, rectangle, period), with validity codes 23-26 and 37 per boss.
- The seed text of §6.4 and R4.6-12's property test must cover boss 1's key.
- Boss 1's region needs a transient fifth cell value.
- Every path that reads 'the boss' must handle 1 or 2 present bosses after a banish: the player's hit test, the capture seeds, the boss step, rendering and bots.

Unspecified: whether slots are fixed (boss 1 stays in slot 1 when boss 0 is banished). Bots: a split needs joint prediction of two seeded paths, which favours search. Measure with the bot-advantage report before adopting.

*Fixes.* None needed. Specify fixed slots with a presence byte each, and the per-boss validity codes. Extend R4.6-12's divergence test to the second key (bytes 9-12) and add a seed-derivation vector for boss 1.

*Cost.* About 12 B of RAM. State hash v2 (+8 B); level format v2 (+7 B). Each boss move costs 2·B1 edge reads and 1 fmix32. A capture adds one extra flood only on a split, and total pushes stay at most the open cells, so the worst tick is about today's. zk +1-3%. Screen: up to 4·B1 cells per move. RULES_VERSION bump; new game and seed vectors.

*Conflicts.* D9; R4.3-3; R4.6-5; R4.6-7; R4.6-12; R4.8-2; R4.1-2; §6.4 seed bytes and state hash v1

**Fairness: concerns, 3 of 5; gap widens; D14 compliant.** D14: kept. Boss 1 has its own key (seed bytes 9 to 12), start (13 to 16) and direction (byte 4 bits 2 and 3), all from unused seed material. The capture logic keeps one region and one boss after a split, so D7 holds. Gap: widens, and I agree with the pitch, perhaps more than 'modestly'. A split needs both seeded trajectories predicted for the length of a long cut, which search does exactly. Two bodies also double the trail-bump threat, which hits humans' weakest area, survival, and does not touch search, which already dodges perfectly. Calibration: scripted bots can survive two bosses, but a 'splitter' policy is hard to script. A mix that rarely splits would set weights that ignore the huge banish captures, mispricing these levels for players who do split. Draw variance: whether the two bosses start apart (an early split is available) or together is seeded per run, which adds per-level luck for humans beyond what median-based weights correct. Costs: state hash v2 and a second boss move per tick, modest.

*Fixes.* Gate adoption on a bot-advantage rerun with a scripted splitter in the mix. Constrain the two spawn rectangles so the bosses always start a comparable distance apart, which limits start luck. Consider a T0 aid such as showing both bosses' headings, so humans can judge a split. Use it on few levels at most.

**Play: strong, 4 of 5.** A proven genre idea (splitting two bosses) that adds a goal that is not area: wait for the two bosses to drift apart, then drive a long cut between them under two threats at once. After a split the level changes character, with one boss left and a big claim banked. That is a real arc the 16 single-boss levels cannot produce. It keeps D7 (one region remains) and D14 (a second seeded key), and it reuses R4.8-2's several-boss wording. Before a split, captures work as today. The costs are honest: state hash v2, a second boss move each tick, and a bot gap that widens modestly, because search predicts both trajectories exactly. Because the bodies can overlap, two bosses can merge into one blob, which looks odd and hides the split opportunity.

*Fixes.* Draw boss 1 in its own palette colour, not yellow or red, or give each body an outline, so overlaps stay readable. Consider making the bosses bounce off each other (an edge test against the other body) to keep two clear bodies, if the cycle cost is acceptable. Measure with the bot-advantage report, as the pitch says, before adopting it.

*Readability.* Good. Two B x B bodies (for example 4x4, 16 px) are easy to see. Overlapping bodies of the same colour are the only problem, and a second colour fixes it.

## Sector annex

`capture-rules#11` · T3 New core rule · score 9 (core 3, fairness 4, play 2) · gap: unclear · D14: compliant

The field is a 4x4 grid of sectors. Bring a sector to the annex share while the boss is not in it, and the rest of the sector is claimed at once, sometimes walling off more ground.

**Rule sketch.** Level bytes v2 add annex_bp (u16; 0 = off). Sectors are 15 x 15 cells, numbered sector = x/15 + 4\*(y/15). At load the core counts the claimable cells of each sector (16 x u16, derived from the level, not hashed). After a capture's pass (R4.8-4) no trail is left, so captured_s = claimable_s - (EMPTY cells in s). Then, for each sector in index order with claimable_s > 0, some EMPTY cell, no boss-body cell and captured_s \* 10,000 >= annex_bp \* claimable_s, its EMPTY cells become CLAIMED. If any sector was annexed, R4.8 steps 1-3 run once more from the boss body, so pockets the annex walled off are claimed too; then the minion step (R4.7-8) and the target test run. There is no further round, which bounds the work. Annexed cells count toward the capture size and the claim. Variant (per-sector quota): the level clears only when every sector with claimable cells reaches the target, shown as 16 bars.

**Inspired by:** Kix (BBC Micro) (1986), LadyLove (1990), DroneXtreme: Territory Capture (2026), Snake Conquest (2026). **Mechanic families:** [Region majority bonus](../taxonomy/capture-rules.md#region-majority-bonus), [Auto-complete above a threshold](../taxonomy/capture-rules.md#auto-complete-above-a-threshold), [Area-percentage clear threshold](../taxonomy/capture-rules.md#area-percentage-clear-threshold). **Touches:** level-format, rules, tools-bots, presentation.

**Decisions it reopens:** R4.8-1; R4.8-4; R4.7-8.

**Bot effect.** Roughly keeps the gap; to be measured. Search will chain annex walls into big follow-up captures. Humans get coarse, visible goals, the 16 sector bars, which reduce the precision a big claim needs. No safe zone: the sector lines are fixed, but the boss that blocks an annex is seeded.

**Budget.** 64 bytes: claimable per sector, derived at load, and a local per-sector count during the capture. Each capture costs up to one extra 3,600-cell pass and one extra flood, so up to about 2x today's capture. No new persistent state, so the state-hash layout holds; zk cycles rise on capture-heavy levels. Screen: sector ticks on the border and an annex flash.

**Variety.** Gives captures a second scale. Finishing a sector pays a bonus, so players aim at sector lines, leave the boss's sector for last, and plan annexes whose straight walls corner the boss. The quota variant forces play in every part of the field.

**Core engineer: feasible, 3 of 5, tier 3.** It holds. The refill from the boss after an annex restores D7's single region. A sector holding a body cell is never annexed, so R4.6-1 holds. A player left off the rail is covered by R4.5-3.

The per-sector EMPTY count can be taken during the capture's own pass, so no extra pass is needed. An annex touches at most 225 cells per sector, but the refill plus its second pass is a full second capture. An annexing tick therefore costs about twice today's worst tick (about 35-40 ms estimated on the wedgie, against round E1's 50 ms gate). Annexes are bounded, though: an annexed sector has no EMPTY cell left, and CLAIMED never reverts, so each sector is annexed at most once. That means at most 16 extra fills per level: about 8M zk cycles in the worst case (+27% on the 30M level), and usually far less.

claimable_s takes 32 B in Game. It is derived from the level and not hashed, like the deflection key. Locals take another 32 B. Compute the sector index from row and column loops rather than a division.

Sectors include the border cells, so a corner sector holds only 196 claimable cells. The fixed sector lines are not safe zones. The quota variant is a different end condition and needs a separate review.

*Fixes.* Count EMPTY cells per sector during the R4.8-4 pass. Skip the annex step and the refill when no sector qualifies. State that annexed cells and the refill's captures count in the capture size before the target test and before the minion step (R4.7-8). Measure an annexing tick on the wedgie.

*Cost.* \+32 B in Game plus 32 B of stack locals. Level format v2 +2 B. Each capture's pass costs about 5-10% more for the per-sector counts. An annexing tick costs about twice a capture, at most 16 per level (at most about 8M zk cycles per level). State hash unchanged. RULES_VERSION bump; new vectors; HUD sector ticks.

*Conflicts.* R4.8-1; R4.8-4; R4.7-8; §5 level bytes v1

**Fairness: ok, 4 of 5; gap unclear; D14 compliant.** D14: kept. The sector lines are fixed like obstacles, but which sector the boss blocks is seeded. The second R4.8 pass is essential: an annex can split the boss's region, and without it D7's single-region patrol argument would break. The no-further-round rule bounds the work. Gap: unclear, roughly neutral as pitched. Search will chain annexes into large walled-off pockets. Humans get coarse, visible goals that lower the precision a big claim needs: 15 annexed sectors already give about 94% without an exact squeeze. That may narrow the top gap more than the chains widen it. Calibration: greedy captures trigger annexes by accident, and a sector-aware policy is easy to script. Draw variance: obstacles split unevenly across sectors, so some sectors annex almost free on obstacle levels, and the seeded boss start decides which sectors are blocked early. The effect is mild and recalibration absorbs the level-to-level part. Cost: up to about 2x capture work, so zk cycles rise on capture-heavy levels.

*Fixes.* Measure search's annex-chain share against the mix in bot-advantage before adopting. If chains dominate, limit annexes to one sector per capture. Ship the 16 sector bars as T0 HUD so humans see what search computes. Measure the zk cycle increase.

**Play: weak, 2 of 5.** It adds some decisions (aim at sector lines, leave the boss's sector for last), but at a real cost to feel and readability. An annex claims cells no trail enclosed, cells the boss's region still reaches. That breaks the genre's basic read, 'you get what you fence off', and the second fill can cascade into claims a human cannot predict. The 4x4 grid of 15-cell sectors is an artificial overlay on organic Qix geometry, and border sectors differ in size (the border and obstacles count against them). Much of the effect is simply faster claiming, which is difficulty, not variety. The quota variant (every sector must reach the target) is the more interesting half: it forces play across the whole field.

*Fixes.* Drop the annex bonus and keep the quota variant as a level goal. Alternatively, set annex_bp high (85% or more) so an annex only tidies a mostly closed sector, and skip the second fill so the result stays predictable. In both cases, show the sector lines on EMPTY cells (dim dots every 15 cells).

*Readability.* Poor on the wedgie. Ticks on the 4 px border do not show sector boundaries inside the field, a sector's progress toward annex_bp cannot be judged by eye, and the 16 quota bars have no HUD space during play.

## Stranded minions never respawn

`capture-rules#3` · T1 Level data v1 · score 9 (core 3, fairness 3, play 3) · gap: neutral · D14: needs-seeding

The field's edge is lined with narrow bays that the minions patrol. Seal a bay while a minion walks inside it and that minion is gone for the rest of the level.

**Rule sketch.** Level data v1 only. Obstacles form bays along the field's edge: open pockets 2 to 4 cells wide, narrower than B so the boss never enters, and 8 to 15 cells deep, separated by 1-cell bars, like 05-comb's teeth but shorter and denser. There are 2 or 3 minions spawned on bay rails with a minion period of 2 to 3. The respawn delay R is larger than T (for example R = 3,000 with T = 2,700). Under R4.7-9, a minion destroyed at tick t would respawn at tick t + R - 1 >= T, so a stranded minion never returns. The right-hand patrol (R4.7-2, R4.7-3) walks every bay's rail. A cut across a bay's mouth claims the bay, because the boss is outside it (R4.8), takes the bay's rail cells off the rail and strands any minion inside (R4.7-8). The seed is used as now.

**Inspired by:** Volfied (1989), Fortix (2009), Lightfish (2011), Mix (2022), Qix (1981), Styx (1983), Frenzy (1984). **Mechanic families:** [Enclosed enemies are destroyed or captured](../taxonomy/capture-rules.md#enclosed-enemies-are-destroyed-or-captured), [Captured enemies respawn](../taxonomy/capture-rules.md#captured-enemies-respawn), [Border patrollers (Sparx)](../taxonomy/edge-and-claimed-enemies.md#border-patrollers-sparx), [Respawning enemies](../taxonomy/field-enemies.md#respawning-enemies). **Touches:** level-data, tools-bots.

**Bot effect.** Keeps the gap, perhaps narrows it. Minion paths are deterministic and visible on the rail, so a human can read and time them, and search times them exactly. The reference mix does not hunt, so a scripted hunter policy should join the calibration mix, or the weights will reward hunters, who are mostly humans.

**Budget.** None in the core: level bytes v1, since R is already a u16. Needs new level ids, a playtest rerun and calibration.

**Variety.** Adds a hunt-first decision: spend early time and risk timing bay seals on minions to make the rest of the level safe, or ignore them and race for area under three fast minions. Minions become targets as well as threats.

**Merged from:** `v1-levels#9`. Variants:

- Permanent culls: minions that never respawn: Three fast minions make the rail deadly, but on this level they never come back: strand one under a capture and it is gone for the rest of the level. Spend the opening hunting them, or claim ground while they are still out.

**Core engineer: feasible with changes, 3 of 5, tier 1.** R = 3,000 with T = 2,700 is valid (R is a u16, and code 31 only requires at least 1), and a minion destroyed at tick 1 or later would come back at tick 3,000 or later, so never. But the mechanism fails with the 1-cell bars of the pitch. A bar cell has bays on both sides, and after one bay is sealed its EMPTY 8-neighbours in the next bay keep it a rail cell. I tested this with the core's own capture() and is_rail() on a top-border comb with 3-wide bays. With 1-cell bars, all 11 wall cells on each side of the sealed bay stayed on the rail. Only the 3 back-wall cells left it. So a minion 'inside the bay' survives unless it happens to be on that short back wall, about 3 of the roughly 25 moves of each bay's loop. With 2-cell bars, every wall cell of the sealed bay left the rail, so a minion anywhere in it is stranded, as the pitch intends. Bays narrower than B keep the boss out, and the open area stays one 4-connected region. The reference mix does not hunt, so its weights will undervalue the level for hunters. The pitch says so.

*Fixes.* Make the bars at least 2 cells thick, so each bay's walls belong to that bay alone. Keep R above T. Add a scripted hunter policy to the calibration mix, or accept and document that bots underrate the level for hunting players.

*Cost.* Code: none. Level bytes v1 (R is already a u16), a new level id, a playtest and calibration. zk cycles about those of the comb levels. It takes one of the season's 16 slots.

**Fairness: concerns, 3 of 5; gap neutral; D14 needs-seeding.** D14 is weakened. In bays narrower than B, the boss can never touch anything beyond the mouth row, and minion patrols are not seeded. The hunt, the level's signature decision, is therefore the same in every run. A cut one row inside a bay is safe from the boss on every seed. A hunt script timed against the fixed patrols can be precomputed, practised in Training and replayed whenever the level is drawn in Challenge. This covers only part of the level, and the main field stays seeded, so it is not a violation. It is still the kind of learnable, copyable segment D14 aims to remove. The gap stays about the same: humans can memorize the hunt (narrows), and bots time the seals frame-exactly (widens). Calibration: as the proposal notes, bold and committer do not hunt. Without a hunter policy, the bot weight misprices the level for humans who hunt, adding draw variance. But adding a policy to the mix (levels/targets.json owns it, P11) recalibrates every level.

*Fixes.* Make the hunt depend on the seed. Either make bays at least B wide, so the boss can enter and the safe window for a seal is seeded, or add a T2 level field that lets the seed pick the minions' spawn bays or start phase. Add a scripted hunter as a secondary playtest policy and compare its clear rate before deciding whether it joins the mix.

**Play: ok, 3 of 5.** Making minions permanent targets is a real new decision. Today R = 45-90, so stranding a minion in comb buys only a few seconds and hunting never pays. With R >= T (valid: R has no upper bound in §5), a hunt-first opening becomes a choice. It is T1 and fits the feel. But as sketched, with 1-cell bars, the mechanic barely fires. A 1-cell bar between bays k and k+1 still touches bay k-1 (and k+1) through its 8-neighbourhood after bay k is sealed, so it stays on the rail. Only the 2-4 bottom border cells of the sealed bay drop off the rail, so the strand window is a few minion moves. Second, bays narrower than B have no boss risk and 2-4-cell mouths, so hunting is cheap. Once every minion is culled, the level collapses into a boss-only level. 'Always hunt first' then risks becoming the dominant opening rather than a trade-off.

*Fixes.* Separate the bays with bars at least 2 cells thick, so sealing a bay strands everything on its whole boundary. Or design the level so that a strand needs a multi-bay seal across a longer, boss-exposed mouth. Make the hunt cost something: put some bay mouths in the boss's roaming area (bays at least B wide), or use a long finite R (for example 900) so a cull buys a window rather than the rest of the level. Add a scripted hunter to the calibration mix, as the idea notes.

*Readability.* Good. A minion walking into a narrow bay and a 2-4-cell seal across its mouth are both easy to read at 4x4 px. A destroyed minion simply disappears, and it helps to show the respawn countdown as 'never' (a strike-through or no countdown).

## Two-player duel field (Training)

`capture-rules#14` · T5 Mode, scoring or contracts · score 9 (core 2, fairness 4, play 3) · gap: neutral · D14: compliant

Two players share one field and one boss. Race for ground, slice through your rival's open cut to take it, and inherit everything they hold if they run out of lives.

**Rule sketch.** A browser-only Training mode. Level bytes v2 add a duel flag; player 2 starts at (30, 0), which validity requires to be a rail cell. Journal v2 events carry two masks. Ownership (none, player 1, player 2) lives in spare bits 6-7 of each CLAIMED or TRAIL grid byte and goes into a state hash v2 with 3 bits per cell. Both players walk any rail cell; step 3 runs player 1, then player 2. A player's capture is R4.8 on its own trail and gives its owner the cells it turns CLAIMED. A player who steps onto the rival's TRAIL treats it as CLAIMED: their own cut, if open, closes there; the rival's trail joins the capture as the cutter's ground, and the rival is hit at step 6 and loses that cut. The boss and the minions hit both players. When a player runs out of lives, every cell it owns passes to the other player. Score: owned cells in bp, ties going to fewer lives lost. Because the players move in turn, both can never claim the same cell on one tick; resolving both moves against the same state, with cells claimed by both turning neutral, is the alternative.

**Inspired by:** Paper.io 2 (2018), Pauper.Io! (2026), 圈地大作战 (2026), looprush (2026), Splix.io (c. 2016 (unconfirmed)). **Mechanic families:** [Elimination annexes the victim's territory](../taxonomy/capture-rules.md#elimination-annexes-the-victims-territory), [Enclosure takes rival territory](../taxonomy/capture-rules.md#enclosure-takes-rival-territory), [Simultaneous claim neutralises](../taxonomy/capture-rules.md#simultaneous-claim-neutralises), [Elimination erases the victim's territory](../taxonomy/capture-rules.md#elimination-erases-the-victims-territory). **Touches:** input, journal, level-format, rules, state-hash, presentation.

**Decisions it reopens:** D5; R4.9-1; §6.3 journal v1.

**Bot effect.** None on paid modes while the duel stays in Training. In Challenge, a search bot would dominate head-to-head, and two inputs weaken D14's no-copy argument, so it should stay out of paid modes.

**Budget.** A second player entity (about 12 bytes); grid ownership in spare bits, so no new RAM; a state hash v2 (1,350-byte grid packing); journal v2 with two masks per event, so the 8,100 B buffer holds half as many events or must grow. Browser only, so no wedgie cost (D15). Screen: two more colours.

**Variety.** Adds interaction the solo game cannot have: shadowing the rival's cut, baiting them into long cuts, and choosing between your own claim and an ambush. It uses the same boss and capture rules, so it also works as a teaching mode.

**Core engineer: feasible with changes, 2 of 5, tier 5.** Buildable only as a separate, feature-gated browser module, and the sketch leaves key rules undefined. (1) The grid is `[Cell; 3600]` with a 4-variant repr(u8) enum, so it has no 'spare bits 6-7'. Storing other bit patterns there is UB, and new Cell variants would touch is_rail, the boss edge test, capture and the hits: every consensus path of the paid modes. (2) The commonest case is undefined. When P1 closes a normal cut while P2's cut is open, R4.8-3 makes P2's TRAIL a wall for P1's fill, and R4.8-4's pass turns ALL TRAIL to CLAIMED. P2 is then mid-cut on a CLAIMED cell with cutting set. (3) The rival-trail case conflicts with itself. The rival's trail 'joins the capture as the cutter's ground', yet the rival 'loses that cut', and abandon_cut does grid.replace(TRAIL, EMPTY) on every trail cell. (4) Also undefined: player-player contact on the rail, what X does in a duel, what ends the level once one player is out (D5 says the level scores 0), and the clear condition. (5) A duel flag in the level bytes is the wrong place, since it forks the level ids of identical maps. A duel is a mode, so it belongs in the journal's mode byte (a new value 3). (6) 4-byte events do not 'halve' capacity: 2,700 events need 10,800 B (8,100 B holds 2,025). (7) P1-moves-first is a systematic edge. (8) 'No wedgie cost' only holds with a cargo feature: the natmod's code is loaded into the MicroPython heap (18,320 B; 45 holes already fail), and the zk guest's ELF size adds paging cycles. The payoff is a free mode with no money behind it.

*Fixes.* Implement it as a duel module behind a cargo feature, excluded from jiro-natmod and the zk guest. Give it its own DuelGame that reuses Grid, Boss and Minions, with a separate 900-B 2-bit ownership array instead of grid bits. Select it with journal mode 3 (Training only) instead of a level flag. Define: any capture treats the rival's open trail as EMPTY for the fill and leaves it TRAIL (or abandons the rival's cut first); player cells block each other on the rail; X ends the duel for both; the level ends when both are out or at T. Alternate the move order by tick parity.

*Cost.* Browser only: Player +12 B, ownership 900 B (2 bits per cell), state hash v2 about 1,400 B (1,350 B grid at 3 bits), journal v2 with 4 B events (a 10,800 B buffer). Per tick about twice the player step and the hit predicate. A second capture rule set and renderer, two colours. No wedgie or zk cost only if feature-gated. A new journal mode, vectors for it, and no calibration (Training).

*Conflicts.* D5; D15; R4.8-3; R4.8-4; R4.9-1; R4.9-17; R4.10-1; §6.3 journal v1 mode byte; §6.4 state hash v1

**Fairness: ok, 4 of 5; gap neutral; D14 compliant.** This is a browser-only Training mode, so the paid-mode questions mostly do not apply. No weights, no draw and no pot depend on it, and the pitch is right that two inputs and a head-to-head search bot keep it out of Challenge. What does apply is the risk to the shared referee core. Ownership in grid bits 6-7 means every cell-state comparison in the one core must mask those bits, including the capture pass and the rail test that Challenge runs through. A masking bug there would change paid outcomes. Moving to state hash v2 and journal v2 everywhere would also force a new season and a recalibration for a mode that pays nothing. Scripted bots are not needed, since there is no calibration. It adds no variance to the draw.

*Fixes.* Have the decoder and referee reject the duel flag and journal v2 in mode 1, so that only Training accepts them. Keep Challenge on journal v1 and state hash v1. Prove the single-player path unchanged: every committed vector replays bit for bit and RULES_VERSION does not move for solo play. If the masking cannot be kept out of the hot paths, put ownership in a side array that only the browser build allocates.

**Play: ok, 3 of 5.** The solo game cannot have this kind of interaction: racing for ground, slicing a rival's open cut, baiting them into long exposure under a shared boss. The decisions are real and new. But it is a separate game, not an enrichment of the solo boss, minions, rail and commit loop, and the commit and out-of-lives rules (D5) lose their meaning or change: does X end the level for both, and does running out of lives become a transfer of land instead of a zero? The sketch leaves holes that matter for play. R4.8-4 as written turns every TRAIL cell into CLAIMED, so one player's capture would also claim the rival's open cut for the capturer, unless it is changed to convert only the cutter's trail. Contact between the two players on the rail is undefined, and so is a rival cutting inside a region the other player captures. It is local only (no netcode), so it means two people on one keyboard or two gamepads. It puts a second player entity into the consensus core that runs on the RP2040 and in the zk guest, for a free browser-only mode. That is a large cost for a side mode.

*Fixes.* Specify R4.8-4 per owner: only the cutter's TRAIL becomes CLAIMED, and the rival's trail stays a wall unless sliced. Define player-player contact on the rail (pass through or block) and what X does (disable commit in a duel, or let it end only your own play). Keep the duel out of the paid core: build it as a feature-gated module not compiled into the zk guest, so RULES_VERSION and the paid vectors are untouched. A cheaper first step is an async ghost race (a rival's journal replayed as a ghost on the same seed), which tests interest with no consensus change.

*Readability.* Browser only (D15), so the wedgie screen is not involved. In the browser at 4x4 px cells, two trail colours and two claimed tints are easy to tell apart. The two player cursors need strongly contrasting colours. Two more palette entries fit in 16 colours.

## Penned boss auto-complete

`capture-rules#4` · T3 New core rule · score 8 (core 4, fairness 3, play 1) · gap: widens · D14: compliant

Leave the boss a room no bigger than the pen size shown on the HUD and the level is yours at 100%: a rough finisher instead of a pixel-perfect squeeze.

**Rule sketch.** Level bytes v2 add pen_cells (u16; 0 = off; validity: 0, or B\*B \<= pen_cells \< 1,682). At step 3, right after a capture (R4.8-4) and its minion step (R4.7-8), let open = claimable - captured. After a capture no trail is left, and the open field is the boss's single region (the D7 argument), so open is exactly the boss's room, body included. If pen_cells > 0 and open \<= pen_cells, the boss is penned: the level ends Cleared at step 3 with claim_bp = 10,000. This test runs before the target test of PIN-10. The grid keeps the boss's room EMPTY; only the reported claim changes. Suggested values: (B+4)^2 on normal levels (81 cells at B = 5, 2.4% of the open field) and 2\*B\*B on hard ones. The seed is not used.

**Inspired by:** Frenzy (1984), Volfied (1989), Xonix (KolibriOS) (2006), JayBall (unknown), Narrow the Siege (2022), Boundarpy (c. 2019). **Mechanic families:** [Auto-complete above a threshold](../taxonomy/capture-rules.md#auto-complete-above-a-threshold), [Squeeze capture](../taxonomy/capture-rules.md#squeeze-capture), [Absolute count clear condition](../taxonomy/capture-rules.md#absolute-count-clear-condition), [Immobilisation clear](../taxonomy/capture-rules.md#immobilisation-clear). **Touches:** level-format, rules, outcome, tools-bots, presentation.

**Decisions it reopens:** R4.10-1; PIN-10; R4.1-8.

**Bot effect.** Narrows the gap. Search already ends levels at about 98.5% of the ceiling, (claimable - B\*B)/claimable, so penning raises its score by about 1.5% at most. A human whose finisher leaves 80 cells instead of 30 goes from about 86% to 100%. The precision of the last cut stops being search's edge; its remaining edge is surviving the set-up. The scripted mix needs a 'penner' finisher for calibration. D14 is unaffected.

**Budget.** One subtraction and one compare per capture; 2 bytes of level data; no RAM. No state-hash change, because penning ends the level and leaves no state. zk cycles unchanged. Screen: an 'open N / pen M' readout and a flash when the boss is penned.

**Variety.** Adds a third ending besides clearing at the target and committing: setting up a finisher that shuts the boss in a small room. The pen size is a new difficulty knob, independent of the target, that sets how tight that room must be.

**Core engineer: feasible, 4 of 5, tier 3.** The rule is correct and cheap. After a capture no TRAIL is left and only the boss's region stays EMPTY (D7), so claimable − captured is exactly the boss's room, body included. No state is added.

The payoff is overstated, though. A level already ends at the first capture that reaches the target (PIN-10), so the pen can only fire on that one capture, and only if it leaves at most pen_cells open. A finisher that leaves 80 cells already scores (3,364 − 80)/3,364 = 97.6%, not 86%. The bonus is therefore at most pen_cells/claimable: 2.4 points at 81 cells, 1.5 at 2B². Humans who cross the target with an ordinary cut (ending around 80-90%) never trigger it. The bot gap barely moves; the main value is the HUD readout and a finishing goal.

One wart: the reported claim (10,000) no longer matches the grid. R4.1-8 must say so; the 'captured cells' field of the state hash is unaffected. A level with target 10,000 (valid today, but never clearable because the body is always EMPTY) becomes clearable, which is fine.

*Fixes.* Correct the bot-effect figures (80 cells left is 97.6%, not 86%). The rule matters mostly on levels with high targets (9,000 and up), where penning becomes the clearing route, so pair it with those. Optionally express pen_cells in basis points of claimable so that it scales on obstacle levels. Add a validity code for pen_cells.

*Cost.* Level format v2 +2 B (474 B), so every level id changes. 1 subtraction and 1 compare per capture; 0 B RAM; state hash unchanged; zk unchanged. RULES_VERSION bump; new vectors; HUD 'open/pen' readout.

*Conflicts.* R4.10-1; PIN-10; R4.1-8; §5 level bytes v1

**Fairness: concerns, 3 of 5; gap widens; D14 compliant.** D14: kept, and the seed is not used. The mechanism is clean: after a capture the open cells are exactly the boss's single region (D7), so the test is one subtraction. The fairness claim fails at the suggested values. Leaving 80 of 3,364 cells open is a claim of 97.6%, not 86%. A human or scripted clear at about 7,800 to 8,600 bp leaves 470 to 740 cells open, far above a pen of 81 (B = 5) or 128 (B = 8). At those pens only search pens reliably: it already leaves about 40 cells on open (9,881 bp), so it gains about 1.2 to 2% per level while the mix gains nothing. The gap widens slightly. The idea narrows the gap only if the pen sits near the open-cell count of a typical clear. At the target-equivalent (claimable \* (1 - target)) every clear would score 10,000, which flattens finisher precision completely. A large pen also makes a cliff, for example 86% vs 100% one cell apart. That turns level scores bimodal and adds variance to the draw on whichever levels have it. Calibration: a 'penner' finisher is easy to script, but the mix must have one, or the median-based weights ignore the bonus.

*Fixes.* Fix the arithmetic. Size pen_cells from data: around the open cells left at the reference mix's median clear, or tie it to the target. Alternatively, replace the cliff with a graded bonus (for example, linear from the target to 10,000 as open falls to the pen). Add a penner policy to the mix and rerun bot-advantage to show the gap actually narrows.

**Play: weak, 1 of 5.** This adds almost nothing. The level already clears at the first capture that reaches the target, and leaving the boss a small room is already the best finisher: the claim rises continuously as the room shrinks. Any capture that leaves at most 81 open cells already reports at least 97.6% (3,283 of 3,364), above every target, so the pen only rounds the last 2.4% up to 100% (about 3.8% at 2\*B\*B with B = 8). The pitch's example is wrong: a finisher that leaves 80 cells already scores about 97.6% today, not 86%. The human it says it helps is one who clears at about 86% without penning, and the pen does not change that. No new decision appears; it puts a small cliff at the threshold, where 81 against 82 cells is worth 2.4%. It is also not a new ending: the big penning finisher is how search already gets 98.5% of the ceiling.

*Fixes.* Make it presentation only (T0): flash 'penned' and play a sting when the boss's room is small, with no rule change. A finisher incentive that matters would have to change claims well below 97%, which this cannot do.

*Readability.* Poor on the wedgie: the field takes the whole 240x240 screen and there is no HUD during play, so an 'open N / pen M' readout has nowhere to go. The flash itself is easy to see.

## Smaller-side capture with boss catch

`capture-rules#7` · T3 New core rule · score 8 (core 3, fairness 3, play 2) · gap: narrows · D14: compliant

Every cut takes the smaller side, wherever the boss is. If the boss is on that side, it is caught and the level clears on the spot.

**Rule sketch.** Level bytes v2 add capture_rule (0 = today's rule: the boss's region stays open; 1 = the largest region stays open). Under rule 1 a capture runs in three passes. (a) For each EMPTY cell in row-major order that is not yet marked, flood its 4-connected region with a transient mark VISITED (a new transient cell value, like BOSS_ZONE never left at the end of a step and never hashed) and count its size. Keep the seed cell of the first region of largest size: only a strictly greater size replaces it, so ties go to the earliest seed. (b) Flood that region again from its seed, turning VISITED into BOSS_ZONE. (c) Make one pass: BOSS_ZONE becomes EMPTY; EMPTY, VISITED and TRAIL become CLAIMED. If the boss's top-left cell is now CLAIMED, the boss is caught: the level ends Cleared at step 3 with the claim just computed, the boss's pocket and body included. Otherwise the minion step and the target test run as today. One open region remains, so D7's patrol argument holds. The seed is used as now.

**Inspired by:** Frenzy (1984), Shocker (1988), Cacoma Knight in Bizyland (1992), Photo Slice (2026), Night Flight (1982), 陣取り (Evio) (1993). **Mechanic families:** [Smaller side is claimed](../taxonomy/capture-rules.md#smaller-side-is-claimed), [Trap or eliminate enemies to clear](../taxonomy/capture-rules.md#trap-or-eliminate-enemies-to-clear), [Enclosed enemies are destroyed or captured](../taxonomy/capture-rules.md#enclosed-enemies-are-destroyed-or-captured). **Touches:** level-format, rules, outcome, tools-bots, presentation.

**Decisions it reopens:** R4.8-1; R4.8-2; R4.8-3; R4.8-4; R4.10-1; D10.

**Bot effect.** Narrows the gap strongly at the top. A cut into two regions takes at most half the open field, so the best final claim falls to about (10,000 + target)/2 for everyone: 8,750 bp at a target of 7,500. Cuts into three or more regions can take more but are hard to set up. Search's precise near-total squeeze stops paying. Search still dodges better and catches the boss more reliably, since it knows the deflection key, so a gap in clear rates remains. Owner decision: as sketched, a catch counts as a clear for minClears (D10). If that is too cheap, end a catch below the target as Committed instead.

**Budget.** Capture work rises to about 2x today's worst: every open cell is flooded once, the largest region twice, plus the pass. It uses the same 6,728 B stack, one flood at a time, and no new RAM. No state-hash change. zk cycles rise with the capture share, an estimated 10 to 20% on capture-heavy levels (to be measured). Screen: a catch animation.

**Variety.** The boss no longer hands you everything on the other side of a cut. No cut takes the big side at once, mid-field cuts become timing bets on which side the boss will be when the cut closes, and closing a pocket around the boss becomes a deliberate trap (a clear) or a costly accident (a clear at a poor claim).

**Core engineer: feasible with changes, 3 of 5, tier 3.** The rule is sound. VISITED is a fifth in-memory Cell value (Cell is a u8 enum) that never survives a step, so the 2-bit state hash holds. One region stays open, so D7 holds, and ties are deterministic.

The cost is understated as sketched. Every capture floods every open cell and then refloods the largest region: about twice today's fill, on every capture. Captures dominate zk cycles (about 0.5M user cycles each on an open field: capture-edge-rectangle 1.65M against 1.12M for short vectors without a capture). Capture-heavy levels would rise about 30-60%, not 10-20%. The wedgie's worst tick, which is a capture (1.42M instructions on qemu, about 22 ms on the device by the README's estimate), would approach 35-40 ms, against round E1's 50 ms gate. Most of that extra work can be avoided (see fixes).

The rule also drops the Qix/Volfied identity stated in R4.8's rationale. A 2-region cut takes at most half the open field, so the best final claim is about (10,000 + target)/2, as the pitch says. A catch counting as a clear at a tiny claim (a 200-cell pocket ends Cleared at about 6%) lets a weak run satisfy minClears cheaply. That is an owner decision under D10, as the pitch notes.

*Fixes.* Flood the boss's region first (BOSS_ZONE, size n_b), then the other regions in row-major order with VISITED. The boss's region stays open unless another region is strictly larger; a tie keeps the boss's region, which is today's outcome. A capture without a catch then costs one flood over the open cells plus the pass, the same as today's worst. The extra work over a whole level is at most one flood of the captured cells, about +0.4M cycles per level. Only a catch, which ends the level, refloods the largest region: up to twice the fill, once. Have the owner decide whether a catch below the target ends Committed rather than Cleared.

*Cost.* 0 B RAM: the same 6,728 B stack, one flood at a time. Level format v2 +1 B; state hash unchanged. With the fix: zk about +1-2% per level, and the worst tick about today's except on the catch tick (up to twice the fill). As sketched: zk +30-60% on capture-heavy levels and a worst tick about twice today's. RULES_VERSION bump; new vectors.

*Conflicts.* R4.8-1; R4.8-2; R4.8-3; R4.8-4; R4.1-2; R4.10-1; PIN-10; D10

**Fairness: concerns, 3 of 5; gap narrows; D14 compliant.** D14: kept. The boss is seeded and the capture rule draws nothing. Gap: narrows strongly at the top, as pitched. Two-region cuts cap the claim at a clear at about (10,000 + target)/2, and humans already cross the target at about 8,000 to 8,600, so the difference in claim at a clear nearly vanishes. Three problems remain. (1) Catch as a clear is too cheap. One straight rail-to-rail cut, closed while the boss sits on the narrower side, catches it at a claim of about 30 to 50%. That makes qualification under D10's minClears = 1 trivial for anyone. (2) The cap is soft for search. A path that passes diagonally by a CLAIMED peninsula left by an earlier cut pinches off a third region. Search will engineer three-way final splits, especially on obstacle levels, to beat (1 + T)/2. So the gap partly returns, unevenly per level, which adds level-dependent search uplift to the draw. (3) Capture cost about doubles, and zk cycles rise an estimated 10 to 20% on capture-heavy levels, raising the per-run proving price, already 37% of the fee. Calibration: easy, since bots no longer need to track the boss's side. The rule replaces the boss-side capture that the game's genre identity rests on, so it is an owner-level change.

*Fixes.* Use the pitch's own fallback: a catch below the target ends the level as Committed, not Cleared, so minClears keeps its meaning. Measure how often search reaches three-way splits per level. If they are common, cap a catch's or a split's claim, or count only the regions on the trail's two sides. Measure the zk cycle increase before adopting.

**Play: weak, 2 of 5.** It replaces the genre's central rule: the boss's side stays open. With the larger side always kept, the boss stops deciding which side a capture takes; it only matters as a hazard and as a catch target. Every cut takes at most half the open field, so the satisfying big finisher is gone and claims bunch up just above the target, at about (10,000 + target)/2 at best. The catch is a perverse ending: a pocket closed around the boss early clears the level at a low claim. That pays for minClears qualification (D10) and costs score, a trade-off that feels wrong in paid play. At near-even splits, a human cannot tell at 4 px which side is larger, so the result of a cut becomes a coin flip they cannot read. Capture work also doubles. It does create mid-field timing bets, but they come at the expense of the core feel.

*Fixes.* Keep today's rule (the boss's region stays open) and add a catch only when the boss's region is clearly the smaller one, for example under 1/4 of the open field: a pen bonus layered on the existing game. If the larger-side rule is kept as a level variant, keep the boss's side open whenever the two sides are within about 10% of each other, and make a catch below the target count as Committed, not Cleared.

*Readability.* Mixed. The boss catch is readable, but which side a near-even cut will take is not: two regions of about 1,000 cells cannot be compared by eye at 4 px with no HUD.
