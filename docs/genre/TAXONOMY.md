# Mechanics taxonomy

628 mechanic families drawn from the 710 games of [`CATALOG.md`](CATALOG.md), in 12 axes. A family is a reusable design idea, not a game: *slow draw scores double*, *enemies that eat claimed area*. Agents extracted 1,336 families from the catalog, one agent per tenth of it, and one agent per axis merged them; [`README.md`](README.md#the-taxonomy-and-the-ideas) explains the process. Each axis page gives every family's description, examples and variants. **Games** counts the catalog games that show a family, as the merging agent counted them: an estimate, not a census.

| Axis | Families | Covers |
|---|---|---|
| [Movement and drawing](#movement-and-drawing) | 73 | how the player moves and draws: rail or free movement, draw speeds, trail rules, fuses, diagonal moves, auto-draw, stopping, shapes drawn |
| [Capture rules](#capture-rules) | 67 | what a closed cut claims and how: the enemy-free side, the smaller side, several enemies, splitting enemies into regions, area thresholds, bonuses for big captures, captures that kill or trap enemies |
| [Field enemies](#field-enemies) | 74 | enemies in the open field: bouncing balls, line creatures, bosses with patterns or phases, growing, splitting, shooting, chasing, several bosses |
| [Edge and claimed-area enemies](#edge-and-claimed-area-enemies) | 26 | enemies on the border or in claimed area: patrollers on the edge, enemies that eat claimed area, pursuers that follow the trail, fuses, enemies that leave the edge |
| [Terrain and geometry](#terrain-and-geometry) | 44 | field shape and terrain: obstacles, pre-claimed islands, walls, hazards, teleporters, non-rectangular or hex fields, scrolling, 3D surfaces, a field that changes during play |
| [Items and power-ups](#items-and-power-ups) | 54 | pickups and power-ups: how they appear (captured boxes, random drops) and what they do (speed, laser, shield, time stop, extra life, enemy slow, area bombs) |
| [Scoring and risk](#scoring-and-risk) | 58 | score systems and risk against reward: multipliers, slow-draw bonuses, percentage bonuses, perfect clears, time bonuses, combo chains, gambling on capture size |
| [Level structure and progression](#level-structure-and-progression) | 54 | stages and progression: stage goals, boss stages, difficulty ramps, level select, world maps, unlocks, continues, story structure |
| [Reveal and presentation](#reveal-and-presentation) | 43 | image reveal, silhouettes, themes, music, colour coding, visual feedback, juice, screen layout |
| [Multiplayer and competition](#multiplayer-and-competition) | 41 | versus, co-op, .io territory battles, asynchronous ghosts, leaderboards, battle royale, team play |
| [Modes and meta](#modes-and-meta) | 44 | game modes (puzzle, time attack, endless, daily, editor, user levels), meta-progression, collections, economy, gacha |
| [Controls, time and pacing](#controls-time-and-pacing) | 50 | input schemes (one button, touch, swipe, analog), time limits, slow motion, pacing devices, pause |

## Movement and drawing

The main split is where a cut starts. In the Qix model the cut leaves from the edge: button-gated departure (14 games), two draw speeds (19), auto-draw (5), and Xonix-style free roaming on claimed land (10). In the io model it leaves from home territory, the largest family (54). In the JezzBall model a wall is launched from a point (35) and is vulnerable while it builds (29). Exposure of the open trail is the near-universal risk: the trail is vulnerable to enemies in 43 games and crossing your own trail is penalised in 38. Softer rules let enemies cut or erase the trail instead of killing (14) or let the player retract the trail (13); the opposite rule, no reversing onto the trail, appears in 4. Common extras are dashes (13), perpetual motion (10), eight-way diagonals (9, while most games stay orthogonal), a consumable drawing resource (9), pointer-drawn lassos (9) and links between fixed anchors (9). Single-instance or near-single ideas include pushing walls inward, departure only perpendicular to the border, cuts chained across cube faces, arc captures from control points, GPS walking, your own line shielding contact, shooting your own trail to escape, invincibility while not drawing, any-angle and instant cuts, and decaying trails.

Details: [`taxonomy/movement-and-drawing.md`](taxonomy/movement-and-drawing.md).

| Family | Games | Lineages |
|---|---|---|
| [Home-territory loop capture (Paper.io model)](taxonomy/movement-and-drawing.md#home-territory-loop-capture-paperio-model) | 54 | io-territory, xonix, other |
| [Open trail vulnerable to enemies](taxonomy/movement-and-drawing.md#open-trail-vulnerable-to-enemies) | 43 | qix, xonix, gals-panic, io-territory |
| [Self-crossing penalty (own trail is lethal)](taxonomy/movement-and-drawing.md#self-crossing-penalty-own-trail-is-lethal) | 38 | qix, xonix, gals-panic, io-territory |
| [Point-launched growing wall (JezzBall model)](taxonomy/movement-and-drawing.md#point-launched-growing-wall-jezzball-model) | 35 | jezzball |
| [Wall vulnerable while under construction](taxonomy/movement-and-drawing.md#wall-vulnerable-while-under-construction) | 29 | jezzball |
| [Two draw speeds (Fast/Slow Draw)](taxonomy/movement-and-drawing.md#two-draw-speeds-fastslow-draw) | 19 | qix, gals-panic |
| [Button-gated departure (hold to draw)](taxonomy/movement-and-drawing.md#button-gated-departure-hold-to-draw) | 14 | qix, gals-panic |
| [Enemy cuts or erases the open trail](taxonomy/movement-and-drawing.md#enemy-cuts-or-erases-the-open-trail) | 14 | qix, xonix, gals-panic |
| [Retreat along the open trail (retractable trail)](taxonomy/movement-and-drawing.md#retreat-along-the-open-trail-retractable-trail) | 13 | qix, volfied, xonix, gals-panic |
| [Dash or boost burst](taxonomy/movement-and-drawing.md#dash-or-boost-burst) | 13 | qix, io-territory, other |
| [Self-closing loop trail (no home base)](taxonomy/movement-and-drawing.md#self-closing-loop-trail-no-home-base) | 12 | other |
| [Rail-bound line movement](taxonomy/movement-and-drawing.md#rail-bound-line-movement) | 12 | amidar-painter |
| [Free roaming on claimed land (Xonix land-and-sea model)](taxonomy/movement-and-drawing.md#free-roaming-on-claimed-land-xonix-land-and-sea-model) | 10 | xonix, gals-panic |
| [Perpetual motion (avatar never stops)](taxonomy/movement-and-drawing.md#perpetual-motion-avatar-never-stops) | 10 | amidar-painter, other, io-territory, volfied, qix |
| [Pointer-drawn lasso (no avatar)](taxonomy/movement-and-drawing.md#pointer-drawn-lasso-no-avatar) | 9 | other, qix |
| [Anchor-to-anchor links](taxonomy/movement-and-drawing.md#anchor-to-anchor-links) | 9 | other |
| [Eight-way diagonal movement](taxonomy/movement-and-drawing.md#eight-way-diagonal-movement) | 9 | qix, gals-panic, other |
| [Consumable drawing resource](taxonomy/movement-and-drawing.md#consumable-drawing-resource) | 9 | qix, other |
| [Hold-to-grow filler shapes](taxonomy/movement-and-drawing.md#hold-to-grow-filler-shapes) | 8 | jezzball |
| [Miss resolution: trail erased, respawn point](taxonomy/movement-and-drawing.md#miss-resolution-trail-erased-respawn-point) | 8 | qix, xonix, volfied |
| [Grid-step four-direction movement](taxonomy/movement-and-drawing.md#grid-step-four-direction-movement) | 7 | io-territory |
| [Per-stroke length cap](taxonomy/movement-and-drawing.md#per-stroke-length-cap) | 7 | other, io-territory |
| [Location- or state-dependent speed](taxonomy/movement-and-drawing.md#location--or-state-dependent-speed) | 7 | qix, io-territory, other |
| [Committed vs cancellable cuts](taxonomy/movement-and-drawing.md#committed-vs-cancellable-cuts) | 7 | qix, jezzball |
| [Single fixed draw speed](taxonomy/movement-and-drawing.md#single-fixed-draw-speed) | 6 | qix, volfied |
| [Limited number of cuts per level](taxonomy/movement-and-drawing.md#limited-number-of-cuts-per-level) | 6 | qix, jezzball, other |
| [Auto-draw on leaving safe ground](taxonomy/movement-and-drawing.md#auto-draw-on-leaving-safe-ground) | 5 | qix |
| [Stall penalty without a Fuse](taxonomy/movement-and-drawing.md#stall-penalty-without-a-fuse) | 5 | qix |
| [Vehicle-physics steering](taxonomy/movement-and-drawing.md#vehicle-physics-steering) | 5 | io-territory, other |
| [Two-half walls with independent fates](taxonomy/movement-and-drawing.md#two-half-walls-with-independent-fates) | 5 | jezzball |
| [Edge-launched straight cut](taxonomy/movement-and-drawing.md#edge-launched-straight-cut) | 4 | qix |
| [Pointer-drawn trail (freehand or planned route)](taxonomy/movement-and-drawing.md#pointer-drawn-trail-freehand-or-planned-route) | 4 | qix, gals-panic |
| [Jump or teleport across the field](taxonomy/movement-and-drawing.md#jump-or-teleport-across-the-field) | 4 | qix, xonix |
| [No reversing onto the open trail](taxonomy/movement-and-drawing.md#no-reversing-onto-the-open-trail) | 4 | xonix, qix, io-territory |
| [In-field avatar launches walls](taxonomy/movement-and-drawing.md#in-field-avatar-launches-walls) | 4 | jezzball |
| [Held speed-up button](taxonomy/movement-and-drawing.md#held-speed-up-button) | 4 | volfied, gals-panic, amidar-painter |
| [Continuous heading with capped turn rate](taxonomy/movement-and-drawing.md#continuous-heading-with-capped-turn-rate) | 3 | other, io-territory |
| [Launched physics-body trail](taxonomy/movement-and-drawing.md#launched-physics-body-trail) | 3 | qix, io-territory, other |
| [Movement confined to the line network](taxonomy/movement-and-drawing.md#movement-confined-to-the-line-network) | 3 | qix |
| [Rectangle-only captures](taxonomy/movement-and-drawing.md#rectangle-only-captures) | 3 | qix, gals-panic |
| [Placed wall structures](taxonomy/movement-and-drawing.md#placed-wall-structures) | 3 | other, io-territory |
| [Permanent lethal trails (light-cycle model)](taxonomy/movement-and-drawing.md#permanent-lethal-trails-light-cycle-model) | 3 | other |
| [Off-safe-ground exposure limit](taxonomy/movement-and-drawing.md#off-safe-ground-exposure-limit) | 3 | xonix, amidar-painter |
| [Concurrent wall limit](taxonomy/movement-and-drawing.md#concurrent-wall-limit) | 3 | jezzball |
| [Any-angle straight cuts](taxonomy/movement-and-drawing.md#any-angle-straight-cuts) | 2 | jezzball |
| [Decaying or vanishing unfinished trail](taxonomy/movement-and-drawing.md#decaying-or-vanishing-unfinished-trail) | 2 | xonix, io-territory |
| [Straight strand walls](taxonomy/movement-and-drawing.md#straight-strand-walls) | 2 | other |
| [Shots as the drawing tool](taxonomy/movement-and-drawing.md#shots-as-the-drawing-tool) | 2 | other |
| [Backtracking undoes progress](taxonomy/movement-and-drawing.md#backtracking-undoes-progress) | 2 | amidar-painter |
| [Instant slash cut](taxonomy/movement-and-drawing.md#instant-slash-cut) | 1 | jezzball |
| [Arc captures from control points](taxonomy/movement-and-drawing.md#arc-captures-from-control-points) | 1 | qix |
| [Cuts chained across faces](taxonomy/movement-and-drawing.md#cuts-chained-across-faces) | 1 | qix |
| [Wall pushing instead of drawing](taxonomy/movement-and-drawing.md#wall-pushing-instead-of-drawing) | 1 | qix |
| [Perpendicular-only departure](taxonomy/movement-and-drawing.md#perpendicular-only-departure) | 1 | qix |
| [Lockstep twin movers](taxonomy/movement-and-drawing.md#lockstep-twin-movers) | 1 | qix |
| [Invincibility gauge while not drawing](taxonomy/movement-and-drawing.md#invincibility-gauge-while-not-drawing) | 1 | qix |
| [Hold to keep the trail open (precision draw)](taxonomy/movement-and-drawing.md#hold-to-keep-the-trail-open-precision-draw) | 1 | xonix |
| [Shoot your own trail to escape](taxonomy/movement-and-drawing.md#shoot-your-own-trail-to-escape) | 1 | xonix |
| [Own drawn line shields contact](taxonomy/movement-and-drawing.md#own-drawn-line-shields-contact) | 1 | gals-panic |
| [Two cursors joined by a wrapping line](taxonomy/movement-and-drawing.md#two-cursors-joined-by-a-wrapping-line) | 1 | other |
| [Hooked rope with pins](taxonomy/movement-and-drawing.md#hooked-rope-with-pins) | 1 | other |
| [Orbit-and-jump movement](taxonomy/movement-and-drawing.md#orbit-and-jump-movement) | 1 | other |
| [Expiring trap walls](taxonomy/movement-and-drawing.md#expiring-trap-walls) | 1 | other |
| [Auto-laid territory markers](taxonomy/movement-and-drawing.md#auto-laid-territory-markers) | 1 | other |
| [Drawn paths as platforms](taxonomy/movement-and-drawing.md#drawn-paths-as-platforms) | 1 | other |
| [Damaging trail](taxonomy/movement-and-drawing.md#damaging-trail) | 1 | other |
| [Momentum grappling hook](taxonomy/movement-and-drawing.md#momentum-grappling-hook) | 1 | jezzball |
| [Overcharged build speed with self-destruct risk](taxonomy/movement-and-drawing.md#overcharged-build-speed-with-self-destruct-risk) | 1 | jezzball |
| [Hop-marked cube lines](taxonomy/movement-and-drawing.md#hop-marked-cube-lines) | 1 | jezzball |
| [Hold-to-trace line with a retracting tag](taxonomy/movement-and-drawing.md#hold-to-trace-line-with-a-retracting-tag) | 1 | amidar-painter |
| [Forward-only self-consuming track](taxonomy/movement-and-drawing.md#forward-only-self-consuming-track) | 1 | amidar-painter |
| [Wide path](taxonomy/movement-and-drawing.md#wide-path) | 1 | io-territory |
| [GPS walking capture](taxonomy/movement-and-drawing.md#gps-walking-capture) | 1 | io-territory |

## Capture rules

An area-percentage clear is by far the most common goal (177 games). 75% is the Qix/Xonix/JezzBall standard, and catalogued values run from 30% to 91%. 26 games make the threshold configurable or escalating, and 19 require 100%. Claiming every enemy-free region is the usual resolution (33). Claiming the smaller side (7) or the side with fewer enemies (1) is rare. Enclosed enemies are destroyed in 42 games, used for pocketing and herding in 8, and splitting several main enemies apart pays a reward or clears the stage in 13. Trapping or eliminating enemies is the clear condition in 14, squeezing them to death in 5, and immobilising them in 2. Non-trail models include Amidar box perimeters (45), Make Trax line coverage (9), coverage without enclosure (8), loops that act on targets and vanish (19), triangles (5) and subtractive cutting (7). Picture games add silhouette-only coverage (12). In multiplayer, enclosure steals rival land (20), and elimination erases (5) or hands over (2) the victim's land. Rules seen only once include capture by disconnection, cells claimed simultaneously turning neutral, equal ball counts per quadrant, decay of cut-off cells, a colour-swap grid, cut pieces that become Tetris blocks, and minimal-enclosure treasure.

Details: [`taxonomy/capture-rules.md`](taxonomy/capture-rules.md).

| Family | Games | Lineages |
|---|---|---|
| [Area-percentage clear threshold](taxonomy/capture-rules.md#area-percentage-clear-threshold) | 177 | qix, xonix, jezzball, gals-panic, amidar-painter, volfied |
| [Perimeter-complete box capture (Amidar model)](taxonomy/capture-rules.md#perimeter-complete-box-capture-amidar-model) | 45 | amidar-painter, other |
| [Enclosed enemies are destroyed or captured](taxonomy/capture-rules.md#enclosed-enemies-are-destroyed-or-captured) | 42 | qix, xonix, volfied, jezzball, gals-panic, io-territory |
| [Enemy-free regions are claimed](taxonomy/capture-rules.md#enemy-free-regions-are-claimed) | 33 | qix, xonix, volfied, jezzball, gals-panic |
| [Configurable or escalating clear threshold](taxonomy/capture-rules.md#configurable-or-escalating-clear-threshold) | 26 | qix, xonix, jezzball, gals-panic, amidar-painter, volfied |
| [Enclosure takes rival territory](taxonomy/capture-rules.md#enclosure-takes-rival-territory) | 20 | io-territory, other |
| [Whole-field clear required](taxonomy/capture-rules.md#whole-field-clear-required) | 19 | qix, xonix, gals-panic, amidar-painter, other |
| [Transient loop capture of targets](taxonomy/capture-rules.md#transient-loop-capture-of-targets) | 19 | other, io-territory, qix |
| [Trap or eliminate enemies to clear](taxonomy/capture-rules.md#trap-or-eliminate-enemies-to-clear) | 14 | qix, xonix, volfied, gals-panic, other |
| [Splitting enemies into separate regions](taxonomy/capture-rules.md#splitting-enemies-into-separate-regions) | 13 | qix, volfied, jezzball |
| [Silhouette-only coverage](taxonomy/capture-rules.md#silhouette-only-coverage) | 12 | gals-panic |
| [Trail-enclosure claim](taxonomy/capture-rules.md#trail-enclosure-claim) | 12 | gals-panic, other, qix |
| [Line coverage without enclosure (Make Trax model)](taxonomy/capture-rules.md#line-coverage-without-enclosure-make-trax-model) | 9 | amidar-painter |
| [Pocketing and herding walls](taxonomy/capture-rules.md#pocketing-and-herding-walls) | 8 | xonix, jezzball |
| [Coverage claim without enclosure](taxonomy/capture-rules.md#coverage-claim-without-enclosure) | 8 | amidar-painter, other, io-territory |
| [Smaller side is claimed](taxonomy/capture-rules.md#smaller-side-is-claimed) | 7 | qix, xonix, gals-panic |
| [Subtractive cutting](taxonomy/capture-rules.md#subtractive-cutting) | 7 | xonix, qix, jezzball |
| [Area model and fill computation](taxonomy/capture-rules.md#area-model-and-fill-computation) | 7 | qix, io-territory |
| [Captured enemies respawn](taxonomy/capture-rules.md#captured-enemies-respawn) | 5 | qix, jezzball |
| [Squeeze capture](taxonomy/capture-rules.md#squeeze-capture) | 5 | volfied, jezzball |
| [Painted cells plus enclosure fill](taxonomy/capture-rules.md#painted-cells-plus-enclosure-fill) | 5 | qix, other, io-territory |
| [Elimination erases the victim's territory](taxonomy/capture-rules.md#elimination-erases-the-victims-territory) | 5 | io-territory |
| [Triangle enclosures](taxonomy/capture-rules.md#triangle-enclosures) | 5 | other |
| [Enclosed pickups and objectives](taxonomy/capture-rules.md#enclosed-pickups-and-objectives) | 4 | qix, xonix |
| [Smaller piece sinks](taxonomy/capture-rules.md#smaller-piece-sinks) | 4 | other |
| [Absolute count clear condition](taxonomy/capture-rules.md#absolute-count-clear-condition) | 3 | xonix, jezzball |
| [Auto-complete above a threshold](taxonomy/capture-rules.md#auto-complete-above-a-threshold) | 3 | qix |
| [Type-specific enclosure outcome](taxonomy/capture-rules.md#type-specific-enclosure-outcome) | 3 | other, volfied, qix |
| [Captures damage the boss](taxonomy/capture-rules.md#captures-damage-the-boss) | 3 | gals-panic, volfied |
| [Capture completion kills enemies](taxonomy/capture-rules.md#capture-completion-kills-enemies) | 3 | amidar-painter |
| [Enclose hazards to neutralise them](taxonomy/capture-rules.md#enclose-hazards-to-neutralise-them) | 3 | qix, volfied, xonix |
| [Connected growth only](taxonomy/capture-rules.md#connected-growth-only) | 3 | amidar-painter, io-territory, other |
| [Enclosures must hold](taxonomy/capture-rules.md#enclosures-must-hold) | 3 | other, qix |
| [Multi-loop capture gauge](taxonomy/capture-rules.md#multi-loop-capture-gauge) | 3 | other |
| [Immobilisation clear](taxonomy/capture-rules.md#immobilisation-clear) | 2 | volfied, qix |
| [Selective enclosure](taxonomy/capture-rules.md#selective-enclosure) | 2 | qix |
| [Sum-of-sizes goal](taxonomy/capture-rules.md#sum-of-sizes-goal) | 2 | jezzball |
| [Rectangle-only cuts](taxonomy/capture-rules.md#rectangle-only-cuts) | 2 | qix |
| [Floor-up fill](taxonomy/capture-rules.md#floor-up-fill) | 2 | qix, jezzball |
| [Multi-layer capture](taxonomy/capture-rules.md#multi-layer-capture) | 2 | xonix |
| [Elimination annexes the victim's territory](taxonomy/capture-rules.md#elimination-annexes-the-victims-territory) | 2 | io-territory |
| [Region majority bonus](taxonomy/capture-rules.md#region-majority-bonus) | 2 | io-territory |
| [Enclose to stun, then finish](taxonomy/capture-rules.md#enclose-to-stun-then-finish) | 2 | other |
| [Enclosure upgrades contents](taxonomy/capture-rules.md#enclosure-upgrades-contents) | 2 | other |
| [Tile flipping as capture](taxonomy/capture-rules.md#tile-flipping-as-capture) | 2 | other |
| [Fewer-enemies side is claimed](taxonomy/capture-rules.md#fewer-enemies-side-is-claimed) | 1 | qix |
| [Captured enemies become ammunition](taxonomy/capture-rules.md#captured-enemies-become-ammunition) | 1 | qix |
| [Lure enemies into each other](taxonomy/capture-rules.md#lure-enemies-into-each-other) | 1 | other |
| [Pen and separate](taxonomy/capture-rules.md#pen-and-separate) | 1 | qix |
| [Equal-count quadrant split](taxonomy/capture-rules.md#equal-count-quadrant-split) | 1 | jezzball |
| [Catch-count goal](taxonomy/capture-rules.md#catch-count-goal) | 1 | jezzball |
| [Linked targets](taxonomy/capture-rules.md#linked-targets) | 1 | jezzball |
| [Colour-swap capture grid](taxonomy/capture-rules.md#colour-swap-capture-grid) | 1 | xonix |
| [Isolation decay of cut-off cells](taxonomy/capture-rules.md#isolation-decay-of-cut-off-cells) | 1 | jezzball |
| [Capture by disconnection](taxonomy/capture-rules.md#capture-by-disconnection) | 1 | io-territory |
| [Losing all land is death](taxonomy/capture-rules.md#losing-all-land-is-death) | 1 | io-territory |
| [Simultaneous claim neutralises](taxonomy/capture-rules.md#simultaneous-claim-neutralises) | 1 | io-territory |
| [Enclosures grant production](taxonomy/capture-rules.md#enclosures-grant-production) | 1 | other |
| [Anchor object must be inside the loop](taxonomy/capture-rules.md#anchor-object-must-be-inside-the-loop) | 1 | other |
| [Minimal-enclosure treasure](taxonomy/capture-rules.md#minimal-enclosure-treasure) | 1 | other |
| [Recolour own markers](taxonomy/capture-rules.md#recolour-own-markers) | 1 | other |
| [Walls throttle enemies](taxonomy/capture-rules.md#walls-throttle-enemies) | 1 | other |
| [Living territory effects](taxonomy/capture-rules.md#living-territory-effects) | 1 | qix |
| [Captured pieces become puzzle blocks](taxonomy/capture-rules.md#captured-pieces-become-puzzle-blocks) | 1 | qix |
| [Prisoners lost if cut off](taxonomy/capture-rules.md#prisoners-lost-if-cut-off) | 1 | qix |
| [Match-three clearing as capture](taxonomy/capture-rules.md#match-three-clearing-as-capture) | 1 | other |
| [Area bombs uncover](taxonomy/capture-rules.md#area-bombs-uncover) | 1 | other |

## Field enemies

Most field threats come as mixed rosters (78) built from bouncing balls (57, the Xonix and JezzBall staple), homing chasers (45) and shooters (35). The Qix line creature itself appears in 26 games. For bosses, boss-plus-minions (18) is the Volfied and Gals Panic norm, joined by per-boss attack scripts (13), set-piece campaign bosses (11) and several main enemies at once (13). Boss phases triggered by capture thresholds are rare (3). Behaviour types include painter-grid chasers (18), trail hunters (16), patterned movers (15), erratic movers (14), aggression that starts only when the player draws (12), spawners (11), enemies locked to terrain (10), immune types (10), snakes (9), visible warnings before attacks (8), mines (8) and sight-based stealth (7). io games add bot personalities (6) and difficulty tiers (11). Adaptive AI (3), beat-synced movement (2) and self-play neural bots (2) are rare. A boss that shrinks with free space, minions that strengthen the boss, enemies that flee at the end, predation between creatures, and dodging by swapping colour each appear once.

Details: [`taxonomy/field-enemies.md`](taxonomy/field-enemies.md).

| Family | Games | Lineages |
|---|---|---|
| [Mixed enemy roster](taxonomy/field-enemies.md#mixed-enemy-roster) | 78 | qix, xonix, volfied, jezzball, gals-panic, other |
| [Bouncing ball enemies](taxonomy/field-enemies.md#bouncing-ball-enemies) | 57 | qix, xonix, jezzball, amidar-painter, volfied |
| [Homing chasers](taxonomy/field-enemies.md#homing-chasers) | 45 | qix, xonix, jezzball, gals-panic, volfied, other |
| [Shooting enemies and bullet patterns](taxonomy/field-enemies.md#shooting-enemies-and-bullet-patterns) | 35 | qix, gals-panic, volfied, xonix, other |
| [Qix line creature](taxonomy/field-enemies.md#qix-line-creature) | 26 | qix |
| [Boss plus minions](taxonomy/field-enemies.md#boss-plus-minions) | 18 | volfied, gals-panic |
| [Grid-bound chasers](taxonomy/field-enemies.md#grid-bound-chasers) | 18 | amidar-painter |
| [Trail hunters](taxonomy/field-enemies.md#trail-hunters) | 16 | qix, xonix, volfied, io-territory |
| [Patterned and scripted movers](taxonomy/field-enemies.md#patterned-and-scripted-movers) | 15 | amidar-painter, qix, xonix, jezzball, volfied, gals-panic |
| [Erratic random movers](taxonomy/field-enemies.md#erratic-random-movers) | 14 | jezzball, qix, io-territory, volfied, xonix |
| [Several main enemies at once](taxonomy/field-enemies.md#several-main-enemies-at-once) | 13 | qix, gals-panic |
| [Per-boss attack scripts](taxonomy/field-enemies.md#per-boss-attack-scripts) | 13 | qix, volfied, gals-panic |
| [Draw-triggered aggression](taxonomy/field-enemies.md#draw-triggered-aggression) | 12 | qix, xonix, volfied, jezzball |
| [Vulnerable open trail](taxonomy/field-enemies.md#vulnerable-open-trail) | 11 | qix, xonix, gals-panic |
| [Spawner enemies](taxonomy/field-enemies.md#spawner-enemies) | 11 | qix, gals-panic, jezzball, volfied |
| [Boss encounters in a campaign](taxonomy/field-enemies.md#boss-encounters-in-a-campaign) | 11 | xonix, volfied, gals-panic, qix |
| [Selectable enemy difficulty and configuration](taxonomy/field-enemies.md#selectable-enemy-difficulty-and-configuration) | 11 | io-territory, gals-panic, qix |
| [Immune enemy types](taxonomy/field-enemies.md#immune-enemy-types) | 10 | amidar-painter, volfied, other, qix, jezzball |
| [Terrain-locked enemies](taxonomy/field-enemies.md#terrain-locked-enemies) | 10 | qix, xonix, amidar-painter |
| [Reinforcements over time](taxonomy/field-enemies.md#reinforcements-over-time) | 9 | other, io-territory, volfied, qix |
| [Snake and segmented-body enemies](taxonomy/field-enemies.md#snake-and-segmented-body-enemies) | 9 | xonix, qix, volfied |
| [Telegraphed attacks and readable tells](taxonomy/field-enemies.md#telegraphed-attacks-and-readable-tells) | 8 | qix, xonix, gals-panic |
| [Mines and mine layers](taxonomy/field-enemies.md#mines-and-mine-layers) | 8 | xonix, volfied, jezzball |
| [Sight-based detection and stealth](taxonomy/field-enemies.md#sight-based-detection-and-stealth) | 7 | amidar-painter, jezzball, qix, other, xonix |
| [Line, wall and land destroyers](taxonomy/field-enemies.md#line-wall-and-land-destroyers) | 7 | amidar-painter, xonix, qix, jezzball, volfied |
| [Respawning enemies](taxonomy/field-enemies.md#respawning-enemies) | 7 | amidar-painter, other, qix, xonix |
| [Splitting enemies](taxonomy/field-enemies.md#splitting-enemies) | 6 | jezzball, volfied, other, gals-panic |
| [Charging dashers](taxonomy/field-enemies.md#charging-dashers) | 6 | gals-panic, qix, xonix, volfied |
| [Bot personalities](taxonomy/field-enemies.md#bot-personalities) | 6 | io-territory |
| [Beam and shockwave attacks](taxonomy/field-enemies.md#beam-and-shockwave-attacks) | 6 | gals-panic, qix, volfied |
| [Turrets firing at the drawing player](taxonomy/field-enemies.md#turrets-firing-at-the-drawing-player) | 5 | qix, volfied |
| [Aggression scales with the player's territory or lead](taxonomy/field-enemies.md#aggression-scales-with-the-players-territory-or-lead) | 5 | io-territory, qix |
| [Enemies killable by touch](taxonomy/field-enemies.md#enemies-killable-by-touch) | 5 | qix, gals-panic, other |
| [Homing missiles](taxonomy/field-enemies.md#homing-missiles) | 4 | gals-panic, qix, jezzball, xonix |
| [Transient crossing hazards](taxonomy/field-enemies.md#transient-crossing-hazards) | 4 | qix, gals-panic |
| [Adaptive enemy AI](taxonomy/field-enemies.md#adaptive-enemy-ai) | 3 | amidar-painter, qix |
| [Boss phases at capture thresholds](taxonomy/field-enemies.md#boss-phases-at-capture-thresholds) | 3 | qix, volfied |
| [Paired and multi-part bosses to separate](taxonomy/field-enemies.md#paired-and-multi-part-bosses-to-separate) | 3 | volfied, qix |
| [Orbiters](taxonomy/field-enemies.md#orbiters) | 3 | volfied, qix |
| [Teleporting enemies](taxonomy/field-enemies.md#teleporting-enemies) | 3 | jezzball, volfied |
| [Attacks lethal off the trail](taxonomy/field-enemies.md#attacks-lethal-off-the-trail) | 3 | gals-panic |
| [Slowing enemies](taxonomy/field-enemies.md#slowing-enemies) | 3 | amidar-painter, gals-panic |
| [Blockers that obstruct cuts](taxonomy/field-enemies.md#blockers-that-obstruct-cuts) | 3 | qix |
| [Hit-count escalation on enemies](taxonomy/field-enemies.md#hit-count-escalation-on-enemies) | 3 | gals-panic |
| [Per-bounce speed change](taxonomy/field-enemies.md#per-bounce-speed-change) | 2 | jezzball |
| [Evasive enemies that flee enclosure](taxonomy/field-enemies.md#evasive-enemies-that-flee-enclosure) | 2 | qix, jezzball |
| [Beat-synced enemy movement](taxonomy/field-enemies.md#beat-synced-enemy-movement) | 2 | qix, jezzball |
| [Jumping enemies](taxonomy/field-enemies.md#jumping-enemies) | 2 | xonix |
| [Invisible and near-invisible enemies](taxonomy/field-enemies.md#invisible-and-near-invisible-enemies) | 2 | jezzball, qix |
| [Burrowing enemies that surface](taxonomy/field-enemies.md#burrowing-enemies-that-surface) | 2 | qix, xonix |
| [Grabbing and trapping enemies](taxonomy/field-enemies.md#grabbing-and-trapping-enemies) | 2 | xonix, qix |
| [Line contact summons reinforcements](taxonomy/field-enemies.md#line-contact-summons-reinforcements) | 2 | gals-panic, qix |
| [Ambushers and lingering area hazards](taxonomy/field-enemies.md#ambushers-and-lingering-area-hazards) | 2 | qix, xonix |
| [Neutral arena monsters](taxonomy/field-enemies.md#neutral-arena-monsters) | 2 | io-territory |
| [Self-play neural bots](taxonomy/field-enemies.md#self-play-neural-bots) | 2 | io-territory |
| [Flocking swarm from a portal](taxonomy/field-enemies.md#flocking-swarm-from-a-portal) | 1 | qix |
| [Size-versus-speed archetypes](taxonomy/field-enemies.md#size-versus-speed-archetypes) | 1 | qix |
| [Signature-trick bosses with a combined finale](taxonomy/field-enemies.md#signature-trick-bosses-with-a-combined-finale) | 1 | volfied |
| [Returning upgraded bosses](taxonomy/field-enemies.md#returning-upgraded-bosses) | 1 | volfied |
| [Weak-spot bosses](taxonomy/field-enemies.md#weak-spot-bosses) | 1 | volfied |
| [Territory-only boss](taxonomy/field-enemies.md#territory-only-boss) | 1 | xonix |
| [Boss shrinks with free space](taxonomy/field-enemies.md#boss-shrinks-with-free-space) | 1 | gals-panic |
| [Transforming main enemy](taxonomy/field-enemies.md#transforming-main-enemy) | 1 | qix |
| [Boss finished in a shooting phase](taxonomy/field-enemies.md#boss-finished-in-a-shooting-phase) | 1 | qix |
| [Enemies empower the boss](taxonomy/field-enemies.md#enemies-empower-the-boss) | 1 | other |
| [Fleeing last enemies](taxonomy/field-enemies.md#fleeing-last-enemies) | 1 | other |
| [Proximity shock](taxonomy/field-enemies.md#proximity-shock) | 1 | volfied |
| [Enemy released by capture that persists across levels](taxonomy/field-enemies.md#enemy-released-by-capture-that-persists-across-levels) | 1 | amidar-painter |
| [Leader kill wipes out followers](taxonomy/field-enemies.md#leader-kill-wipes-out-followers) | 1 | amidar-painter |
| [Trapped enemy leaves an invisible lethal spot](taxonomy/field-enemies.md#trapped-enemy-leaves-an-invisible-lethal-spot) | 1 | xonix |
| [Safe and lethal enemy parts](taxonomy/field-enemies.md#safe-and-lethal-enemy-parts) | 1 | other |
| [Creatures that prey on each other](taxonomy/field-enemies.md#creatures-that-prey-on-each-other) | 1 | qix |
| [Rival racing the player](taxonomy/field-enemies.md#rival-racing-the-player) | 1 | qix |
| [Colour-swap phasing](taxonomy/field-enemies.md#colour-swap-phasing) | 1 | qix |

## Edge and claimed-area enemies

Border patrollers (Sparx) are the dominant edge threat (62). They are often escalated by a timer or level counter into Super Sparx-style chasers that follow onto the trail (14). The stall Fuse (18) and the Volfied-style fuse lit when an enemy touches the line (8) cap how long a trail may stay open; instant death on line contact is stated as the harsher alternative in 2. A safe border and safe claimed ground are the baseline (13). That safety is broken by Xonix land enemies (11), enemies that cross both land and sea (5), edges that become dangerous (2), and territory eaters that turn claimed land back into open field (16). Threats aimed at the trail include trail chasers (7), trail hunters (10) and line cutters (7), and painter games have paint erasers (7). Ideas seen only once include a growing border enemy (Styx), a per-face trail guardian (Cubixx), a perimeter tracer that turns into a trail follower (Amidar), an enraged boss that destroys territory, enemies on claimed land that block completion, enemies that latch on and slow the trail, and a base to defend.

Details: [`taxonomy/edge-and-claimed-enemies.md`](taxonomy/edge-and-claimed-enemies.md).

| Family | Games | Lineages |
|---|---|---|
| [Border patrollers (Sparx)](taxonomy/edge-and-claimed-enemies.md#border-patrollers-sparx) | 62 | qix, xonix, volfied, gals-panic, other |
| [Stall fuse](taxonomy/edge-and-claimed-enemies.md#stall-fuse) | 18 | qix |
| [Territory eaters](taxonomy/edge-and-claimed-enemies.md#territory-eaters) | 16 | xonix, qix, volfied, io-territory, other |
| [Escalating and timer-released patrollers (Super Sparx)](taxonomy/edge-and-claimed-enemies.md#escalating-and-timer-released-patrollers-super-sparx) | 14 | qix, volfied, xonix, gals-panic |
| [Safe border and claimed ground](taxonomy/edge-and-claimed-enemies.md#safe-border-and-claimed-ground) | 13 | qix, xonix, volfied |
| [Land enemies on claimed ground](taxonomy/edge-and-claimed-enemies.md#land-enemies-on-claimed-ground) | 11 | xonix |
| [Trail hunters](taxonomy/edge-and-claimed-enemies.md#trail-hunters) | 10 | qix, xonix, volfied |
| [Enemy-triggered line fuse](taxonomy/edge-and-claimed-enemies.md#enemy-triggered-line-fuse) | 8 | volfied, qix |
| [Trail chasers](taxonomy/edge-and-claimed-enemies.md#trail-chasers) | 7 | xonix, qix, gals-panic, volfied |
| [Line cutters](taxonomy/edge-and-claimed-enemies.md#line-cutters) | 7 | other, volfied |
| [Paint erasers](taxonomy/edge-and-claimed-enemies.md#paint-erasers) | 7 | amidar-painter |
| [Claimed ground as a barrier](taxonomy/edge-and-claimed-enemies.md#claimed-ground-as-a-barrier) | 5 | other, volfied |
| [Board-crossing enemies](taxonomy/edge-and-claimed-enemies.md#board-crossing-enemies) | 5 | qix, xonix |
| [Rival raiders on held land](taxonomy/edge-and-claimed-enemies.md#rival-raiders-on-held-land) | 3 | qix, io-territory |
| [Instant death on line contact](taxonomy/edge-and-claimed-enemies.md#instant-death-on-line-contact) | 2 | volfied |
| [Edges that become dangerous](taxonomy/edge-and-claimed-enemies.md#edges-that-become-dangerous) | 2 | qix |
| [Border shooters](taxonomy/edge-and-claimed-enemies.md#border-shooters) | 2 | other |
| [Harmless vandals that damage claimed progress](taxonomy/edge-and-claimed-enemies.md#harmless-vandals-that-damage-claimed-progress) | 2 | xonix, amidar-painter |
| [Claimed border under attack](taxonomy/edge-and-claimed-enemies.md#claimed-border-under-attack) | 2 | other |
| [Growing border enemy](taxonomy/edge-and-claimed-enemies.md#growing-border-enemy) | 1 | qix |
| [Territorial trail guardian](taxonomy/edge-and-claimed-enemies.md#territorial-trail-guardian) | 1 | qix |
| [Perimeter tracer that turns into a trail follower](taxonomy/edge-and-claimed-enemies.md#perimeter-tracer-that-turns-into-a-trail-follower) | 1 | amidar-painter |
| [Trail-latching slowers](taxonomy/edge-and-claimed-enemies.md#trail-latching-slowers) | 1 | qix |
| [Enraged boss destroys territory](taxonomy/edge-and-claimed-enemies.md#enraged-boss-destroys-territory) | 1 | gals-panic |
| [Completion blockers on claimed land](taxonomy/edge-and-claimed-enemies.md#completion-blockers-on-claimed-land) | 1 | xonix |
| [Base to defend](taxonomy/edge-and-claimed-enemies.md#base-to-defend) | 1 | other |

## Terrain and geometry

Most fields are plain rectangles. The common additions are interior obstacles (28), non-rectangular outlines (18), lethal static traps (15) and moving or spreading hazards (12). 3D comes in two forms: flat rules drawn in 3D or isometric (12), and fields wrapped onto cubes, spheres or models (9). Only Jezz Cubed cuts a 3D volume, using planes. Pre-claimed starting territory (11) links the Gals Panic and io traditions, and io games also bring hex grids (6), real-world maps (6) and shrinking play areas (5). Other variations: field size as a setting (9), terrain that changes movement (7), fields larger than the screen (5), obstacles removed by enclosure (5), currents and gravity (4), cover (4), blockers placed by the player in painters (4) and portals (3). Wrap-around edges (2), layouts that change during play (2), procedural layouts (2) and fault lines (2) are rare. A one-dimensional field, a flowing field, a dual-screen split, doors that cycle on their own, and a lethal colour-coded field each appear once.

Details: [`taxonomy/terrain-and-geometry.md`](taxonomy/terrain-and-geometry.md).

| Family | Games | Lineages |
|---|---|---|
| [Interior obstacles and walls](taxonomy/terrain-and-geometry.md#interior-obstacles-and-walls) | 28 | qix, volfied, xonix, jezzball, gals-panic, io-territory, other |
| [Non-rectangular field outlines](taxonomy/terrain-and-geometry.md#non-rectangular-field-outlines) | 18 | qix, volfied, jezzball, io-territory |
| [Lethal static terrain and traps](taxonomy/terrain-and-geometry.md#lethal-static-terrain-and-traps) | 15 | qix, gals-panic, xonix, volfied, amidar-painter, other |
| [Moving, spawning and spreading hazards](taxonomy/terrain-and-geometry.md#moving-spawning-and-spreading-hazards) | 12 | qix, gals-panic, xonix, volfied, io-territory |
| [3D-rendered or isometric playfield](taxonomy/terrain-and-geometry.md#3d-rendered-or-isometric-playfield) | 12 | qix, xonix, jezzball, amidar-painter, other |
| [Pre-claimed starting territory](taxonomy/terrain-and-geometry.md#pre-claimed-starting-territory) | 11 | qix, gals-panic, io-territory |
| [Field wrapped on a 3D surface](taxonomy/terrain-and-geometry.md#field-wrapped-on-a-3d-surface) | 9 | qix, gals-panic, io-territory |
| [Field size and resolution](taxonomy/terrain-and-geometry.md#field-size-and-resolution) | 9 | xonix, jezzball, volfied, io-territory |
| [Movement-altering terrain](taxonomy/terrain-and-geometry.md#movement-altering-terrain) | 7 | qix, xonix, volfied, io-territory |
| [Hexagonal grid](taxonomy/terrain-and-geometry.md#hexagonal-grid) | 6 | io-territory |
| [Lane lattice of boxes](taxonomy/terrain-and-geometry.md#lane-lattice-of-boxes) | 6 | amidar-painter, gals-panic |
| [Real-world maps and locations](taxonomy/terrain-and-geometry.md#real-world-maps-and-locations) | 6 | io-territory, other |
| [Field boundary contact rules](taxonomy/terrain-and-geometry.md#field-boundary-contact-rules) | 6 | xonix, io-territory |
| [Field larger than the screen](taxonomy/terrain-and-geometry.md#field-larger-than-the-screen) | 5 | gals-panic, amidar-painter |
| [Shrinking play area](taxonomy/terrain-and-geometry.md#shrinking-play-area) | 5 | jezzball, io-territory, other |
| [Obstacles removed by enclosure](taxonomy/terrain-and-geometry.md#obstacles-removed-by-enclosure) | 5 | xonix, qix, gals-panic, volfied |
| [Force fields: currents and gravity](taxonomy/terrain-and-geometry.md#force-fields-currents-and-gravity) | 4 | xonix, volfied, jezzball |
| [Cover and concealment terrain](taxonomy/terrain-and-geometry.md#cover-and-concealment-terrain) | 4 | volfied, xonix, amidar-painter |
| [Player-placed blockers](taxonomy/terrain-and-geometry.md#player-placed-blockers) | 4 | amidar-painter |
| [Terrain used as a weapon](taxonomy/terrain-and-geometry.md#terrain-used-as-a-weapon) | 4 | amidar-painter, other |
| [Portals and warps](taxonomy/terrain-and-geometry.md#portals-and-warps) | 3 | amidar-painter, qix, io-territory |
| [Trail-breaking terrain](taxonomy/terrain-and-geometry.md#trail-breaking-terrain) | 3 | jezzball, xonix, volfied |
| [Designated capture anchors](taxonomy/terrain-and-geometry.md#designated-capture-anchors) | 2 | gals-panic, xonix |
| [Cut-resistant sections](taxonomy/terrain-and-geometry.md#cut-resistant-sections) | 2 | qix, jezzball |
| [Regrowing terrain](taxonomy/terrain-and-geometry.md#regrowing-terrain) | 2 | other, xonix |
| [Decaying claimed area](taxonomy/terrain-and-geometry.md#decaying-claimed-area) | 2 | jezzball |
| [Hidden or darkened field areas](taxonomy/terrain-and-geometry.md#hidden-or-darkened-field-areas) | 2 | qix, amidar-painter |
| [Keys, gates and remote triggers](taxonomy/terrain-and-geometry.md#keys-gates-and-remote-triggers) | 2 | qix |
| [Wrap-around edges](taxonomy/terrain-and-geometry.md#wrap-around-edges) | 2 | qix, amidar-painter |
| [Layout that changes during play](taxonomy/terrain-and-geometry.md#layout-that-changes-during-play) | 2 | io-territory, other |
| [Procedural or randomised layout](taxonomy/terrain-and-geometry.md#procedural-or-randomised-layout) | 2 | jezzball, other |
| [Fault lines](taxonomy/terrain-and-geometry.md#fault-lines) | 2 | other |
| [Capturable map structures](taxonomy/terrain-and-geometry.md#capturable-map-structures) | 2 | io-territory |
| [3D volume cut by planes](taxonomy/terrain-and-geometry.md#3d-volume-cut-by-planes) | 1 | jezzball |
| [Colour-coded lethal field](taxonomy/terrain-and-geometry.md#colour-coded-lethal-field) | 1 | xonix |
| [One-dimensional field](taxonomy/terrain-and-geometry.md#one-dimensional-field) | 1 | xonix |
| [Impassable water with sea lanes](taxonomy/terrain-and-geometry.md#impassable-water-with-sea-lanes) | 1 | io-territory |
| [Terrain dividing versus sides](taxonomy/terrain-and-geometry.md#terrain-dividing-versus-sides) | 1 | other |
| [Dual-screen split field](taxonomy/terrain-and-geometry.md#dual-screen-split-field) | 1 | other |
| [Flowing field](taxonomy/terrain-and-geometry.md#flowing-field) | 1 | other |
| [Self-cycling doors](taxonomy/terrain-and-geometry.md#self-cycling-doors) | 1 | other |
| [Carvable block field with no safe edge](taxonomy/terrain-and-geometry.md#carvable-block-field-with-no-safe-edge) | 1 | other |
| [Fixed enemy tracks](taxonomy/terrain-and-geometry.md#fixed-enemy-tracks) | 1 | qix |
| [Player-only blockers](taxonomy/terrain-and-geometry.md#player-only-blockers) | 1 | xonix |

## Items and power-ups

Power-ups follow a stable core: speed boost (56), field pickups collected by touch (53), enemy freeze (49), shields and invincibility (46), extra lives (35), score collectibles (31), enemy slow-down (28), area bombs and enemy wipes (26) and direct weapons (24). Volfied's boxes opened by enclosure (20) and items revealed by captures (15) tie items to the act of capturing. Harmful pickups (17) and extra time (16) are common secondary types. Meta-style delivery is mostly a recent development: pre-run boosters (8), on-demand skills (8), allied helpers (8), levelling driven by capture within a match (3), reward crates (3) and upgrade drafts (2). One-off ideas include a second marker (Super Qix), swapping claimed and unclaimed cells (Dancing Eyes), absorbing an enemy's power and detonating shapes (Orbis), a weapon that unlocks only while territory is held, catch-up pickups for struggling players (Xonix KolibriOS), ticking bomb pickups (Mr. TNT) and power-ups that scatter on death and can be collected again (Gal Pani X).

Details: [`taxonomy/items-and-power-ups.md`](taxonomy/items-and-power-ups.md).

| Family | Games | Lineages |
|---|---|---|
| [Player speed boost](taxonomy/items-and-power-ups.md#player-speed-boost) | 56 | qix, xonix, volfied, gals-panic, io-territory |
| [Field pickups collected by touch](taxonomy/items-and-power-ups.md#field-pickups-collected-by-touch) | 53 | qix, xonix, volfied, jezzball, gals-panic, io-territory, amidar-painter |
| [Enemy freeze (time stop)](taxonomy/items-and-power-ups.md#enemy-freeze-time-stop) | 49 | qix, xonix, volfied, jezzball, gals-panic, io-territory, amidar-painter, other |
| [Shield and invincibility](taxonomy/items-and-power-ups.md#shield-and-invincibility) | 46 | qix, xonix, volfied, jezzball, gals-panic, io-territory, amidar-painter |
| [Extra lives and revives](taxonomy/items-and-power-ups.md#extra-lives-and-revives) | 35 | qix, xonix, volfied, jezzball, gals-panic, io-territory |
| [Score and currency collectibles](taxonomy/items-and-power-ups.md#score-and-currency-collectibles) | 31 | qix, xonix, volfied, jezzball, gals-panic, io-territory, amidar-painter, other |
| [Enemy slow-down](taxonomy/items-and-power-ups.md#enemy-slow-down) | 28 | qix, xonix, volfied, jezzball, gals-panic, io-territory, amidar-painter |
| [Area bombs and enemy wipes](taxonomy/items-and-power-ups.md#area-bombs-and-enemy-wipes) | 26 | qix, xonix, volfied, jezzball, gals-panic |
| [Direct-attack weapons](taxonomy/items-and-power-ups.md#direct-attack-weapons) | 24 | qix, xonix, volfied, gals-panic, other |
| [Enclosure-collected items and boxes](taxonomy/items-and-power-ups.md#enclosure-collected-items-and-boxes) | 20 | qix, xonix, volfied, jezzball, gals-panic, io-territory, other |
| [Harmful pickups and power-downs](taxonomy/items-and-power-ups.md#harmful-pickups-and-power-downs) | 17 | qix, xonix, volfied, jezzball, gals-panic, amidar-painter |
| [Extra time and timer refills](taxonomy/items-and-power-ups.md#extra-time-and-timer-refills) | 16 | qix, xonix, volfied, gals-panic, io-territory, other |
| [Items revealed or generated by capture](taxonomy/items-and-power-ups.md#items-revealed-or-generated-by-capture) | 15 | qix, xonix, volfied, gals-panic, io-territory, amidar-painter, other |
| [Eat-the-enemies reversal](taxonomy/items-and-power-ups.md#eat-the-enemies-reversal) | 8 | xonix, amidar-painter |
| [Pre-run boosters and loadouts](taxonomy/items-and-power-ups.md#pre-run-boosters-and-loadouts) | 8 | qix, xonix, volfied, jezzball, io-territory |
| [On-demand powers and upgradable skills](taxonomy/items-and-power-ups.md#on-demand-powers-and-upgradable-skills) | 8 | xonix, gals-panic |
| [Allied helpers](taxonomy/items-and-power-ups.md#allied-helpers) | 8 | qix, xonix, volfied, amidar-painter, other |
| [Enemy drops](taxonomy/items-and-power-ups.md#enemy-drops) | 7 | qix, jezzball, gals-panic, amidar-painter |
| [Placeable mines and traps](taxonomy/items-and-power-ups.md#placeable-mines-and-traps) | 7 | qix, volfied, io-territory, amidar-painter |
| [Laser pickup](taxonomy/items-and-power-ups.md#laser-pickup) | 6 | qix, volfied |
| [Limited escape charges](taxonomy/items-and-power-ups.md#limited-escape-charges) | 6 | amidar-painter |
| [Set collection (letters and tokens)](taxonomy/items-and-power-ups.md#set-collection-letters-and-tokens) | 5 | qix, gals-panic, other |
| [Character- and route-bound abilities](taxonomy/items-and-power-ups.md#character--and-route-bound-abilities) | 5 | xonix, gals-panic, io-territory |
| [Limited attack ammunition](taxonomy/items-and-power-ups.md#limited-attack-ammunition) | 5 | qix, gals-panic, amidar-painter |
| [Capture-tool enhancers](taxonomy/items-and-power-ups.md#capture-tool-enhancers) | 5 | jezzball, other |
| [Stun effects](taxonomy/items-and-power-ups.md#stun-effects) | 5 | volfied, jezzball, gals-panic, other |
| [Enemy direction reversal](taxonomy/items-and-power-ups.md#enemy-direction-reversal) | 4 | qix, xonix |
| [Teleport](taxonomy/items-and-power-ups.md#teleport) | 4 | io-territory, amidar-painter |
| [Level skip and instant clear](taxonomy/items-and-power-ups.md#level-skip-and-instant-clear) | 4 | qix, xonix, jezzball |
| [Boss-killer weapon](taxonomy/items-and-power-ups.md#boss-killer-weapon) | 3 | volfied |
| [Reward crates](taxonomy/items-and-power-ups.md#reward-crates) | 3 | qix |
| [Capture-driven in-match levelling](taxonomy/items-and-power-ups.md#capture-driven-in-match-levelling) | 3 | io-territory |
| [Power-up timers and duration stat](taxonomy/items-and-power-ups.md#power-up-timers-and-duration-stat) | 3 | qix |
| [Area-granting and capture-shape power-ups](taxonomy/items-and-power-ups.md#area-granting-and-capture-shape-power-ups) | 3 | jezzball, gals-panic |
| [Herding lures and nets](taxonomy/items-and-power-ups.md#herding-lures-and-nets) | 3 | qix, jezzball, other |
| [Threat-specific counters](taxonomy/items-and-power-ups.md#threat-specific-counters) | 3 | jezzball |
| [Rival-disrupting versus power-ups](taxonomy/items-and-power-ups.md#rival-disrupting-versus-power-ups) | 3 | xonix, io-territory, other |
| [Map reveal and radar](taxonomy/items-and-power-ups.md#map-reveal-and-radar) | 3 | io-territory |
| [State-cycling items](taxonomy/items-and-power-ups.md#state-cycling-items) | 2 | gals-panic, amidar-painter |
| [Milestone-earned power-ups](taxonomy/items-and-power-ups.md#milestone-earned-power-ups) | 2 | xonix |
| [Meter-charged powers](taxonomy/items-and-power-ups.md#meter-charged-powers) | 2 | qix, io-territory |
| [Upgrade draft during a run](taxonomy/items-and-power-ups.md#upgrade-draft-during-a-run) | 2 | io-territory |
| [Stacking stat pickups](taxonomy/items-and-power-ups.md#stacking-stat-pickups) | 2 | qix |
| [Siege weapons against turrets](taxonomy/items-and-power-ups.md#siege-weapons-against-turrets) | 2 | qix |
| [Stealth and evasion items](taxonomy/items-and-power-ups.md#stealth-and-evasion-items) | 2 | xonix, io-territory |
| [Catch-up pickups](taxonomy/items-and-power-ups.md#catch-up-pickups) | 1 | xonix |
| [Ticking bomb pickups](taxonomy/items-and-power-ups.md#ticking-bomb-pickups) | 1 | amidar-painter |
| [Territory-gated weapon](taxonomy/items-and-power-ups.md#territory-gated-weapon) | 1 | qix |
| [Twin markers](taxonomy/items-and-power-ups.md#twin-markers) | 1 | qix |
| [Claim inversion](taxonomy/items-and-power-ups.md#claim-inversion) | 1 | gals-panic |
| [Absorb enemy powers](taxonomy/items-and-power-ups.md#absorb-enemy-powers) | 1 | jezzball |
| [Detonating shapes](taxonomy/items-and-power-ups.md#detonating-shapes) | 1 | jezzball |
| [Ball-activated tool marbles](taxonomy/items-and-power-ups.md#ball-activated-tool-marbles) | 1 | qix |
| [Scatter-on-death recovery](taxonomy/items-and-power-ups.md#scatter-on-death-recovery) | 1 | gals-panic |

## Scoring and risk

Most scoring rewards the risk of the open line: bonuses for each percent above the quota (28), big single-capture bonuses (24), slow-draw multipliers (14, all in the Qix lineage), and clear-speed or time bonuses (22). Reward content gated on performance (19) and per-level star ratings (18) dominate picture-reveal and mobile games. Common add-ons are capture combos (11), kill chains (8), rewards for splitting bosses apart (8), bounties per captured enemy (7) and situational multipliers (5); painters use printed box values and tiered segment scoring. Life systems include extra lives at score thresholds (13), health meters (9) and the score itself used as the life pool (5). Gals Panic's mood meter (6) and post-stage lotteries (3) are specific to that lineage. Choosing to push past the quota or bank appears in 6 games. Rare risk-shaping rules include a penalty for oversized captures, penalties for exploits, choosing a risk tier before each cut, a jackpot for trapping the boss with the first cut, a multiplier that cycles over time (Styx), a hidden grid of scoring points, and a saturating score counter, one game each.

Details: [`taxonomy/scoring-and-risk.md`](taxonomy/scoring-and-risk.md).

| Family | Games | Lineages |
|---|---|---|
| [Overfill percentage bonus](taxonomy/scoring-and-risk.md#overfill-percentage-bonus) | 28 | qix, xonix, volfied, jezzball |
| [Big single-capture bonus](taxonomy/scoring-and-risk.md#big-single-capture-bonus) | 24 | qix, xonix, jezzball, gals-panic, other |
| [Clear-speed bonus](taxonomy/scoring-and-risk.md#clear-speed-bonus) | 22 | qix, xonix, jezzball, amidar-painter, gals-panic |
| [Performance-gated reward content](taxonomy/scoring-and-risk.md#performance-gated-reward-content) | 19 | qix, gals-panic |
| [Per-level star ratings](taxonomy/scoring-and-risk.md#per-level-star-ratings) | 18 | xonix, jezzball, gals-panic, io-territory, qix, volfied |
| [Slow-draw score multiplier](taxonomy/scoring-and-risk.md#slow-draw-score-multiplier) | 14 | qix |
| [Extra lives at score thresholds](taxonomy/scoring-and-risk.md#extra-lives-at-score-thresholds) | 13 | qix, xonix, amidar-painter |
| [Capture combo chain](taxonomy/scoring-and-risk.md#capture-combo-chain) | 11 | qix, xonix, volfied, gals-panic, other |
| [Area-proportional scoring](taxonomy/scoring-and-risk.md#area-proportional-scoring) | 10 | volfied, xonix, jezzball, other |
| [Coverage-threshold prize](taxonomy/scoring-and-risk.md#coverage-threshold-prize) | 9 | qix, xonix, volfied |
| [Territory-share score](taxonomy/scoring-and-risk.md#territory-share-score) | 9 | io-territory |
| [Health meter instead of one-hit death](taxonomy/scoring-and-risk.md#health-meter-instead-of-one-hit-death) | 9 | qix |
| [Long-excursion exposure risk](taxonomy/scoring-and-risk.md#long-excursion-exposure-risk) | 8 | volfied, io-territory |
| [Boss-split reward](taxonomy/scoring-and-risk.md#boss-split-reward) | 8 | qix, xonix, volfied |
| [Escalating kill chain](taxonomy/scoring-and-risk.md#escalating-kill-chain) | 8 | amidar-painter, other, gals-panic, io-territory |
| [Enemy-capture bounty](taxonomy/scoring-and-risk.md#enemy-capture-bounty) | 7 | qix, xonix |
| [Life budget](taxonomy/scoring-and-risk.md#life-budget) | 7 | qix, amidar-painter |
| [Push past the quota or bank](taxonomy/scoring-and-risk.md#push-past-the-quota-or-bank) | 6 | xonix, volfied, other, gals-panic |
| [Mood meter](taxonomy/scoring-and-risk.md#mood-meter) | 6 | gals-panic |
| [Multi-enemy single-capture bonus](taxonomy/scoring-and-risk.md#multi-enemy-single-capture-bonus) | 5 | xonix, other |
| [Rival-kill bonus](taxonomy/scoring-and-risk.md#rival-kill-bonus) | 5 | io-territory, xonix |
| [Context score multipliers](taxonomy/scoring-and-risk.md#context-score-multipliers) | 5 | qix, jezzball |
| [Score as the life pool](taxonomy/scoring-and-risk.md#score-as-the-life-pool) | 5 | qix, jezzball |
| [Extra lives from progress](taxonomy/scoring-and-risk.md#extra-lives-from-progress) | 5 | qix, xonix |
| [Marked bonus regions](taxonomy/scoring-and-risk.md#marked-bonus-regions) | 4 | amidar-painter, xonix |
| [Per-box printed values](taxonomy/scoring-and-risk.md#per-box-printed-values) | 4 | amidar-painter |
| [Lives-left bonus](taxonomy/scoring-and-risk.md#lives-left-bonus) | 3 | jezzball |
| [Tiered segment and box scoring](taxonomy/scoring-and-risk.md#tiered-segment-and-box-scoring) | 3 | amidar-painter |
| [Post-stage lottery](taxonomy/scoring-and-risk.md#post-stage-lottery) | 3 | gals-panic |
| [Peak-territory score](taxonomy/scoring-and-risk.md#peak-territory-score) | 3 | io-territory |
| [Multi-metric run score](taxonomy/scoring-and-risk.md#multi-metric-run-score) | 3 | io-territory, other |
| [Exposure-scaled score multiplier](taxonomy/scoring-and-risk.md#exposure-scaled-score-multiplier) | 2 | qix |
| [Tight-trap scoring](taxonomy/scoring-and-risk.md#tight-trap-scoring) | 2 | jezzball |
| [Graze and near-miss bonus](taxonomy/scoring-and-risk.md#graze-and-near-miss-bonus) | 2 | gals-panic, qix |
| [Fewest-cuts scoring](taxonomy/scoring-and-risk.md#fewest-cuts-scoring) | 2 | jezzball |
| [Score spent on safety actions](taxonomy/scoring-and-risk.md#score-spent-on-safety-actions) | 2 | amidar-painter, xonix |
| [No-fail play](taxonomy/scoring-and-risk.md#no-fail-play) | 2 | qix |
| [Capture-size penalty](taxonomy/scoring-and-risk.md#capture-size-penalty) | 1 | qix |
| [Anti-exploit score penalties](taxonomy/scoring-and-risk.md#anti-exploit-score-penalties) | 1 | qix |
| [Pre-cut risk tier choice](taxonomy/scoring-and-risk.md#pre-cut-risk-tier-choice) | 1 | qix |
| [Containment at time-out](taxonomy/scoring-and-risk.md#containment-at-time-out) | 1 | other |
| [First-cut boss jackpot](taxonomy/scoring-and-risk.md#first-cut-boss-jackpot) | 1 | volfied |
| [Minimal-claim feat bonus](taxonomy/scoring-and-risk.md#minimal-claim-feat-bonus) | 1 | volfied |
| [Time-cycling score multiplier](taxonomy/scoring-and-risk.md#time-cycling-score-multiplier) | 1 | qix |
| [Territory-scaled score multiplier](taxonomy/scoring-and-risk.md#territory-scaled-score-multiplier) | 1 | io-territory |
| [Multi-face cut multiplier](taxonomy/scoring-and-risk.md#multi-face-cut-multiplier) | 1 | qix |
| [Paint upgrade](taxonomy/scoring-and-risk.md#paint-upgrade) | 1 | qix |
| [Multiplicative score formula](taxonomy/scoring-and-risk.md#multiplicative-score-formula) | 1 | other |
| [Box value drain](taxonomy/scoring-and-risk.md#box-value-drain) | 1 | amidar-painter |
| [Simultaneous box-capture multiplier](taxonomy/scoring-and-risk.md#simultaneous-box-capture-multiplier) | 1 | amidar-painter |
| [Self-closed loop bonus](taxonomy/scoring-and-risk.md#self-closed-loop-bonus) | 1 | other |
| [Penalty targets](taxonomy/scoring-and-risk.md#penalty-targets) | 1 | other |
| [Hidden point grid](taxonomy/scoring-and-risk.md#hidden-point-grid) | 1 | xonix |
| [Bounce-escalating ball](taxonomy/scoring-and-risk.md#bounce-escalating-ball) | 1 | other |
| [Bullets into points](taxonomy/scoring-and-risk.md#bullets-into-points) | 1 | gals-panic |
| [Defusable timed bombs](taxonomy/scoring-and-risk.md#defusable-timed-bombs) | 1 | qix |
| [Saturating score counter](taxonomy/scoring-and-risk.md#saturating-score-counter) | 1 | jezzball |
| [Post-hit invulnerability](taxonomy/scoring-and-risk.md#post-hit-invulnerability) | 1 | qix |

## Level structure and progression

The default structure is a per-level enemy ramp (85) toward an area threshold, with new enemy types or rules introduced in stages (25), a rising threshold (15), and a looped or capped difficulty ceiling (11). Common scaffolding includes worlds or themed groups (41), boss stages at intervals (28), per-level ratings (26), bonus rounds (24), selectable difficulty (24), fixed-length handcrafted campaigns (23) and a lives budget for the whole run (23). Picture lineages organise play by character arcs (15) and free choice of stage order (11); branching paths are rarer (5). Alternative clear goals are a minority: full coverage (18, mostly painters and io), capturing every designated target (15), alternate win routes (7), defeating or separating enemies (7), collecting items (7) and score targets (3). Rare structures include dynamic rank (1), procedural levels (2), stages generated offline and verified by simulation (Ink Fill), a clear for simply surviving the timer (Clax), a quiz that moves the meter, random side objectives, a build-and-battle phase cycle (Rampart) and a meta-picture filled in across stages.

Details: [`taxonomy/level-structure-and-progression.md`](taxonomy/level-structure-and-progression.md).

| Family | Games | Lineages |
|---|---|---|
| [Per-level enemy ramp](taxonomy/level-structure-and-progression.md#per-level-enemy-ramp) | 85 | qix, xonix, jezzball, gals-panic, io-territory, amidar-painter, other |
| [Worlds, chapters and themed stage groups](taxonomy/level-structure-and-progression.md#worlds-chapters-and-themed-stage-groups) | 41 | qix, xonix, volfied, jezzball, io-territory |
| [Narrative frame and story campaign](taxonomy/level-structure-and-progression.md#narrative-frame-and-story-campaign) | 31 | qix, volfied, xonix, jezzball, gals-panic, io-territory |
| [Boss stages at intervals, world ends and finale](taxonomy/level-structure-and-progression.md#boss-stages-at-intervals-world-ends-and-finale) | 28 | qix, volfied, jezzball, gals-panic |
| [Area-percentage clear threshold](taxonomy/level-structure-and-progression.md#area-percentage-clear-threshold) | 27 | qix, volfied, xonix, io-territory |
| [Per-level ratings](taxonomy/level-structure-and-progression.md#per-level-ratings) | 26 | qix, volfied, xonix, jezzball |
| [Staged introduction of new enemies, hazards and rules](taxonomy/level-structure-and-progression.md#staged-introduction-of-new-enemies-hazards-and-rules) | 25 | qix, xonix, volfied, io-territory, other |
| [Bonus rounds and interstitial mini-games](taxonomy/level-structure-and-progression.md#bonus-rounds-and-interstitial-mini-games) | 24 | qix, gals-panic, amidar-painter, other |
| [Selectable difficulty and rule customization](taxonomy/level-structure-and-progression.md#selectable-difficulty-and-rule-customization) | 24 | qix, volfied, jezzball, gals-panic |
| [Fixed-length handcrafted campaign](taxonomy/level-structure-and-progression.md#fixed-length-handcrafted-campaign) | 23 | qix, xonix, jezzball |
| [Run-wide lives budget](taxonomy/level-structure-and-progression.md#run-wide-lives-budget) | 23 | xonix, volfied, jezzball, gals-panic |
| [Full-coverage clear](taxonomy/level-structure-and-progression.md#full-coverage-clear) | 18 | amidar-painter, io-territory, other |
| [Rising clear threshold](taxonomy/level-structure-and-progression.md#rising-clear-threshold) | 15 | qix, gals-panic |
| [Capture every designated target](taxonomy/level-structure-and-progression.md#capture-every-designated-target) | 15 | qix, other |
| [Character arc of rounds](taxonomy/level-structure-and-progression.md#character-arc-of-rounds) | 15 | gals-panic, qix, other |
| [Linear unlock ladder](taxonomy/level-structure-and-progression.md#linear-unlock-ladder) | 13 | qix, io-territory |
| [Difficulty ceiling and looping](taxonomy/level-structure-and-progression.md#difficulty-ceiling-and-looping) | 11 | qix, xonix, jezzball |
| [Free choice of stage or character order](taxonomy/level-structure-and-progression.md#free-choice-of-stage-or-character-order) | 11 | gals-panic, qix |
| [Continues](taxonomy/level-structure-and-progression.md#continues) | 9 | qix, volfied, gals-panic, io-territory, other |
| [Alternate win routes besides the area goal](taxonomy/level-structure-and-progression.md#alternate-win-routes-besides-the-area-goal) | 7 | qix, volfied, gals-panic, other |
| [Defeat, trap or separate the enemies](taxonomy/level-structure-and-progression.md#defeat-trap-or-separate-the-enemies) | 7 | qix |
| [Collect items or a key to clear](taxonomy/level-structure-and-progression.md#collect-items-or-a-key-to-clear) | 7 | amidar-painter, qix, xonix |
| [Boss in every stage](taxonomy/level-structure-and-progression.md#boss-in-every-stage) | 7 | qix, volfied |
| [Level select and replay of reached stages](taxonomy/level-structure-and-progression.md#level-select-and-replay-of-reached-stages) | 7 | qix, jezzball |
| [Post-clear and milestone unlocks](taxonomy/level-structure-and-progression.md#post-clear-and-milestone-unlocks) | 7 | qix, jezzball, gals-panic |
| [Per-level lives scaled to the level](taxonomy/level-structure-and-progression.md#per-level-lives-scaled-to-the-level) | 7 | jezzball |
| [Alternating or varied stage types](taxonomy/level-structure-and-progression.md#alternating-or-varied-stage-types) | 6 | amidar-painter, gals-panic, io-territory, other |
| [Overworld and level maps](taxonomy/level-structure-and-progression.md#overworld-and-level-maps) | 6 | qix, xonix, jezzball, gals-panic |
| [Instant level retry](taxonomy/level-structure-and-progression.md#instant-level-retry) | 6 | qix, jezzball, io-territory |
| [Last-standing win](taxonomy/level-structure-and-progression.md#last-standing-win) | 5 | io-territory |
| [Branching stage paths](taxonomy/level-structure-and-progression.md#branching-stage-paths) | 5 | gals-panic, volfied |
| [Secret stages, characters and between-level extras](taxonomy/level-structure-and-progression.md#secret-stages-characters-and-between-level-extras) | 5 | jezzball, gals-panic, qix |
| [Tutorials, practice and level hints](taxonomy/level-structure-and-progression.md#tutorials-practice-and-level-hints) | 5 | xonix, volfied, io-territory |
| [Letter collection](taxonomy/level-structure-and-progression.md#letter-collection) | 4 | qix, other |
| [Checkpoints and soft failure](taxonomy/level-structure-and-progression.md#checkpoints-and-soft-failure) | 4 | qix, jezzball |
| [Health gauge instead of one-hit death](taxonomy/level-structure-and-progression.md#health-gauge-instead-of-one-hit-death) | 4 | volfied, other |
| [Score or gauge target clear](taxonomy/level-structure-and-progression.md#score-or-gauge-target-clear) | 3 | qix, xonix |
| [Exit gate and optional overstay](taxonomy/level-structure-and-progression.md#exit-gate-and-optional-overstay) | 3 | volfied, other |
| [Bad-image forced replay](taxonomy/level-structure-and-progression.md#bad-image-forced-replay) | 3 | gals-panic |
| [Level passwords and saved progress](taxonomy/level-structure-and-progression.md#level-passwords-and-saved-progress) | 3 | amidar-painter, xonix, volfied |
| [Reach a line or zone](taxonomy/level-structure-and-progression.md#reach-a-line-or-zone) | 2 | qix, io-territory |
| [Level skip](taxonomy/level-structure-and-progression.md#level-skip) | 2 | qix, xonix |
| [Star-gated unlocks](taxonomy/level-structure-and-progression.md#star-gated-unlocks) | 2 | volfied, xonix |
| [Procedurally generated levels](taxonomy/level-structure-and-progression.md#procedurally-generated-levels) | 2 | qix, jezzball |
| [Branching story by results](taxonomy/level-structure-and-progression.md#branching-story-by-results) | 2 | gals-panic |
| [Timer-survival fallback clear](taxonomy/level-structure-and-progression.md#timer-survival-fallback-clear) | 1 | xonix |
| [Quiz that moves the meter](taxonomy/level-structure-and-progression.md#quiz-that-moves-the-meter) | 1 | gals-panic |
| [Offline-generated, simulation-verified stages](taxonomy/level-structure-and-progression.md#offline-generated-simulation-verified-stages) | 1 | qix |
| [Dynamic rank](taxonomy/level-structure-and-progression.md#dynamic-rank) | 1 | gals-panic |
| [Random side objectives](taxonomy/level-structure-and-progression.md#random-side-objectives) | 1 | gals-panic |
| [Rewards carried into a host game](taxonomy/level-structure-and-progression.md#rewards-carried-into-a-host-game) | 1 | other |
| [Meta-picture from cleared stages](taxonomy/level-structure-and-progression.md#meta-picture-from-cleared-stages) | 1 | gals-panic |
| [Run collection goal](taxonomy/level-structure-and-progression.md#run-collection-goal) | 1 | gals-panic |
| [Build-battle phase cycle](taxonomy/level-structure-and-progression.md#build-battle-phase-cycle) | 1 | other |

## Reveal and presentation

The hidden-picture reveal is the largest presentation family (127) and spans every lineage, not only Gals Panic. Variants include silhouette targets (17), restoring a degraded image (7), themed cover layers (10), and two-layer or reverse reveals (2 each). Payoffs include reward showcases on clear (15), animated or interactive rewards (13), galleries (12), increasingly explicit images (6), and explicitness tiers or safe modes (10). Non-adult reveals use photos, paintings and postcards with facts (3), or pictures the player supplies (4). Elsewhere, the abstract roles are reskinned into a theme (19), and games add progress HUDs (17), palettes tied to progression (7), portrait playfields (7), voice acting (7), 3D rendering of flat rules (7) and screen-shake or similar feedback on big moves (7). Accessibility and audio-reactive presentation barely appear: enemies coded by shape for players without colour vision, music that intensifies with danger, spotlight darkness and shuffled picture order each appear once.

Details: [`taxonomy/reveal-and-presentation.md`](taxonomy/reveal-and-presentation.md).

| Family | Games | Lineages |
|---|---|---|
| [Hidden-picture reveal](taxonomy/reveal-and-presentation.md#hidden-picture-reveal) | 127 | qix, volfied, xonix, jezzball, gals-panic, amidar-painter, other |
| [Themed reskin of capture roles](taxonomy/reveal-and-presentation.md#themed-reskin-of-capture-roles) | 19 | qix, xonix |
| [Silhouette target display](taxonomy/reveal-and-presentation.md#silhouette-target-display) | 17 | gals-panic, other |
| [Progress HUD](taxonomy/reveal-and-presentation.md#progress-hud) | 17 | qix, xonix, volfied, gals-panic, amidar-painter |
| [Clear reward showcase](taxonomy/reveal-and-presentation.md#clear-reward-showcase) | 15 | qix, gals-panic |
| [Animated or interactive reward](taxonomy/reveal-and-presentation.md#animated-or-interactive-reward) | 13 | gals-panic, qix |
| [Gallery and collection unlocks](taxonomy/reveal-and-presentation.md#gallery-and-collection-unlocks) | 12 | qix, xonix, gals-panic |
| [Themed cover layer](taxonomy/reveal-and-presentation.md#themed-cover-layer) | 10 | gals-panic, qix |
| [Explicitness tiers and safe modes](taxonomy/reveal-and-presentation.md#explicitness-tiers-and-safe-modes) | 10 | gals-panic, qix |
| [Restoration reveal (before/after)](taxonomy/reveal-and-presentation.md#restoration-reveal-beforeafter) | 7 | qix |
| [Progression-tied themes and palettes](taxonomy/reveal-and-presentation.md#progression-tied-themes-and-palettes) | 7 | qix, jezzball, gals-panic |
| [Impact juice for big moves and kills](taxonomy/reveal-and-presentation.md#impact-juice-for-big-moves-and-kills) | 7 | qix, io-territory |
| [3D rendering of flat rules](taxonomy/reveal-and-presentation.md#3d-rendering-of-flat-rules) | 7 | qix, xonix, jezzball, io-territory |
| [Portrait playfield](taxonomy/reveal-and-presentation.md#portrait-playfield) | 7 | qix, gals-panic |
| [Voiced characters](taxonomy/reveal-and-presentation.md#voiced-characters) | 7 | qix, gals-panic |
| [Escalating reward images](taxonomy/reveal-and-presentation.md#escalating-reward-images) | 6 | qix, xonix, gals-panic |
| [Painted-state coding and completion feedback](taxonomy/reveal-and-presentation.md#painted-state-coding-and-completion-feedback) | 6 | amidar-painter |
| [Cosmetic-linked territory colour](taxonomy/reveal-and-presentation.md#cosmetic-linked-territory-colour) | 6 | io-territory |
| [Colour-coded claims](taxonomy/reveal-and-presentation.md#colour-coded-claims) | 5 | qix |
| [End-of-match stats screen](taxonomy/reveal-and-presentation.md#end-of-match-stats-screen) | 5 | io-territory |
| [Code-generated art and audio](taxonomy/reveal-and-presentation.md#code-generated-art-and-audio) | 5 | qix, xonix |
| [Performance-gated bonus reward](taxonomy/reveal-and-presentation.md#performance-gated-bonus-reward) | 4 | xonix, qix, gals-panic |
| [Player-chosen picture](taxonomy/reveal-and-presentation.md#player-chosen-picture) | 4 | xonix, volfied, gals-panic |
| [Claimed land transforms into themed terrain](taxonomy/reveal-and-presentation.md#claimed-land-transforms-into-themed-terrain) | 4 | xonix |
| [Camera framing and control](taxonomy/reveal-and-presentation.md#camera-framing-and-control) | 4 | qix, xonix |
| [Bad-image swap](taxonomy/reveal-and-presentation.md#bad-image-swap) | 3 | gals-panic |
| [Facts attached to reveals](taxonomy/reveal-and-presentation.md#facts-attached-to-reveals) | 3 | qix |
| [Minimap](taxonomy/reveal-and-presentation.md#minimap) | 3 | io-territory |
| [Text-mode / ASCII presentation](taxonomy/reveal-and-presentation.md#text-mode--ascii-presentation) | 3 | qix, xonix |
| [1-bit / two-colour presentation](taxonomy/reveal-and-presentation.md#1-bit--two-colour-presentation) | 3 | xonix |
| [CRT look](taxonomy/reveal-and-presentation.md#crt-look) | 3 | qix, io-territory |
| [Two-layer reveal](taxonomy/reveal-and-presentation.md#two-layer-reveal) | 2 | qix, gals-panic |
| [Meta-picture across rounds](taxonomy/reveal-and-presentation.md#meta-picture-across-rounds) | 2 | qix |
| [Reverse reveal (claims cover the picture)](taxonomy/reveal-and-presentation.md#reverse-reveal-claims-cover-the-picture) | 2 | xonix |
| [Alternating stage casts](taxonomy/reveal-and-presentation.md#alternating-stage-casts) | 2 | amidar-painter |
| [Configurable colour scheme](taxonomy/reveal-and-presentation.md#configurable-colour-scheme) | 2 | xonix |
| [Capture and level-transition animations](taxonomy/reveal-and-presentation.md#capture-and-level-transition-animations) | 2 | xonix |
| [Neon vector style](taxonomy/reveal-and-presentation.md#neon-vector-style) | 2 | qix |
| [Shuffled picture order](taxonomy/reveal-and-presentation.md#shuffled-picture-order) | 1 | qix |
| [Shape-coded enemies](taxonomy/reveal-and-presentation.md#shape-coded-enemies) | 1 | qix |
| [Compact micro window](taxonomy/reveal-and-presentation.md#compact-micro-window) | 1 | jezzball |
| [Spotlight darkness](taxonomy/reveal-and-presentation.md#spotlight-darkness) | 1 | jezzball |
| [Danger-reactive music](taxonomy/reveal-and-presentation.md#danger-reactive-music) | 1 | volfied |

## Multiplayer and competition

Score tables are the most common form of competition: online leaderboards (37) and local high-score tables (30), plus tables split by mode or difficulty (9) and time-boxed ranked seasons (6). Direct multiplayer covers older alternating turns (16), simultaneous versus on one field (31), co-op on one field (16) and split-field races to the quota (8, Gals Panic and Twin Qix). io games add elimination by cutting a trail (37), large lobbies (8), team territory battles (9), battle royale (8), networked rooms (18), and bots that act as rivals (15) or fill empty seats (3). Rare forms include ghost racing (4), attacks sent to the opponent's field (4), a player controlling the enemies (3) and anti-runaway king crowns (2). Caps on a dominant player, a weekly race on one shared board, replay-verifiable runs, ghosts of past lives as allies, spectator mode, quick-chat, collision duels and an asymmetric co-op support shooter each appear once.

Details: [`taxonomy/multiplayer-and-competition.md`](taxonomy/multiplayer-and-competition.md).

| Family | Games | Lineages |
|---|---|---|
| [Trail cut eliminates its owner](taxonomy/multiplayer-and-competition.md#trail-cut-eliminates-its-owner) | 37 | io-territory |
| [Online leaderboards](taxonomy/multiplayer-and-competition.md#online-leaderboards) | 37 | qix, xonix, volfied, jezzball, gals-panic, io-territory |
| [Simultaneous shared-field versus capture](taxonomy/multiplayer-and-competition.md#simultaneous-shared-field-versus-capture) | 31 | qix, xonix, jezzball, io-territory, amidar-painter, other |
| [Local high-score table](taxonomy/multiplayer-and-competition.md#local-high-score-table) | 30 | qix, amidar-painter, xonix, volfied, jezzball, io-territory |
| [Networked multiplayer and private rooms](taxonomy/multiplayer-and-competition.md#networked-multiplayer-and-private-rooms) | 18 | qix, xonix, gals-panic, other, io-territory |
| [Alternating-turn local multiplayer](taxonomy/multiplayer-and-competition.md#alternating-turn-local-multiplayer) | 16 | qix, volfied, amidar-painter, gals-panic, xonix |
| [Simultaneous co-op capture](taxonomy/multiplayer-and-competition.md#simultaneous-co-op-capture) | 16 | qix, xonix, other |
| [Computer rival claimers](taxonomy/multiplayer-and-competition.md#computer-rival-claimers) | 15 | qix, volfied, other, jezzball, gals-panic, io-territory |
| [Respawn rules](taxonomy/multiplayer-and-competition.md#respawn-rules) | 9 | io-territory, other |
| [Team territory battle](taxonomy/multiplayer-and-competition.md#team-territory-battle) | 9 | other, io-territory |
| [Segmented score tables](taxonomy/multiplayer-and-competition.md#segmented-score-tables) | 9 | xonix, jezzball, volfied, gals-panic, io-territory |
| [Split-field race to quota](taxonomy/multiplayer-and-competition.md#split-field-race-to-quota) | 8 | qix, gals-panic, volfied |
| [Large-lobby arena](taxonomy/multiplayer-and-competition.md#large-lobby-arena) | 8 | io-territory |
| [Last-survivor elimination and battle royale](taxonomy/multiplayer-and-competition.md#last-survivor-elimination-and-battle-royale) | 8 | other, io-territory |
| [Simultaneous two-player play](taxonomy/multiplayer-and-competition.md#simultaneous-two-player-play) | 7 | qix, amidar-painter, gals-panic |
| [Direct combat layer](taxonomy/multiplayer-and-competition.md#direct-combat-layer) | 7 | io-territory, jezzball, other |
| [Time-boxed ranked competitions](taxonomy/multiplayer-and-competition.md#time-boxed-ranked-competitions) | 6 | qix, gals-panic, io-territory, volfied |
| [Turn-based territory duel](taxonomy/multiplayer-and-competition.md#turn-based-territory-duel) | 5 | other, jezzball, io-territory |
| [Touching a trail kills the toucher](taxonomy/multiplayer-and-competition.md#touching-a-trail-kills-the-toucher) | 5 | io-territory, xonix |
| [Attacks sent to the opponent's field](taxonomy/multiplayer-and-competition.md#attacks-sent-to-the-opponents-field) | 4 | qix, other, gals-panic |
| [Trail cut as a setback, not death](taxonomy/multiplayer-and-competition.md#trail-cut-as-a-setback-not-death) | 4 | io-territory |
| [Ghost racing and recorded replays](taxonomy/multiplayer-and-competition.md#ghost-racing-and-recorded-replays) | 4 | qix, gals-panic |
| [Player-controlled enemies (asymmetric versus)](taxonomy/multiplayer-and-competition.md#player-controlled-enemies-asymmetric-versus) | 3 | amidar-painter, qix |
| [Bots fill empty seats](taxonomy/multiplayer-and-competition.md#bots-fill-empty-seats) | 3 | io-territory |
| [Territory stealing](taxonomy/multiplayer-and-competition.md#territory-stealing) | 3 | amidar-painter, xonix, qix |
| [Objective modes on territory](taxonomy/multiplayer-and-competition.md#objective-modes-on-territory) | 3 | io-territory |
| [Leaderboard eligibility rules](taxonomy/multiplayer-and-competition.md#leaderboard-eligibility-rules) | 3 | qix |
| [Live ranking during play](taxonomy/multiplayer-and-competition.md#live-ranking-during-play) | 3 | xonix, io-territory |
| [King crown anti-runaway](taxonomy/multiplayer-and-competition.md#king-crown-anti-runaway) | 2 | io-territory |
| [Friend challenges](taxonomy/multiplayer-and-competition.md#friend-challenges) | 2 | qix |
| [Asymmetric co-op support shooter](taxonomy/multiplayer-and-competition.md#asymmetric-co-op-support-shooter) | 1 | qix |
| [Head-on, swap and idle deaths](taxonomy/multiplayer-and-competition.md#head-on-swap-and-idle-deaths) | 1 | io-territory |
| [Collision duel](taxonomy/multiplayer-and-competition.md#collision-duel) | 1 | xonix |
| [Dominance caps](taxonomy/multiplayer-and-competition.md#dominance-caps) | 1 | io-territory |
| [Dethroned-leader notification](taxonomy/multiplayer-and-competition.md#dethroned-leader-notification) | 1 | xonix |
| [Weekly shared-board race](taxonomy/multiplayer-and-competition.md#weekly-shared-board-race) | 1 | qix |
| [Replay-verifiable runs](taxonomy/multiplayer-and-competition.md#replay-verifiable-runs) | 1 | jezzball |
| [Past-life ghosts as allies](taxonomy/multiplayer-and-competition.md#past-life-ghosts-as-allies) | 1 | other |
| [Spectator mode](taxonomy/multiplayer-and-competition.md#spectator-mode) | 1 | io-territory |
| [Quick-chat keys](taxonomy/multiplayer-and-competition.md#quick-chat-keys) | 1 | io-territory |
| [Shared real-world map with private paths](taxonomy/multiplayer-and-competition.md#shared-real-world-map-with-private-paths) | 1 | io-territory |

## Modes and meta

Endless modes (38), galleries (26) and daily shared challenges (25) are the most common modes. Configurable rule numbers (24) and difficulty presets (20) are the older arcade and hobbyist approach. Time and score attack (17), packages offering classic and arranged modes (13) and rule-variant modifiers (11) follow. Meta-progression is common in recent mobile and Steam titles: cosmetics (16), permanent upgrades (16), currency shops (16), collections (16), roguelite upgrade drafts (15), selectable characters (14), missions, streaks and seasons (11), achievements (9) and lives gated by energy or ads (8). Creation and authorship are rare: level editors (5) and user-supplied pictures (5). Gacha (3), role reversal (3) and seeded deterministic play (2) are also rare, and playable credits, cross-title unlocks, an unlockable hitbox display and a restoration hub each appear once.

Details: [`taxonomy/modes-and-meta.md`](taxonomy/modes-and-meta.md).

| Family | Games | Lineages |
|---|---|---|
| [Endless mode](taxonomy/modes-and-meta.md#endless-mode) | 38 | qix, xonix, volfied, jezzball, io-territory, gals-panic, other |
| [Picture gallery and memory mode](taxonomy/modes-and-meta.md#picture-gallery-and-memory-mode) | 26 | qix, xonix, gals-panic |
| [Daily shared challenge](taxonomy/modes-and-meta.md#daily-shared-challenge) | 25 | qix, xonix, volfied, jezzball, gals-panic, io-territory |
| [Configurable rule parameters](taxonomy/modes-and-meta.md#configurable-rule-parameters) | 24 | qix, xonix, gals-panic, amidar-painter |
| [Difficulty presets and hard modes](taxonomy/modes-and-meta.md#difficulty-presets-and-hard-modes) | 20 | qix, xonix, volfied, amidar-painter, other |
| [Time attack and score attack](taxonomy/modes-and-meta.md#time-attack-and-score-attack) | 17 | qix, volfied, gals-panic, other |
| [Cosmetic skins and avatars](taxonomy/modes-and-meta.md#cosmetic-skins-and-avatars) | 16 | qix, xonix, io-territory |
| [Permanent meta upgrades](taxonomy/modes-and-meta.md#permanent-meta-upgrades) | 16 | qix, xonix, volfied, io-territory, other |
| [In-game currency and shop](taxonomy/modes-and-meta.md#in-game-currency-and-shop) | 16 | qix, xonix, volfied, jezzball, gals-panic, other |
| [Collectibles and collection sets](taxonomy/modes-and-meta.md#collectibles-and-collection-sets) | 16 | qix, xonix, volfied, gals-panic, io-territory, other |
| [Roguelite runs with upgrade drafts](taxonomy/modes-and-meta.md#roguelite-runs-with-upgrade-drafts) | 15 | qix, xonix, volfied, io-territory, other |
| [Selectable characters](taxonomy/modes-and-meta.md#selectable-characters) | 14 | qix, xonix, volfied, other |
| [Classic and arranged modes](taxonomy/modes-and-meta.md#classic-and-arranged-modes) | 13 | qix, xonix, volfied, jezzball |
| [Rule-variant modes and modifiers](taxonomy/modes-and-meta.md#rule-variant-modes-and-modifiers) | 11 | xonix, volfied, jezzball, io-territory, other |
| [Missions, streaks and seasons](taxonomy/modes-and-meta.md#missions-streaks-and-seasons) | 11 | qix, xonix, volfied, jezzball, gals-panic, io-territory |
| [Achievements](taxonomy/modes-and-meta.md#achievements) | 9 | qix, xonix, io-territory |
| [Zen and no-fail modes](taxonomy/modes-and-meta.md#zen-and-no-fail-modes) | 8 | qix, volfied, jezzball |
| [Procedural and generated levels](taxonomy/modes-and-meta.md#procedural-and-generated-levels) | 8 | qix, xonix, jezzball, other |
| [Capture embedded in a host game](taxonomy/modes-and-meta.md#capture-embedded-in-a-host-game) | 8 | qix, xonix, other |
| [Puzzle levels](taxonomy/modes-and-meta.md#puzzle-levels) | 8 | jezzball, gals-panic, other |
| [Lives energy and ad gating](taxonomy/modes-and-meta.md#lives-energy-and-ad-gating) | 8 | qix, volfied, gals-panic |
| [Challenge and mission levels](taxonomy/modes-and-meta.md#challenge-and-mission-levels) | 6 | qix, xonix, volfied, gals-panic, other |
| [Genre fusion](taxonomy/modes-and-meta.md#genre-fusion) | 6 | qix, xonix |
| [Paid content unlocks](taxonomy/modes-and-meta.md#paid-content-unlocks) | 6 | qix, xonix, gals-panic |
| [Level editor and user levels](taxonomy/modes-and-meta.md#level-editor-and-user-levels) | 5 | qix, gals-panic, amidar-painter |
| [User-supplied pictures](taxonomy/modes-and-meta.md#user-supplied-pictures) | 5 | qix, xonix |
| [Pre-run boosts](taxonomy/modes-and-meta.md#pre-run-boosts) | 5 | qix, io-territory |
| [Save and resume](taxonomy/modes-and-meta.md#save-and-resume) | 4 | xonix, gals-panic |
| [Practice and tutorial modes](taxonomy/modes-and-meta.md#practice-and-tutorial-modes) | 4 | io-territory, jezzball |
| [Arcade mode beside the campaign](taxonomy/modes-and-meta.md#arcade-mode-beside-the-campaign) | 3 | volfied, qix |
| [Paid and ad-funded gameplay advantages](taxonomy/modes-and-meta.md#paid-and-ad-funded-gameplay-advantages) | 3 | qix, jezzball |
| [Gacha and random reward draws](taxonomy/modes-and-meta.md#gacha-and-random-reward-draws) | 3 | gals-panic, io-territory, qix |
| [Role reversal](taxonomy/modes-and-meta.md#role-reversal) | 3 | volfied, other |
| [Costume and dress-up unlocks](taxonomy/modes-and-meta.md#costume-and-dress-up-unlocks) | 3 | gals-panic |
| [Out-of-game rewards and prize payouts](taxonomy/modes-and-meta.md#out-of-game-rewards-and-prize-payouts) | 3 | gals-panic, amidar-painter |
| [Collect-and-battle meta](taxonomy/modes-and-meta.md#collect-and-battle-meta) | 2 | qix |
| [Bond progression](taxonomy/modes-and-meta.md#bond-progression) | 2 | gals-panic |
| [Content toggles](taxonomy/modes-and-meta.md#content-toggles) | 2 | volfied, gals-panic |
| [Seeded deterministic play and replays](taxonomy/modes-and-meta.md#seeded-deterministic-play-and-replays) | 2 | qix |
| [Restoration hub meta](taxonomy/modes-and-meta.md#restoration-hub-meta) | 1 | qix |
| [Bonus minigames](taxonomy/modes-and-meta.md#bonus-minigames) | 1 | qix |
| [Playable credits](taxonomy/modes-and-meta.md#playable-credits) | 1 | jezzball |
| [Cross-title unlock](taxonomy/modes-and-meta.md#cross-title-unlock) | 1 | gals-panic |
| [Unlockable hitbox display](taxonomy/modes-and-meta.md#unlockable-hitbox-display) | 1 | gals-panic |

## Controls, time and pacing

Time pressure usually comes from a per-level countdown (80) or, in io and arena games, a timed match won by the largest territory (24). Fewer games refill the clock through play (10), escalate enemies over time (13) or set a deadline per capture (3); 8 advertise untimed play. On the arcade side, inputs are hold-to-cut buttons (15), a single action button (5) or one input that is held and released (7). Touch games use swipes (20), drags (11), virtual pads (10) and multiple input schemes (20). JezzBall descendants set wall orientation with a toggle (16), separate inputs per axis (3), swipes (4) or an aim preview that builds on release (7). Adjustable game speed (17) is common in older and hobbyist games. Uncommon or single-instance inputs and timing models include tilt (4), turn-based ticks (4), trackball (3), crank (2), deterministic fixed-tick simulation (2), rhythm timing, microphone, switch-accessible controls, programming-game control and a crown hold timer.

Details: [`taxonomy/controls-time-and-pacing.md`](taxonomy/controls-time-and-pacing.md).

| Family | Games | Lineages |
|---|---|---|
| [Level countdown timer](taxonomy/controls-time-and-pacing.md#level-countdown-timer) | 80 | qix, volfied, xonix, jezzball, gals-panic, amidar-painter, other |
| [Timed match, largest territory wins](taxonomy/controls-time-and-pacing.md#timed-match-largest-territory-wins) | 24 | io-territory, other |
| [Swipe steering](taxonomy/controls-time-and-pacing.md#swipe-steering) | 20 | qix, xonix, gals-panic, io-territory |
| [Multiple input schemes](taxonomy/controls-time-and-pacing.md#multiple-input-schemes) | 20 | qix, xonix, jezzball, io-territory |
| [Adjustable game speed](taxonomy/controls-time-and-pacing.md#adjustable-game-speed) | 17 | qix, xonix, jezzball, other |
| [Orientation toggle](taxonomy/controls-time-and-pacing.md#orientation-toggle) | 16 | jezzball |
| [Hold-to-cut button](taxonomy/controls-time-and-pacing.md#hold-to-cut-button) | 15 | qix, xonix, gals-panic, other |
| [Time-driven escalation](taxonomy/controls-time-and-pacing.md#time-driven-escalation) | 13 | qix, xonix, other |
| [Drag and point-to-move](taxonomy/controls-time-and-pacing.md#drag-and-point-to-move) | 11 | qix, io-territory, gals-panic |
| [Clock replenished by play](taxonomy/controls-time-and-pacing.md#clock-replenished-by-play) | 10 | amidar-painter, other, gals-panic, qix, xonix |
| [On-screen virtual pad](taxonomy/controls-time-and-pacing.md#on-screen-virtual-pad) | 10 | qix, xonix, gals-panic |
| [Untimed play](taxonomy/controls-time-and-pacing.md#untimed-play) | 8 | qix, io-territory, other |
| [Single-input hold-and-release](taxonomy/controls-time-and-pacing.md#single-input-hold-and-release) | 7 | qix, xonix |
| [Aim preview, build on release](taxonomy/controls-time-and-pacing.md#aim-preview-build-on-release) | 7 | jezzball |
| [One action button](taxonomy/controls-time-and-pacing.md#one-action-button) | 5 | qix, gals-panic |
| [Split move-and-aim (twin-stick)](taxonomy/controls-time-and-pacing.md#split-move-and-aim-twin-stick) | 5 | other, io-territory |
| [Turn-based ticks](taxonomy/controls-time-and-pacing.md#turn-based-ticks) | 4 | other |
| [Tilt and motion control](taxonomy/controls-time-and-pacing.md#tilt-and-motion-control) | 4 | qix, xonix, gals-panic |
| [Swipe-defined walls](taxonomy/controls-time-and-pacing.md#swipe-defined-walls) | 4 | jezzball |
| [Per-capture deadline](taxonomy/controls-time-and-pacing.md#per-capture-deadline) | 3 | qix, xonix |
| [Player-triggered time dilation](taxonomy/controls-time-and-pacing.md#player-triggered-time-dilation) | 3 | jezzball, qix |
| [Instant restart](taxonomy/controls-time-and-pacing.md#instant-restart) | 3 | qix, io-territory |
| [Tap-pattern abilities](taxonomy/controls-time-and-pacing.md#tap-pattern-abilities) | 3 | xonix, qix, other |
| [Continuous (latched) movement](taxonomy/controls-time-and-pacing.md#continuous-latched-movement) | 3 | qix, xonix, io-territory |
| [Trackball control](taxonomy/controls-time-and-pacing.md#trackball-control) | 3 | other, xonix |
| [Dedicated axis inputs](taxonomy/controls-time-and-pacing.md#dedicated-axis-inputs) | 3 | jezzball |
| [Exposure penalty off safe ground](taxonomy/controls-time-and-pacing.md#exposure-penalty-off-safe-ground) | 2 | volfied, qix |
| [Draining border shield](taxonomy/controls-time-and-pacing.md#draining-border-shield) | 2 | volfied |
| [Pause](taxonomy/controls-time-and-pacing.md#pause) | 2 | qix |
| [Very short rounds](taxonomy/controls-time-and-pacing.md#very-short-rounds) | 2 | qix |
| [Fixed-step logic with interpolated rendering](taxonomy/controls-time-and-pacing.md#fixed-step-logic-with-interpolated-rendering) | 2 | qix, xonix |
| [Deterministic fixed-tick simulation](taxonomy/controls-time-and-pacing.md#deterministic-fixed-tick-simulation) | 2 | jezzball |
| [Charged capture](taxonomy/controls-time-and-pacing.md#charged-capture) | 2 | other |
| [Tap-to-turn steering](taxonomy/controls-time-and-pacing.md#tap-to-turn-steering) | 2 | xonix, qix |
| [Crank control](taxonomy/controls-time-and-pacing.md#crank-control) | 2 | jezzball |
| [Physics-driven trail](taxonomy/controls-time-and-pacing.md#physics-driven-trail) | 2 | other |
| [Post-hit invulnerability](taxonomy/controls-time-and-pacing.md#post-hit-invulnerability) | 2 | gals-panic |
| [Crown hold timer](taxonomy/controls-time-and-pacing.md#crown-hold-timer) | 1 | io-territory |
| [Idle-decay capture gauge](taxonomy/controls-time-and-pacing.md#idle-decay-capture-gauge) | 1 | other |
| [Rhythm timing](taxonomy/controls-time-and-pacing.md#rhythm-timing) | 1 | jezzball |
| [Drawn-glyph commands](taxonomy/controls-time-and-pacing.md#drawn-glyph-commands) | 1 | other |
| [Tapping is faster than holding](taxonomy/controls-time-and-pacing.md#tapping-is-faster-than-holding) | 1 | amidar-painter |
| [Turn assist](taxonomy/controls-time-and-pacing.md#turn-assist) | 1 | qix |
| [Switch-accessible controls](taxonomy/controls-time-and-pacing.md#switch-accessible-controls) | 1 | qix |
| [Microphone input](taxonomy/controls-time-and-pacing.md#microphone-input) | 1 | other |
| [Programming-game control](taxonomy/controls-time-and-pacing.md#programming-game-control) | 1 | other |
| [Control inversion](taxonomy/controls-time-and-pacing.md#control-inversion) | 1 | xonix |
| [Block button](taxonomy/controls-time-and-pacing.md#block-button) | 1 | qix |
| [Zoom-out view](taxonomy/controls-time-and-pacing.md#zoom-out-view) | 1 | other |
| [Stylus stretch placement](taxonomy/controls-time-and-pacing.md#stylus-stretch-placement) | 1 | jezzball |
