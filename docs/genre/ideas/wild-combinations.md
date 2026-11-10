# Ideas: bold combinations

The 5 ideas proposed from the lens *bold combinations*: cross-axis recombinations the genre has rarely tried, still fitting Jiro's determinism. Sorted by score. The [index](../IDEAS.md) lists every idea by tier and score, and [`README.md`](../README.md#the-taxonomy-and-the-ideas) explains the judges.

## Pillar lattice of mid-field anchors

`wild-combinations#2` · T1 Level data v1 · score 11 (core 4, fairness 3, play 4) · gap: widens · D14: compliant

The field is studded with single-cell pillars you can close a cut on and launch from again: stepping stones in mid-field. Some pillars hold a dormant minion. Closing on one costs a life, touching it with your land wakes it into a patroller, and only swallowing it whole removes it.

**Rule sketch.** Level data v1 only, no rule change. The obstacles are 36 one-cell pillars at x, y in {9, 16, 23, 37, 44, 51}. The boss is B = 5, spawning in the central gap (26,26)-(29,29) with period 2. Minion slots sit on pillars ('m' inside the field) as well as on the border. Under today's rules: (a) a pillar is a rail cell (R4.2-1), so a cut can close on it and the player can depart from it again; (b) a minion spawned on an isolated pillar has no rail target, so it never moves (R4.7-2, PIN-18) and acts as a static mine. Closing a cut on a mined pillar captures at step 3 and is then hit by the share case at step 5 (R4.9-9). The player is left on the mine's cell, and since an absorbed shield hit grants no invulnerability, it must cut away within its 30 invulnerable ticks; (c) a capture that joins claimed land to a mined pillar but leaves the pillar on the rail wakes the mine: the orientation step (R4.7-8) and the right-hand rule now find rail cells, and it patrols; (d) a capture that swallows the pillar takes it off the rail, so the mine is destroyed (R4.7-8). It respawns R ticks later at the first rail cell in row-major order as a patroller (R4.7-7), or never if R >= T, so R becomes the level's 'release delay'. Checked: the source /tmp/claude-0/-home-user-jiro-ikusu/22a02834-c154-5172-b422-1bcaf068740f/scratchpad/bold/src/16-mines.txt (1 border minion, 2 pillar mines, R = 600) builds and validates with jiro-tools level build/validate (claimable 3,328). An empty-journal replay shows both pillar minions still at (16,16) and (44,23), heading N, at tick 1,100. The seed keys the boss start and deflections as now.

**Inspired by:** Star Trigon (2002), Itazura Tenshi (1984), Pulsebound: The Expanse (unknown), Amidar (1982), point line surface (2026 (Early Access)), Tinnitus (2022), Volfied (1989), Xonix (1984), Jeepers Creepers (1982), Potty Painter (1983), Jezz Mania: Better Jezzball (2021), Space Cropper (2014), Xonix Blast (2012), Cosmonix (2016 (beta)), Territory Reveal (2026), Poison Control (2020), Xonix32 (1997), Cacoma Knight in Bizyland (1992). **Mechanic families:** [Anchor-to-anchor links](../taxonomy/movement-and-drawing.md#anchor-to-anchor-links), [Movement confined to the line network](../taxonomy/movement-and-drawing.md#movement-confined-to-the-line-network), [Rail-bound line movement](../taxonomy/movement-and-drawing.md#rail-bound-line-movement), [Interior obstacles and walls](../taxonomy/terrain-and-geometry.md#interior-obstacles-and-walls), [Designated capture anchors](../taxonomy/terrain-and-geometry.md#designated-capture-anchors), [Pocketing and herding walls](../taxonomy/capture-rules.md#pocketing-and-herding-walls), [Lane lattice of boxes](../taxonomy/terrain-and-geometry.md#lane-lattice-of-boxes), [Pre-claimed starting territory](../taxonomy/terrain-and-geometry.md#pre-claimed-starting-territory), [Mines and mine layers](../taxonomy/field-enemies.md#mines-and-mine-layers), [Enclose hazards to neutralise them](../taxonomy/capture-rules.md#enclose-hazards-to-neutralise-them), [Obstacles removed by enclosure](../taxonomy/terrain-and-geometry.md#obstacles-removed-by-enclosure), [Captured enemies respawn](../taxonomy/capture-rules.md#captured-enemies-respawn). **Touches:** level-data, tools-bots, presentation.

**Bot effect.** Keeps the gap roughly. Mines are static, visible and seed-independent information, which humans read as well as a bot does, and the boss stays seeded, so D14 holds. No safe zone appears because the pillars are anchors, not shelters. It could widen slightly: the many stepping-stone routes give search more combinations to enumerate than a human weighs.

**Budget.** Zero code. A stationary mine still runs its 4 rail tests per move, as any minion does. zk cycles are about the same as an obstacle level. Screen: 36 static cells plus 2 mine sprites. Cost: new level id, playtest against levels/targets.json, recalibration of the season weights.

**Variety.** Adds the first mid-field anchors (short cuts that close on a pillar instead of the border) and a minion that is a placed hazard rather than a patroller. It also adds a three-way choice per mine: avoid it, swallow it to free its pillar (and release a patroller after R ticks), or accidentally wake it by connecting your land.

**Merged from:** `movement-and-drawing#3`, `v1-levels#1`, `terrain-and-geometry#3`. Variants:

- Stepping-stone pylon fields: The field is dotted with small claimed pylons, and a cut closes on any of them. The player hops from the border to a pylon and on to the next, building bridges and resting mid-field where the border minions cannot reach, until the bridges join the minions' patrol.
- Pillar lattice: fences built from short hops: Twenty-five small pillars dot the field, and each one can close a cut. Instead of drawing one long, exposed loop, the player builds a fence from 8-cell hops between pillars and closes the last gap when the boss is on the small side.
- Pillar lattice with guarded posts: A grid of small pillars fills the field like city blocks. Some pillars carry a minion that circles them as a guard, and every pillar is an anchor you can bridge to, so the level becomes a choice of which boxes to take and which guarded posts to avoid or cut off.

**Core engineer: feasible, 4 of 5, tier 1.** Verified. scratchpad/bold/out/16-mines.bin validates with jiro-tools (claimable 3,364 - 36 = 3,328). I ran a 100-run playtest of the reference mix: 71% clear (bold 81% with 19% deaths, committer 61%), median effective claim 7,551 bp, median 710 ticks. So the scripted bots play it, and it can be calibrated near the middle of the ramp. The gaps between pillars are 6-13 cells, wider than B = 5, so the boss reaches the whole field and no safe zone appears. Rules check: an isolated 1-cell pillar has no 4-neighbour rail target, so its minion stays put (PIN-18). Closing on a mined pillar always costs a hit. The capture turns the trail into a CLAIMED bridge, which wakes the mine at once. At step 5 the mine then either still shares the player's cell (share case) or steps onto the bridge cell the player came from (swap, R4.9-10). Minions never enter EMPTY or TRAIL, so cutting past a mine is safe. Mines only matter when you close on them, or after trail captured next to them wakes them. They are a mild hazard. 'Never respawns if R >= T' holds, because the earliest capture comes at tick 1 or later and the respawn lands at t + R - 1. A season has exactly 16 slots (levelIds bytes32\[16\], 16 rates in targets.json), so a new level replaces one or ships in a new set.

*Fixes.* No rule or code change is needed. Tell players in the level text that closing on a mine costs a life and wakes it. Choose R on purpose: at least 600 for a real release delay, or at least T for never.

*Cost.* Code: none. Level bytes v1 (472 B) and a new level id. Playtest against levels/targets.json and recalibration of the season weights. zk cycles about those of an obstacle level: a pinned minion still makes 4 rail tests per move. It takes one of the season's 16 slots.

**Fairness: concerns, 3 of 5; gap widens; D14 compliant.** D14 holds. The boss stays seeded, pillars and mines are static and visible, and the rail was always safe from the boss, so no new safe zone appears. The gap widens. 36 anchors multiply the closing options: a short hop can capture a large region when the boss is on the far side, and search enumerates these options while humans cannot weigh them in real time. The mines also depend on hidden rule interactions that humans will misread: (1) Closing on a mine almost always hits: by the share case if the mine stays put, or by the swap case if the capture puts it on the new rail and it steps onto P0. (2) An absorbed shield hit grants no invulnerability, so holding B on a mine spends the charge and then a life. (3) Connecting land to a mined pillar wakes the mine (R4.7-8). (4) Swallowing a mine respawns it R ticks later at the first rail cell in row-major order, usually the top-left border, where PIN-11 can hit a player standing there. Calibration: greedy plans U-shaped cuts and assumes open legs. A leg that reaches a pillar closes early (R4.5-5), so the bot may misjudge its cuts. The mix's clear rate may then say little about human difficulty, and a mispriced weight adds draw variance.

*Fixes.* Drop the pillar mines, or set R >= T+1 so a swallowed mine is gone for good and never appears at the row-major cell; keep the lattice. Ship together with the minion and respawn forecast. Check greedy's rectangle search against pillar-closing cuts on this level and fix it before calibrating. Then compare the mix's clear rate with that of a policy that hops pillars.

**Play: strong, 4 of 5.** This is the one idea in the set that changes the basic cut loop. With 36 one-cell anchors, the game moves from one long exposed cut from the border to building a fence out of 6-cell hops (3 ticks at fast cut) and choosing when to close the last gap with the boss on the far side. Each hop claims only its own trail, and the claimed fence then becomes a road for border minions, so danger follows the player into mid-field. The mines are clever emergent use of PIN-18 and R4.7-8: static, visible and seed-independent. Closing on one is a hit, connecting land to it wakes it, swallowing it removes it. All of these are real, readable decisions. The 'first mid-field anchors' claim overstates a little: ring's central block and the bar tips of cross, serpent and maze are anchors too, but nothing like a lattice exists. Risks: short hops cut exposure sharply, so the level could play far easier than its knobs suggest. The boss pinballing off 36 single cells is chaotic. Many tiny captures can feel grindy. The 'wake by touching' rule is understandable but not taught by anything on screen. It overlaps with the guarded-islands idea.

*Fixes.* Balance the lower exposure with a faster boss (period 1), 2-3 minions and a target near 8,000 bp. Or thin the lattice (16-25 pillars, wider gaps) so some long cuts remain necessary. Give mines a distinct sprite or colour from patrolling minions so dormant versus awake reads. Ship it alongside the guarded-island level as a 'mid-field' pair, and playtest whether scripted bots use pillar hops at all, or the calibration will misjudge the level.

*Readability.* Good. A pillar is a 4x4 px static cell and a mine is a minion sprite on it. Thirty-six pillars are static scenery, drawn once. Boss bounces off single cells are visible, though less predictable.

## Hot-seat boss duel

`wild-combinations#10` · T4 Input or journal (proposed as T5) · score 10 (core 3, fairness 4, play 3) · gap: neutral · D14: compliant

A local two-player Training mode: one player cuts, and the other steers the boss with two turn buttons on a recharging budget, baiting and cornering the trail. A human mind behind the boss replaces the seeded deflections.

**Rule sketch.** Journal v2 accepts mode 3 'duel' in Training only. The referee and Challenge keep rejecting it, as v1 rejects mode 2 (PIN-12). In duel, mask bit 6 (X) is P2's 'turn x' and bit 7 (reserved in v1) is P2's 'turn y'. Commit is disabled, so the level ends on a clear, out of lives or T. R4.6-7's seeded draw is replaced at the same point (before the first edge test of a boss move): if P2's turn-x bit went from released to held since the boss's previous move and P2 has a charge, vx inverts and one charge is spent; the same applies for y. P2 holds up to 3 charges and regains 1 every 45 ticks (u8 charges, u8 refill countdown in state hash v2). Edge tests (R4.6-3) are unchanged, so a turn toward a wall is undone by that wall. In the browser, P2 rebinds two keys. Score: P1's claim; P2 wins if P1 fails to clear.

**Inspired by:** Demolition Herby (1982), Paint Roller (Gakken) (1982), Glowfield (2026), Stix Disruption (2024), Zolyx (1987), AQuix (1997). **Mechanic families:** [Player-controlled enemies (asymmetric versus)](../taxonomy/multiplayer-and-competition.md#player-controlled-enemies-asymmetric-versus), [Asymmetric co-op support shooter](../taxonomy/multiplayer-and-competition.md#asymmetric-co-op-support-shooter), [Enemy direction reversal](../taxonomy/items-and-power-ups.md#enemy-direction-reversal), [Simultaneous two-player play](../taxonomy/multiplayer-and-competition.md#simultaneous-two-player-play), [Alternating-turn local multiplayer](../taxonomy/multiplayer-and-competition.md#alternating-turn-local-multiplayer). **Touches:** input, journal, rules, state-hash, presentation, tools-bots.

**Decisions it reopens:** D8; §6.1 bit 7 reserved; PIN-12; R4.6-6; R4.6-7; R4.4-7.

**Bot effect.** No effect on the paid gap: duel exists only in Training and never reaches a referee or a season. D14 does not apply (no money, P2's inputs replace the draws, and journals are local). A search-driven P2 bot gives a superhuman sparring boss for practice. Human P2 journals are also data on what an aggressive boss feels like, useful for designing future boss behaviour.

**Budget.** 2 B of state and one bit test per boss move. Journal v2 with mode-dependent mask semantics. The decoder must keep mode 3 out of Challenge builds. zk: none, since the mode is never proven. Product cost: D8's 'Y stays unused' becomes 'Y is used only in duel'.

**Variety.** Replaces a random-feeling seeded boss with an opponent that reads you: feints, bait cuts, spending versus hoarding turn charges. It adds social local play to a single-player game, which the catalog lists under player-controlled enemies but no Jiro mode offers.

**Core engineer: feasible with changes, 3 of 5, tier 4.** The tier is corrected to T4. Duel is Training-only and touches no Outcome, IReferee, Season or economics, so it is T5 in name only. Its real costs are input and journal work (Y, bit 7, the D8 revision) plus a mode-dependent core rule.

As written, it forces consensus churn for a free local feature. Committed format vectors pin the current decoder: journal-unknown-version (version byte 2 gives error 3), journal-unknown-mode-3 (error 5) and journal-reserved-bit-7 (error 10). Accepting journal v2, mode 3 or bit 7 changes those error codes and edits implemented §6.3 rules. Under CLAUDE.md's definition that is a behavior change: RULES_VERSION 3, regenerated vectors, a playtest/calibrate rerun, and a new season with a new zk image. Since Training must use the current season's rules (§8.1), the duel could not ship before a season adopts rules 3.

A build flag that 'keeps mode 3 out of Challenge builds' would create two cores. It is also unnecessary: settlement already requires Outcome.mode = 1 (§7.2 step 5), so a duel journal can never pay.

The cheaper path keeps the consensus journal v1 and state hash v1 untouched. Put P2's two turn bits in a separate duel log with its own format version, decoded by a duel-only core entry point that replay() never calls. If M1.9's gate agrees, adding a new rule section alters no committed vector and RULES_VERSION can stay at 2.

Rule gaps:
(1) 'Released to held since the boss's previous move' needs a latched per-axis edge bit in state. Otherwise, at move period 2 or more, a 1-tick tap between moves is lost.
(2) Pin the refill: whether it counts only below 3 charges, and P2's state at tick 0.
(3) Balance is unknown. With 3 charges plus 1 every 3 s, a human P2 who can see the trail may dominate on fast or small-boss levels, and with Commit disabled a 75% clear may be rare. Charges and refill want to be tunable and playtested.

The search-driven P2 needs up to 749 ms of compute per game second on a PC core, so it runs in a browser worker at a reduced budget.

There is no effect on the paid gap, the zk proving cost or calibration.

*Fixes.* 1. Do not touch journal v1, mode 2 (reserved) or bit 7.
- Define a Training-only duel log: v1-style header with its own version tag, P1 events, plus a P2 event stream of (u16 tick, u8 bits).
- Add a core entry point that steps with (mask, p2_bits).
- Add a duel-only state hash extension (charges, refill countdown, 2 latched edge bits), so existing traces and error vectors stay valid.
- Add duel-log format vectors. Check with the M1.9 gate that RULES_VERSION can stay at 2; if the gate disagrees, bundle the duel with the next season's rules bump.
- Use no build flags: the Outcome mode = 1 settlement check already excludes it.

2. Rules:
- Latch P2 rising edges between boss moves.
- Pin the refill and the tick-0 state.
- Make charges and refill parameters of the duel, tuned by playtest.

3. D8: amend to 'Y is used only in the Training duel; no pause'.

4. Product: ship browser-first; make search-P2 a browser worker feature.

*Cost.* - RAM: +3-4 B of duel state (u8 charges, u8 refill countdown, 2 latch bits).
- Per tick: one mode branch plus up to 2 bit tests per boss move, with the deflection draw skipped.
- zk: none for duel; Challenge guest cycles +0% if replay() never calls the duel path.
- Formats as proposed: journal v2, state hash v2, RULES_VERSION 3, all game vectors regenerated (header rulesVersion), the 3 decoder vectors rewritten, and a new season and ZkReferee image to ship.
- Formats with the fix: one new Training-only duel-log format with its vectors, and existing consensus formats unchanged.
- No contracts, calibration or economy changes. Presentation: P2 charge HUD and remapping UI.

*Conflicts.* D8 (Y unused; amend to duel-only); §6.1 bit 7 reserved; §6.3 decoder rules 2 and 4 / PIN-12 (vectors journal-unknown-version, journal-unknown-mode-3, journal-reserved-bit-7); R4.4-7 / R4.10-2 / PIN-07 (Commit disabled in duel); R4.6-6 / R4.6-7 (seeded draw replaced); §6.4 state hash v1; §6.2 single input path (duel log must still be the core's only input); §8.1 Training uses the current season's rules (a rules bump gates shipping); One core (no Challenge-only build flags)

**Fairness: ok, 4 of 5; gap neutral; D14 compliant.** Training only, judged on what applies. D14 does not apply: there is no money, the journals stay local, and P2's inputs replace the seeded draws. The paid gap is unchanged. A duel journal cannot leak into a paid run: §7.2 step 5 already requires mode = 1 in every Outcome, so even a decoder bug could not settle one. D8's reason (no free thinking time in paid modes) is untouched, since Y would be used only in a mode that never pays. Bots: a P2 policy, scripted or search-driven, is simple to write, and no calibration is needed. A search P2 is a superhuman sparring boss, which is fine for practice. A boss steered by P2 is not the 1-in-32 seeded boss, so duel is a side mode, not practice for Challenge. Main concern: consensus cost reaches the paid path. Journal v2, mask bits whose meaning depends on the mode, state hash v2 and an edit to R4.6-7's text all count as a behavior change under the project's own definition. That means a RULES_VERSION bump, a new zk guest image and a new season, for a feature Challenge never uses, plus more decoder code in the referee guest, which must still reject bit 7 in modes 0 and 1.

*Fixes.* Write the duel rules in a section for Training only, outside §4-§6, and build them behind a core feature that the referee and the zk guest leave out. Keep journal v1, state hash v1 and every mode-0/1 vector byte-identical, so that RULES_VERSION and the referee guest image do not change. Add a vector that pins the rejection of a mode-3 journal by the Challenge decoder.

**Play: ok, 3 of 5.** On decisions alone this is the richest of the three: a human boss turns the seeded random walk into an opponent that reads you, with bait cuts, feints, and the choice to spend or hoard charges. It touches every part of the loop: fast cut timing against a boss that can turn on you, the shield as insurance, and the trail as bait. The constraints are sensible. Turns are flips of vx/vy, edge tests are unchanged, and the charge economy (3 max, +1 per 45 ticks) stops a human from shadowing the trail perfectly. Keeping it out of Challenge preserves D8's reason. Its reach and fit are weak, though. (1) The win condition is lopsided. The 16 levels are tuned for a seeded boss, and 'P2 wins if P1 fails to clear' with no commit gives either a P2 rout on later levels or a P1 rout on 01-04, with no symmetric scoring. (2) Practice does not transfer: §8.1 has Training mirror Challenge, but a hunting human boss teaches habits the seeded boss punishes or never tests. (3) Disabling commit removes a core decision instead of adapting it. (4) It costs a lot for a side mode: journal v2 with mode-dependent mask bits, decoder gating, and a rule fork of R4.6-7. The rising-edge rule ('released to held since the boss's previous move') also needs latched bits that the state hash v2 list omits.

*Fixes.* Make it a symmetric match: two legs with roles swapped on the same level and seed, highest claim wins (out of lives scores 0 as now). That balances any level and brings commit back as P1's decision. Restrict duel to a small duel level set or to levels with boss period 2 or more, so a human-steered period-1 boss is not overwhelming. Add the two latched previous-state bits to the state hash. Consider skipping journal v2 entirely: duel games are local and never verified, so treat them as unjournaled (no saved replays). That keeps the v1 format and PIN-12 untouched, and the core takes P2's bits only through a Training-build input path.

*Readability.* The boss and trail read as before, and P2 needs only a 3-pip charge meter (a few cells, cheap partial redraw) plus a flash on each turn so P1 sees the flip coming. The display is fine at 4x4 px. The browser is fine.

## Twin bosses: split, then harvest

`wild-combinations#7` · T3 New core rule · score 10 (core 3, fairness 3, play 4) · gap: widens · D14: compliant

Two bosses share the field. Close a cut that leaves them in separate regions and the one in the smaller region falls dormant for a few seconds, a window to carve its side safely before it wakes angrier.

**Rule sketch.** Level bytes v2 add a second boss block: B2, spawn rectangle 2, period 2, and a dormancy W (u16 ticks). Validity requires both bodies on open cells and disjoint for every pair of start candidates. Seed (only free bytes): boss 2's start index is the big-endian u32 of bytes 9-12, its vx and vy come from bits 2 and 3 of byte 4, and its deflection key is bytes 13-16 (D14 holds for each boss). Each boss's edge test (R4.6-3) also treats the other body's cells as solid and inverts on them. Boss 1 moves, then boss 2, in step 4. Capture (R4.8-2 already seeds from each): fill from boss 1 counting pushes (r1). If boss 2's top-left is BOSS_ZONE afterwards they share a region; otherwise fill from boss 2 (r2), a split. On the first split capture, the boss with the smaller region (tie: boss 2) goes dormant with countdown W. A dormant boss does not move and draws nothing. Its body still blocks the player's step but does not hit (R4.9-3 is waived while dormant), and it still seeds its region's fill. When the countdown reaches 0 it wakes with period max(1, period - 1). The ceiling is claimable - B1^2 - B2^2. State hash v2 adds boss 2 (x, y, B, vx, vy, period) and the u16 countdown.

**Inspired by:** Qix (1981), Styx (1983), Kix (BBC Micro) (1986), QWYX (c. 2026), Domain Expansion (2026), Boundarpy (c. 2019), Kritter Krawler (2009). **Mechanic families:** [Splitting enemies into separate regions](../taxonomy/capture-rules.md#splitting-enemies-into-separate-regions), [Paired and multi-part bosses to separate](../taxonomy/field-enemies.md#paired-and-multi-part-bosses-to-separate), [Several main enemies at once](../taxonomy/field-enemies.md#several-main-enemies-at-once), [Immobilisation clear](../taxonomy/capture-rules.md#immobilisation-clear), [Transforming main enemy](../taxonomy/field-enemies.md#transforming-main-enemy), [Pocketing and herding walls](../taxonomy/capture-rules.md#pocketing-and-herding-walls). **Touches:** level-format, rules, state-hash, tools-bots, presentation.

**Decisions it reopens:** D9; D7; PIN-14; R4.7-4; R4.8-2; R4.9-3; R4.6-5; §6.4 unused seed bytes; §5 level bytes v1.

**Bot effect.** Widens the gap slightly. A split is a two-body timing problem: the separating cut must close while each seeded boss is on its planned side, and search solves that from the joint future exactly while humans estimate it. The dormant harvest that follows is calm and human-friendly, which pulls the other way. D14 holds, with an independent key per boss. Coverage warning: with two open regions the D7 argument that minions trace the field's one boundary fails, because a one-cell wall between the regions is rail for both. PIN-14 must be restated per region and re-tested.

**Budget.** Second boss move: up to 2 x B2 more edge reads per move. Fill total is unchanged (each open cell is pushed at most once across both fills), so the static stack still suffices. About 10 B more state, about 8 B more level bytes, state hash v2, RULES_VERSION bump, new vectors, a minion coverage re-proof, playtest and recalibration. zk: about +10% boss work, captures unchanged.

**Variety.** A two-act level: set up the split, then race the dormancy timer to carve the sleeping side. It adds a choice of which boss to strand (the smaller region's boss is the one that sleeps) and a reason to make a cut that claims little but separates. No current level has more than one boss.

**Core engineer: feasible with changes, 3 of 5, tier 3.** The mechanics are sound and fit the deterministic core.

- Seeds: bytes 9-16 and bits 2-3 of byte 4 are free.
- No overlap: each boss treats the other's body as solid and they move in sequence, so bodies never overlap and only ever cover EMPTY.
- Capture: the two-fill capture shares one marked grid, so each cell is pushed at most once and the static 3,364-entry stack still suffices. Checking one cell of boss 2's body after fill 1 is enough, because a B×B body lies in one 4-connected region.
- No new cell state: dormancy is entity state, and the 2-bit grid holds.
- Divergence: D14 holds per boss. Boss trajectories now interact, so the N=400 property test must run on both bosses.

Gaps in the spec:

(1) The state hash needs more than a u16 countdown. It needs which boss is dormant and whether the one-shot split has already fired. After a wake, period max(1, p-1) cannot reveal it when p was 1, so the flag must be explicit.

(2) Neither the step at which the countdown decrements nor the wake tick is pinned. Put both at step 4 before that boss's move check, with the R4.4-2 global phase under the new period.

(3) Validity's 'disjoint for every pair of candidates' must be the O(1) test that the two spawn rectangles, each expanded by its body size, are disjoint, not 10^7 pair checks. Give it a new code.

(4) Level bytes v2 must keep v1 decodable, so built-in level_ids survive. Define B2 = 0 with an all-zero block as 'no second boss' so v2 stays canonical.

The real cost is D7. The 'field is one 4-connected region' argument behind PIN-14 breaks. After a split, the 1-cell wall is rail for both regions, so the rail component C spans two boundaries and a correct patrol of one region counts as 'trapped' under the current definition. PIN-14 must be redefined per region on the minion's right and re-tested like M1.14/M1.15. The orientation step may also send every minion into the same region.

Bot gap: the proposal is honest that it widens. Search times the separating cut from the exact joint future of two seeded bosses. A dormant region is a W-tick boss-free harvest that search also uses perfectly; it is play-dependent, so it is not a seed-independent safe zone. Scripted bots (bold, committer, greedy, edge-nibbler) need a two-boss danger model before the levels can be calibrated.

Runtime cost is small:

- RAM: Game gains about 16-20 B.
- Tick time: the second boss adds 2×B2 edge reads plus O(1) rectangle tests per move, and captures do the same total work, so the worst tick is essentially unchanged.

*Fixes.* 1. Format and state:
- Add u8 dormant-boss index (0 none) and u8 split-fired flag to state hash v2.
- Pin the countdown and wake at step 4.
- Specify the P2... no: specify the B2 = 0 canonical 'absent' encoding.
- Keep level v1 accepted alongside v2.
- Make the pairwise-disjoint validity rule an expanded-rectangle test with a new code, and add codes for B2, the second spawn rectangle, period 2 and W.

2. Rules:
- Restate R4.6-3 (the other body is solid) and R4.9-3 (both bodies; no hit while dormant).
- Restate R4.8-2 with fill order and region counts.

3. Minions: redefine PIN-14/R4.7-4 per open region, rewrite the D7 rationale for several regions, and rerun the coverage test on split boards. Decide whether the orientation step should balance minions across regions.

4. Divergence: extend the R4.6-12 N=400 test to both bosses.

5. Bots: teach the scripted bots two bosses before building twin levels and calibrating.

*Cost.* - Level bytes: 472 to about 480 B (v2, new validity codes).
- State hash: 948 to about 959 B (v2: boss 2's 7 B, countdown 2 B, dormant index 1 B, split flag 1 B).
- RAM: Game +16-20 B.
- Per tick: +1 deflection draw (2 multiplies) and +2×B2 edge reads per boss-2 move, plus O(1) rectangle tests per edge. Capture work is unchanged in total.
- Worst tick: unchanged.
- zk: about +1-3% cycles per level (boss moves are a small share of about 11k cycles per tick), so about +0.0000004 ETH per run proof.
- Consensus: RULES_VERSION 3, regenerated vectors/format (level, state hash) and all game vectors.
- Process: minion coverage re-proof, playtest rerun, new targets for twin levels, recalibration and a new season.
- Presentation: a second boss sprite and a dormant tint with countdown.

*Conflicts.* D9 (a single square body per level); D7 / PIN-14 / R4.7-4 (the one-region coverage argument); R4.8-2 / R4.8 rationale 'the boss's side stays open, as one region'; R4.9-3 (waived while dormant); R4.6-3 / R4.6-1 (other body as solid); R4.6-5 / R4.6-12 (start and divergence per boss); §6.4 unused seed bytes; §5 level bytes v1 (472 B) and validity codes; §6.4 state hash v1 (948 B); §7.4 / constraint 7 (widens the search-human gap)

**Fairness: concerns, 3 of 5; gap widens; D14 compliant.** D14 holds. Each boss draws its own start, direction and deflection key from free seed material (byte 4 bits 2-3, bytes 9-16). The dormancy timer is deterministic, but it starts on a player action on a board the seed drives, so it is not a fixed zone that can be learned. Gap: widens, as the idea admits. Closing a split cut means predicting both bodies' seeded futures at once, which search does exactly. Harder levels already show larger search-over-mix ratios (open 1.28, doom 4.10): a second boss pulls the mix down while search stays near the ceiling. The dormant harvest is a path-planning race against a known countdown, which search also optimizes exactly. Rule hole: during dormancy the body never moves, so the player can lay trail right against it and leave it a pocket exactly B2 x B2. When it wakes, every edge test hits CLAIMED and it never moves again, so 'wakes angrier' means nothing, and the dormant region minus B2^2 is a risk-free harvest whenever W is long enough. Minions: after a split the field is two regions. The argument behind R4.7-4 and PIN-14, that a minion traces the field's one boundary, fails. A minion follows one region's boundary and the other region's rail may have no minion at all, so a split also becomes a way to shed minions. Calibration: the scripted bots (bold, committer) need a splitter heuristic. If the mix never splits, twin-boss levels look hard and get a high weight, while humans and search exploit dormancy. That overweights the slot, which adds unfair variance to the draw and becomes a re-roll magnet. Whether the split happens is a yes-or-no event, which also raises the variance of each level's score. Budget is fine in zk.

*Fixes.* End dormancy at W or at the first capture inside the dormant region, whichever comes first, so the harvest is one protected cut and the boss cannot be boxed for free. Restate minion orientation and patrol per region: after a split, reorient each minion to the boundary of a region that holds a boss, and run the coverage property test on split boards before freezing. Add a splitter policy to the scripted portfolio and to the reference mix before any calibration. Tune W from playtests. Limit twin-boss levels to two or three of the 16 slots to cap the variance they add to the draw.

**Play: strong, 4 of 5.** This adds real new decisions rather than difficulty. Some cuts now pay off because they separate the bosses, not because they claim area. The player chooses which boss to strand by shaping which region is smaller, and gets a calm harvest window with a clear clock: carve the dormant side while its body is a static obstacle that cannot hit. It also creates a second-order minion play. After a split, a minion following the right-hand rule traces one region's boundary, so choosing where the split falls also chooses which side the minions patrol. This is a clean two-act level, distinct from all 16 levels (none has two bosses), and it fits the Qix-family feel (splitting two enemies is a classic mechanic; borrowing it is fine under D13). It keeps D14 with an independent key per boss, uses only free seed bytes, and reuses R4.8-2's 'seed from each boss'. Fill cost stays bounded by one fill. Weak points: (1) 'Wakes angrier' is period max(1, period-1), which does nothing on levels 05-16, all at period 1 already. The second act has no sting on most of the difficulty range unless twin levels use period 2 or more. (2) Which side is 'smaller' is hard to eyeball when the regions are close, so the player can strand the wrong boss without understanding why. (3) The split breaks D7's single-boundary argument. That needs a restated PIN-14 and creates a predictable minion-free rail on one side, a mild seed-independent comfort zone. (4) It widens the search gap a little, since a two-body timing split is exactly where simulation beats estimation, and the reference mix must learn splitting or calibration will undervalue it.

*Fixes.* Give the wake a visible sting that works at period 1: e.g. the woken boss's deflection band widens (r in 0..3 instead of 0..1), or it wakes one cell larger if that still fits. Alternatively require level period 2 or more on twin-boss levels so the speed-up matters. Make the sleeper choice predictable: either a rule players can see before closing (e.g. the boss farther from the cut's closing cell sleeps), or a T0 hint that, while the trail is open, outlines the side that would sleep. Compute the hint only when the trail changes. Show the dormancy countdown in the boss itself (dimmed colour, blinking for the last 30 ticks). Restate PIN-14 per region and test it, and consider letting stranded-region minions switch boundaries at captures so neither side stays minion-free. Add a split-seeking behaviour to the reference bot mix before calibrating.

*Readability.* Good. Two B x B bodies (8-32 px squares) in two distinct colours, plus a dimmed dormant variant, are easy to read at 4x4 px. Dormancy changes only the boss's own cells (a cheap partial redraw), and a last-seconds blink signals the wake. The weak spot is judging which region is smaller just before closing a cut: that needs a rule or hint (see fixes), not more pixels.

## Boss hit lights a fuse along the trail

`wild-combinations#6` · T3 New core rule · score 9 (core 2, fairness 4, play 3) · gap: narrows · D14: compliant

When the boss nicks your open trail you no longer die on the spot: a fuse lights where it touched and burns along the trail toward you, so close the cut before it arrives. You can also walk back along your own trail to erase it and abandon a bad cut.

**Rule sketch.** The grid stays u8. Bits 0-1 keep the state (R4.1-2), and TRAIL cells also store a back pointer (bits 2-3, direction to the previous trail cell or to the cut start) and a forward pointer (bits 4-5, written when the player leaves the cell). Every state test masks with & 3. (a) Rewind: a step onto the cell named by the head's back pointer is no longer ignored (R4.5-4 changes). The head cell reverts to EMPTY and the player moves to the previous cell, whose forward bits are cleared. If the previous cell is the cut start, the trail is now empty: the player stands on the cut start, not cutting, nothing captured, and this is not a closing step (R4.5-5). A gives two rewind sub-steps, as for cutting. The rail does not change, because TRAIL and EMPTY both count as open (R4.2-3). (b) Fuse: if no fuse is lit at the start of a boss move, that move's TRAIL bumps (R4.6-3) light one fuse at the first bumped TRAIL cell in edge order and cause no hit; with a fuse already lit, a bump hits as now. In a new step 5b (after minions, before collisions) the fuse advances 2 cells along forward pointers, and reaching the player's cell sets the hit flag. A capture at step 3 or a lost life clears the fuse. Rewinding into the fuse's cell is a hit. Entity: fuse (u8 x, u8 y, u8 lit). State hash v2 serializes the grid at 8 bits per cell (3,600 B) plus 3 B for the fuse.

**Inspired by:** Volfied (1989), Ultimate Qix (Genesis port of Volfied) (1991), Dino Master (2005), ArcField: Neon Territory (2025), VoidMania (2026), Area 99.9% (2022), Perestroika Girls (1993), Qix (1981), Mamba (1991). **Mechanic families:** [Enemy-triggered line fuse](../taxonomy/edge-and-claimed-enemies.md#enemy-triggered-line-fuse), [Instant death on line contact](../taxonomy/edge-and-claimed-enemies.md#instant-death-on-line-contact), [Retreat along the open trail (retractable trail)](../taxonomy/movement-and-drawing.md#retreat-along-the-open-trail-retractable-trail), [Stall fuse](../taxonomy/edge-and-claimed-enemies.md#stall-fuse), [Enemy cuts or erases the open trail](../taxonomy/movement-and-drawing.md#enemy-cuts-or-erases-the-open-trail), [Committed vs cancellable cuts](../taxonomy/movement-and-drawing.md#committed-vs-cancellable-cuts). **Touches:** rules, level-format, state-hash, presentation, level-data, tools-bots.

**Decisions it reopens:** R4.6-3; R4.9-2; R4.4-5; R4.4-9; D4; D5; R4.5-4; R4.5-5; R4.5-8; R4.1-2; state hash v1.

**Bot effect.** Narrows the gap. Search rarely lets the boss reach its trail, so a softer bump rule and an abort move mostly save human cuts and reduce D5 zeros, and the ceiling is unchanged (search is at 98.5% of it). Search may take cuts it knows will be nicked but can close within the fuse's reach, a small gain at most. D14 is unchanged.

**Budget.** No new buffer: pointers live in the spare bits of the existing 3,600 B grid, plus 3 B for the fuse. Every grid read gains an AND, a few percent more cycles in fill, pass and rail tests, so zk cycles rise by roughly 2-5%. Fuse advance is 2 pointer hops per tick. State hash preimage goes from 948 to about 2,650 B (tests only). Pervasive code change: every rule that reads cell states must mask. RULES_VERSION bump, all vectors regenerated, playtest and recalibration.

**Variety.** A nick becomes a visible race (close with A, or rewind, which means running toward the fuse) instead of an instant life lost. Rewind gives a way to abandon a cut whose shape went wrong without pressing X, which ends the whole level, or dying. Both are new decisions inside a cut.

**Merged from:** `edge-and-claimed-enemies#5`. Variants:

- Boss-lit line spark: When the boss hits your line you no longer die at once. A spark lights where it struck and races along the line toward you, and you live if you close the cut before it arrives.

**Core engineer: feasible with changes, 2 of 5, tier 3.** This bundles two mechanics, rewind and the fuse, into one heavy change.
(1) The grid. `Grid` stores `[Cell; 3600]`, and Cell is a 4-variant #\[repr(u8)\] enum. Putting pointer bits in it is undefined behaviour in Rust, so storage must become raw u8 with masked accessors. That is mostly contained in grid.rs (get, set, count, replace, the fill), not 'every rule'. The renderers (jiro-shell paint, the browser) must also mask, or pointer bits show up as wrong colours and spurious redraws.
(2) The back pointer is redundant. The head is the player's cell, and its predecessor is the 4-neighbour TRAIL cell (or the cut start) whose forward pointer names the head. Two bits per cell are enough.
(3) Holes in the spec: if the shield absorbs a fuse hit, the fuse sits on the player and hits again next tick; R4.9-15 says nothing else happens, so this must be pinned. A fast-cut rewind whose first sub-step reaches the cut start needs a PIN-04 analogue (no second sub-step).
(4) A new exploit. Today any TRAIL bump is a hit, so the trail can never steer the boss. With a free first bump, search can use its own trail as a deliberate bumper once per cut, turning the boss away and then closing within the fuse's reach. The claim 'a small gain at most' is optimistic. Search is near the ceiling (98.5%), so the absolute gain is capped; the mix's fewer D5 zeros probably still narrow the gap net, but this needs measuring.
(5) The fuse contradicts D4. A RULES_VERSION bump and full regeneration are unavoidable.

*Fixes.* Split it into two proposals. Rewind alone changes R4.5-4 and R4.5-5 and needs only a forward pointer. The fuse alone needs the owner to amend D4. Store only a 2-bit forward pointer (bits 2-3) and derive the predecessor. Hash v2 then packs 4 bits per cell (1,800 B) instead of 8. Pin these: an absorbed fuse hit puts the fuse out; there is no second rewind sub-step after reaching the cut start; the fuse advances at step 5b of the tick it is lit. Mask the cells in every renderer, and compare masked cells in the shadow diff.

*Cost.* Grid stays 3,600 B; Cell storage becomes raw u8 with &3 masks: +2-5% zk cycles (fill, pass, is_rail, boss edges). State +3 B (fuse x, y, lit). Hash v2 preimage 948 to ~2,651 B (8 bits/cell) or ~1,851 B (4 bits/cell). Fuse: 2 pointer hops a tick. RULES_VERSION bump, every vector regenerated, playtest, recalibration, renderer changes.

*Conflicts.* D4; D5; R4.1-2; R4.4-5; R4.5-4; R4.5-5; R4.5-8; R4.6-3; R4.9-2; R4.9-15; PIN-04; state hash v1

**Fairness: ok, 4 of 5; gap narrows; D14 compliant.** Forgiveness applied evenly to every level. Search rarely lets the boss touch its trail and already sits at 98.5% of the ceiling, so it can gain about 1.5% at most. Humans, and bold with its 75%-reach margin that gets nicked, turn a nick into a visible race. They also get a way to abandon a cut without X (which ends the level) and without losing a life. Fewer D5 zeros mean less variance from drawing hard levels. The scripted bots benefit with no new policy, since they cut at 2 cells per tick and close fast, so calibration stays meaningful; only rewind would need a simple rule. Search gains one new trick: the first nick bounces the boss off the trail for free, a steering tool it can time exactly, but the ceiling caps the gain. D14 is untouched. Masking every cell read is a consensus risk across the wasm and zk targets rather than a fairness issue, so it needs differential fuzzing.

*Fixes.* Give bold and committer a rewind rule (rewind when the boss will reach the trail before the cut can close) so the reference mix plays the way humans will. Rerun reports/bot-advantage.md to confirm search's gain stays inside the 1.5% headroom and the mix's ratio falls. Keep the fuse speed a rule constant, not a per-level knob, so it does not need per-level calibration. Add a differential fuzz of the masked grid reads across targets.

**Play: ok, 3 of 5.** Two features are bundled. (1) A fuse after the boss nicks the trail. The fuse burns 2 cells per tick, exactly the fast cut's speed, so holding A always keeps the gap constant. If a path to CLAIMED is open, the answer is nearly always 'hold A and close', with little real choice. (2) Rewind, a backward abort of a cut whose shape went wrong. Both add decisions inside a cut and narrow the bot gap, as constraint 7 prefers. But the first nick per cut becomes free, which softens the boss's one threat to trails and shifts every level's difficulty and calibration. It is also the most pervasive change in this batch: every cell read gains a mask, the hash preimage is about 2.8 times larger, and zk cycles rise by 2-5%. Rewind overlaps with the bail idea ([human-edge#7](human-edge.md#abandon-a-cut-on-demand)) and with X's discard.

*Fixes.* Split it into two ideas and judge each on its own. Drop the forward pointers. When the fuse lights, walk the back pointers once from the head to compute its distance, then keep that distance as a u16 counter: it drops by the fuse's speed each tick and grows by the player's sub-steps. That needs 2 bits per cell (4-bit hash) and no forward bookkeeping. Make the fuse 3 cells per tick, so even A loses ground slowly and the choice becomes close now or brace with the shield.

*Readability.* Good. A single bright spark cell (white or orange) moving along the red trail reads well at 4x4, and rewound cells simply turn back to black.

## Forked Challenge draw

`wild-combinations#9` · T5 Mode, scoring or contracts · score 8 (core 3, fairness 3, play 2) · gap: unclear · D14: compliant

Each Challenge level is offered as a pair of similar-weight levels, for example a corridor level or an open level with an extra minion, and you pick the one that suits your play. Six picks make a run that fits your strengths.

**Rule sketch.** Season files order the 16 levels as 8 weight-matched pairs, slots 2j and 2j + 1, which calibrate sorts by weight. The draw (§8.2) becomes a forward partial Fisher-Yates over the deck \[0..7\]: for i = 0..5, j = i + (h mod (8 - i)) with h = keccak256('jiro.draw' || runNonce || i). Journal v2 adds a u8 pick (0 or 1) to the header, which the browser sets from the player's choice before the level starts. The core returns drawSlot = 2 x deck\[levelIndex\] + pick. The level seed is unchanged (keccak('jiro.level' || runNonce || levelIndex)). The contract's draw check (P17) is unchanged: the season's level at drawSlot must be the level played, so no contract bytecode changes. The decoder rejects pick >= 2.

**Inspired by:** Dancing Eyes (1996), Gal Pani X (2002, demo 2000), Gal Pani II (1996), CYBER FIELD-K (2014), Gals Panic II (1993), Gal Pani X (2002 (demo 2000)), Gals Panic 3 (1995), LadyLove (1990). **Mechanic families:** [Branching stage paths](../taxonomy/level-structure-and-progression.md#branching-stage-paths), [Free choice of stage or character order](../taxonomy/level-structure-and-progression.md#free-choice-of-stage-or-character-order), [Upgrade draft during a run](../taxonomy/items-and-power-ups.md#upgrade-draft-during-a-run), [Segmented score tables](../taxonomy/multiplayer-and-competition.md#segmented-score-tables). **Touches:** rules, outcome, contracts, economy, tools-bots, presentation, journal.

**Decisions it reopens:** P17; §8.2 draw; §7.2 settlement step 5; P4; §8.4 weightsBp; §6.3 journal v1; §8.4 levelIds order; P17 (procedure, not the check).

**Bot effect.** Keeps the gap if pairs are weight-matched; widens it otherwise. Weights normalize the median player's claim, so a player near the ceiling (search at 9,580-9,918 bp on every level) always prefers the higher-weight level of a pair, and the within-pair weight spread is search's whole gain. Humans gain from style fit, which search does not need. Existing exploit, unchanged in kind: a modified client can already retry a level within the commit deadline, and with picks it could try both options of a pair. D14 is unchanged: seeds and deflections are per run, nothing is copyable.

**Budget.** Core: the same 6 keccak calls, plus 1 header byte. Journal v2 decoder and vectors. Calibration must pair levels and report within-pair spread. The season-file convention changes, but no contract change. A browser pick screen. Zero gameplay cycles.

**Variety.** The first player decision in Challenge that is not inside a level: specialists can lean into corridors or open fields, and a run's six levels become partly chosen. This shifts the strategic layer from paying for re-rolls to choosing.

**Merged from:** `level-structure-and-progression#13`. Variants:

- Forked route of matched pairs: At each of the six steps, the run offers two levels of similar difficulty and different style, such as a maze or a cross, a swarm or a titan. You play the one that suits you; both are worth the same.

**Core engineer: feasible, 3 of 5, tier 5.** The sketch is consistent. For pick in {0,1}, drawSlot = 2 x deck\[k\] + pick is a valid slot. Settlement step 3 already maps the played level's id to its slot, and step 5 compares that with Outcome.drawSlot, so Challenge and Season need no change. A RULES_VERSION bump still means a new ZkReferee with a new image id, as for any new core.
Costs and catches:
(1) Journal v2 adds a 1-byte header field and a new decoder error for pick >= 2. Every Challenge vector's drawSlot moves, so RULES_VERSION is bumped and the format vectors regenerate.
(2) Both options share the level seed, keccak('jiro.level' || nonce || levelIndex), so a bot simulates both exactly and always takes the higher weighted ceiling. Its gain equals the within-pair weight spread, for example about 2-5 %.
(3) The pick cannot be bound to 'before the level'. A modified client can try both options by padding, exactly like today's retry within the deadline, so this exploit is not new in kind.
(4) Weight matching is not under calibrate's control: weights come from medians, so pairs can only be formed from levels whose computed weights are close, and the within-pair spread has to be reported.
(5) From mainnet, §8.4 calibrates on the previous season's player journals. With picks, each level's median comes from players who chose it (selection bias), which skews the normalization toward specialists.

*Fixes.* Have calibrate form pairs of adjacent weights and fail if any within-pair spread exceeds a bound (for example 3 %), keeping the P11 curve over the 16 slots. Report search's pick gain in the bot-advantage report. For player-data calibration, weight each level by its pick rate or calibrate on bot data only.

*Cost.* Core: the same 6 keccak calls, journal header 71 -> 72 B (journal v2), one decoder rule. RULES_VERSION bump, regenerated format and Challenge vectors, new ZkReferee image id. No per-tick work, zk +0. Browser: a pick screen. Season-file convention: pairs in slot order.

*Conflicts.* §8.2 draw; P17 (procedure; the check itself is unchanged); §6.3 journal v1; §8.4 levelIds order and calibration; P11 (slot curve with pairs)

**Fairness: concerns, 3 of 5; gap unclear; D14 compliant.** D14 holds: seeds stay per run, and the level seed does not change. But the pick happens after the reveal, when both options' games are fully known: the same level seed with different level bytes. A bot can simulate both and take the better one, a free best-of-two per level, against §6.4's 'the chain chooses the seed, never the client'. A modified client can play both within the deadline and commit the better journal. Search is at the ceiling everywhere, so the seed choice gains it little. It always takes argmax(weight x ceiling), though, so its gain is the within-pair weight spread. With the calibration-1 weights, the easy pairs are tight (open and sentry, 15,503 and 15,586), but the hard ones are 24-28% apart (titan and trio, 28,591 and 35,513; swarm and doom, 50,590 and 64,620), and search would take the heavier level every time. Skilled humans gain from playing the style that suits them, which narrows the gap if the pairs are tight. Self-selection biases any later calibration from public journals, because only players who like a level play it. The variance of the draw falls (6 of 8 pairs, plus a choice), which is fairer. Bots calibrate as now, since every bot plays every level, but run-level reports need a pick policy.

*Fixes.* Fix the picks before the reveal, for example as an 8-bit style mask sent with startRun, carried in the Outcome and checked against the stored mask, so no pick can use the seed. Require a within-pair weight spread of about 2% or less at calibration, and rebuild levels until it holds. Calibrate from all-levels bot data, never from self-selected journals.

**Play: weak, 2 of 5.** Adds one choice before each level and nothing inside the loop of boss, minions, rail, cut, shield and commit. Choosing in a scored, pro-rata mode tends to create dominated options. Players converge on whichever level of each pair is better weighted for its difficulty, so half the pool becomes dead content, and every calibration error becomes exploitable. The bot gap widens more than the pitch says. The level seed does not depend on the pick, so a search bot can simulate both options on this run's seed before choosing and take the better seed-specific outcome; a human chooses only by style. T5 cost: journal v2, the draw procedure and the season-file convention change.

*Fixes.* If players are to have agency over levels, offer it in Training: a 'favourites' playlist. If it must be paid, make the pick blind to the seed. Choose all six picks at purchase, before the nonce is revealed, and commit them with the run, so no one can simulate both options. Also publish the pick rates each season, to catch dominated levels.

*Readability.* Browser-only pick screen. Two level cards side by side read easily.
