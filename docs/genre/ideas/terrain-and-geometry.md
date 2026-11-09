# Ideas: terrain and geometry

The 11 ideas proposed from the axis of the [taxonomy](../TAXONOMY.md) *terrain and geometry*: field shape and terrain: obstacles, pre-claimed islands, walls, hazards, teleporters, non-rectangular or hex fields, scrolling, 3D surfaces, a field that changes during play. Sorted by score. The [index](../IDEAS.md) lists every idea by tier and score, and [`README.md`](../README.md#the-taxonomy-and-the-ideas) explains the judges.

## Island start

`terrain-and-geometry#4` · T2 Level format v2 · score 13 (core 5, fairness 4, play 4) · gap: narrows · D14: compliant

You begin on a small claimed island in the middle of the field instead of on the border. The minions patrol the border and cannot reach you until you build a bridge to it, so the opening is a choice between growing your island free of minions and bridging to the long border rail.

**Rule sketch.** Level bytes v2 = v1 plus a start-candidate list: u8 count (1-4) and 4 × (u8 x, u8 y), unused slots zero; a v1 level reads as count 1 with candidate (30, 59). PIN-01 becomes: the player starts on candidate number ((seed byte 4 >> 2) & 3) mod count, with the cut start set to that cell, so the seed can pick among up to 4 islands. Validity code 39 checks that every listed candidate is a rail cell. The island is ordinary obstacle cells (CLAIMED), e.g. a 6×6 block at (27..32, 42..47), starting on its rim. Every other rule is unchanged. The player is rail-bound (D3) and the island is its own rail component, so minions spawned on the border cannot reach the player until a capture joins the island's rail to the border's: the first cut from island to border is that bridge. Loops from the island back to the island capture the side without the boss as usual (R4.8). After a hit the player returns to the cut start, which is always a rail cell.

**Inspired by:** Gals Panic II (1993), Vivid Dolls (1998), Gal Pani X (2002), Conquerors (c. 2019), SNAPIXEL: Infinite Universe (2025). **Mechanic families:** [Pre-claimed starting territory](../taxonomy/terrain-and-geometry.md#pre-claimed-starting-territory). **Touches:** level-format, level-data, rules, tools-bots.

**Decisions it reopens:** PIN-01; §5 validity code 39; §6.4 seed byte 4 bits 2-3 (now used).

**Bot effect.** Search is unaffected. The scripted bots work from any rail cell: greedy's rectangle closed by a straight run of claimed cells fits along an island's straight edges, but no policy reasons about when to bridge, so their openings are naive and calibration absorbs the difference. Human vs search: the opening trade-off (minion-free island against bridging) is strategic and readable, and a minion-free start removes the early deaths that cost humans more than search. Keeps the gap or narrows it slightly.

**Budget.** 9 bytes of level data. No RAM, no per-tick work, no zk change. State hash v1 unchanged: the start is a level constant chosen by the seed, like the boss start, and the player's position is already hashed. RULES_VERSION bump because PIN-01's text changes; level format v2 vectors.

**Variety.** A two-phase level: an opening with no minion pressure but a short rail and the boss all around, then a bridge decision that trades that safety for anchors. With several candidate islands the seed decides where you begin, so the opening cannot be memorized. Every current level starts at (30, 59) on the border.

**Core engineer: feasible with changes, 5 of 5, tier 2.** It checks out:

- Island obstacles keep code 35: the open annulus is one 4-connected region, and claimable_cells excludes the island.
- The island's rail is its own 4-connected component, so border minions cannot reach it.
- A first cut from island to border encloses no region, because it only makes the annulus simply connected. Its capture is just the trail, and that trail becomes the bridge.
- An island-to-island loop with the boss inside captures everything outside it and strands the border minions. They respawn on the first rail cell in row-major order, which is on the island's rail, now the only rail: consistent.
- State hash v1 is unchanged, since the player's cell and cut start are already in it.

One flaw: (seed byte 4 >> 2) & 3 mod count is biased when count = 3. The values 0..3 map to candidates 0, 1, 2, 0, so candidate 0 is drawn half the time. Byte 4 bits 2-3 are also claimed by the twin-boss and bouncer proposals. The Level struct's +9 B exists only during start and is negligible against the 62,784 B peak.

*Fixes.* Draw the candidate as (big-endian u32 of seed bytes 9..12) mod count, with bias under 2^-30, and register those bytes in §6.4. Alternatively, allow only count in {1, 2, 4}. Apply validity code 39 to every candidate, and require unused candidate slots to be zero so the bytes stay canonical. Keep decoding v1 bytes as count 1 at (30, 59), so existing level ids are kept.

*Cost.* Level +9 B. Game RAM 0. Per-tick work 0, zk 0. State hash v1 unchanged. RULES_VERSION bump (PIN-01 and §6.4 text), level v2 vectors, candidate syntax in the ASCII sources and the editor, calibration of the island levels only.

*Conflicts.* PIN-01; §5 code 39; §6.4 seed allocation (byte 4 bits 2-3 also claimed by other proposals)

**Fairness: ok, 4 of 5; gap narrows; D14 compliant.** D14 holds: the seed picks the start among up to 4 candidates, and the boss is still seeded. There is no new safe zone. The rail is already safe from the boss; the island only keeps minions away until the first bridge.

The opening becomes a readable strategic choice with no early minion deaths, which favours humans slightly. Search is unaffected.

The main fairness risk: candidates can differ in difficulty, for example one island near the boss spawn rectangle and another far from it. A level's score then depends on a draw within the level as well as on which level is drawn, and the §8.4 weights calibrate per level, not per candidate.

Scripted bots work from any rail cell, and calibration absorbs their naive openings. The text of PIN-01 changes, so this is a rule change with a RULES_VERSION bump, not just T2.

*Fixes.* - Require candidates that mirror each other, at equal distances to the boss spawn rectangle and the minion spawns.
- Or report clear rates per candidate in the playtest, and reject levels whose candidates differ beyond the tolerance.
- Coordinate bits 2-3 of seed byte 4 with the other ideas that claim them.

**Play: strong, 4 of 5.** This gives the best value for its cost in the batch. All 16 levels start at (30, 59) on the border; an island start makes a real two-phase opening. Every cut from the island is exposed on all sides to the boss, but no minion can reach you. Growing the island (loops back to it capture the side without the boss) is weighed against bridging to the long border rail. The bridge cut is a nice pure-strategy move: joining an island to the border only cuts the annulus once, so it captures just its own trail cells. It gives up minion safety for anchors and earns no claim. It costs 9 level bytes, no per-tick work and no zk change, and the state hash stays v1. Seed-chosen candidates keep the opening from being memorised. The fairness risk: in Challenge, different islands can make one level noticeably harder for some seeds than others, which per-level weights average away but don't remove. Once bridged, the level plays like any other, so the variety sits mostly in the opening.

*Fixes.* 1. Require the candidate islands of one level to be mirror or rotation images of each other relative to the boss spawn and minion spawns, so the seed varies the position but not the difficulty. 2. Have the playtest report clear rate per candidate and flag a spread above the tolerance. 3. Teach the scripted bots a simple 'grow until X% then bridge' policy so their openings aren't degenerate.

*Readability.* Excellent. The player and the island are obvious, and nothing new is drawn. Players can see that minions on the border can't reach the island.

## Shaped arena outlines

`terrain-and-geometry#2` · T1 Level data v1 · score 12 (core 4, fairness 4, play 4) · gap: neutral · D14: compliant

Levels whose playable field is a disc, an octagon, a tall letterbox, a plus sign or two rooms joined by a neck. Everything outside the outline is drawn as void, and the outline itself is the rail you cut from.

**Rule sketch.** Level bytes v1 only. The obstacle bitmap fills every interior cell outside the shape. Those cells are CLAIMED, so the shape's edge is rail and an anchor exactly like the border, and claim_bp is measured on the shape automatically, since R4.1-8 counts only cells EMPTY at start. Shapes on the 58×58 interior: a disc of cells whose centres lie within 29 of (29.5, 29.5), touching all four sides (~2,600 open cells); an octagon with 45° staircase corners of 16 steps (~2,820); a tall letterbox of columns 15-44 (30×58 = 1,740, so the boss bounces horizontally about twice as often as vertically); a plus of two 22-wide arms, x 19-40 and y 19-40 (2,068); twin rooms split by a wall on rows 29-30 with one neck at x 26-33 (3,264), the boss spawn rectangle (27, 27)-(28, 28) straddling the neck (B = 5), so vy from seed byte 4 bit 1 picks the room the boss enters first. Optional: outlines traced from public-domain coastline silhouettes. Authoring checks beyond validity codes 35-39: the shape includes some of (29..31, 58) so that (30, 59) stays a rail cell; open area ≥ 1,682 (code 36); every arm, neck and lane at least B + 2 wide, so the body can reach every part except corner slivers (D14 intent: no seed-independent boss-free zone); minion spawns on the outline. T0 part: at load, the client floods the obstacle cells 4-connected to the border and draws them as background, with the outline in the rail colour.

**Inspired by:** Volfi: Cyber Territory Arcade (2026), Water Bugs (2007), Paper Loop 2 (2026), Line Fight (unreleased), Clostro (2020), Doodlebug (1984), Snake Conquest (2026), Patchwork Heroes (2010), iSlash (2010), Curvebot Evolved (2011). **Mechanic families:** [Non-rectangular field outlines](../taxonomy/terrain-and-geometry.md#non-rectangular-field-outlines), [Field size and resolution](../taxonomy/terrain-and-geometry.md#field-size-and-resolution), [Pre-claimed starting territory](../taxonomy/terrain-and-geometry.md#pre-claimed-starting-territory), [Real-world maps and locations](../taxonomy/terrain-and-geometry.md#real-world-maps-and-locations), [Triangle enclosures](../taxonomy/capture-rules.md#triangle-enclosures), [Field boundary contact rules](../taxonomy/terrain-and-geometry.md#field-boundary-contact-rules). **Touches:** level-data, presentation, tools-bots.

**Bot effect.** Search simulates whatever board it gets and stays near each shape's ceiling (claimable − B²). Greedy and the reference mix look for rectangles closed by a straight run of claimed cells, which staircase outlines (disc, octagon) rarely offer, so their clear rates drop and calibration raises those levels' weights; tools may want a staircase-aware rectangle test. Human vs search: outlines are static and easy to read. The plus and twin-room shapes add big, legible plays (seal an arm or the neck while the boss is elsewhere) that a human finds without exact prediction, so those keep the gap or narrow it slightly; the staircase shapes keep it.

**Budget.** No core, format, hash or zk change; a smaller open area means smaller fills. Costs new level ids, a playtest rerun and calibration. Client: one flood fill at load and one palette entry for the void; nothing per tick.

**Variety.** The same rules give different boss physics: on a 45° staircase the one-axis edge test reflects the boss off each step, the letterbox shortens one axis, and the disc never gives the boss a long straight wall. Arms and the neck create single cuts worth 30-50% of the claim, timed on where the boss is. The maze level's 10-wide gaps between six thin strips come closest, but none of its rooms is worth more than about a sixth of the field. Current levels are all squares with bars, combs, a cross, a central block or maze strips inside.

**Merged from:** `v1-levels#7`. Variants:

- Octagon arena: diagonal walls: The four corners are filled with staircase triangles, so the field is an octagon. The boss bounces straight back off the diagonal walls, rectangles no longer fit the corners, and a single straight cut from a flat wall to a diagonal claims a triangle.

**Core engineer: feasible with changes, 4 of 5, tier 1.** Pure v1 level data, and the numbers check out:

- Open areas: letterbox 1,740, plus 2,068, twin rooms 3,264, disc about 2,640. All are above 1,682 (code 36).
- (29..31, 58) stays open in every shape, so (30, 59) is a rail cell (code 39).
- The twin-room spawn rectangle (27, 27)-(28, 28) with B = 5 covers only open cells (code 37).
- On a monotone 45° staircase a B×B body whose corner sits on any open cell fits, so staircases create no boss-free slivers. The lanes ≥ B + 2 rule covers the arms and the neck.

Corrections:

- A plus arm is about 396 of 2,068 cells, about 19%, not 30-50%. Only the twin-room neck gives one ~50% cut.
- With an 8-wide neck and B = 5, the boss changes rooms rarely. That makes the 8-cell neck cut nearly risk-free on many seeds, so the twin rooms need a high target or a low weight.

The real risk is paid fairness (constraint 8). best_cut in tools/src/bots/greedy.rs requires the rectangle's base to be a straight run of claimed cells (open.count(base) == 0). On disc and octagon outlines greedy cuts almost only from the flat sides, so the reference mix's median claim falls for a bot reason, not a human one. Calibration (P × 10,000 / max(m, floor)) would then over-weight those levels, and drawing one would become a windfall, largest for search.

*Fixes.* - Ship in Training first.
- Before any of these levels enters a season, make greedy's base test staircase-aware, for example by accepting a back leg that closes on any claimed cell. Rerun playtest --check against levels/targets.json and check the medians against human play.
- Raise the twin rooms' target, or widen the neck relative to B.

*Cost.* - Core: no change. No format, hash or zk change, and smaller fills.
- Levels: new level ids, a levels/README rebuild, playtest and calibration, and possibly a bot change, which triggers the playtest-report rule.
- Client: one flood fill at load and one void palette entry.
- Wedgie: a larger level file only.

*Conflicts.* Constraint 8 (calibration relies on bots that cannot read staircase outlines)

**Fairness: ok, 4 of 5; gap neutral; D14 compliant.** These are level data v1 only, so there is no change to the core or the formats, and seeded deflections still give each run its own boss path. Shapes do not change D14. Large convex shapes (disc, octagon) let the body reach the edge cells with a corner. The arm and neck width of at least B + 2 keeps every region reachable, which the sketch checks for. Corner slivers that the body can never touch remain small, seed-independent zones with no boss, worth little. The main fairness risk is calibration. The pitch itself says greedy and the reference mix miss rectangles closed by staircase outlines. Weights computed from that blind spot would over-reward the disc and the octagon for humans, who read diagonals easily, so drawing them becomes luck, the variance §8.4 exists to remove. The twin rooms add variance within a level: how often the boss crosses an 8-cell neck, in a spawn rectangle of only 4 candidates, depends on the seed. A neck cut worth about 50% narrows the gap a little, since it is a big, legible play. Scripted bots can play any board.

*Fixes.* Make the staircase-aware rectangle test in greedy, bold and committer a precondition for calibration, not an option. Add a level-tool check that counts open cells the boss body or its leading edges can never reach, and cap that count at a few cells. For the twin rooms, measure the per-seed distribution of neck crossings in the playtest and reject the layout if the clear rate is bimodal by seed.

**Play: strong, 4 of 5.** This is the cheapest real variety on the list: T1 data only, with no core, format or zk change. Shapes change boss physics, not just difficulty. On a 45° staircase approached head-on, both axis tests block and the boss bounces straight back, and on a disc there is never a long straight wall. That breaks the rectangle habit every current level trains. Twin rooms create a legible decision: seal the neck while the boss is on the far side. The pitch overstates and misplaces some things, though. (1) The closest existing level is 09-cross, not maze: cross already has four quadrants joined by gaps, and isolating a quadrant (25%) takes two gap cuts. (2) A plus arm is about 396 of 2,068 cells (19%), not 30-50%; only twin rooms reach about 50%. (3) Twin rooms with an 8-wide neck through a 2-row wall let an 8-cell cut, half a second with A, capture about half the field. That is a degenerate early swing. (4) On staircases, notches narrower than B form thin rim bands the body can never enter. That is a small seed-independent safe lane, which D14's intent and the claimed 'only corner slivers' should account for. (5) Staircases defeat greedy's straight-run rectangle test, so calibration may over-weight these levels relative to humans.

*Fixes.* Make the twin-room neck a corridor 4-6 rows deep, so sealing it means an exposed cut the boss can sit inside. Or use two necks, so a room takes two cuts and the shape stays distinct from cross's four gaps. Correct the arm value to about 19%. Measure the unreachable rim band per shape and B, and have the authoring check bound it. Give tools a staircase-aware rectangle test before calibration, so weights reflect play rather than a bot blind spot.

*Readability.* Good. A disc or octagon outline reads clearly at 60×60 cells, and staircases look jagged but legible at 4 px. Void in the background colour and the outline in the rail colour separate 'outside' from 'yours' (captured area) at a glance. It costs one palette entry of 16 and one flood fill at load, nothing per tick, and it fits the wedgie's partial redraws.

## Sweepers on fixed tracks

`terrain-and-geometry#10` · T3 New core rule · score 12 (core 4, fairness 4, play 4) · gap: neutral · D14: compliant

Small hazards run back and forth along straight tracks drawn on the field and cut any trail they touch. Their motion is perfectly regular, so you time your crossings, and enclosing a sweeper's cell destroys it for the rest of the level.

**Rule sketch.** Level v2 fields: sweeper count k (0-4), period S (u8 ≥ 1), and k straight tracks (x0, y0, x1, y1), horizontal or vertical, of length L ≥ 3, on cells EMPTY at start. Seed: sweeper i starts at index (seed byte (11 + i) & 0x7F) mod L along its track, and heads toward (x1, y1) if bit 7 of that byte is set, otherwise toward (x0, y0). New entity state per sweeper: index u8, direction i8, alive u8. New step 4b, after Boss and before Minions, on ticks with t % S = 0: for each live sweeper in index order, let n be the next cell along its direction. If n is off the track or CLAIMED, the sweeper reverses and stays. If n is TRAIL, it reverses, stays, and sets the tick's hit flag (like the boss's bump, R4.9-2). Otherwise it moves to n. Player: a sub-step onto a live sweeper's cell does not happen and hits the player (like the boss's body, R4.9-3). Capture (step 3): a sweeper whose cell became CLAIMED is destroyed for the level. Sweepers are not fill seeds, so they never keep a region open, and the sweepers and the boss ignore each other. Hits resolve at step 6 as usual.

**Inspired by:** Ballistyx (1990s), VOLTFIELD: 80s Classic Arcade (2026), Turf Rollers (2026), Claim (DaNuTree) (2026), Jezz Mania: Better Jezzball (2021). **Mechanic families:** [Moving, spawning and spreading hazards](../taxonomy/terrain-and-geometry.md#moving-spawning-and-spreading-hazards), [Fixed enemy tracks](../taxonomy/terrain-and-geometry.md#fixed-enemy-tracks), [Trail-breaking terrain](../taxonomy/terrain-and-geometry.md#trail-breaking-terrain), [Obstacles removed by enclosure](../taxonomy/terrain-and-geometry.md#obstacles-removed-by-enclosure). **Touches:** level-format, level-data, rules, state-hash, tools-bots, presentation.

**Decisions it reopens:** R4.4-5 (new step 4b); R4.3-1; R4.9-1; §6.4 seed bytes 11-14; state hash v1.

**Bot effect.** Search adapts unchanged. Scripted bots need a sweeper term in their rectangle safety test (the cells a sweeper reaches during the cut), a modest tools change. Human vs search: sweepers are fully visible and move like a metronome along a drawn line, so a human can time a crossing nearly as well as a simulator. They add danger that rewards reading rather than prediction, which keeps or slightly narrows the gap compared with the knobs today's hard levels use (more minions, a faster boss). The seeded start keeps runs distinct (D14).

**Budget.** 12 bytes of entity state (index, direction and alive flag per sweeper), plus 4k track bytes and 2 parameter bytes in the level. Per tick, at most 4 sweeper steps of a few cell reads: about 200 zk cycles a tick, about 2% of a heavy level. One extra compare per player sub-step per live sweeper. State hash v2 for the sweeper fields. Screen: 2 cells redrawn per sweeper move; the track drawn faintly.

**Variety.** A regular, readable hazard between the chaotic boss and the rail-bound minions: lanes you cross in rhythm, and an early objective (capture a sweeper's area to remove it for good) that trades a medium-risk cut now for a quieter level later. No current hazard can be removed permanently.

**Core engineer: feasible, 4 of 5, tier 3.** A clean entity:

- A sweeper only ever stands on an EMPTY cell. The player cannot step onto it (that is a hit), it reverses instead of entering TRAIL, and a capture that turns its cell CLAIMED destroys it.
- So it needs no new cell state, leaves R4.6-1 and the fill untouched, and never meets a rail-bound minion.
- Its position is not a function of the tick, because reversals depend on trail and captures. State hash v2 is therefore right.
- The cost estimate is plausible: up to 4 steps of 2-3 cell reads on move ticks, about 0.5M cycles per level, about 2% of the heaviest level.

Points to pin or reconsider:
(a) A trail that crosses a live track is a local fuse: the sweeper reaches the crossing within 2L·S ticks. That cuts against D4's 'no fuse in v1', so state it as an explicit exception, or keep S ≥ 2 and tracks short.
(b) PIN-04 needs a sweeper case: a sub-step 1 that hits a sweeper has no sub-step 2.
(c) The start index (byte & 0x7F) mod L is biased up to 1.5× for L near 58 (128 = 2×58 + 12). Harmless, but sloppy for a consensus draw.
(d) Seed bytes 13-14 collide with the two-faced token (#7, bytes 13-16).
(e) Pin that a sweeper under the boss's body moves normally, and that two sweepers may share a crossing cell.

Bot gap: a fully visible metronome. Search times it perfectly, a human reads it. Neutral to slightly widening, not narrowing as claimed. D14 holds through the seeded start and the seeded boss.

*Fixes.* - Draw each sweeper's start from a big-endian u16, mod 2L, with direction folded in: bias under 2^-9.
- Move off bytes 13-14 if #7 also ships (for example bytes 21-28 for sweepers).
- Add validity codes for tracks: straight, L ≥ 3, cells EMPTY at start.
- Write the D4 exception, or the S ≥ 2 rule, into §4.
- Extend PIN-04 to sweeper hits.

*Cost.* - Level v2: 2 + 4k bytes (at most 18).
- State: +12 B, hash v2 (960-byte preimage).
- Per move tick: at most 4 sweeper steps of a few reads. Per player sub-step: at most 4 compares.
- zk: at most about 2% on the heaviest level; proving price under +0.5%.
- Wedgie: Game about +30 B, start stack about +100 B, negligible tick time. Two cells redrawn per sweeper move; the track drawn faintly.
- RULES_VERSION bump, new step 4b, vectors, playtest and calibration, a sweeper term in the scripted bots' safety test.

*Conflicts.* R4.4-5 (new step 4b); R4.3-1; R4.9-1; R4.8-4 (capture destroys a sweeper); PIN-04; §6.4 seed bytes 11-14 (overlap with #7); state hash v1; D4 (local fuse)

**Fairness: ok, 4 of 5; gap neutral; D14 compliant.** D14 holds: the seeded start index and direction give each run its own sweeper phase, the boss is still seeded, and sweepers create no area the boss cannot reach. One correction to the pitch: a trail cell on a track stays TRAIL until the cut closes, so the sweeper reaches it within one pass of the track. Crossing a track therefore starts a deadline to close the cut, not a single moment to time. That deadline is visible and readable, but search meets it with exactly the margin it needs, and a human needs more. Added on top of today's difficulty knobs, sweepers widen the gap a little: humans lose more lives and search is unaffected. Used instead of extra minions or a faster boss, they are about neutral. Scripted bots can model them exactly, because the cells a sweeper reaches during a cut are deterministic, so calibration works. Draw variance is small. Two flaws: (1) a 7-bit index mod L, with L up to 58, gives modulo bias: some start cells are about 1.5x likelier than others; (2) seed bytes 11-14 overlap bytes 13-16 of the boss-token idea (items#7).

*Fixes.* Take the start index from a u16 or an fmix32 of a key, not 7 bits mod L. Keep one table of seed-byte allocations so this idea and items#7 do not share bytes. When retuning levels, use sweepers to replace minions or boss speed, not to stack on top of them. In the bots' rectangle safety test, treat a crossing as a deadline: the ticks until the sweeper reaches the crossing cell. Pin the order of a step-4b hit against the player's sub-steps in R4.4-5, and move to state hash v2.

**Play: strong, 4 of 5.** This fills the biggest gap in the hazard set. Today you have a chaotic boss in the field and predictable minions on the rail; this adds a predictable hazard in the field. Any cut that crosses a track starts a clock: the sweeper will reach the crossing and bump your trail. So you choose to cross ahead of it or behind it, and fast cut and the slow walk matter in a new way. Destroying a sweeper by enclosing its cell is a clear short-term-risk-for-long-term-calm objective. The rail-bound minions get a mirror image, a field-bound line hazard. Removable hazards are new; no current level has one. It sits well in the genre, since field-bound small enemies are a Volfied staple, and the hit rules reuse the boss's bump and body cases, so nothing new to learn about what hurts. D14 holds through the seeded start index and direction. Edge cases look sound. A sweeper never enters CLAIMED, so it never touches the rail. One trapped between trail and claimed cells bumps every S ticks, but the hit erases the trail. One boxed into a single cell is harmless. Collision: seed bytes 11-14 overlap the two-faced token's bytes 13-16.

*Fixes.* Assign seed bytes centrally (13-14 collide with [items-and-power-ups#7](items-and-power-ups.md#two-faced-boss-token)), or derive per-sweeper starts from one reserved word with fmix32(word XOR i). Draw a live sweeper over the boss body when the two overlap, so a hazard is never hidden. Consider a validity rule that a track is not entirely inside the boss's spawn rectangle, so the first destroyable sweeper isn't always out of reach. Limit k to 2-3 on levels that also have 3 minions, to keep the screen readable.

*Readability.* Good. A single bright 4x4 cell moving one cell at a time along a faint dim-grey track is easy to follow at 15 Hz/S. The track makes its future positions readable at a glance, which is the point. Needs a hue distinct from the minions, the player and TRAIL red. Redraw cost is 2 cells per move.

## Timed gates that only stop the boss

`terrain-and-geometry#9` · T3 New core rule · score 11 (core 3, fairness 4, play 4) · gap: narrows · D14: compliant

Lines of gate cells open and close on a seeded timer. A closed gate is a wall for the boss but open field for you, so it holds the boss in one room and gives you a few seconds of boss-free cutting on the other side.

**Rule sketch.** Terrain kind GATE on cells EMPTY at level start. Level fields: gate period P (u16, 60-600) and closed span C (u16, 1 ≤ C \< P). Phase φ = big-endian u16 of seed bytes 9-10, mod P. Gates are closed on tick t when (t + φ) mod P \< C. Step 4 only: in the boss's edge test (R4.6-3), a leading-edge cell that is EMPTY and a gate counts as blocked while gates are closed (bounce, no hit); a TRAIL cell still hits as before. Gates may close under the body: the edge test looks only beyond the body, so the boss always leaves, and the body still covers only EMPTY cells. Everything else treats gate cells as EMPTY. The player cuts through them. The fill spreads through them, so a closed gate does not isolate a room: sealing a room still takes a cut across the gate line, which turns those cells TRAIL, then CLAIMED. Captured gate cells are ordinary ground. Deflections (R4.6-7) are unchanged. Authoring: rooms at least B + 2 wide, and a spawn rectangle placed so that the room the boss occupies at the first closing depends on the seed. The client shows the gate state and a countdown, both pure functions of the tick and φ.

**Inspired by:** Lock 'n' Chase (1981), Volfied (1989), Territory Grid (unknown). **Mechanic families:** [Self-cycling doors](../taxonomy/terrain-and-geometry.md#self-cycling-doors), [Layout that changes during play](../taxonomy/terrain-and-geometry.md#layout-that-changes-during-play), [Interior obstacles and walls](../taxonomy/terrain-and-geometry.md#interior-obstacles-and-walls). **Touches:** level-format, level-data, rules, tools-bots, presentation.

**Decisions it reopens:** R4.6-3; R4.6-10; §6.4 seed bytes 9-10.

**Bot effect.** Search adapts unchanged and times every window exactly. Scripted bots need the gate state in their boss-reach margin (a boss behind a closed gate cannot reach a rectangle until it opens), a small tools change. Human vs search: the window is visible, lasts C ticks and has a countdown, so a human can exploit it almost as well as search. It gives humans safe windows they can read rather than predict, which narrows the gap slightly. D14 holds: the phase and the boss's room at each closing come from the seed, so the windows differ from run to run.

**Budget.** Core RAM 0 (gate kind in the grid byte's terrain field). Per boss move: at most B extra reads and one modulo, under 1% of zk cycles. 4 level bytes plus the terrain plane. State hash v1 can stay: the gate state is a function of the tick and the level seed, like the deflection draw. Screen: gate cells redrawn only on the ticks they open or close.

**Variety.** The level gets a rhythm: work the far room while the gate holds the boss, get back to the rail before it opens, and decide whether to spend a window on a big cut there or on sealing the gate line itself, which splits the rooms for good and confines the boss. No current level has a field state that changes on a timer.

**Core engineer: feasible with changes, 3 of 5, tier 3.** The rule holds up. Gate cells stay EMPTY for the fill, the rail and the player, so capture semantics and R4.6-1 are untouched: a closed gate only adds blocked edges, and the body still covers only EMPTY cells. The gate state is a pure function of (tick, φ), like the deflection draw, so state hash v1 can keep its layout. Divergence (R4.6-12) still holds, because edge contents are deterministic.

Two real problems:
(1) The budget's 'gate kind in the grid byte's terrain field' does not exist. Cell is a 4-variant repr(u8) enum, compared with == and match in grid.rs, capture.rs, boss.rs, player.rs and minion.rs, so packing a flag touches every comparison. A per-cell plane would sit inside Game: 3,600 B as bytes, or 450 B as bits. The Recorder carries Game, and `start` peaks at 62,784 of 65,536 B because it holds about 3 copies of the large structs. A byte plane overflows that stack unless M3.10 is built, and a bit plane eats half of the ~2.7 KB headroom. A GATE cell variant fails too: the fill turns it BOSS_ZONE and then EMPTY, a lost life erases TRAIL to EMPTY, and the kind is lost.
(2) Gates can freeze the boss. A body that overlaps a vertical and a horizontal gate line at once (a crossing or an L corner), or a band at least B+2 thick, or a gate line running along a corridor exactly as wide as the body, has both axes blocked while gates are closed. The boss then sits still for C ticks at a predictable spot: a safe zone that bots will find.

The rest is fine. The φ bias from u16 mod ≤ 600 is under 1%. D14: windows depend on the seed through φ and the boss's room. Bot gap: the countdown is readable, so roughly neutral.

*Fixes.* - Store gates in level v2 as up to 4 straight, 1-cell-thick segments (x0, y0, x1, y1), plus P and C. Membership is then a few bounds compares, with no terrain plane and no grid bits.
- Add validity codes: segment cells EMPTY at start; horizontal or vertical; segments pairwise at least B+1 apart, never touching or crossing; open non-gate cells on both sides across every segment. Then a body that overlaps a gate line always has one free axis to leave by.
- Reserve seed bytes 9-10 in §6.4. Extend the natmod paint call with the gate cells and their state.

*Cost.* - Level v2: about 20 B (4 segments, P, C).
- Game: about 20 B (Recorder +20 B, start stack peak about +60 B).
- Per boss move: at most 2B edge cells × 4 segment compares, under 0.5% zk cycles. Proving price is unchanged within noise: about 87% of a proof's price is fixed (VERIFICATION.md fit: 0.0000153 ETH + 17,383 wei per cycle).
- State hash v1 layout unchanged.
- RULES_VERSION 3, level format v2, new vectors, playtest and calibration rerun, a gate-aware boss-reach margin in the scripted bots.
- Screen: one more colour; gate cells redrawn only on toggle ticks.

*Conflicts.* R4.6-3; R4.6-10; R4.6-2; §5 level bytes v1 and validity codes; §6.4 seed bytes 9-10; D14 (timed safe rooms, phase from the seed)

**Fairness: ok, 4 of 5; gap narrows; D14 compliant.** D14 holds. The phase comes from seed bytes 9-10, and which room the boss is in at each closing comes from its seeded path, so the safe room is visible and different in every run, never one you can learn in advance. The R4.6-12 divergence argument still works because it holds on any board, and gate state depends only on the tick and phase. Gate cells become normal claimable ground once captured, so the score ceiling does not move. Search is already at 98.5% of the ceiling and gains almost nothing, while humans get a safe window they can read from a countdown, so the gap narrows. Scripted bots need one extra term in their boss-reach margin, which is deterministic, so calibration is easy. Variance: which room the boss holds is seed luck, but windows repeat every P ticks, so the luck averages out within a level. With P up to 600 and C up to P-1, that averaging can fail. Risks as written: (1) with C close to P the gates act as permanent walls; (2) if the spawn rectangle sits entirely inside one room, the other room is boss-free during every closed span in every run, a safe zone that does not depend on the seed and that D14 forbids; (3) in a gate band thicker than one cell, a boss body inside the band sees gate cells on both sides and can sit bouncing in place.

*Fixes.* Add validity rules: C \<= P/2, gate lines exactly one cell thick, and the boss spawn rectangle must hold top-left cells on both sides of every gate line, so either room can be the boss's room. Keep one project-wide table of seed-byte allocations (bytes 9-10 here). State in R4.6-3 that when a leading edge holds both a closed gate and TRAIL, the hit wins.

**Play: strong, 4 of 5.** This adds real new situations. No level has field state that changes over time, and a timed boss-only wall gives the level a rhythm: get into position before the close, work the room the boss isn't in, get back to the rail or close before it opens. Fast cut becomes a race against the opening and the rail becomes a waiting room. Commit gains a timing element, because you can bank right after a window. It keeps D14, since the seed sets the phase and which room the boss is in at each close. It fits the genre's feel, because shutting the boss in is the point of Qix-likes. Main risk is a dominant line. While a gate is closed, a cut along the column or row one cell past the gate, on the free side, can never be bumped (the boss bounces off the gate first) and seals the whole free room. With a doorway-style gate, that seal is 4-8 cells, so it is free every window. With a full-length gate line, it is about 29 ticks at fast cut. If C is longer than the sealing time, each window is a guaranteed capture of a whole room, and the level stops asking for decisions. Second issue: thick gate bands. A body sitting fully inside a band thicker than one cell when it closes finds gate cells on every leading edge and freezes in place until it opens. Seed bytes 9-10 don't collide with the other ideas in this batch.

*Fixes.* Authoring rule: gate lines exactly one cell thick. Cap C below the fast-cut time of the gate seal, so sealing is a race that can be lost, not a free move. Avoid doorway gates, or make C a few ticks so they only buy a short cut. Have the playtest include a 'seal on close' scripted policy to catch dominance. On the wedgie there is no HUD (the 60x60 field fills 240x240), so replace the countdown with gate cells that blink for the last ~20 ticks before they change. Reserve seed bytes in one table across all accepted ideas.

*Readability.* Good if it gets its own visual language. A one-cell gate line in a dedicated colour reads well at 4x4 px, bright when closed and dim when open. The open question is teaching that a closed gate is a wall for the boss and floor for the player. Pattern the cells, for example a lit 2x2 dot inside each 4x4 cell, so they don't read as CLAIMED blue. No room for a numeric countdown on the wedgie; blinking before a change works.

## Dormant anchor walls raised by switch cells

`terrain-and-geometry#11` · T3 New core rule · score 9 (core 2, fairness 4, play 3) · gap: narrows · D14: compliant

Inert stone walls cross the field, each linked to a switch cell somewhere in the open. Capturing the switch turns its wall into claimed rail, so a wall that only stopped the boss becomes a mid-field anchor you can cut from, and the order of your captures matters.

**Rule sketch.** Needs STONE and the terrain plane (inert-stone idea). Level v2 adds up to 4 links, each a switch cell (u8 sx, u8 sy), EMPTY at start, and a wall rectangle (x0, y0, x1, y1) whose cells are all STONE. Step 3, after the capture pass (R4.8-4) and before the minion lifecycle of R4.7-8: for each link in order whose switch cell is now CLAIMED and whose wall is still STONE, every wall cell becomes CLAIMED. The boss and the fill see no difference, since STONE and CLAIMED both block them, so no region changes and captured_cells does not move. Only the rail changes: wall cells next to open field become rail, cuts can close on them, and the orientation step and stranding test that already run at this capture see the new rail, so a minion whose component now reaches the wall will patrol it. A switch left in the boss's region is never captured, and its wall stays stone for the level. State: a wall's state follows from its switch cell's, so hash v1 can stay if STONE packs as CLAIMED; hash v2 with STONE distinct is the more conservative choice.

**Inspired by:** Fortix (2009), Line Knight Fortix (2014), Territory Reveal (2026), Hexanaut.io (2022), TERRITORY SCRAMBLE (2026, unreleased). **Mechanic families:** [Keys, gates and remote triggers](../taxonomy/terrain-and-geometry.md#keys-gates-and-remote-triggers), [Designated capture anchors](../taxonomy/terrain-and-geometry.md#designated-capture-anchors), [Capturable map structures](../taxonomy/terrain-and-geometry.md#capturable-map-structures). **Touches:** level-format, level-data, rules, tools-bots, presentation.

**Decisions it reopens:** R4.8-4; R4.7-8; D7; all of inert stone's (R4.1-2, R4.2-1, R4.5-3, R4.5-4, R4.6-3, R4.8-3).

**Bot effect.** Search adapts, but its lookahead is two captures deep (a setup and a finisher), while a switch pays off over many later captures, so search as built undervalues switches unless its evaluation learns to value anchor gain. Humans plan this kind of long-horizon structure naturally. One of the few ideas here that may narrow the gap, at least until bot authors add a switch heuristic, which a determined one will. Scripted bots ignore switches unless taught, so calibration should include a switch-seeking policy.

**Budget.** No RAM beyond stone. Per capture: at most 4 switch reads and at most 4 walls of up to 116 cells rewritten once; zk unchanged within noise. Level +24 bytes plus the terrain plane. Screen: each wall redrawn once, when it switches.

**Variety.** Capture order becomes a plan: take a risky switch near the boss's spawn early to raise a central anchor wall that makes every later cut short, or ignore it and fight with long cuts from the border. The switch is a target worth one cell of claim and a lot of tempo. Current levels have no cause and effect between captures.

**Core engineer: feasible with changes, 2 of 5, tier 3.** The switch part is cheap and correct:

- Turning STONE into CLAIMED changes no EMPTY cell, so no region, claim, boss path or stranding changes. The rail can only gain cells.
- A wall's state equals f(its switch's state) at every hashed point.
- The claim that search looks two captures deep, a setup and a finisher, is confirmed in tools/src/bots/search.rs, so search does undervalue switches until someone gives it a heuristic.

The cost lies in the STONE prerequisite, which breaks D7. PIN-14's proof rests on every 4-connected CLAIMED group meeting the field along one closed loop. Once non-walkable STONE forms part of the field's boundary, the rail next to it becomes a path with dead ends. Example: a cut along the row just under a free-standing stone wall leaves two spurs facing each other across the wall, and at level start a wall at least 3 cells thick that touches the border cuts the border rail.

A right-hand walker that reaches a dead end turns back and walks with the field on its left. That is the failure mode of the old orientation rule: M1.7 measured 1.2% of minions trapped, 2×2 rail circles included. So coverage cannot be claimed without new proof and tests.

Smaller points:

- STONE needs no terrain plane if stone exists only as the 4 link rectangles: a Cell::Stone variant in the u8 grid costs no RAM.
- In the hash, BOSS_ZONE (code 3) never appears in a hashed grid, so STONE can take code 3 and keep 2-bit cells. Hashing STONE as CLAIMED would alias two states and hide bugs.
- 'A switch in the boss's region is never captured' is loose: a later cut can still separate it from the boss.

*Fixes.* - Split the rail definition. For minions, a rail cell is CLAIMED or STONE with an open 8-neighbour, so for them STONE ≡ CLAIMED, and the D7 loop argument and PIN-14 carry over verbatim. Orientation and stranding use this minion rail, and a wall's conversion then changes nothing for minions.
- For the player, the rail stays CLAIMED-only. The player needs no coverage guarantee, cannot stand on STONE and cannot close a cut on it.
- Encode STONE only as the link rectangles; drop the plane.
- Hash STONE as code 3 in a same-length hash v2.
- Validity: switch EMPTY at start and outside every wall; walls inside the interior and clear of every spawn body.

*Cost.* - Level v2: +24 B (4 links).
- Grid unchanged (new u8 variant); Game about +24 B.
- Per capture: at most 4 switch reads and at most 4 × 116 cell writes, once. zk within noise.
- Hash v2, same 948-byte length.
- RULES_VERSION bump. New D7 property tests on stone boards with the split rail. A switch-seeking bot policy before calibration. Renderer: a stone colour, walls redrawn once.

*Conflicts.* D7; PIN-14; R4.1-2; R4.2-1; R4.5-3; R4.5-4; R4.6-3; R4.7-3; R4.7-8; R4.8-3; R4.8-4; state hash v1

**Fairness: ok, 4 of 5; gap narrows; D14 compliant.** D14 holds. The idea uses no seed bytes and does not change what the boss can reach, since STONE and CLAIMED both block the boss and the fill. So it creates no new safe zone and nothing copyable, and the seeded boss still makes every run diverge. Anchors shorten later cuts, which means less exposure per cell captured. Safe exposure is what humans lack and what search already maximizes, so the gap narrows. Do not count on search undervaluing switches: a bot author can add an anchor-gain bonus in a few lines. Calibration risk: if the reference mix ignores switches, its median claim understates what a planning human gets, the level's weight comes out too generous, and drawing that level becomes good luck in Challenge. The pitch's switch-seeking policy is therefore required, not optional. Whether a switch ends up in the boss's region depends on the seeded boss path, which is some seed luck but bounded. The idea depends on the inert-stone idea and all of its rule conflicts. Packing STONE as CLAIMED in hash v1 stays deterministic given the level bytes, but v2 is safer.

*Fixes.* Add a switch-seeking policy (prefer rectangles that cover an unclaimed switch) to the reference mix before calibrating. Add validity rules: switch cells are EMPTY at start and outside every boss body in the spawn rectangle, and wall cells are all STONE. Extend the D7 coverage property test to the mid-field rail components a switch creates. Use state hash v2 with STONE as its own value.

**Play: ok, 3 of 5.** It adds cause and effect between captures: capture order becomes a plan, and going for a switch near the boss is a real tempo-versus-risk choice. But a mid-field anchor is not new by itself. Ring's central block, cross's arms and maze's bars are already obstacles you cut to and then work from. What is new is only that the anchor is dormant until earned. Once raised, a wall is usually an island rail component. The player still needs a connecting cut to reach it, and minions only reach it once it connects, so the payoff is a little slower than the pitch implies. It cannot ship on its own: it depends on the inert-stone idea (a new cell state, hash v2, rule edits across R4.1-R4.8), so its variety per unit of cost is moderate. It doesn't clash with the game's feel, because the boss and the fill see no change. Up to four switch-to-wall links per level is a lot to learn without a HUD.

*Fixes.* Ship only alongside inert stone, and limit it to 1-2 links per level. Make each link obvious from the layout: put the switch next to, or in line with, its wall, or colour-code each pair. Consider letting the raised wall become rail that connects to the border rail when it touches the border, so the payoff comes without a second connecting cut. Include a switch-seeking scripted policy in calibration, as the pitch says.

*Readability.* Workable but palette-hungry. STONE needs its own colour, clearly not CLAIMED blue (grey works), and a switch is one marked cell. Mapping switch to wall with up to 4 links needs 4 more pair colours, or a convention, on a 16-colour buffer already shared with other ideas. The wall changing colour when raised is easy to see.

## Inert stone walls

`terrain-and-geometry#5` · T3 New core rule · score 9 (core 2, fairness 4, play 3) · gap: widens · D14: compliant

A second kind of obstacle. Stone turns the boss and blocks your trail like a wall, but it is not claimed ground: you cannot close a cut on it, walk along it or score it, so every cut that uses stone as a wall must still run on to real territory.

**Rule sketch.** Level bytes v2 add a terrain plane: 2 bits per cell (900 bytes, same cell order as the obstacle bitmap) plus a 3-byte palette naming the terrain kind of values 1-3 (0 = plain). The other terrain ideas reuse it. Kind STONE starts as a new cell state STONE. Runtime: the grid byte gains a terrain field above the 2 state bits, so no extra RAM. Rules: STONE is not EMPTY at level start, so it is outside claimable_cells (R4.1-8). It is not CLAIMED, so it is never a rail cell (R4.2-1) and never closes a cut (R4.5-5), and the off-rail rule (R4.5-3) does not let the player onto it. A player move onto STONE is ignored, like a move onto its own trail (R4.5-4, PIN-05). The boss's edge test (R4.6-3) treats STONE like CLAIMED: bounce, never a hit. The capture fill (R4.8-3) spreads only into EMPTY, so STONE stops it like CLAIMED, and the pass (R4.8-4) leaves STONE as it is. Minions only enter rail cells, so they never enter STONE. Where stone lines the border or other claimed ground, that stretch stops being rail, so a rail component can be a path with two ends; a minion reaching an end turns back by the right-hand rule (turn back is its last option). Validity: the EMPTY cells stay one 4-connected region (code 35); stone is barred from the border except in the inside-out idea. State hash: STONE never changes, so hash v1 can pack it as CLAIMED (it is a level constant, like the deflection key), or hash v2 packs 4 bits per cell.

**Inspired by:** Fortix (2009), Lightfish (2011), Territory Raider (2026), FANCY QIX (1990), Claim (DaNuTree) (2026), DroneXtreme: Territory Capture (2026). **Mechanic families:** [Interior obstacles and walls](../taxonomy/terrain-and-geometry.md#interior-obstacles-and-walls), [Cut-resistant sections](../taxonomy/terrain-and-geometry.md#cut-resistant-sections), [Cover and concealment terrain](../taxonomy/terrain-and-geometry.md#cover-and-concealment-terrain), [Impassable water with sea lanes](../taxonomy/terrain-and-geometry.md#impassable-water-with-sea-lanes). **Touches:** level-format, level-data, rules, state-hash, tools-bots, presentation.

**Decisions it reopens:** R4.1-2; R4.1-7; R4.2-1; R4.5-3; R4.5-4; R4.6-3; R4.8-3; D7; §5 level bytes v1.

**Bot effect.** Search adapts for free. Greedy's closure test (a straight run of CLAIMED cells) already excludes stone, but its rectangles must also avoid stone cells, a small tools change; scripted clear rates drop and calibration absorbs it. Human vs search: stone is static and visible, so it adds route planning that humans do well. But it forces longer cuts, since you cannot shortcut onto it, and long cuts reward exact knowledge of the boss's seeded path: mild widening. Using stone as cover (a trail along stone cannot be bumped from that side) offsets part of it.

**Budget.** Core RAM 0: the state and terrain share the existing u8 grid cell. Per tick: one more arm in the boss's edge-test match and in the player's move test; zk cycles unchanged within noise. Level bytes grow by 903, to 1,375, which adds about 5.4 KB to a six-level settlement's calldata (about 53 KB today, under the 95,000-byte limit). D7's coverage proof must be redone with property tests for rail components that are paths. Screen: one grey palette entry.

**Variety.** Today every obstacle is a free anchor: every bar or block is rail you can close on. Stone separates 'shapes the field' from 'gives you an anchor'. A stone fence splits the boss's space, but each cut must still reach real territory, and a cut hugging stone is shielded from the boss on that side. Mixing stone fences with claimed posts lets designers decide exactly where anchors exist; stone fences with gaps play like impassable water crossed only at lanes.

**Core engineer: feasible with changes, 2 of 5, tier 3.** The rule set is consistent. Stone is outside claimable_cells, never rail, stops the fill, bounces the boss without a hit, and code 35 keeps the EMPTY cells one region. The costs are real:
(1) The 2-bit, 900-byte plane makes level bytes 1,375 long. The natmod's start decodes Level onto the stack (decode, then Recorder::new(&level)). That adds at least 903 B, and up to about 1.8 KB with a by-value copy, to start's 62,784 B peak, against the 65,536 B stack and the roughly 2.7 KB that wedgie/README.md says is left for interrupt frames.
(2) A 'terrain field above the 2 state bits' means Cell stops being a 4-variant repr(u8) enum. Every match in grid.rs must mask the byte, as must the capture pass (which overwrites whole bytes), abandon_cut's replace, the boss edge tests, is_rail, orient and the hash packing. That is about one extra AND per read in the hottest loops, roughly 1-3% of zk.
(3) Rail components shaped like paths: at a path end the right-hand rule turns back and then walks with the field on its left, which D7's proof never covered. A simple case, a stone run along the bottom border, traces correctly by hand, but 2-wide rail bands need the property test.
(4) Settlement calldata grows 5.4 KB on about 53 KB, still under 95,000 B.
Greedy must stop closing cuts on stone. The idea admits a mild bot-gap widening.

*Fixes.* Encode stone as a short list of rectangles (for example up to 16 x 4 B = 64 B), or as a 1-bit 450 B plane, and paint it into the grid at level start. Otherwise wait for M3.10's in-place constructors before growing Level. Pack STONE as CLAIMED in state hash v1, since it is a level constant. Redo D7's coverage proof with property tests on path-shaped rail components before adopting.

*Cost.* As stated: level +903 B (+64 B with rectangles), start stack +0.9 to 1.8 KB, calldata +5.4 KB per six-level settlement. Game RAM 0. zk +1-3% from masking. Refactor of the Cell representation across the core, shell, web and natmod renderer. RULES_VERSION bump, level v2 vectors, D7 re-proof, bots, recalibration.

*Conflicts.* R4.1-2; R4.1-7; R4.1-8; R4.2-1; R4.5-3; R4.5-4; R4.5-5; R4.6-3; R4.8-3; R4.8-4; D7 / PIN-14; §5 level bytes v1; §2 / §3 wedgie stack budget

**Fairness: ok, 4 of 5; gap widens; D14 compliant.** D14 is unchanged: stone is static, visible level data. It adds no new kind of safe zone. Channels narrower than B already exist with CLAIMED bars, and stone channels are worse anchors than those, not better.

Cuts that must run on to real territory are longer, which raises exposure to the boss and rewards exact boss prediction: mild widening, partly offset by using stone as cover. Calibration needs only a small change: greedy's rectangles must exclude stone.

Side costs:

- **Calldata.** 903 B more per level adds about 5.4 KB to every settlement.
- **Device RAM.** If the app keeps all 16 levels in RAM, 22 KB of level bytes exceeds the wedgie's 18 KB free.
- **Coverage.** Rail components that are paths break the one-closed-boundary argument. The right-hand rule still covers a path, turning back at its ends, but the property tests must check it.
- **State hash.** Packing STONE as CLAIMED in hash v1 is safe, because level_id commits to the terrain, but it must be documented.

*Fixes.* - Load levels one at a time on the wedgie.
- Consider a run-length encoding of the terrain plane to cut calldata.
- Extend M1's coverage test to path-shaped rail.
- Prefer state hash v2, or state the v1 packing of STONE in §6.4.

**Play: ok, 3 of 5.** This separates 'shapes the field' from 'gives you an anchor', a distinction the 16 levels can't express, because every bar, comb or block is rail you can close on. Stone still walls a capture (the fill stops on it), so it shapes enclosures. A cut hugging stone is shielded from the boss on that side, which is a tactical choice humans are good at. Stone fences with gaps give lanes, and rail dead ends make minions patrol back and forth, both of which are new situations. It costs a lot for the variety it brings: a 903-byte plane (level bytes nearly triple), a fifth cell state that conflicts with the 2-bit hash packing, and a redo of the D7 coverage proof for rail components that are paths. A third surface type also blurs the clean field-versus-land reading of the genre a little. Forcing longer cuts widens the gap mildly.

*Fixes.* 1. Encode stone as a short rectangle list (for example up to 8 x 4 bytes) or a sparse bitmap, not a 2-bit plane over all 3,600 cells. That keeps level bytes and calldata small, unless a shared terrain plane for other kinds is a firm decision. 2. Start with stone that never touches border or claimed ground, which avoids the rail dead ends and the D7 rework, then add dead ends later if playtests want them. 3. Pack stone as CLAIMED in hash v1 as proposed, to avoid a hash version.

*Readability.* Very good. Stone is static and drawn once, and a grey that differs clearly from claimed land is easy to read at 4x4 px. It costs one palette entry and is never redrawn.

## Y-dropped rail blocker

`terrain-and-geometry#13` · T4 Input or journal · score 9 (core 3, fairness 3, play 3) · gap: narrows · D14: compliant

Pressing Y drops a barricade on the rail cell you stand on. For three seconds, minions treat it as a dead end and turn back, so you can block a minion closing in, or keep one away from the stretch of rail you want to cut from. You get two per level.

**Rule sketch.** Input: Y becomes mask bit 7, which needs journal v2 (v1 decoders reject bit 7 with code 10). Player state gains barricade cell (u16, 0xFFFF = none), barricade countdown (u8) and barricade charges (u8, 2 at level start). Step 3, before movement: if this tick's event changed bit 7 from released to held, the player is on the rail and not cutting, and charges > 0, the barricade moves to the player's cell, its countdown becomes 45 (3 s) and charges drop by 1. Only one barricade exists at a time; a new one replaces the old. Step 5: while the countdown is above 0, the barricade cell is not a rail cell for minion moves (R4.7-1, R4.7-2), so the right-hand rule turns a minion back at it, and a minion with no other rail cell stays put (PIN-18). The countdown drops by one at step 5 each tick. The player may leave the barricade cell but cannot re-enter it while it lasts. A capture that takes the cell off the rail clears the barricade. Orientation steps (R4.7-3) ignore barricades. The minion hit predicate (R4.9-8) is unchanged.

**Inspired by:** Claim (DaNuTree) (2026), JEZZAK (2023), Gals Panic 4 (1996), Gridder (1983), Gapper (1986), Painter (1993), Painter Man!! (2025). **Mechanic families:** [Homing chasers](../taxonomy/field-enemies.md#homing-chasers), [Sight-based detection and stealth](../taxonomy/field-enemies.md#sight-based-detection-and-stealth), [Grid-bound chasers](../taxonomy/field-enemies.md#grid-bound-chasers), [Player-placed blockers](../taxonomy/terrain-and-geometry.md#player-placed-blockers), [Terrain used as a weapon](../taxonomy/terrain-and-geometry.md#terrain-used-as-a-weapon). **Touches:** input, journal, rules, state-hash, presentation, tools-bots.

**Decisions it reopens:** D8; §6.1 bit 7; §6.3 decode rule 10; R4.3-2; R4.7-2; §6.1 bit 7 (reserved); §6.3 decode code 10; R4.7-1; D7; PIN-14.

**Bot effect.** Search will use barricades well; the reference bots need a rule, such as dropping one when a minion is within k rail cells. Minion pincers on the rail are where humans lose most lives on the hard levels (the reference mix clears trio 20%, swarm 21% and doom 11%, against 100% for search), and search avoids them by exact timing. A barricade gives humans a coarse, forgiving answer to the same problem, so the gap should narrow on minion-heavy levels. It is an action with a cost (two charges), not free thinking time, so D8's concern about a pause does not apply, but D8's mapping must be amended.

**Budget.** 4 bytes of player state: state hash v2 (+4 bytes; the input mask is already hashed). One extra compare per minion move; no material zk change. Journal format v2 (bit 7 legal), a new decoder, regenerated vectors, a browser keybinding and the wedgie's Key3 (Y). Screen: one cell drawn as a barricade for 45 ticks.

**Variety.** The player's first way to shape terrain actively: choose where to put a dead end in the minions' patrol, split two minions apart, or keep one away from the rail you need for a long cut. Today the only answers to minions are timing and the single shield charge.

**Merged from:** `field-enemies#12`. Variants:

- Lure flare on the spare key: Once per level, press Y on the rail to drop a flare. For three seconds, minions stop dead in front of the flare's cell, damming the patrol, and hunters and the boss's gaze go for the flare instead of you. One well-placed flare buys one bold cut.

**Core engineer: feasible with changes, 3 of 5, tier 4.** Cheap in bytes and cycles, but the turn-back rule breaks D7.
(1) A minion turned back at the barricade by the right-hand rule then walks with the field on its LEFT, and the orientation step runs only at spawn, respawn and capture, so it stays that way after the barricade expires. That is the pre-M1.14 state that trapped 1.2% of minions (circling a 2x2 block of rail cells, skipping bumps of the rail). PIN-14's coverage property fails, and search will learn barricade placements that trap a minion for good: an exploit that strongly favours search.
(2) The right-hand rule may also take 'left' at a rail junction instead of turning back, so the barricade diverts the patrol rather than blocking it.
(3) R4.9-17 (lost life) and R4.4-7 (commit) return the player to the cut start. The cut start is often the barricade cell, which the player 'cannot re-enter', so the precedence must be pinned.
(4) Respawn (R4.7-7) picks the spawn, or the first rail cell in row-major order, and could land a minion on the barricade.
(5) While standing on the barricade the player is untouchable by minions for 45 ticks. That is acceptable, since it is not a pause and the clock runs, but it should be stated.
(6) Journal v2 is needed: decode code 10 and vectors/format/journal-reserved-bit-7.json. D8 needs an amendment. It conflicts with [human-edge#7](human-edge.md#abandon-a-cut-on-demand) over Y.
(7) The gap analysis is plausible, as a coarse human answer to minion pincers, provided the trap exploit is closed.

*Fixes.* Dam instead of turn back: compute the right-hand step with the barricade counted as rail; if that step's target is the barricade, the minion stays in place and keeps its heading (like PIN-18). The patrol then resumes unchanged after expiry and D7 coverage holds. Returning to the cut start (lost life, commit) overrides the no-re-entry rule. Respawn skips the barricade cell. Journal v2, D8 amended. Decide which idea owns Y.

*Cost.* State +4 B (u16 cell, u8 countdown, u8 charges): hash v2 (952 B), Game +4 B. One compare per minion candidate move; zk ~0. Journal v2 (decoder, format vectors), browser keybinding, wedgie Key3. Screen: one barricade cell for 45 ticks. RULES_VERSION bump, vectors, bot rule, calibration.

*Conflicts.* D8; D7; PIN-14; PIN-18; R4.7-1; R4.7-2; R4.7-7; R4.9-17; R4.4-7; §6.1 bit 7; §6.3 decode code 10; [human-edge#7](human-edge.md#abandon-a-cut-on-demand) (Y)

**Fairness: concerns, 3 of 5; gap narrows; D14 compliant.** It helps humans where they lose the most lives, minion pincers on trio, swarm and doom (mix clears 11 to 21%, search 100%). Search already claims 97.6 to 99% of the ceiling on those levels and gains little, so the gap narrows. D14 holds. The catch is the turn-back. A minion turned back at the barricade walks with the field on its left until the next capture re-runs the orientation step. That is the counterclockwise patrol that D7 and M1.14 found can miss bumps of the rail or circle a 2x2 block of rail cells forever (about 1.2% of boards under the old rule). Level geometry is fixed, so a player who learns where this happens can trap a minion until the next capture, a seed-independent trick that search would find systematically. Calibration needs a reference-bot rule (drop a barricade when a minion is within k rail cells); without one, the weights overstate human difficulty on minion levels. Y needs journal v2 and an amended D8; it gives no thinking time, so D8's reason still holds.

*Fixes.* Make the barricade a stop, not a wall: a minion whose next cell is the barricade waits in place and keeps its heading (as PIN-18 already does). That keeps the clockwise patrol and D7's coverage property. Alternatively, run the orientation step whenever a minion turns back. Trigger on Y going from released to held. Add a barricade rule to bold and committer before calibrating.

**Play: ok, 3 of 5.** The first active tool against minions. It targets where humans lose most (trio, swarm, doom), so it should narrow the gap, and 2 charges keep it scarce. It brings real decisions: where to dam the patrol, splitting two minions, guarding the stretch you cut from. Design flaw: a turned-back minion walks counterclockwise with the field on its left, which is exactly the patrol D7's orientation rule removed (it can miss rail bumps or circle a 2x2 rail block forever). Orientation runs only at spawn, respawn and capture, so nothing restores it. A barricade on a rail stretch 2 cells wide (corners, cells that touch the field only diagonally) can be walked around. Standing on your own barricade also makes you untouchable by minions for 3 s, which may be the intended answer but should be stated. It competes with the bail idea for Y and needs D8 amended.

*Fixes.* Make minions wait in front of the barricade (PIN-18 style, as the flare variant does) instead of turning back, or run the orientation step on any minion that turned back when the barricade expires. Extend the PIN-14 coverage property test to cover barricade periods. Either forbid barricades on rail stretches 2 cells wide or block the parallel cell too.

*Readability.* Good. One cell in a distinct colour (a white or grey block on the blue rail) for 45 ticks, with a blink in its last second. The number of charges left has no in-play HUD on the wedgie, so it needs an on-field cue.

## Bog and ice patches

`terrain-and-geometry#7` · T3 New core rule · score 8 (core 3, fairness 3, play 2) · gap: widens · D14: compliant

Patches of open field change how you cut through them. Bog slows you to a crawl and cancels the fast cut; ice keeps you sliding when you let go. The boss and minions ignore both, so each cut becomes a choice between the short way through a patch and the fast way around it.

**Rule sketch.** Terrain-plane kinds BOG and ICE on cells EMPTY at level start. A patch acts only while its cell is EMPTY or TRAIL: once captured (CLAIMED) it is ordinary ground, so walking the rail is never affected and enclosing a patch removes it. BOG, step 3: if the player is cutting and its cell at the start of step 3 is BOG, it moves only on ticks with tick % 2 = 0 (with B held, only when tick % 4 = 0, which replaces R4.5-7's parity there so the two parities can never cancel each other out), and it takes at most one sub-step (A ignored). A sub-step that enters a BOG cell ends the tick's movement, with no sub-step 2 (as PIN-04). ICE, step 3: if the player is cutting, stands on an ICE cell and holds no direction, the resolved direction is the previous direction instead of none (R4.5-1). The player therefore keeps moving until a move is blocked (own trail, PIN-05), the cut closes, or it leaves the ice; holding a direction steers as usual. Runtime: the kind lives in the grid byte's terrain field, which the fill and the pass never rewrite. State hash v1 can stay, because the kind of an EMPTY or TRAIL cell is a level constant.

**Inspired by:** Fortix (2009), Lightfish (2011), GraviNix: Tilt Xonix Arcade (2026), Marble Land Grab (2026), Territory Raider (2026). **Mechanic families:** [Movement-altering terrain](../taxonomy/terrain-and-geometry.md#movement-altering-terrain), [Obstacles removed by enclosure](../taxonomy/terrain-and-geometry.md#obstacles-removed-by-enclosure). **Touches:** level-format, level-data, rules, tools-bots, presentation.

**Decisions it reopens:** R4.5-1; R4.5-6; R4.5-7; PIN-04; D4 (ice: no stopping on ice).

**Bot effect.** Search adapts unchanged. Scripted bots must price a rectangle by its true cut time through bog (greedy's boss margin is computed from the cut's ticks, so it needs a per-cell cost) and must never plan to stop on ice. Bog is static and visible, so the route choice is fair to humans, but the slower cut extends exposure and rewards exact boss prediction: mild widening. Ice removes the human's best defence, stopping when the boss comes close, while costing search nothing, since search never relies on reaction: ice clearly widens the gap. Keep it rare, or out of Challenge sets.

**Budget.** Core RAM 0. Per tick: one terrain read per sub-step, a few dozen cycles; zk unchanged within noise. Terrain plane +903 level bytes, shared with the other terrain kinds. State hash v1 can stay. Screen: two palette entries (brown, pale cyan); patches never animate.

**Variety.** The first route decision inside the open field: through the patch (shorter, but 4 times slower than a fast cut, or a slide you cannot stop) or around it. A bog moat around a spot makes the final squeeze slow; an ice lane rewards committing to a straight cut. Current levels only ever ask where to cut, never how fast the ground lets you go.

**Core engineer: feasible with changes, 3 of 5, tier 3.** Bog: replacing B's parity with tick % 4 is necessary. With (tick - press_tick) % 2 for B and tick % 2 for bog, an odd press_tick would never let the player move. Ending movement on entering a bog cell extends PIN-04 cleanly. Ice: falling back to the previous direction when none is held is consistent. A blocked slide keeps retrying the same move under PIN-05, so it stops at the own trail. State hash v1 can stay, because the terrain under an EMPTY or TRAIL cell is a level constant. Costs: the idea uses the same 903 B plane as stone, with the same start-stack risk and the same Cell refactor (the capture pass and abandon_cut must preserve the terrain bits). Neither is needed: patches are static, matter only while their cell is EMPTY or TRAIL, and are read once per sub-step, so looking them up by position in a short rectangle list held by Game leaves the grid untouched. Ice removes the human's main defence, stopping mid-cut (D4), while search never relies on reaction, so it clearly widens the gap, as the idea admits. Greedy needs a per-cell cut-time cost.

*Fixes.* Store patches as up to 8 rectangles of 5 B each (kind, x0, y0, x1, y1) in level v2 and in Game (about 40 B), and check kind_at(pos) only while the cell is EMPTY or TRAIL, with no grid change. Ship bog first. Keep ice out of Challenge sets until bot-advantage has been measured on ice levels, and get an owner decision on ice against D4.

*Cost.* As stated: level +903 B and RAM 0. With rectangles: level about +41 B and Game about +40 B. One terrain lookup per sub-step: zk under 0.5%. State hash v1 unchanged. Wedgie: 2 palette entries. RULES_VERSION bump (R4.5-1, R4.5-6, R4.5-7, PIN-04), level v2 vectors, per-cell cut cost in greedy, recalibration.

*Conflicts.* R4.5-1; R4.5-6; R4.5-7; PIN-04; PIN-05; D4; §5 level bytes v1

**Fairness: concerns, 3 of 5; gap widens; D14 compliant.** D14 is unchanged: the terrain is static.

**Bog is fair.** It is static and visible, and the player prices it by choosing a route. Slower cuts extend exposure to the boss, a mild widening. One detail: under B the bog parity becomes tick % 4, which humans cannot see, so entering bog has one or two ticks of jitter.

**Ice is the problem.**

- It removes D4's stop mid-cut, the human's main reaction to a boss closing in. Search never relies on reacting, so the gap widens.
- A reflex release next to the boss slides the player into its body (R4.9-3).
- The pitch's 'you cannot stop' is wrong under PIN-05. Holding the reverse direction is a blocked move onto the player's own trail, and it sets the previous direction backward, so a tap back stops the player on ice. The real rule is an unintuitive input trick that search knows and casual humans don't.

Calibration is feasible with per-cell costs in greedy. Weights from scripted bots would misprice ice levels for humans.

*Fixes.* - Allow bog in Challenge sets.
- Keep ice Training-only, or redefine it as one extra sliding cell after a release, so stopping stays a reaction.
- If ice stays, document the tap-back brake in the rules and the tutorial.
- Keep both rare in Challenge sets.

**Play: weak, 2 of 5.** Bog is mostly a slow-zone modifier: it adds a 'through or around' route choice, but in practice it makes cuts slower in chosen places, so it adds more difficulty than decisions, and it widens the gap mildly by lengthening exposure. Ice clashes with D4 (stopping mid-cut is allowed, with no fuse), which is one of Jiro's main fairness choices. It removes the human's best defence, stopping when the boss is near, while costing search nothing. The sketch itself says it clearly widens the gap. Ice also has a loophole: holding the direction back onto your own trail resolves to a blocked move (PIN-05), so the player stops anyway. 'A slide you cannot stop' then becomes 'hold back to stop', which is unintuitive, and the human-facing promise doesn't hold. Both need the 903-byte terrain plane.

*Fixes.* Drop ice, or make it apply only to fast cut (A held on ice keeps you going; releasing A still lets you stop), so D4 survives. Keep bog only as a level-design tool, encoded as a few rectangles rather than a full plane. Consider making bog cancel fast cut only, rather than halving base speed, so it stays a route trade-off rather than a trap.

*Readability.* Static brown and pale-cyan patches are easy to see at 4x4 px and cost two palette entries without animating. Ice's real behaviour (it slides only when no direction is held, and holding back stops you) is not readable from the screen.

## Inside-out field with a home island

`terrain-and-geometry#6` · T3 New core rule · score 8 (core 2, fairness 2, play 4) · gap: widens · D14: compliant

The outer frame is inert stone, and the only claimed ground is a small home patch inside the field. Every cut must leave home and return to your own territory, the minions circle close around you, and lassoing the boss with one long loop captures everything outside it.

**Rule sketch.** Needs the terrain plane and STONE (inert-stone idea) and the start-candidate list (island-start idea). In an inside-out level the border cells may carry STONE: validity code 22 then requires every border cell to be STONE, or claimed as today. Level start: border = STONE; home patch = obstacle cells (CLAIMED), e.g. 8×8 at (26..33, 40..47); player start and minion spawns on the patch rim (28 rail cells); boss spawn rectangle in the upper half. All other rules then apply unchanged. The rail is the patch rim plus later captures. Cuts close only on CLAIMED, so every cut is a loop from your territory back to it. The fill from the boss body treats TRAIL, CLAIMED and STONE as walls, so the frame helps enclose a region but never anchors a cut. A loop with the boss outside captures its inside; a loop that encircles the boss captures everything between it and the frame. Captured cells next to the frame are CLAIMED rail, so the frame becomes usable only where you have built up to it. The minions start on a 28-cell ring and pass the player every 28 moves until captures lengthen the rail. The ceiling stays claimable − B².

**Inspired by:** 陣取り (Evio) (1993), Paper.io (2016), Splix.io (c. 2016 (unconfirmed)), Territoire (1985), Gal Pani X (2002 (demo 2000)), Gals Panic II (1993), Gal Pani X (2002), Vivid Dolls (1998), Fortix (2009). **Mechanic families:** [Home-territory loop capture (Paper.io model)](../taxonomy/movement-and-drawing.md#home-territory-loop-capture-paperio-model), [Pre-claimed starting territory](../taxonomy/terrain-and-geometry.md#pre-claimed-starting-territory), [Field boundary contact rules](../taxonomy/terrain-and-geometry.md#field-boundary-contact-rules), [Interior obstacles and walls](../taxonomy/terrain-and-geometry.md#interior-obstacles-and-walls). **Touches:** level-format, level-data, rules, state-hash, tools-bots, presentation.

**Decisions it reopens:** R4.1-2; R4.1-7; PIN-01; R4.6-3; R4.6-4; R4.8-3; §5 validity codes 22 and 39; D7.

**Bot effect.** Search adapts unchanged and will find lassos whenever the seeded path allows, scoring near the ceiling. The scripted bots are built around border rails. Greedy's rectangle-closed-by-a-straight-run still works off the patch's straight edges, but no scripted policy lassos, so tools need a loop-aware policy before calibration means much. Human vs search: every cut is a round trip with the boss loose around it, and the best move, a lasso, is a long cut whose safety depends on the boss's next 100 or more ticks: exactly what search knows and humans guess. Widens the gap; pair it with the visible-bumpers preview if it ships in Challenge.

**Budget.** As inert stone (0 RAM, +903 level bytes for the terrain plane) plus the 9-byte start list. No per-tick cost; fills unchanged. State hash v1 can stay. Screen: the frame drawn as stone, the patch as claimed.

**Variety.** It reverses the genre's geometry. There is no safe border to nibble from. Minion pressure is highest at the start and eases as your rail grows. A new finisher appears: encircle the boss, turning one risky loop into a near-total claim. Commit (X) weighs more, because early on the patch is small and a lost life costs the whole cut.

**Merged from:** `movement-and-drawing#10`. Variants:

- Inside-out island levels: The player starts on an island in the middle of the field, and the frame is a dead wall it can neither walk on nor close a cut on. Every cut must loop out from the island and back, territory grows outward, and the boss ends up squeezed against the frame.

**Core engineer: feasible with changes, 2 of 5, tier 3.** This can be built, but it costs more and gives less than the pitch says.
(1) It needs two other unbuilt ideas, the STONE cell state and the start-candidate list. PIN-01 and code 39 hard-code (30, 59), so without the start list a level cannot even describe the player start.
(2) The lasso is not new. Today a cut from the border can loop around the boss and return beside its start, and the fill (R4.8-3) then takes everything outside the loop. Search can already do this. What is new is only that there is no safe border rail at the start, and that minion pressure is concentrated on a short ring.
(3) D7 regression. Once captured land touches the STONE frame, the rail stops being a closed boundary: it becomes a path that dead-ends at the stone. At a dead end the right-hand rule turns the minion back, so it then walks with the field on its LEFT until the next capture runs the orientation step. That is exactly the state that trapped 1.2% of minions before M1.14 (stuck circling a 2x2 block, or skipping bumps of the rail). The rationale of PIN-14 (each claimed group meets the field along one closed boundary) no longer holds, so the coverage test must be rerun on inside-out boards.
(4) 'State hash v1 can stay' only works by giving grid code 3 a new meaning: BOSS_ZONE never appears at the end of a tick, so STONE could take code 3. That is a format change, so the hash should go to v2 with the same 948 B.
(5) The budget is not '0 RAM'. A 900-byte terrain plane makes v2 level bytes about 1,384 B. The wedgie's level buffer grows by about 900 B out of the roughly 18 KB free. Worse, decode() returns Level by value on the 64 KB core stack, where `start` already peaks at 62,784 B, leaving about 2.7 KB for interrupt frames; the extra 900 B or more eats a third of that margin.
(6) A 28-cell ring with three minions and invulnerability 0 at tick 0 allows a pincer on the first tick unless validity keeps spawns away from the start.
(7) The scripted bots cannot lasso. Calibration then measures a policy that misses the level's main play, and the gap with search widens, which the pitch admits.

*Fixes.* Drop the terrain plane. Use a 1-byte 'inert border' flag in level v2, plus a 2-byte player start that replaces PIN-01's constant. Under the flag, border cells stay CLAIMED for the boss, the fill and minion patrol, so D7's closed boundary and PIN-14 coverage survive, and minions that reach the frame simply drift off and leave the player alone. For the player only, border cells are not rail, and a step onto one is ignored, so a cut cannot close on it. That needs no new cell state, no hash change and only +3 level bytes. Add a validity rule: no minion spawn within k rail cells of the player start. Before calibration, give the scripted bots a loop-aware policy that returns to the patch. Ship it in Training first; in Challenge, pair it with a boss-path preview, since it widens the gap.

*Cost.* As stated: level v2 +903 B terrain plane +9 B start list. Wedgie: level buffer +~900 B heap (of ~18 KB); core `start` stack peak +~900 B (of ~2.7 KB margin). New in-memory cell value; hash v2 reinterprets code 3 (948 B). Per tick: the boss's edge test treats STONE as solid, ~0 cycles; zk ~0. RULES_VERSION 3, vectors regenerated (level-border-obstacle code 22 changes), playtest and calibration. With the flag fix: +3 level bytes, no hash change, 0 RAM.

*Conflicts.* R4.1-2; R4.1-7; PIN-01; R4.2-1; R4.6-3; R4.6-4; R4.8-3; §5 validity codes 22 and 39; D7; PIN-14; state hash v1 grid encoding; depends on the inert-stone and island-start ideas

**Fairness: concerns, 2 of 5; gap widens; D14 compliant.** D14 holds. The boss keeps its seeded deflections, and the home patch is fixed per level the way today's border is, so no two runs share a game and nothing can be precomputed. Three fairness problems, though. (1) The finishing move, a lasso around the boss, is a long exposure whose safety depends on 100+ future boss ticks. The search bot simulates those exactly (its two-capture lines already end near 98% claim); humans guess. (2) The opening puts the player, with 0 invulnerability (PIN-01, R4.3-5), on a 28-cell ring shared with up to 3 minions. That is the minion-pincer situation where the reference mix already loses most lives: trio 20%, swarm 21% and doom 11% clears, against 100% for search. (3) The scripted bots plan out-side-back rectangles from a long rail. From an 8-cell patch edge they only nibble strips 8 cells wide, and they never lasso. The mix's median effective claim may then fall under the 500 bp floor in levels/targets.json, which hands the level the maximum weight (P x 10,000 / floor) while search and humans who know the lasso clear it near the ceiling. Drawing it becomes a windfall, which adds variance to the six-level draw. Training-only is fine.

*Fixes.* Keep these levels out of Challenge until a scripted policy that can lasso (loop only when the boss forecast stays clear at bold's 75% margin) joins the reference mix and playtests put the mix's median above the floor. Protect the opening: delay minion spawns on these levels (for example, first arrival after 60 ticks), or grant invulnerability until the first cut. Ship with the boss-path or bumper preview if the lasso is the intended finisher. Allow at most one such level among a season's 16.

**Play: strong, 4 of 5.** This idea reverses the genre's geometry, which no other idea in this batch does. There is no safe border to nibble from, every cut is a round trip from home, and territory grows outward. The lasso around the boss is a new finisher, and minion pressure is inverted: worst at the start on a 28-cell ring, easing as the rail grows. All 16 levels have a full claimed border rail, so this is fully distinct from them. Concerns: (a) It depends on two other ideas, the STONE plane and the start-candidate list, so it cannot ship alone. (b) The lasso is a single capture that scores near the ceiling. Search will find it on every seed, which widens the gap, as the pitch admits. (c) The opening is harsh. There is no invulnerability at level start, and up to 3 minions at period 1 on a 28-cell ring lap the player about every 28 ticks, so the player must leave home at once. (d) D7's coverage argument assumes every CLAIMED group meets the field along one closed boundary. Once captures reach the stone frame, stone is not rail, so the rail becomes open-ended segments that minions shuttle along by turning back. PIN-14 must be re-proven, not assumed. (e) The rule that the frame encloses but never closes a cut is coherent, but players must learn it.

*Fixes.* Give the player a short start invulnerability (as in PIN-02), or use minion period 2 or more on inside-out levels, and space the minion spawns evenly around the rim. Re-run the minion coverage property test on boards with a stone frame and rail segments that end at stone. Ship it in Training first, or only with the visible-bumpers preview in Challenge, because the lasso is where search outscores humans most. Draw stone so it clearly reads as unwalkable.

*Readability.* Yes. Stone needs one new palette entry, such as grey or a 2-tone checker inside the 4x4 cell, clearly unlike the blue CLAIMED. The wedgie uses about 7 of its 16 colours, so there is room. The home patch is ordinary blue. That stone cannot close a cut cannot be shown by colour alone and must be taught once.

## Terrain the boss crosses but the player cannot cut

`terrain-and-geometry#8` · T3 New core rule · score 8 (core 2, fairness 3, play 3) · gap: unclear · D14: compliant

Pits are open field that the boss glides over but you cannot cut through, and they are claimed like any open cell once enclosed. Some levels also drop new pits on a seeded schedule, each announced two seconds ahead, so waiting slowly clutters your cutting lanes.

**Rule sketch.** Terrain kind PIT on cells EMPTY at level start; at runtime a pit flag in the terrain field of an EMPTY cell. The boss's edge test and the fill (R4.8-3) treat a pit as EMPTY, so the boss crosses pits and a capture claims them: the pass turns them CLAIMED, and they count toward captured cells and claim (R4.1-8). The player cannot enter a pit: the sub-step is ignored like a move onto its own trail (R4.5-4, PIN-05), so no cut can start into a pit or cross one. A CLAIMED cell next to a pit is a rail cell, since a pit is EMPTY. Falling pits (optional level fields: period P, 60-255, and warning W \< P; key = big-endian u32 of seed bytes 15-18) add a new step 5b after Minions, with one state field: announced, a u16 cell index or none. On a tick with t % P = P − W, the core counts the n cells that are EMPTY, not pits and outside the boss's body (one 3,600-cell scan), and if n > 0 announces cell number fmix32(key XOR t) mod n in row-major order. On a tick with t % P = 0, if the announced cell is still EMPTY (not TRAIL or CLAIMED; the boss's body may be on it), it becomes a pit; the announcement is cleared either way. The client draws the announced cell as a crack. Hashing: fixed pits need no hash change (level constant); falling pits need state hash v2, with the pit flag per cell and the 2-byte announcement.

**Inspired by:** Territory Raider (2026), Poison Control (2020), Xonix32 (Android) (unknown, last updated 2020), Claim (DaNuTree) (2026), Xonix32 (1997), Gridd Worz (1984), 陣取り (Evio) (1993), Orbis: Bubble Fill Reflex Game (2026). **Mechanic families:** [Enclose hazards to neutralise them](../taxonomy/capture-rules.md#enclose-hazards-to-neutralise-them), [Selective enclosure](../taxonomy/capture-rules.md#selective-enclosure), [Player-only blockers](../taxonomy/terrain-and-geometry.md#player-only-blockers), [Obstacles removed by enclosure](../taxonomy/terrain-and-geometry.md#obstacles-removed-by-enclosure), [Lethal static terrain and traps](../taxonomy/terrain-and-geometry.md#lethal-static-terrain-and-traps), [Moving, spawning and spreading hazards](../taxonomy/terrain-and-geometry.md#moving-spawning-and-spreading-hazards), [Shrinking play area](../taxonomy/terrain-and-geometry.md#shrinking-play-area). **Touches:** level-format, level-data, rules, presentation, tools-bots, state-hash.

**Decisions it reopens:** R4.5-2; R4.5-4; R4.1-2; R4.4-5 (new step 5b, falling pits only); PIN-05; §6.4 seed bytes 15-18; state hash v1 (falling pits only).

**Bot effect.** Search adapts unchanged and knows every future fall from the seed. Scripted bots need pit-free rectangles (one more prefix sum). Fixed pits are static and visible: they constrain routes but never surprise anyone, so they keep the gap. Falling pits are announced W ticks ahead, so a human sees each one in time; beyond the warning search knows the schedule and a human does not (slight widening). But the falls tax waiting. Search pads half the ticks a level can spare to accrue compute (reports/bot-advantage.md: about 1,300 ticks used per level), and here every 150 padded ticks drops another pit into its own field, which narrows the gap from the other side. Net: about neutral.

**Budget.** Fixed pits: 0 RAM, O(1) per sub-step, hash v1 unchanged. Falling pits: 2 bytes of state and one 3,600-cell scan every P ticks; at P = 150 that is 18 scans a level, roughly 1M zk cycles, about 3% of the heaviest level's 30M. Hash v2 for falling pits. Screen: one cell redrawn per fall, plus a blinking crack for W ticks.

**Variety.** Terrain that blocks only you: the boss roams where you cannot cut, and taking a pit lake means encircling it rather than crossing it. Falling pits add the first in-level cost of time other than the time limit: waiting for a safe moment now has a growing price, and Commit (X) becomes a way out of the clutter. No current level changes its layout during play.

**Merged from:** `capture-rules#10`. Variants:

- Bramble ground the boss can cross: Bramble patches block your cuts but not the boss, so the boss can shelter in them. You clear a patch only by fencing it off from the outside.

**Core engineer: feasible with changes, 2 of 5, tier 3.** This is buildable but expensive, and the falling half is costly for modest variety. Fixed pits work as stated: a pit is EMPTY for the boss, the rail, minion orientation and the fill, and the player cannot enter it (R4.5-2, R4.5-4, PIN-05). The state hash can stay v1 if a pit is defined as a level pit bit on a cell that is EMPTY, since capture is the only thing that changes it. But the 'pit flag in the terrain field' breaks in the capture. mark_boss_zone overwrites pit cells in the boss's region with BOSS_ZONE, and the pass turns them back into plain EMPTY, so the pits are lost. It needs a fifth cell value (a pit-boss-zone) or a pit bitmap kept in the Game. The current Grid is an enum \[Cell; 3600\], so per-cell flags mean a core refactor across grid, capture, rail, boss, player, minions and hash. The level format goes to v2: a 450-byte bitmap (922 B per level) or a rectangle list. On the wedgie, start already peaks at 62,784 of 65,536 B. Each extra copy of a 450 B Level or Game field cuts into the 2.7 KB margin left for interrupt frames. Falling pits add a new step 5b, a stored announcement, state hash v2, seed bytes 15-18 and a 3,600-cell scan every P ticks. They can also wall a cutting player in between their own trail and a pit (no fuse, D4), leaving only death or commit. The bot analysis is fair.

*Fixes.* Ship fixed pits only: level format v2 plus RULES_VERSION 3, with pits as a grid value (and a pit-boss-zone value in the fill) or a pit bitmap kept in the Game, and hash v1 kept by defining a pit as level pit bit and EMPTY. Use a compact rectangle encoding to keep levels small. Measure start's stack peak on qemu with the larger Level, or do M3.10's in-place constructors first. Defer falling pits unless playtests show fixed pits are too static.

*Cost.* RULES_VERSION bump. New rule text in README §4.1, §4.5 and §4.8. Level format v2 (+450 B per level, or a short rectangle list) with new format vectors. All game vectors regenerated. Fixed pits: hash v1, about 0 extra zk cycles, 0 RAM with a grid value, or +450 B in the Recorder and the start stack with a bitmap. Falling pits: state hash v2 (+2 B, plus pit bits that 2-bit cells cannot hold), about +1M zk cycles per level (about 3% of the heaviest level, so +3% on the proving price), one 3,600-cell scan per P ticks. Bots: scripted policies must route around pits. Playtest and full recalibration.

*Conflicts.* R4.1-2 (new cell value); R4.5-2; R4.5-4; PIN-05; R4.8-3/R4.8-4 (fill and pass must preserve pits); R4.4-5 (new step 5b, falling pits only); §6.4 seed bytes 15-18 (falling pits only); state hash v1 (falling pits only); level bytes v1

**Fairness: concerns, 3 of 5; gap unclear; D14 compliant.** D14 holds. Fixed pits are static terrain the player cannot use as shelter. Falling pits are a stateless seeded draw (fmix32(key XOR tick) mod n). Gap: fixed pits are neutral. Falling pits widen it slightly: search knows the whole fall schedule, since n depends on a grid it simulates, while humans see only W ticks ahead. The claimed narrowing through a tax on padding is weak: about 18 one-cell pits per level barely constrain a bot that can also pad less. Fairness: seeded falls add run-to-run luck when a pit lands in a narrow lane or across a planned cut. A pit 4-adjacent to the head of an open cut can also box the player in between its own trail and pits, since D4 blocks stepping onto the trail. The player then has to wait for a hit. Calibration: greedy needs pits as blockers in its rectangle search, which is feasible. Cost: T3, with level format v2, a RULES_VERSION bump, state hash v2 for falling pits and about 3% more zk cycles.

*Fixes.* Ship fixed pits first: level format v2 only, no hash change and no seeded randomness. For falling pits, exclude cells within a few cells of the player or the open trail, and cells in narrow corridors. Enable them only on levels designed for them, and measure the per-seed variance of the mix's clear rate before using them in Challenge. Make the bots' rectangle search pit-aware, with a unit test.

**Play: ok, 3 of 5.** Fixed pits add genuinely new geometry: open ground that only the boss crosses. Pit lakes must be encircled rather than crossed, rail along a pit cannot launch cuts, and the boss can roam where no cut follows. That fits the family (a move into a pit is ignored, as a move onto the own trail is), and it is static and readable, so the gap is kept. Falling pits add the first change of layout during play and a price on waiting. But they reintroduce, in another form, the pressure that D4 deliberately removed. They need hash v2 and new seed bytes. And they can trap a mid-cut player: pits plus the own trail can box them into a dead end with no fuse, leaving only a hit or Commit. The cost is high for the value: even fixed pits need a level format v2 bitmap (levels v1 hold only obstacles), a rule change, a RULES_VERSION bump, pit-aware scripted bots and recalibration.

*Fixes.* Ship fixed pits first, as T2+T3 without hash v2, and drop or defer falling pits. If falling pits stay, never announce a cell 4-adjacent to TRAIL or to the player's cell, so a pit cannot seal a cutting player into a dead end. Specify that the player may still stand on the rail next to a pit and walk past it.

*Readability.* Good if pits get their own palette entry or a 2-px checker texture distinct from EMPTY and CLAIMED, which is easy at 4x4 px. A one-cell blinking crack for falling pits is small but visible with the 2 s warning.

## Cylinder field with wrapping sides

`terrain-and-geometry#12` · T3 New core rule · score 7 (core 2, fairness 2, play 3) · gap: widens · D14: compliant

The left and right edges join, and the boss, your cuts and the fill all wrap across them. The only border is the top and the bottom, so one cut from top to bottom merely unrolls the field instead of splitting it, and minions circle the top and bottom rails forever.

**Rule sketch.** Level v2 flag wrap_x. When it is set, columns 0 and 59 are ordinary cells (open unless they are obstacles; validity code 22 then requires only rows 0 and 59 to be border), and every x neighbour is taken mod 60. R4.1-1's 'a neighbour outside the grid' then applies only to y. The rail's 8 neighbours (R4.2-2), player and minion moves, the fill's 4 neighbours (R4.8-3) and the boss's edge column (R4.6-3: column (x + B) mod 60 or (x − 1) mod 60) all wrap. The body covers columns (x + i) mod 60, so it can straddle the seam; the spawn rectangle keeps its form, with the body test wrapped and code 25 relaxed for x. Capture logic is unchanged: a region is captured if it is not 4-connected, with wrap, to the boss's body. Consequences: the bottom row is a closed ring of rail with no corners. A first top-to-bottom cut captures only its trail, because the field stays connected around the cylinder, and turns the field into a rectangle whose new sides are that cut; any later top-to-bottom cut splits it as usual. The player start (30, 59), the boss start draw and the deflection draw are unchanged.

**Inspired by:** Triple Punch (1982), Pet Show (2025), Cubixx (2009), Spherical Qix (2022), Paper.io 3D (2020). **Mechanic families:** [Wrap-around edges](../taxonomy/terrain-and-geometry.md#wrap-around-edges), [Field wrapped on a 3D surface](../taxonomy/terrain-and-geometry.md#field-wrapped-on-a-3d-surface), [Field larger than the screen](../taxonomy/terrain-and-geometry.md#field-larger-than-the-screen). **Touches:** level-format, level-data, rules, tools-bots, presentation.

**Decisions it reopens:** R4.1-1; R4.1-7; R4.2-2; R4.6-3; R4.6-4; R4.8-3; §5 validity codes 22 and 25; D7; PIN-14.

**Bot effect.** Search adapts unchanged once the core wraps. Every scripted bot's geometry (rectangles, distances to the boss, minion margins) needs wrapped arithmetic, the biggest tools change in this list. Human vs search: the seam splits the boss and your trail across the screen's two edges, and the rule that the first cut only unrolls the field is counter-intuitive, so humans need practice that search does not. Widens the gap, at least until players learn it; Training-only first would be prudent.

**Budget.** No new state or RAM: same 3,600-byte grid, state hash v1 unchanged. Every neighbour computation gains a wrap test; captures dominate the cycle count, so expect roughly +5-15% zk cycles on capture-heavy levels (to be measured). It touches the grid, boss, player and minion code and needs new property tests: the body never on a non-EMPTY cell across the seam, and minion coverage on corner-free rings. Screen size unchanged; the browser can optionally draw the field as a slowly turning drum.

**Variety.** A new capture topology. Where to make the first vertical cut, the one that unrolls the field, is a strategic choice; horizontal bands must go all the way around; the boss can come at a cut from the other side of the screen; minions on corner-free rings never turn. No current level changes the topology.

**Core engineer: feasible with changes, 2 of 5, tier 3.** Topologically sound:

- The field becomes an annulus. Its two boundary loops belong to two different CLAIMED groups, the top and bottom rings: a group touching both would turn the field into a disk, and a full obstacle ring fails code 35. So D7's one-loop-per-group argument still holds.
- On a corner-free ring the orientation step picks W on the bottom ring, and the minion circles it forever, covering it.
- The first top-to-bottom cut captures only its trail, as stated.

The budget's 'no new state or RAM' is wrong. With columns 0 and 59 open, the open area reaches 60 × 58 = 3,480 cells, above CAPTURE_STACK = 3,364. The fill pushes every EMPTY cell connected to the boss, so the stack overflows into code 15. It must grow to 3,480 u16: +232 B in Game, about +0.7 KB on start's stack peak (62,784 of 65,536). R4.1-8's 3,364, §4.8's no-overflow rationale and the code-36 half-area all need restating.

The change is also not local. Pos::offset knows nothing of the grid, and every module calls it: neighbours, rail, fill, boss edges and body (Boss::body uses checked_add), player, minions, the respawn scan, validity. So wrap becomes a topology parameter threaded through the most consensus-critical code.

At start the top and bottom rings are separate rail components, so the player cannot reach top-ring minions before the first vertical cut: authors must know this.

zk +5-15% on capture-heavy levels is plausible, but the proving price moves only about 1-2%, because ~87% of it is fixed. Bots need wrapped geometry everywhere, which widens the gap; Training-only first is prudent.

*Fixes.* - Set CAPTURE_STACK to 3,480 and restate the no-overflow argument and claimable.
- Replace Pos::offset with one topology-aware neighbour function, so no call site wraps on its own.
- Validity: code 22 relaxed only for columns 0 and 59; the spawn rectangle may not straddle the seam (keep x0 ≤ x1, relax x1 ≤ 59 − B); the body test wrapped.
- Property tests: no body on a non-EMPTY cell across the seam; minion coverage on rings; fill results invariant under column rotation.
- Renderer: draw a seam-straddling boss in two pieces.

*Cost.* - Level v2: +1 flag byte.
- Game: +232 B (capture stack); start stack about +0.7 KB of ~2.7 KB headroom.
- Grid unchanged; hash v1 layout unchanged (the flag is level data).
- zk: +5-15% on capture-heavy levels, about +1-2% proving price.
- Touches grid, boss, player, minion, capture, level validity, every scripted bot, the level tool and editor, and both renderers. RULES_VERSION bump, new vectors, playtest and calibration.

*Conflicts.* R4.1-1; R4.1-7; R4.1-8; R4.2-2; R4.6-3; R4.6-4; R4.8-3; §4.8 capture-stack bound (CAPTURE_STACK 3,364); §5 validity codes 22, 25, 36; D7; PIN-14

**Fairness: concerns, 2 of 5; gap widens; D14 compliant.** D14 is untouched: the boss start and deflections are seeded as before, and the divergence argument holds on any board, including a wrapped one. The problem is fairness. Search simulates a wrapped core as easily as a flat one, while humans must track a boss and a trail split across the screen's left and right edges, and must learn that the first top-to-bottom cut only unrolls the field. The gap widens, as the pitch says honestly. Calibration is the bigger problem in Challenge: the first mainnet weights come from bots, which are not confused by the seam, so the level's weight would understate its difficulty for humans, and drawing it would be bad luck until a season of human journals recalibrates. Every scripted bot needs wrapped geometry, the largest tools change in this batch and a likely source of bot bugs that would skew the weights. It also touches the most consensus code of any idea here: R4.1-1, the rail, the fill, the boss, the D7 coverage proof on rings without corners, validity codes 22 and 25, and an estimated 5-15% more zk cycles on capture-heavy levels.

*Fixes.* Ship it in Training only first. Admit it to a Challenge season only after human Training data shows the reference mix's median claim on it is within the targets.json tolerance of the human median. Before any vectors, land property tests that the boss body never covers a non-EMPTY cell across the seam and that D7 coverage holds when the top and bottom rails are separate rings. Measure the zk cycles before pricing it.

**Play: ok, 3 of 5.** This is the only idea that changes the topology, and the opening is genuinely different. There are no side rails, so the player can't reach the top rail without a vertical cut. The boss can arrive from the opposite screen edge. The first full vertical cut only unrolls the field, so where and when to make it becomes a strategic choice. But most of the novelty collapses after that one cut, which turns the field back into an ordinary rectangle with the seam moved. On an open cylinder you get an unusual opening, then the normal game. The 'first cut captures only its trail' rule is a beginner trap, and it widens the human-versus-search gap, as the pitch admits. Minions on a ring with no corners just circle; the pitch sells that as variety, but a straight loop is duller than corner-turning. It breaks the genre's basic picture of the border as the frame. It is also the costliest core change in the batch: every neighbour computation, D7's coverage argument, validity codes, and every scripted bot's geometry.

*Fixes.* Pair it with horizontal obstacle bars that span the full width (maze-like bands), so each band is its own ring and needs its own unrolling cut. That keeps the topology relevant all level instead of for one cut. Training-only first, as the pitch suggests. Show the unroll rule explicitly the first time, for example by flashing both side edges when the first vertical cut closes. Measure the zk cycle increase before committing.

*Readability.* Mixed. The missing side border is a clear cue that the sides wrap. But the field fills the whole 240x240 screen, with no margin for a seam marker. A boss straddling the seam shows as two partial squares at opposite edges, and a trail crossing the seam is split across the screen. Tracking a 2-8 cell boss that leaves one edge and comes back on the other is learnable (tunnel games do it) but adds load at 4 px cells.
