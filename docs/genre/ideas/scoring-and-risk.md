# Ideas: scoring and risk

The 9 ideas proposed from the axis of the [taxonomy](../TAXONOMY.md) *scoring and risk*: score systems and risk against reward: multipliers, slow-draw bonuses, percentage bonuses, perfect clears, time bonuses, combo chains, gambling on capture size. Sorted by score. The [index](../IDEAS.md) lists every idea by tier and score, and [`README.md`](../README.md#the-taxonomy-and-the-ideas) explains the judges.

## Salvage when the lives run out

`scoring-and-risk#6` · T5 Mode, scoring or contracts · score 11 (core 4, fairness 5, play 2) · gap: narrows · D14: compliant

Running out of lives keeps a level-set share of the claim, say half, instead of zero. Commit still beats dying, but a doomed push no longer wipes out the level.

**Rule sketch.** Level bytes v2 field salvage_bp (u16, 0 to 10,000). v1 levels read 0, which is D5 as today. At step 6, when the last life is lost, the level ends with endReason 3 as now, and claimBp is the claim at that moment (the trail was erased, R4.9-17). The core then computes levelScore = (claimBp × salvage_bp / 10,000) × weight_bp / 10,000, with two floor divisions in that order, instead of 0. Committed, cleared and timed-out levels are unchanged. The Outcome keeps its eleven fields; only the levelScore comment in IReferee and §7.3 changes. The effective claim of P11 and of calibrate becomes claimBp × salvage_bp / 10,000 on endReason 3. No state change and no per-tick work.

**Inspired by:** Doodlebug (1984), Jezzball Jam (2014), Get Your Klix on Route 66 (c. 2020). **Mechanic families:** [Score as the life pool](../taxonomy/scoring-and-risk.md#score-as-the-life-pool), [Health meter instead of one-hit death](../taxonomy/scoring-and-risk.md#health-meter-instead-of-one-hit-death), [Life budget](../taxonomy/scoring-and-risk.md#life-budget). **Touches:** level-format, rules, outcome, economy, tools-bots.

**Decisions it reopens:** D5; R4.10-3; §8.4 level_score; §7.3 Outcome.levelScore; P11.

**Bot effect.** Narrows the gap, likely by a lot. The reference mix loses most of its points to levels that score 0 when the lives run out (bold clears only 3.6 of 6 levels per run), while search never runs out of lives and is unaffected. Calibration would then lower the weights of the hard levels, so the size of the effect needs a rerun of bot-advantage.

**Budget.** No RAM and no per-tick work: one multiply at the level end. zk cycles unchanged.

**Variety.** Changes Commit from 'bank all or risk all' to 'bank all or risk half', so pushing a failing level becomes a finer call. The per-level field lets designers make some levels forgiving and keep others all-or-nothing.

**Core engineer: feasible, 4 of 5, tier 5.** The cleanest of the scoring ideas. claim_bp at death comes from the captured count, which the erased trail never entered, so the formula is exact. Both floor divisions run in u32 without overflow (10,000 x 10,000 \< 2^32). There is no new state and no per-tick work. The Outcome keeps its shape and the contracts are untouched: Challenge sums uint32 levelScores, and a level still scores at most 65,535. The real costs are D5, an owner decision, and recalibration. Commit strictly beats dying only while salvage_bp \< 10,000. The sketch allows 10,000, where death costs nothing and Commit loses its purpose on that level. The bot-gap direction is right: search never runs out of lives, while bold clears 3.6 of 6 and zeroes many of the rest. 'By a lot' is unproven: committer already banks at its last life, so half the mix gains little. Rerun bot-advantage. A per-level field forces level v2, which changes level ids and the wedgie's fixed 472-byte buffer and JL01 file. A core constant (say 5,000) gets the same effect with only the RULES_VERSION bump.

*Fixes.* Validity: salvage_bp at most 9,999 (better at most 5,000), with a new code. Or make it a core constant, with no level v2. Update P11, targets.json's effective-claim definition and calibrate. Rerun bot-advantage before claiming the gap narrows.

*Cost.* 0 B RAM, 0 per-tick work, one u32 multiply and divide at level end, zk +0. Level v2 +2 B (474 B), or nothing as a constant. RULES_VERSION 3: every journal header changes. Traces are unchanged if the level bytes are. Outcomes move only on endReason 3. Playtest, calibration and docs/ECONOMY.md update.

*Conflicts.* D5; R4.10-3; §8.4 level_score; §7.3 Outcome.levelScore; P11

**Fairness: ok, 5 of 5; gap narrows; D14 compliant.** This is the safest of the ten for paid mode. It changes no seed, adds no state and no per-tick work, so D14 is untouched. Search never runs out of lives, so its claims are unchanged. The mix's zeroed levels become partial scores, and calibration then raises its median effective claim on hard levels and lowers their weights. Those high hard-level weights are where search's 2.03x pot share mostly comes from, so the ratio should narrow substantially. It also reduces unfair draw variance: per-level score distributions stop being bimodal (claim or 0), so a run's result depends less on which hard levels the draw happened to include. Calibration needs nothing new from the bots: calibrate and P11 just apply the salvage factor to the effective claim on endReason 3. Commit keeps strict value as long as salvage_bp is below 10,000. The only real issue is that it softens D5, an owner decision.

*Fixes.* Add a validity code bounding salvage_bp (for example at most 5,000) so Commit always beats dying by a clear margin and D5's meaning survives. Rerun bot-advantage and calibrate to quantify the narrowing before choosing the default. Get an explicit owner revision of D5.

**Play: weak, 2 of 5.** This tunes an existing decision rather than adding one, and the tuning drains it. D5's zero is what gives Commit its meaning. At 50% salvage, pushing on with one life left keeps at least half of a claim that only grows, so pushing beats committing in most states and the Commit decision mostly goes away. The per-level knob gives a little variety between levels (forgiving vs all-or-nothing). But it adds no new in-level situation for the boss, minions, rail, fast cut or shield. Its real value is economic: it would narrow the gap to the reference mix. That is a fairness lever, not play value, and it changes all calibration. It also creates an odd asymmetry: dying keeps half, running out the clock keeps all, and committing keeps all.

*Fixes.* Keep salvage_bp at 0 on Challenge levels. If forgiveness is wanted, use it only on Training and lesson levels. If the goal is narrowing the gap, look at it as a calibration or weight question instead. If kept, use a small share (10% to 25%) so a doomed push still costs most of the level.

*Readability.* No in-field visuals are needed. The level intro and HUD should state the salvage share, so the player knows what a death costs.

## Big capture earns a shield charge

`scoring-and-risk#5` · T3 New core rule · score 10 (core 4, fairness 4, play 2) · gap: narrows · D14: compliant

A single capture of at least 500 cells recharges a spent B shield, so a bold cut both scores and buys back your safety net.

**Rule sketch.** New rule at step 3 (R4.4-8), right after a capture of s cells (R4.8-4) that does not clear the level. If s ≥ REFUND_CELLS and shield charges = 0, shield charges becomes 1. REFUND_CELLS is a new constant of 500, about 15% of the open-field interior, in consts.rs and README §4. Charges never rise above 1 (or above the level's starting charges, if armored levels land). On the same tick, the refunded charge can absorb a hit resolved at step 6 if B is held. Nothing is seeded and no state is added: shield charges is already hashed, so the state-hash format stays v1. Traces of vectors with a spent shield and a big capture do move, so RULES_VERSION is bumped, vectors are regenerated, and playtest and calibration rerun. Presentation: the shield pip refills with a flash.

**Inspired by:** GraviNix: Tilt Xonix Arcade (2026), AQuix (1997), Xonix (KolibriOS) (2006), Doodlebug (1984), Alien Blockade (1989), Araña (1990), Super Qix (1987), Skyx (1988), Patchwork Heroes (2010). **Mechanic families:** [Big single-capture bonus](../taxonomy/scoring-and-risk.md#big-single-capture-bonus), [Extra lives from progress](../taxonomy/scoring-and-risk.md#extra-lives-from-progress), [Health meter instead of one-hit death](../taxonomy/scoring-and-risk.md#health-meter-instead-of-one-hit-death), Shield and invulnerability, [Meter-charged powers](../taxonomy/items-and-power-ups.md#meter-charged-powers). **Touches:** rules, tools-bots, presentation, economy.

**Decisions it reopens:** D6; R4.4-8; R4.9-15; PIN-01.

**Bot effect.** Narrows the gap slightly. Search never takes a hit, so it gains nothing, while humans and the scripted bold and committer bots, who do get hit, survive more often after a big cut. The scripted bots need a rule to hold B once a refund lands, or they will not use it.

**Budget.** One compare per capture. No RAM, zk cycles about +0, screen: one HUD pip.

**Variety.** Gives a mid-level big cut a second payoff and adds a sequencing choice: take the big cut now to restore the shield before a dangerous phase, or keep banking small safe cuts.

**Merged from:** `wild-combinations#4`. Variants:

- Earned shield from big cuts: A single capture of 15% of the field or more earns an extra shield charge, up to three. Daring cuts buy insurance for later, and the slow shield becomes a renewable resource instead of a one-off.

**Core engineer: feasible, 4 of 5, tier 3.** Builds as stated. In game.rs, `moves.captured` is handled before the clear check, so the refund is one compare there, and shield is already hashed. The order needs pinning: apply the refund only when the capture does not clear, after `captured` is updated and before PIN-10's check, so the final-tick hash is unambiguous. The bot-effect text contradicts itself. It says bold and committer 'survive more often after a big cut', but no scripted bot ever holds B, so they gain nothing. Only B-using humans gain, and calibration cannot see it. That narrows human vs search slightly but leaves the weights blind to the rule. Search's big finisher usually clears, so it never triggers the refund. A fixed 500 cells is 15% of the open level but up to 30% of a 1,682-cell level, so refunds are rarer on obstacle levels. A threshold in bp of claimable is level-invariant. The constant lives in consts.rs, which per CLAUDE.md also means editing README §2, §4 and §5. D6 needs the owner.

*Fixes.* Express the threshold as s x 10,000 / claimable >= REFUND_BP (1,500) instead of 500 cells. Pin that a clearing capture refunds nothing. Correct the bot-effect text: scripted bots gain only once taught to hold B.

*Cost.* No RAM, no state, state hash stays v1. One compare per capture and no per-tick cost; zk +0. RULES_VERSION bump, the traces of vectors with a spent shield and a later big capture move, playtest and calibration rerun. Screen: a pip refill flash.

*Conflicts.* D6; PIN-01; R4.4-8; R4.9-15; consts.rs -> README §2, §4, §5

**Fairness: ok, 4 of 5; gap narrows; D14 compliant.** D14 holds: no seed use and no safe zone. It adds no draw variance, since it applies on every level the same way. The effect is small. A refund needs a spent charge, which needs a hit absorbed with B held. Search almost never takes one, and no scripted bot holds B, so the measured mix-versus-search gap won't move. Skilled humans who use B gain a little survival after a 500-cell cut, so the real gap narrows slightly. One thing to watch: with a renewable shield, search can deliberately absorb a boss bump on its trail, with B tapped on the bump tick, to finish a cut through the boss's lane, then refund with the next big capture. It is already at 97.7-99.6% of each level's ceiling, so the gain is bounded at roughly 1-2% on the hardest levels. Bots can play it once they hold B. Conflicts with D6, and the RULES_VERSION bump buys little.

*Fixes.* Ship it only together with a B-holding rule for the scripted bots, or calibration can't see it. Check search's per-level claim on levels 14-16 before and after, to confirm bump-through cuts don't move it. Consider folding it into the per-level charge field (cap = the level's starting charges) so the rule process runs once. Get the owner's decision on D6.

**Play: weak, 2 of 5.** Rewards what bold play already does. The levels already reward 500-cell captures because they get you to the target, so the refill rarely changes which cut you make. It fires only when the single charge is already spent and refills only to 1. Since few human players actually use B, the payoff is rare and small. The claimed sequencing choice ('restore the shield before a dangerous phase') is thin, because levels have no phases. Danger is fairly even through a level, apart from the shrinking boss region. The fixed constant of 500 cells is uneven across levels. It is about 15% of the open field but about 30% of the claimable area on obstacle-heavy levels (minimum 1,682), so the same rule means different things on comb or maze. It overlaps the stronger minion-strand refill idea, which ties the reward to a positional decision. It doesn't clash with the feel, and its costs are honest. It still needs a RULES_VERSION bump, regenerated vectors and recalibration for a marginal effect.

*Fixes.* If kept, express the threshold in bp of claimable (for example 1,500 bp) instead of cells. Fold it into a level-set stock cap, so a big cut can raise charges toward the level's maximum rather than only from 0 to 1. Better, merge the budget into the minion-strand refill, which creates a new situation instead of rewarding an existing one.

*Readability.* Good. One pip refill flash on the border-row HUD. Nothing changes on the board.

## Per-level shield charge stock

`scoring-and-risk#4` · T2 Level format v2 · score 10 (core 4, fairness 3, play 3) · gap: widens · D14: compliant

Some levels trade lives for shield charges, for example one life and three charges, so survival rests on holding B at the right moments rather than on spare lives.

**Rule sketch.** Level bytes v2 = v1 plus one u8 field, shield_charges (0..3), at offset 472: 473 bytes, version 2, and a value above 3 is rejected with a new code. PIN-01's initial '1 shield charge' becomes the level's value. v1 levels decode as 1, so every existing level and vector keeps its outcome and trace. Editing PIN-01's text still bumps RULES_VERSION by the project's definition. R4.9-15 does not change: at step 6, a hit with B held and a charge left spends one charge. Example levels: 'bulwark' (1 life, 3 charges, B 6, boss period 1) and 'bare' (3 lives, 0 charges). Nothing is seeded, and the state hash keeps its format because shield charges is already a hashed u8.

**Inspired by:** Super Qix (1987), Bix (2008), Tint Turf (2026), Gravebloom (2026), Cosmo Xonix: Space Arcade (2026), Cacoma Knight in Bizyland (1992), Harem Challenge (1995), Megami Tensei QIX Persona 3 (2007), Boundarpy (c. 2019). **Mechanic families:** [Shield and invincibility](../taxonomy/items-and-power-ups.md#shield-and-invincibility), [Pre-run boosters and loadouts](../taxonomy/items-and-power-ups.md#pre-run-boosters-and-loadouts), [Health meter instead of one-hit death](../taxonomy/scoring-and-risk.md#health-meter-instead-of-one-hit-death), [Life budget](../taxonomy/scoring-and-risk.md#life-budget). **Touches:** level-format, level-data, rules, tools-bots, presentation, economy.

**Decisions it reopens:** D6; PIN-01; §5 level bytes v1.

**Bot effect.** Narrows the gap. Search never takes a hit, so charges are worth nothing to it; they help only players who misjudge, humans and the scripted mix. A one-life level still turns an unshielded mistake into 0, which hits humans harder, and the calibrated weight absorbs the average, not that variance. Scripted bots must learn to hold B in danger, or calibration will undervalue armored levels.

**Budget.** 1 byte of level data. No state-hash change and no per-tick cost. The HUD shows up to 3 charge pips. zk: unchanged.

**Variety.** Makes B a resource to ration across the level: when to slow down to stay covered, and whether to spend a charge on a risky closing cut. Today B holds one charge on every level.

**Merged from:** `items-and-power-ups#4`. Variants:

- Level-set shield stock: Each level sets how many shield charges the player starts with, from none to three. On a no-shield level every bump is final. A three-charge level invites slow, shielded pushes straight through the boss's lane, so B becomes a resource to budget rather than a one-off.

**Core engineer: feasible with changes, 4 of 5, tier 2.** Mechanically clean. shield is already a hashed u8 (hash.rs), Player::start only needs the level's value, and hits.rs needs no change. Three claims are wrong. (1) Not every vector keeps its outcome. core/src/level.rs requires exactly 472 bytes (code 20) before it checks the version (21), and vectors/format/level-unknown-version.json is a 472-byte blob with version 2 that returns 21. A version-dependent length rule moves that vector to 20 whatever order is chosen, and the code-20/21 order must be re-pinned in §5. (2) Bot effect: scripted bots and search never press B (tools/src/bots: only search's A legs), so to the reference mix 'bulwark' is just a one-life level. Its median effective claim falls toward the 500 bp floor, the calibrated weight rises (P x 10,000 / m), and search, which clears 100% and rarely loses lives, collects 9,6xx bp x that weight. On one-life armored levels the search-vs-mix ratio widens. It does not narrow. (3) 'On a no-shield level every bump is final' is false: lives still absorb bumps. The season's 16 levels are fixed, so 'bulwark' and 'bare' must replace two levels and get target clear rates in levels/targets.json. Editing PIN-01 bumps RULES_VERSION, as the sketch says, so this needs a new season and a new ZkReferee image. D6 needs the owner.

*Fixes.* Define the length rule per version (472 for v1, 473 for v2, otherwise code 20) and regenerate level-unknown-version, or switch that vector to version 3. Teach bold and committer to hold B when a hit is predicted and a charge is left, before calibrating armored levels. Otherwise keep lives at 2 or more on armored levels so calibration can price them. Restate the bot effect: it widens on one-life levels until the mix uses B.

*Cost.* Level bytes +1 B (473), Level struct +1 B of core RAM, no per-tick work, zk cycles unchanged, state hash stays v1. Level format v2 with new format vectors; RULES_VERSION bump for the PIN-01 text; one new error code; level tool, editor and source parser gain a key; playtest and calibration rerun; HUD shows up to 3 pips (natmod status already carries shield).

*Conflicts.* D6; PIN-01; §5 level bytes v1 (length 20 before version 21); vectors/format/level-unknown-version.json (21 moves); levels/targets.json (replacing two of the 16 levels); P11

**Fairness: concerns, 3 of 5; gap widens; D14 compliant.** D14 holds: nothing is seeded and no safe zone appears. The field itself is cheap and fair: 1 byte, v1 levels decode as 1, and shield charges are already hashed. The flagship trade, lives for charges, is the problem. A life forgives any mistake. A charge forgives only a hit that comes while B is held, so it pays for foresight. Search knows the whole boss future from the revealed seed, can tap B for one stationary tick on any hit it can't avoid, and rarely needs the charge anyway. Humans mostly get hit by surprises (a minion swap, a bounce), so on 'bulwark' (1 life, 3 charges) one unshielded slip scores 0. Calibration makes this worse. No scripted bot ever holds B (tools/src/bots: greedy, bold and committer send only directions, A and X), so the mix sees a plain 1-life level and its median effective claim drops toward the 500 bp floor. weight = P x 10,000 / max(m, floor) then gives search about 20 P points on that level against the mix's P. Doom today, at a median of 1,857 bp, already gives search about 5 P. P also has to fall for the whole season to keep that weight within a u16. A run that draws such a level swings hugely, which is exactly the draw variance §8.4 is meant to remove. 'bare' (3 lives, 0 charges) changes almost nothing measurable, because the mix never uses B. Adding charges without taking lives away narrows the gap slightly. Conflicts with D6 (one charge per level), so it needs the owner's decision.

*Fixes.* Make charges purely additive: shield_charges 0..3 with lives unchanged, and no levels below 2 lives in paid seasons. Before calibrating, give greedy, bold and committer a rule to hold B when the boss's reach covers the trail or a minion is within 2 cells, so the weights price the charges. Report per-level bimodality (the share of zeros), not only the median, in the playtest report. Get the owner's decision on D6.

**Play: ok, 3 of 5.** Cheap and clean: a 1-byte T2 field, v1 levels decode as 1, so no vector or hash moves. It changes how you play more than a lives knob does, because a charge only works while B is held, and holding B halves your speed. On a 1-life, 3-charge level the player has to call danger in advance and slow down to stay covered. An absorbed boss bump leaves the trail standing, so a stocked shield also allows deliberate slow pushes through the boss's lane. That is a real behaviour change from the 16 levels, which all give exactly one charge and vary only lives (2-5). Still, it is mostly a tuning knob that moves risk between lives and shield. It adds no new board situations, and 0-charge levels like 'bare' only make B a slow-walk key. It reverses D6's 'one charge per level' but keeps D6's meaning of a charge. It fits the existing feel. Search never takes hits, so the gap narrows a little. Calibration needs scripted bots that hold B before predicted hits. Otherwise armored levels get mispriced.

*Fixes.* Ship it as the cap and starting value for one renewable-charge rule (the minion-strand refill is the best fit), not as a standalone knob. With a cap, a stock of 3 has something to fill. Without one, 3 charges is just 3 extra semi-lives. Teach the bold and committer bots to hold B when a hit is predicted within a few ticks, before measuring clear rates. Drop the 0-charge example unless the level wants B purely as precision movement.

*Readability.* Good. Up to 3 charge pips on the 4-px border row in one palette colour, and a pip that empties when a hit is absorbed. The rest is unchanged.

## Blight cells

`scoring-and-risk#13` · T5 Mode, scoring or contracts · score 9 (core 3, fairness 3, play 3) · gap: widens · D14: compliant

A few seeded blight cells sit in the open field, and each one you claim costs score. Cuts must route around them, and the final cut must leave them joined to the boss's region by open corridors, or pay.

**Rule sketch.** Level bytes v2 fields: blight_count (u8, 0 to 8), blight_bp (u16), and a blight rectangle (4 × u8, like the boss spawn rectangle). New validity code: the rectangle must hold at least blight_count cells that are EMPTY at level start. Seed: blight_key = the big-endian u32 of level seed bytes 9 to 12. At level start, after the grid is built, let n = the number of EMPTY cells in the rectangle. For i = 0 to blight_count − 1, take candidate number fmix32(blight_key XOR i) mod n in row-major order; if it is already taken, step to the next free candidate, wrapping around. The indices go into a fixed u16\[8\] array that, like the boss start, is a function of level and seed and is not in the state hash. Blight cells are ordinary EMPTY cells for every rule: the boss crosses them and trails pass through them. At the end, blighted = the number of blight cells that are CLAIMED, score_bp = max(0, claim_bp − blight_bp × blighted) (0 when the lives ran out), and levelScore = score_bp × weight_bp / 10,000. claim_bp still decides the clear. A blight cell stays open only if a 4-connected EMPTY path joins it to the boss's body when a capture fills (R4.8-3). A one-cell corridor is enough, and the boss (B ≥ 2) cannot enter it.

**Inspired by:** Loopinball (2025), 陣取り (Evio) (1993), Kid Grid (1982). **Mechanic families:** [Penalty targets](../taxonomy/scoring-and-risk.md#penalty-targets), [Hidden point grid](../taxonomy/scoring-and-risk.md#hidden-point-grid), [Marked bonus regions](../taxonomy/scoring-and-risk.md#marked-bonus-regions). **Touches:** level-format, rules, outcome, economy, tools-bots, presentation.

**Decisions it reopens:** §6.4 seed bytes 9-12; §5 level bytes v1; §8.4 level_score; P11.

**Bot effect.** Roughly keeps the gap. The ceiling drops for everyone, because a cage must leave corridors or pay, which trims search's absolute lead. But search will find good corridor shapes with its capture lookahead (counting blighted cells is cheap to add), while humans approximate them. Seeded positions keep runs from sharing a layout (D14).

**Budget.** 16 bytes of RAM for the positions, not hashed. At level start, at most 8 scans of the 3,600 cells, once. At the end, 8 lookups. Nothing per tick, zk cycles about +0. Screen: up to 8 cells in one new palette colour.

**Variety.** Adds a spatial puzzle the 16 levels lack: cells to keep open rather than claim, cuts that build corridors, and a cage that has to spare particular cells. A minion patrolling a corridor's rail adds pressure.

**Core engineer: feasible, 3 of 5, tier 5.** Sound. Positions are drawn once at level start, with fmix32 on unused seed bytes 9-12, and the linear probing terminates under the new validity code. They are a function of the level seed outside the state hash, like the deflection key (R4.6-11). Blight cells stay ordinary EMPTY cells, so no movement or capture rule changes: R4.8-3's fill already decides what stays open. Costs: level v2 (+7 B), a new derivation with its fixtures in vectors/derivations.json, and the scoring change. The fixtures matter because a target that places blight wrongly shows no trace divergence; only the final levelScore differs. The penalty blight_bp x 8 must be computed in u32. On the gap: corridor-keeping cages are exactly what search's capture lookahead optimizes, while humans approximate. The greedy-rectangle scripted bots will claim blight blindly unless rewritten, and calibration would then misread the levels. I expect the gap to widen slightly, not hold. Wedgie: 16 B in Game, on the core stack whose start peaks at 62.8 of 64 KB (fine), one palette entry of the 16, and the status or paint export must expose the 8 positions.

*Fixes.* Add derivation fixtures for the blight positions. Validity: the rectangle lies inside the interior, and blight_bp is bounded so 8 x blight_bp \<= 10,000. Teach the scripted bots to avoid blight before calibrating. Export the positions to both clients.

*Cost.* 16 B RAM, not hashed. At level start: up to 8 rectangle scans (about 29k cell reads once, under 0.1% zk). At level end: 8 lookups. Per tick: 0. Level v2 +7 B (479 B) with a new validity code. No state hash change. RULES_VERSION 3. Outcome and derivation vectors change, recalibration.

*Conflicts.* §6.4 seed bytes 9-12; §5 level bytes v1; §8.4 level_score; P11

**Fairness: concerns, 3 of 5; gap widens; D14 compliant.** D14 holds: blight positions come from unused seed bytes 9 to 12, so no two runs share a layout and nothing can be precomputed. It trims search's cage, since corridors cost maybe 300 bp off 9,881, but it adds a spatial puzzle that search's capture lookahead solves exactly (counting blighted cells is cheap). Humans either pay the penalty or route longer cuts around blight, and longer cuts mean more exposure and more deaths, which search does not suffer. Net, the gap is likely kept or slightly widened, not narrowed. The bigger fairness issue is within-slot seed luck. Eight seeded cells can land clustered near the boss's side (nearly free) or scattered across the area the player must claim (costly). Per-slot weights normalize the level's average, not the variance between seeds, so two players on the same slot face different difficulty. Calibration is possible: the scripted bots' capture evaluation needs a blight penalty term, which is easy to add but a crude stand-in for human routing. Seed bytes 9 to 12 are also wanted by the twin-boss idea, so the two need coordinating.

*Fixes.* Stratify placement (one blight cell per sub-rectangle of the blight rectangle, or a minimum spacing) to cut seed luck, and keep blight_bp small. Give the scripted bots a blight-aware capture score before calibrating. Measure the score spread across seeds on one level in the playtest report. Reserve seed bytes in one place to avoid clashes with other seeded mechanics.

**Play: ok, 3 of 5.** A genuinely new spatial idea. No current level has cells you want to keep open, and seeded positions mean no shared layouts. It changes where you cut all level long: an edge nibble near a blight cell claims it unless the trail leaves a corridor. The final cage must keep corridors to the blight cells or pay, which is a claim-versus-penalty trade. One-cell corridors interact well with the existing rules. The boss (B of 2 or more) can't enter them, so they are safe pockets, but their walls become rail that minions patrol, which adds pressure. It also lowers the ceiling for everyone, trimming search's cage lever honestly. Weaknesses: the decision affects score only, never survival, so for most of the level it is bookkeeping layered on a capture. Making 1-cell corridors with a 5-way joystick at 15 Hz, especially at fast-cut speed, is fiddly. And a penalty mechanic makes the satisfying moment of capture feel like a loss.

*Fixes.* Use about 4 blight cells, not 8, and set blight_bp so that paying is sometimes the right call. Give claimed blight a second distinct colour so the penalty is visible. In the browser, warn when the current trail would cut a blight cell off from the boss's region. Consider a variant where blight cells left open at the end pay a bonus instead of claimed ones costing, which keeps the corridor puzzle but feels like a reward.

*Readability.* Mostly fine. Up to 8 single cells in a dedicated palette colour stand out at 4x4 px. One-cell corridors are 4 px wide: visible, but precise to draw. Whether a blight cell is still joined to the boss's region is hard to read on a cluttered field.

## Greed cap per capture

`scoring-and-risk#12` · T5 Mode, scoring or contracts · score 9 (core 3, fairness 4, play 2) · gap: narrows · D14: compliant

Each capture scores at most a level-set share of the field, say 15%. The excess still counts toward the clear but not toward the score, so the best play is a series of well-sized cuts rather than one cage around the boss.

**Rule sketch.** Level bytes v2 field cap_bp (u16, 0 = no cap). At level start, cap_cells = cap_bp × claimable / 10,000. State hash v2 adds score_cells (u16). At step 3, after a capture of s cells, score_cells += min(s, cap_cells). claim_bp, from all captured cells, still decides the clear. At the end, score_bp = score_cells × 10,000 / claimable (0 when the lives ran out) and levelScore = score_bp × weight_bp / 10,000. With target 7,500 and cap 1,500, no play scores more than about 8,999 bp: at most 7,499 before the crossing capture plus 1,500 for it, against today's ceiling of about 9,900. The HUD, and the capture preview where present, colour the capped excess.

**Inspired by:** Enveloping Darkness (2025), RetroQix (2026). **Mechanic families:** [Capture-size penalty](../taxonomy/scoring-and-risk.md#capture-size-penalty), [Overfill percentage bonus](../taxonomy/scoring-and-risk.md#overfill-percentage-bonus). **Touches:** level-format, rules, state-hash, outcome, economy, tools-bots, presentation.

**Decisions it reopens:** §8.4 level_score; P11.

**Bot effect.** Narrows the gap. Search's biggest lever is the final capture that leaves the boss only its body (9,881 bp on open against the mix's 7,708). With a 1,500 bp cap that capture is worth at most 1,500 bp, a size careful humans can also reach. Search still clears every level and sizes its cuts exactly, so it keeps a smaller edge.

**Budget.** 2 bytes of state and one min per capture. zk cycles about +0.

**Variety.** Turns the overshoot gamble around: players plan the size of each capture and aim the crossing cut at exactly the cap, with no reward for caging the boss.

**Core engineer: feasible, 3 of 5, tier 5.** The math is sound: score_cells \<= captured fits u16, and the 8,999 bp ceiling at 7,500/1,500 checks out. The bot-gap claim is unproven and may invert. Greedy and Bold capture 'the largest rectangle out of the boss's reach', and the human journals clear labyrinth at 8,444 bp in 163 ticks and the open field at 8,644 in 333: a few big captures. All of these get truncated. Search re-plans to cut pieces of exactly the cap, a precision task it excels at. Worse, a lucky capture from 10% to 80% (boss pinned in a corner) clears the level at about 25% score: the genre's best moment becomes a catastrophe, and humans hit it far more often than search. Sizing cuts well needs a capture preview, which is a flood fill per tick. That is fine in wasm but not affordable on the wedgie: a second 6.7 KB stack buffer against about 17.4 KB of free heap whose largest block is 2.4 KB, plus about 10 ms per tick.

*Fixes.* Use a soft cap (excess counts 1/2 or 1/4) or exempt the clearing capture. Keep the preview browser-only. Rerun bot-advantage with the mix before adopting.

*Cost.* State +2 B (preimage 950 B), level +2 B (level v2). Per capture: one min and one add. Per tick: 0, zk +0. State hash v2, RULES_VERSION 3, traces regenerated, recalibration. An optional browser preview costs a fill per tick in wasm only.

*Conflicts.* §8.4 level_score; P11

**Fairness: ok, 4 of 5; gap narrows; D14 compliant.** D14 holds. It directly targets search's main per-level lever. Today search's edge over greedy (1.29x) is the final cage that leaves the boss only its body. Since a clear ends the level at step 3, the best score becomes about (target - 1) + cap = ~8,999 bp at a 7,500 target and a 1,500 cap. Search will hit that exactly. A careful human who reaches ~7,200 and then makes a crossing capture of 1,500 or more lands near 8,700, so the cleared-level gap falls from ~20% to a few percent. It does not touch the larger source of the 2.03x ratio, the mix's zeroed and committed levels, so the overall narrowing is moderate. Precision sizing (aiming for exactly target-1 and exactly cap) still favours search slightly. Scripted bots play it unchanged, though greedy and bold should become cap-aware for representative calibration. The cap is per-level data absorbed by the weights, and compressing the top of each level's distribution reduces upside draw variance. Side effect: more, smaller captures mean more fills and passes, so zk cycles rise somewhat.

*Fixes.* Make the scripted bots cap-aware (aim captures at or below cap_cells) before calibrating. Rerun bot-advantage to measure the actual ratio change. Check zk cycles on a many-capture journal.

**Play: weak, 2 of 5.** It narrows the bot gap by removing the big final cage, but that cage is also the game's climax for humans: the overshoot gamble, and the genre's appeal of greed. Every level converges on the same accounting play, a series of cuts of about 500 cells kept just under the target, then a crossing cut sized to the cap. It also neuters level identity: on maze, labyrinth, ring, comb and serpent, sealing a door to take a whole band is the signature move, and the cap wastes most of it. 'Aim exactly at the cap' needs players to judge capture sizes of hundreds of cells by eye. There is no capture preview in the game, and certainly none on the wedgie, so humans can't execute it, while search sizes cuts exactly. It adds an optimisation constraint, not new situations with the boss, minions or shield.

*Fixes.* Drop it as a general rule. If kept at all, make it a rare per-level variant with a generous cap (30% or more), never on door levels, and only with a live capture-size readout in the browser. Better ways to trim search's cage lever: blight cells, or excluding the clearing capture from bonuses.

*Readability.* Poor for the core skill. Estimating capture size in cells at 4x4 px is guesswork without a preview. Colouring the excess on the HUD only explains the loss after the fact.

## Low target where the crossing cut decides the score

`scoring-and-risk#3` · T1 Level data v1 · score 9 (core 3, fairness 2, play 4) · gap: widens · D14: compliant

Two new kinds of level built only from v1 knobs. In the one-cut level, the first capture ends the level and is the whole score. In the one-life sprint, a low target turns the capture that crosses it into one all-in gamble, which Commit can refuse.

**Rule sketch.** Level bytes v1, no rule change. One-cut: target 1 bp (offset 470), so the first capture clears (PIN-10), since one cell is 2 bp of 3,364. Lives 3: a hit erases the trail and returns the player to the cut start (R4.9-17), so a failed attempt costs a life, not the level. T 1,200. B 6, boss period 2, spawn rectangle (20,20)-(33,33), no minions. Obstacles: four 3×3 islands at (14,14), (43,14), (14,43) and (43,43). They are CLAIMED, so touching one closes the cut early: a safe exit that caps the capture. Score = claim of that single capture; X or a time-out scores the 0 claim. Sprint-cage: target 2,500, lives 1, T 900, B 5, period 2, two minions at period 3 on border rail cells. The capture that crosses 2,500 bp ends the level, and its overshoot is the score. One hit scores 0 (D5), so the player chooses between Commit at about 2,400 bp and one large cut. Both are ordinary 472-byte levels that pass validity, with new level ids. Each also needs its levels/src source, a levels/README.md entry, a targets.json row, a playtest and calibration, as for any level.

**Inspired by:** Volfied (1989), Doodlebug (1984), iSlash (2010), Claim (DaNuTree) (2026), Qix (1981), Styx (1983), Zolyx (1987). **Mechanic families:** [First-cut boss jackpot](../taxonomy/scoring-and-risk.md#first-cut-boss-jackpot), [Big single-capture bonus](../taxonomy/scoring-and-risk.md#big-single-capture-bonus), [Push past the quota or bank](../taxonomy/scoring-and-risk.md#push-past-the-quota-or-bank), [Fewest-cuts scoring](../taxonomy/scoring-and-risk.md#fewest-cuts-scoring), [Overfill percentage bonus](../taxonomy/scoring-and-risk.md#overfill-percentage-bonus), [Configurable or escalating clear threshold](../taxonomy/capture-rules.md#configurable-or-escalating-clear-threshold). **Touches:** level-data, tools-bots, economy.

**Bot effect.** Widens the gap. A single long cut timed against the boss's seeded future is the play where perfect foresight pays most: search can draw a loop that leaves the boss only a small region, while a human has to judge it. Weights normalize each level's median, not the gap, so these levels belong in Training or in one of the 16 slots at a moderate weight.

**Budget.** 472 bytes per level. Per-tick cost is the same as existing levels, and shorter levels lower zk cycles. No RAM or screen change.

**Variety.** The one-cut level asks a single question, how far to go out, and its islands are the first mid-field early exits. The sprint makes the Commit-or-gamble choice the whole level instead of a late afterthought.

**Merged from:** `v1-levels#12`. Variants:

- Big finish: the crossing cut decides the score: The target is only 50 %, but the capture that crosses it keeps its whole area. Creep over the line and you score about half; stay just under it, pen the small boss in a corner, and one cut can take the score past 95 %.

**Core engineer: feasible with changes, 3 of 5, tier 1.** Both levels are valid v1 bytes. One-cut: claimable = 3,364 - 36 = 3,328, and any capture's claim is at least 3 bp, so the first capture clears (PIN-10). The islands avoid the B6 spawn body area, which spans 20..38, and keep the field 4-connected. A cut from the border to an island separates no region, so that 'safe exit' captures only the trail cells and clears with a tiny score, which matches the sketch. Before the capture, X and a time-out both score 0, and running out of lives also scores 0, so D5 has no bite. Three lives are three free attempts, then a safer last try.
Problems:
(1) Calibration of sprint-cage. The committer only commits when lives == 1 && start > 1 (tools/src/bots/mod.rs), so on a one-life level neither mix policy ever commits. With one life, a period-2 boss and two minions, bold's death rate can exceed 50 %. The mix median effective claim would then be 0, below the P11 floor of 500 bp, and playtest --check rejects the level.
(2) There is no 'moderate weight' option. A weight is P x 10,000 / max(m, floor) (§8.4), never chosen. One-cut's mix median is likely about 1-2k bp, because the greedy family takes the largest safe rectangle, which also ends the level. That gives a doom-like weight: doom's is 64,620 at median 1,857, and today's P is 12,000. It would likely lower P for the whole season, and it reproduces doom's roughly 4x search gap on one more slot.
(3) Tools: SEASON_LEVELS = 16 is hard-coded.
The idea states its gap widening honestly. Sprint-cage's real choice is the size of the crossing cut: a small crossing at about 2,550 bp dominates Commit at 2,400, and the B-held shield still absorbs one hit.

*Fixes.* Ship one-cut in Training only, or in Challenge only after measuring its weight and gap, accepting a doom-like slot. Give the committer (or a new mix policy) a commit threshold on one-life levels, so the mix models the Commit choice. Measure sprint-cage's mix median against the 500 bp floor before it gets a slot, and retune lives or minion period if the median is 0. Generalize the tools beyond 16 levels.

*Cost.* 472 B per level, no format or rule change, no vectors. Per tick: as today. zk: shorter levels (T 900-1,200) cut the worst-case cycles. Offline: playtest and calibration, plus a bot policy change (tools/src/bots/**, which reruns playtest --check and rebuilds levels/README.md per CLAUDE.md).

*Conflicts.* P11 floor (sprint-cage mix median may be 0); §8.4 weight formula (weights are computed, not chosen)

**Fairness: concerns, 2 of 5; gap widens; D14 compliant.** The boss stays seeded, so D14 holds. But the one-cut level puts the whole score on a single capture, which is where foresight of the seeded boss pays most. Search can box the B6 boss for about 9,800 bp, while the mix's first capture is small. The weight is P x 10,000 / max(m, 500). If the mix median m sits near the 500 bp floor (P11, targets.json), the weight is P x 20. The uint16 cap of 65,535 then forces P down from 12,000 to 3,000 for the whole season. That one slot becomes worth about 20x a median score on another slot for search, and about 10x for a human who takes 50% in one cut. A run draws it 37.5% of the time, so it decides the ranking, and it rewards paid re-rolls (buy several runs, play the best draw, §8.2). The pitch's 'moderate weight' is not available: §8.4 takes every weight from the calibration file. The islands are not real safe exits. A cut that ends on an isolated island encloses nothing unless the path already cuts off a region, so a bail-out scores little more than the trail. The early ticks give a seed-independent floor: with spawn rectangle (20,20)-(33,33), the outer ring is boss-free for the first 20-40 ticks on every seed, a learnable safe opening that here is the whole score. That is not copying or precomputing a game, but it is a fixed floor. Sprint-cage (target 2,500, 1 life) is a second doom. The mix median is about 2,400 because committers bank, and search reaches about 9,800, a ratio of about 4 like doom's 9,580 / 2,338 = 4.1. With one life it also adds zero-score variance on a slot weighted about 50k. Bots can play both levels, so calibration works mechanically.

*Fixes.* Keep the one-cut level in Training only. If sprint-cage enters Challenge, give it at least 2 lives and a target that keeps the mix median far above the 500 bp floor. Say openly that it widens the gap as doom does, and check it with a bot-advantage run before a season uses it.

**Play: strong, 4 of 5.** Uses only v1 knobs (target range 1-10,000, lives 1 or more, islands pass validity 35), yet it changes what the score means. Because PIN-10 ends the level at the crossing capture, a low target makes the overshoot of one capture the whole score. On current levels that overshoot is capped at about 2,500 bp; here it ranges up to about 7,000 bp. Sprint-cage is the stronger half: creep to just under 2,500 to shrink the boss's space, then make one big fenced cut. Commit at about 2,400 is the real alternative, and holding B during the big cut adds tension (the charge absorbs one hit, but the cut moves at half speed). One-cut is a pure 'how far out' puzzle, and with 3 lives each failed attempt costs one life. But X is always 0 there, so Commit loses its role. The islands are weaker than pitched: a cut that ends on an island captures only its trail plus the thin pocket it wraps around the island. So they are bail-outs worth nearly nothing, or hazards that end the cut early, not meaningful early exits. Bot gap: the pitch says it widens, and that is right. A single long cut timed against the seeded boss is exactly where search beats judgement.

*Fixes.* Lead with sprint-cage, or the 'Big finish' variant with 2 lives, so that one minion touch during the creep does not decide the level: put the risk in the crossing cut. In sprint-cage, either drop the minions or slow them to period 4 or more, for the same reason. In one-cut, replace the 3×3 islands with short bars from the border that act as real anchors for a mid-sized capture, or drop them. Keep one-cut in Training. Put sprint-cage in a Challenge slot only at a moderate weight, and check its effect in the bot-advantage report.

*Readability.* Fine. It uses the same visuals as today, and 3×3 islands are 12×12 px blue blocks that read clearly. The start overlay must state the unusual rule ('first capture ends the level' or 'the crossing capture is your score'), since nothing on the field shows it. The browser HUD's 'claim of target' line already helps with the creep.

## Minion stranding bounty

`scoring-and-risk#10` · T5 Mode, scoring or contracts · score 8 (core 3, fairness 2, play 3) · gap: widens · D14: compliant

A capture that leaves a minion's cell off the rail pays a bounty, and stranding two or three minions with one capture pays 3x or 6x. Minions become targets as well as threats.

**Rule sketch.** Level bytes v2 field bounty_bp (u16, 0 = off). State hash v2 adds bonus_bp (u16) and paid_strands (u8). At step 3, after a capture of s cells, R4.7-8 destroys each live minion whose cell is no longer a rail cell; let k be their number (0 to 3). If s ≥ 64 and paid_strands \< 6, then bonus_bp += bounty_bp × \[0, 1, 3, 6\]\[k\] and paid_strands += k. Respawn does not change (countdown R, at the spawn cell). At the end, score_bp = claim_bp + bonus_bp (0 when the lives ran out), and levelScore = score_bp × weight_bp / 10,000. Nothing is seeded: minions follow the right-hand rule from the visible grid, so their paths are as readable to a human as to a bot. The 64-cell size floor and the cap of 6 paid strands stop repeated micro-cuts at a respawn cell from piling up bounties.

**Inspired by:** Shocker (1988), Clax (1985), Dig Dug II (1985), Line Knight Fortix (2014). **Mechanic families:** [Enemy-capture bounty](../taxonomy/scoring-and-risk.md#enemy-capture-bounty), [Multi-enemy single-capture bonus](../taxonomy/scoring-and-risk.md#multi-enemy-single-capture-bonus), [Escalating kill chain](../taxonomy/scoring-and-risk.md#escalating-kill-chain). **Touches:** level-format, rules, state-hash, outcome, economy, tools-bots, presentation.

**Decisions it reopens:** D7; R4.7-8; §8.4 level_score; §7.2 run score bound; P11.

**Bot effect.** Roughly keeps the gap. Minion movement follows from the visible grid, with no seed, so humans can predict strandings as well as search can, although search still times multi-strandings more precisely. The scripted bots need a rule that seeks strandings, or calibration will undervalue bounty levels.

**Budget.** 3 bytes of state. Work happens only at captures, where R4.7-8 already finds k. zk cycles about +0. Screen: a short '+150' popup.

**Variety.** Minion levels (sentry, trio, swarm, doom) gain an attacking choice: shape and time a cut to strand the patrol ahead of you, which also clears that rail for R ticks.

**Core engineer: feasible with changes, 3 of 5, tier 5.** Free in compute: R4.7-8 already finds k at each capture, and the state grows 3 B. Four holes. (1) Overflow: the maximum bonus is 12 x bounty_bp (two triple strandings; five singles then a triple gives 11x). bounty_bp is an unbounded u16, so bonus_bp and score_bp can overflow u16 without a validity bound. (2) 'paid_strands \< 6' followed by '+= k' lets the count reach 8. (3) The gap claim is wrong. Readable minion paths help humans, but the 1/3/6 payout rewards the multi-minion timing that search does best. Search will bank the full 12x on every minion level (sentry, trio, swarm, doom). The scripted mix never strands on purpose, so its median barely moves, the calibrated weights stay where they are, and search's lead grows by up to 12 x bounty_bp per minion level: about 1,800 bp at the popup's 150. (4) score_bp can pass 10,000, so the §7.2 bound of 393,210 changes. Contracts are fine: uint32, checked sum. On the wedgie there is no in-play HUD for the popup.

*Fixes.* Bound bounty_bp in validity (for example at most 500, so 12x fits with margin). Pay for min(k, 6 - paid_strands). Use a linear payout (1, 2, 3) to cut the precision premium. Add a stranding-seeking scripted policy to the mix before calibrating. Rerun bot-advantage.

*Cost.* State +3 B (preimage 951 B), level +2 B (level v2). Per capture: one table lookup and a multiply-add. Per tick: 0, zk about +0. State hash v2, RULES_VERSION 3, traces regenerated, a new bot policy, recalibration, §7.2 and §8.4 text.

*Conflicts.* D7; R4.7-8; §8.4 level_score; §7.2 run score bound; P11

**Fairness: concerns, 2 of 5; gap widens; D14 compliant.** D14 holds: minion paths were already a deterministic function of the grid, and the bounty adds no new copyable pattern. I disagree with 'roughly keeps the gap'. Minion paths are readable to humans, but the bonus is superlinear (1, 3, 6). A triple strand needs a capture of at least 64 cells that closes exactly when three minions, each on its own move period and respawn countdown, sit on rail the capture removes. That is multi-entity timing that search plans perfectly and humans cannot judge in real time. Search will saturate the 6-strand cap on every minion level (up to 12 × bounty_bp via two triples). The mix will get occasional singles. Minion levels (trio, swarm, doom) carry the highest weights, because the mix's median there is lowest, so the bonus lands on exactly the slots that already amplify search's lead. It also raises the score ceiling above the claim ceiling, opening a new axis where search is near optimal and humans are far from it. Calibration is weak here: no current scripted bot seeks strandings, a crude rule will not represent humans, and the weights will undervalue the bonus. Draws heavy in minion levels then favour bonus-capable players, which adds draw variance.

*Fixes.* If kept: make it linear (no 3x or 6x), keep bounty_bp small, and lower the cap. Do not use it in a paid season until a strand-seeking scripted bot exists and bot-advantage has been rerun with search optimizing strandings. Alternatively make stranding valuable through play (a cleared rail for R ticks), not through score.

**Play: ok, 3 of 5.** Minions turn from threats you avoid into targets you hunt, which fits the genre: enclosing enemies for points is a classic of the family. On the minion levels (sentry, pair, comb, trio, swarm, doom) it adds an attacking choice: time and shape a cut so the region a minion is bounding gets claimed. The right-hand patrol is unseeded and readable, so humans can plan it. The size floor and the cap of 6 stop micro-cut farming at a spawn cell. The main flaw: the final cage around the boss strands nearly every live minion, because the whole outer rail goes off-rail at once. So the clearing capture collects the full 6x bounty almost automatically. That pays the play search already dominates, and makes the bounty mostly a bonus on the cage rather than a mid-level tactic. Stranding already has a payoff today (a clear rail for R ticks), so the bounty adds incentive more than new situations.

*Fixes.* Exclude the clearing capture, the one that brings the claim to target, from the bounty, so strandings pay only mid-level, where they are a real choice. In the browser, make the minions that the current trail would strand blink, so humans can aim strandings as precisely as search. Give the scripted bots a stranding-seeking rule before calibration.

*Readability.* Moderate. Minions are single 4x4 px cells but have their own colour, and a '+150' popup is easy to read. Predicting which minions a capture will strand means reading the rail ahead, which is hard on 4x4 cells without a preview.

## Twin bosses and the split multiplier

`scoring-and-risk#14` · T5 Mode, scoring or contracts · score 7 (core 2, fairness 1, play 4) · gap: widens · D14: compliant

**Rejected:** the fairness judge found it unacceptable. The 2× multiplier after a split pays for timing a cut between two seeded bosses, where perfect foresight pays most: search would split on every two-boss level, while calibration sees only the mix, which rarely splits. The core engineer also found D7's coverage property false after a split.

Levels with two bosses. The cut that leaves them in separate regions doubles that capture and every later one until you lose a life, so threading a line between the two bosses early is the big gamble.

**Rule sketch.** Level bytes v2: boss_count (1 or 2) and a second boss block (B2 2 to 8, spawn rectangle, move period). New validity code: every pair of start bodies is disjoint, that is, the two spawn rectangles, each extended by its body, do not overlap. Seed: boss 1's start index from seed bytes 9 to 12, its vx and vy from bits 2 and 3 of byte 4, and its deflection key from bytes 13 to 16, all unused today. State hash v2 adds boss 1 (x, y, B, vx, vy, period: 7 bytes), split (u8), mult (u8, starts at 1) and score_cells (u16). Step 4: boss 0 moves, then boss 1, each by R4.6-6/7 with its own key and by R4.6-3. An edge cell covered by the other boss's body counts as blocking: it inverts that component and is not a hit. Hits by either boss work as today (R4.9-2, R4.9-3). Capture (R4.8-2 already seeds from every boss): fill from boss 0's body. If boss 1's top-left cell is still EMPTY (unreached) and split = 0, the bosses are now in different regions, so split = 1 and mult = 2. Then fill from boss 1, and make the one pass of R4.8-4. score_cells += s × mult. At step 6, a lost life sets mult = 1 for the rest of the level. Regions never rejoin, so a split happens at most once. claim_bp decides the clear; score_bp = score_cells × 10,000 / claimable (0 when the lives ran out). Ceiling: claimable − B0² − B1². The minion coverage argument (D7) assumed a single open region: after a split, each minion patrols its own region's boundary, and M1's coverage test must check that.

**Inspired by:** Qix (1981), Torch 2081 (1986), Qyx (2022), AQuix (1997). **Mechanic families:** [Boss-split reward](../taxonomy/scoring-and-risk.md#boss-split-reward), [Multi-enemy single-capture bonus](../taxonomy/scoring-and-risk.md#multi-enemy-single-capture-bonus), [Context score multipliers](../taxonomy/scoring-and-risk.md#context-score-multipliers). **Touches:** level-format, level-data, rules, state-hash, outcome, economy, tools-bots, presentation.

**Decisions it reopens:** D9; D14; D7; R4.6-1; R4.6-3; R4.8-2; R4.9-3; §5 validity; §6.4 seed bytes; §8.4 level_score; P11.

**Bot effect.** Widens the gap. Threading a cut between two seeded bosses is long play timed against exposure, where perfect foresight pays most. Humans see both bosses but cannot predict their deflections. The exposure forecast idea would partly offset this.

**Budget.** About 11 bytes of state (the preimage grows to about 959 bytes). Per tick, a second boss move: at most 2 × 8 edge reads plus a rectangle-overlap test, roughly +3 to 6% zk cycles on a two-boss level. Captures cost the same, because the fill already visits each open cell once and the split test is one cell read. Screen: a second body redrawn per move.

**Variety.** Two threats with a strategic choice: split them early for a multiplier and two smaller fields, each safe from the other boss, or claim around them and keep the field whole. No current level has more than one boss.

**Core engineer: feasible with changes, 2 of 5, tier 5.** Mechanically sound. One-axis moves that treat the other body as blocking cannot overlap disjoint starting bodies. Filling from boss 0 first and then testing whether boss 1's top-left cell is still EMPTY is a correct, cheap split test, equivalent to R4.8-2's joint seeding. Regions never merge, so a split happens once. Two flaws. (1) After a split, D7's coverage property (PIN-14, R4.7-4 to R4.7-6) is false as written, not merely untested. The 1-cell wall's rail cells touch both regions, so both boundaries lie in one rail component C. The right-hand patrol traces only its own face of that component, so every minion is 'trapped' by definition. PIN-14, the D7 rationale and the coverage test must be restated per region. (2) A 2x multiplier for the rest of the level is the largest scoring lever in this batch. It goes to whoever times a border-to-border cut between two seeded bosses, which is search with the deflections in its lookahead. The scripted mix never splits, so calibration will not price it, and the pot-share ratio could approach double on twin levels. Every boss check doubles too: R4.9-3 body hits, validity 37, the seed derivation and the render.

*Fixes.* Restate the coverage property per open region. Shrink the payoff: 1.25x, or a one-off bonus for the splitting capture. Write a scripted splitting policy before calibrating, and measure bot-advantage on twin levels.

*Cost.* State +11 B (preimage about 959 B). Game about +12 B on the core stack (start peaks at 62.8 of 64 KB: it fits, but the margin is thin). Per tick: a second boss move (up to 16 edge reads plus a rectangle-overlap test), about +3-6% zk cycles on twin levels; captures cost the same. Level v2 (+7 B), a new disjointness validity code, new seed derivations (byte 4 bits 2-3, bytes 9-16), state hash v2, RULES_VERSION 3, all traces regenerated, new level data, recalibration. The wedgie draws a second body.

*Conflicts.* D9; D14; D7; PIN-14; R4.6-1; R4.6-3; R4.8-2; R4.9-3; §5 validity; §6.4 seed bytes; §8.4 level_score; P11

**Fairness: unacceptable, 1 of 5; gap widens; D14 compliant.** D14 holds: boss 1's start, direction and deflection key come from unused seed bytes. The split multiplier is the problem. Threading a cut between two independently deflecting bosses is long exposure timed against two unpredictable paths, which is where perfect foresight pays most, as the pitch admits. Once split, every later capture counts double, including the final cages. So search would split early on every two-boss level and approach about 2x today's per-level score, while most humans never risk the split. Calibration normalizes the mix's median, which rarely includes a split, so search's 2x passes through the weights. Two-boss levels in the draw would then hand bots, and the few humans who split, large draw-dependent upside. Separately, D7's coverage argument breaks after a split. The splitting wall's CLAIMED component borders two field regions, so a minion tracing one boundary never visits the rail on the other side, which PIN-14 counts as trapped. M1's property test would fail as the rule stands. The extra per-tick boss work also raises proving cost, about 3 to 6% on those levels.

*Fixes.* Drop the split multiplier entirely, and score two-boss levels by plain claim (ceiling claimable - B0² - B1²). Ship twin bosses as T3 level content only after redefining minion coverage for multi-region fields and passing the coverage test. Or keep the split mechanic in Training only.

**Play: strong, 4 of 5.** The most variety in this batch. Two bosses double the threat geometry, give regions a strategic meaning, and create the classic 'thread a line between them' gamble, a borrowed genre mechanic that fits the game's feel. No current level has more than one boss, and R4.8-2 already anticipates it. The decision dramatically after a split: a lost life ends the multiplier for the rest of the level, so post-split play becomes careful, which ties neatly into D5 and Commit. Two large bodies are the most readable elements on screen. Reasons it is not a 5: as specified, splitting is dominant whenever you can achieve it, so the 'split or keep the field whole' choice isn't real, only when and how to attempt the split. The 2x makes level scores bimodal, which is hard to calibrate. It honestly widens the search gap: threading timed against two seeded bosses is where perfect foresight pays most. The bosses blocking each other is a new interaction players need to read.

*Fixes.* Ship in two steps. First, twin bosses as a level feature (T3, Training first) with no multiplier, to tune B (3 to 5 for each twin) and the boss-to-boss bounce. Then add the split reward at a smaller value, for example 1.5x, or as a one-time bonus for the split capture, to soften the bimodal stakes. Calibrate only after a split-seeking scripted bot exists. Give the second boss its own colour and flash the moment of the split.

*Readability.* Very good. The boss bodies are 8 to 32 px squares, so two distinctly coloured bosses read at once. The split moment and a 'x2' HUD tag are simple. A second body redrawn per move is cheap.

## Quick-chain multiplier

`scoring-and-risk#11` · T5 Mode, scoring or contracts · score 6 (core 2, fairness 2, play 2) · gap: widens · D14: compliant

Close a capture within three seconds of the previous one and the chain grows: linked captures count 1.25x, 1.5x, 1.75x and up to 2x, until you lose a life or let the window lapse.

**Rule sketch.** Level bytes v2 field chain_window (u8 ticks, 0 = off, for example 45). State hash v2 adds chain (u8, 0 to 4), last_capture_tick (u16, 0xFFFF before the first capture) and score_q (u16, in quarter cells). At step 3, after a capture of s cells on tick t: if last_capture_tick ≠ 0xFFFF and t − last_capture_tick ≤ chain_window, then chain = min(chain + 1, 4), else chain = 0. Then score_q += s × (4 + chain) and last_capture_tick = t. At step 6, a lost life sets chain = 0; a hit the shield absorbs does not. claim_bp still decides the clear. At the end, score_bp = score_q × 2,500 / claimable (0 when the lives ran out) and levelScore = score_bp × weight_bp / 10,000. score_q ≤ 8 × 3,364 = 26,912, which fits a u16. HUD: the chain count and a draining window bar.

**Inspired by:** VoidMania (2026), Landgrab - Line Cutting Arcade (2026), firmament i-a (2001), Territory: Claim & Conquer (2026). **Mechanic families:** [Capture combo chain](../taxonomy/scoring-and-risk.md#capture-combo-chain), [Clear-speed bonus](../taxonomy/scoring-and-risk.md#clear-speed-bonus). **Touches:** level-format, rules, state-hash, outcome, economy, tools-bots, presentation.

**Decisions it reopens:** §8.4 level_score; §7.2 run score bound; P11.

**Bot effect.** Mixed. It narrows the gap against the measured search bot, which pads between captures to build up compute: padding breaks the chain, so search must choose between search depth and the multiplier. It also rewards the quick rhythm seen in the human journals. A bot with spare cores plans chained setup-and-finisher captures, and the multiplier also applies to its final cage, so against such a bot the absolute gap can grow.

**Budget.** 5 bytes of state. Work happens only at captures. zk cycles about +0. A HUD bar.

**Variety.** Adds tempo: string together quick small cuts to build the chain before the big one, and keep moving instead of waiting on the rail.

**Core engineer: feasible with changes, 2 of 5, tier 5.** The arithmetic fits: score_q is at most 26,912 (u16) and score_bp at most 20,000. But the chain is free to build. A one-cell nibble (step from the rail into EMPTY, then back onto the cut start, R4.5-5) is a capture of s >= 1 in 2 ticks. Four nibbles in about 8 ticks set chain = 4, and one nibble every 45 ticks or less keeps it. Every capture whose cut takes 45 ticks or less (up to 90 cells with A) then scores 2x, the final cage included. The multiplier becomes a chore, not tempo. 'Padding breaks search's chain' does not hold either: search can nibble on the rail while it accrues compute. The scripted mix does not nibble, so calibration will not price the multiplier, and the gap widens, likely by close to 2x on the big captures search plans. The window bar carries timing-critical information, and the wedgie has no in-play HUD (the 60x60 field fills 240x240), so wedgie Training would play it blind or need an overlay on the border rows.

*Fixes.* Add a size floor: only captures of at least a level-set floor (for example 2% of claimable, about 67 cells) advance or keep the chain. Smaller captures reset it. Then give a scripted bot the rhythm and remeasure bot-advantage.

*Cost.* State +5 B (preimage 953 B), level +1 B (level v2). Per capture: a compare, an add and a multiply. Per lost life: one store. zk about +0. State hash v2, RULES_VERSION 3, traces regenerated, recalibration. A per-tick HUD redraw of a few pixel rows on the browser, and a border overlay on the wedgie.

*Conflicts.* §8.4 level_score; §7.2 run score bound; P11

**Fairness: concerns, 2 of 5; gap widens; D14 compliant.** D14 holds: nothing is seeded. The narrowing argument relies on the measured bot's single core and voluntary padding. The README treats a competent multi-core real-time bot as the threat (§7.4), and padding was a choice. Chaining is physically easy: a rail nibble closes in a few ticks against a 45-tick window, so a search bot can keep the chain at 4 for the entire level and take its final cage, its biggest lever (9,881 vs 7,708 bp on open), at 2x. Humans lose the chain every time they wait for the boss to move away, so they average well under 2x. The search-to-mix ratio would grow, possibly by a large factor on top of today's 2.03, and the absolute gap roughly doubles on every chain level. Calibration normalizes only the mix's median multiplier, so search's near-2x passes straight through the weights. The multiplier also spreads per-level score distributions, which raises the upside variance that draws of chain-friendly levels give strong players. Scripted bots can play it, but whatever the playtests measure depends heavily on how the bot's chain-seeking rule is written.

*Fixes.* Exclude the clearing (crossing) capture from the multiplier, cap the multiplier at 1.25x, and use a long window (5 to 10 s) so humans can chain realistically. Or keep it in Training only. Before any paid use, rerun bot-advantage with a search objective that seeks chains and has no padding.

**Play: weak, 2 of 5.** Tempo is a good axis that the game lacks: today you can wait on the rail as long as the time limit allows. A chain would pull against that patience and pair well with D5. As specified, though, it is degenerate. Captures have no size floor, and stepping off the border into one EMPTY cell and back onto the cut start completes a 1-cell capture in 2 ticks, at no risk, far from the boss. Anyone who knows the trick nibbles the chain up to 4 along the rail, then makes the real capture within the 45-tick window, which at fast-cut speed covers about 90 cells. So the multiplier becomes a flat 2x with busywork rituals, gated by trivia, and it doubles the final cage that search already maximises. The pitch's 'string quick small cuts before the big one' collapses into nibbling.

*Fixes.* Advance the chain only on captures of at least a size floor, for example 1% of claimable cells or the 64-cell floor of the stranding bounty, and let smaller captures neither advance nor reset it. Consider leaving the clearing capture out of the multiplier, or capping its bonus, so the chain rewards mid-level rhythm rather than inflating the cage. With those two fixes it would rate about 3 to 4.

*Readability.* Good. A chain digit and a draining bar of a few pixels on the HUD are cheap partial redraws on the wedgie.
