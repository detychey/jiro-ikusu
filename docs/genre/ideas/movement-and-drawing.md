# Ideas: movement and drawing

The 7 ideas proposed from the axis of the [taxonomy](../TAXONOMY.md) *movement and drawing*: how the player moves and draws: rail or free movement, draw speeds, trail rules, fuses, diagonal moves, auto-draw, stopping, shapes drawn. Sorted by score. The [index](../IDEAS.md) lists every idea by tier and score, and [`README.md`](../README.md#the-taxonomy-and-the-ideas) explains the judges.

## Retractable trail

`movement-and-drawing#6` · T3 New core rule · score 11 (core 3, fairness 4, play 4) · gap: narrows · D14: compliant

Step back onto the trail cell you just left and the line rolls back up behind you. Walk all the way back and the cut is cancelled with no life lost, or stop halfway and branch off in a new direction, but every cell still drawn stays exposed while you retreat.

**Rule sketch.** The player gains trail_len, a u16. The trail's cells are kept in order as u16 cell indices in the first trail_len entries of the existing capture stack (Game.stack, 3,364 entries, exactly the most cells a trail can hold). A capture needs the stack only after the cut has closed, when the log is no longer needed. Under R4.5-2, entering an EMPTY cell pushes it onto the log. A new R4.5 rule is checked before R4.5-4 and R4.5-5. While cutting, a sub-step onto the previous trail cell (log\[trail_len − 2\], or the cut start when trail_len = 1) is a retreat. The cell the player leaves becomes EMPTY and trail_len drops by 1. On reaching the cut start, the player stops cutting with no capture. A retreat sub-step ends the tick's movement, so retreating runs at 1 cell per tick (1 per 2 ticks with B held) and A does not speed it up. Any other step onto TRAIL is still ignored (D4). Hits, commit and a lost life work as today and reset trail_len to 0. Minion hits use the cells actually entered, so a minion waiting at the cut start hits by the share case.

**Inspired by:** Volfied (1989), Perestroika Girls (1993), Fortix (2009), VoidMania (2026), Landgrab - Line Cutting Arcade (2026). **Mechanic families:** [Retreat along the open trail (retractable trail)](../taxonomy/movement-and-drawing.md#retreat-along-the-open-trail-retractable-trail), [Committed vs cancellable cuts](../taxonomy/movement-and-drawing.md#committed-vs-cancellable-cuts), [No reversing onto the open trail](../taxonomy/movement-and-drawing.md#no-reversing-onto-the-open-trail), [Miss resolution: trail erased, respawn point](../taxonomy/movement-and-drawing.md#miss-resolution-trail-erased-respawn-point). **Touches:** rules, state-hash, tools-bots, presentation.

**Decisions it reopens:** D4; R4.5-4; R4.5-5; PIN-04; PIN-05; R4.3-2.

**Bot effect.** Narrows the gap. It is a reactive escape: a human who sees the boss turn toward the cut can back out or re-route at the cost of time, while search, which foresees the turn, rarely needs to. Commit stops being the only way out of a doomed cut. Scripted bots get a simple rule that is easy to calibrate: retreat when the projected bump comes before the projected close. It conflicts with the lasso-and-spur idea, since both use the step back; a per-level byte could choose one or the other.

**Budget.** Two bytes of state and no new buffers, because the log reuses the 6,728-byte capture stack. O(1) per tick. State hash v2 must serialise trail_len and the log; the preimage grows to at most about 7.7 KB, but it is hashed only for traces, never while stepping. Negligible zk cycles. Screen: one cell redrawn per retreat.

**Variety.** It adds aborting mid-cut, partial retreat followed by a new branch to steer around a boss turn, and backing off from a minion waiting near the end of a cut. Today a started cut can only be finished, abandoned with Commit, which also ends the level, or lost to a hit.

**Core engineer: feasible with changes, 3 of 5, tier 3.** Reusing Game.stack as the trail log is sound. Only validate (in Game::new) and capture write the stack, and capture runs after the cut has closed. The trail cannot exceed 3,364 cells.

Three issues:

1. The trail_len = 1 retreat changes today's behavior. Stepping from the first trail cell back onto the cut start is now a close (R4.5-5) that captures 1 cell. The retreat rule turns it into a cancel, so any committed vector or journal that pokes out and back changes its outcome. Moved outcomes must be explained, or retreat limited to trail_len ≥ 2.
2. The log becomes consensus state, because the trail's cell order cannot be recovered from the grid when the path folds beside itself. A fixed-width hash means serialising 6,728 B, zero-padded past trail_len because capture leaves garbage in the stack. The preimage grows from 948 B to about 7.7 KB, roughly 8× the keccak work per traced tick (57 blocks instead of 7) on every target.
3. D4 and R4.5-4 have to be rewritten. The Player::sub_step match must test a retreat before both (_, Trail) and (true, Claimed).

The 'retreat ends movement' rule and minion hits on the entered cells are consistent with PIN-04 and R4.9-6. The retreat at step 3 empties the front cell before the boss's step 4, which is the intended dodge.

*Fixes.* - In state hash v2, serialise trail_len and keccak256 of the log's first trail_len entries (32 B) rather than the raw log. This keeps the preimage at about 982 B.
- Decide whether a one-cell poke back to the cut start still captures (retreat only when trail_len ≥ 2) or cancels.
- Document the invariant that nothing else may use the capture stack mid-cut.

*Cost.* - State: +2 B (trail_len), plus a 32 B log digest in hash v2; no new buffers.
- Per tick: O(1) per retreat; zk negligible.
- Versioning: RULES_VERSION bump, all traces regenerated, bots taught retreat, recalibration.
- Screen: one cell per retreat.

*Conflicts.* D4; R4.5-4; R4.5-5; PIN-04; PIN-05; R4.3-2; §6.4 state hash v1

**Fairness: ok, 4 of 5; gap narrows; D14 compliant.** It narrows the gap. Retreat is a reactive escape that a human uses on an unforeseen boss turn or a minion at the far end of a cut, while search, which already foresees both, gains little. I found no exploit for bots. TRAIL stays lethal to the boss's edge test, so a trail is never a safe wall. The rail ignores TRAIL versus EMPTY (R4.2-3), so retracting leaves minions unaffected. Starting a cut still ends invulnerability. Retreat runs at 1 cell per tick, a sub-step that ends the tick's movement, so it is no faster than drawing. Reusing the capture stack for the trail log is safe, because the flood fill needs the stack only after the cut has closed. There is no D14 effect, and no level-specific effect, so it adds no variance to the draw. The rule is simple for scripted bots ('retreat when the projected bump comes before the close'), but the mix's clear rates will rise, so recalibration is required. Costs: D4, PIN-04 and PIN-05 change, RULES_VERSION is bumped, and state hash v2 carries the log.

*Fixes.* Pin how a back-press is resolved under R4.5-1. Two directions can be held at once, so specify that a retreat needs the opposite direction resolved by R4.5-1's rules, and add vectors for rolling through the reverse. Teach bold and committer to retreat before recalibrating, so the weights reflect the new risk. Record in README §4.10 that Commit is no longer the only way out of a doomed cut.

**Play: strong, 4 of 5.** It changes the central cut loop with new choices, not more difficulty. Today a started cut can only be finished, lost to a hit or ended with Commit, which ends the level. With retreat, the player trades exposure time for safety: back out when the boss turns, retreat partway and branch around it, or back off from a minion waiting near the close. Retreating at 1 cell per tick, with A giving no speed-up, keeps long cuts costly to undo, so commitment tension remains. It keeps D4's core (the own trail still blocks every step except the one back onto the previous cell), and it narrows the human/bot gap because the escape is reactive, which none of the other movement ideas do. Reusing the capture stack as the trail log fits the memory budget, because the log is dead by the time a capture needs the stack. Costs: the trail log must enter state hash v2 (trail order can't be recovered from the grid when a trail touches itself), the 16 levels need recalibration because they all become easier, and scripted bots need the retreat rule. It does change the Qix-like feel of committing to a line, so playtest it before freezing.

*Fixes.* Make it global, not per-level: a movement rule that differs between levels confuses players. Rerun the playtest and recalibrate. Specify exactly that a retreat step leaves the previous direction (PIN-05) and press_tick unchanged. In the bot mix, add a simple policy: retreat when the projected bump comes before the projected close.

*Readability.* Very readable: the trail visibly shrinks one red cell per tick back to the field colour.

## Diagonal cutting

`movement-and-drawing#8` · T3 New core rule · score 10 (core 3, fairness 4, play 3) · gap: neutral · D14: compliant

While cutting, holding two perpendicular directions draws a 45-degree line. The player can slice corners off the boss's space, close triangles, and cross the field with half as many exposed cells as a staircase.

**Rule sketch.** R4.5-1 is extended. While cutting, if exactly two perpendicular directions are held (U+L, U+R, D+L or D+R), the resolved direction is that diagonal. On the rail, and with any other combination, R4.5-1 applies as today, so rail moves stay 4-way (D3). A diagonal sub-step targets (x ± 1, y ± 1) and follows R4.5-2 to R4.5-5: into EMPTY it lays a new TRAIL cell, onto CLAIMED it closes the cut, onto TRAIL it is ignored, and onto the boss body it is a hit. One extra rule: it is ignored if both orthogonal cells it passes between are TRAIL, so the player cannot slip through a diagonal gap in its own trail. A diagonal trail is still a wall for R4.8's 4-connected fill, because two diagonal cells leave no 4-path between them, and the boss moves one axis at a time, so it cannot pass between them either. R4.8 and R4.6-3 therefore stay unchanged. The previous-direction field grows from 4 to 8 values, which changes its meaning in the state hash. A diagonal applies only when the same pair was also held on the previous tick. That previous mask is already available at the Input step.

**Inspired by:** Styx (1983), Gals Panic II (1993), Spider Web (1989), Territory Reveal (2026). **Mechanic families:** [Eight-way diagonal movement](../taxonomy/movement-and-drawing.md#eight-way-diagonal-movement), [Any-angle straight cuts](../taxonomy/movement-and-drawing.md#any-angle-straight-cuts), [Grid-step four-direction movement](../taxonomy/movement-and-drawing.md#grid-step-four-direction-movement). **Touches:** rules, input, state-hash, tools-bots, presentation.

**Decisions it reopens:** R4.5-1; PIN-05; R4.1-1.

**Bot effect.** About the same gap, possibly a little narrower. While cutting, search has twice as many moves to consider (8 instead of 4), so its fixed per-tick compute budget covers fewer futures. For humans, a diagonal is natural input (two keys on a keyboard). The new geometry helps both sides. Scripted bots need triangular cuts to use it; greedy's rectangles stay valid.

**Budget.** No new RAM. Each diagonal sub-step reads two extra cells for the corner test. Negligible zk cycles. The journal format is unchanged, because masks with two direction bits are already valid v1 masks, but their meaning changes, so RULES_VERSION goes up and vectors are regenerated. Screen: unchanged; diagonal lines look jagged at 4 px, which is acceptable.

**Variety.** It adds triangular and diamond captures, corner slices, and 45-degree chords that meet the boss's diagonal motion head-on. A cut toward a corner costs half as many trail cells. All 16 current levels allow only right-angled shapes.

**Core engineer: feasible with changes, 3 of 5, tier 3.** The geometry holds. An 8-connected diagonal trail is a barrier to 4-connected movement, so R4.8's fill cannot cross it. Nor can the boss under R4.6-3: it moves one axis at a time, and each of its body cells moves 4-adjacently onto an EMPTY cell. R4.8 and R4.6-3 therefore stay as they are. After a capture, the rail along a diagonal edge is a 4-connected 2-cell staircase whose corner cells touch the field diagonally. R4.7-3 and PIN-06 already handle those cells (the border corners are the same case), so D7's coverage holds.

Gaps:
(a) A diagonal trail that separates nothing (border to obstacle, field on both sides) becomes a diagonal CLAIMED line of 4-isolated rail cells. Neither the player nor the minions can walk it. That is legal (single-cell obstacles behave the same way, PIN-18), but on screen it looks walkable.
(b) R4.5-1 needs a precedence rule. With Up held and then U+R held for two ticks, does the kept Up win or the diagonal?
(c) The previous-direction byte goes from 0-4 to 0-8. CLAUDE.md requires a state hash version bump (v2) even though the layout is unchanged, and vectors/format must be regenerated.
(d) The previous mask is in the prior state (the state hash's mask), so no new state is needed. But step 3 must read it before step 1 overwrites Game.mask.
(e) Two-direction masks already occur in journals (the random-dirs vectors), so existing vectors will change outcome. This is a behavior change, and the moved outcomes must be explained.
(f) A diagonal can still pass between the player's own TRAIL and a CLAIMED cell. That is harmless for capture, but it makes the anti-slip rule partial.

Search branches 8 ways instead of 4 while cutting; the gap stays about the same.

*Fixes.* Rule that a diagonal takes precedence over the kept direction when the same pair was held on the previous tick. Bump the state hash to v2, with direction 5-8 = UL, UR, DL, DR. Pass the previous tick's mask into step 3 as a local value, not as stored state. Optionally ignore any diagonal whose two orthogonal cells are both TRAIL or CLAIMED, for one uniform rule.

*Cost.* 0 B RAM and no new state fields. 2 extra cell reads per diagonal sub-step; zk under +1%. Journal v1 bytes unchanged. State hash v2 (new direction values, same 948-byte layout). RULES_VERSION bump; vectors regenerated with moved outcomes; screen unchanged.

*Conflicts.* R4.5-1; R4.1-1; R4.3-2; PIN-05; §6.4 state hash v1 previous-direction encoding

**Fairness: ok, 4 of 5; gap neutral; D14 compliant.** D14: kept. The boss is untouched. The geometry checks out. An 8-connected diagonal trail still separates 4-connected regions, so R4.8's fill and the boss's one-axis edge tests stay sound. The rule that both orthogonal cells must be TRAIL stops the trail from crossing itself, and the boss cannot slip a diagonal gap. Gap: about neutral. Diagonals cut exposure for everyone, and keyboard players can press two keys easily. The claim that search loses depth from a larger branching factor should not be counted on: search will simply use the better chords. One human-only cost: rolling from one direction to the next on a keyboard often overlaps the keys for over 133 ms (2 ticks), which now makes an unintended diagonal sub-step instead of a turn. That mistake costs humans and never costs bots. The first tick of every diagonal is also an orthogonal stub, which search plans around and humans will find jagged. Calibration: easy. Greedy rectangles stay valid, and a triangle-cut variant is simple. The draw: diagonals through the corner gaps of obstacles change maze, comb and labyrinth levels more than open ones, so recalibration is needed but no new randomness is added. The previous-direction field now takes 8 values: that is a state-hash format change (v2), not just a change of meaning.

*Fixes.* Bump the state hash version for the 8-valued previous-direction field. Measure, from browser input logs, how often humans' key overlaps on turns last 2 ticks or more. If that is common, require 3 ticks, or require that neither key of the pair started being held on the tick of the turn. Rerun bot-advantage with a diagonal-aware greedy to confirm the gap is neutral.

**Play: ok, 3 of 5.** Gives cuts a real new geometry: triangles, corner slices, and chords that meet the boss's diagonal motion head-on. The wall argument holds: a diagonal line of cells is a wall for a 4-connected fill, and a body that moves one axis at a time cannot cross it. After a capture the claimed side makes the rail a 4-connected staircase, so D7 still holds. A diagonal step onto CLAIMED lands on a rail cell through the 8-neighbour rule, which keeps R4.5-5 true. Most of the effect, though, is cheaper and faster exposure: with A held, two diagonal sub-steps move about 2.8 cells of distance per tick, which mainly lowers difficulty.

*Fixes.* Let diagonal sub-steps ignore A (one sub-step per tick). The player then trades a fast staircase (2 cells per tick, more trail) against a slower diagonal (1.41 per tick, fewer trail cells), which is a real decision rather than a pure speed-up. Gate diagonals behind a v2 level byte so they define a level family.

*Readability.* Acceptable. A diagonal trail is red 4x4 cells touching at their corners, a dotted jagged line, still clear on black.

## Per-level draw speeds

`movement-and-drawing#4` · T2 Level format v2 · score 10 (core 4, fairness 3, play 3) · gap: widens · D14: compliant

Each level sets how fast the fast cut runs, whether A sprints on the rail, and how slow the shield walk is. Some levels have no fast cut at all; others have a turbo cut or a rail sprint for outrunning minions.

**Rule sketch.** Level bytes v2 append three u8 fields after the target, making 475 bytes: fast_steps ∈ {1, 2, 3} (v1 behaviour is 2, and 1 means A does nothing), rail_steps ∈ {1, 2} (v1 is 1), and slow_period ∈ {2, 3, 4} (v1 is 2). R4.5-6 becomes: with A held and B not held, the player takes fast_steps sub-steps if it was cutting at the start of the tick, or rail_steps sub-steps if it was on the rail and not cutting. R4.5-7 becomes: with B held, the player moves only on ticks where (tick − press_tick) % slow_period = 0. PIN-04 is generalised: a sub-step that is blocked, hits the boss body, closes the cut, or steps from the rail into EMPTY (starting a cut) ends the tick's movement, so a sprint never turns into a two-cell cut start. Minion hits follow R4.9-6 to R4.9-11 unchanged with n ≤ 3; the pass case covers both intermediate cells. New validity codes 40-42 check the ranges. A v1 level decodes as (2, 1, 2).

**Inspired by:** Qix (1981), Super Qix (1987), Volfied (1989), Volfied (Mega Drive port) (1991), Grid Riders (2026), SPLARG LAND GRAB (c. 2026). **Mechanic families:** [Two draw speeds (Fast/Slow Draw)](../taxonomy/movement-and-drawing.md#two-draw-speeds-fastslow-draw), [Single fixed draw speed](../taxonomy/movement-and-drawing.md#single-fixed-draw-speed), [Held speed-up button](../taxonomy/movement-and-drawing.md#held-speed-up-button), [Location- or state-dependent speed](../taxonomy/movement-and-drawing.md#location--or-state-dependent-speed). **Touches:** level-format, level-data, rules, tools-bots.

**Decisions it reopens:** R4.5-6; R4.5-7; PIN-04.

**Bot effect.** The effect is mixed, so each level needs its own calibration. The rail sprint narrows the gap: it is a reactive escape from minions, which humans need and search mostly plans around. fast_steps = 3 widens it: 45 cells per second is beyond precise human steering, while search's two-capture finisher reaches further in the same exposure. fast_steps = 1 widens it slightly too, because long slow exposures reward foresight of deflections. Scripted bots must read the fields; greedy's reach model has to use the level's speed.

**Budget.** Three more level bytes. That is level format v2, which gives all 16 levels new ids and requires recalibration. Per tick there are at most 3 sub-steps instead of 2, a few hundred cycles, well under 1% of zk cycles. No new RAM. No change to the screen.

**Variety.** The current levels vary only boss, minion and obstacle knobs; this varies the player's own speed. It allows levels where every cut is slow and waiting mid-cut is the core skill, turbo levels of long sweeping chords, and sprint levels where the rail becomes a race against the minions.

**Core engineer: feasible, 4 of 5, tier 2.** Clean, and it fits the code.

- Player::sub_steps and the sub-step loop already break on Entered, Closed, Hit and Ignored. The generalised PIN-04 adds 'rail to EMPTY ends movement', which is exactly what keeps a sprint from starting a two-cell cut.
- R4.9-6 to R4.9-11 are already written for k in 1..n, so n = 3 works. Moves.entered is a \[Option\<Pos>; 2\] and becomes 3.
- No new state: the fields are level constants, so state hash v1 can stay.

Corrections to the budget:

- If the decoder keeps accepting 472-byte v1 bytes as (2, 1, 2), the 16 levels keep their ids, and only levels that use the fields are v2.
- Editing R4.5-6, R4.5-7 and PIN-04 after they were implemented is a behavior change under CLAUDE.md and M1.9's gate. That means a RULES_VERSION bump and a new season, with vectors regenerated for the version field; v1 outcomes and traces stay the same.
- Codes 40-42 are byte-range checks numbered after the validity codes 35-39. Document where they are checked (after 34, before 35).

Other points:

- The off-rail state (R4.5-3) needs an explicit sub-step count.
- Greedy's 'A while at least 2 cells left' must become 'at least fast_steps' so it does not overshoot corners, and walk_rail should use the sprint.

The bot assessment (mixed, per-level calibration) is honest.

*Fixes.* - Accept v1 and v2 level bytes, so the shipped ids stay.
- State the off-rail sub-step count.
- Make greedy read fast_steps and rail_steps.
- Bump RULES_VERSION for the rule-text edits.

*Cost.* - Level bytes: v2 at 475 B. Level struct +3 B, Moves +1 cell.
- Per tick: at most 3 sub-steps instead of 2; zk under 1%.
- State hash, RAM and screen unchanged.
- Versioning: RULES_VERSION bump, vectors regenerated, playtest and calibration rerun for a new season.

*Conflicts.* R4.5-6; R4.5-7; PIN-04; R4.9-6

**Fairness: concerns, 3 of 5; gap widens; D14 compliant.** The pitch is honest that the effect is mixed. There is no D14 effect, and the generalised PIN-04 (a sub-step that starts a cut ends the tick) and the minion pass case with n ≤ 3 look sound. A rail sprint (rail_steps 2) is a reactive escape from minions and narrows the gap. fast_steps 3, 3 cells per tick or 45 cells per second, turns in 3-cell steps and lies beyond precise human steering, while search loses nothing. fast_steps 1 rewards foresight of deflections. Both widen the gap. The fairness problem is calibration. The reference mix (bold, committer) and greedy act at perfect tick precision, with no reaction-delay or jitter model (none in tools/src/bots), so their clear rates miss what speed costs a human. Weights would under-compensate humans on turbo and slow levels, so the six-level draw would decide more of a human's rank. Bots can follow the fields once greedy's reach model reads the level's speed. Format v2 means new ids and recalibration.

*Fixes.* Drop fast_steps 3, or keep it for Training. Keep rail_steps 2, which narrows the gap. Before any level with speeds other than the defaults enters a season, add a human-like execution model to the reference mix: input delay of a few ticks, turn-timing jitter. Also check its clear rates against a human playtest, as M2.9 did.

**Play: ok, 3 of 5.** Only one of the three knobs adds a decision. A rail sprint (rail_steps = 2) is new: today minions with period 1 move as fast as the player on the rail, so they can't be outrun. Sprinting makes 'race the minion to the cut position' a choice, and it narrows the human/bot gap, because the escape is reactive. The extended PIN-04 and the existing pass predicate handle it cleanly. The other two knobs are mostly difficulty. fast_steps = 1 takes a decision away and breaks muscle memory on the A key. fast_steps = 3 means 45 cells/s, where one tick of reaction overshoots by 3 cells. That is hard to steer, and it widens the gap, as the pitch concedes. slow_period 3-4 just lengthens shield exposure. Varying player speed per level, against the knob set, is distinct from the 16 levels, but speeds that change between levels can feel arbitrary unless each level tells the player.

*Fixes.* Ship only the rail sprint, as one v2 byte (with A held on the rail, 2 sub-steps), on the levels where minions dominate. Keep fast_steps fixed at 2, and drop 1 and 3. Keep slow_period only if playtests show it creates a real choice rather than a slower shield. Show the level's speeds in the overlay at level start.

*Readability.* No new on-screen element. A sprinting player jumps 8 px per tick on the rail, which is still easy to follow. 3 cells per tick (12 px) on a cut is hard to track and steer at 15 Hz. The level's speed must appear in the start overlay, since nothing in the field shows it.

## Launched wall from the rail

`movement-and-drawing#9` · T3 New core rule · score 9 (core 3, fairness 3, play 3) · gap: widens · D14: compliant

Standing still on the rail, hold A to fire a straight wall into the field that grows by itself. While it flies, the player is free to dodge minions along the rail. If it reaches claimed land it captures like a cut, but if the boss touches it first, the player loses a life.

**Rule sketch.** A new entity, the lance: {active, head (u16 cell), dir (0..3)}. Trigger at step 3: the player is on a rail cell, not cutting, no lance is active, no direction is held, A is held and B is not. The lance's direction is the first of N, E, S, W whose 4-neighbour of the player is EMPTY and not under the boss body; that cell becomes TRAIL and is the head. A held together with a direction behaves as today. A new step 3b, Lance, runs after Player and before Boss. From the tick after its launch, an active lance advances 2 sub-steps. If the next cell is EMPTY, it becomes TRAIL and the new head. If it is CLAIMED, an R4.8 capture runs with the lance cells as the trail, and the lance ends; the claim and the clear apply as in R4.4-8. If it is a boss-body cell, the player is hit (as in R4.9-2) and the lance stops. At step 4, the boss bumping a lance cell hits the player, by R4.9-2 unchanged, since lance cells are TRAIL. A lost life erases all TRAIL (R4.9-17), the lance included, and the shield absorbs a hit as usual. While a lance is active the player may walk the rail but may not step into EMPTY, so only one set of TRAIL cells exists at a time. Commit discards the lance like a cut. An optional v2 level byte, lance_steps (0 = no lance, 1 to 3), would make the lance a per-level feature.

**Inspired by:** Shocker (1988), Curvebot Evolved (2011), JezzBall (1992), KBounce (2000), Cubixx (2009), Quarosel (2023), Late (2005), Land Breaker (1999). **Mechanic families:** [Edge-launched straight cut](../taxonomy/movement-and-drawing.md#edge-launched-straight-cut), [Point-launched growing wall (JezzBall model)](../taxonomy/movement-and-drawing.md#point-launched-growing-wall-jezzball-model), [Wall vulnerable while under construction](../taxonomy/movement-and-drawing.md#wall-vulnerable-while-under-construction), [Concurrent wall limit](../taxonomy/movement-and-drawing.md#concurrent-wall-limit), [Committed vs cancellable cuts](../taxonomy/movement-and-drawing.md#committed-vs-cancellable-cuts). **Touches:** rules, state-hash, tools-bots, presentation.

**Decisions it reopens:** R4.4-5; R4.5-6; R4.3-1; R4.9-1; R4.5-2; R4.4-8; R4.4-7; R4.9-17; PIN-02; state hash v1.

**Bot effect.** Keeps the gap, or widens it slightly. A lance is a long straight exposure whose fate depends on the boss's next 10 to 30 moves, which search foresees and humans cannot, so it pairs well with the heat overlay. It also removes the steering load, letting humans split attention between the lance and the minions, which is reaction work humans do well. Scripted bots get an easy policy (fire when the projected path is clear), so calibration is straightforward.

**Budget.** Four bytes of entity state (state hash v2). Step 3b is O(1) per tick, plus a capture when the lance lands. That capture never falls on the same tick as a cut capture, because cuts are blocked while a lance flies. Negligible zk cycles beyond the captures. Screen: 2 cells per tick.

**Variety.** A second capture tool with different trade-offs: only straight chords, but the player's body is free. It brings two-front attention (the lance and the minions on the rail), aiming from the right rail cell, and chords that split the field into halves for later squeezes. Today every capture means walking the trail yourself.

**Merged from:** `wild-combinations#5`. Variants:

- Launched wall from the rail: Hold A while stepping off the rail and, instead of walking into the field, you fire a straight wall that grows across on its own while you stay on the rail. You are free to dodge minions or reposition, but you are gambling that the boss will not cross its path before it lands.

**Core engineer: feasible with changes, 3 of 5, tier 3.** The mechanics hold together. The lance is ordinary TRAIL, so the boss bump (R4.9-2), the rail rule (R4.2-3), the capture (R4.8) and the erase on a lost life (R4.9-17) all apply unchanged, and only one set of TRAIL exists at a time. But there are holes:
(1) PIN-02 hole. Invulnerability lasts until a cut starts, and a launch is not a cut. A player who launches during the 30 ticks after losing a life gets a risk-free capture: a boss bump on the lance is ignored while invulnerable. That is exactly the window PIN-02 exists to close.
(2) The level trigger 'A held, no direction, on the rail' turns a common human habit into an action: many players keep A held all the time and stop on the rail to wait. Every such stop would fire a lance. It also changes the meaning of existing journals and bot behaviour wherever A is held at rest.
(3) Underspecified: a lance that enters the boss body 'stops', but its TRAIL is left behind. If the shield absorbs that hit, or the player is invulnerable, a dead TRAIL stub stays in the field. The next cut's capture pass then claims it for free, and the 'only one set of TRAIL' invariant breaks.
(4) The player cannot aim. The direction is the first open 4-neighbour in N, E, S, W order, so from any straight rail cell there is exactly one direction.
(5) Balance: full-field chords at 2 cells per tick make the levels easier for everyone, so every weight must be recalibrated. Search's advantage on lances is real: it foresees 15 to 30 boss moves exactly, deflections included. Scripted bots get a simple policy, so calibration stays tractable.

*Fixes.* A launch counts as starting a cut for invulnerability: it sets it to 0 at step 3 (PIN-02). Trigger on the edge of A (released to held) with no direction held, the way press_tick tracks B. Gate the lance with a mandatory level-v2 byte, lance_steps, where 0 keeps A a no-op on the rail, so old levels keep their journals' meaning. A lance that enters the boss body is erased (TRAIL becomes EMPTY) whatever the hit's resolution. Optionally aim with the previous direction resolved on the rail before the stop.

*Cost.* State +4 B (active, u16 head, dir): hash v2 at 952 B, Game +4 B (about +14 B of `start` stack across its copies). Level v2 +1 B. Step 3b is O(1), 2 cell tests a tick; a landing costs one capture (fill + 3,600-cell pass, the existing heaviest tick, never two captures in one tick). zk \<0.5%, plus whatever extra captures lances add. Screen: 2 cells a tick. RULES_VERSION bump, vectors, bots, calibration.

*Conflicts.* R4.4-5; R4.4-8; R4.5-2; R4.5-6; PIN-02; R4.9-1; R4.9-2; R4.9-17; R4.3-1; R4.3-2; state hash v1

**Fairness: concerns, 3 of 5; gap widens; D14 compliant.** D14 holds. The lance is a straight chord at fast-cut speed (2 cells per tick) that cannot stop. It gives up D4's mid-cut stop, a human's main way to adapt, in exchange for keeping the body on the rail. Whether it lands depends on the next 10 to 30 boss moves, seeded deflections included: search predicts that exactly, while for a human it is a gamble. Search is already at 98.5% of the ceiling, so it gains little score, but humans get little safe value either: a mild widening. Two errors only humans will make: (1) The trigger is level-sensitive (A held, no direction, on the rail). A player who closes a cut with A and a direction held, then releases the direction first, fires an unintended lance, and many players keep A held. (2) The aim is implicit: the first of N, E, S, W whose neighbour is EMPTY. At corners and obstacle notches the lance can go where the player did not aim. Scripted bots get an easy policy they can be calibrated on (fire when the forecast chord is clear at the Caution margin). As a global rule it adds no draw variance; as the per-level lance_steps byte, only a little.

*Fixes.* Trigger only when A goes from released to held. Aim the lance: it flies in the last direction pressed toward EMPTY, not the first open neighbour. Keep an adaptive option for humans: holding B pauses or slows the lance head, preserving D4's stop. Add the lance to greedy and bold, using their existing Caution margin, before calibrating.

**Play: ok, 3 of 5.** A JezzBall-style growing wall. Its exposure equals a straight fast cut: 2 cells per tick, and a boss bump hits either way. So the real difference is that the body stays behind: you keep your side of the field and spend the flight time walking the rail to the next launch point. That is a real tempo and positioning gain and creates two-front attention. But on minion levels it keeps you on the rail, where the minions are, while a cut takes you off it. So it is a positional trade rather than a large new space. Only straight chords are possible, and the aim is implicit: perpendicular to the local rail, with an invisible N, E, S, W tie-break at corners. Input clash: today, holding A while standing on the rail is harmless and a natural habit to get ready for a fast dash. Under this rule it would launch lances by accident. Protecting a lance with the shield also means holding B, which halves rail speed just when you are dodging.

*Fixes.* Trigger on A's released-to-held edge with no direction held, not on A held. Aim with the previous direction when its neighbour is EMPTY, and fall back to the tie-break only otherwise. Show the aim cell for one tick. Make it a per-level feature (lance_steps), creating a family of lance levels rather than a global tool that changes all 16.

*Readability.* Good. The lance is red TRAIL, one cell wide, growing 2 cells per tick, as readable as a cut. A distinct head colour would help tell a flying lance from a walked cut. The corner aim ambiguity is the only readability gap.

## Hold-to-grow bloom

`movement-and-drawing#12` · T4 Input or journal · score 8 (core 2, fairness 4, play 2) · gap: narrows · D14: compliant

Standing on the rail, hold Y to grow a square of territory into the field, ring by ring, and release to set it. While it grows, the boss can hit the square and the minions can reach the player, who cannot move.

**Rule sketch.** Bit 7 of the input mask becomes Y. That makes journal v2: bit 7 is no longer reserved, and decode rule 10 is dropped. A new entity, the bloom: {active, side s (odd), open direction, anchor}. At step 3, if Y is held, the player is on the rail and not cutting, and no bloom is active, a bloom starts on the first of N, E, S, W whose neighbouring cell is EMPTY and not under the boss body: s = 1, and that cell becomes TRAIL. While Y stays held, the player does not move and directions are ignored. Every G ticks after the start (a v2 level field, default 3), the bloom tries to grow to side s + 2: the square whose near edge is centred on the anchor's neighbour and which extends s + 2 cells into the field. All the new ring's cells must be EMPTY and not under the body, or it stays at s. On the first tick Y is released, step 3 runs R4.8 with the bloom cells as the trail. They touch the anchor, so they become CLAIMED, together with any region they seal off. The boss bumping a bloom cell hits the player (R4.9-2). A lost life erases the bloom like any trail, the shield (B held) absorbs a hit as usual, and commit discards the bloom.

**Inspired by:** Filler (2008), Pumping Square (2023), Bubble.Fill: Retro Area Arcade (2025), Doodlebug (1984). **Mechanic families:** [Hold-to-grow filler shapes](../taxonomy/movement-and-drawing.md#hold-to-grow-filler-shapes), [Wall vulnerable while under construction](../taxonomy/movement-and-drawing.md#wall-vulnerable-while-under-construction), [Rectangle-only captures](../taxonomy/movement-and-drawing.md#rectangle-only-captures), [Point-launched growing wall (JezzBall model)](../taxonomy/movement-and-drawing.md#point-launched-growing-wall-jezzball-model). **Touches:** input, journal, rules, state-hash, level-format, tools-bots, presentation.

**Decisions it reopens:** D8; R4.4-8; R4.3-1; R4.5-1.

**Bot effect.** Widens the gap a little. The best moment to release depends on when the boss will next reach the square, which search knows to the tick. Humans judge it from a very readable growing shape and a visible minion approach, so the gap is smaller than for steered cuts. Y becomes an action, not a pause: the clock and both threats keep running, so D8's concern about free thinking time does not arise. Scripted bots can use a simple policy: grow while the projected boss path stays out of the next square and no minion is within k rail cells.

**Budget.** Four bytes of state. Each growth checks at most 4s + 4 cells, every G ticks, and the release costs one capture. The journal v2 decoder changes, and all vector journals get new headers. Screen: up to 4s + 4 cells per growth.

**Variety.** It adds a capture that is about timing rather than steering: stand, grow, release. Squares are a shape cuts rarely make, and standing still becomes a deliberate risk against the minions, whereas today it is only ever the player's choice to wait.

**Core engineer: feasible with changes, 2 of 5, tier 4.** The mechanism is sound because bloom cells are TRAIL. The rail (R4.2-3), boss hits (R4.9-2), the erase on a lost life (abandon_cut replaces TRAIL), commit, and the capture on release (R4.8) all reuse existing code paths.

Problems:
(a) An invulnerability exploit. R4.3-5 and PIN-02 end invulnerability only when a cut starts. A bloom started right after a lost life grows for 30 ticks while boss and minion hits are ignored, and the boss just bounces off the TRAIL. At G=3 that reaches s=21: about 441 cells risk-free after every lost life.
(b) The state needs about 4 bytes, and only if the anchor is the player's cell (the player cannot move) and 'active' is s > 0. Growing 'every G ticks after the start' needs a u16 start tick, or else the global phase tick % G. Either way the state hash goes to v2.
(c) Several cases are unspecified: Y held while cutting; Y held when no bloom can start (does the player freeze?); a release on a tick when a direction is also held; and where growth runs in the tick order. If growth runs at step 3, a new ring can be laid against the body's leading edge and bumped at step 4 of the same tick.
(d) Journal v2: bit 7 becomes valid and decode rule 10 goes. That means a new journal version in the core and the zk image, and new headers on every vector. The owner must amend D8.
(e) A bloom grows only on straight rail. Any CLAIMED cell in the near-edge row stops it, so on obstacle levels it stalls at s = 1 to 3.

Search times the release to the tick; humans read the shape well. The gap is modest.

*Fixes.* Set invulnerability to 0 when a bloom starts. State: s (u8), direction (u8), start tick (u16); anchor = the player's cell. Y while cutting is ignored. Y with no startable bloom has no effect, and the player moves normally. A release captures and ends the tick's movement, like R4.5-5. Grow at step 3 only if the ring keeps a 1-cell margin from the body, or accept the risk. To stay on journal v1 and avoid revisiting D8, trigger the bloom with A held and no direction on the rail (A does nothing there today); the cost is surprising players who keep A held. Otherwise the owner amends D8.

*Cost.* About 4 B of state (state hash v2, preimage 952 B). Level format v2 +1 B (G). Journal v2: decoder, header version, Recorder, every vector header. Each growth reads at most 4s+4 ≤ 232 cells every G ticks; a release costs one capture (0.1M to 0.55M zk cycles); zk otherwise negligible. RULES_VERSION bump; all vectors regenerated.

*Conflicts.* D8; R4.3-2; R4.3-5; PIN-02; R4.4-8; R4.5-1; R4.9-17; §6.1 bit 7 reserved; §6.3 decode rule 10

**Fairness: ok, 4 of 5; gap narrows; D14 compliant.** D14: kept. The bloom draws nothing random and the boss stays seeded. D8's concern does not arise: Y is an action on a running clock, with the boss and minions still live. Gap: I judge it narrows slightly, against the pitch's 'widens a little'. Search can time the release to the tick and gets somewhat larger squares. But search's score is pinned near the B\*B ceiling, and blooms do not help the finisher squeeze. Humans get a readable capture that is banked instantly and has no route back to the rail. That cuts deaths and sub-target commits, which make up most of the ~2x gap. The fixed G-tick growth is visible, so humans can learn the cadence. Calibration: the proposed scripted policy (grow while the projected boss path and the minions stay clear) is simple and deterministic. The draw: levels whose obstacles hug the rail allow smaller blooms, so recalibration is needed, but no new randomness is added. Costs are real but not fairness issues: journal v2 (bit 7 and decode rule 10), 4 bytes of state and a state hash v2, and new headers on every vector.

*Fixes.* Pin the bloom's state-hash fields and its journal v2 decode rules. Show the next ring as a preview (T0) so humans can judge the growth into the boss path as well as search does. Add a bloomer policy to the reference mix, then measure the gap rather than assuming either direction.

**Play: weak, 2 of 5.** A bloom grown against a straight border is exactly an s x s rectangle cut, the shape greedy and most humans already draw, so the capture itself is not new. What is new is a timing-only action: standing still, with no steering, while the minions walk the rail toward you. That is a thin decision for a T4 cost: journal v2, mask bit 7, reopening D8, and a new entity in the state hash. The opening direction is chosen for the player (the first of N, E, S, W), so on rail corners they cannot aim it. The square must stay centred on the anchor, so it stalls next to obstacles and claimed edges, which makes it useless in most of the interesting places on comb, maze and labyrinth. Stopping to charge is also foreign to the move-and-cut feel.

*Fixes.* If it is kept, let the held direction choose the opening side, and let growth be one-sided (anchored at one corner) so it works next to walls. Better, drop it: the timing decision it offers already exists in when a player chooses to close a rectangle cut.

*Readability.* Very readable: a growing filled square in trail colour. The only unclear part is which side it will open on before Y is pressed.

## Breath limit on open cuts

`movement-and-drawing#5` · T3 New core rule · score 7 (core 3, fairness 2, play 2) · gap: widens · D14: compliant

A cut can stay open only so long. A meter drains from the moment the player leaves the rail, and when it runs out the trail dissolves and the player snaps back to the cut start, alive but with nothing captured.

**Rule sketch.** Level bytes v2 add breath, a u16 where 0 means off (the v1 behaviour) and other values run from 30 to 2,700 ticks. The player gains cut_tick, a u16 set at step 3 to the tick on which a cut starts (R4.5-2). A new rule at the end of step 6, after the hits are resolved: if the player is still cutting and tick − cut_tick + 1 ≥ breath, the cut lapses. TRAIL becomes EMPTY (the same pass as for a lost life), and the player returns to the cut start and stops cutting. No life is lost, and invulnerability is unchanged. Because the lapse comes after the hits, it never cancels a bump on the same tick, so it is not a free bail-out. A capture or a lost life ends the cut first. The HUD shows a bar that drains over breath ticks.

**Inspired by:** Reef Reveal (2026), Sewernir (2025), Stix (1983), Torch 2081 (1986), Tinnitus (2022). **Mechanic families:** [Off-safe-ground exposure limit](../taxonomy/movement-and-drawing.md#off-safe-ground-exposure-limit), [Stall penalty without a Fuse](../taxonomy/movement-and-drawing.md#stall-penalty-without-a-fuse), [Decaying or vanishing unfinished trail](../taxonomy/movement-and-drawing.md#decaying-or-vanishing-unfinished-trail), [Per-stroke length cap](../taxonomy/movement-and-drawing.md#per-stroke-length-cap). **Touches:** level-format, rules, state-hash, tools-bots, presentation.

**Decisions it reopens:** D4; R4.5-8; R4.3-2; R4.9-13.

**Bot effect.** Widens the gap slightly. A human's main answer to an unforeseen boss turn is to stop mid-cut and wait, and breath taxes exactly that. Search does its waiting on the rail (its padding dodges minions there) and plans cuts that close in time. Breath also caps thinking time mid-cut, in the spirit of D8. The heat overlay idea offsets much of the cost to humans. For scripted bots the rule is easy to follow: close or abandon before cut_tick + breath.

**Budget.** Two more level bytes and two bytes of player state (state hash v2), plus one compare per tick. A lapse costs one 3,600-cell pass, the same as a lost life. Negligible zk cycles. Screen: one bar.

**Variety.** Each cut gets a time budget. The player sizes cuts from the meter, chooses whether to let a cut lapse on purpose, and levels can range from generous to tight breath. Today, under D4, a cut can stay open for the whole level.

**Core engineer: feasible, 3 of 5, tier 3.** Implementable as written. The lapse reuses Player::abandon_cut's path: grid.replace(TRAIL, EMPTY), then return to the cut start. It runs at the end of step 6, after resolve(), so a lost life or a closed cut already ended the cut first. cut_tick (u16) is new state, so state hash v2 changes every trace: RULES_VERSION bump, vectors and recalibration. Level v2 is +2 B, and v1 decodes as breath = 0.

Points the sketch glosses over:

1. The lapse returns the player to the cut start without invulnerability, unlike a lost life (R4.9-17). A minion on or arriving at the cut start hits on the next tick by the share case. This must be specified.
2. A lapse is also a guaranteed, timed abort. A doomed cut held still until it lapses escapes at no cost if no bump comes first. So short breath gives humans a partial bail-out as well as taxing waiting. The bot effect is mixed rather than simply 'widens'.
3. It is a fuse in spirit, against D4's 'no fuse in v1', so it needs the owner.

Costs are trivial: one compare per tick, and a lapse costs the same 3,600-cell pass as a lost life.

*Fixes.* - Decide whether a lapse grants the 30 ticks of invulnerability of R4.9-17, or none.
- Get the owner's D4 decision before implementing.

*Cost.* - Format: level v2 +2 B. State +2 B, state hash v2.
- Per tick: one compare; a lapse costs one 3,600-cell pass. zk negligible.
- Versioning: RULES_VERSION bump, all traces regenerated, bots taught the deadline, recalibration.
- Client: one HUD bar.

*Conflicts.* D4; R4.5-8; R4.3-2; R4.9-13; R4.9-17

**Fairness: concerns, 2 of 5; gap widens; D14 compliant.** There is no D14 effect, and the rule is easy for bots to follow. Applying the lapse after hits correctly avoids a free bail-out on the same tick. But it widens the gap, as the pitch admits. Stopping mid-cut to wait out an unexpected boss turn is the main human defence (D4, R4.5-8), and breath taxes exactly that. Search does its waiting on the rail and plans cuts that close in time, so it loses almost nothing. It is a timed fuse, which reverses the decided D4, 'no fuse in v1'. The lapse does give humans a delayed abort that keeps the life, which offsets some of the cost. Calibration has the same blind spot as the speed idea: the scripted mix never hesitates, so its clear rates would understate how much tight breath costs humans. Levels with tight breath would then be underweighted for humans, which adds variance to the draw.

*Fixes.* Keep it out of paid levels, or allow only generous values, at least 600 ticks, that cap stalling without taxing a normal wait. If it ever reaches Challenge, reopen D4 explicitly, and calibrate with a reference mix that models hesitation and reaction delay. The retractable trail gives humans the reactive abort without the timer and is the better candidate.

**Play: weak, 2 of 5.** It reverses D4's explicit 'no fuse', which is part of the game's feel. As the pitch concedes, it widens the paid gap. It taxes the human's main answer to an unforeseen boss turn, stopping mid-cut to wait, while search plans cuts that close in time. The one decision it adds, sizing a cut to the meter, mostly duplicates pressure that the boss, the minions and the time limit already apply, so per-level breath values become a difficulty knob. The lapse also has an odd double role. Because it costs no life, waiting out a short breath becomes a delayed, free abort back to the cut start. That is a clumsier version of the retractable-trail idea, which gives the player a deliberate escape and narrows the gap instead.

*Fixes.* Drop it in favour of the retractable trail, which adds abort and re-route decisions without a timer. If a tempo pressure is still wanted, use a level time limit rather than a per-cut fuse.

## Lasso loops and spur walls

`movement-and-drawing#7` · T3 New core rule · score 7 (core 2, fairness 3, play 2) · gap: unclear · D14: compliant

Touching your own open trail closes the cut there instead of blocking you. The player can loop off a pocket in the middle of the field, pen the boss inside a loop, or double back one cell to leave a solid spur wall that splits the boss's arena.

**Rule sketch.** R4.5-4 is replaced. While cutting, a sub-step onto a TRAIL cell completes the cut, exactly as R4.5-5 does for CLAIMED: the player enters that cell, stops cutting, and R4.8 runs unchanged (a fill from the boss body with TRAIL and CLAIMED as walls, then one pass in which EMPTY and TRAIL cells outside the boss zone become CLAIMED). The cases follow from the existing capture. A loop whose inside holds no boss is claimed, together with its tail back to the rail. A loop around the boss claims everything outside it that the trail and claimed land cut off from the boss. A step back onto the previous trail cell encloses nothing, so the trail becomes a 1-cell-wide CLAIMED spur from the rail, and the player stands one cell short of its tip, on a rail cell. Under PIN-04, closing on sub-step 1 ends the tick's movement. There is no new state, and a player can no longer trap itself in a spiral of its own trail. An optional v2 level byte, trail_contact ∈ {block, close}, would let a season keep both rule sets.

**Inspired by:** Quantum (1982), Ouroboy (2025), Smokescreen (2025), Spider Web (1989). **Mechanic families:** [Self-closing loop trail (no home base)](../taxonomy/movement-and-drawing.md#self-closing-loop-trail-no-home-base), [Straight strand walls](../taxonomy/movement-and-drawing.md#straight-strand-walls), [Placed wall structures](../taxonomy/movement-and-drawing.md#placed-wall-structures), [Self-crossing penalty (own trail is lethal)](../taxonomy/movement-and-drawing.md#self-crossing-penalty-own-trail-is-lethal). **Touches:** rules, tools-bots.

**Decisions it reopens:** D4; R4.5-4; R4.5-5; PIN-05.

**Bot effect.** Widens the gap. A loop around the boss squeezes it in one move, but only if the boss never touches the open loop while it is being drawn, which takes exact foresight of deflections to plan. Search will find every such loop on slow-boss levels. Spurs are a planning tool that search also uses best. Humans gain a lot of expressiveness, and lose the self-trap, but that helps them less than lassos help search. Pairing it with the heat overlay recovers part of the gap. Scripted bots need a spur and lasso policy, or they will underuse the rule and skew calibration.

**Budget.** No new RAM or state, and the state hash format is unchanged; it needs a RULES_VERSION bump and new vectors. There are more captures per level, because spurs are cheap captures, each one fill plus one 3,600-cell pass. There is still at most one capture per tick, so the worst tick does not grow. zk cycles per level grow with the number of spurs: 20 spurs cost about what 20 of today's captures do.

**Variety.** It adds wall-building that does not capture yet: corridors that slow the boss, detours that lengthen minion patrols, and rest points mid-field. It also adds captures in the middle of the field and boss-penning loops on slow-boss levels. Today every capture must end on claimed land, and the player's own trail is only an obstacle.

**Core engineer: feasible with changes, 2 of 5, tier 3.** It can be built as stated. It needs one new match arm in Player::sub_step: (cutting, TRAIL) closes and calls capture(). It adds no state, the state hash v1 stays, and R4.8 and D7's single region still hold because the fill still starts from the boss. The worst tick does not grow: there is at most one capture per tick. Today a 1-cell spur (step out, then step back onto the cut start, R4.5-5) already allows a capture every 2 ticks, so the adversarial maximum of about 1,350 captures per level is unchanged. That also means spur walls are not new. Today they cost 3 ticks per cell; the lasso makes them about n/2+1 ticks for n cells.

The real problem is banking at will. Reversing one cell turns the whole open trail into CLAIMED land at step 3, before the boss's step 4. So a trail is never at risk for a player who reacts, and never at all for search. Forbidding the reversal does not help: a 2x2 curl (3 sub-steps) encloses nothing and banks the tail the same way. No stateless test can tell a curl from a real loop, because the order of the trail is not stored. This removes the genre's core risk, that a long cut must reach CLAIMED, and every level's calibration collapses with it.

A loop around the boss claims everything outside it. With a 2-cell margin around a B=5 boss that is about 97%, an instant clear. It is cheaper than today's rail-to-rail pen because it skips the return leg. But the loop must avoid every deflected boss move while it is drawn, which only search can plan. The gap widens more than the pitch says.

Every spur is a full capture: a fill over the boss's whole region plus the 3,600-cell pass, about 0.5M RISC Zero user cycles while the field is open (capture-edge-rectangle runs 1.65M cycles; short vectors without a capture run 1.12M). So 20 spurs add about 10M cycles, a third of the heaviest level. The proof price barely moves (Boundless prices are nearly flat in cycles), but proving time does.

R4.5-5's 'that cell is a rail cell at that moment' must be reworded, because a TRAIL target is not one.

*Fixes.* Adopt it only behind the per-level byte (trail_contact = close), on a few designated levels, after the owner amends D4. To stop the free bank: a trail contact closes only if the capture encloses at least one EMPTY, non-TRAIL cell. Decide this with a trial fill that is reverted (BOSS_ZONE back to EMPTY, the move ignored as in today's R4.5-4) when nothing is enclosed. The cheapest bank is then a 3x3 ring of 8 trail cells. A refused contact costs one fill. That is at most one per tick, so the worst tick holds, but the adversarial zk maximum doubles to about 2,700 fills per level. Reword R4.5-5 and PIN-05.

*Cost.* 0 B RAM and no new state; state hash v1 unchanged. RULES_VERSION bump; vectors in which the player pushes into its own trail change outcome. Each lasso or spur costs one capture, about 0.1M to 0.55M zk user cycles (20 spurs add about 10M, a third of the heaviest level's 29.6M). Worst tick unchanged at one capture. The optional trail_contact byte makes level format v2. The trial-fill fix adds one fill per refused contact.

*Conflicts.* D4; R4.5-4; R4.5-5; PIN-05; §7.4 bot gap

**Fairness: concerns, 3 of 5; gap unclear; D14 compliant.** D14: kept. The boss, its key and its deflections are unchanged, and spurs and loops are made by the player in each run, so nothing carries over between runs. The pitch misses the biggest effect, the one-step spur. Doubling back one cell turns the whole open trail into CLAIMED wall at once. Because the player moves at step 3, before the boss at step 4, any threatened cut can be banked on the tick the boss arrives. That removes most of the risk of cutting, which D4 and the own-trail rule keep today. Repeated draw-and-bail spurs also make comb-walling the field trivial. Bail-outs help humans' survival, where they lose most of their points, so they narrow the gap. Lassos around a moving boss, and spurs planned to box the boss in, reward exact foresight of deflections, so they widen it. Search is already at 0.985 of the ceiling, and the B\*B ceiling is unchanged, so neither side's net effect can be taken as given. Calibration: scripted bots can bail and spur easily, and a lasso policy with a margin is feasible. Without them the mix underuses the rule, and the weights would misprice slow-boss levels, where lassos are strongest. The draw gets no new randomness, but level difficulty shifts unevenly (slow-boss and open levels gain most), so a full recalibration is needed. The rule reverses decided D4, so it is an owner decision, not a tuning.

*Fixes.* Keep PIN-05/R4.5-4 for a step onto the previous trail cell (no one-step bail-out). Allow closing on TRAIL only for a true loop (the closing cell is at least k cells back along the trail), or drop spurs. Add bail and lasso policies to the reference mix before calibrating, and gate adoption on a bot-advantage rerun. Get the owner's sign-off on reversing D4. The v2 trail_contact level byte is a reasonable way to trial it on a few levels.

**Play: weak, 2 of 5.** The spur rule breaks the risk loop. Any open cut can be banked at once by stepping back onto the previous trail cell: the capture runs at step 3, before the boss moves at step 4, so a player who sees the boss closing in taps the opposite direction and the exposed trail becomes safe CLAIMED land. Exposure while cutting is the core tension, and D4's no-fuse choice was only tolerable because an open trail stays a liability. The lasso around the boss is dramatic, but it is mostly a cheaper version of something already possible: today a U-shaped cut from the rail around the boss pens it just the same. Without the legs back to the rail, one mid-field loop claims everything outside it and usually clears the level in one move. Mid-field pocket loops and corridor walls are genuinely new, and losing the spiral self-trap is a small plus. Spurs also add rail, so minion patrols grow, which is fine. The pitch admits the bot gap widens.

*Fixes.* Keep R4.5-4 (contact blocks) whenever the closing capture would claim no EMPTY cell, so stepping back, or a loop with an empty inside, still blocks. Only real loops close, and banking costs a loop's worth of exposure. If the lasso around the boss stays, restrict it to the proposed trail_contact level byte, on fast-boss levels where drawing a loop around the boss is a real gamble, not on the period-3 open and sentry.

*Readability.* Good. Trail, loops and 1-cell spurs are ordinary 4x4 px cells in the existing trail red and claimed blue, and a spur reads as a thin wall. Nothing new to draw.
