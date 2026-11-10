# Ideas: items and power-ups

The 10 ideas proposed from the axis of the [taxonomy](../TAXONOMY.md) *items and power-ups*: pickups and power-ups: how they appear (captured boxes, random drops) and what they do (speed, laser, shield, time stop, extra life, enemy slow, area bombs). Sorted by score. The [index](../IDEAS.md) lists every idea by tier and score, and [`README.md`](../README.md#the-taxonomy-and-the-ideas) explains the judges.

## Hidden glyphs in the reveal picture

`items-and-power-ups#2` · T0 Presentation · score 12 (core 5, fairness 5, play 2) · gap: neutral · D14: compliant

Three faint glyphs sit on open cells of each Training level. Claiming a glyph's cell collects it, and a full set across the 16 levels unlocks a palette or an alternate reveal picture. It is a free, scoreless test of how players route captures toward a marked cell, before anyone pays for enclosure items in the core.

**Rule sketch.** Client-only. At level start, for g = 0..2, the client takes idx = fmix32(u32 of level seed bytes 28..31 XOR g) mod 3600. The glyph sits on the first cell at or after idx, row-major and wrapping, that is EMPTY at level start and outside the boss's start body. After each tick the client already knows which cells changed. A glyph whose cell turned CLAIMED is collected, so trail through it counts only once the cut closes, as in the core. The browser keeps a 3-bit mask per level (6 bytes for 16 levels) in local storage. All three glyphs on a level light its card, and all 48 unlock a palette or an alternate image. Glyphs are never in the score or the core. They are hidden by default in Challenge. Any later core use of seed bytes 28..31 would only correlate with glyph positions, which is harmless for a feature that scores nothing.

**Inspired by:** Super Qix (1987), Power Styx (1988), Gals Panic S - Extra Edition (1997), Gals Panic S2 (1999). **Mechanic families:** [Set collection (letters and tokens)](../taxonomy/items-and-power-ups.md#set-collection-letters-and-tokens), [Enclosure-collected items and boxes](../taxonomy/items-and-power-ups.md#enclosure-collected-items-and-boxes), [Score and currency collectibles](../taxonomy/items-and-power-ups.md#score-and-currency-collectibles). **Touches:** presentation.

**Bot effect.** None on scores. Glyphs are outside the core and the Outcome, so the gap between search and humans is unchanged, and bots ignore them. As a by-product it measures how far humans deviate to enclose a cell, and how often that costs a life. That data can size the T3 cache ideas before any RULES_VERSION bump.

**Budget.** Zero zk cycles and no consensus change. Browser: trivial. Palette: reuse an existing dim colour.

**Variety.** A low-stakes detour decision: enclose the glyph now with a bigger cut, or come back for it. It also gives Training a collection goal across all 16 levels, which today has only scores.

**Core engineer: feasible, 5 of 5, tier 0.** Truly client-only. Positions come from seed bytes 28-31 and the start grid, and collection reads the CLAIMED cells that the renderer's dirty-cell diff already sees. No consensus, zk or vector impact, and no change to RULES_VERSION, the hash or the formats.

In Training the nonce is arbitrary, so glyph cells move from play to play, which is fine. The detour data it gathers is a useful by-product.

*Cost.* - Zero zk cycles; no format, hash or RULES_VERSION change.
- Browser: trivial.

**Fairness: ok, 5 of 5; gap neutral; D14 compliant.** Client-only: glyphs never enter the core, the Outcome or the score, so there is no effect on consensus, bots or calibration. Seed bytes 28-31 are public once the nonce is revealed, so glyph positions leak nothing, and a later core use of those bytes only correlates with something worth nothing. A cosmetic, local unlock gives bots no reason to farm. The one fairness point is Challenge: a visible glyph lures a human into a detour that costs paid score. That is the player's choice, but glyphs should stay off there by default, as written. The data has limited value: a detour that costs no score understates how far players will go for an item that scores.

*Fixes.* Keep glyphs hidden in Challenge, or show them but never count a Challenge collection. Keep unlocks local and non-transferable so they never become a bot target. If the data is used to size the T3 item ideas, account for the bias that the detour was free.

**Play: weak, 2 of 5.** Cheap and harmless, with no consensus impact, but little play value. It adds a side goal: a level clears at the target, so the three glyph cells must fall inside the area you take before you clear, and that gently shapes the order of captures. Masks accumulate across runs and score nothing, so the pressure is low. It doesn't touch the boss, minions, fast cut, shield or commit beyond an optional detour. Hidden in Challenge, so it does nothing for paid play. Its best arguments are outside play value: a collection goal for Training, and data on how far players detour to enclose a marked cell, which could size the T3 pickup ideas. Title and rule disagree: the rule draws visible marks on EMPTY cells, so the glyphs aren't hidden. Distinct from the 16 levels, which have no collectibles.

*Fixes.* Rename it, since the glyphs are visible. Show per-level collection on the level-select card, and give the all-48 unlock a visible tease, so the goal is known before play. To give it bite, require all three glyphs in a single run for the level's mark. If the data use is the real goal, log detour-and-hit events explicitly in Training telemetry rather than inferring them from saves.

*Readability.* Fine if it isn't 'faint'. A single 4x4 cell in a dim colour on black is easy to miss, and a 'glyph' can't be a shape at 4x4 px. Use a mid-brightness hue, maybe a 2x2 px dot centred in the cell, so it doesn't read as a hazard (sweeper, token) or a pickup on the rail.

## Last-life lifeline on the rail

`items-and-power-ups#8` · T3 New core rule · score 12 (core 4, fairness 4, play 4) · gap: narrows · D14: compliant

When a hit leaves you on your last life with at least half the target claimed, a lifeline appears on a far rail cell. Commit now and bank the claim, or walk the rail past the minions to fetch a life back and keep pushing.

**Rule sketch.** The lifeline key is the big-endian u32 of seed bytes 17..20. State hash v2 adds 4 bytes: lifeline {present u8, x u8, y u8} and lifeline_used u8. Spawn happens at step 6, after the resolution of R4.9-13, when all of these hold: a life was lost this tick, lives = 1, claim_bp × 2 ≥ target, lifeline_used = 0, and none is present. Then h = fmix32(key XOR tick), and a scan from h mod 3600 (row-major, wrapping) takes the first rail cell at Manhattan distance 24 or more from the player, or the first rail cell if none is that far. Taking happens at step 3: when the player enters the lifeline's cell on any sub-step while invulnerability ticks = 0, lives += 1, the lifeline disappears and lifeline_used = 1. Requiring invulnerability 0 means the 30 protected ticks after the hit cannot be used to fetch it. At a capture, alongside R4.7-8, a lifeline whose cell is no longer a rail cell moves to the first rail cell in row-major order, as R4.7-7 does for minions. Minions ignore it. An optional v2 level flag can turn it off per level.

**Inspired by:** Xonix (KolibriOS) (2006), Bubble.Fill: Retro Area Arcade (2025), Gals Panic (1990). **Mechanic families:** [Catch-up pickups](../taxonomy/items-and-power-ups.md#catch-up-pickups), [Extra lives and revives](../taxonomy/items-and-power-ups.md#extra-lives-and-revives), [Field pickups collected by touch](../taxonomy/items-and-power-ups.md#field-pickups-collected-by-touch). **Touches:** rules, state-hash, presentation, tools-bots.

**Decisions it reopens:** D5; R4.9-13; R4.7-8.

**Bot effect.** Narrows the gap. Search almost never reaches its last life, so the lifeline is worth little to it, while humans and the committer bot reach it often. It turns some commits and some zeroed levels into finished levels, which lifts the bottom of the distribution. Search learns the cell only a few ticks before a human sees it, so no meaningful information gap opens. The committer presses X the moment it is on its last life, so it needs a rule: walk to a visible lifeline if no minion is within k rail cells of the route, then decide again. Calibration must rerun, because mix claims on the hard levels will rise.

**Budget.** \+4 bytes of state. At most once per level: one fmix32 and a scan of up to 3,600 cells with an 8-neighbour rail test (about 30k cell reads). Per tick: one position compare at step 3. zk cost is negligible. Screen: one rail cell in a distinct colour.

**Variety.** Gives the commit decision a third option at the moment it matters most. It also makes the rail, today just a road, a place you travel to on purpose, past the minions, with no invulnerability to hide behind.

**Core engineer: feasible with changes, 4 of 5, tier 3.** Cheap and deterministic:

- The key comes from free seed bytes 17-20.
- At most one scan per level.
- The rail is never empty (R4.7-11), so the fallback cell exists.

Issues:
(1) Rail moves are 4-directional, so reaching a cell at Manhattan distance ≥ 24 takes at least 24 of the 30 protected ticks. A player who arrives while still invulnerable must step off and back on, because only entering counts.
(2) Manhattan distance does not mean reachable along the rail. On levels with interior obstacles (comb, cross, maze, labyrinth, ring), the scan can land on an island's rail, which only a cut can reach. That works, since closing a cut onto the cell is entering it, but it breaks the pitch's 'walk the rail past the minions'.
(3) Pin the order between taking the lifeline on a closing sub-step and the relocation at that capture.
(4) Search can pick its hit tick to steer h, but it rarely reaches its last life, so this is negligible.

It softens D5's zero without removing it. The 'narrows the gap' claim is plausible, because search almost never plays on its last life. Calibration must rerun: hard-level claims of the mix will rise. Without the optional level flag the rule applies to every level, with no format change; with it, add T2.

*Fixes.* - Take the lifeline when the player is on its cell at the end of any sub-step with invulnerability 0, so standing counts.
- Choose the cell by walking the player's own rail component with the minion right-hand rule from the player's cell: D7 guarantees it covers the component, no buffer is needed. Take the first cell at distance ≥ 24 after h mod (steps) steps.
- Pin: take the lifeline before relocating it at a capture.

*Cost.* - State: +4 B, hash v2.
- Once per level: a scan of at most 3,600 cells × 9 reads, or a bounded rail walk of at most 4|C| steps. Per tick: one compare.
- zk under 0.1%.
- No level change, unless the optional flag is added.
- RULES_VERSION bump, vectors, playtest and calibration.

*Conflicts.* D5; R4.9-13; R4.9-17; R4.7-8; R4.3-2; §6.4 seed bytes 17-20; state hash v1

**Fairness: ok, 4 of 5; gap narrows; D14 compliant.** D14 holds: the cell comes from fmix32 of seed bytes 17-20 XOR the hit tick, so it depends on the run and on its history, with no safe zone and nothing copyable. Search clears every level and almost never reaches its last life, so the lifeline is worth little to it. For humans and the committer bot it turns some D5 zeros into finished levels, which narrows the gap at the bottom of the distribution. There is no deliberate-loss exploit: triggering it costs two lives to get one back, once per level. Caveat: on 01-open (no minions) the rail is completely safe, so the lifeline is a free fourth life once half the target is claimed, and the commit decision disappears on that level. Elsewhere, minion periods of 1-3 make the walk a real risk, as intended. Wording gap: 'enters the cell while invulnerability = 0' means a player who arrives during the 30 protected ticks and stands still never collects it. It amends D5 and needs a calibration rerun, as the pitch says.

*Fixes.* Turn it off with the level flag on levels without minions, or require at least one live minion for it to spawn. Define taking as 'the player is on the cell at the end of step 3 with invulnerability 0', not 'enters the cell'. Teach the committer the fetch rule before calibrating. Record the D5 amendment as an owner decision.

**Play: strong, 4 of 5.** It hits the game's signature decision at the moment it matters most. On your last life with at least half the target claimed, commit no longer has only 'bank or keep cutting': a third branch, risk everything to fetch a life, appears. It makes the rail a destination rather than a road. You must route past clockwise-patrolling minions, or reach the cell with a cut that closes on it, which brings the boss into the choice. It is a pure risk choice rather than free help, because a minion hit on the way scores 0 (D5 intact). It narrows the human-versus-search gap, which few ideas do. It is distinct (no level has pickups), cheap, and nothing like it exists today. Downsides: it fires at most once per level, only for players in trouble, so strong players rarely see it. On a level without minions (01 open), the rail is completely safe, so the lifeline is a free life. The rule that invulnerability must be 0 is fiddly: a player who arrives in under 30 ticks touches the cell and nothing happens. A 24-cell Manhattan distance can also land the lifeline on an island rail component reachable only by a cut.

*Fixes.* Make the lifeline appear (or light up) when invulnerability ends rather than on the hit tick, so touching it always works and the fetch always starts unprotected. Turn it off by default on levels with no minions, or require at least one live minion to spawn it. Decide whether island placements are intended (a cut-to-fetch choice) or restrict the scan to the player's rail component. Give the committer bot the walk-if-clear rule before calibration.

*Readability.* Very good. One bright cell, say white or green and maybe pulsing, on the blue rail stands out at 4x4 px. The whole field is always visible, so the route past minions can be read at once.

## Barbed trail after a big capture

`items-and-power-ups#10` · T3 New core rule · score 11 (core 4, fairness 4, play 3) · gap: narrows · D14: compliant

A single capture of at least N cells arms your next trail with a barb. The first time the boss bumps it, the boss bounces off stunned instead of hitting you, and stays still for a second while you finish the cut. Big captures pay for bolder ones.

**Rule sketch.** Level bytes v2 append barb_cells u16 (0 turns it off). State hash v2 adds 2 bytes: player barb u8 (0 or 1) and boss stun u8. Arming, at step 3: a capture whose size (R4.8-4) is at least barb_cells sets barb = 1. Step 4: if stun > 0, stun goes down by 1 and the boss neither moves nor draws, like any tick it doesn't move (R4.6-11). Otherwise R4.6-7 and R4.6-3 run as written, with one exception: when an edge test finds TRAIL and barb = 1, the velocity component still inverts, but no hit is set, barb becomes 0 and stun becomes 15. A second TRAIL edge on the same move hits as usual. Losing a life (R4.9-16) clears barb. Minion hits are unchanged. No new seed material.

**Inspired by:** Dancing Eyes (1996), Cobweb (1989), Space Cutter (2026), looprush (2026), Gals Panic 4 (1996). **Mechanic families:** [Stun effects](../taxonomy/items-and-power-ups.md#stun-effects), [Shield and invincibility](../taxonomy/items-and-power-ups.md#shield-and-invincibility), [Meter-charged powers](../taxonomy/items-and-power-ups.md#meter-charged-powers), [Items revealed or generated by capture](../taxonomy/items-and-power-ups.md#items-revealed-or-generated-by-capture). **Touches:** rules, state-hash, level-format, level-data, presentation, tools-bots.

**Decisions it reopens:** D6; R4.6-3; R4.9-2; R4.4-9.

**Bot effect.** Keeps the score gap and widens it slightly on ticks. Search already makes big captures and foresees bumps, so it arms and spends barbs perfectly. Since its score is at the ceiling, it mostly uses them to finish levels in fewer ticks, which only matters for the tiebreak. Humans gain a visible, earned safety net that rewards the skill the game already asks for, and the mix will arm barbs by accident on large rectangles and lose fewer lives. Bold could also be taught a thinner margin while barbed.

**Budget.** \+2 bytes of state. One compare per capture, and one per boss edge test that finds TRAIL. Negligible per-tick and zk cost. Screen: while barbed, the trail is drawn in a second colour from its first cell, and spending the barb recolours the open trail once (up to a few hundred cells, one time).

**Variety.** Chains captures: a big capture earns the right to a riskier one, so players plan sequences rather than single cuts. The boss stunned against your line is a new tactical moment: one second to close with A.

**Core engineer: feasible with changes, 4 of 5, tier 3.** A small, local change to R4.6-3:

- A barbed bump still inverts the velocity, so the body never enters TRAIL and R4.6-1 holds.
- The stun skips moves and draws. That stays deterministic, and R4.6-12's divergence still holds because draws resume.
- State is 2 bytes.

Issues:
(1) The pitch says the barb arms 'your next trail', but the rule as written keeps it armed across cuts until it is spent or a life is lost. Pick one.
(2) The stun of 15 is a new constant and belongs in §4.
(3) A stunned boss sits frozen at a known position for 15 ticks, up to 30 trail cells with A. Search can bait a bump on purpose by laying trail into the boss's path, cut around the frozen boss, and chain arm, stun, big capture, re-arm when barb_cells is low. On levels with a low threshold that widens the gap more than 'slightly'.
(4) Pin that the stun counts down on every tick, including ticks the boss would not move.
(5) Renderer: when the trail colour changes, change the trail's colour-table entry and repaint the open trail once, rather than tracking per-cell colours.

The mix will lose fewer lives on large rectangles, so calibration moves.

*Fixes.* - Pin the barb's lifetime (until spent or a life is lost, or cleared when a cut closes).
- Make the stun a §4 constant that counts down every tick.
- Bound stun chains: a capture made while the boss is stunned does not re-arm, or validity requires barb_cells ≥ about 10% of claimable.
- Teach the bold policy a thinner margin while barbed, if desired, before calibration.

*Cost.* - Level v2: +2 B.
- State: +2 B, hash v2.
- One compare per capture and one per TRAIL edge: zk negligible.
- RULES_VERSION bump, vectors, playtest and calibration.

*Conflicts.* D6; R4.6-3; R4.6-11; R4.9-2; R4.9-16; R4.4-9; state hash v1

**Fairness: ok, 4 of 5; gap narrows; D14 compliant.** D14 holds: no seed material is used, and where and when a stun happens follows from the seeded boss path, so it differs per run. An earned second shield prevents the boss-bump deaths that cause most human zeros, and the mix arms it by accident on large rectangles, so the score gap narrows. Two edges favour search. (1) During the 15-tick stun the boss tests no edges, so trail can be drawn flush against its body. Search can engineer a bump against a U-cut around a boss that sits near a wall or claimed area, then close the U before the stun ends and box the boss into almost exactly its own cells, reaching the ceiling. Human reaction time rules that route out. The gain is at most the 1.5% search still lacks. (2) A corner bump with TRAIL on both edges of the same move still kills: search sees it coming, humans cannot read it. Both effects are small. The idea reopens D6 (one shield charge per level).

*Fixes.* Let the barb absorb every TRAIL edge of the move it fires on. Shorten the stun to a few ticks, or drop it so the bump is absorbed and the boss keeps moving; that removes the box-the-stunned-boss route. Take D6 back to the owner.

**Play: ok, 3 of 5.** The stunned boss pinned against your line is a genuinely new tactical moment: 15 ticks to close with A. The reward loop (big capture, then a bolder next cut) adds sequencing to capture planning. But as written, the barb lasts until the boss bumps the trail or a life is lost, not just for the next cut. That makes it a renewable, passive, boss-only shield that re-arms on every big capture, which weakens D6's deliberate one-charge-per-level scarcity and the tension of the shield (B). Big captures are already rewarded by claim, so the barb amplifies an existing incentive more than it creates a new tradeoff. It mostly removes risk for players who are already doing well (snowballing). The pitch says 'arms your next trail', which is the better design, but the rule sketch doesn't do it.

*Fixes.* Make it use-it-or-lose-it: the barb lapses when the next cut closes or is discarded (the pitch's own wording). That forces a bold-next-cut decision rather than passive insurance. Set barb_cells high enough (say 12-15% of the level) that a level arms it only 1-3 times. Show the stun on the boss (flash or colour swap) so the 15-tick window can be read.

*Readability.* Good if colours are chosen with care. A barbed trail in a second colour must be clearly different from TRAIL red at 4x4 px, so use yellow or white rather than orange. A stunned boss needs a visible state, such as a palette swap. Recolouring the open trail once when the barb is spent is cheap.

## Counter-patrolling warden

`items-and-power-ups#9` · T3 New core rule · score 11 (core 4, fairness 4, play 3) · gap: narrows · D14: compliant

A friendly warden walks the rail the opposite way round from the minions and destroys any minion it meets. Cut behind it while the stretch it has just swept is clear, or follow in its wake along the rail.

**Rule sketch.** Level bytes v2 append a warden spawn (u8 x, u8 y; 255, 255 for none; validity: a rail cell) and a warden period u8 (at least 1 when there is a warden). State hash v2 adds 5 bytes: warden {presence u8, x u8, y u8, heading u8, period u8}. Movement mirrors R4.7-2: it tries left, straight, right, then back, and takes the first rail cell. Its orientation step, at spawn and after every capture, takes the first heading in N, E, S, W with open field on its left, meaning the 4-neighbour a quarter turn counterclockwise (W for N, N for E, E for S, S for W). Failing that, it takes the first with open field behind its left (SW, NW, NE, SE). So it traces the field boundary counterclockwise, against the minions, and D7's coverage argument holds by symmetry.

New step 5b, after the minions: the warden moves from w0 to w1 when tick % period == 0. Then each live minion whose step-5 cells are (a, b) is destroyed with countdown R if b = w1 (they share a cell) or if a = w1 and b = w0 (they swapped). At a capture, a warden whose cell is no longer a rail cell moves at once to the first rail cell in row-major order and runs its orientation step. It never hits, blocks or shields the player. No seed use.

**Inspired by:** Jeepers Creepers (1982), Kingdom Cutter: Cut & Conquer (2026), Xonix Blast (2012). **Mechanic families:** [Allied helpers](../taxonomy/items-and-power-ups.md#allied-helpers), [Area bombs and enemy wipes](../taxonomy/items-and-power-ups.md#area-bombs-and-enemy-wipes). **Touches:** rules, state-hash, level-format, level-data, presentation, tools-bots.

**Decisions it reopens:** D7; R4.4-5; R4.3-1; R4.7-2.

**Bot effect.** Keeps or slightly narrows the gap. The warden is deterministic and visible. It makes the minion-heavy levels (trio, swarm, doom), where the reference mix scores least, more survivable for everyone, while search, already near the ceiling there, gains little score. Scripted bots benefit with no new code, since minions simply vanish more often; a 'cut behind the warden' heuristic would help them more. The warden is seed-free like the minions, and the boss stays seeded, so no learnable safe zone appears.

**Budget.** \+5 bytes of state. Per tick: one more rail walker (a few neighbour reads) and up to 3 meeting tests. One orientation step per capture. zk cycles under 1%. Screen: one more moving cell in an unused colour.

**Variety.** The first friendly unit. Minion levels gain a rhythm: the warden sweeps, the respawn countdown runs, and the player cuts in the gap. On the hardest levels a designer can trade a threat for an ally instead of only lowering knobs.

**Core engineer: feasible, 4 of 5, tier 3.** The warden's rules are the exact mirror image of R4.7-2 and R4.7-3: left, straight, right, back; orientation N, E, S, W with the counterclockwise 4-neighbour, then behind-left. So PIN-14's coverage holds for it by reflection, and it can reuse the minion walker with a handedness bit.

The meeting predicate is right for walkers that move one cell at a time: walkers coming at each other along a 4-connected path either share a cell (b = w1) or swap (a = w1, b = w0), and the predicate also covers either side standing still.

Caveats:

- 'Destroys any minion it meets' assumes the counterclockwise trace is the exact reverse of the clockwise one. Around corner cells that touch the field only diagonally, and on spurs, the two traces can differ locally, so a minion may occasionally slip past. That stays deterministic, but measure it rather than promise it.
- The cost is underestimated. open-field-empty, with no minions, runs about 330 cycles per tick in all, and 05-worst, with 2 minions, about 1,200. One walker at period 1 is about 0.5-1.5M cycles per level: roughly 2-5% of the heaviest level and a larger share of light ones. The proving price still barely moves, because ~87% of it is fixed.
- Spawn camping: a warden passing a minion's spawn kills it the tick it respawns (share case). That can zero a level's minion pressure, so it is a designer knob.

Seed-free like the minions while the boss stays seeded, so no new learnable safe zone. The gap claim (neutral to slightly narrowing on minion-heavy levels) is plausible.

*Fixes.* - Implement the warden as a walker with a handedness parameter (mirrored turn order and orientation), not as new code.
- Validity: spawn on a rail cell, period ≥ 1.
- Add the PIN-14 property test for the mirrored walker, and a measured slip-past rate in the meeting test.
- Decide whether spawn camping is acceptable: if not, make a minion that has just respawned immune for one tick.

*Cost.* - Level v2: +3 B.
- State: +5 B, hash v2.
- Per move: a few hundred cycles. About 2-5% of the heaviest level; proving price under +0.5%. One orientation step per capture.
- RULES_VERSION bump, new step 5b, vectors, playtest and calibration.

*Conflicts.* D7; PIN-14; R4.4-5 (step 5b); R4.3-1; R4.7-2; R4.7-3; R4.7-8; R4.7-9 (a new cause of destruction); state hash v1

**Fairness: ok, 4 of 5; gap narrows; D14 compliant.** The warden uses no seed, like the minions. Its schedule of minion kills before the first capture is the same in every run of a level, but minions are already seed-free, and the boss, which D14 protects, stays seeded. So it adds no boss-free zone and nothing copyable. It helps most where the mix is weakest: on trio, swarm and doom the mix clears 20%, 21% and 11% of levels, while search clears 100% at 96-98% of the ceiling and has at most about 2% left to gain. So the gap narrows. Scripted bots benefit without new code, calibration is straightforward, and there is no seeded variance. Spec gaps: (1) a minion that moves onto the player at step 5 and is destroyed at step 5b cannot hit at step 6, since R4.9-7 says a destroyed minion has no cell, so the warden silently saves the player; that must be pinned. (2) The countdown of a minion destroyed after step 5 has run conflicts with R4.7-9's 'drops from the tick of its destruction on'. (3) The D7 symmetry claim for the counterclockwise patrol needs its own property test, not just the argument.

*Fixes.* Pin both step-5b details in §4.7 and §4.9 as PIN tags. Extend the M1.7 coverage test to the warden's counterclockwise patrol and to its relocation after a capture. Optionally seed the warden's start phase, if play data shows the fixed kill schedule turning into a memorized opening.

**Play: ok, 3 of 5.** The first friendly unit, and a readable rhythm on minion-heavy levels: the warden kills a minion head-on, the respawn countdown runs, and the swept stretch of rail is briefly safe for starting or closing a cut. But the player can't influence the warden. Its decisions are passive: watch where it is and time around it. Its main effect is fewer live minions, which is mostly a difficulty knob, and the 'not just difficulty' test is where it is weakest. Killed minions respawn at their spawn cells, so those cells become predictable hot spots, a small new read. D7 by mirror symmetry is plausible but must be re-proved with the property test. The rule is ambiguous about whether the meeting test runs on ticks the warden doesn't move; it should, with w1 = w0, or a minion can walk into a standing warden unharmed. It doesn't clash with the game's feel, and it is distinct from all 16 levels.

*Fixes.* Clarify that the meeting test runs every tick, with w1 = w0 when the warden stands still. Give the player agency: the warden could be earned (it appears after a capture of at least N cells), or reverse direction at each capture, so where you capture steers where it sweeps. Cap it at one per level, and keep it on minion levels only.

*Readability.* Adequate. One more single-cell rail walker, so it must be unmistakably friendly by colour (cyan or green against hostile red or magenta minions). When the player and the warden overlap on the rail, draw the player on top.

## Reversal charges on the spare key

`items-and-power-ups#12` · T4 Input or journal · score 11 (core 3, fairness 4, play 4) · gap: narrows · D14: compliant

The unused Y key gets a few charges per level. Pressing it sends the boss back the way it came and makes every minion stagger for a second. Spend one to save a cut that is about to be hit, or keep it for the big final capture.

**Rule sketch.** Input mask bit 7 becomes Y in journal v2 (version 2), so the decoder no longer rejects bit 7 (code 10 is dropped). Level bytes v2 append reverse charges u8 (0..3). State hash v2 adds 2 bytes: reverse charges u8 and minion stagger u8. New step 2b, after Commit and before Player: on a Y press, Y held in this tick's mask but not in the previous tick's (detected the way R4.5-7 detects a B press), and with charges > 0, charges go down by 1, the boss's vx and vy both invert, and stagger = 15. The body never moves at 2b; its next move tests the new leading edges under R4.6-3, with any TRAIL hit as usual. Step 5: while stagger > 0, live minions don't move (respawn countdowns still tick), and stagger goes down by 1 at the end of step 5. Browser: one more rebindable key. No new seed material.

**Inspired by:** AQuix (1997), Zolyx (1987), Bolyx (2001), Kid Grid (1982), Amidar (1982), Potty Painter (1983). **Mechanic families:** [Enemy direction reversal](../taxonomy/items-and-power-ups.md#enemy-direction-reversal), [Limited escape charges](../taxonomy/items-and-power-ups.md#limited-escape-charges), [On-demand powers and upgradable skills](../taxonomy/items-and-power-ups.md#on-demand-powers-and-upgradable-skills), [Stun effects](../taxonomy/items-and-power-ups.md#stun-effects). **Touches:** input, journal, rules, state-hash, level-format, level-data, presentation, tools-bots.

**Decisions it reopens:** D8; R4.4-5; R4.4-6; R4.7-10.

**Bot effect.** Narrows the score gap and widens the precision gap. Search reverses on exactly the move before a bump it foresees. A human reacts 3 to 5 ticks late (200-300 ms), which at boss period 1 is 3 to 5 cells, so humans must reverse earlier and waste some charges. But search rarely loses lives and is at 98.5% of the ceiling, so charges are worth more to humans and to the mix, and the pot-share ratio should drop. It does not reopen D8's concern: it is an instant action while the clock runs, not a pause, so it gives no free thinking time. Scripted bots need a trigger (reverse when the boss's next edges reach the trail within k moves).

**Budget.** \+2 bytes of state, 1 byte of level data, and the same journal event size, but a new journal version plus regenerated journal vectors. Per tick: one mask edge test. Per press: two negations. zk cost is negligible. Screen: up to 3 charge pips on the HUD.

**Variety.** The first active, player-timed defence: today every protection is passive (B held in advance). It adds the choice 'spend it now or keep it for the finale', and lets bold players start cuts the boss would otherwise catch.

**Core engineer: feasible, 3 of 5, tier 4.** Builds as stated. The press is an edge of the journaled mask. The previous mask is already state (the hash's mask field), as press_tick is for B. A press does two negations and sets a counter, and draws no seed, so D14 and the R4.6-12 divergence argument are untouched. The body never moves at 2b, so R4.6-3 and R4.6-10 still keep it on EMPTY cells only. A reversal right after a bounce points back into the wall and just re-bounces on that axis, which is worth a hint but is not a bug. The bot claim is plausible: search sits at 0.985 of the ceiling and never loses lives, so charges mostly help humans and the mix. The cost is wider than the budget line suggests. (1) Three format bumps at once: journal v2 for bit 7, level v2 for the charges, state hash v2 (948 to 950 B). With RULES_VERSION 3, every journal, outcome and trace vector is regenerated. (2) It spends the last reserved mask bit, so any later input needs a wider event: journal v3 with 4-byte events. (3) D8 is an owner decision whose text says Y stays unused. Its rationale (a pause gives free thinking time) is not hit, but the decision must be reopened. (4) The tick-0 case needs a PIN: Y in the tick-0 event counts as a press, like PIN-03. (5) Calibration needs a scripted reversal trigger. Otherwise the mix never spends charges, and the weights misprice what humans do.

*Fixes.* Add a PIN: Y held at tick 0 is a press. Add a validity code for charges > 3. State in §6.1 that bit 7 was the last spare. Give bold and committer a reversal trigger before recalibrating. Optionally make charges a core constant (for example 1) to skip level v2. Optionally drop the minion stagger so the press has one effect.

*Cost.* State +2 B (preimage 950 B), level +1 B (473 B). Journal v2 keeps 3-byte events and drops decode code 10. Per tick: one mask edge test and one stagger compare, about 20 RV32 instructions, about 54k cycles per 2,700-tick level, under 0.2% zk. Per press: 2 negations. Versions: journal v2, level v2, state hash v2, RULES_VERSION 3. All journal and game vectors, traces included, regenerated. Playtest rerun and recalibration.

*Conflicts.* D8; R4.4-5; R4.4-6; R4.7-10; §6.1 bit 7 reserved; §6.3 decode code 10; PIN-03 (tick-0 press analogue)

**Fairness: ok, 4 of 5; gap narrows; D14 compliant.** D14 holds. Deflection draws stay keyed by tick, so a reversed boss does not retrace a known path. No seed-independent safe zone appears, and nothing becomes precomputable. On the gap I agree with the pitch: the pot-share ratio should narrow. Search never runs out of lives (100% clears, 98.5% of the ceiling), so charges can lift it by at most the remaining ~1.5%. The reference mix loses most of its points to levels zeroed under D5 (bold clears 3.6 of 6 levels per run), so a panic button that saves a life is worth far more to it. Search does gain a small boss-herding tool for its final cage, but no new ceiling. D8's concern does not apply: the action is instant and the clock keeps running. Calibration works, with one catch: a scripted trigger (reverse when the boss's next edge reaches the trail within k moves) has 0-tick reaction time. The mix would then use charges better than humans, who react 3 to 5 ticks late, and the hard levels' weights would drop more than human data would justify. The per-level charge count (0..3) is level data that per-slot weights absorb, so no new draw variance. Gaps in the spec: it must say that frozen (staggered) minions still hit by the share case (R4.9-9) when the player walks into them, and that a reversal toward a trail on the far side hits as usual (it does say this).

*Fixes.* Give the calibration bots' reversal trigger a 3 to 5 tick reaction delay so the mix does not overstate human benefit. State that staggered minions still hit by the share case. Rerun bot-advantage with search allowed to spend charges, to confirm the ratio drops. Revise D8 explicitly (owner decision) rather than just repurposing bit 7.

**Play: strong, 4 of 5.** Adds a real decision the game lacks. Today all protection is passive: B has to be held in advance, which halves your speed. A reversal charge is spent in the moment, and each one asks 'save this cut, or keep it for the final cage?'. It creates new situations. You can start a long cut that a boss heading your way would otherwise catch. You can push the boss back toward a region you are about to wall off, for a little herding control on top of the seeded deflections. The 15-tick minion freeze lets you slip past a minion on the rail. It does not overlap the shield: the shield answers a hit you can't avoid, the reversal heads off a hit you can see coming. It keeps the feel of the game: no pause and no free thinking time, so D8's reason doesn't apply, though D8's letter still needs the owner's sign-off. Risks: with 3 charges on every level it becomes a panic button that takes the danger out of long cuts. At boss period 1, humans react 3 to 5 cells late, so they waste charges that search never wastes. No current level has an active item, so it is distinct from all 16.

*Fixes.* Keep charges scarce: 1 on most Challenge levels, 0 on a few, 2 or 3 only in Training and lessons, so the hold-or-spend tension stays. Make the stagger visible: a stunned palette colour on the minion cells for the 15 ticks. Show the charges as HUD pips that flash when spent. Before any Challenge season uses it, give the scripted bots a reversal trigger and get the owner's explicit decision revisiting D8.

*Readability.* Good. The boss body is 8 to 32 px, so a reversal is obvious. Charges fit as up to 3 HUD pips. The minion stagger is readable only if frozen minions switch to a distinct colour, since a minion is one 4x4 px cell.

## Stranding a minion refills the shield

`items-and-power-ups#5` · T3 New core rule · score 11 (core 4, fairness 3, play 4) · gap: unclear · D14: compliant

Strand a minion by closing a capture around the stretch of rail it is walking, and you gain a shield charge, up to three. Ambush cuts, timed so the minion is inside the enclosed stretch when the cut closes, become the way to earn protection.

**Rule sketch.** Amend R4.7-8 (step 3, at a capture): after the capture pass, for each live minion destroyed because its cell is no longer a rail cell, in minion index order, shield charges = min(3, charges + 1). Nothing else changes. R4.9-15 still spends one charge per absorbed hit while B is held, and destroyed minions still respawn after R (R4.7-9). There is no new field: state hash v1 already stores shield charges as a u8, and level bytes are unchanged, so no format version moves. RULES_VERSION goes from 2 to 3, and only vectors in which a minion is stranded change. An optional T2 extension adds a level byte for the cap, with 0 turning the rule off. No seed use: strands depend only on the player's captures and the deterministic minion patrol.

**Inspired by:** Orbis: Bubble Fill Reflex Game (2026), Gal Pani X (2002), Qix Adventure (1999), Space Cutter (2026), looprush (2026), Live Wire! (1999), Ttangttameokgi-wang (tail-enclosing land grab) (listing dated 2026). **Mechanic families:** [Absorb enemy powers](../taxonomy/items-and-power-ups.md#absorb-enemy-powers), [Enemy drops](../taxonomy/items-and-power-ups.md#enemy-drops), [Shield and invincibility](../taxonomy/items-and-power-ups.md#shield-and-invincibility), [Trail cut eliminates its owner](../taxonomy/multiplayer-and-competition.md#trail-cut-eliminates-its-owner), [Respawn rules](../taxonomy/multiplayer-and-competition.md#respawn-rules). **Touches:** rules, tools-bots, presentation.

**Decisions it reopens:** D6; D7; R4.7-8.

**Bot effect.** Keeps the gap and may narrow it slightly. Minion patrols are deterministic, seed-free and visible, so a human can read an ambush about as well as search computes one. Search gains charges it rarely needs at 98.5% of the ceiling, while a skilled human turns them into fewer zeroed levels. Scripted bots never hold B, so they gain nothing until taught to hold B when a hit is predicted and a charge is left. Calibration must decide whether the reference mix learns that, or the weights will under-price the rule's value to humans.

**Budget.** One compare and increment per stranded minion, inside the capture's existing lifecycle loop. No per-tick work, no RAM, no format change, unmeasurable zk cost. The full rule-change process still applies: README §4 text, vectors, playtest and recalibration. Screen: the HUD shows up to 3 charge pips. The cheapest rule change in this list.

**Variety.** Gives minions a positive side: today they are only avoided. It adds an ambush timing decision (start the cut ahead of an oncoming minion, close it behind) and makes B's charges renewable, so shielded pushes become a planned second phase of a level. It pairs naturally with caged minions.

**Merged from:** `multiplayer-and-competition#9`. Variants:

- Minion bounty refills the shield: Strand a minion with a capture and your shield charge comes back, so hunting the rail patrollers becomes a reason to choose where and when you cut.

**Core engineer: feasible, 4 of 5, tier 3.** The cheapest of these rules. Minions::after_capture already branches on `grid.is_rail(pos)`, and that branch is where the increment goes. min(3, ...) fits the hashed u8. The game.rs order puts after_capture before the clear check, so on a clearing capture the final-tick hash shows the refund. Pin that. Skeptical points: (1) Strands are not rare ambushes. Any capture that encloses the rail stretch a minion is walking strands it, for example the border segment inside a U-cut from the border, and minions walk the rail near the player. With R = 45 to 90 ticks and up to 3 minions, a B-holding human on swarm or doom can keep 3 charges most of the time. (2) The scripted mix and search never press B, so calibration prices minion levels as if the rule did not exist. Human scores rise exactly where weights are highest. That narrows the gap toward humans but rewards B skill unevenly across the draw. (3) A search that adds B to its action set gains a hit buffer for riskier lines; at 98.5% of the ceiling that matters little. No seed use, no safe zone. Touches D6 and amends PIN-17's R4.7-8.

*Fixes.* Optional: cap the refill at the level's starting charges, or at 1 per capture, if playtests show charge farming. Pin that the refund applies inside after_capture, before the clear check. Decide whether the reference mix learns to hold B before the season that uses it.

*Cost.* 0 B RAM, no format change, state hash stays v1. One increment per stranded minion inside the existing capture lifecycle; zk unmeasurable. RULES_VERSION 2 -> 3; vectors with a stranding move at the shield byte; playtest and calibration rerun. HUD shows up to 3 pips.

*Conflicts.* D6; D7; R4.7-8; PIN-17

**Fairness: concerns, 3 of 5; gap unclear; D14 compliant.** D14 holds. Minion patrols are seed-free, but the grid they walk depends on captures shaped by the seeded boss, so ambushes are neither copyable nor precomputable beyond what is already true today. The two sides pull in opposite directions. Earning a charge takes a tick-exact skill: close the cut while the minion is on the stretch being enclosed, on the very rail it is walking toward, without a share or swap hit. Search does this perfectly and for free. Humans do it rarely, and at the risk of a minion hit. Spending charges (up to 3) helps humans more, since search seldom gets hit. But it also lets search push through the boss's lane with B tapped on the bump tick, the 'planned shielded phase' the pitch describes, which a precise planner exploits best. The net effect is unclear and must be measured. Calibration has the same blind spot as the other shield ideas: no scripted bot holds B, so the weights price the rule at zero. Draw variance: the reward exists only on levels with minions, and grows with minion count (trio, swarm, doom have 3), which adds variation between levels that calibration must absorb. Conflicts with D6 (renewable, up to 3) and amends D7's lifecycle.

*Fixes.* Cap the refill at 1 charge (the D6 stock), so ambushes buy back the one charge rather than build a 3-charge buffer for search's bump-throughs. Teach the scripted bots both sides (hold B when a hit is predicted, and prefer a closing cell that strands a minion when the margin allows) before calibrating. Measure search's claims and the mix's zero rate on trio, swarm and doom, with and without the rule.

**Play: strong, 4 of 5.** Gives minions, today only things to dodge, a positive side, and turns their deterministic, visible patrol into something to read and exploit. The ambush is a new situation: start a cut ahead of an oncoming minion and close it behind so its rail stretch ends up inside the capture. It needs timing and positioning that none of the 16 levels asks for. Stranding already removes a minion for R ticks (45-90), so the reward stacks on an existing tactic and makes it visible and teachable. It doesn't invent a foreign one. Renewable charges up to 3 make B a planned resource and allow shielded late pushes through the boss lane. The rule change is cheap: one increment inside the existing capture lifecycle loop, with no new state or format change. It fits the genre's feel. The gap claim is plausible, since a human can read a patrol about as well as search. Caveats: (1) The most charges go to the 3-minion levels (trio, swarm, doom), which softens the hardest tier, so calibration must catch it. (2) Big cuts along the rail strand minions by accident, so some charges arrive without an ambush decision. (3) It does nothing on 0-minion levels.

*Fixes.* Add an optional T0 overlay that highlights which rail stretch the current trail would enclose if closed now, so humans can see an ambush coming. Consider a level-set cap (pair with the shield-stock byte; 0 turns it off) so the hardest levels can keep a cap of 1. Teach scripted bots both halves: prefer cuts that strand a minion when the margin allows, and hold B when a hit is predicted with charges left.

*Readability.* Good. The minion is a distinct 4x4 sprite on the rail. Its removal at capture is already drawn, and a short poof plus a pip refill makes the reward legible. Judging whether the minion's cell will leave the rail takes some reading of the trail shape. The suggested enclosure overlay solves that.

## Two-faced boss token

`items-and-power-ups#7` · T3 New core rule · score 9 (core 3, fairness 3, play 3) · gap: widens · D14: compliant

Once per level a token appears in the field whose face flips every 24 ticks between 'shrink' and 'grow'. The face showing on the tick you claim its cell decides whether the boss loses a size or gains one, so closing the cut becomes a timing shot played with the fast cut A and the slow walk B.

**Rule sketch.** Level bytes v2 append flip_tick u16 (0 for none, otherwise the spawn tick, below T) and flip_life u16. The flip key is the big-endian u32 of seed bytes 13..16. State hash v2 adds 5 bytes: token {present u8, x u8, y u8, ticks_left u16}. At the new step 6b on tick flip_tick: h = fmix32(key), and the token takes the first EMPTY cell at or after h mod 3600 (row-major, wrapping) outside the boss body, with ticks_left = flip_life. Its face on any tick is ((flip_life − ticks_left) / 24 + (h >> 31)) mod 2: 0 is SHRINK, 1 is GROW. The face is stateless, computed from ticks_left and the key. Taking happens at step 3, when the capture pass turns the token's cell CLAIMED, using that tick's face. SHRINK sets B = max(2, B − 1) at the same top-left. GROW tries the top-lefts (x−1, y−1), (x, y−1), (x−1, y), (x, y) in order, and applies B + 1 (only if B ≤ 7) at the first whose (B+1)×(B+1) body covers only EMPTY cells; if none fits, nothing happens, so R4.6-1 holds. Step 6b counts ticks_left down and removes the token at 0. The client draws the face and a 24-tick ring timer. It can share the cache slot of the supply-cache idea if both ship.

**Inspired by:** Pepper II (1982), Gals Panic (1990), Claim (DaNuTree) (2026), Volfield (2016). **Mechanic families:** [State-cycling items](../taxonomy/items-and-power-ups.md#state-cycling-items), [Harmful pickups and power-downs](../taxonomy/items-and-power-ups.md#harmful-pickups-and-power-downs), [Boss-killer weapon](../taxonomy/items-and-power-ups.md#boss-killer-weapon). **Touches:** rules, state-hash, level-format, level-data, presentation, tools-bots.

**Decisions it reopens:** D9; R4.6-1; R4.4-5; R4.8-4.

**Bot effect.** Widens the gap a little. Nothing is hidden, since the face and its timer are drawn. But the payoff is a precision timing problem: search lands the closing sub-step on the right face every time, while a human hits a 24-tick (1.6 s) window most of the time. SHRINK raises the ceiling by 2B − 1 cells and GROW lowers it, and search exploits both fully. Keep the windows at 24 ticks or more and the token at once per level to keep the gap small. Scripted bots need a rule (close only on the SHRINK face, else route around the token), or they will grow bosses at random and skew calibration.

**Budget.** \+5 bytes of state. Once per level: one fmix32 and one scan of up to 3,600 cells. GROW tests at most 4 bodies of up to 64 cells, once. Per tick: one countdown. zk cost is negligible. Screen: one cell with two face colours and a ring, redrawn every 24 ticks, and a boss redraw on a size change.

**Variety.** A timing decision inside the cut: the same capture is good or bad depending on the tick it closes. Fast cut (hurry) and the shielded slow walk (wait safely) gain a second use. It is the only idea where a player's own move can make the boss bigger, a self-inflicted risk to read.

**Core engineer: feasible with changes, 3 of 5, tier 3.** Mechanically sound:

- B is already in hash v1, as the boss's body size field.
- SHRINK keeps a subset of EMPTY cells.
- GROW tests the four (B+1) placements that enclose the current body, all EMPTY, so R4.6-1 holds. x − 1 never underflows, because the body's x is at least 1.
- The face is stateless, from ticks_left and h.

Issues:
(1) The spawn scan can find no cell. After captures the open field can be exactly the body, when the target is above (claimable − B²)/claimable or at 10,000 bp, so 'the first EMPTY cell outside the body' needs a no-spawn case.
(2) Seed bytes 13-14 collide with the sweepers (#10, bytes 11-14).
(3) Step 6b does not run on a tick that ends at step 6: pin it.
(4) A mid-level size change moves the ceiling, (claimable − B²). Scripted bots that close cuts blindly will grow bosses at random and skew the season weights, so the bots need a face rule before calibration.
(5) The bot gap is honestly stated. It is a 24-tick precision window that search lands every time, but SHRINK is worth only 2B − 1 cells (about 0.3% of claim), so the score gap moves little.

The self-inflicted GROW is a genuine new decision.

*Fixes.* - Add 'no EMPTY cell outside the body: no token'.
- Pin 6b's place: after step 6, only if the level did not end.
- Move the flip key to unused bytes (for example 21-24) if the sweepers ship.
- Require flip_life to be a multiple of 48, so both faces show equally long.
- Give the scripted bots a close-on-SHRINK rule before calibration.

*Cost.* - Level v2: +4 B.
- State: +5 B, hash v2.
- Once per level: one fmix32 and a scan of at most 3,600 cells (about 10-20k cycles). GROW: at most 4 × 81 reads, once. Per tick: one countdown.
- zk under 0.1%.
- RULES_VERSION bump, vectors, playtest and calibration.

*Conflicts.* D9; R4.3-3 (B set per level); R4.6-1; R4.4-5; R4.8-4; §6.4 seed bytes 13-16 (overlap with #10); state hash v1

**Fairness: concerns, 3 of 5; gap widens; D14 compliant.** D14 holds: the token's cell and starting face come from seed bytes 13-16 and the spawn tick, so runs differ. The payoff favours search. SHRINK raises the ceiling by 2B-1 cells (27 bp at B=5), and search always closes on SHRINK. A human can stop one cell short of closing (D4) and wait for the right face, but pays for the wait with exposed trail. GROW is a trap that only humans and naive bots fall into: a larger boss lowers their ceiling and raises their risk, while search never triggers it. The score effect is small (one token, plus or minus 2B-1 cells), but the variance it adds lands only on humans. Scripted bots need the rule, or calibration will count random GROWs. Seed bytes 13-14 overlap the sweepers' bytes 11-14. A change of B mid-level reaches every rule that uses B: the fill's starting body, the edge column, and the per-level ceiling the reports use.

*Fixes.* Simplest fix: draw the face once at spawn from the seed and never flip it. That removes the timing asymmetry, and the player only decides whether to capture the token. Otherwise drop GROW and keep SHRINK. Keep one table of seed-byte allocations (overlap with terrain#10). Have the bot-advantage report compute the ceiling from the boss's final B.

**Play: ok, 3 of 5.** It adds a once-per-level timing decision inside a cut. Stopping mid-cut is allowed (D4), so the core choice is: wait with the trail open until the face flips to SHRINK (risking a boss bump for up to 1.6 s), or close now and accept GROW or route the capture around the token. That is a real risk choice, but a narrow one, and most of the time it collapses to 'wait for SHRINK'. The more interesting case is on obstacle levels. A bigger boss fits fewer corridors, so GROW can confine it, and the 'bad' face is sometimes the good one. That depth exists only on maze, labyrinth and comb-like layouts. A ±1 change in B matters a lot at B=4 and little at B=7-8. Readable and mostly harmless, but once per level with a binary effect is modest variety for a state-hash v2 and level v2 change. Seed bytes 13-16 collide with the sweepers' 11-14.

*Fixes.* Reassign seed bytes (13-14 overlap [terrain-and-geometry#10](terrain-and-geometry.md#sweepers-on-fixed-tracks)). Drop the ring timer, which can't be drawn in one 4x4 cell, and blink the token for the last ~6 ticks before each flip. Place the token on obstacle levels where GROW can trap the boss, so both faces are worth choosing, or give the faces asymmetric lengths so waiting for SHRINK costs more. Make sure neither face colour is red, which already means TRAIL.

*Readability.* Good for the face, poor for the timer. One cell alternating between two distinct colours, say green and magenta, is readable, and a boss size change is obvious. A 24-tick ring timer around a single 4x4 px cell would have to draw over neighbouring field cells; a blink before the flip is the practical cue.

## Enclosable supply caches

`items-and-power-ups#6` · T3 New core rule · score 8 (core 2, fairness 2, play 4) · gap: widens · D14: compliant

Every few seconds a supply cache blinks onto an open cell, its contents shown by its colour: freeze, purge, charge or shrink. Claim its cell before it fades, by enclosing it or by closing a cut that runs through it, and it takes effect at once.

**Rule sketch.** Level bytes v2 append 8 bytes: cache_count u8 (0..8), cache_first u16 (1..T−1), cache_interval u16 (≥ cache_life), cache_life u16 (1..900), cache_kinds u8 (bit 0 FREEZE, bit 1 PURGE, bit 2 CHARGE, bit 3 SHRINK; non-zero exactly when count > 0). The cache key is the big-endian u32 of level seed bytes 9..12. State hash v2 adds 8 bytes: cache {present u8, x u8, y u8, kind u8, ticks_left u16}, next_cache u8, freeze_ticks u8.

New step 6b runs after Collisions and before Time, and so not after a level-ending hit (R4.4-4). It counts down freeze_ticks and a present cache's ticks_left, removing the cache at 0. Then, on tick s_k = cache_first + k × cache_interval with k = next_cache \< cache_count: h = fmix32(key XOR ((k+1) \<\< 16)); scan from cell h mod 3600, row-major and wrapping, for the first EMPTY cell outside the boss body. The cache takes that cell, its kind is the ((h >> 8) mod popcount(kinds))-th set bit, ticks_left = cache_life, and next_cache += 1. If no cell is found, the spawn is skipped.

Taking (step 3): in the capture pass (R4.8-4), if the cache's cell turns CLAIMED from EMPTY or TRAIL, the cache is taken after R4.7-8. FREEZE sets freeze_ticks = 30. PURGE destroys every live minion with countdown R. CHARGE sets shield = min(3, shield + 1). SHRINK sets B = max(2, B − 1) at the same top-left; the new body is a subset of the old one, so R4.6-1 holds. While freeze_ticks > 0, step 4 neither moves nor draws, and live minions don't move at step 5, though their countdowns tick. A cache under the boss body stays put while the boss passes over it.

**Inspired by:** Volfied (1989), Space Cropper (2014), VoidMania (2026), Dancing Eyes (1996), Coach Tzabar (1997), Volfield (2016), Gotta Xonix (2026), Pirate Xonix (unknown), Oh Mummy (1983), Do! Run Run (1984), Libble Rabble (1983). **Mechanic families:** [Enclosure-collected items and boxes](../taxonomy/items-and-power-ups.md#enclosure-collected-items-and-boxes), [Field pickups collected by touch](../taxonomy/items-and-power-ups.md#field-pickups-collected-by-touch), [Enemy freeze (time stop)](../taxonomy/items-and-power-ups.md#enemy-freeze-time-stop), [Area bombs and enemy wipes](../taxonomy/items-and-power-ups.md#area-bombs-and-enemy-wipes), [Shield and invincibility](../taxonomy/items-and-power-ups.md#shield-and-invincibility), [Boss-killer weapon](../taxonomy/items-and-power-ups.md#boss-killer-weapon), [Collect items or a key to clear](../taxonomy/level-structure-and-progression.md#collect-items-or-a-key-to-clear), [Capture every designated target](../taxonomy/level-structure-and-progression.md#capture-every-designated-target), [Letter collection](../taxonomy/level-structure-and-progression.md#letter-collection). **Touches:** rules, state-hash, level-format, level-data, presentation, tools-bots.

**Decisions it reopens:** D6; D9; D14; R4.4-5; R4.6-1; R4.8-4; §6.4 unused seed bytes (uses 9..20); §5 level bytes v1.

**Bot effect.** Widens slightly through foresight; FREEZE, PURGE and CHARGE then narrow it. The spawn schedule is level data, and each cell is a pure function of the seed and the grid. Search therefore foresees every cache from the reveal and is in position before it appears, while a human sees it only on spawn. A HUD countdown can show when the next one comes, but not where. FREEZE, PURGE and CHARGE do not raise the ceiling, and search is at 98.5% of it, so they mostly lift humans and the mix by saving lives. SHRINK does raise the ceiling, by 2B − 1 cells per take (about 27 bp at B = 5), and search always collects that. To trim the foresight edge, pick the cell 30 ticks before s_k and draw a pulsing outline until the cache opens. Scripted bots need a rule (stretch the greedy rectangle over a visible cache when the margin allows), or calibration will price levels without the caches humans use.

**Budget.** About 8 bytes of core state. Per tick: two countdowns. Per spawn (at most 8 per level): one fmix32 and a scan of up to 3,600 cells, comparable to one capture pass. zk cycles grow well under 1% against about 30M per level. Screen: one 4x4 icon in up to 4 kind colours (or 2 colours plus a blink), redrawn after the boss passes.

**Variety.** The first reason to go somewhere specific in the field. A cache deep in the boss's haunt asks for a big, risky cut now; one by the rail is a cheap detour. FREEZE and PURGE pay off only if the next cut is ready, so the question is when to take a cache, not just whether.

**Merged from:** `level-structure-and-progression#9`. Variants:

- Seeded supply caches: Up to three caches sit at seed-chosen spots in the open field, different every run. Capturing the cell a cache sits on grants an extra shield charge or an extra life, often at the price of a cut deep into boss territory.

**Core engineer: feasible with changes, 2 of 5, tier 3.** Determinism, RAM and timing all hold: 8 B of state, two countdowns per tick, and at most 8 spawns per level. The cache is an entity, so the 2-bit cells are untouched. The spawn rule has a real flaw. 'Scan from h mod 3600 for the first EMPTY cell' picks cell c with probability proportional to 1 plus the length of the non-eligible run before it in row-major order. Once the top half is claimed, about 50% of caches land on the open region's first cell, which sits right against the rail and is the cheapest possible take. As the claim rises toward the target, that hot spot reaches about 70%. That is learnable and seed-independent in effect. FREEZE stops the boss and the minions for 30 ticks: a 60-cell fast cut with no boss risk, the kind of risk-free window R4.9-17's rationale rules out for invulnerability. Search will always have the maximal cut ready, and SHRINK raises the ceiling every time search takes one. SHRINK also overturns D9 (B fixed per level). Bytes 9 to 12 collide with [reveal-and-presentation#8](reveal-and-presentation.md#figure-weighted-claim). The bot-effect text is honest about the foresight edge.

*Fixes.* Pick the (h mod n)-th eligible cell, where n is the count of EMPTY cells outside the boss body: one counting pass and one selecting pass, still under about 2 ms. Use seed bytes 13 to 16 or coordinate with #8. Shorten FREEZE (for example to 10 ticks), or make it slow the boss to period x 2 rather than stop it. Drop SHRINK or treat it as a D9 decision. Announce the cell 30 ticks early, as proposed, to trim search's foresight.

*Cost.* Level bytes +8 B (480 B v2); core state +8 B (state hash v2, 956 B preimage). Per tick, two countdowns; per spawn, one fmix32 and 1 to 2 grid passes, at most 8 per level; under 1% zk. A 4x4 icon in up to 4 colours. New tick step 6b (R4.4-5). RULES_VERSION, vectors, cache policies for the scripted bots, playtest and calibration.

*Conflicts.* D6; D9; D14; R4.4-5; R4.6-1; R4.8-4; R4.9-17 (risk-free window rationale); §5 level bytes v1; §6.4 seed bytes 9-12 (also claimed by [reveal-and-presentation#8](reveal-and-presentation.md#figure-weighted-claim)); state hash v1

**Fairness: concerns, 2 of 5; gap widens; D14 compliant.** D14 holds. The cache cell is fmix32 of seed bytes 9-12 plus a scan of the live grid, so it can't be predicted before the reveal or copied between runs, and FREEZE's window depends on play, so it can't be learned. Fairness and the gap are the problems. (1) Foresight: the spawn ticks are level data and the cells are a pure function of the seed and grid, so search knows where every cache will appear from the reveal, given its own planned captures, and waits in position. Humans see it only on spawn. (2) Exploitation: a 30-tick FREEZE is a perfect window for an exact planner (one huge safe cut), and SHRINK raises the ceiling by 2B-1 cells per take, which search always collects. (3) Draw variance: the kind and the cell are seed luck. A CHARGE deep in the boss's area and a PURGE next to the rail are very different runs of the same level. In paid mode that adds per-run variance that weights can't remove, and it rewards buying several runs and playing the best draw. PURGE and FREEZE could save human lives on minion-heavy levels, but only if they spawn reachable, and reaching deep caches costs humans zeros. Scripted bots need cache-seeking logic, which is feasible but adds a new calibration dependency. It also touches 8 B of state and 8 level bytes, and takes another D6 conflict through CHARGE.

*Fixes.* Drop SHRINK, which changes the ceiling. Fix the kinds per level in level data rather than drawing them from the seed. Telegraph each cache's cell 60-90 ticks before it opens, with a pulsing outline, to cut search's foresight edge. Limit the spawn scan to a band within reach of the rail, so placement luck stays bounded. Try it in Training first and measure the per-run spread before any season.

**Play: strong, 4 of 5.** The first reason to go to a specific place in the field, with timing on top: FREEZE and PURGE pay off only if the next cut is ready, and a cache deep in the boss's haunt sets reward against exposure. Power-ups taken by capture are native to the genre, so the feel fits. SHRINK, which shrinks the boss mid-level, is a striking new situation. The costs are honest: about 8 B of state, two countdowns per tick, and one scan per spawn. Problems: (1) Spawn bias. Scanning row-major from h mod 3600 for the first EMPTY cell puts a cache on the first open cell after a CLAIMED run. As the field fills, most caches land on the left edge of the open region, next to the rail. That makes cheap detours far more common than the risky deep caches the pitch sells, and the bias is predictable. (2) Search foresees every spawn from the reveal, so the gap widens. The proposed 30-tick pre-announcement helps. (3) Four kinds (FREEZE, PURGE, CHARGE, SHRINK) is a lot of rules to learn, colours to tell apart and scripted-bot policy to write. CHARGE overlaps the other shield ideas. SHRINK raises the ceiling, which search always collects.

*Fixes.* Choose the (h mod empty_count)-th EMPTY cell with one counting pass (cost comparable to a capture pass) so placement is uniform over the open field. Keep the 30-tick pulsing pre-announcement so humans see what search computes. Start with two kinds, FREEZE and SHRINK, the most distinctive pair, and add more later. Draw a client-side halo or blink pattern per kind, so kind isn't encoded by hue alone.

*Readability.* Marginal as specified. A single 4x4-px cell is visible against the black field, but telling 4 kinds apart by hue at one cell will fail at a glance. Use a per-kind blink rhythm or a 3x3-cell client halo (T0), and fewer kinds.

## Four shrines, then the boss flees

`items-and-power-ups#11` · T3 New core rule · score 8 (core 3, fairness 2, play 3) · gap: unclear · D14: needs-seeding

Each level marks up to four shrine cells in the field. Claim them all, through any captures, and for a few seconds the boss steers away from you, and minions that touch you are destroyed instead of hitting you. That is the time to hunt minions on the rail or make the cut you couldn't before.

**Rule sketch.** Level bytes v2 append a shrine count u8 (0..4), 4 × (u8 x, u8 y) shrine cells (EMPTY at level start, unused slots zero as with minion slots), and a fright length F u8. State hash v2 adds 2 bytes: shrines u8 (bits 0-3 lit, bit 7 fright used) and fright_ticks u8. Step 3, in the capture pass: a shrine whose cell turns CLAIMED is lit. When every shrine is lit and bit 7 is clear, fright_ticks = F and bit 7 is set. Step 4, while fright_ticks > 0 and before the draw of R4.6-7: in doubled units the body's centre is (2x + B, 2y + B) and the player's is (2px + 1, 2py + 1). Set vx = +1 if the body's x is greater, −1 if smaller, unchanged if equal, and likewise vy. R4.6-7 and R4.6-3 then run as written, so the boss still deflects on 1 move in 32 and still hits on TRAIL. Step 6, while fright_ticks > 0: a minion meeting the player under R4.9-8 (share, swap or pass) is destroyed with countdown R instead of setting the hit flag. fright_ticks goes down by 1 at the end of step 6. No new seed material.

**Inspired by:** Amidar (1982), Pepper II (1982), Xonix (KolibriOS) (2006), Power Styx (1988), Zoo Keeper (1983). **Mechanic families:** [Eat-the-enemies reversal](../taxonomy/items-and-power-ups.md#eat-the-enemies-reversal), [Set collection (letters and tokens)](../taxonomy/items-and-power-ups.md#set-collection-letters-and-tokens), [Herding lures and nets](../taxonomy/items-and-power-ups.md#herding-lures-and-nets). **Touches:** rules, state-hash, level-format, level-data, presentation, tools-bots.

**Decisions it reopens:** D14; R4.6-6; R4.9-8; R4.9-13.

**Bot effect.** Keeps the gap and may widen it a little. Shrines are fixed, visible level data, so the plan (route captures through all four) is readable for humans. Search plans the order and the fright window exactly, including timing the triggering capture so the flight drives the boss into a pocket it can then wall off. The window itself is near-safety and doesn't raise the ceiling, so it helps humans and the mix more than search. During fright the boss is steered by the player's position more than by the seed. F stays short, and the seeded deflections keep running, so D14's divergence and no-safe-zone guarantees hold. Scripted bots need a rule (prefer rectangles that cover unlit shrines; during fright, cut toward the side the boss fled from), or they will light shrines only by chance.

**Budget.** \+2 bytes of state and 10 bytes of level data. Per capture: up to 4 cell checks. During fright: 4 compares per boss move, and a branch on the minion hit predicate already computed. zk cost is negligible. Screen: up to 4 marked field cells, and a palette swap of the boss and minion colours for F ticks.

**Variety.** A level-long objective that reshapes where you capture first, and a short power phase in which the threat model flips: minions become prey and the boss gives ground. Placing shrines near the boss's spawn makes the set costly to complete.

**Core engineer: feasible with changes, 3 of 5, tier 3.** Integer-clean (doubled centres), deterministic and small in state.

Problems:
(1) Steering re-aims the boss on every move, and R4.6-3 then bounces it off the wall. The next move re-aims it into the same wall, so the boss parks against it and slides to the corner farthest from the player. For the rest of F its position is set by the player, not the seed. That is herding: search will time the last shrine capture to pin the boss in a pocket and wall it off. Humans can too, less exactly. Search is already at 98.5% of the ceiling, so its score barely moves, but per-level difficulty becomes very sensitive to F and shrine placement, and D14 now leans entirely on F being short.
(2) Pin that steering applies only on ticks the boss moves, as the draw of R4.6-7 does.
(3) A minion destroyed at step 6 is a new destruction point. R4.7-9 counts down at step 5 'from the tick of its destruction on', so a minion destroyed at step 6 of tick t respawns at t + R, not t + R − 1: pin it. hits.rs returns one bool today and needs per-minion results.
(4) D13: four power items, then a frightened boss and minions you can destroy, is the signature mechanic of a well-known maze game. Borrowing the mechanic is allowed; keep its vocabulary ('fright') out of the product.

*Fixes.* - Steer only on move ticks, and only one axis per move (the axis with the larger doubled-centre distance), so the boss drifts away but does not pin itself into a corner.
- Cap F by validity (for example ≤ 45 ticks).
- Pin minion destruction at step 6 and its respawn tick.
- Rename 'fright' in user-facing text.
- Teach the scripted bots shrine routing before calibration.

*Cost.* - Level v2: +10 B.
- State: +2 B, hash v2.
- Per capture: at most 4 cell checks. During fright: 4 compares per boss move and a branch per minion. zk negligible.
- RULES_VERSION bump, vectors, playtest and calibration.

*Conflicts.* D14; R4.6-6; R4.6-7; R4.9-8; R4.9-13; R4.7-9; R4.4-5; D13 (identity); state hash v1

**Fairness: concerns, 2 of 5; gap unclear; D14 needs-seeding.** During fright, each boss move sets its velocity to point away from the player, so a seeded deflection lasts one move and is undone on the next. A boss against a wall, with the player on the other side, is steered into the wall, bounces, and is steered back on every move: it pins in the corner farthest from the player, wobbling by one cell. Two runs that reach fright with the player in the same place converge on the same boss position whatever the seed. That undoes R4.6-12's divergence for F ticks and makes 'herd the boss into a corner and wall it off' a learnable finisher that does not depend on the seed, against D14. Who gains is unclear: search times it exactly, but the pin is simple enough that a practiced human can wall off the corner too. Fairness: the fright is all-or-nothing on four shrines, and a shrine left inside the boss's region (seed luck) cancels it, so a level's score becomes bimodal from run to run. The median-based weight cannot remove that variance. Scripted bots need a shrine policy, or calibration never sees fright. F can be up to 255 ticks, which is effectively no limit.

*Fixes.* Keep the seeded draw in control during fright: for example, steer only one axis per move, chosen by a seeded draw, or raise the deflection rate and bias it away from the player, but never overwrite both velocity components. Add a validity rule capping F at a few boss moves. Reduce the bimodality with partial effects per lit shrine, or a fright for k of 4 shrines. Add a shrine-seeking policy to the reference mix before calibrating.

**Play: ok, 3 of 5.** The most variety in this batch: a level-long objective that changes which cells you capture first, plus a power phase that flips the threat model (minions become prey, the boss gives ground). Placing shrines near the boss's spawn makes completing the set a real cost. But the fright steering as written is degenerate. Every move, the boss's velocity is reset to point away from the player before the edge tests, so it runs to the far wall and stays pinned in the corner of its region opposite the player, bouncing only on the rare deflection. The player then cuts an L around that corner, about 2(B+2) cells, and captures nearly the whole field: a guaranteed clear at about 95% claim. Completing the shrines then becomes a win button, and the claim-versus-risk tension at the end of the level disappears. The steering also makes the boss's path a function of the player's position, not the seed, for F ticks, which strains D14. 'Keep F short' only works if F is too short to matter to humans. Hunting minions during fright is fine and fits the game.

*Fixes.* Drop the flee steering. During fright, keep the boss on its seeded motion (or double its move period), and keep only the minion-prey flip plus, at most, boss bumps not hitting for a short F. Or keep fleeing but cap F below the time to box a pinned boss, measured on B=8, and verify with a 'box the pinned boss' scripted policy. Cap the shrine count at 3-4, at least one near the boss spawn.

*Readability.* Good. Up to four marked cells, unlit versus lit, are readable at 4x4 px, and a palette swap of boss and minions during fright is a well-known, instantly understood signal. It needs a warning blink before fright ends, since there is no HUD timer.

## Three boosters for six levels

`items-and-power-ups#13` · T5 Mode, scoring or contracts · score 8 (core 2, fairness 3, play 3) · gap: narrows · D14: compliant

A Challenge run comes with three boosters: an extra shield charge, a start freeze and a spare life. At the start of each level you choose whether to spend one there. Do you rescue the level you fear will zero, or boost the high-weight level where a clear pays most?

**Rule sketch.** Journal v2's header gains a booster u8 after levelIndex: 0 none, 1 SHIELD (start with 2 charges), 2 HOLDFAST (the boss and minions don't move on ticks 0..59, and the boss draws nothing then), 3 SPARE (start with lives + 1). The core applies it at level start (PIN-01), and HOLDFAST also at steps 4 and 5 while tick \< 60. The level's Outcome reports the booster. Run rule, checked over the run's six journals: at most 3 non-zero boosters, and each kind at most twice. Training accepts any booster on any level. The client asks at each level's start, after the draw and the level are known, and journals the choice in the header, so the run commitment binds it with no change of form (P5). Settlement must see all six headers to check the budget. Per-level settlement (P16) therefore either carries the six journal hashes plus their booster bytes, or is dropped for runs that use boosters. Calibration plays bots that spend boosters by a fixed rule (on the three lowest-claim levels of the draw).

**Inspired by:** Bubble.Fill: Retro Area Arcade (2025), Bix (2008), Cosmo Xonix: Space Arcade (2026), Defly.io (unknown), Claim (DaNuTree) (2026). **Mechanic families:** [Pre-run boosters and loadouts](../taxonomy/items-and-power-ups.md#pre-run-boosters-and-loadouts), [Upgrade draft during a run](../taxonomy/items-and-power-ups.md#upgrade-draft-during-a-run). **Touches:** journal, rules, outcome, contracts, economy, tools-bots, presentation.

**Decisions it reopens:** D6; PIN-01; P16.

**Bot effect.** Widens the gap slightly in allocation and narrows it in play. Search can simulate each drawn level with and without each booster before choosing, so it allocates near-optimally, while humans allocate by feel. But boosters don't raise the ceiling, and search sits at its ceiling, so it gains almost no score from them, while they save zeroed levels for humans and the mix. Net, the pot-share ratio should drop. Weights must be recalibrated with boosters in play, or they will overstate the hard levels.

**Budget.** \+1 header byte per journal (a 72-byte header). Per tick: only HOLDFAST's compare. Referee: a 6-byte budget check per run, and the Outcome grows by a byte. This means an IReferee/Outcome change, a new Season generation and new run-flow text in README §7-§8, plus a booster picker on the browser's level intro.

**Variety.** The only run-level decision in the game: today the six levels are independent. It gives a reason to read the whole draw at reveal and plan across it, and gives a feared level a lever without changing its weight.

**Core engineer: feasible with changes, 2 of 5, tier 5.** HOLDFAST breaks the game as stated. Boss and minions are frozen on ticks 0-59, and A cuts 2 cells a tick, so the player has about 118 trail cells. From (30,59): walk the rail a few cells, cut a U around the frozen B=5 body (legs of about 40 cells, a cap of about 8), and close it by about tick 50. That claims everything outside the U, about 3,364 - 280 cells or roughly 9,100+ bp: an instant clear near the 9,925 ceiling. Any human who learns the shape can do it, search trivially, and a run may hold two HOLDFASTs. SHIELD (despite D6) and SPARE are fine. The run budget is the second problem. It is a cross-level rule the core cannot check: verify replays one level, and verifyRun has 'no check across them'. So it lands in Challenge, and the Outcome gains a field (P4). That means IReferee, ZkReferee's public values abi.encode(uint16, Outcome), the guest image, MockReferee, the web bindings and contracts/abi all change. The sketch's 'carry the booster bytes with the journal hashes' does not work for settleLevel: nothing proves the bytes of journals not yet settled. Challenge must tally boosters per run across settleLevel calls and fail the run when the sixth pushes it over budget. Commit never parses (P5), so an over-budget run is caught only at settlement, and a buggy client burns its fee. Calibration also loses per-level separability: a level's effective claim depends on whether the rest of the draw drew the booster. The bot claim (search gains little, humans recover zeroed levels) holds only for SHIELD and SPARE.

*Fixes.* Drop HOLDFAST or make it harmless: for example extra time (+300 ticks), or a freeze that ends when the first cut starts, capped at about 15 ticks. Enforce the budget in Challenge: settleRun checks the six Outcomes; settleLevel keeps a per-run tally and marks the run invalid, like Late, when it is exceeded. The client must refuse an over-budget pick. Calibrate with a draw-aware booster rule.

*Cost.* Journal header 71 to 72 B (journal v2), Outcome +1 uint8, core RAM +1 B. Per tick: one compare while tick \< 60, about 0 zk. Contracts: new Outcome and IReferee, ZkReferee plus a new guest image ID, a Challenge with a booster tally (+1 SSTORE per settleLevel), a new season. RULES_VERSION 3. All journal and game vectors regenerated. README §7-§8 and docs/ECONOMY.md rewritten. A picker on the browser's level intro.

*Conflicts.* D6; PIN-01; P16; P4 (Outcome/IReferee); §7.3 zk public values; D5 (SPARE changes the lives that make Commit matter, mildly)

**Fairness: concerns, 3 of 5; gap narrows; D14 compliant.** D14 mostly holds: boosters change no seed. HOLDFAST freezes the boss and draws nothing for ticks 0 to 59, so runs with the same boss start and direction share 60 ticks plus the usual ~12 moves before they diverge. That is a small precomputable opening, but not a learnable whole-game pattern. On score the gap narrows. Search sits at its ceiling, so SPARE and SHIELD give it nothing and HOLDFAST only saves ticks, while SPARE rescues zeroed levels for humans and the mix. On allocation it widens: search can simulate every drawn level under every booster after the reveal and allocate optimally, while humans allocate by feel. The main fairness problem is draw variance. A run-level budget couples the six levels, so a booster's value depends on the draw's composition. Three boosters are worthless on an easy draw and decisive on a draw with four hard, high-weight levels. Per-slot weights cannot absorb that interaction. Calibrating under the fixed rule 'spend on the three lowest-claim levels' bakes an average booster probability into each slot's weight, which over- or under-rewards the same level depending on what it was drawn with. The idea also breaks two settled principles: verifyRun's 'independent replays, no check across them', and the clean P16 per-level fallback. The contract can still check the budget once the sixth level settles. Scripted bots can play it.

*Fixes.* Prefer a per-level booster (one optional booster per level, or a booster fixed by level data), which per-slot weights can normalize. If a run budget stays, calibrate by simulating the allocation rule over many random draws and report draw-conditional score variance before shipping. For P16, have Season accumulate the Outcome's booster byte and check the budget when the sixth level settles, instead of dropping settleLevel. Consider dropping HOLDFAST, or letting the frozen boss's deflection draws keep flipping its velocity, so the opening is not a function of boss start alone.

**Play: ok, 3 of 5.** The allocation is a real run-level decision: read all six drawn levels at reveal and choose where to spend three boosters. Inside a level, though, two of the three boosters only lower difficulty: SPARE (+1 life) and SHIELD (a second charge, which also bends D6). They add no new situations, and SPARE weakens Commit's meaning under D5. HOLDFAST is the one that creates a new situation, but it is a solved one. The boss stands still at a cell you can see for 60 ticks, and a fast cut covers about 120 cells in that time, so there is a best opening rush to compute. Search computes it exactly; humans memorise an approximation. Because weights already normalise difficulty, the allocation question ('where does one more life raise my expected score most?') is subtle for humans and easy for search. The variety it adds is mostly menu-level, and it costs T5 changes to settlement and to P16.

*Fixes.* Drop HOLDFAST, or replace it with something non-solvable such as one reversal charge. Have the player commit the whole allocation once at reveal, as a 6-byte plan bound in the run commitment, instead of a per-level header byte. That keeps per-level settlement simple, makes it one planning decision, and pairs naturally with the free-order run board. Consider forbidding SPARE on 1-life levels so Commit keeps its bite.

*Readability.* Fine. The picker is on the browser's level intro. In play, an extra shield pip and an extra life icon are trivial. HOLDFAST would need a frozen-boss tint and a countdown.
