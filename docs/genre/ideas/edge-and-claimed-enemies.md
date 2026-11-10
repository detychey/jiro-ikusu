# Ideas: edge and claimed-area enemies

The 11 ideas proposed from the axis of the [taxonomy](../TAXONOMY.md) *edge and claimed-area enemies*: enemies on the border or in claimed area: patrollers on the edge, enemies that eat claimed area, pursuers that follow the trail, fuses, enemies that leave the edge. Sorted by score. The [index](../IDEAS.md) lists every idea by tier and score, and [`README.md`](../README.md#the-taxonomy-and-the-ideas) explains the judges.

## Minion patrol and respawn forecast

`edge-and-claimed-enemies#1` · T0 Presentation · score 13 (core 5, fairness 5, play 3) · gap: narrows · D14: compliant

Each minion casts a faint coloured trail of the next rail cells it will walk, and a destroyed minion's respawn cell blinks before it comes back. Players see a pincer forming instead of having to work the right-hand rule out in their heads.

**Rule sketch.** Client only; the core's rules, state hash, journal and vectors are unchanged. After each tick, for every live minion the client applies right_hand_step (R4.7-2) to the current grid for the next K moves, where K = min(8, 15 / minion period), so about one second ahead. It tints those rail cells in that minion's dim colour, and the cell the minion will reach soonest wins where two forecasts overlap. The rail changes only on capture (R4.2-3), so the forecast stays exact until the next capture and is recomputed only on a minion move or a capture. For a destroyed minion, the cell it will respawn on (its spawn if that is still a rail cell, else the first rail cell in row-major order, R4.7-7) blinks during the last 15 ticks of its countdown. The forecast code is a read-only helper exported by jiro-wasm that calls the core's own right_hand_step, so the rule exists once, but the tick never calls it. Optional extra: rail cells within 3 cells of the player show the number of ticks until the next minion arrives.

**Inspired by:** Qix (1981), Qixie (2025), RetroQix (2026), Amidar (1982), Make Trax (1981). **Mechanic families:** [Border patrollers (Sparx)](../taxonomy/edge-and-claimed-enemies.md#border-patrollers-sparx), [Respawning enemies](../taxonomy/field-enemies.md#respawning-enemies), [Telegraphed attacks and readable tells](../taxonomy/field-enemies.md#telegraphed-attacks-and-readable-tells). **Touches:** presentation.

**Bot effect.** Narrows the gap. Search already simulates every minion move exactly; a human has to trace the right-hand rule around combs, mazes and islands by eye and often gets it wrong. Showing the next second of each patrol gives humans part of the lookahead the bot has. Bots and D14 are unaffected: the boss deflections, the only seeded randomness, are not shown.

**Budget.** No core RAM, no extra cost per tick in the core, and 0 zk cycles. Browser: trivial. Screen: one palette entry, up to 24 tinted cells, and about 2 cell redraws per minion move (one tail cell dropped, one head cell added).

**Variety.** Adds no new rule, but it turns minion positions from a reflex threat into something to plan around. Players can time rail walks and pick cut starts and closings against the patrols they can see coming, which matters most on maze, labyrinth, swarm and doom, where three period-1 minions are hard to trace by eye.

**Merged from:** `presentation#7`. Variants:

- Minion wakes and respawn timers: Each minion shows its next six rail cells and when it will reach each of them. A destroyed minion's respawn cell shows a shrinking ring, so the player can time leaving and rejoining the rail between patrols.

**Core engineer: feasible, 5 of 5, tier 0.** This is exact as stated. Minions read only the rail, and the rail changes only at a capture (R4.2-3). So the patrol forecast, computed with the core's pub right_hand_step, holds until the next capture. The respawn cell (R4.7-7) is chosen at respawn time from the rail as it is then, so it is also exact until the next capture. Minions only ever stand on CLAIMED rail cells, so the forecast matters for rail walks, cut starts and closings, which are exactly where minions hit. One gap: K = min(8, 15/period) gives only 8 ticks (0.53 s) at minion period 1. Seven levels run period-1 minions, including the hardest ones (storm, maze, labyrinth, ring, titan, swarm, doom). D14 is unaffected, since minions are not seeded.

*Fixes.* respawn() in core/src/minion.rs is private. Make it pub, or add a pub respawn_cell, rather than re-implementing it in the helper. That changes no behaviour, so RULES_VERSION and the vectors stay. Use K = 15/period, or cap the tint at about 45 cells, so period-1 minions also get one second.

*Cost.* Core: one visibility change, with no rule, vector or hash change. zk: 0 cycles. Browser: trivial.

**Fairness: ok, 5 of 5; gap narrows; D14 compliant.** D14 is untouched: minions are not seeded. The forecast stays exact until the next capture, because TRAIL counts as open (R4.2-3), so it shows only what a careful human could trace. The gap narrows: search simulates every minion move, while humans misread the right-hand rule around combs and mazes. The blinking respawn cell removes the respawn-at-the-first-rail-cell surprise (R4.7-7, PIN-11), which otherwise favours bots on any level where minions get stranded. That makes it a natural companion to the island and pillar levels. Calibration is unaffected. The help is uneven: largest on the period-1, 3-minion levels (maze, labyrinth, swarm, doom), which also carry the highest weights. Human scores on those draws will rise relative to the bot-derived weights.

*Fixes.* Keep the helper in the shell or wasm layer, or as a clearly non-consensus pub fn, calling right_hand_step and never on the tick path. Count the horizon in ticks and pin it per season. Ship before the testnet season whose journals will feed weights.

**Play: ok, 3 of 5.** A cheap, honest aid that clashes with nothing. Minion paths are deterministic and seed-free, so it only spares the player tracing the right-hand rule around combs, mazes and islands. That helps most on levels 10-16, with three period-1 minions. The respawn blink fixes a real readability hole: the row-major respawn cell (usually the (0,0) corner) is something bots know and humans never guess. It shares one rule implementation through a read-only helper. But it adds no new situation, only makes existing rail timing plannable, so its variety value is modest. It pairs naturally with the island and cull ideas, where respawns become a decision.

*Fixes.* Keep the respawn blink and countdown as the core of the idea, and make the patrol tint optional or limited to a short head (about 4 cells). Instead of the tick count near the player, tint only the next rail cells the player is about to walk if a minion will reach them first. Use per-minion colours only if the palette has room; one shared 'threat' tint is enough.

*Readability.* Good. Up to 24 tinted rail cells at 4x4 px in one dim palette entry, 2 cell redraws per minion move, and a blinking respawn cell all read clearly, though tints overlapping on the border can merge.

## Counter-rotating patrols

`edge-and-claimed-enemies#3` · T3 New core rule (proposed as T2) · score 12 (core 4, fairness 4, play 4) · gap: neutral · D14: compliant

Some minions now circle the field anticlockwise and at their own speed, so two patrols can close on the same stretch of rail from both sides. The player has to see the squeeze coming and cut out of it in time.

**Rule sketch.** Level bytes v2 give each of the 3 minion slots a hand byte (0 = right-hand rule R4.7-2, 1 = left-hand rule) and its own move period, which replaces the shared period at v1 offset 464. Left-hand rule: try left, then straight, then right, then back. Its orientation step mirrors R4.7-3 and PIN-06: first heading in the order N, E, S, W with open field on its left (the 4-neighbour a quarter turn anticlockwise), then failing that, behind its left (the diagonal one step to that side and one step back). A left-hand minion therefore traces the field boundary anticlockwise. The D7 coverage argument is mirror-symmetric; M1's coverage property test (core/tests/minion_coverage.rs) is rerun with the mirrored rule. Minions still never block each other, so opposite-handed minions pass through one another. Hit predicates (PIN-15) and the lifecycle (PIN-17) are unchanged. Hand is a level constant and stays out of the state hash, like the deflection key; the per-slot period is already in it. Level design: a right-hand and a left-hand minion sharing a spawn cell meet twice per lap; a slow minion (period 3) with a fast one (period 1) on the same hand gives a gap that closes and reopens.

**Inspired by:** Qixie (2025), Styx (1983), Qix (FM-7) (1983). **Mechanic families:** [Border patrollers (Sparx)](../taxonomy/edge-and-claimed-enemies.md#border-patrollers-sparx), [Escalating and timer-released patrollers (Super Sparx)](../taxonomy/edge-and-claimed-enemies.md#escalating-and-timer-released-patrollers-super-sparx). **Touches:** level-format, rules, level-data, tools-bots.

**Decisions it reopens:** D7; R4.7-2; R4.7-3; PIN-06; PIN-16.

**Bot effect.** Keeps the gap, maybe widens it slightly. Every patrol is visible and deterministic, but escaping a closing pincer needs well-timed escape cuts, and search times them perfectly. Paired with the patrol forecast, the gap should hold. Scripted bots that predict minions must learn the left-hand rule; search gets it from the core for free.

**Budget.** Level bytes +6 (hand and period per slot). RAM: 3 bytes. Cost per tick is unchanged: the same 4 rail tests per move, mirrored. zk unchanged. The state hash layout is unchanged. Screen: optionally one palette entry to tell the two hands apart.

**Variety.** Today every minion goes clockwise, all at the level's single period, so the gaps between them stay fixed and the rail has a safe direction: walk with the flow behind a slow minion. Opposite hands and mixed speeds create pincers, gaps that keep changing size, and the choice between running ahead of one patrol and cutting out before the two meet.

**Core engineer: feasible, 4 of 5, tier 3.** Mirroring R4.7-2 and PIN-06 is well defined. I traced corner (0,0): no heading has field on its left, 'behind its left' picks W (the diagonal (1,1)), and the left-hand step then goes S, so the minion starts anticlockwise as intended. D7's argument needs only some qualifying heading, not the N,E,S,W order, so it mirrors, but it still needs a mirrored coverage-test run. The state hash already writes a period byte per minion slot (hash.rs minion_bytes passes the shared period), so the v1 layout survives per-slot periods. Hand is a level constant, like the deflection key. Minions never interact, so opposite hands pass through each other. I see no pinch trap: every rail stretch has 4-adjacent field to cut into, except isolated corner cells. Greedy keeps only a margin around minions (MINION_MARGIN) and does not predict their paths, so scripted bots need no change and calibration absorbs the effect. Tier correction: per-slot periods alone are T2, but the left-hand rule is new §4 text (R4.7-2, R4.7-3, PIN-06 and PIN-16 gain a mirrored branch) plus a re-check of the D7 property, so this is the cheapest T3, not T2.

*Fixes.* Pack the three hand bits into one byte. Add validity codes: hand in {0, 1}, and per-slot period >= 1 for used slots and 0 for unused ones, which keeps the bytes canonical. Amend D7's decision text with the owner's approval.

*Cost.* Level +5 B net (3 hands and 3 periods, minus the shared period at offset 464), or +3 B packed. RAM +6 B in Minions. State hash v1 layout unchanged. Per-tick work and zk unchanged. RULES_VERSION bump, level v2 vectors, minion_coverage rerun with the mirrored rule, recalibration.

*Conflicts.* D7; R4.7-2; R4.7-3; R4.7-10; PIN-06; PIN-16; §5 level bytes v1 offset 464

**Fairness: ok, 4 of 5; gap neutral; D14 compliant.** D14 is unchanged. Minions stay seed-independent, and the boss still diverges every run.

Patrols are visible and deterministic. Before the first capture they are the same in every run, so a player can learn the pincer timings in Training. Humans read rail pincers well; search's only edge is exact timing of the escape cut. The gap is about neutral.

Calibration is easy if the bots predict minions through the core's own step. The mirrored orientation step keeps the coverage argument: any heading with field on the left traces the boundary anticlockwise. It does change the text of R4.7-2 and R4.7-3, so this is a rule change with a RULES_VERSION bump and a rerun of the coverage test, not just T2. Per-slot periods are level constants, and calibration absorbs them. Variance in the draw is low.

One edge case: a pincer that closes on a rail cell whose only open neighbours are diagonal, such as a border corner, leaves no escape cut. It is visible from far away, but it is a forced hit.

*Fixes.* - Classify as T3: R4.7 text changes, and RULES_VERSION must bump.
- Add an authoring check that no pincer can close on the player start in the first seconds of the level.
- Make scripted bots predict minions through the core's step instead of reimplementing the left-hand rule.

**Play: strong, 4 of 5.** This is a cheap change with a big effect on rail play. Today every minion runs clockwise at the level's single period, so the gaps between them are fixed, and 'walk with the flow behind a minion' is a safe default the 16 levels never challenge. Opposite hands and per-slot speeds create pincers and gaps that open and close. The player gets real choices: run ahead of one patrol, cut out before the squeeze, or wait for a slow minion to open a gap. The left-hand rule is an exact mirror of R4.7-2/R4.7-3/PIN-06, so it fits the existing rules and the D7 coverage argument carries over. It adds no per-tick cost, no zk cost and no new state field. It is still a rule change, so RULES_VERSION must be bumped even though the sketch files it as T2. The patrols stay visible and deterministic, and the player reshapes the rail with each capture, so pincer timing can't be memorised across runs. The gap stays about where it is. Scripted bots must learn the mirrored rule to stay calibratable.

*Fixes.* 1. Give each hand its own colour, or a 1-pixel heading mark inside the 4x4 cell, so a player can tell at a glance which way a minion is going. 2. Add a level-validity or playtest check that no spawn layout pinches a pincer on a stretch of rail whose cells have no 4-neighbour EMPTY to escape into, such as near corners. 3. Pair it with the T0 patrol forecast. 4. Rerun the minion_coverage property test with mixed hands before you treat D7 as unchanged.

*Readability.* Good. A minion is one 4x4 cell, and the pincer is visible all along the rail. The one real need is to tell the two hands apart: one extra palette entry, or a heading pip, does it. Two minions passing through each other overlap for a tick, which is harmless.

## Guarded islands: release or remove the guard

`edge-and-claimed-enemies#2` · T1 Level data v1 · score 12 (core 4, fairness 4, play 4) · gap: neutral · D14: compliant

A minion circles an obstacle island in the middle of the field and guards it. You can annex the island, which turns its guard loose on your own rail, or enclose it whole, which destroys the guard and sends it back later near the top-left of the board.

**Rule sketch.** Level data v1 only. New levels place one or two obstacle islands, CLAIMED blocks that do not touch the border (for example 6x6 at x 12..17 and x 42..47, y 26..31), and put minion spawns `m` on island rim cells; validity rule 38 accepts them because a rim cell is a rail cell. The boss spawn rectangle avoids the islands (rule 37), and the open area stays one 4-connected region (rule 35). Existing rules then produce three outcomes. (a) Annex: a cut from the main rail that closes on the island turns its trail CLAIMED, which joins the island's rail component C to the main rail. At the capture's orientation step (R4.7-8, R4.7-3), the sentry starts tracing the merged boundary and walks out onto the main rail. (b) Enclose: a capture that takes the whole island without the boss leaves the island's cells off the rail, so the sentry is stranded and destroyed (R4.7-8). After R ticks it respawns at the first rail cell in row-major order (R4.7-7), usually on the top border or the topmost rail. (c) Ignore: the sentry keeps circling (D7 coverage on its own component) and guards every cut that closes on or passes along the island. Knobs: island size and spacing against B (gaps narrower than B are lanes the boss cannot enter), minion period, and R. A level set could mix one border minion with two island sentries.

**Inspired by:** Space Cropper (2014), Fortix (2009), Cacoma Knight in Bizyland (1992), Mr. TNT (1983), Territory: Claim & Conquer (2026), Stix (1983), Cubixx (2009), Araña (1990), Oh Mummy (1983), Volfied (1989), Bix (2008), Xonix Blast (2012), Cosmonix (2016 (beta)), Frenzy (1984), Poison Control (2020). **Mechanic families:** [Terrain-locked enemies](../taxonomy/field-enemies.md#terrain-locked-enemies), [Orbiters](../taxonomy/field-enemies.md#orbiters), [Patterned and scripted movers](../taxonomy/field-enemies.md#patterned-and-scripted-movers), [Border patrollers (Sparx)](../taxonomy/edge-and-claimed-enemies.md#border-patrollers-sparx), [Territorial trail guardian](../taxonomy/edge-and-claimed-enemies.md#territorial-trail-guardian), [Enclosure-collected items and boxes](../taxonomy/items-and-power-ups.md#enclosure-collected-items-and-boxes), [Harmful pickups and power-downs](../taxonomy/items-and-power-ups.md#harmful-pickups-and-power-downs), [Siege weapons against turrets](../taxonomy/items-and-power-ups.md#siege-weapons-against-turrets), [Area bombs and enemy wipes](../taxonomy/items-and-power-ups.md#area-bombs-and-enemy-wipes), [Mines and mine layers](../taxonomy/field-enemies.md#mines-and-mine-layers), [Enclose hazards to neutralise them](../taxonomy/capture-rules.md#enclose-hazards-to-neutralise-them). **Touches:** level-data, tools-bots.

**Bot effect.** Keeps the gap. Search handles it the way it handles any level. Humans get a new decision that is easy to read. The one surprise is where a stranded sentry respawns (the first rail cell in row-major order), which few players would guess; the forecast idea's blinking respawn cell removes it. Scripted bots need a playtest and the levels need calibration, like any new level.

**Budget.** Nothing new. Cost is that of an existing 3-minion level: the respawn search scans up to 3,600 cells once per respawn, as today. Proving cost is within the current heaviest level (about 30M cycles). Screen: none.

**Variety.** All 16 current levels spawn their minions on the outer border, so minions only ever guard the edges. An island sentry puts a patrol in the middle of the field and adds a decision current levels lack: annex the island, which gives you a central anchor for closing cuts but releases its guard; enclose it with a large capture, which kills the guard but teleports it later; or work around it.

**Merged from:** `field-enemies#2`, `items-and-power-ups#3`, `v1-levels#8`. Variants:

- Island outposts: Small blocks float in the open field, each with a guard circling it. While an island stays alone, its guard stays home. Bridge it to your land or swallow it, and the guard comes out onto your rail.
- Caged minions on field islands: Some minions start on small obstacle islands in the open field, circling their cage. Enclose an island whole and its minion is stranded for good. Close a cut on it, or let a capture graze it, and the cage joins your rail and releases its minion onto your patrol routes.
- Guard posts: mine, blinker and circler: Three small posts each carry a guard, and the same minion rule makes them behave differently. On a 1-cell post the guard stands still, on a 2-cell post it blinks between the cells, and on a 3 x 3 post it circles. Touch a post and its guard wakes up and joins your rail; surround the post without touching it and the guard is gone for good.

**Core engineer: feasible, 4 of 5, tier 1.** I built a trial source: 6x6 islands at x 12-17 and 42-47, y 26-31, sentries on the island rims, one border minion, R = 600. It is valid. A 100-run reference-mix playtest gave 50.5% clear, 18% deaths and a median effective claim of 7,500 bp, so it can be calibrated. It is true that all 16 current levels spawn their minions on the outer border; 12-ring's central block has none. Annex works through the orientation step after a capture (R4.7-8). Enclose strands the sentry only if the capture leaves no EMPTY 8-neighbour around the island. One claim in the pitch is wrong: a sentry cannot guard 'cuts that pass along the island'. Minions walk only CLAIMED rail cells while a cutting player stands on TRAIL, and a minion hit needs a shared or swapped cell (R4.9-9 to R4.9-11). So the sentry threatens only a cut that closes on the island, and the main rail once the island is annexed. With today's respawn delays (45-90 ticks), an enclosed sentry comes back at the top-left after 3-6 s, so 'remove the guard' means little unless R is long.

*Fixes.* Correct the pitch: the sentry guards closings on the island, not passes beside it. Set R to 600 or more, or to T or more, so that enclosing pays off. Have the client show where the destroyed sentry will respawn: the first rail cell in row-major order (see the minion-forecast idea).

*Cost.* Code: none. Level bytes v1, a new level id, a playtest and calibration. zk cycles and screen cost like an existing 3-minion level. It takes one of the season's 16 slots.

**Fairness: ok, 4 of 5; gap neutral; D14 compliant.** D14 holds: the boss is seeded, and island sentries are static information, like border minions. The gap stays about the same: annex, enclose or ignore is a readable choice, and search gains nothing special from it. The one hidden rule is the respawn at the first rail cell in row-major order (R4.7-7), usually the top-left border, where a sentry can appear on a player standing there (PIN-11). Bots know this and humans won't. Scripted bots can play it: greedy already keeps a 3-cell margin from minions and handles mid-field obstacles, so the level calibrates like any other. Watch the 'gaps narrower than B' knob. A lane the boss cannot enter is a seed-independent area where cutting is safe from the boss: the kind of learnable safe zone D14 removed from the open field. It is acceptable only where a minion patrols it.

*Fixes.* Ship with the respawn-cell forecast ([edge-and-claimed-enemies#1](#minion-patrol-and-respawn-forecast)), or use R >= T+1 on these levels. Keep gaps between islands, and between islands and the border, at least B wide, or patrolled by a minion. Playtest and calibrate as usual.

**Play: strong, 4 of 5.** This is distinct from all 16 levels. Every minion spawns on the outer border, and ring's central block has no guard. The rules support it as sketched. An annexing cut joins the island's rail component to the main boundary, and the orientation step (R4.7-8) sends the sentry out along the merged loop. A whole-island enclosure takes every rim cell off the rail, so the sentry is destroyed. It creates a clear three-way choice: annex for a central anchor but release a guard onto your rail, enclose with a long, exposed cut to kill it, or work around it. Timing a close onto an island against a sentry that laps a 20-cell rim every 20 ticks at period 1 is a good new rail-timing situation. It fits the rules' feel perfectly: T1, data only. One inaccuracy: the sentry walks CLAIMED cells and cannot touch a trail, so it only threatens cuts that close on the island or a player walking its rim, not cuts that pass alongside. The row-major respawn (usually the (0,0) corner) is fixed and learnable, though surprising at first. It overlaps with the pillar idea's mines and its 'guarded posts' variant, and the two could share a level set.

*Fixes.* Correct the 'passes along' claim. With R >= T an enclosure is permanent, which makes the enclose branch a meaningful reward, so consider it for one level. Keep island gaps of at least B + 1 on at least one side, so the boss is not walled out of the island's surroundings. Pair it with the minion respawn blink ([edge-and-claimed-enemies#1](#minion-patrol-and-respawn-forecast)) so the teleport reads.

*Readability.* Very good. A 6x6 island is 24x24 px with a 1-cell minion circling its rim, which reads at a glance and needs no new art.

## Growing rail serpent

`edge-and-claimed-enemies#8` · T3 New core rule · score 11 (core 3, fairness 4, play 4) · gap: neutral · D14: compliant

A minion grows into a serpent whose body walls off a stretch of rail. To get past it you cut a short bypass through the field and close behind it, which strands it and cuts it back to a single cell.

**Rule sketch.** Level bytes v2 add, per minion slot, a maximum length Kmax (1 = classic minion, up to 12) and a growth period G in ticks. Slot state gains len: u8 and a ring of the last Kmax - 1 cells it left (2 bytes each). At step 5, a moving serpent pushes the cell it leaves onto the ring. Afterwards, if tick % G == 0, len = min(len + 1, Kmax). The body is the head plus the len - 1 newest ring cells. New hits: at step 3, a player step onto a body cell is refused and is a hit, like stepping onto the boss's body (R4.9-3), tested against the body as it stood after the previous tick. At step 5, the player's last cell or any cell entered this tick that equals a body cell is a hit, in addition to the share, swap and pass checks with the head (PIN-15). A serpent stranded by a capture is destroyed (R4.7-8) and respawns with len 1 and an empty ring. Every serpent also drops back to len 1 when the player loses a life. Ring cells that a capture took off the rail are removed from the ring at that capture.

**Inspired by:** Styx (1983). **Mechanic families:** [Growing border enemy](../taxonomy/edge-and-claimed-enemies.md#growing-border-enemy), [Border patrollers (Sparx)](../taxonomy/edge-and-claimed-enemies.md#border-patrollers-sparx). **Touches:** rules, level-format, state-hash, presentation, level-data, tools-bots.

**Decisions it reopens:** R4.3-4; R4.9-1; R4.9-3; PIN-15; PIN-17.

**Bot effect.** Keeps the gap. The body is drawn cell by cell and grows on a clock that is part of the level data, so humans can read the threat fully; search exploits the bypass captures exactly, as it already exploits every capture. Scripted bots need a bypass-cut routine to stay calibratable.

**Budget.** State +69 bytes (3 slots x 11 ring cells x 2 bytes + len); state hash v2 grows to about 1,017 bytes. Per tick: at most 33 body cells x 3 player cells compared, so roughly 100-300 cycles, about 1-3% of an average tick of the heaviest level (about 11k cycles). Level +6 bytes. Screen: a body colour, 2 redraws per serpent move (new head, dropped tail).

**Variety.** Today a minion is a point that you dodge or outrun. A serpent blocks the rail for real, and the player must solve the block with a small cut, which also captures the strip under the serpent and strands it. Long levels get a reason to keep cutting near the border, and trapping an enemy by capture becomes a deliberate move.

**Core engineer: feasible with changes, 3 of 5, tier 3.** The core idea is sound. The body sits on rail cells, and a bypass cut one row inside the rail leaves the old rail cells without open neighbours, so R4.7-8 strands the head. Resetting len on a lost life prevents two soft-locks: a respawn at a cut start inside the body, and a player pinned in a corner cell with no 4-adjacent EMPTY between two body cells. Issues:
(1) Removing off-rail cells from the middle of the ring, while the body is the head plus the len-1 newest ring cells, pulls older, non-adjacent cells into the body and makes it discontinuous.
(2) When the head cannot move (PIN-18) or turns back through its own body, len can exceed the number of cells in the ring, and duplicates appear. The body needs a definition for that case.
(3) Hit checks cost at most 33 body cells x 3 player cells at steps 3 and 5, about 200-400 cycles, 2-4% of zk with three Kmax = 12 serpents.
Greedy and CaptureBot route along the rail and must treat body cells as impassable, not only as a margin around the head.

*Fixes.* At a capture, find the newest ring cell that is off the rail, drop it and every older cell, and set len to 1 + the cells kept, so the body stays a contiguous path. Define the body as the head plus the min(len - 1, ring count) newest cells. Cap Kmax at 12 so the ring is a fixed \[Pos; 11\]. Teach the scripted bots that body cells block the rail.

*Cost.* State +69 B (3 slots x (11 x 2 B ring + 1 B len)). State hash v2 = 1,017 B. Level +6 B (Kmax and G per slot). zk +2-4% worst case. RULES_VERSION bump, level v2 and hash v2 vectors, bots taught body blocking, recalibration.

*Conflicts.* R4.3-4; R4.7-7; R4.7-8 (ring cleanup at capture); R4.9-1; R4.9-3; PIN-15; PIN-17; PIN-18; §6.4 state hash v1

**Fairness: ok, 4 of 5; gap neutral; D14 compliant.** D14 is unchanged. Everything about the serpent is visible: its body, its growth clock (level data) and its stranding. The counter is a short cut one cell deep along the rail, which keeps the player close to the rail with little exposure to the boss, and that suits humans. Search will strand serpents optimally, as it already exploits every capture. The gap is about neutral.

Calibration needs a bypass-cut routine in greedy, because a body can block walking along the rail for good. Without it, scripted clear rates collapse and the weights inflate in search's favour.

Rule gaps:

- Removing ring cells that a capture took off the rail leaves len out of step with the ring.
- A body longer than a small rail loop can cover the whole loop.

The reset to len 1 on a lost life correctly stops a respawn onto a body cell. The cost fits the budget: state hash v2 of about 1,017 B and 69 B more RAM.

*Fixes.* - After a capture removes ring cells, set len = min(len, 1 + ring entries).
- Bound Kmax at authoring time against the rail loops it can cover, or document that a fully covered loop is intended.
- Add a bypass-cut policy to the scripted bots before any serpent level enters a Challenge season.

**Play: strong, 4 of 5.** This turns a point threat into area denial on the rail. That changes which anchors exist from moment to moment: you can't close a cut onto a body cell, and following behind a minion stops being safe. It forces the small bypass cut, which is also how you strand the serpent. Stranding by capture already exists (R4.7-8), but today it is a side effect. With serpents it becomes the main answer to an enemy. Growth on a level clock adds a slow time pressure, because the rail clogs as the level goes on. This fits Jiro well: body cells behave like the boss's body (R4.9-3), and the length resets on a lost life and on respawn, which handles the cut-start return. The cost is moderate: T3, state hash v2 and +69 B of state. Per-tick cost is small. One naming problem: level 06 is already called 'serpent', which will confuse players and docs.

*Fixes.* 1. Rename the enemy so it doesn't collide with level 06 'serpent', and keep D13 in mind, so avoid another game's title as the name. 2. Draw the head and body in different colours so the dangerous leading cell reads first. 3. Check the edge case where a serpent at a rail dead end or corner turns back into its own body; that turn should be legal and draw cleanly. 4. Consider capping Kmax at about 8 on early levels so the bypass stays a short cut. 5. Scripted bots need a bypass-and-strand routine before calibration.

*Readability.* Very good. A snake-like body on the rail, made of 4x4 cells in its own colour, is easy to read, and each move needs only 2 cell redraws (new head, dropped tail). It needs one or two palette entries for head and body.

## Land bouncer on claimed ground

`edge-and-claimed-enemies#9` · T3 New core rule · score 11 (core 4, fairness 4, play 3) · gap: neutral · D14: compliant

A small enemy bounces around inside your claimed land and bites any part of your line that touches it. At first it runs along the thin border; as your territory grows, it gets more room to roam.

**Rule sketch.** Level bytes v2 add up to 2 bouncers, each with a spawn cell, which must be CLAIMED and not the player start or a minion spawn (new validity code), and a move period. Seed byte 4 sets their directions: bits 2 and 3 give bouncer 0's vx and vy, bits 4 and 5 bouncer 1's, from the seed material that is still free. A bouncer is a 1x1 body moving by R4.6-3 with B = 1, one axis at a time, with the solid set inverted: EMPTY, TRAIL and cells outside the grid block it, and a blocked axis inverts its velocity. If the blocked cell is TRAIL, the player is hit. It runs at a new step 5b, after the minions, and also hits the player by the minions' share, swap and pass predicates, using its (from, to). A capture only ever turns cells CLAIMED, and a commit or a lost life only turns TRAIL back to EMPTY, so the bouncer is always on CLAIMED and needs no stranding rule. It has no deflections: the boss already makes every run different (D14), and the bouncer's path depends on the claimed shape, which differs from game to game. On a one-cell-thick border it slides along the line; at a corner it turns or bounces back, depending on its vertical phase.

**Inspired by:** Xonix (1984), Zolyx (1987), AirXonix (2000), Xonix (PICO-8) (2024). **Mechanic families:** [Land enemies on claimed ground](../taxonomy/edge-and-claimed-enemies.md#land-enemies-on-claimed-ground), [Edges that become dangerous](../taxonomy/edge-and-claimed-enemies.md#edges-that-become-dangerous), [Safe border and claimed ground](../taxonomy/edge-and-claimed-enemies.md#safe-border-and-claimed-ground). **Touches:** rules, level-format, state-hash, presentation, level-data, tools-bots.

**Decisions it reopens:** R4.4-5; R4.9-1; R4.6-3; PIN-15.

**Bot effect.** Keeps the gap. The bouncer is visible and has no seeded randomness, so its next few moves are as readable as the boss's are without deflections. Adding the boss's deflections would widen the gap, which is why the sketch leaves them out. Search will exploit cut timing around it exactly; humans can read its diagonal path inside large claimed blocks. The edge-nibbler policy (safe cuts that hug the border) gets much worse, which is healthy.

**Budget.** State about 10 bytes (2 x presence, x, y, vx, vy); hash v2. Level about 7 bytes. Per move: 2 single-cell tests, so zk under 1%. Screen: one palette entry, 2 redraws per move.

**Variety.** Claimed land stops being completely safe. The danger moves with the shape of your territory: thin border strips make it a fast patroller, while a big claimed block gives it room to wander far from the rail. Players can feed it a block far from where they work, avoid hugging the border with long cuts, and pick cut starts it is not about to cross. No current level threatens the ends of a cut from the claimed side.

**Core engineer: feasible with changes, 4 of 5, tier 3.** The invariant holds. A trail is laid only on EMPTY, a capture only turns EMPTY or TRAIL into CLAIMED, and a commit or lost life only turns TRAIL back into EMPTY, so a bouncer on CLAIMED stays on CLAIMED and needs no stranding rule. I traced the border case. On the 1-thick bottom border it moves one cell along x per move and flips vy each move. At a corner it either climbs the side border or reverses, depending on vy's phase, as stated. One gap: R4.6-3 moves one axis and then the other, so a single move can be diagonal. PIN-15's predicates assume one a-to-b step, so a bouncer that passes through the player's rail cell on its x sub-move and leaves it on y matches neither share, swap nor pass, and slips through the player unhurt. A design trap: a bouncer spawned in a one-cell obstacle never moves and bites every trail that passes beside it. With no seeded draws, its path before the first capture is one of 4 (vx, vy) loops on the level's fixed geometry, which humans can read. The seeded boss still keeps every game distinct, so D14 holds. Search will time cuts around it exactly: a mild gap widening.

*Fixes.* Run the hit predicates on each axis sub-move, treating the intermediate cell like the fast cut's pass cell, or move the bouncer along one axis per move. Add validity: the spawn's 4-connected CLAIMED component has at least 2 cells. Register byte 4 bits 2-5 in §6.4, since other proposals claim bits 2-3.

*Cost.* State about 10 B (2 x presence, x, y, vx, vy). State hash v2 about 958 B. Level about 7 B. zk under 1% (2 single-cell tests per move). A new step 5b in R4.4-5. RULES_VERSION bump, level v2 and hash v2 vectors, a bouncer margin in greedy, recalibration.

*Conflicts.* R4.4-5; R4.6-3 (reused with inverted solids); R4.9-1; PIN-15; §6.4 seed byte 4 bits 2-5

**Fairness: ok, 4 of 5; gap neutral; D14 compliant.** D14 still rests on the boss. The bouncer has only 4 seeded directions and no deflections. Until the first capture its path is one of 4 per bouncer and can be learned; after that it is a deterministic function of the claimed shape the player built. That is acceptable: it adds a visible threat, not a safe zone.

Readability:

- In claimed land, a 1x1 bouncer moving diagonally is about as readable as an undeflected boss over a few moves.
- On a one-cell-thick border it acts like a minion whose turn at a corner depends on its vertical phase. That is visible but subtle.

Its TRAIL hits come only from its own edge tests, so they are local to the ends of a cut. The gap is about neutral: hugging the border gets worse, which hurts the weakest scripted policy (edge-nibbler) more than skilled humans.

It is calibratable if greedy simulates the bouncer for the length of each planned cut, reusing the core's step.

*Fixes.* - Allocate seed bits jointly: twin bosses and island start also claim bits 2-3 of seed byte 4.
- Have scripted bots test the ends of planned cuts against the bouncer's next moves through the core.
- Use a move period of at least 2 in Challenge sets, so that its phase at corners stays readable.

**Play: ok, 3 of 5.** This is new: no current level threatens a cut from the claimed side, and it adds a strategic lever, which is to shape captures so the bouncer is 'penned' in a big block far from where you work. Two problems hold it back. (1) It never goes away: there is no stranding or removal rule. It also hits the player on the rail by the share/swap/pass rules, and it is on the rail every time it reaches the open-field boundary to bounce. So it eats into the only safe ground and overlaps the minions' job, without counterplay beyond avoiding it. (2) On a one-cell border its corner behaviour, turning or bouncing back, depends on a velocity phase the player can't see. Because the vertical test fails on every move along a border strip, vy flips each move, so a player can't predict a corner until they see it. In big blocks it reads like a small boss, which is fine. The pitch also says it gets 'more room to roam' as territory grows. That makes it less dangerous as you play well, which is satisfying but means it fades late in a level.

*Fixes.* Make it bite only TRAIL, as the boss does, and drop the share/swap/pass hits on the player. The rail then stays safe ground, its job becomes 'threatens cut starts and cuts hugging claimed land', and it stops overlapping the minions. Optionally show its velocity with a 1-pixel facing mark so corner turns are readable. Seed its spawn among a few claimed cells so its early path isn't fixed per level.

*Readability.* A single 4x4 cell bouncing diagonally is easy to follow inside a claimed block, and moves cost 2 redraws. It needs strong contrast against the claimed fill, especially if a T0 image reveal draws over claimed land. Its phase-dependent corner behaviour on a 1-cell border is the hard part to read.

## Shield vault over a patroller

`edge-and-claimed-enemies#11` · T3 New core rule · score 11 (core 4, fairness 4, play 3) · gap: neutral · D14: compliant

On the rail, hold fast-cut while a minion is right in front of you and you leap over it, spending your shield charge. The one charge is now a choice between protecting a cut and vaulting out of a rail trap.

**Rule sketch.** At step 3, the player vaults when all of these hold: it is on the rail and not cutting; A is held and B is not (B wins, R4.5-7); shield >= 1; the resolved direction d is set; the cell P0 + d holds a live minion at the start of step 3; P0 + d and P0 + 2d are both rail cells; and no minion stands on P0 + 2d. Then P1 = P0 + d, P2 = P0 + 2d, shield -= 1, and the minion hit checks (PIN-15) are skipped for this tick. When the conditions don't hold, A on the rail does nothing, as today (R4.5-6). Level bytes v2 add a shield-charges field (1..3, default 1, the value D6 fixes today), so vault levels can grant more than one. A uses an existing journal bit, so neither the journal nor D8's key mapping changes. B's shield (R4.9-15) works as before and draws on the same charges.

**Inspired by:** Zoo Keeper (1983), Space Cropper (2014), Territory Raider (2026). **Mechanic families:** [Border patrollers (Sparx)](../taxonomy/edge-and-claimed-enemies.md#border-patrollers-sparx), [Safe border and claimed ground](../taxonomy/edge-and-claimed-enemies.md#safe-border-and-claimed-ground). **Touches:** rules, level-format, presentation, tools-bots.

**Decisions it reopens:** D6; R4.5-6; PIN-04; R4.9-8; PIN-01.

**Bot effect.** Keeps the gap, perhaps narrows it slightly. The vault is an escape a human can use after misjudging a pincer on the rail, a situation search rarely gets into. Search will still spend the charge optimally, so its share of the gain is small. No new information or randomness.

**Budget.** No new state: the shield count is already in the state hash v1. Level +1 byte. Per tick: a few cell checks when A is held on the rail. zk negligible. Screen: an optional 2-cell hop effect.

**Variety.** Today the shield only absorbs one hit while B is held during a cut. The vault gives the charge a second, attacking use and a real trade-off, and it lets the player get through head-on against period-1 minions that can't be outrun on the rail (storm, maze, titan). The rail becomes a place for active manoeuvres, not just waiting.

**Core engineer: feasible with changes, 4 of 5, tier 3.** It needs no new state and no journal change. A is bit 4 and does nothing on the rail today (R4.5-6), and the shield count is already in state hash v1. P0, P0+d and P0+2d are all 4-adjacent rail cells, so the vault stays in the player's rail component, and the boss is never on the rail. Two gaps:
(1) Skipping every minion hit check for the tick also dodges a second minion that steps onto P2 or swaps with P1 at step 5: an unintended free escape.
(2) Triggering on 'A held' means a player or bot (bold, committer) still holding A after a fast cut fires the vault automatically whenever a minion is right ahead, spending the charge meant for the shield.
If a same-direction minion lands on P2, a player who stays put is hit by share on the next tick. That is correct, but worth stating in the rule.
Player::step needs the minions' cells, so its signature changes. A field of 1 to 3 shield charges needs the owner to amend D6.

*Fixes.* Exclude only the vaulted minion's slot from the step-5 predicates, not all minions. Trigger on A's press edge (A in this tick's mask and not in the previous mask, which Game already keeps in `mask`, so no new state) rather than on A held. Optionally add a per-level vault-enable bit so that v1 levels keep their calibration.

*Cost.* State 0 (hash v1 unchanged). Level +1 B for shield charges, plus an optional enable bit. A few cell and minion-position checks on ticks where A is pressed on the rail. zk negligible. RULES_VERSION bump (R4.5-6, PIN-04, D6), vectors, scripted bots taught to vault (search gets it for free), recalibration of every level if the vault is not gated per level.

*Conflicts.* D6; R4.5-6; R4.5-7; PIN-04; PIN-15 / R4.9-8; R4.9-15; PIN-01 (shield charges at start)

**Fairness: ok, 4 of 5; gap neutral; D14 compliant.** D14 is unaffected: there is no new randomness and no hidden information. Scripted bots can use the vault easily. The gap is about neutral. Three issues:

1. **The motivation misreads the rules.** R4.9-15 spends a charge on any hit while B is held, including on the rail. A player can therefore already survive a head-on minion once and let it pass. The vault adds a 2-cell move, not survival.
2. **The trigger depends on tick parity.** The vault fires only if the minion is on P0+d at the start of step 3. Walking head-on into a period-1 minion with A held vaults when the distance is odd and is hit when it is even. That is a one-tick window (67 ms): search always hits it, humans about half the time.
3. **Too many hits are skipped.** Skipping every minion hit on the vault tick also forgives a second minion's share or swap.

On the other side, 1 to 3 charges per level are forgiveness, which helps humans more than search.

*Fixes.* - Widen the trigger: also vault on a minion at P0+2d, or buffer the press for one tick, so the vault does not depend on parity.
- Skip only the vaulted minion's hit.
- Correct the pitch: B already absorbs a hit on the rail.

**Play: ok, 3 of 5.** This gives the single shield charge a second use and a real trade-off: save it for a cut, or spend it to escape a rail trap. It also uses A on the rail, which today does nothing (R4.5-6), so it adds no input, journal or state. It is cheap and readable, and it narrows the gap a little because it rescues human misreads. On its own the variety is modest. It is an emergency button rather than a new situation, and it lowers rail tension more than it creates new play. It pairs well with counter-rotating patrols (#3), where pincers make the vault meaningful. Rough edges: players who hold A by habit as they near a cut start will vault by accident and lose the charge they meant for a cut. The sketch skips every minion's hit check on the vault tick, and a minion moving the same way can step onto P0+2d at step 5, then hit you on the next tick. Both behaviours are predictable, but they will feel unfair.

*Fixes.* 1. Trigger the vault on A's press edge (A released on the previous tick, held now), the way press_tick already tracks B, so holding A never spends the charge. 2. Skip hit checks only for the vaulted minion, and refuse the vault when another minion's next rail move lands on P0+2d. 3. Show remaining charges on the HUD. 4. Ship it alongside counter-rotating patrols or pincer-heavy layouts, where it matters.

*Readability.* Clear: a 2-cell hop over a single-cell minion, with an optional flash on the skipped cell. The shield count needs a small HUD element.

## Zone guardian

`edge-and-claimed-enemies#13` · T3 New core rule · score 11 (core 3, fairness 4, play 4) · gap: widens · D14: compliant

A sleeping guardian watches a marked part of the field. Cut into its zone and it wakes and goes for your line, but capture the cell it sleeps on from outside the zone and it is gone for the rest of the level.

**Rule sketch.** Level bytes v2 add up to 2 guardians, each with a zone rectangle (x0, y0, x1, y1), a home cell inside it that is EMPTY at level start (new validity code), and a move period. State per guardian: x, y and a status (asleep, awake or gone). Wake: at the end of step 3, if the player is cutting and its cell lies inside the zone. A new step 5c moves each awake guardian on its period ticks, greedily toward the player's cell: one step along the axis with the larger distance (x on a tie); if that cell is CLAIMED or under the boss's body, it tries the other axis, and if both are blocked it stays. Stepping onto TRAIL, which includes the player's cell during a cut, sets the hit flag. The boss ignores guardians. When a cut ends by commit or a lost life, awake guardians go back home and fall asleep. At a capture, a guardian whose cell or home becomes CLAIMED is gone for the level; otherwise it goes home to sleep. So enclosing the home from outside the zone defeats it without waking it. There is no seeded randomness; the guardian reacts only to the player.

**Inspired by:** Cubixx (2009), Territory: Claim & Conquer (2026), Glowfield (2026), Fly Trap: Territory Game (2026). **Mechanic families:** [Territorial trail guardian](../taxonomy/edge-and-claimed-enemies.md#territorial-trail-guardian), [Trail hunters](../taxonomy/field-enemies.md#trail-hunters). **Touches:** rules, level-format, state-hash, presentation, level-data, tools-bots.

**Decisions it reopens:** R4.4-5; R4.8-1; R4.9-1.

**Bot effect.** Widens the gap slightly. The guardian's homing is a deterministic function of the player's cell, so search can lure it and route around it exactly. Humans understand 'it chases you in its zone', but can't predict its blocked-axis choices tick by tick. Drawing the zones (T0) helps. D14 is unaffected.

**Budget.** State about 6 bytes (2 x x, y, status); hash v2. Level about 12 bytes. Per tick: at most 2 greedy steps with 2 cell tests and a boss-body bounds check each; zk under 1%. Screen: one palette entry for zone-tinted EMPTY cells, redrawn when they change, plus 2 redraws per guardian move.

**Variety.** The field gets regions that each carry a different price: dash through with fast cut, cut wide around the zone, or make a large enclosing capture that kills the guardian for the rest of the level. Current levels vary the field only by obstacle shape; this adds threat zones that the player can see and remove by capturing.

**Core engineer: feasible with changes, 3 of 5, tier 3.** It is cheap and deterministic, and defeat by capture fits R4.8 cleanly: a guardian whose cell or home becomes CLAIMED is gone. The contact rules have holes:
(1) The rule does not say what happens when the player steps at step 3 onto a guardian's EMPTY cell, awake or asleep at home. That cell becomes TRAIL under the guardian, whose next greedy step then sees distance 0 on both axes and has no defined move.
(2) Under 'stepping onto TRAIL sets the hit flag', a hit the shield absorbs (R4.9-15) leaves the guardian standing on the trail, and it hits again on its next move, so the shield is worthless against it.
(3) Waking tests only the player's cell at the end of step 3, so a fast cut can cross a zone corner without waking it.
(4) After a lost life, a guardian sent home may land under the boss's body. That is harmless, but should be defined.
Greedy homing (larger axis first, x on a tie, the other axis if blocked) gets stuck behind CLAIMED corners. Search will lure it there exactly, and humans only approximately, so the gap widens slightly, as the idea says. No seeded randomness, so D14 is unaffected.

*Fixes.* Apply PIN-15's share, swap and pass predicates to guardians, with a and b taken around step 5c. Add that a player entering a guardian's cell at step 3 is hit. A guardian whose chosen cell is TRAIL hits the player and stays where it is, like the boss's bounce. Wake if any of P1..Pn lies in the zone. An axis with distance 0 is never the chosen step.

*Cost.* State about 6 B (2 x x, y, status). State hash v2 about 954 B. Level about 14 B (2 x zone rectangle 4 B, home 2 B, period 1 B). Per tick at most 2 greedy steps, each with 2 cell tests and a boss-body bounds check: zk under 1%. A new step 5c. RULES_VERSION bump, vectors, zone-aware greedy, recalibration.

*Conflicts.* R4.4-5; R4.8-1 (capture removes guardians); R4.9-1; PIN-15; R4.9-15 (shield vs repeated hits); R4.9-17

**Fairness: ok, 4 of 5; gap widens; D14 compliant.** D14 is unchanged: the guardian has no randomness, and the boss still diverges. Its zone, home and wake rule are level constants, so the threat is fixed and can be learned in Training. A capture removes it for good, which humans plan well.

Search gains in two ways:

- it lures the guardian exactly;
- it enters zones that humans will avoid, at a cost in claim for the humans.

The gap therefore widens mildly.

The zone tint is required, not optional, in Challenge: an undrawn zone is hidden information. The pursuit (step along the larger distance) is intuitive. At period 1 against a fast cut, though, the hit comes when the guardian reaches any trail cell, not just the tip, and humans misjudge that.

Calibration is easy: bots avoid zones, or add the guardian's reach to their margin. Variance is level-constant and calibratable.

*Fixes.* - Make the zone tint and the home marker a mandatory part of the Challenge client.
- Require a guardian move period of at least 2 in Challenge sets.
- State in the rule text that an awake guardian keeps chasing after the player leaves its zone mid-cut.

**Play: strong, 4 of 5.** This adds threat geography to the open field, which today varies only by obstacle shape. A tinted zone is a visible price: go around it, dash through with A before the guardian reaches your trail, or arrange the boss to be elsewhere and enclose the home from outside, removing it for the rest of the level. That last option is the kind of strategic goal the capture loop handles well, because it rewards reading which side of a cut the boss is on. The guardian is also the first enemy that reacts to the player, which is a real new situation, not just more difficulty. It is fully deterministic and keyed to the player, so D14 is unaffected. Humans read 'it chases you while you're cutting in its zone'; search will exploit its greedy blocked-axis choices, a slight widening. It fits the rules: it hits TRAIL as the boss does, the boss ignores it, and it resets when a cut ends. A small hole: wake is tested on the player's final cell at step 3, so the intermediate cell of a fast cut can clip a zone corner without waking it.

*Fixes.* 1. Test wake on every cell entered at step 3 (P1..Pn), not only the final one. 2. Make the guardian visible on top of the boss body (or bar homes within the boss spawn rectangle's reach), so a sleeping guardian is never drawn under the boss. 3. Give the guardian a short wake delay (a few ticks), so a human gets one look before it moves. 4. Tint the zone border, not every cell, if palette or redraw cost matters.

*Readability.* Good. A rectangular tint on EMPTY cells is one palette entry and reads clearly at 4x4 px. The guardian is a single cell with 2 redraws per move. Trail cells inside the zone must override the tint so the cut stays visible.

## Firing lanes that cut the trail

`edge-and-claimed-enemies#12` · T3 New core rule · score 10 (core 3, fairness 3, play 4) · gap: widens · D14: compliant

Some patrollers fire bolts straight into the field while you are cutting, on a rhythm you can learn within the level. A line crossing in front of a sentry has to dodge its lane.

**Rule sketch.** Level bytes v2 add, per minion slot, a sentry flag, a fire period F (ticks) and a bolt period. Seed bytes 13, 14 and 15 give each slot a phase, phase_i = byte mod F; those bytes are still free seed material. At step 5, after a sentry's move, it fires if the player is cutting, (tick + phase_i) % F == 0, and its bolt slot is empty. The bolt is created on the cell on the minion's right, the 4-neighbour a quarter turn clockwise from its heading, which the patrol keeps facing the field (R4.7-3), and flies in that direction. It is created only if that cell is EMPTY or TRAIL, and a TRAIL cell there hits at once. A new step 5b moves each bolt (presence, x, y, direction) one cell straight on its period ticks. Entering TRAIL, which includes the player's cell during a cut, sets the hit flag and removes the bolt; entering CLAIMED or a cell of the boss's body removes it. All bolts vanish when the cut ends (capture, commit, lost life), so they only threaten a cut in progress. Presentation: a sentry blinks during the 10 ticks before it fires.

**Inspired by:** Fortix (2009), Space Cropper (2014), Kritter Krawler (2009), TERR1T0RY (2026), Starcutter: Space Arcade (2026), Cosmic Bugs (2004), Cosmo Bots (2004). **Mechanic families:** [Turrets firing at the drawing player](../taxonomy/field-enemies.md#turrets-firing-at-the-drawing-player), [Beam and shockwave attacks](../taxonomy/field-enemies.md#beam-and-shockwave-attacks), [Telegraphed attacks and readable tells](../taxonomy/field-enemies.md#telegraphed-attacks-and-readable-tells), [Shooting enemies and bullet patterns](../taxonomy/field-enemies.md#shooting-enemies-and-bullet-patterns), [Border shooters](../taxonomy/edge-and-claimed-enemies.md#border-shooters), [Border patrollers (Sparx)](../taxonomy/edge-and-claimed-enemies.md#border-patrollers-sparx). **Touches:** rules, level-format, level-data, presentation, tools-bots, state-hash.

**Decisions it reopens:** R4.4-5; R4.9-1; §5 validity; §6.4 seed bytes 17-20; R4.7-2.

**Bot effect.** Keeps the gap if the warning blink ships, and widens it slightly without it. The firing phase is seeded once per level (D14-friendly), but the rhythm is fixed and visible within a game, so humans can learn it in a few shots. Tracking up to 3 bolts plus the boss is more load for a human than for search.

**Budget.** State 12 bytes (3 bolts x presence, x, y, direction); hash v2. Level about 9 bytes. Per tick: at most 3 single-cell bolt tests; zk under 1%. Screen: at most 3 bolt cells, 2 redraws per bolt move, one palette entry, and a blink on the sentry.

**Variety.** Minions now threaten cuts from a distance, not only the rail under them. Cuts should run parallel to the sentries' lanes or cross behind them, and the place and moment a cut crosses the field become part of the plan. It also gives a reason to strand a sentry with a capture, which silences it for R ticks.

**Merged from:** `field-enemies#10`. Variants:

- Beam turrets: Some obstacle blocks hold turrets. Each one charges on a visible cycle, then fires along its row and column, cutting any open trail it reaches before claimed land. Cross between shots, cut in the shade of your own land, or enclose the turret to silence it.

**Core engineer: feasible with changes, 3 of 5, tier 3.** Determinism is fine. The phases come from seed bytes 13 to 15 (free under §6.4) and are fixed for the level, so D14 holds, and the cost is tiny. The collision rules have gaps:
(1) A player can walk through a bolt. Bolts only test the cell they ENTER at step 5b. A player who steps at step 3 onto the EMPTY cell holding a bolt makes it TRAIL under the bolt, and the bolt then moves off into the next cell without ever 'entering TRAIL'. A fast-cut pass through the bolt's cell escapes the same way. The swap case is covered, because P0 is TRAIL.
(2) The boss moves at step 4 and can cover a bolt's EMPTY cell. Nothing says what a bolt under the boss's body does: it should be removed. The same applies to a bolt created on a cell under the boss.
(3) Validity needs F ≥ 1 and bolt period ≥ 1 for sentry slots, since phase = byte mod F.
(4) 'The cell on the minion's right faces the field' fails at corner cells (border corners touch the field only diagonally), but 'created only if EMPTY or TRAIL' already covers that.
(5) Bot gap: the rhythm is learnable, but tracking up to 3 bolts plus the boss is attention load humans pay and search does not. Greedy needs a lane-aware planner, or calibration underrates sentry levels. Expect a slight widening even with the blink.

*Fixes.* At step 5b, BEFORE moving, a bolt whose own cell is TRAIL hits and is removed (this covers stepping onto it and fast-cut passes), and a bolt whose cell is under the boss's body is removed. Never create a bolt on a boss cell. Validity: sentry slots need F ≥ 1 and bolt period ≥ 1; non-sentry slots have all zero fields (canonical bytes). Give greedy a rule against starting cuts across an active sentry's lane before calibration.

*Cost.* State +12 B (3 bolts × presence, x, y, dir): hash v2 (960 B), Game +12 B (~+40 B of `start` stack). Level v2 ~9 B. Per tick ≤3 single-cell bolt tests; zk \<1%. Screen: ≤3 bolt cells, 2 redraws per bolt move, one palette entry, a 10-tick blink (the client knows the seed). RULES_VERSION bump, vectors, bots, calibration.

*Conflicts.* R4.4-5; R4.3-1; R4.9-1; R4.6-1; §6.4 unused seed bytes; §5 validity; state hash v1

**Fairness: concerns, 3 of 5; gap widens; D14 compliant.** The firing phase is seeded from free seed bytes 13 to 15 and the boss still diverges, so D14 holds: the rhythm can be learned within a game, not across runs. Bolts add a third stream of threats. Search tracks it exactly, while humans juggle the boss, the minions and up to 3 bolts, so the gap widens slightly even with the blink. The spawn rule 'a TRAIL cell there hits at once' gives zero travel time when the trail hugs the rail beside a sentry. That is exactly the 1-cell-deep strip that greedy exempts from MINION_MARGIN, and the 10-tick blink, which is presentation only, is the sole warning. The scripted bots need lane awareness. Without it they get hit often, and calibration over-weights sentry levels compared with humans who learn the rhythm, adding variance to the draw.

*Fixes.* Give every bolt travel time: create it one cell further out, or skip the shot when the adjacent cell is TRAIL. Write the windup into the rule (a fixed telegraph of 10 ticks or more), so the replay and every target show the same warning. Teach greedy and bold to keep out of a sentry's lane on its fire ticks before calibrating, then measure search against the mix.

**Play: strong, 4 of 5.** A new threat axis: minions threaten the field from the rail, so a cut's route and timing relative to the sentries' lanes matter, and stranding a sentry becomes a new reason for a capture. Lanes leave from the minion's right, the field side, so a cut parallel to a sentry's side is safe from it: a clear rule that can be learned. Bolts exist only during a cut, so play on the rail is unchanged. Harsh edges: a sentry next to the first trail cell hits at once, and a bolt already heading for your trail can only be answered by closing first, because the trail cannot move. So it joins the 'race to close' family (fuse, rider), though with a distinct, ranged source. It is distinct from the 16 levels and from the boss.

*Fixes.* Make the 10-tick blink part of the spec, not optional. Do not spawn a bolt onto TRAIL: require the cell on the minion's right to be EMPTY, so there is no instant hit at the cut start. Set a minimum fire period (for example F ≥ 30) so cuts have windows. The sketch cites seed bytes 13-15 but lists '§6.4 seed bytes 17-20' as a conflict; pin which bytes it uses.

*Readability.* Good. A bolt is one cell in a new colour (cyan or orange) crossing the black field, with 2 redraws per move. The sentry's warning blink alternates its green cell with white. Up to 3 bolts plus the boss makes a busy screen, but it stays readable at 4x4.

## Minions that board the open trail

`edge-and-claimed-enemies#7` · T3 New core rule · score 10 (core 3, fairness 3, play 4) · gap: widens · D14: compliant

Late in the level, a minion that reaches the point where your cut left the rail climbs onto your line and chases you along it. Closing the cut before it catches you snuffs it out.

**Rule sketch.** Level bytes v2 add a boarding tick Tb (0 = never). From tick Tb on, a live minion that ends its step-5 move on the cut start cell while the player is cutting boards the trail. Its slot becomes riding: state hash presence 3, with x, y and heading 0, and the u16 countdown field reused to hold its gap, set to L, the trail cells laid. Each tick, gap += n, the cells the player entered at step 3. On the rider's move ticks (tick % period == 0) at step 5, gap -= 1. If gap reaches 0 at step 5, the player is hit, a new case of R4.9-1. A rider does no share, swap or pass checks. When the cut ends for any reason (capture, commit, lost life, or a hit the shield absorbed), every rider is destroyed with countdown R and comes back through the normal lifecycle (R4.7-8, R4.7-9). So a closed cut snuffs out its chaser, and the minion's absence is the reward. Fast cut A outruns a period-1 rider; a stopped or slowed player (B) is caught. The client draws the rider at path index L - gap from its cut log. Variant for a gentler level: a rider latches instead of killing, and while it rides, A gives no fast cut.

**Inspired by:** Qix (1981), quix (QIX on Unix) (c. 1982-1984), Xonix (1984), Mamba (1991), Stake That Claim (2026), Qix (1989 Taito America Amiga port) (1989), Amidar (1982), Just4Qix (2009), Qyx (2022). **Mechanic families:** [Open trail vulnerable to enemies](../taxonomy/movement-and-drawing.md#open-trail-vulnerable-to-enemies), [Enemy cuts or erases the open trail](../taxonomy/movement-and-drawing.md#enemy-cuts-or-erases-the-open-trail), [Self-crossing penalty (own trail is lethal)](../taxonomy/movement-and-drawing.md#self-crossing-penalty-own-trail-is-lethal), [Stall penalty without a Fuse](../taxonomy/movement-and-drawing.md#stall-penalty-without-a-fuse), [Escalating and timer-released patrollers (Super Sparx)](../taxonomy/edge-and-claimed-enemies.md#escalating-and-timer-released-patrollers-super-sparx), [Trail chasers](../taxonomy/edge-and-claimed-enemies.md#trail-chasers), [Perimeter tracer that turns into a trail follower](../taxonomy/edge-and-claimed-enemies.md#perimeter-tracer-that-turns-into-a-trail-follower), [Trail-latching slowers](../taxonomy/edge-and-claimed-enemies.md#trail-latching-slowers). **Touches:** rules, state-hash, tools-bots, presentation, level-format, level-data.

**Decisions it reopens:** D4; D7; R4.7-1; R4.7-2; R4.7-8; R4.3-4; R4.9-1; R4.4-10.

**Bot effect.** Keeps the gap, perhaps widens it slightly. Boarding happens only at the cut start, in plain sight, and the patrol that will get there is visible, more so with the patrol forecast. But a human far out in the field must keep an eye on the minions' distance to the cut start, and search tracks that exactly. Scripted bots need a rule to choose cut starts away from the minions.

**Budget.** No new bytes: the rider reuses the presence value 3 and the existing u16 countdown field, so the hash stays 948 bytes but changes meaning (hash v2). Level +2 bytes. Per tick: one compare and add per slot. zk negligible. Screen: rider cells drawn on the line; the client's cut log takes at most 841 bytes.

**Variety.** Where a cut starts matters for the first time, measured against where the patrols are heading, and a cut in progress becomes a race against a pursuer you can see. Cuts get shorter after Tb, and closing becomes an attack: it destroys the chaser and buys R ticks of a minion-free rail.

**Merged from:** `movement-and-drawing#11`. Variants:

- Trail-riding minions: A minion that reaches the cut start while a cut is open boards the trail and chases the player along it. The player can race it back to claimed land, outrun it with the fast cut, or start cuts just after the patrol has passed.

**Core engineer: feasible with changes, 3 of 5, tier 3.** The counter model is sound. Only counts reach the core: gap starts at L and changes by +n and −1. The trail's order lives in the client's 2-bit cut log (3,364 × 2 bits = 841 B), and the core never needs it. The weak spots:
(1) The chase is mostly illusory. Minion periods are 1 to 3 in the 16 levels. A period-1 rider gains on the player only when the player stops, is blocked or crawls with B, because a moving player adds n ≥ 1 per tick. At periods 2 and 3, a rider almost never catches anyone. So this is a stall fuse lit by a minion, and that collides head-on with D4 ('no fuse in v1'). It needs an explicit owner decision, not a footnote.
(2) It hands players a minion-removal tool. Start a short cut just ahead of a patrol, let the minion board, close at once, and the minion is gone for R ticks. Search will do this every time after Tb, so minion levels may get easier for everyone. This has to be measured.
(3) It is underspecified in four places. In which order are +n, −1 and the zero test applied at step 5? Does a minion standing still on the cut start board on a tick when it does not move? What does 'a hit the shield absorbed' mean, given that an absorbed hit does not end the cut today (R4.9-15)? And a rider destroyed at step 6 by a lost life misses that tick's step-5 decrement, so it respawns one tick later than a minion destroyed by a capture (R4.7-9 / PIN-17).
(4) L at boarding needs a count of the trail: a 3,600-cell scan (rare) or a u16 counter. Either works, but the 'no new bytes' claim assumes the scan.
(5) Hash v2 is right, since presence 3 is a new value.

*Fixes.* Pin the order at step 5, for each rider: gap += n; if it moves this tick, gap −= 1; if gap == 0, set the hit flag. A minion boards if its cell at the end of step 5 is the cut start while the player is cutting. A rider whose hit is absorbed by the shield is destroyed. A rider destroyed at step 6 gets countdown R + 1, so all destructions respawn R − 1 ticks after the destruction tick. Add a per-level rider period, or reuse the minion period with a minimum gap, so the chase is real at normal speed. Get the owner to amend D4. Measure the lure-and-close minion removal with search before shipping.

*Cost.* Level v2 +2 B (Tb). State: no new bytes in the core's Minion enum (a Riding{gap} variant); hash v2 (948 B, presence 3). Per tick ≤3 compares and adds; boarding does one TRAIL count (3,600 reads, rare) or keeps a u16 counter. zk \<0.1%. Client: an 841 B cut log; the rider is drawn as an overlay sprite. RULES_VERSION bump, vectors, playtest, calibration.

*Conflicts.* D4; R4.3-4; R4.4-10; R4.7-1; R4.7-8; R4.7-9; PIN-17; R4.9-1; R4.9-15; §5 level bytes v1; state hash v1 presence values

**Fairness: concerns, 3 of 5; gap widens; D14 compliant.** D14 is unaffected: minion patrols are already deterministic, and the boss still diverges per seed. The trouble is who the rider punishes. It kills players who stop mid-cut to wait out the boss, which D4 explicitly allows and which humans do. The measured search never stalls mid-cut: its lines are out/side/back legs with A held, and it waits only on the rail. Greedy, bold and committer cut the same way, at 2 cells per tick, so they outrun a period-1 rider. The rider therefore hits hesitant humans and almost never either kind of bot. That widens the gap. It also skews calibration, which plays only the scripted mix, so any level with Tb set is weighted as easier than it is for the humans who draw it. Destroying the rider on close earns R minion-free ticks, a bait-and-close tactic that search can farm with exact timing. The rule text is also ambiguous: its list of events that end the cut includes 'a hit the shield absorbed', but R4.9-15 says an absorbed hit costs only the charge.

*Fixes.* Use the latch variant in Challenge: a rider cancels the fast cut instead of costing a life. Before calibrating Tb levels, give bold and committer a hesitation model (they stop k ticks mid-cut when the boss is in reach). Drop the destroy-on-close reward: the rider steps back onto the rail at the cut start instead of taking an R countdown, so it cannot be farmed. Specify that a shield-absorbed rider hit removes only the rider and leaves the cut open.

**Play: strong, 4 of 5.** A rider of period p gains on the player only when the player moves slower than 1/p cells per tick. In effect it is a fuse with a visible, positional source. With period-1 minions (7 of the 16 levels) it punishes parking, being blocked by your own trail and B's half-speed walk. At period 2 or 3 it never catches a player who keeps moving. It adds real decisions: where to start a cut relative to the patrols, whether to outrun the rider with A, and a bait-and-snuff tactic (let a minion board, close fast, and get R ticks of a minion-free rail). That is the first way to remove a minion other than stranding it. It also adds tension with B: crawling with the shield up lets the rider close in. Ambiguity: the sketch lists 'a hit the shield absorbed' among the events that end a cut, but an absorbed hit does not end a cut today. It overlaps in effect with the stall-fuse idea, so ship one of the two, not both.

*Fixes.* State that when the shield absorbs a rider's hit, the rider is destroyed (countdown R) and the cut continues. Define the order when two minions reach the cut start on the same tick (index order, at most one rider per slot). Tune Tb per level. If bait-farming proves too strong on levels with a long R, give a snuffed rider a shorter respawn countdown.

*Readability.* Good. A green minion cell on the red trail line reads clearly at 4x4, and the shrinking red stretch between the rider and the player shows the gap directly. The client needs the cut log (at most 841 bytes) to place the rider.

## Shore nibbler

`edge-and-claimed-enemies#10` · T3 New core rule · score 10 (core 3, fairness 4, play 3) · gap: widens · D14: compliant

A harmless creature walks the rail and chews notches out of land you have captured, and you can watch your claim tick down. Chase it along the rail and touch it to drive it off, win the notches back with quick cuts, or commit before you lose more.

**Rule sketch.** Level bytes v2 add, per minion slot, a nibbler flag and a nibble interval N in moves. A nibbler walks the rail by the right-hand rule like any minion but never hits the player. If it meets the player by the share, swap or pass predicates (PIN-15), it is caught instead: destroyed with countdown R (PIN-17). On a move tick where tick % (period x N) == 0, after it moves from cell a to a different cell b, it eats a, provided that a is a captured cell (CLAIMED, not on the border, and not an obstacle in the level's bitmap, read from the &Level the caller already holds), a is 4-adjacent to an EMPTY cell, and a is neither the player's cell nor the cut start. Eating sets a to EMPTY and lowers the captured count by 1. Because a touches the single open region, the field stays one 4-connected region. Only a loses rail status, while its 8 neighbours can gain it. After an eat, any other minion standing on a is destroyed as stranded, and every live minion runs the orientation step, as after a capture. A clear is still checked only at step 3 after a capture, so eating never ends a level; a commit and the time limit keep the claim as it stands.

**Inspired by:** Make Trax (1981), Pepper II (1982), Urbanix (2010), Xonix Blast (2012), Mr Super Fish: Hero Fill Block (2017), Scalar Snake (2024). **Mechanic families:** [Territory eaters](../taxonomy/edge-and-claimed-enemies.md#territory-eaters), [Harmless vandals that damage claimed progress](../taxonomy/edge-and-claimed-enemies.md#harmless-vandals-that-damage-claimed-progress), [Paint erasers](../taxonomy/edge-and-claimed-enemies.md#paint-erasers). **Touches:** rules, level-format, presentation, level-data, tools-bots.

**Decisions it reopens:** R4.2-3; R4.1-8; D7; D5; R4.7-8.

**Bot effect.** Keeps the gap, perhaps widens it slightly. The creature is harmless and fully visible, but deciding whether to chase it, recapture or commit under a falling claim is an optimisation search solves exactly and humans only approximate. Seeded randomness and hidden information are unchanged.

**Budget.** No new state fields: eaten cells live in the grid and the captured count is already in the state hash, so the layout stays the same and only the meaning changes. Borrowing &Level for the obstacle bitmap avoids a 450-byte copy. Per eat: 4 neighbour reads, 1 bitmap bit and the orientation step for 3 minions, about 100 operations, at most once every period x N ticks. zk negligible. Screen: 1 redraw per eat, plus the falling claim display.

**Variety.** Captured progress can go backwards for the first time, which makes Commit (D5) an active decision: bank before the losses grow. It also adds a chase on the rail that is about time, not survival, and cheap recaptures: notches one cell deep close with tiny cuts. Harmless enemies are new to the game.

**Core engineer: feasible with changes, 3 of 5, tier 3.** The connectivity argument holds. a is 4-adjacent to EMPTY, so the field stays one 4-connected region and D7's premise survives. Eating only adds openness, so no other rail cell loses rail status: not the player's cell, not the cut start, not another minion's cell. captured - 1 is correct, because every non-border, non-obstacle CLAIMED cell came from a capture.
Blocking issue: at step 5 the core cannot tell an obstacle from a captured cell. The grid has a single CLAIMED value and Game keeps no Level.
The rail now changes outside captures (R4.2-3). Re-running orientation for every minion after each eat keeps D7's after-capture argument valid. minion_hits must separate 'hit' slots from 'caught' slots.

*Fixes.* Pass the obstacle bitmap (a slice of the level, or &Level) to Game::step on every target. Replay and wasm already hold it. Compute period x N in u16. Mark nibblers as harmless in greedy's and CaptureBot's minion margins.

*Cost.* No new state. State hash v1 layout unchanged (the nibbler flag and N are level constants). Level +6 B, or +4 B packed. Game::step's signature changes across the core, wasm, referee and tools. Each eat costs about 100 ops plus 3 orientation steps, at most once every period x N ticks: zk under 0.5%. RULES_VERSION bump, level v2 vectors, recalibration.

*Conflicts.* R4.2-3; R4.1-8 (captured count can fall); R4.7-8 (stranding outside captures); D7 (rail changes between captures); D5; R4.9-4; PIN-15

**Fairness: ok, 4 of 5; gap widens; D14 compliant.** D14 is unchanged. The creature is harmless and visible, and each eat costs only one cell. Catching it on the rail is a readable chase.

A falling claim turns Commit into an active decision. Search optimises that decision exactly and humans only approximate it, so the gap widens slightly.

Rule risk: the rail now changes outside captures. That contradicts R4.2-3 and the premise of PIN-14 that the rail stays unchanged between captures. Re-running the orientation step after an eat handles minions, but the coverage property test must include eats. An eat can also turn the cell a cut was heading for into EMPTY mid-cut, which is visible but surprising.

Calibration: the committer policy needs a rule for a falling claim; greedy only needs recapture cuts. Variance is moderate, and the weights absorb it.

*Fixes.* - Restate R4.2-3 so that the rail changes on a capture or an eat.
- Extend M1's coverage test with eat events.
- Bound eats per level (a minimum N and a cap), so the loss stays small next to a capture.
- Forbid eating a cell 4-adjacent to the player's trail, so the closing target of a cut cannot vanish.

**Play: ok, 3 of 5.** Two firsts: a harmless enemy, and progress that can go backwards. The eat rule is cleanly bounded: only interior captured cells next to the single open region, never the player's cell or the cut start, and an orientation step after each eat. Commit does become more active. In practice the loop risks being busywork. A one-cell notch on a straight edge comes back with a two-tick cut (step in, step out) at almost no risk, and the next ordinary capture along that edge takes all the notches back anyway. So the best play is often to ignore it until a real cut, and the decay is a soft timer rather than a decision. Chasing it is only meaningful when its period is 2 or more: on the rail the player moves 1 cell per tick (A doesn't speed you up there), so a period-1 nibbler can only be caught head-on or by cutting across. It does nothing until the first capture, which gives good pacing. Search will get the most out of chase versus recapture versus commit, so the gap widens slightly.

*Fixes.* Tie it into the cut loop: eat only while the player is cutting, or eat a 2-cell-deep bite, so erosion competes with how long you cut and notches aren't free to refill. Require a nibbler period of at least 2 so the chase works. Show the falling claim beside the target on the HUD. Give the nibbler a colour and shape that clearly read as harmless, as opposed to the minions.

*Readability.* Good: one-cell notches are visible dents at 4x4 px, and each eat is one redraw. The risk is confusing it with a lethal minion. It needs a clearly different colour or shape, or players will avoid it, or touch real minions by mistake.

## Stall fuse on hesitation

`edge-and-claimed-enemies#6` · T3 New core rule · score 9 (core 4, fairness 2, play 3) · gap: widens · D14: compliant

Stand still in the open field and a fuse starts burning along your line from where you left the rail. Keep moving and it waits; let it reach you and you lose a life (or, in a gentler level variant, only the cut).

**Rule sketch.** Level bytes v2 add fuse speed f (0 = off, keeping D4's free stop; 1..3 cells per stalled tick), a grace g in ticks, and a mode byte (0 = lethal, 1 = discard). Player state gains fuse: u16 (cells burnt from the cut start) and stall: u8. Starting a cut sets both to 0. At the end of step 3, while cutting: if the player entered no cell this tick for any reason except B's slow off-tick (no direction held, or blocked by its own trail), stall += 1, and once stall > g, fuse += f. If the player entered a cell, stall = 0, and the fuse stays where it is; it never retreats during the cut. L, the trail cells laid, equals the count of TRAIL cells; the core keeps it as a u16 counter that can be derived from the grid. If fuse >= L: in lethal mode the tick's hit flag is set, and a shield charge absorbs it (R4.9-15), which resets fuse to 0. In discard mode the cut is abandoned as a commit discards it (abandon_cut: trail erased, player back at the cut start), with no life lost and invulnerability unchanged. The fuse burns in the order the cells were laid, so its position is the fuse-th cell, drawn from the client's cut log. The core needs only the counters.

**Inspired by:** Qix (1981), quix (QIX on Unix) (c. 1982-1984), Super Qix (1987), Perestroika Girls (1993), Eight Bit Qix (c. 2026), Volfied (1989), Doodlebug (1984). **Mechanic families:** [Stall fuse](../taxonomy/edge-and-claimed-enemies.md#stall-fuse), [Line cutters](../taxonomy/edge-and-claimed-enemies.md#line-cutters), [Exposure penalty off safe ground](../taxonomy/controls-time-and-pacing.md#exposure-penalty-off-safe-ground), [Per-capture deadline](../taxonomy/controls-time-and-pacing.md#per-capture-deadline). **Touches:** rules, level-format, state-hash, presentation, level-data, tools-bots.

**Decisions it reopens:** D4; R4.5-8; R4.4-8; R4.9-1.

**Bot effect.** Uncertain; probably keeps the gap or narrows it slightly, which needs measuring against reports/bot-advantage.md. Search parks mid-cut to wait for a boss window it can foresee; a fuse proportional to trail length limits how long it can park. Humans lose the same option. It reveals nothing hidden. The discard mode is gentler on humans than on search, which rarely runs out of fuse.

**Budget.** State +3 bytes (hash v2); level +3 bytes. Per tick: about 3 integer operations. zk: negligible (under 0.1%). Screen: the burnt part of the line in a new colour, 1-3 cell redraws per stalled tick; the client's cut log takes at most 841 bytes.

**Variety.** Parking in the field is free today (D4). A fuse turns standing still into a resource you can see, whose budget grows with the line you have drawn: a short hop has almost none, a long sweep has some. Each cut becomes a choice between committing to a route and keeping time in reserve. The discard mode costs time instead of lives, a different kind of penalty from anything in the current levels.

**Merged from:** `controls-time-and-pacing#3`. Variants:

- Trail fuse after hesitation: Stopping mid-cut is still allowed, but after a short grace a spark lights at the cut start and burns along your trail one cell per tick while you stand still. If it reaches you, you are hit. Moving pauses it, and closing the cut puts it out.

**Core engineer: feasible with changes, 4 of 5, tier 3.** This is cheap and almost fully specified: counters only, an O(1) tick, and the trail's order kept client-side in an 841 B cut log. Problems:
(1) D4 decided 'no fuse in v1' and R4.5-8 makes stopping free. This reverses an owner decision, so it needs explicit sign-off.
(2) Bug: `stall` is a u8 incremented on every stalled tick. With f = 1 and a long trail (L up to about 3,300), a player can stall more than 255 ticks. stall then wraps to 0 and the fuse pauses for another g ticks, which is free time.
(3) L must be a u16 counter. A per-tick TRAIL count is 3,600 reads, about a capture pass on every cutting tick, which is far from negligible in zk. The counter can be derived from the grid, so it needs no hash bytes. The budget's '+3 bytes' should read 5 bytes in the core.
(4) Discard mode abandons the cut at the end of step 3. The minion hit predicate (PIN-15) must then take P0 as the cut start with n = 0. Otherwise a minion standing on the cut start does not hit the player who has just landed there.
(5) Discard mode is also a free retreat: stall for g + ceil(L/f) ticks and you are back at the cut start with nothing lost. Search will use it as a scheduled bail.
(6) Bot gap: humans park to wait for the boss more than search does, since search times its moves exactly. Removing parking probably hurts humans more, so 'probably keeps or narrows' leans optimistic. It needs the bot-advantage report rerun.

*Fixes.* stall saturates at g + 1, or is stored as min(stall, g + 1). Keep L as a u16 counter that counts trail cells laid; it is derivable, so it stays out of the hash. After a discard at step 3, set P0 = cut start and n = 0 for the hit predicate. Get the owner to amend D4 and R4.5-8. Measure both modes against reports/bot-advantage.md before choosing a default.

*Cost.* Level v2 +3 B (f, g, mode). State +3 B hashed (fuse u16, stall u8) +2 B derived L counter; hash v2 (951 B). Per tick ~3-5 integer ops; zk \<0.1%. Client: an 841 B cut log, 1-3 cell redraws per stalled tick, one palette entry. RULES_VERSION bump, vectors, playtest, calibration.

*Conflicts.* D4; R4.5-8; R4.4-8; R4.9-1; R4.9-15; PIN-15; §5 level bytes v1; state hash v1

**Fairness: concerns, 2 of 5; gap widens; D14 compliant.** The bot_effect assumes search parks mid-cut. The measured search does not: its WAITS are spent on the rail before a cut starts, and its cuts are out/side/back legs with A held. Greedy, bold and committer cut the same way. So neither search nor the reference mix ever stalls mid-cut, and neither ever triggers the fuse. Only humans, who use D4's free stop to wait out the boss, pay for it, and in lethal mode it adds D5 zeros on top. Calibration plays only the scripted mix, so a fuse level is weighted as if it had no fuse, and a human who draws one is penalised against the weights: more variance in the six-level draw. Because the stall budget grows with trail length, it also rewards long pre-planned sweeps (search's style) over short hedged hops. D14 is untouched.

*Fixes.* Keep it Training-only. If it must reach Challenge, ship only the discard mode with a generous grace (g of 30 ticks or more), and only once the reference mix has a hesitation model (bold and committer stop mid-cut when the boss is in reach) so calibration sees the fuse. Before any Challenge use, rerun bot-advantage against that hesitating mix to measure the gap.

**Play: ok, 3 of 5.** This brings back the classic Qix fuse, which D4 left out of v1. It is per level, and f = 0 keeps D4. The budget that grows with the trail is a good twist, and discard mode is a new kind of penalty (lost time, not lost lives). But it mainly removes an option, parking to wait out the boss, so it adds more difficulty than new situations. The rider idea ([edge-and-claimed-enemies#7](#minions-that-board-the-open-trail)) gives similar pressure from a visible spatial source. Loophole: stall resets whenever the player enters a cell, so inching one cell every g ticks never burns the fuse and keeps most of the parking option. Excluding B's off-ticks is correct.

*Fixes.* Make the grace a pool per cut (g stall ticks in total before the fuse burns), or reset stall only after several consecutive moves, so that inching cannot defeat it. Show the grace (the trail head blinking) as well as the burnt part.

*Readability.* Good. The burnt part of the trail in a second colour is readable at 4x4, but orange next to red may merge, so use grey or white for burnt cells. The grace countdown is invisible unless it is drawn.
