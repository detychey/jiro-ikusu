# Mechanics: capture rules

The 67 mechanic families of the axis *capture rules*: what a closed cut claims and how: the enemy-free side, the smaller side, several enemies, splitting enemies into regions, area thresholds, bonuses for big captures, captures that kill or trap enemies. The [taxonomy](../TAXONOMY.md) summarizes the axis and lists the 12 axes. **Games** counts the catalog games that show a family, as the merging agent counted them.

## Area-percentage clear threshold

A stage clears once the claimed share of the field reaches a target percentage, usually shown as a live counter. The target is the main difficulty knob. 75% is the Qix, Xonix and JezzBall standard, and catalogued values run from 30% to 91%. Some games also require the target within a time limit or together with another goal.

Games: 177 · lineages: qix, xonix, jezzball, gals-panic, amidar-painter, volfied

Examples:

- **Qix** (1981): 75% by default; operators can set anything from 50% to 90%.
- **Xonix** (1984): 75% according to old-games.ru; Hebrew Wikipedia says the required share rises by level.
- **Gridd Worz** (1984): The level ends once about 75% of a 26x20 grid has been cleared by flying over it.
- **Kix (BBC Micro)** (1986): 75% coverage is required in each of 20 quadrants.
- **JezzBall** (1992): Walls must cover at least 75% of the room within a time limit.
- **Gotcha** (1993): 50% instead of Qix's 75%.
- **Gals Panic 3** (1995): 80% ends the stage.
- **Twin Qix** (1995): 70% in round 1, rising in later rounds; 95% wins a versus round.
- **Jezzball Deluxe** (2004): 91% to win a round.
- **xXIXx** (2015): The win target is lowered to 30% of the screen.
- **Claim (DaNuTree)** (2026): 75% opens an optional cash-out rather than ending the level.
- **Volfi: Cyber Territory Arcade** (2026): A per-arena target of 75%-85%; reaching it destroys the guardian boss.

Variants:

- 75% standard: Qix, Super Qix, Xonix, KBounce, Jezzball NES, QL-x and many more.
- 80% bar: Styx (official remaster rules; Home of the Underdogs says 65%), Mamba, Mamba 2, Gals Panic 3 and 4, Pac-Xon (2010), Land Breaker, Rinka's Snowmelt Album.
- 85-91% bars: Cosmo Bots 85%, In My Imagination 85% in Normal, Beauty Territory 85%, Hidden Fields 90%, Araña 90%, Neon Fill 90%, Territory Arrow 90%, Jezzball Deluxe 91%.
- Lower bars: Kicks 70%, Filler and Fill it! (Vvalter) two-thirds, Jezzball v1.0 (TI-83 Plus) 65%, Gotcha 50%, Qix Cover Football 50%, xXIXx 30%.
- Quota in each sub-area: Kix (BBC Micro) needs 75% in each of 20 quadrants; Reclamation sets one per sector.
- Share of the area that started unclaimed, not of the whole field: Xonix (X11/Macintosh reimplementation).
- Timed quota: JezzBall, Zolyx, Xonix Assault, Code: Xonix, 王子天蚕变, Spherical Qix and Territory Arrow must reach the target before a timer runs out.
- Versus target: Twin Qix awards a versus round at 95%.
- Lower targets for two players: Harem Challenge uses 70/75/80% for two players and 75/80/85% for one.
- Tiered goals: CuteQix and LewdQix have 60%, 70% and 80% goals.
- Quota plus another objective: Gotta Xonix also requires collecting energy nodes.
- Reaching the quota opens an optional cash-out instead of ending the level: Claim (DaNuTree).
- Territory claimed beyond the target scores a bonus: OVERWORLD.
- Endless mode moves on automatically at the target: In My Imagination at 85%.
- Target not given as a number: Tarantula vs Snake (a 'sufficiently large' web), qixxy and Stealin (a 'supermajority'), Gravity (GBA) (an unstated 'victory percentage').
- Coverage quota with no enclosure: Gridd Worz ends at about 75% of cells cleared; Splash! shows a completion percentage and some levels do not need full coverage; Penky wins at a DIP-set 70-99.9% or by majority at time-out.
- The quota is presented as revealing a picture or subject: Youjuu Club 80% of the image; PetsArtXoniX shows the whole picture at 80%; Secret Camera captures the stage's tenant at a set enclosure percentage.
- 75% inferred from a leftover source flag, 'FLAG75': Xonix (Apple II, uncredited XONIX.DSK).

## Perimeter-complete box capture (Amidar model)

The field is a lattice of boxes, and a box is filled and claimed once every one of its sides has been painted or drawn. Nothing is claimed by cutting through open field. Neighbouring boxes share sides, so one stroke can help close several boxes.

Games: 45 · lineages: amidar-painter, other

Examples:

- **Amidar** (1982): Painting all four sides of a box fills it; the whole board must be filled.
- **Pepper II** (1982): The player leaves a zipper trail; enclosing a segment fills it.
- **Kid Grid** (1982): All 35 squares are captured by turning their four sides from dotted to solid.
- **Time Runner** (1982): Twenty rectangular boxes on a checkerboard field are claimed by tracing their edges.
- **Oh Mummy** (1983): Fully enclosing a tomb box with the footprint trail opens it and reveals its content.
- **Gridder** (1983): Tracing the edges of each square recolours it; the whole grid must be coloured.
- **Gapper** (1986): Each grid square whose four sides are all red scores 50.
- **Zoom!** (1988): A tile flashes once all its edges are coloured; the clear condition is still every line.
- **2nd Space** (1993): A rectangle fills when the player goes all the way around it, uncovering part of a picture.
- **Live Wire!** (1999): A tile is claimed by drawing all four of its sides, with up to four players competing.
- **Clubhouse Games: 51 Worldwide Classics (Dots and Boxes)** (2020): Completing the fourth side of a box claims it and grants another turn.
- **Color Conquest** (unknown): Real-time Dots and Boxes with no turns, played against an AI.

Variants:

- Painting all four sides of a box fills it, and the whole board must be filled: Amidar.
- Boxes have preset sizes or values: Boxer Rebellion (preset score boxes), Potty Painter (squares of different sizes, each worth different points), Jolly Jogger (10 per boxed area, 100 for a power box), Gapper (50 per square whose four sides are red).
- Irregular grid: Jeepers Creepers.
- A zipper trail; enclosing a segment fills it: Pepper II.
- A checkerboard field of twenty boxes: Time Runner and its clone Blade Runner (WizardSoft).
- Completing a box opens it to reveal its contents: Oh Mummy's tombs; 2nd Space uncovers part of a picture.
- Sides change from dotted to solid: Kid Grid's 35 squares.
- Grid blocks enclosed by the held trace line vanish: Wonder Stick.
- Up to four players compete for tiles: Live Wire!.
- Turn-based Dots and Boxes, where completing a box's fourth side claims it and grants another move: Clubhouse Games: 51 Worldwide Classics.
- Real-time Dots and Boxes with no turns, against an AI: Color Conquest.
- Many straight clones with little documented detail: Colour Clash, Crazy Painter, Demon Decorator, Super Gridder, Painting Joe, Squares (two type-ins), Hefro-Karo, Panel Panic, Omidar, Spiderdroid, Striker, Nyamida Monogatari, Amidoh!.

## Enclosed enemies are destroyed or captured

An enemy left inside newly claimed territory is removed instead of blocking the claim. It is killed, captured, deactivated, frozen or reset, usually for points, items or a multiplier. In multiplayer arenas the same rule eliminates a rival, or a rival's trail, sealed inside your loop.

Games: 42 · lineages: qix, xonix, volfied, jezzball, gals-panic, io-territory

Examples:

- **Styx** (1983): A border caterpillar trapped in a filled area is reset to its small size.
- **Frenzy** (1984): Leptons in the filled area are killed.
- **Volfied** (1989): Minions left on the claimed side are destroyed for bonus points.
- **Cacoma Knight in Bizyland** (1992): Enemies trapped in chalk are destroyed, but only temporarily, and respawn quickly.
- **Coach Tzabar** (1997): On hard, trapped monsters self-destruct.
- **Gal Pani X** (2002 (demo 2000)): Enclosing regular enemies can drop power-ups, mainly Speed.
- **Cosmo Bots** (2004): Enemies inside an enclosed area are destroyed and sometimes drop power-ups.
- **Megami Tensei QIX Persona 3** (2007): Enclosing an area defeats the enemies inside it, except the boss.
- **Fortix** (2009): Anything enclosed, tower or dragon, dies permanently.
- **Pac-Xon** (by early 2010): Ghosts can be captured by enclosing them with walls.
- **Cosmo Xonix: Space Arcade** (2026): Mini-boss creatures are trapped in captured ground and added to a collection.
- **Paper Loop** (2026): Sealing a rival's trail inside your capture eliminates it.

Variants:

- Bonus per kill: Volfied minions, Territory Raider's trap bonus, Volfi's large bonus, Reef Reveal's big bonus, Blobbed Away's Soots, Shocker's 100 per eel.
- The boss is exempt: Megami Tensei QIX Persona 3 defeats every enemy inside except the boss.
- Kills drop items or rewards: Gal Pani X enemies drop power-ups (mainly Speed); Cosmo Bots sometimes drop power-ups; captured Qix Adventure monsters release treasure chests; panic_Territory Expedition awards XP.
- Captured into a collection: Cosmo Xonix mini-bosses (12 on iOS); Line Knight Fortix cuts out and captures dragons, ogres and turrets.
- Multiplier: each enemy GALS HUNTER destroys by enclosure raises the score multiplier.
- Permanent kill: Fortix (towers and dragons), Virtual Bug Catcher (bugs in the red safe zone are removed for good).
- Temporary kill: enemies come back in Cacoma Knight in Bizyland, Lightfish, Cubixx and Mix (see 'Captured enemies respawn').
- Reset instead of killed: a border caterpillar trapped in a filled area in Styx shrinks back to its small size.
- Deactivated or frozen: Shocker's eels; Moss Covers Everything turns enemies into harmless pushable skulls; a Clax smiley stops moving when its colour matches its block.
- Depends on difficulty: Coach Tzabar's trapped monsters self-destruct only on hard.
- Border enemies can be cut off as well: Mix scores bonus points for cutting off a border Tracer.
- Capture helped by a power or tool: a Glowfield power snares an enemy in a pocket of light; a grab hook in point line surface pulls enemies in to absorb them.
- Hazards and special targets: Photo Slice removes hazards caught in a revealed area; Alien Blockade pays a bonus for enclosing the alien energy field or a tracer.
- Plain kill with no extra effect: Territory: Claim & Conquer, Dino Master, Pac-Xon (ghosts), Xonix Assault (artillery), Waifu Space Conquest (aliens), Cosmic Bugs, Fill Qix; Snip It! (exact rule not described).
- Multiplayer: Paper Loop eliminates a rival whose trail is sealed inside your capture; Line Fight traps rivals and monsters inside your territory; Kingpins.io crews trap overextended players; Wrangler pops enemies with a looped rope.

## Enemy-free regions are claimed

When a cut closes, the open field is flood-filled from each enemy that protects ground. Every region holding such an enemy stays open, and every region without one is claimed at once. With one enemy in the field this is Qix's 'side without the Qix'. With several, one cut can claim several pockets, and if every region holds an enemy only the new trail or wall is kept.

Games: 33 · lineages: qix, xonix, volfied, jezzball, gals-panic

Examples:

- **Xonix** (1984): Returning to land fills every sea pocket without a ball; if every pocket has a ball, only the trail is converted.
- **Volfied** (1989): The side holding the boss counts as outside; minions on the claimed side are destroyed.
- **Mamba** (1991): On closing a web the spider gets the part of the field the single snake is not in.
- **JezzBall** (1992): A wall that reaches the edges unbroken fills every region with no atom.
- **AQuix** (1997): Only regions with no enemy Quix are filled.
- **Lovely Girls** (1998): Claimed monster-free areas fill with part of the hidden photo.
- **Land Breaker** (1999): The picture is revealed only in a part with no enemies.
- **Fishonix** (2009): A cut-off part disappears only if no moving fish is inside it.
- **SPLITRON** (2019): Black tiles in an enclosed, ball-free area shatter.
- **LocalUtopia** (unknown): Several drifting enemies; every closed region holding an enemy stays open and every enemy-free region is claimed.
- **Territory Reveal** (2026): A closed loop claims its enclosed area only if no enemy is inside it.
- **Territory Arcade** (2026): Claims the enemy-free side; with enemies on both sides it keeps the smaller half, on a clear field the larger half.

Variants:

- Two-sided form, where the side without the enemy is claimed: Lovely Girls, RPG Maker MZ Territory Action Plugin, Neon Fill, Ink Fill; Rinka's Snowmelt Album keeps the side without the wolf boss.
- Every pocket at once: Xonix fills every sea pocket without a ball; Unveil, Territory: Claim & Conquer and Fly Trap claim every pocket the enemies can no longer reach.
- When every pocket holds a ball, Xonix (1984) converts only the trail.
- Wall form: a JezzBall wall that completes unbroken fills every region with no atom; Ballfence claims a sealed ball-free region instantly; in Quark Panic any quark-free enclosed area becomes solid.
- Only the boss protects ground: Volfied, Territory Raider and Starcutter flood-fill from the boss alone, so minions do not protect their region and die instead.
- Single-snake framing: in Mamba the spider gets the part of the field the snake is not in.
- A closed loop's interior is claimed only if it is empty: Territory Reveal.
- Fallback when both sides hold enemies: Territory Arcade keeps the smaller half, and the larger half when the field has no enemies.
- Removal instead of claiming: the cut-off part is removed only if no enemy is inside it (fish in Fishonix, ninja stars in iSlash).
- Several drifting enemies boxed in separately: LocalUtopia, In My Imagination.
- Ball-free tiles shatter: SPLITRON breaks the black tiles in an enclosed area with no ball.
- Hazards depend on the rule: Xonix32 (Android) seals a black hole only when its pocket holds no enemy; Xonix (PICO-8) leaves any pocket with a sea enemy unfilled.

## Configurable or escalating clear threshold

The clear percentage is not one fixed constant. An operator, the player or a host page sets it, or it rises or changes from level to level, so difficulty is tuned through the area target rather than through enemies.

Games: 26 · lineages: qix, xonix, jezzball, gals-panic, amidar-painter, volfied

Examples:

- **Qix** (1981): The operator can adjust the target from 50% to 90%.
- **Xonix** (1984): The required share rises by level, according to Hebrew Wikipedia.
- **Trix** (1988): 60% at first, rising as the game goes on.
- **Strong Lines** (1991): The difficulty setting is the fill target: 75%, 80%, 85% or 90%.
- **Paradise** (1994): Operator fill target of 75/80/85/90%.
- **Penky** (1996): The minimum coverage share, 70-99.9%, is set by DIP switch.
- **Coach Tzabar** (1997): Usually 70%, varying by level.
- **似非クイックス** (2003): The site owner sets the goal % (1-99) through an applet parameter.
- **Xobox (Rockbox plugin)** (2006): Fill target from 5% to 95% in steps of 5, default 75%.
- **iSlash** (2010): The amount of the shape you must trim away grows over time.
- **Qyx** (2022): Each of 99 stages has its own territory threshold.
- **Eight Bit Qix** (c. 2026): Configurable from 50% to 90% (default 75%); the Ruthless preset uses 85%.

Variants:

- Operator setting: Qix 50-90%; Paradise 75/80/85/90%; Penky 70-99.9% by DIP switch; Harem Challenge has separate one-player and two-player tiers.
- The difficulty level is the fill target: Strong Lines (1991) 75/80/85/90%; Strong Lines (1994) has four settings that differ only in fill percentage.
- Player menu: Smiley sets the starting target (65% shown); Qix 2000 has three settings (default 75%); Xobox 5-95% in steps of 5 (default 75%); Eight Bit Qix 50-90% with a Ruthless preset at 85%.
- Set by the embedding page or plugin: 似非クイックス takes the goal % (1-99, default 75) as an applet parameter set by the site owner; Unveil allows 10-95% in its GameMaker version.
- Rises during the run: Trix starts at 60%; Twin Qix starts at 70%; Cubixx starts at 50%; the amount iSlash asks you to trim grows; Paradise Deluxe goes from 80% to 85% in later stages; Xonix (1984) according to Hebrew Wikipedia.
- Set per level: Coach Tzabar (usually 70%), 3D天蚕变 (60% on level 1), Qyx (each of 99 stages), RPG Maker MZ Territory Action Plugin, Cosmo Xonix's hand-built levels, Kritter Krawler, Get Your Klix on Route 66, Volfi (75-85% per arena).

## Enclosure takes rival territory

Closing a loop, or surrounding a group, claims everything inside whoever owns it, so rivals' land and markers switch to your colour. This makes late reversals possible.

Games: 20 · lineages: io-territory, other

Examples:

- **Harapeko Bakka** (1994): Surrounding an opponent's eggs converts them to your colour.
- **Paper.io** (2016): Stealing rivals' territory is allowed.
- **Superhex.io** (2017 or earlier): Rivals' hexagons can be stolen by enclosing them.
- **Frontiers.io** (2017): Steal land by running through opponents' territory and closing it off.
- **Paper.io 2** (2018): Gliding over rivals' colour and reconnecting steals their land.
- **Paper-io (MakeCode Arcade)** (2021): The flood fill overwrites rival colour inside the boundary.
- **Qixotic** (2025): You may cross enemy territory and claim over it.
- **Plotta: Walking Map Game** (2026): Walk a loop over a neighbour's land to take the overlap; surround it completely to take all of it.
- **Turf Rollers** (2026): Looping home claims the enclosure, including land rivals are standing on.
- **Ink Dots: Territory Capture** (2026): Surrounding rival dots with an unbroken chain captures them.
- **Tetro Domain** (2026): Any territory fully enclosed by your claims is captured automatically.
- **Color Conquest** (unknown): Enclosing shapes can steal the opponent's territory.

Variants:

- A loop over rival land steals it: Paper.io, Paper.io 2 (glide over the rival colour and reconnect), Frontiers.io, Turfrush, Turf War / Turfrush, 땅따먹기왕, Quick Paper Game.
- Hexagon board: Superhex.io.
- Land that rivals are standing on is taken too: Turf Rollers.
- Overlap versus full encirclement: Plotta takes the overlap of a loop walked over a neighbour's land, and all of that land when it is completely surrounded.
- Enclosing a rival's land takes all of it: Marble Land Grab.
- Surrounding the rival itself takes its land: Paper Land: Territory Grab.
- Stealing land counts toward a domination goal: BeastGrid.
- You may cross enemy territory: Qixotic.
- The flood fill overwrites the rival colour inside the boundary: Paper-io (MakeCode Arcade), looprush.
- Go/Othello-style surrounding of markers: Ink Dots captures rival dots surrounded by an unbroken chain; Harapeko Bakka turns surrounded eggs to your colour.
- Fully enclosed territory is captured automatically in a turn-based game: Tetro Domain.
- Enclosing shapes in real time steals the opponent's territory: Color Conquest.

## Whole-field clear required

There is no partial quota. The stage ends only when the whole field, picture, set of panels, grid or line network has been claimed (100%).

Games: 19 · lineages: qix, xonix, gals-panic, amidar-painter, other

Examples:

- **Make Trax** (1981): Every path of the maze must be painted.
- **Amidar** (1982): The whole board of boxes must be filled.
- **Lady Killer** (1993): Flipping every tile clears the level.
- **Dancing Eyes** (1996): Clear every panel on the model to finish the stage.
- **Gal Pani X** (2002 (demo 2000)): Reaching 100% is one of three clear routes, alongside 80% and surrounding the boss.
- **Spider Web: Akai's Journey** (2015): Uncover the whole postcard to finish a level.
- **Cellonix** (2019): The stated goal is to fill the whole board.
- **Area of Pirates** (2020): Complete the whole map without being noticed by pirates.
- **Sneak Peeling** (2020): The stage clears by occupying the whole board.
- **Waifu Space Conquest** (2023): 'Conquer all the space to pass the level.'
- **Beaver Dam** (c. 2023): Clear the whole map 'in one piece'.
- **Gensou -Yumegokochi- Illusion -Dreamlike-** (2024): Bullet Hell mode is a timed race to a 100% clear.

Variants:

- Whole map without being spotted: Area of Pirates.
- Whole map 'in one piece': Beaver Dam.
- Timed race to 100%: Bullet Hell mode of Gensou -Yumegokochi- Illusion -Dreamlike-.
- Every panel on the model: Dancing Eyes.
- Whole picture or board: Spider Web: Akai's Journey (the postcard), Waifu Space Conquest ('conquer all the space'), Sneak Peeling (occupy the whole board), Cellonix (fill the whole board).
- 100% as one of several clear routes: Gal Pani X (80%, 100% or surrounding the boss).
- Every box filled: Amidar, Kid Grid (all 35 squares), Gridder, Cuthbert Goes Walkabout, Graffity.
- Every line painted: Make Trax, Traxx, Zoom!, Painter Man!!.
- Every tile flipped: Lady Killer.

## Transient loop capture of targets

Closing a loop acts on the targets inside it, destroying, collecting, rescuing, harvesting or banishing them, instead of claiming permanent area. The loop then disappears.

Games: 19 · lineages: other, io-territory, qix

Examples:

- **Quantum** (1982): A loop destroys the particles inside; the stage clears when all nuclei are destroyed.
- **Disco No. 1** (1982): Skating a loop around tough guys scores them instead of claiming area.
- **Libble Rabble** (1983): Enclosing Mushlins harvests them.
- **firmament i-a** (2001): Enclosed diamond pieces vanish while the rest keep flowing.
- **Star Trigon** (2002): Uchijins inside a completed triangle are rescued.
- **Yoshi Touch & Go** (2005): A circle traps a single enemy in a bubble.
- **Spider: The Secret of Bryce Manor** (2009): A closed triangle of strands forms a web that catches the insects inside.
- **Ouroboy** (2025): Wrapping the snake around a herd of cows captures them.
- **Wrangler** (2025): Loop the rope around enemies to pop them.
- **Demon Wreath** (2025): Turn-based: encircle demons in salt to banish them.
- **Go Around** (2025): An enemy dies when a loop of your shots encircles it.
- **Lazy Drawer: Line Survivors** (2026): Closing a loop bursts damage on everything inside.

Variants:

- Destroying every target clears the stage: Quantum (nuclei).
- Skating a loop around enemies scores them: Disco No. 1.
- Enclosed Mushlins are harvested: Libble Rabble.
- Creatures inside a triangle are rescued: Star Trigon.
- A triangular web catches insects: Spider: The Secret of Bryce Manor, Spider: Rite of the Shrouded Moon.
- A circle traps a single enemy in a bubble: Yoshi Touch & Go.
- Enclosed puzzle pieces vanish while the rest keep flowing: firmament i-a.
- The snake's own body is the loop: Ouroboy captures cows; Snake Loop defeats foxes.
- A drift loop collects the blocks inside: Overheat.
- A loop of smoke destroys enemies: Smokescreen.
- Looping replaces shooting: Encircle (chlowo); in Go Around an enemy dies when a loop of your shots encircles it.
- Turn-based banishing of demons with a ring of salt: Demon Wreath.
- Encircled objects and enemies are eaten, and each stage's goal is to encircle and eat a goal object: Schloop.
- Closing a loop bursts damage on everything inside: Lazy Drawer: Line Survivors.
- A looped rope pops enemies: Wrangler.
- Circling collects good objects, while bad ones are slashed: Love Me.

## Trap or eliminate enemies to clear

The stage is won by enclosing the main enemy, or by removing every enemy through captures. This replaces the area quota or is offered as an alternative to it.

Games: 14 · lineages: qix, xonix, volfied, gals-panic, other

Examples:

- **Night Flight** (1982): Trapping the lightning bolt inside your filled area clears the level.
- **Quantum** (1982): A loop destroys the particles inside; the stage clears when all nuclei are destroyed.
- **Frenzy** (1984): Levels usually end when all Leptons are killed.
- **Rumba Lumber** (1984): Trap the pterodactyl in a clump of four or fewer trees.
- **Volfied** (1989): Separating the two-part stage-6 boss so it cannot rejoin clears the stage.
- **陣取り (Evio)** (1993): Enclosing the single snake wins the round; every part of the screen without the snake becomes the player's.
- **Queeks** (1996): With several snakes, all must be enclosed at the same time.
- **Gal Pani X** (2002 (demo 2000)): Surrounding the boss is an instant win, alongside the 80% and 100% routes.
- **Lightfish** (2011): Killing every monster by enclosure is the stage goal.
- **PIX (Sega Genesis / Mega Drive)** (2026): A round clears at the reveal percentage or by trapping every enemy.
- **Photo Slice** (2026): Clearing every hazard opens the whole photo; the run continues with a new photo.
- **VoidMania** (2026): Cutting the boss off from the rest of the field collapses the level around it.

Variants:

- Trap the main enemy inside your filled area: Night Flight (the lightning bolt).
- Remove every enemy: Frenzy (all Leptons), Lightfish (killing every monster by enclosure is the stage goal), PIX (trapping every enemy, as an alternative to the reveal %), Quantum (destroy every nucleus with loops).
- Trap in a small region: Rumba Lumber's pterodactyl, which can fly only over trees, must be trapped in a clump of four or fewer trees.
- Enclosing the single snake wins and gives the player all space without the snake: 陣取り (Evio).
- All snakes must be enclosed at the same moment: Queeks.
- Cutting the boss off collapses the level around it: VoidMania.
- Instant-win route alongside the area quotas: Gal Pani X (surround the boss, or reach 80% or 100%).
- Removing every hazard reveals the whole photo, and the run continues with a new photo: Photo Slice.
- Trap the main enemy while avoiding moving obstacles: YiNe - Territory Capture; Qix (sternendreck) states its aim as enclosing the Qix as much as possible.
- Separate a two-part boss so it cannot rejoin: Volfied stage 6.

## Splitting enemies into separate regions

When two or more main enemies are in play, a cut that leaves them in different regions has a special effect: it raises the score multiplier, removes one of them, pays a split bonus or clears the stage outright. Taken to its limit, the whole goal becomes isolating every enemy from every other.

Games: 13 · lineages: qix, volfied, jezzball

Examples:

- **Qix** (1981): Two Qix from level 3; splitting them ends the level and raises the score multiplier.
- **quix (QIX on Unix)** (c. 1982-1984): Points for cutting a Qix off from the others; each new screen adds one more Qix.
- **Styx** (1983): From level 3, separating the two smaller Styx makes one disappear.
- **Kix (BBC Micro)** (1986): Separating the two Sparklers wins the quadrant at once, with a split bonus of 100 or 1000.
- **Torch 2081** (1986): Separating the twin Fireballs raises the multiplier; capturing both gives a glider but no multiplier.
- **Volfied** (1989): The stage-6 boss is two parts; separating them so they cannot rejoin clears the stage.
- **ISOL8: Build & Isolate** (2021): Won when every ball is walled off from every other ball, checked by flood fill.
- **Qyx** (2022): Two Qyx in later stages, with a multiplier for splitting them.
- **Mix** (2022): Separating the big green monsters clears the level as if 100% were painted and doubles the time bonus.
- **Eight Bit Qix** (c. 2026): Splitting the twin Qix raises the score multiplier, up to 9x.
- **Stake That Claim** (2026): Clear by claiming 75% or by splitting the rival balls into separate areas.
- **Domain Expansion** (2026): Some stages also clear by separating two enemies inside the field.

Variants:

- Splitting ends the level and raises the multiplier: Qix (two Qix from level 3).
- Points for cutting one Qix off from the others, with one more Qix on each new screen: quix (QIX on Unix).
- Splitting makes one enemy vanish: Styx's two smaller Styx (digger.org: trapping one roughly halves the player's speed).
- A separating line wins the quadrant at once, with a split bonus of 100 (quick) or 1000 (slow): Kix (BBC Micro).
- Separating raises the multiplier, while capturing both gives a bonus glider and points but no multiplier: Torch 2081's twin Fireballs.
- Rising multiplier for each split: Eight Bit Qix (up to 9x), Qyx, QWYX.
- Splitting clears the level as if 100% were painted and doubles the time bonus: Mix.
- A second clear condition beside the area quota: Domain Expansion, Stake That Claim.
- A two-part boss is beaten by separating its parts so they cannot rejoin: Volfied stage 6.
- Isolating every ball from every other is the only goal, checked by flood fill: ISOL8: Build & Isolate.

## Silhouette-only coverage

Only claimed area inside a marked figure (a silhouette or mask) counts toward the clear target; area claimed over the background does not. Keeping the boss in background with no figure is therefore a valid strategy, and it makes 100% of the figure reachable.

Games: 12 · lineages: gals-panic

Examples:

- **Gals Panic** (1990): The round clears at 80% of her silhouette, not 80% of the field.
- **Fantasia** (1994): Reveal 80% of the silhouette.
- **Super Model** (1994): Reveal 80% of a silhouetted photographic model.
- **Paradise Deluxe** (199? (1994 or later)): 80% of the silhouette, 85% in later stages.
- **Gals Panic SS** (1996): The goal is uncovering a glowing character silhouette, not a share of the whole field.
- **Silhouette Stories** (1996): 80% of the silhouette; keeping the boss in a part with no silhouette is a valid strategy.
- **Gals Panic S - Extra Edition** (1997): In versus, the first to claim 80% of the silhouette wins.
- **Panic (Y.O.S.)** (2002): Capturing 80% of the masked area clears the stage.
- **Pix Panic** (2015 or earlier): Reveal 80% of the silhouetted image.
- **Pix Qix - Cute Girls Panic** (2024): Reveal 80% of the silhouette.
- **Gals Borderline: Daily Life of the Battle Princesses** (2026): Fence in a glowing blue silhouette on a dark screen.
- **Landgrab - Line Cutting Arcade** (2026): 80% of the character's silhouette; trapping the boss outside the picture makes 100% possible.

Variants:

- 80% of the silhouette, not 80% of the field: Gals Panic (1990), Fantasia, Super Model, Silhouette Stories, Pix Panic, Pix Qix - Cute Girls Panic.
- The silhouette target rises to 85% in later stages: Paradise Deluxe.
- A glowing silhouette marks the goal: Gals Panic SS; Gals Borderline shows a glowing blue silhouette on a dark screen.
- Versus race: in Gals Panic S - Extra Edition the first player to claim 80% of the silhouette wins.
- Masked area instead of a silhouette: Panic (Y.O.S.) clears at 80% of the masked area.
- Trapping the boss outside the figure makes 100% possible: Landgrab - Line Cutting Arcade, Silhouette Stories.

## Trail-enclosure claim

The basic rule: the player leaves the safe border or home territory, lays a vulnerable trail through unclaimed space and closes it back on the border. The enclosed region becomes claimed, and the border grows around it. The side-selection families refine this rule.

Games: 12 · lineages: gals-panic, other, qix

Examples:

- **陣取りゲーム (Matsuo & Takagi)** (1990): Any closed region formed by a player's trails becomes that player's territory.
- **Cherry Bomb: Chou-ojou-sama Sayaka-chan Nanpa Daisakusen** (1994): Xonix/Qix-style capture stages inside an adventure story.
- **Innai Kansen ~Mayonaka no Nurse Call~** (1998): Xonix-style action stages.
- **Panic (Y.O.S.)** (2002): Enclose a masked area while avoiding enemies.
- **Yuukuri Panic Escalation** (2008): Xonix-style territory capture between adventure scenes.
- **Magical Stock Princess** (2020): Clear the floor while avoiding monsters.
- **KISS U** (2022 (demo)): Boxed-off areas reveal a hidden picture in a capture mini-game.
- **Gals Panic (Android)** (2024 or earlier): Claim area by cutting lines in from the border.
- **Star Panic: Cosmic Queens** (2025): A ship flies around the screen edges, drawing lines to claim space.
- **Cats Panic!** (2026): Draw a trail around territory to claim it while avoiding enemies.
- **Kanojo Panic** (2026): Draw lines to claim the screen and dodge enemies.
- **panic_Territory Expedition** (2026): The area enclosed by the sortie's route and the safe zone becomes territory; failure loses only that sortie.

Variants:

- Capture stages set inside adventure games: Cherry Bomb, Innai Kansen, Yuukuri Panic Escalation, KISS U (a mini-game that reveals a picture).
- A ship flying along the screen edges draws the lines: Star Panic: Cosmic Queens.
- A player programs several bugs, and any closed region formed by that player's trails, from any combination of its bugs, becomes its territory: 陣取りゲーム (Matsuo & Takagi).
- Expedition sorties: each sortie in panic_Territory Expedition reaches an objective deep in enemy land, the route and the safe zone enclose new territory, and a cut path or a death fails only that sortie while earned land and upgrades are kept.
- Clearing a floor while dodging monsters: Magical Stock Princess.

## Line coverage without enclosure (Make Trax model)

The goal is to paint every path segment of a maze or grid. Surrounding a region claims nothing; only line coverage counts toward the clear.

Games: 9 · lineages: amidar-painter

Examples:

- **Make Trax** (1981): Every path of the maze must be painted; there is no enclosure.
- **Paint Roller (Gakken)** (1982): Crush Roller-style: cover every path.
- **Hot Shocker** (1982): The strands of a web are recoloured by walking along them.
- **Traxx** (1983): Rectangles are not filled when surrounded; the level ends when the whole grid is painted.
- **Painter (A'n'F Software)** (1983): Maze painting after Make Trax and Amidar.
- **Zoom!** (1988): A board ends only when every line has been skated (100%).
- **Electro Bingo** (1989): Maze painting in the Make Trax model.
- **Brush Roller** (1990): Straight clone of Crush Roller / Make Trax.
- **Painter Man!!** (2025): Every wall of a castle room must be painted to move on.

Variants:

- Every path of the maze must be painted and there is no enclosure: Make Trax.
- Unlike Amidar, rectangles are not filled when surrounded: Traxx.
- The strands of a web are recoloured by walking along them: Hot Shocker.
- A surrounded tile flashes, but the board ends only when every line has been skated: Zoom!.
- Every wall of a castle room must be painted to move on: Painter Man!!.
- Straight clones with few documented details: Paint Roller (Gakken), Brush Roller, Painter (A'n'F Software), Electro Bingo.

## Pocketing and herding walls

A pocket that holds an enemy stays open, but the cut that made it still stays as wall. Players exploit this by walling enemies into small prepared pockets, or by herding them into ever smaller spaces with walls that claimed nothing, so the rest of the field fills freely.

Games: 8 · lineages: xonix, jezzball

Examples:

- **Xonix** (1984): Pockets with a ball stay sea and only the trail is converted, so trails become herding walls.
- **Araña** (1990): Field enemies can be isolated in prepared pockets so the rest fills more easily.
- **Coach Tzabar** (1997): On easy, a trapped monster prevents its area from clearing.
- **Land Breaker** (1999): Cuts with enemies on both sides stay as walls for herding enemies into smaller spaces.
- **Xonix (Taranau Aliaksei)** (2022): The goal is framed as trapping creatures to limit their movement.
- **Trappy Pixel** (2023): Trapping enemy pixels in small enclosures raises the fill.
- **Milo's Ghosts** (2023): The Blaster seals ghosts into smaller and smaller areas.
- **Quark Panic** (unknown): Every completed line becomes solid, whatever it encloses.

Variants:

- Prepared pockets: Araña isolates field enemies in pockets built in advance.
- Depends on difficulty: in Coach Tzabar a trapped monster keeps its area unclaimed on easy (on hard it self-destructs).
- The goal is framed as trapping: Trappy Pixel (trapping enemy pixels in small enclosures raises the fill) and Xonix (Taranau Aliaksei) (trap creatures to limit their movement).
- Cuts with enemies on both sides stay as walls: Land Breaker uses them to herd enemies; in Quark Panic every completed line becomes solid, whatever it encloses.
- Only the trail is converted when every pocket holds a ball: Xonix (1984).
- The Blaster seals ghosts into smaller and smaller areas: Milo's Ghosts.

## Coverage claim without enclosure

Territory is every cell painted or passed over, and there is no enclosure. In competitive versions rivals paint over each other and the largest coverage at time-out wins. In solo versions the player clears a cover cell by cell toward a target share.

Games: 8 · lineages: amidar-painter, other, io-territory

Examples:

- **Gridd Worz** (1984): A 26x20 grid is cleared one cell at a time by flying over it.
- **Splash!** (1992): A brush moving freely in 8 directions erases the blue overlay wherever it passes.
- **Penky** (1996): Players cover a share of the surface; a round is won at a set share or by majority at time-out.
- **Splatoon (Turf War)** (2015): The team covering the most turf in its colour after 3 minutes wins.
- **Paint Tanks** (unknown): Bullets recolour map cells, one cell per bullet by default.
- **Splash&Dash** (unknown (coming soon)): Every tile a kart paints is claimed; rivals paint over you.
- **BeastGrid** (2026): Classic rule set: quick tile-painting battles, suggested 60 s.
- **TERRITORY SCRAMBLE** (2026 (unreleased)): Tiles claimed by stepping; capturable cannons whose shells claim the tiles they hit.

Variants:

- Timed team coverage, where the most turf after 3 minutes wins: Splatoon (Turf War).
- Karts paint tiles and rivals paint over you: Splash&Dash.
- Quick tile-painting battles of about 60 seconds: BeastGrid's Classic rule set.
- Shots paint tiles: Paint Tanks bullets recolour one cell each by default; TERRITORY SCRAMBLE has capturable cannons whose shells claim the tiles they hit.
- Solo clearing of a cover: Gridd Worz clears a 26x20 grid by flying over the cells; Splash! erases a blue overlay wherever its brush, which moves in 8 directions, passes.
- Win by covering a minimum share, or by holding the majority at time-out: Penky (how surface is claimed is unverified).
- Enclosure added on top of coverage: TERRITORY SCRAMBLE's team loops (see 'Painted cells plus enclosure fill').

## Smaller side is claimed

Closing a cut always takes the smaller of the two regions, wherever the enemies are. Any enemy inside the smaller region is trapped there and is usually killed or switched off.

Games: 7 · lineages: qix, xonix, gals-panic

Examples:

- **Frenzy** (1984): The smaller enclosed area is always filled, so Leptons trapped there are killed.
- **Shocker** (1988): Every eel in the smaller half is deactivated for 100 points each; the smaller part is discarded.
- **Cacoma Knight in Bizyland** (1992): Closing a shape purifies the smaller of the two sections.
- **Patchwork Heroes** (2010): The smaller severed side of the warship falls off.
- **Spider Web: Akai's Journey** (2015): Returning to the edge closes an area and the smaller part is revealed.
- **Photo Slice** (2026): Closing a cut reveals the smaller of the two areas, replacing Qix's 'side without the boss' rule.
- **Territory Arcade** (2026): The smaller half is kept only when enemies sit on both sides.

Variants:

- Trapped enemies are killed: Frenzy kills the Leptons in the smaller filled area.
- Trapped enemies are deactivated for points and the smaller part is discarded: Shocker (100 points per eel).
- Presented as purifying the smaller section: Cacoma Knight in Bizyland (per Wikipedia).
- Picture reveal: Photo Slice and Spider Web: Akai's Journey reveal the smaller area, replacing Qix's 'side without the boss' rule.
- Only as a fallback when both sides hold enemies: Territory Arcade.
- Removal: in Patchwork Heroes the smaller severed side of the warship falls off.

## Subtractive cutting

The field starts filled (an object, a picture or solid ground) and cuts remove area. A line drawn all the way across severs one part, which falls away, and the goal is to clear a set share or shrink what remains below a target.

Games: 7 · lineages: xonix, qix, jezzball

Examples:

- **Antix** (1985): The field starts filled; clear a set percentage of it.
- **Fishonix** (2009): Cut away parts of a rectangular picture until less than 20% of the original remains.
- **Cubixx** (2009): Cut away and erase the cube's sides.
- **Patchwork Heroes** (2010): The smaller severed side of the warship falls off; the HUD shows the percentage of ship that remains.
- **iSlash** (2010): The cut-off part without ninja stars is removed; each level asks you to trim away most of the shape.
- **Curvebot Evolved** (2011): Each cut removes the part on one side; shrink the plane to about 20%.
- **Delta Light** (2020): The ghost Delta draws lines to remove parts of the field.

Variants:

- The field starts filled and a set percentage of it must be cleared: Antix.
- Cut a rectangular picture until less than 20% remains; a part is removed only if no fish is inside: Fishonix.
- The smaller severed side of a warship falls off, and the HUD shows how much ship remains: Patchwork Heroes.
- Each cut removes the part on one side, until about 20% of the plane is left: Curvebot Evolved.
- The sides of a cube are cut away and erased: Cubixx.
- A ghost Delta draws lines that remove parts of the field: Delta Light.
- The cut-off part without ninja stars is removed, and the share to trim grows: iSlash.

## Area model and fill computation

How a closed trail is turned into claimed area: grid or character cells flood-filled from the enemies or from the board edges, vector polygons, or the contour of a scalar field. The model sets how expensive and how precise each capture is.

Games: 7 · lineages: qix, io-territory

Examples:

- **qixxy** (2016): Claimed areas are vector polygons, not grid cells.
- **Quick Impulse Xpansion** (2021): The captured area comes from a marching-squares scalar-field extension.
- **Paper-io (MakeCode Arcade)** (2021): Traces your outer boundary and flood-fills it.
- **QIXSCII** (2023): A PETSCII field whose fill scans the whole screen in compiled BASIC; a FASTFILL build uses machine code.
- **Qixie** (2025): Capture uses a flood fill on PETSCII graphics.
- **QEX64 (Excel VBA)** (2025): A marker on a field of square cells in an Excel workbook.
- **looprush** (2026): Flood-fills from the board edges; every cell unreachable from the edge becomes yours.

Variants:

- Vector polygons instead of grid cells: qixxy.
- PETSCII character cells, filled by a whole-screen scan in compiled BASIC that takes visible time; a FASTFILL build uses machine code: QIXSCII.
- Flood fill on PETSCII graphics: Qixie.
- Captured area extended by marching squares over a scalar field, with a key (D) that shows the hit-boxes: Quick Impulse Xpansion.
- A marker on square cells in an Excel workbook: QEX64 (Excel VBA).
- Fill from outside: looprush flood-fills from the board edges and every cell they cannot reach becomes yours; Paper-io (MakeCode Arcade) traces your outer boundary and flood-fills it, overwriting other owners.

## Captured enemies respawn

An enemy removed by a capture, or crushed by placed shapes, comes back after a delay or somewhere else. Captures therefore buy time rather than lasting safety.

Games: 5 · lineages: qix, jezzball

Examples:

- **Cacoma Knight in Bizyland** (1992): Enemies trapped in chalk are destroyed only temporarily and respawn quickly.
- **Filler** (2008): A bouncing ball squashed by filler balls respawns in a top corner on the side away from where you are building.
- **Cubixx** (2009): A trapped light node disintegrates and reappears elsewhere.
- **Lightfish** (2011): Enclosed enemies respawn after a delay, so speed matters.
- **Mix** (2022): A cut-off Tracer respawns after a short delay.

Variants:

- After a delay: Lightfish (so speed matters), Mix (a cut-off Tracer returns after a short delay), Cacoma Knight in Bizyland (enemies trapped in chalk respawn quickly).
- Somewhere else: in Cubixx a trapped light node reappears elsewhere.
- Away from the builder: Filler respawns a squashed ball in a top corner on the side away from where you are building.

## Squeeze capture

An enemy is captured or destroyed when the open region confining it shrinks below a size threshold or pins it. No single cut has to enclose it fully.

Games: 5 · lineages: volfied, jezzball

Examples:

- **Late** (2005): Unstable triples (groups of three balls) explode when enclosed tightly enough.
- **Animal Volfied** (2016): Shrinking the open area traps and destroys enemies.
- **Narrow the Siege** (2022): Shrinking a monster's free area far enough bursts its bubble and captures it.
- **Voltcore** (2026): Enemies can be crushed by trapping them in corners.
- **JayBall** (unknown): Win by trapping the single ball in a region smaller than 625 pixels.

Variants:

- Shrinking the open area traps and destroys enemies: Animal Volfied.
- Enemies are crushed when pinned in a corner: Voltcore (added in 1.0.1).
- Tight enclosure sets off a group: Late's unstable triples of balls explode.
- A monster's bubble bursts once its free area is small enough: Narrow the Siege.
- A fixed size threshold as the win condition: JayBall's single ball must be trapped in a region smaller than 625 pixels.

## Painted cells plus enclosure fill

Every cell the player crosses becomes territory at once, with no vulnerable trail, and any region fully enclosed by the player's own cells is claimed as well.

Games: 5 · lineages: qix, other, io-territory

Examples:

- **Moss Covers Everything** (unknown): Every square crossed becomes moss, and closing a loop of moss fills the enclosed interior.
- **Realm of Tile** (2022): Enclosing a region with converted tiles claims all of it; larger enclosures give larger rewards.
- **Territory Arrow** (2026): The trail the arrow carves along the glowing shape claims territory.
- **TERRITORY SCRAMBLE** (2026 (unreleased)): Hex tiles claimed by stepping; team loops capture the inside, as an option that can be switched off.
- **Tetro Domain** (2026): Any territory fully enclosed by your claims is captured automatically.

Variants:

- Every square crossed becomes moss, and a closed loop of moss fills its interior: Moss Covers Everything.
- The trail carved along a glowing shape claims territory: Territory Arrow.
- Tiles are converted by dragging over them; enclosing a region with converted tiles claims all of it, and bigger enclosures pay more: Realm of Tile.
- Hex tiles are claimed by stepping on them, and team loops capture what is inside (an option that can be turned off): TERRITORY SCRAMBLE.
- In a turn-based game, territory fully enclosed by your claims is captured automatically: Tetro Domain.

## Elimination erases the victim's territory

When a player is eliminated, their claimed land goes back to empty, either all of it or only within one region, and is open to everyone again.

Games: 5 · lineages: io-territory

Examples:

- **Splix.io** (c. 2016 (unconfirmed)): A killed player's whole claimed area is removed.
- **Paper.io 2** (2018): Hitting a rival's exposed tail erases their whole territory.
- **Paper-io (MakeCode Arcade)** (2021): A dead snake's territory is wiped to empty and its colour returns to the spawn pool.
- **DroneXtreme: Territory Capture** (2026): Cutting a rival's trail wipes that rival's land in that area only.
- **Pengu Floe** (2026): A cut penguin drops into the sea with all its territory.

Variants:

- All of the territory is removed: Splix.io; Paper.io 2 when a rival hits your exposed tail.
- The land is wiped and its colour goes back to the spawn pool: Paper-io (MakeCode Arcade).
- Only the victim's land in that area is wiped: DroneXtreme: Territory Capture.
- A cut penguin drops into the sea with all its territory: Pengu Floe.

## Triangle enclosures

The only enclosure shape is a triangle between three anchors or strands, and closing one captures or claims everything inside it.

Games: 5 · lineages: other

Examples:

- **Star Trigon** (2002): Uchijins inside a completed jump triangle are rescued.
- **Spider: The Secret of Bryce Manor** (2009): A closed triangle of strands forms a web that catches the insects inside.
- **Ingress** (2013): Linking three portals creates a control field that claims the Mind Units beneath it.
- **Spider: Rite of the Shrouded Moon** (2015): Triangle webs catch flying insects.
- **Pulsebound: The Expanse** (unknown): A triangle between three relay towers claims the ground inside.

Variants:

- Linking three portals creates a control field that claims the Mind Units beneath it: Ingress.
- Jump triangles rescue the Uchijins inside: Star Trigon.
- Strands that close a triangle form a web that catches the insects inside: Spider: The Secret of Bryce Manor, Spider: Rite of the Shrouded Moon.
- A triangle between three relay towers claims the ground inside: Pulsebound: The Expanse.

## Enclosed pickups and objectives

Special objects placed in the field are collected by enclosing them in a capture. They trigger a reward, give an item, or are themselves the level goal.

Games: 4 · lineages: qix, xonix

Examples:

- **Laser Strixx 2** (1995): Capturing a special 'mouth' object triggers a bonus sequence at the end of the level.
- **Qix Adventure** (1999): Treasure chests released by captured monsters are claimed for items.
- **Dino Master** (2005): Any fossil inside the closed line is uncovered; uncovering fossils replaces the area quota.
- **Gotta Xonix** (2026): A capture target that must be met together with collecting energy nodes.

Variants:

- Triggers an end-of-level bonus sequence: Laser Strixx 2's 'mouth' object.
- Treasure chests released by captured monsters are claimed for items: Qix Adventure.
- Replaces the area quota: Dino Master uncovers any fossil inside the closed line, and uncovering fossils is the goal.
- Required alongside the quota: Gotta Xonix also needs its energy nodes collected (how they are collected is not described).

## Smaller piece sinks

Cuts run along fault lines or trails across an island or a sheet of ice. When the land splits, the smaller piece sinks and kills everything on it, the player included.

Games: 4 · lineages: other

Examples:

- **Dig Dug II** (1985): Jackhammer cracks along fault lines; the smaller part sinks with everything on it, player included if careless.
- **Thin Ice (described in the Disco No. 1 entry)** (1986): A penguin's white trail carves out sections of ice that sink; sink five penguins.
- **Dig Dug: Digging Strike** (2005): Stakes create a fault line that sinks a section of the island, which is how the boss is sunk.
- **Dig Dug Island** (2008): Online island cutting: the smaller piece sinks with every enemy on it.

Variants:

- A jackhammer cracks predefined fault lines, and the smaller part sinks with every enemy on it, and with the player if careless: Dig Dug II.
- The same island cutting in an online multiplayer game: Dig Dug Island.
- Stakes lined up underground make a fault line that sinks a section of the island on the top screen, which is how the boss is sunk: Dig Dug: Digging Strike.
- A penguin's trail carves out sections of ice that sink, and the goal is to sink five penguins: Thin Ice.

## Absolute count clear condition

The clear condition counts cells or blocks instead of measuring a share of the field. Either the player must claim a fixed number of tiles, or the level ends once the unclaimed cells fall to a set budget.

Games: 3 · lineages: xonix, jezzball

Examples:

- **Xonix (KolibriOS)** (2006): The level ends when unclaimed cells fall to 30 x (level+1) + level, so crowded levels need less exact filling.
- **Ronix** (unknown): Fill more than 200 tiles.
- **Q\*BALL** (2025): Clear at least 16 blocks per level.

Variants:

- Remaining-cell budget that grows with the level, and so with the enemy count: Xonix (KolibriOS) ends a level when unclaimed cells fall to 30 x (level+1) + level.
- Fixed claimed-tile target: Ronix requires more than 200 tiles; the author made up the rule after failing to work out Xonix's from videos.
- Per-level block quota: Q\*BALL requires at least 16 blocks cleared per level.

## Auto-complete above a threshold

Once the claimed area passes a threshold, the rest of the field or picture is claimed or revealed automatically, or every remaining enemy counts as captured.

Games: 3 · lineages: qix

Examples:

- **Frenzy** (1984): All Leptons count as captured once 95% of the screen is filled.
- **LadyLove** (1990): Uncovering 80% reveals the rest of the photo automatically.
- **Perestroika Girls** (1993): Claiming more than 80% reveals the whole picture.

Variants:

- Every remaining enemy counts as captured at 95% filled: Frenzy.
- The rest of the photo is revealed at 80%: LadyLove.
- The whole picture is revealed above 80%: Perestroika Girls.

## Type-specific enclosure outcome

What an enclosure does to an enemy depends on the enemy's type. Most are killed or removed for a while, while particular types (the boss, or special enemies) are exempt, destroyed or treated differently.

Games: 3 · lineages: other, volfied, qix

Examples:

- **Libble Rabble** (1983): Most looped enemies are sent to the top of the screen for a short time; Killers, Changers and Demons are destroyed.
- **Volfied** (1989): The boss holds its region open; enclosed minions die for a bonus.
- **Megami Tensei QIX Persona 3** (2007): Enclosing an area defeats the enemies inside it, except the boss.

Variants:

- Libble Rabble sends most looped enemies to the top of the screen for a short time, but destroys Killers, Changers and Demons.
- Megami Tensei QIX Persona 3 defeats every enclosed enemy except the boss.
- In Volfied the boss's region stays open, while minions on the claimed side die.

## Captures damage the boss

Captured area is turned into damage against the boss. A single capture above a size threshold strikes the boss or lets the player attack it, or reaching the stage target destroys it.

Games: 3 · lineages: gals-panic, volfied

Examples:

- **Gals Panic S - Extra Edition** (1997): Claiming a large area in one capture (or a P item) lets the player shoot at the boss.
- **Volfi: Cyber Territory Arcade** (2026): Reaching the per-arena target destroys the guardian boss.
- **Beauty Territory - Qix Fantasy** (unreleased): Claiming a huge area in one move strikes the boss; enough hits stun it.

Variants:

- A large single capture, or a P item, lets the player shoot the boss: Gals Panic S - Extra Edition.
- A huge single capture strikes the boss directly, and enough hits stun it, giving a window to expand safely; one line can flip a large part of the board: Beauty Territory - Qix Fantasy.
- Reaching the per-arena target (75-85%) destroys the guardian boss: Volfi: Cyber Territory Arcade.

## Capture completion kills enemies

Enemies die because a capture event completes, not because they are enclosed. Finishing a path, collecting a goal object or completing the board kills the enemies on the line involved, or every enemy on the board.

Games: 3 · lineages: amidar-painter

Examples:

- **Macho Mouse** (1982): Enemies on a dotted pathway when a flag is collected are killed.
- **Zoom!** (1988): Completing a board kills all its enemies.
- **Wonder Stick** (1998): The tag moving along the drawn line kills the enemies it touches.

Variants:

- Collecting a flag kills enemies standing on dotted pathways: Macho Mouse.
- Completing a board kills all its enemies: Zoom!.
- A tag running along the drawn line kills the enemies it touches: Wonder Stick.

## Enclose hazards to neutralise them

Hazard zones in the terrain are cleared by enclosing them in a capture, and some can only be removed that way.

Games: 3 · lineages: qix, volfied, xonix

Examples:

- **Poison Control** (2020): Areas of poison swamp must be encircled to purify and beat them.
- **Territory Raider** (2026): Enclosing a hazard patch removes it; fire patches burn the trail back and must be surrounded.
- **Xonix32 (Android)** (unknown (last updated 2020)): A black hole is sealed only when it is enclosed with no enemy inside.

Variants:

- Poison swamp must be encircled ('rounded off') to purify it, inside a larger action game: Poison Control.
- Enclosing a hazard patch removes it, and fire patches, which burn the trail back, must be surrounded: Territory Raider.
- A black hole is sealed only when it is enclosed with no enemy inside: Xonix32 (Android).

## Connected growth only

A new claim counts only if it touches territory the player already holds, so territory grows outward from what is owned and enclosures that do not connect to it are discarded.

Games: 3 · lineages: amidar-painter, io-territory, other

Examples:

- **Amidar** (1982): On roller stages, new boxes must touch already-claimed territory.
- **Grid Riders** (2026): Areas not connected to your existing territory are discarded.
- **Tetro Domain** (2026): Each turn claim one vacant territory adjacent to the central castle or to land you own.

Variants:

- On roller stages, new boxes must touch territory already claimed: Amidar.
- Each turn claims one vacant territory next to the central castle or to land already owned: Tetro Domain.
- Enclosed areas not connected to your existing territory are discarded: Grid Riders.

## Enclosures must hold

Territory stays yours only while its enclosure is intact. A breach in any wall or link loses the area and anything built on it.

Games: 3 · lineages: other, qix

Examples:

- **Rampart** (1990): After combat, any area no longer fully walled in is lost with its cannons.
- **Ingress** (2013): Destroying any one link breaks a field.
- **Moonlight Territory** (2026): Wooden or stone walls with different durability; wolves chew them, and a broken wall collapses the territory around it.

Variants:

- After combat, any area no longer fully walled in is lost along with its cannons, and a player with no enclosed castle at the end of a build phase loses: Rampart.
- Destroying any one link breaks a field, and a portal left with fewer than 3 resonators loses all its links and fields: Ingress.
- Walls have durability: normal lines make wooden walls and slow lines make stone forts with double durability; wolves chew through walls once the bow is unlocked, and a broken wall collapses the territory around it and damages a player caught inside: Moonlight Territory.

## Multi-loop capture gauge

A target needs several completed loops. Each loop ticks a counter or fills a gauge, and breaking the line resets or drains the progress.

Games: 3 · lineages: other

Examples:

- **Pokémon Ranger** (2006): Each Pokémon needs N loops; the counter drops by one per loop and resets if the line is broken.
- **Pokémon Ranger: Shadows of Almia** (2008): A Friendship Gauge filled by loops replaces the fixed count.
- **Encircle (Cyantist)** (2025): Each loop weakens an enemy and fills its seal gauge; a full gauge captures it.

Variants:

- Each Pokémon needs a set number of loops; the counter above it drops by one per loop and resets if the line is broken: Pokémon Ranger.
- A Friendship Gauge filled by loops replaces the fixed count, and levelling the Styler makes each loop fill more: Pokémon Ranger: Shadows of Almia.
- Each loop weakens an enemy and fills its seal gauge, so tough enemies need several loops: Encircle (Cyantist).

## Immobilisation clear

If every enemy is left unable to move for a set time, the stage clears whatever the claimed area.

Games: 2 · lineages: volfied, qix

Examples:

- **Volfied** (1989): Leaving the enemies unable to move for a set time clears the stage, for 100,000 points.
- **Boundarpy** (c. 2019): 'CLEAR' once the single bouncing enemy stays still for 30 frames.

Variants:

- The single bouncing enemy stays still for 30 frames and the game shows 'CLEAR': Boundarpy.
- Hidden rule worth 100,000 points: Volfied clears the stage when the enemies cannot move for a set time.

## Selective enclosure

Good and bad objects share the field, and only the right kind should be enclosed. The wrong kind is a hazard or has to be handled by a different action.

Games: 2 · lineages: qix

Examples:

- **Love Me** (c. 2018): Slash 'bad' objects Fruit Ninja-style and circle 'good' ones Qix-style.
- **NEON CUT** (2026): Capture shapes of the target colour; keep wrong-coloured shapes away from the open line.

Variants:

- Colour matching: NEON CUT scores bouncing shapes of the target colour, and shapes of other colours must be kept away from the open line.
- Circle the good, slash the bad: Love Me collects good objects with a Qix-style loop and destroys bad ones with a Fruit Ninja-style slash.

## Sum-of-sizes goal

The level goal is a fixed total summed over the shapes the player has placed, either their area or a counter, rather than a share of the field.

Games: 2 · lineages: jezzball

Examples:

- **色球圈地** (2010): The level clears when the balls' combined area passes a target.
- **Hundreds** (2013): The level clears when the circles' numbers total 100.

Variants:

- Combined area of the balls passes a target: 色球圈地.
- The numbers on the circles total 100: Hundreds.

## Rectangle-only cuts

Every capture is an axis-aligned rectangle closed by the trail, rather than a free polygon.

Games: 2 · lineages: qix

Examples:

- **Night Flight** (1982): The plane's trail fills a rectangle when it closes it.
- **Doodlebug** (1984): Rectangles are drawn up from the filled bottom of the screen.

Variants:

- The plane's trail fills a rectangle when it closes: Night Flight.
- Rectangles are drawn up from the filled floor and fill their bounding box down to it: Doodlebug (see 'Floor-up fill').

## Floor-up fill

Claimed area grows up from a filled floor. Closing a line fills everything between it and the floor below, and play works upward until the fill reaches the top. Under gravity, the floor can later collapse and the game is played for distance.

Games: 2 · lineages: qix, jezzball

Examples:

- **Doodlebug** (1984): Each rectangle fills its bounding box down to the floor; the level is won when the fill reaches the top row.
- **FillBottom** (2020): Once the line completes, blocks pile up to fill it; a ball they hit bursts; you keep filling as blocks collapse.

Variants:

- Each rectangle fills its bounding box down to the floor, and the level is won when the fill reaches the top row: Doodlebug.
- Blocks pile up under gravity to fill a completed line and burst any ball they hit; the filled floor later collapses and must be refilled: FillBottom.

## Multi-layer capture

The same ground must be captured several times in a row, each pass turning it into the next layer, before it counts as fully claimed or the stage moves on.

Games: 2 · lineages: xonix

Examples:

- **Bolyx** (2001): Three colour stages in sequence; each must be restored before the next.
- **Urbanix** (2010): Town needs 1 pass, North Pole 2, Moon Base 3.

Variants:

- The number of passes depends on the world: Urbanix (Town 1, North Pole 2: clear the snow, then conquer the land; Moon Base 3).
- Three colour stages in a row (blue, green, red), each restored before the next: Bolyx.

## Elimination annexes the victim's territory

The player who eliminates a rival takes over the rival's land, and in one game the rival's unfinished trail as well.

Games: 2 · lineages: io-territory

Examples:

- **Pauper.Io!** (2026): Cutting an opponent's trail gives you its territory and its unfinished trail.
- **圈地大作战** (2026): Killing a rival annexes all of their land.

Variants:

- Cutting an opponent's trail gives you its territory and its unfinished trail: Pauper.Io!.
- Killing a rival annexes all of their land: 圈地大作战.

## Region majority bonus

The map is divided into named regions, and holding a majority of a region, or securing it, grants its remaining open land or a bonus.

Games: 2 · lineages: io-territory

Examples:

- **DroneXtreme: Territory Capture** (2026): Owning more than half of one of 221 city regions also gives you its remaining open land.
- **Snake Conquest** (2026): Securing countries on the world map grants bonuses.

Variants:

- Owning more than half of one of 221 city regions also gives you its remaining open land: DroneXtreme: Territory Capture.
- Securing countries on the world map grants bonuses: Snake Conquest.

## Enclose to stun, then finish

Enclosing a target only stuns it. A second action, such as kicking it into a pen or eating it, completes the capture.

Games: 2 · lineages: other

Examples:

- **Rodeo Rampage** (2025): Enclosing an animal stuns it; kick it into its matching pen to score.
- **Schloop** (2025): Wall all four sides of a researcher's tile to stun it, then eat it to grow longer.

Variants:

- An enclosed animal is pulled toward you and stunned, then kicked into its matching pen to score: Rodeo Rampage.
- Researchers will not step on slime, so walling all four sides of a researcher's tile with slime or your body stuns it, and eating it makes you longer: Schloop.

## Enclosure upgrades contents

Each enclosure raises everything inside it by one value tier instead of removing it, so looping the same spot again builds value.

Games: 2 · lineages: other

Examples:

- **Do! Run Run** (1984): Every dot inside goes up one tier, from dot to pineapple (10 to 160 points).
- **Mr. Do! Run Run (Atari ST)** (1990): Looping dots turns them into cherries; enclosing fruit again upgrades it a tier.

Variants:

- Every dot inside an enclosure goes up one tier: dot, cherry, apple, lemon, pineapple (10 to 160 points); higher tiers recharge the powerball faster: Do! Run Run.
- Looping dots turns them into cherries, and enclosing fruit again upgrades it one tier: Mr. Do! Run Run (Atari ST).

## Tile flipping as capture

Tiles cover the picture and the player flips them one at a time; flipping them all clears the stage, and flipping the tile an enemy stands on kills it.

Games: 2 · lineages: other

Examples:

- **Lady Killer** (1993): The diver dives into the board and surfaces to flip tiles; flipping every tile clears the level.
- **Party Time: Gonta the Diver II** (1995): A tile-flipping picture reveal following Lady Killer's diver.

Variants:

- The diver dives into the board and surfaces to flip tiles: Lady Killer.
- The same tile-flipping picture reveal, following Lady Killer's diver: Party Time: Gonta the Diver II.

## Fewer-enemies side is claimed

When a line closes, the side containing fewer enemies is filled. This is the JezzBall-inspired rule that replaces Qix's 'side without the Qix'.

Games: 1 · lineages: qix

Examples:

- **Bix** (2008): Closing a line fills the side with fewer balls.

Variants:

- Bix fills the side with fewer balls.

## Captured enemies become ammunition

Enemies deactivated by a capture turn into objects the player can push, and pushing one into a live enemy destroys that enemy.

Games: 1 · lineages: qix

Examples:

- **Moss Covers Everything** (unknown): Enemies caught inside filled moss become pushable skulls; pushing a skull into a bug destroys it.

Variants:

- In Moss Covers Everything, enemies caught in filled moss become harmless skulls, and pushing a skull into a bug destroys the bug.

## Lure enemies into each other

Enemies that move toward the player are led into dents in the trail and enclosed with no gaps, where they destroy one another.

Games: 1 · lineages: other

Examples:

- **YOUR GAME** (2023): Lure enemies into dents of your trail, enclose them in red floor with no gaps, and make several kill each other.

Variants:

- In YOUR GAME, enemies walk toward the player; enclose several of them in red floor and they kill each other.

## Pen and separate

Fences enclose roaming creatures into pens, and incompatible kinds must end up in different pens, or one eats the other.

Games: 1 · lineages: qix

Examples:

- **Critter Round-Up** (2008): Pen escaped animals by species; a crocodile and a chicken in one pen is a loss.

Variants:

- Critter Round-Up: escaped animals must be penned by species, and a crocodile and a chicken in one pen is a loss.

## Equal-count quadrant split

One horizontal and one vertical line split the field into four quadrants. The goal is to place them so that every quadrant holds the same number of balls.

Games: 1 · lineages: jezzball

Examples:

- **Linsips** (2026): The goal is equal ball counts in every quadrant instead of a percentage target.

Variants:

- Linsips: equal ball counts in every quadrant replace a percentage target.

## Catch-count goal

The aim is to catch as many roaming hazards as possible by penning them; captured area is not the target.

Games: 1 · lineages: jezzball

Examples:

- **caffeinatedsheep** (2018): Build fences to pen sheep; the goal is the most sheep caught, not an area percentage.

Variants:

- caffeinatedsheep: fences pen sheep, and the goal is the most sheep caught.

## Linked targets

Some growable targets are linked and must be activated together; touching only one of them does not count.

Games: 1 · lineages: jezzball

Examples:

- **Hundreds** (2013): Linked circles must be touched together.

Variants:

- Hundreds: linked circles must be touched together.

## Colour-swap capture grid

The field is a grid of coloured blocks, and moving along the borders between blocks swaps their colours. Territory is made and enemies are trapped by matching colours, not by enclosing them.

Games: 1 · lineages: xonix

Examples:

- **Clax** (1985): Crossing block borders swaps colours; a smiley is trapped when its colour matches the block it stands on.

Variants:

- Clax: a smiley is trapped and stops moving when its colour matches the block it stands on.

## Isolation decay of cut-off cells

Cells cut off from both the player and every enemy are not claimed at once; they decay out of play over time.

Games: 1 · lineages: jezzball

Examples:

- **Q\*BALL** (2025): Blocks cut off from both the player and the q\*balls slowly decay; clear at least 16 blocks per level.

Variants:

- Q\*BALL: blocks cut off from both the player and the q\*balls slowly decay.

## Capture by disconnection

Each player has a start area. Cutting a rival's territory off from its start area captures every part that becomes disconnected.

Games: 1 · lineages: io-territory

Examples:

- **Grid Riders** (2026): Cutting a rival's territory off from their start area captures everything disconnected.

Variants:

- Grid Riders: severing a rival's land from its start area captures everything disconnected.

## Losing all land is death

A player whose territory is reduced to zero cells by rivals' captures is eliminated.

Games: 1 · lineages: io-territory

Examples:

- **Paper-io (MakeCode Arcade)** (2021): A snake whose territory is reduced to zero tiles dies.

Variants:

- Paper-io (MakeCode Arcade): a snake whose territory falls to zero tiles dies.

## Simultaneous claim neutralises

If two players claim the same cell in the same tick, the cell becomes neutral instead of going to either of them.

Games: 1 · lineages: io-territory

Examples:

- **looprush** (2026): A cell claimed by two players in the same tick becomes neutral.

Variants:

- looprush: a cell claimed by two players in the same tick becomes neutral.

## Enclosures grant production

Each enclosed objective grants units, which can be placed only inside the player's enclosed territory.

Games: 1 · lineages: other

Examples:

- **Rampart** (1990): Each fully enclosed castle grants cannons, placed only inside your enclosed territory.

Variants:

- Rampart: each fully enclosed castle grants cannons (two for the home castle), placed only inside your enclosed territory.

## Anchor object must be inside the loop

A loop captures only if a particular fixed object lies inside it; otherwise nothing is taken.

Games: 1 · lineages: other

Examples:

- **Sewernir** (2025): Closing a loop sucks the enemies inside into a pipe, which must lie inside the loop.

Variants:

- Sewernir: closing a loop sucks the enemies inside into a pipe, and the pipe must lie inside the loop or nothing is captured.

## Minimal-enclosure treasure

Hidden items sit somewhere in the field. A detector signals when a closed loop contains one, and the item opens only when a small loop covers it and no other possible hiding place.

Games: 1 · lineages: other

Examples:

- **Libble Rabble** (1983): A detector signals a hidden chest; it opens only when enclosed by a small area covering only the chest.

Variants:

- Libble Rabble: a detector signals a hidden chest, which opens only when enclosed by a small area covering just the chest.

## Recolour own markers

A player can spend time changing the colour of markers already laid, paying in tempo and position.

Games: 1 · lineages: other

Examples:

- **Harapeko Bakka** (1994): Eating laid eggs changes their colour; it costs time and can leave you outmanoeuvred.

Variants:

- Harapeko Bakka: eating laid eggs (B button) changes their colour, but it costs time and can leave you outmanoeuvred.

## Walls throttle enemies

Every lasting wall on the field lowers the number of enemies that can be active at once, so building walls gradually restricts the enemy.

Games: 1 · lineages: other

Examples:

- **Spider Web** (1989): The more strands on the field, the fewer flies may be active at once.

Variants:

- Spider Web (1989): the more strands on the field, the fewer flies can be active at once.

## Living territory effects

Claimed ground has active defensive effects on enemies, and the effect depends on the chosen character.

Games: 1 · lineages: qix

Examples:

- **NoSpace Arena** (2026): Captured ground gives Pulse, Drag or Halt effects; each character brings its own territory effect.

Variants:

- NoSpace Arena: captured ground gives Pulse, Drag or Halt effects (not explained), and each unlockable character brings its own territory effect.

## Captured pieces become puzzle blocks

Each region cut out of the field becomes a block, which the player then stacks Tetris-style for points.

Games: 1 · lineages: qix

Examples:

- **Tetrangle** (2012): Areas cut out of the field become blocks stacked Tetris-style to score.

Variants:

- Tetrangle: pieces cut out of the field are stacked Tetris-style to score.

## Prisoners lost if cut off

Rescue targets sit in the field. Touching one rescues it, but a cut that severs it first loses it. Rescued allies act as the player's lives.

Games: 1 · lineages: qix

Examples:

- **Patchwork Heroes** (2010): Allies in prisons on the ship are lost if cut off before rescue.

Variants:

- Patchwork Heroes: allies held in prisons on the ship are lost if they are cut off before rescue; the game is over when every ally is killed, or when you are hit with none left.

## Match-three clearing as capture

Territory is won by clearing lines of three or more same-coloured blocks pushed into the field. Each cleared block uncovers part of the picture and shrinks the board.

Games: 1 · lineages: other

Examples:

- **Crawlco Block Knockers** (2019): Pull or kick incoming blocks into lines of three; cleared blocks reveal the hidden image and shrink the board.

Variants:

- Crawlco Block Knockers: incoming blocks are pulled or kicked into lines of three, and cleared blocks reveal the hidden image.

## Area bombs uncover

Each dropped bomb clears a fixed patch of the grid covering the picture. An enemy that rolls over a bomb as it explodes smothers the blast, and that patch stays covered.

Games: 1 · lineages: other

Examples:

- **The Return of Lady Frog** (1993): Each bomb clears a 3x3 area over the photo; a balloon over an exploding bomb smothers it.

Variants:

- The Return of Lady Frog: each bomb clears a 3x3 area over the photo; bombs do not hurt balloons, but a balloon over an exploding bomb smothers it.
