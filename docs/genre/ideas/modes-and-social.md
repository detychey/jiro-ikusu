# Ideas: modes and social play

The 6 ideas proposed from the lens *modes and social play*: new ways to play the same core: ghosts, duels, daily levels, endless runs, level sharing, the deferred Superchallenge. Sorted by score. The [index](../IDEAS.md) lists every idea by tier and score, and [`README.md`](../README.md#the-taxonomy-and-the-ideas) explains the judges.

## Endless climb with carried lives

`modes-and-social#5` · T0 Presentation · score 13 (core 4, fairness 5, play 4) · gap: neutral · D14: compliant

Training only. An endless run of procedurally generated stages that get harder as you go, where the lives you have left carry into the next stage, each clear earns one back, and X cashes out the whole run.

**Rule sketch.** No change to the core. A gauntlet has a seed s, random or typed. Stage k ≥ 1 plays the level bytes g(s, k) from a generator in jiro-tools, built to wasm for the browser. The generator draws u = keccak256('jiro.gen' ‖ s ‖ u16 k ‖ u8 attempt). u picks an obstacle template (bars, comb, cross or central block, as in levels/src) with sizes and offsets from u's bytes, and the knobs follow a stage schedule: B from 4 to 8, boss period from 3 to 1, and minions from 0 to 3, by stage 12. After stage 12 the target rises by 250 bp per stage, up to 9,500. The core's validity check then runs (§5, codes 35-39); on a failure the attempt counter increases, so g is deterministic and a seed can be shared. Lives carry over: stage k+1's lives byte (offset 469) = the lives left at the end of stage k, plus 1 after a clear, capped at 9; stage 1 starts with 3. Stage k plays runNonce keccak256('jiro.gen.nonce' ‖ s ‖ u16 k), so a shared seed is a shared game. A stage must be cleared to advance. Running out of lives ends the gauntlet and scores that stage 0 (D5). X banks the stage's claim and ends the gauntlet. Score = Σ claim_bp over the stages played, and the best (seed, stage, score) is kept locally. The generator is not consensus: a generated level is only bytes and an id, so the same g can later serve as TODO.md's map generator.

**Inspired by:** Gravebloom (2026), PetsArtXoniX (2019), JezzBall (1992), Frenzy (1984), Domain Expansion (2026), Super Qix (1987), Jezzball Jam (2014), In My Imagination (2026): Endless Dreams with 3 shared lives, Glowfield Infinity: lives carry over between endless stages, Xonix-Game-Development-Project (2025-2026): continuous escalation, Domain Expansion (2026): a second loop with a higher capture target, Bix (2008): The Rift, an endless climb, Delta Light 2 (2025): Infinite Mode after the campaign, Hundreds (2013), RetroQix (2026), Bix (2008), Mamba (1991). **Mechanic families:** [Run-wide lives budget](../taxonomy/level-structure-and-progression.md#run-wide-lives-budget), [Difficulty ceiling and looping](../taxonomy/level-structure-and-progression.md#difficulty-ceiling-and-looping), [Per-level enemy ramp](../taxonomy/level-structure-and-progression.md#per-level-enemy-ramp), [Continues](../taxonomy/level-structure-and-progression.md#continues), [Level passwords and saved progress](../taxonomy/level-structure-and-progression.md#level-passwords-and-saved-progress), [Endless mode](../taxonomy/modes-and-meta.md#endless-mode), [Difficulty presets and hard modes](../taxonomy/modes-and-meta.md#difficulty-presets-and-hard-modes), [Arcade mode beside the campaign](../taxonomy/modes-and-meta.md#arcade-mode-beside-the-campaign), [Procedural and generated levels](../taxonomy/modes-and-meta.md#procedural-and-generated-levels), [Extra lives from progress](../taxonomy/scoring-and-risk.md#extra-lives-from-progress). **Touches:** level-data, presentation, tools-bots.

**Bot effect.** Training only, so the paid gap is unaffected. Generated levels never enter a season unless they are first fixed as level ids and calibrated like any other level. A bot would also run deep, but nothing is at stake.

**Budget.** Between stages only, never per tick: a few keccak calls and one validity flood fill of at most 3,364 cells per attempt. zk: none. Screen: a stage banner and a lives counter.

**Variety.** The 16 levels are known layouts with fresh lives on each. The gauntlet adds unseen layouts, so reading a board quickly becomes a skill. It also adds a run-level lives budget (spend a life on a greedy finisher now, or keep it for later stages) and a cash-out decision that the per-level X only hints at.

**Merged from:** `level-structure-and-progression#4`, `modes-and-meta#5`. Variants:

- Marathon climb: A Training climb through all 16 levels on one shared pool of lives, looping forever. Each loop tightens the bosses, the minions and the target until they hit their floors. Clearing a level gives a life back; committing keeps your points but costs one.
- Endless climb with bank or press: Climb through loops of six levels that get harder each loop. Your lives carry from level to level. After every clear you either bank your total and stop, or press on and risk losing half of it.

**Core engineer: feasible with changes, 4 of 5, tier 0.** This is client-only. Every stage is an ordinary v1 level that the unchanged core plays. Lives carry through the lives byte (always at least 1 after a clear, capped at 9). Training accepts any nonce (§6.3), and Training plays at levelIndex 0. No consensus, zk or paid effect.
Correction: the retry loop has no bound. Add a cap with an always-valid fallback, such as an open field.
A 9,500 bp target is below every ceiling (at least 9,642 for B8), so it stays reachable. The run-level lives budget and the cash-out choice are real additions.

*Fixes.* Cap attempts (for example 8) and fall back to an open field.

*Cost.* Formats, vectors and zk: none. Per stage: a keccak, stamping a 450 B bitmap and one start/validate. Per tick: 0. Screen: a stage banner and a lives counter.

**Fairness: ok, 5 of 5; gap neutral; D14 compliant.** Training only, with no change to the core. Shared seeds are allowed in Training (§6.3), and the gauntlet's 'jiro.gen' tags are separate from the Challenge derivations. Generated levels never enter a season unless they are first fixed as level ids and calibrated, so paid fairness and the gap are unaffected.

*Fixes.* If a generated level is ever promoted to a season, put it through the library filters of [level-structure-and-progression#5](level-structure-and-progression.md#season-levels-drawn-from-a-calibrated-library) (tightened coverage, solvability) and normal calibration.

**Play: strong, 4 of 5.** It adds a run-level lives budget (spend a life on a greedy finisher now, or keep it for later stages) and turns X from a per-level bank into a cash-out for the whole run, while D5 still zeroes the stage you die on. Unseen layouts make reading a board a skill. Shared seeds give friends an asynchronous race with no paid exposure. There is no core change, because stages are plain v1 bytes with the lives byte rewritten, and the gap is irrelevant because nothing is paid. Risks: a lives cap of 9 with +1 per clear could make the middle stages trivial for good players, and a generator built only from the four existing templates will repeat itself.

*Fixes.* Make the life refund depend on the stage (for example +1 only every second stage after stage 6), or cap lives at 5, so the budget stays tight. Use the motif grammar of the level-library idea, so stages show islands and doors as well as the four current templates. Keep the generator out of the core.

*Readability.* Good. It uses the existing cell rendering. Generated boards need the same width limits as the authored ones.

## Replay take-over practice

`modes-and-social#1` · T0 Presentation · score 12 (core 4, fairness 4, play 4) · gap: narrows · D14: compliant

Training only. You replay any journal, whether your own, a friend's or a committed Challenge run, on exactly the same game. Its marker and trail run beside you as a ghost with a live claim split, and at any tick you can press Take over and play on from that position.

**Rule sketch.** No change to the core or the journal. Input: a journal J and its level bytes L. J can come from a file, from a link (see the duel-link idea) or from a committed Challenge run, which replay.html already reads from the commitRun calldata (P5). replay.html passes L, runNonce, levelIndex and J to the Training page as hex in the URL fragment, so Training stays wallet-free and network-free, which web/README's import test requires. The live session writes a mode-0 header with J's runNonce and levelIndex. The level seed keccak256('jiro.level' ‖ runNonce ‖ levelIndex) is therefore J's, and so are the boss start, the direction and the deflection key (seed bytes 5-8). Ghost: a second core instance replays J, one tick after each live tick's step 7. The client outlines the ghost's player cell and its TRAIL cells, and the HUD shows the split, live captured cells minus ghost captured cells, read from the state field 'captured cells'. The ghost's boss is not drawn. A deflection draw depends only on the key and the tick (R4.6-11), so the two bosses coincide until the first capture that changes a cell one of them tests, and then they part. Take-over, at a tick t before J's ending tick: the client keeps J's events with tick \< t, fast-forwards the core through tick t-1, then appends live events from tick t on, recording an event only when the mask changes (§6.2). The result is an ordinary v1 Training journal of the same game.

**Inspired by:** Unveil (2026): scripted input for tutorials and replays, Ink Fill (2026): stages verified by replay, DroneXtreme: Territory Capture (2026): practice with no timer and no rivals, Pauper.Io! (2026): practice results do not count, Cellonix (2019): level restart, Xobox (2006): save and resume, Boundarpy (c. 2019), Glowfield (2026), Demon Wreath (2025), YOUR GAME (2023), Stix (1983), Jezzball NES (2026), Gal Pani X (2002 (demo 2000)), Kunitori Returns with Senran Kagura NewWave (2014), Glimmer: Capture the Light (2026), Smokescreen (2025). **Mechanic families:** [Seeded deterministic play and replays](../taxonomy/modes-and-meta.md#seeded-deterministic-play-and-replays), [Practice and tutorial modes](../taxonomy/modes-and-meta.md#practice-and-tutorial-modes), [Save and resume](../taxonomy/modes-and-meta.md#save-and-resume), [Pause](../taxonomy/controls-time-and-pacing.md#pause), [Instant restart](../taxonomy/controls-time-and-pacing.md#instant-restart), [Turn-based ticks](../taxonomy/controls-time-and-pacing.md#turn-based-ticks), [Adjustable game speed](../taxonomy/controls-time-and-pacing.md#adjustable-game-speed), [Deterministic fixed-tick simulation](../taxonomy/controls-time-and-pacing.md#deterministic-fixed-tick-simulation), [Ghost racing and recorded replays](../taxonomy/multiplayer-and-competition.md#ghost-racing-and-recorded-replays), [Checkpoints and soft failure](../taxonomy/level-structure-and-progression.md#checkpoints-and-soft-failure). **Touches:** presentation, input.

**Decisions it reopens:** D8.

**Bot effect.** Training only, so D14 and the paid gap are untouched. It narrows the gap a little on the human side. Public Challenge journals include near-ceiling play on real seeds, and ghosting those journals shows humans lines they would not find alone. In a live run it adds no new exploit. A player could already open Training on the revealed nonce to rehearse later levels within the deadline padding, a residual README §7.2 accepts. Take-over only makes that rehearsal faster, and it helps humans more than bots, which need no rehearsal.

**Budget.** Browser: a second core instance, about 19 KB of wasm memory (grid 3,600 B, capture stack 6,728 B, journal 8,100 B, state). It doubles the core work per tick, which takes microseconds in wasm. zk: none. Screen: the ghost marker and trail outline change a handful of cells per tick and need one extra palette entry.

**Variety.** The 16 levels offer no comparison against a known line, and no way to drill a late-game position without replaying the first two minutes. With this, a player can race a split on the identical boss path, rehearse a 3-minion endgame directly, and study where a top run set up its finishing cut.

**Merged from:** `modes-and-meta#2`, `controls-time-and-pacing#9`. Variants:

- Takeover drills and rewind: Load any replay, your own or a public Challenge run, scrub to a moment, and take over the controls in exactly the same game. In Training you can also rewind three seconds and retry a cut.
- Study mode: pause, step, slow and rewind in Training: In Training you can pause, step tick by tick, play at half speed, rewind a few seconds and retry, or load any public run, scrub to a moment and take over from there to practise exactly that situation.

**Core engineer: feasible with changes, 4 of 5, tier 0.** This is T0 in the browser. The take-over needs no journal splicing: feed J's masks through the existing wasm tick() (Recorder) for ticks 0..t-1 and the Recorder journals exactly J's events with tick \< t, because every event changes the mask. Then play goes on live. The result is an ordinary v1 journal.

Small gaps:

- The Training page has nonce and hex parameters but no levelIndex. start(mode, levelIndex) already accepts 0-5, so add the parameter.
- replay.ts restarts the core with outcome.mode, which is 1 for a Challenge run. Take-over must force mode 0.
- jiro-wasm is a single static Engine (an 86 KB trace buffer, a 16 KB input buffer and the rest), so the ghost is a second WebAssembly instance, roughly 0.1-0.2 MB rather than 19 KB. That is irrelevant in a browser.
- The divergence claim is too narrow. TRAIL blocks the boss in R4.6-3, so the two bosses part at the first edge test that meets a trail present in only one game, not only after a capture.

Residual risk: the mode byte does not enter the level seed. So the shipped take-over and rewind make the revealed Challenge nonce easy to save-scum in Training, and a header edit plus a hand-made commitRun would submit the result. This is the README §7.2 rehearsal residual made easier for humans. Bots gain nothing from it. Training only, so D8 is not really in tension.

*Fixes.* - Training page: add a levelIndex parameter (fragment) and always start in mode 0.
- Browser ghost: a second wasm instance.
- Note the save-scum residual in the docs/ECONOMY.md threat table.

*Cost.* - Consensus: none. No core, format, vector or hash change, and zk cycles +0.
- Browser: one extra wasm instance (about 0.1-0.2 MB) and one extra step per tick (microseconds).

*Conflicts.* D8 (Training only, so no real conflict); README §7.2 rehearsal residual

**Fairness: concerns, 4 of 5; gap narrows; D14 compliant.** The paid core, the journal and D14 are untouched. A take-over journal plays the game of its own run nonce and never another run's. Two things the pitch understates. (1) The Training page already accepts a `nonce` query parameter (web/README). The level seed is keccak('jiro.level' ‖ runNonce ‖ levelIndex), with no mode in it, so a Training game on a revealed Challenge nonce is the same game as the paid level. Today that allows whole-attempt rehearsal inside the deadline padding, the residual §7.2 accepts. Take-over, and even more the rewind variant, turns it into save-state splicing: the client writes one valid journal made of the best segments of several tries. Changing its mode byte from 0 to 1 and committing it by hand gives a tool-assisted paid level. The time comes from the padding: pad each level toward 2,700 ticks, about 9 minutes per run, plus commitSlack. The pitch calls this faster rehearsal, but it is a lower-skill assist than the open-source search bot, and it lets semi-technical humans pull ahead of honest humans. Bots gain nothing they lack today. (2) It narrows the human-bot gap a little: ghosting near-ceiling public journals on their real seeds teaches lines that carry over as technique, but not as copied inputs, because D14 still makes each paid game unique. Bots need no calibration for it, and it adds no variance to the draw. Its D8 conflict applies only in Training.

*Fixes.* Generate take-over and rewind links only from replay.html for runs whose commitRun is already onchain, and do not link the live Challenge page to Training on its own revealed nonce. Add 'segment splicing on a revealed, uncommitted nonce within deadline padding' to the threat table in docs/ECONOMY.md as an accepted residual, with fresh entropy per level (§7.4) as the real fix.

**Play: strong, 4 of 5.** It changes no rule. What it adds is new starting positions: start from tick 1,800 of a top Challenge run on the same seed and try to beat it, or rehearse a 3-minion endgame without replaying the first two minutes. The ghost split changes how much risk a player takes mid-level: push when behind, commit when ahead. None of the 16 levels offers anything like this, and it doesn't clash with D8, because pausing, stepping and rewinding are Training-only. It is correct that the two bosses coincide until a capture changes a tested cell, since deflection draws depend only on the key and the tick (R4.6-11). The pitch already admits the rehearsal residual of README §7.2. One cost is understated: taking over mid-cut drops the player into a moving position with no time to read it. This idea, the daily seed and the duel each define their own ghost and link format.

*Fixes.* Build one ghost renderer and one link format, and share them with the daily-seed and duel ideas. Before control returns on take-over, freeze for a 1 s countdown (Training only, so D8 is unaffected), and snap the default take-over tick to the nearest tick where the player is on the rail.

*Readability.* Browser: fine. A ghost trail outline (1-px border, 2×2 hole) reads in the browser only if it is drawn over EMPTY cells only.

## Duel on identical seeded games

`modes-and-social#2` · T0 Presentation · score 11 (core 4, fairness 4, play 3) · gap: neutral · D14: compliant

Training only. You send a friend a link or an 8-character code, and both of you play the exact same seeded games, best of up to six rounds. In the sealed variant your journals stay hidden behind a hash until both sides have played, so neither can copy the other.

**Rule sketch.** No server and no change to the core. A duel link is base64url in the URL fragment. It carries a 40-bit duel code c, a round count n of at most 6, optionally the level bytes of an editor level, and the sender's name. It also carries either the sender's journals (open duel) or keccak256 of each journal (sealed duel). runNonce = keccak256('jiro.duel' ‖ c), computed through the core's keccak. Round k plays levelIndex k on draw slot deck\[k\] of the §8.2 draw of that nonce, or on the editor level. A duel is therefore a mode-0 run with the shape of a Challenge run, and both sides play identical games. Scoring: the receiver's client replays both sides to Outcomes, at the calibration weight for shipped levels or 10,000 for editor levels. In the sealed variant this happens once the reply link returns the sender's journals and they match their hashes. Each round goes to the higher level score, with D5's zero applied, and ties go to fewer ticks, the order D10 uses. The reply link carries both sides' journals, so a rematch can chain from it.

**Inspired by:** Retrocade (2026), Glimmer: Capture the Light (2026), Qix (Game Boy) (1990), Bix (2008), Jezzball NES (2026), Oh Mummy (1983), Qix (1981), Shocker (1988), Trappy Pixel (2023), Penky (1996), Harem Challenge (1995). **Mechanic families:** [Friend challenges](../taxonomy/multiplayer-and-competition.md#friend-challenges), [Split-field race to quota](../taxonomy/multiplayer-and-competition.md#split-field-race-to-quota), [Replay-verifiable runs](../taxonomy/multiplayer-and-competition.md#replay-verifiable-runs), [Level editor and user levels](../taxonomy/modes-and-meta.md#level-editor-and-user-levels), [Alternating-turn local multiplayer](../taxonomy/multiplayer-and-competition.md#alternating-turn-local-multiplayer). **Touches:** presentation.

**Bot effect.** No money is involved, so neither D14 nor the paid gap changes. A friend who runs a search bot wins every duel; the sealed variant stops copying, not bots. I recommend against a paid version of this duel. With a shared seed, a journal published at commit can be copied, which is why D14 exists. With per-run seeds, the search bot won 200 of 200 paired runs against the mix in reports/bot-advantage.md, so a staked head-to-head would pay bots almost every time. It would also be a peer-to-peer wager, which carries legal risk. This idea is the Training version only.

**Budget.** Client only. A link is a few hundred bytes for a typical journal and at most about 11 KB of base64 for a worst-case 8,171-byte journal. Each duel costs one keccak plus a replay of the opponent's journal, at most 2,700 ticks per round. zk: none. Screen: a side-by-side result view in the browser.

**Variety.** A friend's score comparison on the 16 levels mixes skill with seed luck. On an identical game, the only difference is play. The sealed variant adds a no-peeking asynchronous race, and rematch chains give short best-of-six sessions in the same shape as a paid run.

**Merged from:** `multiplayer-and-competition#3`. Variants:

- Pass-and-play level duel: Two players share one keyboard and take turns on the same six levels with the same seeds. After each level both claims are shown side by side, so the second player always knows the number to beat.

**Core engineer: feasible with changes, 4 of 5, tier 0.** The mechanics hold, all client-side:

- runNonce comes from the wasm journal_hash (a keccak of arbitrary bytes), and round k plays draw(nonce)\[k\] at levelIndex k.
- Scoring is a wasm replay with the calibration weight.
- A 40-bit code is exactly 8 base32 characters.

What the pitch overstates:

1. Play is asynchronous with unlimited retries. Both sides can grind each round in Training before answering, and the sender can grind codes c offline for a kind draw and boss starts before sending. The game is identical, but effort differs as well as skill.
2. In the open variant the receiver can ghost the sender's journals, which is idea #1, and copy the lines. Only the sealed variant is a duel.
3. The link budget is per journal. A reply carrying both sides' 12 journals is up to about 131 KB of base64 in the worst case, and 10-20 KB typically. Many messengers truncate long URLs.

The recommendation against a paid duel is correct. With a shared game and per-pair seeds, search wins, as reports/bot-advantage.md shows, and it would be a peer-to-peer wager.

*Fixes.* - Let the receiver contribute half of the seed: nonce = keccak256('jiro.duel' ‖ c_sender ‖ c_receiver). This takes one extra message before play, and neither side can grind the game alone.
- Show an attempt counter or a 'first attempt' flag per round (honour system, as in the daily).
- Compress the link payload with CompressionStream (deflate), and fall back to a journal file above a few KB.

*Cost.* - Consensus: none (zk +0; no format, vector or core change).
- Client: a few keccaks and at most 12 replays of up to 2,700 ticks per duel.
- Links: a few KB typical, up to about 131 KB uncompressed for a full reply.

**Fairness: ok, 4 of 5; gap neutral; D14 compliant.** No money is involved, so D14 and the paid gap are unchanged. The core runs it as a mode-0 run with the shape of a Challenge run, and the domain tag 'jiro.duel' keeps its nonces apart from paid ones. The recommendation against a staked version is right: search won 200 of 200 paired runs against the mix, and a peer wager carries legal risk. The fairness problems are within the duel. (a) The sender alone picks the 40-bit code c, so they can try codes offline until the draw and the boss starts suit them. (b) With no server and no clock, both sides can replay the identical game as often as they like before sending. A fixed game rewards memorising it, so the sealed variant stops copying but not retries, and a duel measures persistence as much as skill. (c) In the open variant the receiver can copy or ghost the sender's journal on the same game. Bots need no calibration for it, and it adds no variance to the paid draw.

*Fixes.* Derive the nonce from both sides' contributions, for example keccak('jiro.duel' ‖ c_sender ‖ c_receiver), with the sender's code committed by hash first. The sealed variant's reply link already makes room for that. Have the client count attempts and show them in the result, on the honour system. Label the open variant 'beat this score', not a fair duel.

**Play: ok, 3 of 5.** Playing identical games takes seed luck out of a friendly comparison, and best-of-six mirrors the shape of a paid run. The one new in-game decision is the 'number to beat'. When you know the opponent's claim on a round, the D5 zero makes risk lopsided: you commit just above their claim rather than push. The sealed variant removes even that decision, which leaves only a score comparison that the daily seed already gives. The open variant is broken as competition: with the sender's journal in hand, the receiver replays it to a tie, takes over near the end and adds one more cut. Duel take-over makes that trivial. The sealed flow needs three link trips before the receiver sees a result, which adds friction. Looking up the calibration weight is redundant, because both sides play the same level each round, so the weight cancels out. Comparing effective claim (D5 zero), then ticks, gives the same order. The pass-and-play variant is the couch-friendly case. Recommending against a paid duel is correct.

*Fixes.* Use one mode instead of open and sealed. The first link carries each round's Outcome (effective claim and ticks) together with the journal's hash, so the receiver knows the number to beat but cannot copy the line. Journals go out only in the reply, and the sender's client checks them against the hashes. Drop the weight lookup and rank each round on effective claim, then ticks. Build on the daily idea's link format and the replay idea's ghost instead of a third encoding.

*Readability.* Play doesn't change. The browser result view is easy.

## Hot-seat turn duel on one field (Training)

`modes-and-social#6` · T0 Presentation · score 10 (core 3, fairness 4, play 3) · gap: neutral · D14: compliant

Training only. Two players share a keyboard and take turns cutting on one shared field and one shared pool of lives. Each capture scores for whoever closed it, the next player starts wherever you left the marker, and losing the last life on your turn scores you zero.

**Rule sketch.** The core, the journal and the rules are unchanged; a turn layer lives in the client. The client tracks the turn owner, p1 or p2, and builds each tick's mask from that player's controls only, using two key bindings in the browser. A turn ends after a tick on which the captured-cells field rises (a capture at step 3) or the lives field falls (step 6). The client then stops its 15 Hz clock until the next player presses A. No ticks pass in the pause, so the journal is untouched, and a client-side pause in Training is outside D8's paid-mode concern. The next player starts wherever the marker stands: where the last cut closed, or at its cut start after a hit. Scoring, done in the client: each capture's cells go to the player who made it, in bp of the claimable cells. The player on whose turn the last life is lost scores 0 (D5 applied per player). The turn owner may press X to end the game. A clear ends it too, and the clearing capture counts for its maker. Turn boundaries are capture and life-loss ticks, so the replay viewer can rebuild the duel's split from the journal alone. In the browser, a reference bot (greedy or bold) can take a seat by producing the masks for its turns.

**Inspired by:** Qix (1981), Night Flight (1982), Clubhouse Games: 51 Worldwide Classics (Dots and Boxes) (2020), Tetro Domain (2026), Jintori game (Matsuo & Takagi) (1990). **Mechanic families:** [Alternating-turn local multiplayer](../taxonomy/multiplayer-and-competition.md#alternating-turn-local-multiplayer), [Turn-based territory duel](../taxonomy/multiplayer-and-competition.md#turn-based-territory-duel), [Computer rival claimers](../taxonomy/multiplayer-and-competition.md#computer-rival-claimers). **Touches:** presentation.

**Bot effect.** Training only, with no effect on D14 or the paid gap. The scripted bots get a second use as couch opponents.

**Budget.** Client only: a turn-owner byte, two u16 scores and a clock pause. zk: none. Screen: a turn indicator and two scores in the HUD.

**Variety.** Every current level is solitaire. The duel adds positional play against a person: where to end your cut so the opponent starts in a bad spot, whether to leave the boss's region next to their rail, when the leader should press X to lock in a win, and how much risk to take while the shared last lives pass back and forth.

**Core engineer: feasible with changes, 3 of 5, tier 0.** T0 for cost: client-only and Training-only. Stopping the 15 Hz clock between turns adds no ticks and no events, because events are tick-stamped, so the journal and determinism are untouched, and D8's paid-mode concern does not apply. claim_bp rises on every capture (each claimed cell is about 2.97 bp), so turn boundaries can be found from status and rebuilt from the journal. The scoring rule as written collapses, though. The turn owner may press X to end the game, so pressing X at the start of any turn you lead always wins. Every capture passes the turn, so the opponent gets exactly one capture to overtake. A player whose capture leads by more than the cells left in the field (for example, a first cut of more than half the claimable cells) has won, because the opponent cannot catch up in one capture before the leader presses X. The game becomes 'make the first big cut', and the positional play the pitch promises mostly disappears. Separately, on minion-free levels a player on the rail is never hit and can stall the clock. A bot seat in the browser needs the scripted bots, which live in jiro-tools (native, with file I/O), built for wasm: moderate work, nothing consensus.

*Fixes.* Remove X as a way to end the game (or let only the trailing player concede). End on clear, out of lives or time limit, with cumulative scores, so the lead can change over several turns. Add a client-side shot clock (for example, the turn passes after 150 ticks without a capture). Split the bot policies into a crate that builds for wasm, for the bot seat.

*Cost.* Client only: 1 B turn owner, 2 x u16 scores, a clock pause, HUD; no core state, zk 0, no format or vector change; a wasm build of the bot module for the bot seat

**Fairness: ok, 4 of 5; gap neutral; D14 compliant.** Training-only and client-only. No ticks pass during the pause, so journals stay valid, and there is no paid-mode effect; D14 does not apply. Design gaps:

- There is no turn timer. With no fuse (D4), the turn owner can keep the turn by never closing a cut or never cutting, so a leader can run out the clock on their own turn.
- When a capture and a hit fall on the same tick, the rule should state who owns them (the capturer, since both happen on their turn).
- The clock-stop path must be unreachable in Challenge, where an honest client must not offer free thinking time (D8).
- Duel journals must carry the Training mode, so that they can never settle.

Reference bots can take a seat because they only produce masks.

*Fixes.* - Add a turn budget in ticks, for example: the turn passes at the first tick the marker is on the rail after 300 ticks. It can be derived from the journal, so replays still rebuild the split.
- Gate the pause on the client's mode, so it only exists in Training.
- Document who owns a capture and a hit that fall on the same tick.

**Play: ok, 3 of 5.** A couch duel is genuinely new: every current level is solitaire, it reuses the scripted bots as opponents, and it costs nothing in the core. As sketched, though, its scoring collapses into a first-mover win. A turn ends at the first capture, and a leader may press X at the start of their own turn. So on 01-open, P1 cuts once straight across the field for about 50 % (5,000 bp). P2 then cannot exceed that before the 7,500 bp clear ends the level, and if P2 fails to take the lead, P1 presses X. Optimal play is one huge opening cut, and the positional ideas in the pitch (where to leave the marker, the boss's region next to the opponent's rail) barely matter. Walking the rail is also free, so the marker's position matters little apart from minion exposure. The shared last life and 'X when leading' are good tension, but only once captures are bounded.

*Fixes.* Bound each turn's gain with a per-turn capture cap (for example 15 % of the field) or a pie rule, where after P1's first capture P2 may take that capture and the seat. Allow X only after both players have had N turns, or only when the lead exceeds what the remaining open field could overturn. Add a per-turn tick budget so the leader cannot stall the shared clock. Tint each player's captured cells so the split shows on the board.

*Readability.* Fine on the field itself. Owner tints need two distinct claimed colours.

## Community map slots in the season, a reworked Superchallenge (paid)

`modes-and-social#9` · T5 Mode, scoring or contracts · score 9 (core 3, fairness 3, play 3) · gap: narrows · D14: compliant

Paid mode. Players mint maps, and each season fills a few of its 16 slots with community maps that passed a public, bot-run quality check. Minters earn a royalty from the rake when their map is chosen; there are no per-map pots and no player-against-minter stakes.

**Rule sketch.** Mint: a map registry, or ethblockdigger's MapNFT, with mint(bytes level) payable at 0.0005 ETH, storing level_id = keccak256(level) and the minter. The bytes travel in the calldata, so they are public. Candidates: maps minted before season s's cutoff compete for season s+1. Curation is deterministic, offchain and reproducible by anyone with jiro-tools, in four checks: (1) validity, codes 20-39; (2) the reference mix's clear rate within 10-95% and its median effective claim above the P11 floor; (3) a gap rule: search over the mix on the map no higher than the median of that ratio over the built-in levels, from a short search run of 50 seeds; (4) proving cycles of the heaviest calibration journal no higher than the current maximum, and an obstacle bitmap differing from every existing level in at least 100 cells. Selection: k = 4 slots are drawn from the eligible maps with keccak256('jiro.slots' ‖ h ‖ u8 i) over a pre-announced entropy block h, at most one map per minter address. Season changes: levelIds keep their type. New parameters royaltyBp, at most rakeBp, and slotMinter\[16\], address(0) for built-in slots, are committed at open. At close, fees × royaltyBp / 10,000 is taken out of the rake and split equally among the community slots' minters through claimRoyalty(s, slot). The players' pot is untouched. Runs are ordinary mode-1 Challenge runs with per-run seeds and calibrated weights, and journal mode 2 stays reserved.

**Inspired by:** Delta Light (2020), Lightspace (2026), Painter (1993), Ink Fill (2026), Ballistyx (1990s). **Mechanic families:** [Level editor and user levels](../taxonomy/modes-and-meta.md#level-editor-and-user-levels), [Offline-generated, simulation-verified stages](../taxonomy/level-structure-and-progression.md#offline-generated-simulation-verified-stages), [Time-boxed ranked competitions](../taxonomy/multiplayer-and-competition.md#time-boxed-ranked-competitions). **Touches:** level-data, contracts, economy, tools-bots, presentation.

**Decisions it reopens:** D11; D12; §8.3; §8.4.

**Bot effect.** On each map the gap stays as it is: no layout pushes search far below the ceiling, and D14 still holds with per-run seeds. The gap rule removes maps where search's advantage over the mix is above the built-in median, so on average the gap narrows slightly. It also gives minters a reason to design layouts that are friendly to humans, which aligns with the main product risk. TODO.md's problems are addressed as follows. (1) The minter's edge is only earlier practice, since all 16 layouts are public at open. (2) The royalty comes from being drawn, not from players failing. (3) There is no pot to split. (4) Journals are bound to their run nonce, as in Challenge. (5) There are no runs priced below gas. (6) The bots prove the map can be cleared. (7) There is no per-map wager, though the royalties still need a legal read.

**Budget.** Onchain: a mint costs on the order of 50-70k gas plus 472 B of calldata; Season.open adds 16 minter slots, a few hundred thousand gas once per season; one royalty credit at close; one claim per minter. Offchain per candidate: a playtest, a 50-seed search run and a zk executor cycle check. Per run, the proving cost is unchanged under the cycle cap. Screen: a browser for the minted maps.

**Variety.** Every season brings four layouts that nobody on the team drew, and players read new boards each season. Designing a map inside the calibration band becomes its own competition, and the deferred mode returns without its honeypot.

**Core engineer: feasible with changes, 3 of 5, tier 5.** This needs no core change. Levels stay level bytes v1, journals stay mode 1, RULES_VERSION stays at 2, and the per-run proving cost is bounded by check (4). That is its main strength. The weak points are in curation, legality and Sybils.

(a) The selection as written is a lottery. A minter pays 0.0005 ETH, a keccak draw picks the winners, and the winners receive a cash royalty taken from player fees. Consideration, chance and a prize make a lottery in most jurisdictions. That is a sharper legal problem than 'royalties need a legal read', and it reproduces TODO.md problem 7 on the minter side.

(b) 'At most one map per minter address' does nothing, because wallets are free. Rule (4) only measures distance from existing levels, so one person can mint 50 near-clones from 50 addresses and multiply their odds.

(c) Curation seeds that are fixed and reproducible before the cutoff let minters overfit layouts to the 50 published search seeds and the playtest seeds.

(d) The gap rule is an easiness filter. Search reaches about 0.985 of the ceiling on every built-in level, so search/mix is roughly ceiling/mix_claim. Over the 16 levels that ratio runs from 1.28 (open) to 4.10 (doom), with a median of about 1.57 (reports/bot-advantage.md). Passing therefore means a mix mean effective claim of about 6,200 bp or more: the easy half (01-08). The 10-95% clear-rate band is then moot, and every community slot lands at the easy end. The rule still has value: it caps the weight-exploit map, a layout the scripted mix scores badly on (high weight) but a known trick clears, because search would find the trick and fail the check. The docs should present it as that cap, not as 'human-friendly'.

(e) Operations. Season is not upgradeable, so this needs a new Season generation and a Challenge rebind. targets.json holds per-slot target clear rates that community slots cannot meet, and P10 says every level has a levels/src source. ethblockdigger's MapNFT tokenURI renderer is Stylus, which is paused, so use a plain registry. The mint-fee destination is unspecified. Royalties come out of a rake (at most 20%) that already has to fund operator proving at about 69% of one run fee per verified best run.

The runtime constraints are untouched: determinism, RAM, tick time and the state hash.

*Fixes.* 1. Remove the lottery: either remove the paid entry or remove the chance.
- Paid entry out: make registration gas-only, or a refundable anti-spam bond returned after curation whatever the result. The keccak draw can then stay.
- Chance out: select deterministically, ranking eligible maps by distance to a published target band, ties to the earliest mint.

2. Replace the per-address cap with an obstacle-bitmap distance rule (at least 100 cells) applied pairwise across the candidates and the selected slots, and dedupe before the draw.

3. Derive every curation seed (mix playtest, the 50 search seeds, the calibration journals for the cycle check) from the post-cutoff entropy block h, so a layout cannot be tuned to known seeds.

4. Document the gap rule as the weight-exploit cap, and either accept that community maps will be easy-half or drop the 10-95% band in favour of the gap rule plus the P11 floor.

5. Add a community-slot entry to targets.json, which today only gives each slot a target rate with a tolerance, and generate levels/src sources for selected maps (P10).

6. Ship a new Season generation with royaltyBp at most rakeBp, slotMinter\[16\], pull-based claimRoyalty, and royalties owed added to the solvency invariant. Use a plain map registry instead of the Stylus-rendered MapNFT.

7. Send the mint fee or bond to the treasury, never to the players' pot.

8. Update docs/ECONOMY.md to show royalty against proving funding.

9. Get a legal read before mainnet.

*Cost.* - Core, RAM, tick time, state hash and formats: none (level bytes v1, journal v1 mode 1, RULES_VERSION 2 unchanged).
- zk: unchanged per run under the cycle cap (heaviest level about 29.6M user cycles, about 0.0000184 ETH per run proof).
- Onchain:
  - registry mint: about 50-70k gas plus 472 B calldata;
  - Season.open: +16 address slots plus royaltyBp, about 350k gas once per season;
  - close: one extra subtraction;
  - claimRoyalty: about 30-40k gas per minter;
  - deployment: a new Season and Challenge pair.
- Offchain per candidate: a mix playtest (cheap) and a 50-seed search run. Search costs at most 749 ms of compute per game second, so a level of about 1,330 ticks takes about 66 CPU-s and 50 seeds about 55 CPU-min. Add a zk executor run of a few seconds. Roughly 1 CPU-hour per candidate, so 100 candidates is about 100 CPU-hours per season.
- Per season: a new calibration file (calibrate), a playtest --check with a community-slot band, and a level-pack refresh for the browser.
- Vectors: none new in core. Contract tests for royalty accounting and solvency.

*Conflicts.* D11 (Superchallenge deferred; this is the redesign it calls for, legal read first); §8.3; §8.4 SeasonParams (royaltyBp, slotMinter\[16\]) and close accounting; P10 (every level has a levels/src source); levels/targets.json per-slot target clear rates; §10 MapNFT renderer is Stylus, paused; TODO.md problem 7 (lottery-like draw with paid entries); CLAUDE.md sync rule: seasons/\*.json -> README §8.4 and docs/ECONOMY.md

**Fairness: concerns, 3 of 5; gap narrows; D14 compliant.** D14: runs stay ordinary mode-1 Challenge runs, with per-run seeds, deflection keys and nonce-bound journals. Maps are public from mint, weeks before the season opens, but because of the deflections nothing on them can be precomputed or copied. Bots can play and calibrate it: the maps are ordinary v1 levels. Gap: the gap rule caps search's ratio over the mix on each community map at the built-in median. From the per-level table in reports/bot-advantage.md that median is about 1.6-1.7, out of a range from about 1.28 (open) to 4.10 (doom). So community maps land in the easier half, and the season's mean gap narrows slightly, at least as measured against the mix. Concerns: (1) The filter is the scripted mix, not humans, and minters design against it. The cheapest way to pass the gap rule is to make the mix do well, for example with open pockets the boss body cannot enter. Validity allows them: any single 4-connected region of at least 1,682 cells passes. Such pockets are seed-independent safe zones, the very thing seeded deflections were added to remove (§4.6 'Play'), and none of the four checks looks for them. (2) If curation uses a fixed, public set of 50 seeds, a minter can tune a layout until it passes on exactly those seeds. Weights calibrated on the same seeds can be pushed the same way. (3) Draw variance. The 4 community slots are new every season, so they always carry first-season weights from bots only, while built-in levels move to weights from player journals. 1 - C(12,6)/C(16,6) is about 88.5% of runs draw at least one community map, 1.5 per run on average. A miscalibrated community map therefore becomes a re-roll magnet (§8.2, several runs at once). (4) Sybils. 'One map per minter address' is no limit, since wallets are free. The 100-cell difference is checked only against existing levels, and a translated or mirrored copy passes it. Four near-variants of one layout could fill all four slots, which repeats any calibration error four times. Whether spam pays depends on the royalty's expected value against the 0.0005 ETH mint. (5) Selection is uniform over eligible maps. Minters are paid for passing the checks, not for making good maps, so the pitch's 'friendly to humans' incentive is only as strong as the checks. (6) The cycle cap is measured on calibration journals, not on worst-case inputs. This is minor: the settler pays for proving. (7) It still needs the legal read (royalties come from fees) and a new Season generation (slotMinter, royaltyBp).

*Fixes.* Derive the curation and calibration seeds from the entropy block h, after the mint cutoff, so that no layout can be tuned to them. Add a fifth check on boss coverage: over the curation seeds, the B x B body passes over at least about 90% of the open cells, or no open pocket of N cells or more is unreachable by the body. Deduplicate against every candidate and every past map, up to translation and mirroring, not only against existing levels. Keep a selected map for two seasons, so that its second season's weights come from player journals, or start with k = 2. Bound a community slot's weight within the range of the built-in weights. Get the legal read before any contract work.

**Play: ok, 3 of 5.** Play value comes only from the layouts. The loop gets no new decision: boss, minions, rail, A/B and commit all work exactly as now. What it adds is new situations. The 16 levels draw on a small layout vocabulary (bars, combs, cross, maze, ring, central block), and four boards per season that nobody on the team drew is real freshness for a seasonal paid game where players otherwise grind the same 16 forever. The in-game feel is untouched, and the economics are much cleaner than TODO.md's pots: the royalty comes out of the rake, there is no player-against-minter stake, and per-run seeds keep D14. Four weaknesses limit the play gain. (1) The gap rule (search/mix ratio at most the built-in median) and the 10-95% band favour open, simple boards where the human-like mix does well. That filters out exactly the intricate layouts that would add the most new situations, so variety narrows toward 'open with a few blocks'. (2) The 100-cell difference test is weak. A horizontal mirror of a built-in level (the player start at (30,59) survives a mirror) or open plus a few specks passes it and adds nothing. (3) Selection is a seeded lottery over eligible maps, so it rewards volume rather than quality: a generator plus a playtest loop can mass-produce passing maps from free wallets, and 'one map per minter address' does nothing against that. The mint fee is the only brake. 'Designing inside the band becomes its own competition' is not true when passing the threshold is all that counts. (4) Community slots never have previous-season player journals, so their weights always rest on bot data alone. That weakens §8.4's normalisation for exactly the four least-known slots in a paid draw. The idea also leaves open which four built-in levels give up their slots, and so what happens to the 95%-15% ramp. In tier terms this is T1 variety at T5 cost, and the team could get most of the play value by shipping four new T1 levels a season.

*Fixes.* Make the novelty test meaningful. Compare against every built-in level, every past community map and the other candidates, plus their horizontal mirrors, and require a much larger difference (e.g. 400+ cells) or a structural metric (number of obstacle components, corridor-width histogram). Replace the pure lottery with quality-weighted selection, e.g. rank eligible maps by the mix's median effective claim closest to a target band centre, or by a 'decision density' metric such as the number of distinct capture sizes in the mix's games. Draw only to break ties, and raise or bond the mint fee so spam does not pay. Loosen the gap rule to the built-in maximum rather than the median, so maze-like maps survive. Name which four built-in levels give way (e.g. one per difficulty quartile, keeping the ramp), and give community slots a conservative weight floor until a season of player journals exists.

*Readability.* Same rendering as the built-in levels, so the boss, minions, trail and rail read fine at 4x4 px. The risk is the bitmaps themselves. Minted maps can contain single-cell specks, checkerboards and diagonal-only obstacle chains. At 4x4 px these read as noise, and the rail around them (rail cells that touch the field only diagonally) is hard to follow. Add a lint to curation: obstacle components at least 2x2, no diagonal-only contacts, a cap on the number of components.

## Score capped near the target

`modes-and-social#10` · T5 Mode, scoring or contracts · score 9 (core 3, fairness 4, play 2) · gap: narrows · D14: compliant

Paid mode. A season type in which any claim above a level's target is worth nothing: clearing is all that counts. Commit versus clear becomes the one decision on each level, and the overshooting finishing cut stops paying.

**Rule sketch.** Journal mode 3 'clear league' is added. The decoder accepts modes 0, 1 and 3, and mode 2 stays reserved; this changes PIN-12, so RULES_VERSION is bumped and the vectors with error 5 are regenerated. Play is identical to mode 1. Only the core's Outcome score changes: levelScore = min(claimBp, targetBp) × weightBp / 10,000, rounded down, and 0 when the lives ran out (D5 kept). targetBp is read from level-byte offset 470. A cleared level therefore always scores target × weight / 10,000, because a clear ends at the capture that crosses the target (PIN-10). Season: a new mode parameter (1 or 3), and settlement checks Outcome.mode = season.mode instead of 1. calibrate uses capped effective claims (the median of min(effective claim, target) per level), with the same P formula. Ranking and payout follow D10 unchanged. Equal scores are now common, the fewer-ticks tiebreak only chooses each wallet's best run, and the pro-rata payout splits equal scores equally.

**Inspired by:** Qix (1981), Volfied (1989), Super Qix (1987), AQuix (1997), Jezzball NES (2026), Qix II: Tournament (1982), Coach Tzabar (1997). **Mechanic families:** [Overfill percentage bonus](../taxonomy/scoring-and-risk.md#overfill-percentage-bonus), [Coverage-threshold prize](../taxonomy/scoring-and-risk.md#coverage-threshold-prize), [Saturating score counter](../taxonomy/scoring-and-risk.md#saturating-score-counter), [Area-percentage clear threshold](../taxonomy/capture-rules.md#area-percentage-clear-threshold), [Segmented score tables](../taxonomy/multiplayer-and-competition.md#segmented-score-tables). **Touches:** level-format, outcome, economy, tools-bots, journal, contracts.

**Decisions it reopens:** D10; README 8.4 level score; PIN-12; §8.4.

**Bot effect.** Narrows the gap, sharply against strong players. Search's per-level mean claims of 9,580-9,881 bp against targets of 7,500-9,000 come from its two-capture search for the finishing clear; capped, every clear scores the same. These are estimates from reports/bot-advantage.md's per-level table, assuming the mix overshoots about 600 bp on the levels it clears. Search over the reference mix would fall from 2.03 to about 1.7. Search over greedy, which clears 88-100% of levels, would fall from 1.29 to about 1.05: below the 1.25 break-even at the 20% rake, so in a season of strong players the fee alone would make a bot run unprofitable. D14 is untouched. Both figures must be measured with a capped-scoring rerun before any season.

**Budget.** Core: one min() at the end of each level. zk: essentially no extra cycles. Contracts: one season parameter and one changed equality check. Offchain: a calibration rerun. Screen: the HUD marks the target as the score cap.

**Variety.** Today the decision near the target is how far to push past it. Here the target is a hard line: below it, the choice is to commit and keep a partial score or take the risk to clear; above it there is nothing to gain. Skill shows as clearing reliably, with tick-efficient clears as a visible bragging metric. The trade-off is that players above the clear-everything level are no longer told apart.

**Merged from:** `human-edge#9`. Variants:

- Banded clear scoring: Clearing a level pays at most a small band above its target. The last few per cent squeezed out of the boss's pocket stop paying, so a clean human clear is worth nearly as much as a machine-perfect one.

**Core engineer: feasible, 3 of 5, tier 5.** Builds as stated. Game already holds target_bp, so level_score gains a min(). Accepting mode 3 moves vectors/format/journal-unknown-mode-3.json (error 5), hence the RULES_VERSION bump. Challenge.sol hardcodes MODE_CHALLENGE = 1 and SeasonParams has no mode, so a parallel 'clear league' needs new Season and Challenge deployments. That is the real cost. The bot arithmetic checks out against reports/bot-advantage.md: greedy clears 88-100%, so search over greedy falls to roughly 1/0.96, about 1.05, and the mix's 3.6 and 2.6 mean clears put search over the mix near 1.7. Measure both, as the idea says. Ties do not matter for payout: D10's ticks tiebreak only picks each wallet's best run, and pro-rata splits equal scores equally. The trade-off is real: players who clear everything become indistinguishable. Training mode 0 must know which scoring to preview.

*Fixes.* If capped scoring is meant for every Challenge season, skip mode 3. Cap inside level_score under a new RULES_VERSION: the season's rulesVersion and referee already select the rules, and contracts sum levelScore unchanged. That makes it T3 with no redeploy. Keep the mode-3 plus Season-parameter design only if capped and uncapped seasons must coexist.

*Cost.* Core: one min() per level; zk +0. As stated: a journal decoder change (vector 5 moves), a Season mode parameter and Challenge's mode check, which means a new contract generation, and a calibration rerun with capped medians. Via the rules-version path: core and calibration only.

*Conflicts.* D10; PIN-12; §6.3 decoding rule 4; §7.2 settlement check 5 (mode = 1); §8.4 level_score; §8.4 season parameters; vectors/format/journal-unknown-mode-3.json

**Fairness: ok, 4 of 5; gap narrows; D14 compliant.** D14 is untouched. The gap narrows strongly. Every clear scores exactly target x weight, so search's overshoot on cleared levels (9,580-9,918 bp against targets of 7,500-9,000) stops paying, and a skilled human who clears all 6 matches search exactly. The pitch's estimates (about 1.7x over the mix, about 1.05x over greedy) are plausible but have to be measured. Calibration is straightforward (the median of the capped effective claims) and scripted bots play it unchanged. Draw variance: about the same as today. Hard levels stay high-weight and bimodal for humans, since zeros still count. Trade-offs to state plainly. (1) Top-end skill compression: all-clear runs tie, and greedy already clears all 6 on 82% of runs, so a cheap scripted bot reaches the maximum without search. Against an average field like the mix, bot farming is still profitable (greedy over the mix stays near 1.5x). The rule narrows search's lead over skilled humans, not botting as a whole. (2) Ties become common: fewer ticks only picks each wallet's best run, and pro-rata pays equal scores equally, which is fair but makes speed-padding irrelevant. (3) T5 cost: journal mode 3 changes PIN-12 (RULES_VERSION and the error-5 vectors), a Season mode parameter, and a changed equality check in settlement.

*Fixes.* Run a capped-scoring playtest and bot-advantage rerun before any season, and publish search-over-mix and greedy-over-mix. Consider the banded variant (target plus a small band, e.g. 300 bp) to keep some separation at the top. Raise the default minClears for clear-league seasons so the many all-clear ties are qualified runs.

**Play: weak, 2 of 5.** Play is identical to mode 1, except that it removes an existing decision: how big to make the finishing cut and how far past the target to push. It adds no situation, so as play variety it adds nothing, and it compresses skill. Every clear scores the same, ties are common, and players above the clear-everything level can no longer be told apart. The case for it is economic, not play value. By its own estimate, capping cuts search's edge over greedy from 1.29 to about 1.05, below the rake break-even. That fairness lever is worth measuring, but it belongs in an economics decision, not a variety catalogue. It also reopens PIN-12 and the settlement mode check, a T5 contract surface, for a single min().

*Fixes.* Treat it as an anti-bot economic option and measure it with a capped-scoring rerun first. If it's adopted, pair it with a mechanic that restores a post-target decision (overtime with a capped overshoot, for example), so clear-league seasons still reward something beyond reliability. Use the banded variant (cap slightly above the target) to keep a small finisher incentive.

*Readability.* No board change. The HUD marks the target as the score cap.
