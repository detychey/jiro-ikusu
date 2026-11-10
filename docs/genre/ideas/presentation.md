# Ideas: presentation

The 7 ideas proposed from the lens *presentation*: presentation only (tier T0), in the browser. Sorted by score. The [index](../IDEAS.md) lists every idea by tier and score, and [`README.md`](../README.md#the-taxonomy-and-the-ideas) explains the judges.

## Commit readout HUD

`presentation#8` · T0 Presentation · score 12 (core 4, fairness 5, play 3) · gap: narrows · D14: compliant

The browser HUD shows what pressing X would bank now compared with what a clear pays, plus the level's weight in Challenge. The unused Y key cycles the overlays.

**Rule sketch.** Browser HUD below the canvas: 'X banks:' with the core's level_score(claim_bp, weight) (section 8.4), 'clear pays >= target x weight / 10,000', lives and shield, and in Challenge the run's running score and this level's weight ('x1.37'). On the last life, the X hint glows. Y cycles client-side overlay sets: none, tells only, or tells plus forecast plus preview. It never enters the input mask (section 6.1) or the journal, so no game changes.

**Inspired by:** Illgen (1989), Volfied (PC Engine port) (1989), Space Cropper (2014), Gals Panic (Android) (2024 or earlier), Xonix (Apple II, Matthias Gerhardt) (1983), Kingdom Cutter: Cut & Conquer (2026), VOLTFIELD: 80s Classic Arcade (2026). **Mechanic families:** [Progress HUD](../taxonomy/reveal-and-presentation.md#progress-hud), [Push past the quota or bank](../taxonomy/scoring-and-risk.md#push-past-the-quota-or-bank), [Context score multipliers](../taxonomy/scoring-and-risk.md#context-score-multipliers). **Touches:** presentation.

**Decisions it reopens:** D8.

**Bot effect.** Narrows the gap a little. The bank-or-risk decision that D5 exists for gets the numbers a bot already computes. Showing the weight lets humans spread risk across the 6 drawn levels the way a score-maximizing bot does. D8's reason, that a pause would give humans free thinking time, still holds because the toggle never stops the clock. Only D8's statement that Y is unused changes.

**Budget.** Browser: trivial. zk: 0.

**Variety.** Commit becomes an informed decision. In Challenge, players can see which of their six levels are worth risking lives on, which the current UI hides.

**Merged from:** `reveal-and-presentation#3`. Variants:

- Gauges and commit readout: In the browser, the HUD adds the cells still needed for the target and the points a commit would bank now.

**Core engineer: feasible, 4 of 5, tier 0.** level_score exists in core/src/replay.rs and takes the end reason, so 'X banks' is level_score(claim, weight, Committed). Weights are public season parameters, so showing 'x1.37' in Challenge leaks nothing. The toggle never stops the clock, so D8's reason (no free thinking time) holds, and only its wording changes.

*Fixes.* The D8 and README §2 wording change needs the owner's sign-off.

*Cost.* Core: none. zk: 0 cycles. Browser: trivial.

*Conflicts.* D8 (wording: Y becomes a client overlay toggle, still unjournaled); README §2 controls table

**Fairness: ok, 5 of 5; gap narrows; D14 compliant.** D14 is untouched: nothing seeded is shown. The toggles never stop the clock, so D8's reason (no free thinking time in paid modes) still holds. Only D8's wording that Y is 'unused' changes, and it stays out of the input mask and the journal. The gap narrows slightly: 'X banks' and 'clear pays' expose numbers the bots already compute. The claimed risk-spreading benefit is overstated. Lives and the zero-on-death rule are per level, and the weight scales both the banked score and the score at risk. A level's bank-or-risk choice is therefore the same at any weight. Showing the weight is information, not a strategic lever, apart from minClears, which counts clears without weights. Bots are unaffected and the draw gains no variance.

*Fixes.* Keep the toggles purely visual, so they can never slow or pause the game. In the browser, fix the default overlay set per season so players need not find a key. Update D8's text to say that Y is a client-only overlay toggle.

**Play: ok, 3 of 5.** The browser HUD is valuable for Challenge. 'X banks: N' against 'clear pays >= M' and the level's weight make the D5 bank-or-risk choice and risk spreading across the 6 drawn levels informed, which the current UI hides. The overlay toggle on Y never enters the journal or stops the clock, so D8's reason holds and only its wording changes.

*Fixes.* Make the browser commit readout and weight display the deliverable. Note the D8 wording change in README §13.

*Readability.* Browser: good.

## Picture reveal under claimed land

`presentation#1` · T0 Presentation · score 12 (core 4, fairness 5, play 3) · gap: neutral · D14: compliant

Each level hides an original 60x60 pixel-art picture. Every capture uncovers its part of the picture where the field used to turn flat blue. The rail stays a solid frame colour, so the player and minions remain easy to read. Clearing the level shows the whole picture, and a gold version goes into the gallery when the final capture overshoots to 90% or more.

**Rule sketch.** Changes only how R4.1-3 to R4.1-6 are drawn. Data: one picture P per level_id, a 60x60 map of 4-bit palette indices (1,800 B). It is drawn from an art sub-palette that excludes the reserved semantic colours: black (EMPTY), trail red, boss yellow, minion green and player white. Pictures are keyed by level_id on the client, so the level bytes do not change. Rendering runs after step 7 of each tick and only reads the grid. EMPTY is black. As an option ('restoration'), an EMPTY cell lights one pixel of P\[x,y\] at the cell centre (1/16 density). TRAIL is trail red. A CLAIMED cell that is a rail cell (R4.2-1, the core's Grid::is_rail) gets the solid frame colour. A CLAIMED cell that is not a rail cell shows P\[x,y\]. A capture can take an unchanged CLAIMED cell off the rail, but a cell can never come back onto the rail (R4.2-3). So on every tick where claim_bp rose, the client repaints the bounding rectangle of the changed cells grown by one cell. The browser draws P per cell. At the end of a Cleared level, the full P shows for 2 s before the summary. The gold frame and the gallery flag are set when claim_bp >= 9,000. Training saves them in localStorage; Challenge only shows them. All art is original and non-sexual (D13).

**Inspired by:** Super Qix (1987), Gals Panic (1990), ISOL8: Build & Isolate (2021), PIX (Sega Genesis / Mega Drive) (2026), Lightspace (2026), Reef Reveal (2026), Volfied (1989), Cacoma Knight in Bizyland (1992), Power Styx (1988). **Mechanic families:** [Hidden-picture reveal](../taxonomy/reveal-and-presentation.md#hidden-picture-reveal), [Code-generated art and audio](../taxonomy/reveal-and-presentation.md#code-generated-art-and-audio), [Progression-tied themes and palettes](../taxonomy/reveal-and-presentation.md#progression-tied-themes-and-palettes), [Bad-image swap](../taxonomy/reveal-and-presentation.md#bad-image-swap), [Clear reward showcase](../taxonomy/reveal-and-presentation.md#clear-reward-showcase), [Configurable colour scheme](../taxonomy/reveal-and-presentation.md#configurable-colour-scheme), [Player-chosen picture](../taxonomy/reveal-and-presentation.md#player-chosen-picture), [Restoration reveal (before/after)](../taxonomy/reveal-and-presentation.md#restoration-reveal-beforeafter), [Gallery and collection unlocks](../taxonomy/reveal-and-presentation.md#gallery-and-collection-unlocks), [Performance-gated bonus reward](../taxonomy/reveal-and-presentation.md#performance-gated-bonus-reward). **Touches:** presentation.

**Bot effect.** No effect on bots, D14 or calibration, since nothing enters consensus. Minions walk only the rail, which stays solid, and the trail and the boss sit on black, so readability holds. The one risk is a busy picture that tires the eye, so a 'dim art during play' option is advisable. The 90% gold tier rewards a big final overshoot, which the Challenge score (claim_bp x weight) already pays, so it trains the right habit. Overall the human-bot gap stays the same or narrows slightly.

**Budget.** zk: 0. Browser: trivial.

**Variety.** No new rules or decisions. Each level gets an identity and the campaign gets a reason to replay. The overshoot of the final capture, which Challenge already pays for, becomes visible as a reward.

**Merged from:** `reveal-and-presentation#4`. Variants:

- Code-drawn mosaic reveal: Each level hides a 60x60 mosaic generated in code from its level id. Every claimed cell shows its tile instead of flat blue, a clear sweeps in the rest of the picture, and running out of lives greys it out.

**Core engineer: feasible with changes, 4 of 5, tier 0.** The rail-repaint reasoning is right. The rail changes only on capture (R4.2-3), and a cell that leaves the rail had an open 8-neighbour that became CLAIMED, so it lies within one cell of a changed cell. The grown rectangle catches it. Grid::is_rail exists. Entities stay readable, since the boss is only on EMPTY and minions only on the rail.
Missing changes:
(1) At level start, the inner cells of thick obstacles are CLAIMED but not on the rail, so the rule as written shows the picture under obstacles before any capture. Flag obstacle cells and draw them in the frame colour.
(2) Gold at claim >= 9,000 makes every clear of maze, whose target is 9,000, a gold.
(3) README §4.1's 'Drawn as' column is tagged rule text (R4.1-3 to R4.1-6). Under CLAUDE.md, implementing an edit to §4 rule text counts as a behavior change, which would force a RULES_VERSION bump for a renderer change.

*Fixes.* Mark obstacle cells and draw them in the frame colour, so art shows only on captured non-rail cells. Set the gold tier relative to the target and the ceiling (for example target + 1,500, capped near the ceiling) instead of a flat 9,000. Move 'Drawn as' out of the tagged §4.1 rules, or mark it as the default presentation, before shipping art.

*Cost.* zk, formats and vectors: none.

*Conflicts.* R4.1-3 to R4.1-6 ('Drawn as' is tagged §4 rule text, so changing it is a behavior change under CLAUDE.md unless moved)

**Fairness: ok, 5 of 5; gap neutral; D14 compliant.** Client-only. Pictures are keyed by level_id and carry no seed information, so nothing about a run's boss is revealed, and bots never see them. The only fairness risk in paid mode is readability for humans: a busy picture, or the optional restoration pixels on EMPTY cells where the boss and the trail move. Either would widen the gap slightly. The solid rail and the excluded reserved colours mostly prevent it. The gold frame at 9,000 or more rewards the overshoot Challenge already pays for.

*Fixes.* In Challenge, default to dimmed art and keep restoration off.

**Play: ok, 3 of 5.** No new decisions, as the pitch says. The only nudge to play is the gold tier at a claim of 9,000 or more, which rewards a big crossing capture over a minimal clear: a real if cosmetic push toward greed in the commit loop. The value is identity and motivation: each level gets a face, and the reveal is the genre's classic hook. It is cheap and has no consensus impact, and the design for readability is careful: the rail keeps a solid frame colour, the boss and trail stay on black, and the semantic colours are reserved. The 'restoration' dots on EMPTY cells would put noise into the field where the trail and boss must be read. The medal-tiers idea overlaps this one and goes further.

*Fixes.* Drop the restoration dots on EMPTY. Draw the obstacles a level starts with in the frame colour, so walls never look like revealed art. Exclude the frame blue from the art palette, so the rail never blends into the picture. Set the gold threshold per level (for example target + 1,500, capped near the ceiling): on maze, whose target is 9,000, every clear would otherwise be gold.

*Readability.* Readable if the art keeps out black, frame blue, trail red, boss yellow, minion green and white/grey. The main risk is busy, high-contrast art around the rail, so prefer low-contrast, flat-shaded pictures.

## Shape-coded sprites, colour-blind palettes and level themes

`presentation#9` · T0 Presentation · score 12 (core 4, fairness 5, play 3) · gap: narrows · D14: compliant

Every entity can be told apart by shape as well as colour: hollow minions, a gridded boss, a ringed player and a solid trail. Each block of four levels gets its own palette and claimed-land texture, under a fixed contract that the trail is always the one hot colour.

**Rule sketch.** Per-state 4x4-px stamps: each cell state and theme has a colour A, a colour B and a 16-bit mask choosing between them per pixel, where today it has one colour. Contract: EMPTY is the darkest colour. TRAIL is solid and the only red. The boss is the only yellow, with a 1-px dark grid line every 2 cells so its size B (2-8, D9) can be counted, plus the eyes of the boss-tells idea. A minion is a hollow 4x4 green ring with a black centre. The rail is a solid frame colour, and the claimed interior has the theme's texture: checker, hatch or brick. Themes are keyed by level-number group (1-4, 5-8, 9-12, 13-16), and each takes its claimed and rail colours from the colours left after the reserved ones. Browser settings, stored per browser like the key bindings (D8): an Okabe-Ito palette (trail #D55E00, minion #009E73, boss #F0E442, claimed #0072B2), high contrast, and reduce motion.

**Inspired by:** Neon Divide (2026), Cobweb (1989), AQuix (1997), Lightspace (2026). **Mechanic families:** [Shape-coded enemies](../taxonomy/reveal-and-presentation.md#shape-coded-enemies), [Configurable colour scheme](../taxonomy/reveal-and-presentation.md#configurable-colour-scheme), [Progression-tied themes and palettes](../taxonomy/reveal-and-presentation.md#progression-tied-themes-and-palettes). **Touches:** presentation.

**Bot effect.** Narrows the gap for colour-blind players. Red trail against green minion is the classic deuteranopia pair. No effect on bots.

**Budget.** zk: 0.

**Variety.** Nothing mechanical. The 16 levels gain a visible arc, and the game becomes accessible.

**Core engineer: feasible with changes, 4 of 5, tier 0.** T0 is right. The rail-versus-interior texture has the same stale-repaint bug as any rail styling: after a capture, old rail cells become interior with no change in the diff. The browser boss is magenta (#ff3cf0), which the Okabe-Ito setting fixes. Feasible.

*Fixes.* Repaint the 8-neighbours of changed cells on capture ticks, so rail and interior textures stay correct.

*Cost.* Browser: settings stored per browser; zk 0; no format change

**Fairness: ok, 5 of 5; gap narrows; D14 compliant.** Pure presentation. Themes are keyed by level number, so every run of a slot looks the same and the draw gains no variance. The colour-blind palettes are opt-in and make paid play fairer: red trail against green minion is the classic deuteranopia pair. The browser boss is still magenta. Textures stay on the claimed interior and the rail stays solid. The budget is fine.

*Fixes.* - Keep the textures low-contrast, so the rail edge stays the strongest edge on the screen.
- Make yellow the browser's default boss colour.

**Play: ok, 3 of 5.** It adds no new decisions, but it makes the browser more readable. Shape coding (hollow minion ring, solid trail, gridded boss) separates red and green for deuteranopes, and the Okabe-Ito and high-contrast options are cheap accessibility wins in the browser, where the paid play happens. Level themes give Training a visible arc, but Challenge draws 6 of 16 levels, so the four-level grouping is mostly invisible there.

*Fixes.* Let the themes share one rail colour and vary only the claimed colour and its texture. Use textures with a 2-px or 4-px period, not 1-px checkers. Drop the boss grid lines if they cost anything: B is fixed per level, so counting it is a minor aid.

*Readability.* Improves it. A hollow 4x4 ring with a 2x2 black centre is distinct from the solid 4-px trail even in greyscale, and a solid frame-coloured rail keeps entities legible over any interior texture. The 1-px grid lines every 8 px on a body of up to 32 px are visible.

## Capture impact feedback

`presentation#3` · T0 Presentation · score 11 (core 4, fairness 4, play 3) · gap: narrows · D14: compliant

A capture ripples outward from the cell where the cut closed. A '+x.x%' number pops up at the region's centre and a chord sized to the capture plays. The capture that clears the level announces how far it overshot the target, because that overshoot is score.

**Rule sketch.** Detected after step 7 when claim_bp rose, meaning a capture happened at step 3 of this tick (R4.4-8). The captured set is the cells the dirty diff reports as turned CLAIMED this tick, the former TRAIL included. The closing cell is the player's cell. Browser: captured cells are ordered by 4-neighbour BFS distance from the closing cell, within the set, and drawn in 4 bands over the next 250 ms (about 4 ticks). Entities are always drawn on top at their true positions, so no state is hidden. A popup '+delta/100 %' appears at the set's centroid for 1 s. The chord's pitch is 220 Hz x 2^(floor(log2(size))/4). If the tick ends Cleared, the screen shows 'cleared at 83.1% (+8.1)' with the level score. Captures of at least 1,000 bp shake the canvas by 2 px for 150 ms, which a reduce-motion setting turns off. There is no hit-stop or slow-motion: the tick schedule is absolute and the core never pauses (D8's reason for having no pause key), so a frozen frame would show a stale state. Two captures can never fall on consecutive ticks, because a new cut needs one tick to enter EMPTY first.

**Inspired by:** Splix.io (c. 2016 (unconfirmed)), NEON PANIC: Neon Arcade (2026), Fill It! Arcade (2026), Xonix (KolibriOS) (2006). **Mechanic families:** [Impact juice for big moves and kills](../taxonomy/reveal-and-presentation.md#impact-juice-for-big-moves-and-kills), [Capture and level-transition animations](../taxonomy/reveal-and-presentation.md#capture-and-level-transition-animations), [Progress HUD](../taxonomy/reveal-and-presentation.md#progress-hud). **Touches:** presentation.

**Bot effect.** No effect on bots. Humans can read the size of each capture at a glance, which narrows the gap slightly.

**Budget.** Browser: one BFS over at most 3,364 cells per capture. zk: 0.

**Variety.** No new decisions. It makes big final captures feel like the score event they already are, which supports Commit-versus-push play.

**Core engineer: feasible with changes, 4 of 5, tier 0.** T0 is right. I checked the claim that two captures can never land on consecutive ticks. After a close at step 3 the player is not cutting. Fast cut (R4.5-6) applies only when cutting at the start of the tick, so on t+1 the player takes one sub-step and can at most enter EMPTY. The earliest next close is t+2. Two flaws. If the 4 BFS bands delay drawing cells as claimed, those cells look open for up to 4 ticks: stale state, contrary to the pitch's own principle. And a 2-px shake during live play moves the field half a cell. No bot effect, zk 0.

*Fixes.* In the browser, draw every captured cell in the claimed colour at once and animate only a highlight over it. Shake only on the clearing capture (the level is over), or keep shake behind reduce motion, off by default.

*Cost.* Browser: one BFS of at most 3,364 cells per capture plus WebAudio; zk 0; no format change

**Fairness: ok, 4 of 5; gap narrows; D14 compliant.** No consensus impact, and the claim that two captures cannot fall on consecutive ticks holds: a new cut starts with one sub-step and closes on a later tick. Concerns:

- The band reveal draws the captured cells over 250 ms (about 4 ticks). For those ticks the browser shows CLAIMED cells as open and the new rail edge late, a small information delay for humans in paid play.
- The 2-px shake moves 4-px cells by half a cell just after a big capture, when the player is planning the next move.
- The centroid of an L-shaped or ring-shaped capture can lie outside it, so the popup can sit over open field near the boss.

*Fixes.* - Draw the true state at once and animate a fading highlight over it, rather than delaying the reveal.
- Anchor the popup on the region's own cell nearest the centroid, or in the HUD, translucent and never over entities.
- Turn the shake off by default in Challenge, or limit it to 1 px.

**Play: ok, 3 of 5.** It adds no new decisions, but it makes an existing one legible. Score is claim, so a capture's size and the clear's overshoot are the score events, and a '+x.x %' popup plus 'cleared at 83.1 % (+8.1)' teaches that directly, which supports Commit-versus-push. The constraints are respected: there is no hit-stop because the tick schedule is absolute, entities are drawn on top, and the claim that two captures cannot fall on consecutive ticks checks out (a cut cannot start and close in one tick). The 2-px canvas shake moves the whole field just when the player is starting the next cut.

*Fixes.* Keep the shake for the clearing capture only, or drop it, rather than on every capture of 1,000 bp or more. Keep the popup over the captured land (the centroid already is).

*Readability.* Good.

## Generated sound with stereo minion cues and a danger drone

`presentation#10` · T0 Presentation · score 11 (core 4, fairness 4, play 3) · gap: narrows · D14: compliant

The browser game gets a synthesized soundtrack locked to the tick: minion footsteps panned by position, a drone that rises as the boss nears the trail, a ping on every seeded turn, and chords for captures.

**Rule sketch.** WebAudio, with no audio files. The sequencer advances one step per tick (15 Hz), so the audio stays in sync with movement by construction; the music runs at 112.5 BPM, 8 ticks per beat. Events come from snapshot diffs after step 7. A minion move (tick % period == 0) plays a click, panned by (x - 29.5) / 29.5, with pitch by y. A boss deflection (the boss-tells draw fired) plays a ping panned by the boss's x. A capture plays the chord of the capture-feedback idea. A hit plays a thud, a spent shield plays a glass ring, and the last life plays a low heartbeat every 15 ticks. The danger drone's gain and pitch follow the forecast's time-to-impact, or, without a forecast, the Chebyshev distance from the boss body to the nearest TRAIL cell.

**Inspired by:** VoidMania (2026), SPLARG LAND GRAB (c. 2026), Orbis: Bubble Fill Reflex Game (2026), Lightspace (2026). **Mechanic families:** [Danger-reactive music](../taxonomy/reveal-and-presentation.md#danger-reactive-music), [Code-generated art and audio](../taxonomy/reveal-and-presentation.md#code-generated-art-and-audio), [Beat-synced enemy movement](../taxonomy/field-enemies.md#beat-synced-enemy-movement), [Impact juice for big moves and kills](../taxonomy/reveal-and-presentation.md#impact-juice-for-big-moves-and-kills). **Touches:** presentation.

**Bot effect.** Narrows the gap. Stereo minion cues and the drone let a human track threats outside the eye's focus, which is a perceptual limit search does not have. No effect on bots.

**Budget.** Browser: a few oscillators, plus a Chebyshev distance over the trail each tick (at most about 300 cells). zk: 0. No asset files.

**Variety.** No rules change. Peripheral awareness changes how players handle levels with two or three minions.

**Core engineer: feasible with changes, 4 of 5, tier 0.** T0 is right. The BPM arithmetic checks: 15 ticks/s over 8 ticks per beat is 1.875 beats/s, 112.5 BPM. The deflection ping needs the deflection draw. A velocity diff cannot detect it, because a deflection into a blocked edge is undone on the same move (R4.6-10). And re-implementing fmix32(key XOR tick) in TypeScript would put a rule in the client, against README §3's single core. Expose it from wasm as a pure function, or depend on the boss-tells idea. With period-1 minions, a click per move is 15 clicks/s per minion, 45/s with three: noise unless throttled. Bluetooth output latency (100-200 ms) puts positional cues 2-3 ticks late. The drone's Chebyshev distance is O(trail) per tick, which is trivial. No bot effect, zk 0.

*Fixes.* Export the deflection draw from the wasm core instead of computing it in TypeScript. Throttle minion clicks (for example, one per minion per 4 ticks, or only within a radius of the player). Add an audio latency offset setting.

*Cost.* Browser: a few WebAudio oscillators, O(trail) per tick (at most about 300 cells), one wasm export; zk 0; no files, format or vector change

*Conflicts.* README 3 (the client must not re-implement R4.6-7)

**Fairness: ok, 4 of 5; gap narrows; D14 compliant.** Client-only, locked to the tick, with events taken from snapshot diffs. It reveals nothing hidden: the deflection ping fires on the move where the draw fired (the client already holds the key), after the fact, and the drone uses visible state. It narrows the perceptual gap for players who have sound; players without audio simply miss an optional cue of the official client. Concerns:

- Three period-1 minions click 45 times a second, which is noise, not a cue.
- Part of the drone depends on the forecast and boss-tells ideas; without them it falls back to the Chebyshev distance.

*Fixes.* - Rate-limit minion clicks, for example per minion every few ticks or only within a radius of the player.
- Never schedule a ping ahead of the tick it describes, unless boss tells are adopted deliberately as a separate decision.

**Play: ok, 3 of 5.** It adds no rule change, but it adds real perceptual channels for existing decisions in the browser. Panned minion steps and a drone that rises as the boss nears the trail let a player track threats outside the eye's focus, which matters on the 2-3-minion levels. It uses only information already on screen, so it is fair, it narrows the human-bot gap slightly, and it has no effect on bots. Music locked to a 15 Hz tick will stutter whenever the browser runs a late tick to catch up, as the absolute schedule allows.

*Fixes.* Schedule the audio events on the AudioContext clock from the tick's due time, not from the moment the tick happens to run. Make the drone and the music separate toggles.

*Readability.* Browser: purely audio, so no screen impact.

## Live capture preview

`presentation#6` · T0 Presentation · score 11 (core 4, fairness 4, play 3) · gap: narrows · D14: compliant

While cutting, the region the player would capture by going straight on to the edge is tinted, and the resulting claim is shown, marked 'clears' when it would end the level. The player sees which side the boss keeps, and what the cut pays, before closing it.

**Rule sketch.** Runs after step 7 while the player is cutting and the resolved direction d (R4.5-1) is not none. A ray is cast from the player's cell along d over EMPTY cells, up to the first cell that is not EMPTY. If that cell is CLAIMED and no ray cell touches the boss body, the client copies the grid, sets the ray cells to TRAIL and runs the core's own capture(grid_copy, boss.body(), scratch_stack), the R4.8-1 to R4.8-4 fill and pass. Then claim_after = claim_bp(captured + size, claimable). The browser tints the would-be-captured cells, draws the ray dotted and shows '-> 61.4%' or '-> 78.2% CLEARS'. If the ray meets TRAIL or the boss body, it shows 'no straight close'. The preview is recomputed whenever the trail, the direction or the grid changes. A differential test checks that walking the previewed ray with nothing in the way captures exactly the previewed count.

**Inspired by:** Paper-io (MakeCode Arcade) (2021), Pix Panic (2015 or earlier), Fill It! Arcade (2026), Qix (1981), Patchwork Heroes (2010), Quick Impulse Xpansion (2021), Gals Panic (1990), Gals Panic (Android) (2024 or earlier), LiM Grid Wars (2025), Fezball (2014), SPLITRON (2019), Antix (1985), Illgen (1989), qixxy (2016), firmament i-a (2001). **Mechanic families:** [Pointer-drawn trail (freehand or planned route)](../taxonomy/movement-and-drawing.md#pointer-drawn-trail-freehand-or-planned-route), [Home-territory loop capture (Paper.io model)](../taxonomy/movement-and-drawing.md#home-territory-loop-capture-paperio-model), [Area model and fill computation](../taxonomy/capture-rules.md#area-model-and-fill-computation), [Enemy-free regions are claimed](../taxonomy/capture-rules.md#enemy-free-regions-are-claimed), [Area-percentage clear threshold](../taxonomy/capture-rules.md#area-percentage-clear-threshold), [Silhouette target display](../taxonomy/reveal-and-presentation.md#silhouette-target-display), [Progress HUD](../taxonomy/reveal-and-presentation.md#progress-hud), [Aim preview, build on release](../taxonomy/controls-time-and-pacing.md#aim-preview-build-on-release). **Touches:** presentation.

**Bot effect.** Narrows the gap. It shows humans the evaluation that the search and greedy bots compute every tick: which side the boss keeps, and the overshoot that the score pays. Scripted bots and calibration are unaffected. It removes a whole class of human error, closing on the wrong side, that bots never make.

**Budget.** Browser: trivial. zk: 0.

**Variety.** Makes the pocketing decision explicit. Mid-cut, the player can probe each closing direction by turning, aim the last capture for the largest overshoot, and see before closing whether a cut would claim the large side or only a sliver.

**Merged from:** `movement-and-drawing#2`, `capture-rules#1`, `reveal-and-presentation#2`, `human-edge#2`. Variants:

- Closing-path and capture preview: While cutting, a dotted ghost shows the shortest way back to claimed land, and the region that closing along it would claim is tinted, with its claim in basis points. The player weighs closing now for that claim against extending the cut for more.
- Capture preview overlay: While you cut, the field tints the ground you would claim if you ran straight on to the rail, with the claim it would reach and a CLEAR tag. On the rail, a gauge shows how much open field the boss still has.
- Close-now capture preview: While you cut, the region you would win by closing straight ahead glows as a silhouette, labelled with the claim it would reach, so you see what a cut wins before you finish it.
- Pending-capture preview: While you cut, the field shows what closing right now would claim: the region it would take is shaded, with a readout such as '+612 cells -> 8,140 bp, clears'. Deciding to close, extend or commit becomes a matter of nerve and timing, not of counting cells by eye.

**Core engineer: feasible with changes, 4 of 5, tier 0.** capture() and claim_bp() are pub, and Grid is Clone. One claim fails. Correctness: closing takes at least ray/2 ticks, and the boss keeps moving meanwhile. It can cross the cells the ray has not laid yet and change which side it keeps, which is the very judgment the preview is meant to inform. So the preview is only right for an instant close. The proposed differential test passes only if the boss stays in its region.

*Fixes.* Preview the exact outcome of 'hold d (with A) from now'. Clone the Game (it is Clone: about 10.4 KB) and call Game::step with that mask until the cut closes, a hit lands or the level ends. Show the capture and claim, or 'hit at t'. This also covers minions, and it reuses the tick instead of a ray model. Also preview when the player is stopped mid-cut, using the previous direction.

*Cost.* Core: none. zk: 0 cycles. Formats: none. Browser: under 1 ms per recompute.

**Fairness: ok, 4 of 5; gap narrows; D14 compliant.** D14 is untouched. The client evaluates the current state with the core's own capture(), so there is no second fill implementation. The gap narrows: the preview removes the closing-on-the-wrong-side error that bots never make. Bots and calibration are unaffected. One fairness flaw: the fill starts from the boss body as it is now. A straight close can take up to about 29 ticks with A held (58 cells), and the boss keeps moving in that time. If the boss crosses the ray's line before the close, the real result is a hit or the other side. The preview is then wrong in exactly the tense moments when paid players rely on it. The help is uneven too: it is largest on obstacle levels (cross, maze, labyrinth, ring), where the boss's side is hard to read, so human relative difficulty drifts against the bot-derived weights.

*Fixes.* Before showing the preview, project the boss with copies of Boss::step over the ticks the ray takes: ceil(len/2) with A held. If the projected body meets a ray cell, show 'boss crosses' instead of a tint. Otherwise fill from the projected body at the closing tick. Pin the overlay per season.

**Play: ok, 3 of 5.** It makes two decisions explicit: which side the boss keeps (rarely in doubt on open levels, genuinely useful in maze, labyrinth and comb) and how much the last capture overshoots the target. The overshoot matters, because level_score pays claim_bp beyond the target. It reuses the core's capture, so the rule exists once. It adds no new situation, though: it mostly removes human counting error. Straight-ahead-only is a weak proxy, because real closes usually turn, so the preview often reads 'no straight close' exactly when the player wants an answer.

*Fixes.* Use the shortest closing path (the variant) or let the player probe each closing direction by turning, and label which one the preview assumes. In Challenge, show the bp and CLEARS readout. Recompute only when the trail, the direction or the grid changes, as planned.

*Readability.* Browser: good.

## Seed-keyed generated art with capture strata

`presentation#2` · T0 Presentation · score 11 (core 4, fairness 5, play 2) · gap: neutral · D14: compliant

Every run paints its field with a pattern generated from that run's level seed, and each capture is tinted as a new growth ring. The final field becomes a one-of-a-kind postcard of how the level was played, and anyone can regenerate it from the public journal.

**Rule sketch.** art_key is the big-endian u32 of the first 4 bytes of keccak256("jiro.art" || level seed). The client computes it once at level start with the core's keccak. The tag is client-only and outside section 6.4's consensus derivations, and it leaves the free seed material (byte 4 bits 2-7, bytes 9-31) untouched. style = art_key & 3 picks a pure per-cell function g(x,y) that returns an index into the theme's 6-colour ramp: 0 = diagonal tiles: 5x5-cell tiles, with orientation fmix32(art_key ^ (tx\*12+ty)) & 1, and a cell is lit when it lies on its tile's diagonal. 1 = four-fold quilt: u = min(x,59-x), v = min(y,59-y), index = (fmix32(art_key ^ (u\*64+v)) >> 29) mod 6. 2 = integer plasma: the sum of triangle waves of x, y and x+y, whose periods (8-23) and phases come from the bytes of art_key. 3 = Voronoi: 8 sites drawn from art_key, Manhattan distance, ties going to the lower index. Strata: on a tick whose claim_bp rose (a capture at step 3), the client increments the capture ordinal o. Each cell that turned CLAIMED that tick records o mod 4. A claimed cell is drawn as ramp\[(g+o) mod 6\], and a rail cell in the frame colour; the browser draws a darker 1-px seam where neighbouring ordinals differ. At the end of the level, the postcard is the final field plus the level name, claim and run id. The browser exports it as a PNG with a 'verify' link that replays the journal, which for Challenge is public in commitRun calldata (P5).

**Inspired by:** PIX (Sega Genesis / Mega Drive) (2026), Unveil (Qix-style picture reveal plugin) (2026), Styx (1983), Jezzball NES (2026). **Mechanic families:** [Code-generated art and audio](../taxonomy/reveal-and-presentation.md#code-generated-art-and-audio), [Colour-coded claims](../taxonomy/reveal-and-presentation.md#colour-coded-claims), [Replay-verifiable runs](../taxonomy/multiplayer-and-competition.md#replay-verifiable-runs), [Seeded deterministic play and replays](../taxonomy/modes-and-meta.md#seeded-deterministic-play-and-replays). **Touches:** presentation.

**Bot effect.** Neutral. The art carries no game information, because the key is hashed under its own tag, and bots never see it. It mirrors D14 in presentation: no two runs share a game, so no two runs share a postcard.

**Budget.** keccak runs once per level. zk: 0. Browser: trivial, plus PNG export.

**Variety.** Nothing mechanical. The capture order becomes readable as rings, which shows players their own cutting habits. Runs become shareable artefacts whose verification costs nothing but a replay.

**Core engineer: feasible with changes, 4 of 5, tier 0.** T0 is right: a client-only key under its own tag, outside §6.4's derivations. Rail cells in the frame colour go stale. After a capture, old rail cells become interior without a state change, so the dirty diff never reports them and they keep the frame colour. A 6-colour ramp must avoid red and green look-alikes, or the trail and minions lose contrast over patterned land. The Training verify link has to carry its journal (at most 8.1 KB), because only Challenge journals are onchain. No bot effect, zk 0.

*Fixes.* On capture ticks, repaint the 8-neighbours of the cells the diff reports, or draw rail and interior alike. Pick each theme's ramp from the colours not reserved, and keep the trail and minion colours out of it. Encode the Training journal in the postcard link.

*Cost.* 1 client keccak per level; zk 0; no format, rules or vector change

**Fairness: ok, 5 of 5; gap neutral; D14 compliant.** Client-only. art_key is hashed under its own tag, so it reveals nothing about the deflection key, and it leaves seed bytes 9-31 free for future consensus use. The art paints only the CLAIMED interior: the open field, the trail, the rail (in the frame colour) and the entities keep their colours, so readability barely changes. A different style on each run is only a cosmetic difference in the background, not a fairness issue in the draw. Postcards built from public Challenge journals are fine (P5).

*Fixes.* - Build the ramp only from colours no entity uses, and keep it low-contrast against the rail.
- Offer an off switch in the browser.

**Play: weak, 2 of 5.** It has no mechanical content, as the pitch says. The capture-order rings are a nice self-review aid, and the verifiable postcard is a good social artefact that fits D14, since no two runs share an image. During play, though, it adds visual noise to the claimed land, where the minions and the player live. Drawing rail cells in a frame colour helps, but only if the rail is repainted whenever a capture changes it.

*Fixes.* Keep claimed land flat during play and reveal the generated art and strata only on the end-of-level postcard screen, where they cost nothing in readability.

*Readability.* Risky in play. Multi-colour patterns at 4x4 px compete with the green minions and the white player on the claimed area. On a postcard screen after the level it is fine and attractive.
