# Mechanics: movement and drawing

The 73 mechanic families of the axis *movement and drawing*: how the player moves and draws: rail or free movement, draw speeds, trail rules, fuses, diagonal moves, auto-draw, stopping, shapes drawn. The [taxonomy](../TAXONOMY.md) summarizes the axis and lists the 12 axes. **Games** counts the catalog games that show a family, as the merging agent counted them.

## Home-territory loop capture (Paper.io model)

The safe base is the player's own territory blob, not the screen border. Moving out of it lays a trail. Re-entering your own territory closes the loop, and the trail plus everything it encloses against your territory becomes yours. No trail is laid while inside home, and the excursion is exposed until it closes. This is the io-territory model; single-player games used it first.

Games: 54 · lineages: io-territory, xonix, other

Examples:

- **Territoire** (1985): Two snakes each mark out their own terrain; whoever encloses the most area wins.
- **陣取り (Evio)** (1993): Single-player: the dot grows its own territory, leaving it lays a yellow line and returning adds the enclosed part; the outer frame is lethal.
- **Queeks** (1996): Yellow/green territory plus an 'expedition line' used to enclose snakes.
- **Paper.io** (2016): Leave your land to draw a tail, return to your land to claim the loop.
- **Splix.io** (c. 2016 (unconfirmed)): Grid version: leave your area, draw a line cell by cell, reconnect to claim the enclosed shape.
- **Hexar.io** (2017): Enclose an area on hexagon blocks and reconnect to your base.
- **Paper.io 3D** (2020): The same loop drawing done over the surfaces of 3D shapes.
- **Paper-io (MakeCode Arcade)** (2021): On a tile map, returning traces your outer boundary and flood-fills it.
- **Scalar Snake** (2024): The snake's own body encloses areas; captured blocks grow the snake.
- **Pyrodrome** (2025): A drifting truck leaves a fire trail; closing the loop captures the inside.
- **Marble Land Grab** (2026): Flick a marble out and back within 3 flicks; everything inside its path is claimed.
- **Pauper.Io!** (2026): Leave territory, draw a trail and return to claim it, on a Plus/4 character grid.

Variants:

- 陣取り (Evio) (1993): single-player; the territory grows from its own blob, leaving it lays a yellow line, and the outer frame is lethal rather than safe
- Queeks (1996): own territory plus an 'expedition line' used to enclose snakes
- Territoire (1985): two snakes each mark out their own terrain; most enclosed area wins
- Conquerors (c. 2019): two bugs start from small corner bases and loop back to fill
- Splix.io, Paper Loop, Pauper.Io!, TileMan.io: grid version with the trail drawn cell by cell (Pauper.Io! on a Plus/4 character grid)
- Hexar.io, String.io, Superhex.io, Hexanaut.io: loops captured on hexagon tiles
- Paper.io 3D, Slide.io, Zone Clash: Territory Wars 3D: loops drawn over 3D shapes or in a 3D arena
- Grid Riders (2026): only enclosed areas connected to your territory count
- Turfrush (2026): enclosing also claims land already owned by bots
- looprush (2026): returning home flood-fills from the board edges; Paper-io (MakeCode Arcade) traces your outer boundary and flood-fills it
- Loop: Land Grab (2026): longer excursions grab more
- Scalar Snake (2024): the snake's own body is the enclosing line
- Wrangler (2025): a rope is looped to expand territory
- Pyrodrome (2025), Qixotic (2025), Kingpins.io, Turf Rollers (2026): the trail is laid by a drifting truck, hoverbikes, cars or a paint roller
- Marble Land Grab (2026): a flicked marble must return within 3 flicks
- Warix (TBA): a twin-stick fighter lays the trail
- Plotta: Walking Map Game (2026): the loop is walked on real streets (see GPS walking capture)
- Territory Grid: the trail is a wide path
- BeastGrid (2026): a Capture rule set with a suggested 120 s round
- SwarmBlitz (2026): trail-and-enclose capture feeds a roguelike run
- King.io: Conquer The World (2021): touch-and-drag drawing expands territory
- kux.io (2017): Splix.io-style floodfill claiming; completeness unconfirmed
- Pap.io: Zone Battle (2025), Frontiers.io (2017): the trail must close before a rival cuts it

## Open trail vulnerable to enemies

While a cut is open, an enemy touching any point of the unfinished trail, not only the marker, costs a life, ends the attempt or fails the stage. The border or claimed land is safe ground. Some games give each enemy class its own kill zone. Where contact only erases the trail, see 'Enemy cuts or erases the open trail'.

Games: 43 · lineages: qix, xonix, gals-panic, io-territory

Examples:

- **Qix** (1981): The Qix touching the marker or the unfinished Stix costs a life; Sparx do not run on unfinished Stix.
- **quix (QIX on Unix)** (c. 1982-1984): The Qix kills only by crossing the open trail and cannot touch the player on the border; Sparx kill only on the border.
- **Night Flight** (1982): An enemy touching the unfinished trail destroys the plane.
- **Xonix** (1984): A sea ball touching the trail costs a life.
- **Skyx** (1988): A fast green alien (or mask) kills instantly if it touches the line being drawn.
- **Xonix (X11/Macintosh reimplementation)** (1995): Flyers kill by touching the player or the open trail; land 'eaters' only by touching the player.
- **Xobox (Rockbox plugin)** (2006): A qix touching the open trail erases it, sends the player back to start and costs one of 3 lives.
- **Pac-Xon** (by early 2010): Ghosts touching the unfinished trail cost a life.
- **Pretty Girls Panic!** (2016): An enemy touching the tool or the cut line costs a tool (life).
- **Frontiers.io** (2017): The trail is vulnerable until the area is enclosed; anyone crossing it kills you.
- **Fill It! Arcade** (2026): Only trail already drawn can be hit; the planned route ahead cannot.
- **Pixect: Retro Pixel Arcade** (2026): Bouncing cores and fired bullets try to intercept the line being drawn.

Variants:

- Qix (1981): the Qix touching the marker or the unfinished Stix costs a life; Sparx do not run on unfinished Stix
- quix (QIX on Unix) (c. 1982-1984): per-class kill zones; the Qix kills only by crossing the open trail, Sparx only on the border
- Xonix (X11/Macintosh reimplementation) (1995): flyers kill through the player or the trail; land 'eaters' only by touching the player
- Doodlebug (1984): the Bug kills only by touching the line of an unfinished rectangle
- Xobox (Rockbox plugin) (2006): a qix touching the trail erases it, sends the player back to start and costs one of 3 lives
- Pixect: Retro Pixel Arcade (2026), Pix Panic, Landgrab - Line Cutting Arcade: projectiles (bullets, boss lasers) hit the open line as well as bodies
- NEON CUT (2026): only wrong-coloured shapes must be kept off the open line
- Fill It! Arcade (2026): only trail already flown can be hit; the sketched route ahead is harmless
- Xonix Wars Territory Capture (2026): some enemies track the tank and destroy it by hitting its trail
- Pretty Girls Panic! (2016): contact costs a tool (life)
- Arcade Land Grab: Line Game (2026), HIDDEN JOURNEY: ASIA (2026), Fill Qix: Block Fill Puzzle (2026): one contact ends the game, the stage or the attempt
- Frontiers.io (2017), Pap.io: Zone Battle (2025): rival players crossing your trail before it closes kill you
- Claim (DaNuTree) (2026): having your trail cut by a guard costs a life

## Self-crossing penalty (own trail is lethal)

The player's own unfinished trail is an obstacle. Touching or crossing it, or boxing yourself in with it, costs a life, ends the run or lights a Fuse, so cuts must be drawn without loops. Some arcade games make it an operator option, and some extend it to reversing along the trail.

Games: 38 · lineages: qix, xonix, gals-panic, io-territory

Examples:

- **Qix** (1981): Trapping yourself triggers the Fuse (the 'Spiral Death Trap').
- **quix (QIX on Unix)** (c. 1982-1984): Crossing or doubling back on your own trail spawns a Fuse.
- **RollerBall** (1983): Touching your own trail costs a life.
- **Zolyx** (1987): Touching your own unfinished trail is fatal.
- **Araña** (1990): Crossing your own trail or retracing your path costs a life.
- **Laser Strixx 2** (1995): An operator option makes touching your own line deadly.
- **Lovely Girls** (1998): Touching your own trail costs a life, and you respawn at top centre.
- **Megami Tensei QIX Persona 3** (2007): Touching your own line while drawing outside your territory costs one of the stage's 3 lives.
- **Paper.io 2** (2018): Crossing your own tail is game over.
- **Line Fight** (unreleased (Steam coming soon)): Touching any line, yours or a rival's, eliminates you.
- **Pengu Floe** (2026): Crossing your own track drowns you.
- **RetroQix** (2026): Flying into your own trail costs 500 points and resets the line (v1.7).

Variants:

- Qix (1981): boxing yourself in triggers the Fuse (the 'Spiral Death Trap') rather than instant death
- quix (QIX on Unix) (c. 1982-1984): crossing or doubling back on the trail spawns a Fuse
- Harem Challenge (1995), Laser Strixx 2 (1995): an operator option makes touching your own line deadly
- Lovely Girls (1998): costs a life and respawns you at top centre
- RetroQix (2026): costs 500 points and resets the line instead of a life (v1.7)
- LandSlicer: Slice & Conquer (2026): a self-crossing breaks the trail as an enemy would
- Blobbed Away (2025), Araña (1990): moving backward along the trail is also fatal
- Line Fight, Paper-io (MakeCode Arcade) (2021): any trail, yours or a rival's, is lethal
- Pengu Floe (2026): crossing your own track drowns you
- Claim (DaNuTree) (2026): costs one of 3 lives, but you can shoot your own trail to escape
- Megami Tensei QIX Persona 3 (2007): costs one of the stage's 3 lives
- Xonix Casual Edition (2023): ends the attempt, like a drone hitting the trail

## Point-launched growing wall (JezzBall model)

There is no edge-walking marker. The player picks any open cell with a pointer, or fires from a pointer-placed shooter, and a straight horizontal or vertical wall grows from that point in both directions at a fixed speed. Each end stops when it meets the border or an existing wall, and regions left without enemies are claimed.

Games: 35 · lineages: jezzball

Examples:

- **JezzBall** (1992): Click anywhere to start a wall that grows both ways from the pointer; right-click switches its orientation.
- **Barrack** (1996): A shooter fires the walls across the field.
- **IceBreaker** (2000): A click starts two line halves growing in opposite directions.
- **KBounce** (2000): A left click starts two walls growing in opposite directions from the clicked square.
- **Late** (2005): A mouse-aimed cutter fires the cut on left click.
- **Fezball** (2014): A divider arrow is created, aimed by dragging, then started on release.
- **Clostro** (2020): Vertical and horizontal walls each have their own key.
- **Narrow the Siege** (2022): Tap a spot and a wall builds itself from there automatically.
- **Milo's Ghosts** (2023): The robot Milo's Blaster seals ghosts into smaller and smaller areas.
- **Jezzball NES** (2026): Walls grow as a red up/left half and a blue down/right half.
- **Mondrian** (unknown): Walls are paint beams fired across the canvas from a mouse-positioned shooter.
- **Quark Panic** (unknown): A cursor fires a gluon divider whose lines extend until they hit the screen edge or solid area.

Variants:

- JezzBall (1992): click to start, right-click switches orientation; Jezzball Classic Deluxe Edition (2025) keeps this
- Clostro (2020): horizontal and vertical walls each have their own key
- Barrack (1996), Cosmo Bots (2004), Mondrian: a shooter fires the wall or a paint beam across the field
- Late (2005), Qixieverse Descent (2026): a mouse-aimed cutter fires the cut on left click
- Fezball (2014): a divider arrow is created, aimed by dragging and started on release
- Split: Ball Trap Arcade (2014), Jezz Mania: Better Jezzball (2021): a swipe sets the wall
- JezzBall (Matswm86 Godot Android remake) (2026): swipe-launched walls, a 70% target, and level N has N atoms
- Jezz (Max Lund) (2020), Containment (hau-game-studio) (2026): drag and hold to place the barrier
- Narrow the Siege (2022), Ballfence (2026): tap a spot and the wall builds itself
- Jezzball Jam (2014), Jezzball NES (2026): the two halves are coloured red and blue
- Quark Panic: a cursor fires a gluon divider whose lines extend to the screen edge or solid area
- Milo's Ghosts (2023): the robot's Blaster seals ghosts into smaller areas
- caffeinatedsheep (2018): sheep herding with JezzBall-style fences
- 圈地运动 (2009): a click extends a growing line that claims ground
- JezzBall Classic (2011): a rule mod allows two wallbuilders at once

## Wall vulnerable while under construction

A growing wall, line or shape can be hit until it is complete. An enemy touching it first destroys it and applies a penalty: usually one life, sometimes the attempt, the level or the whole run. A completed wall is safe. Rule twists change what counts as a hit.

Games: 29 · lineages: jezzball

Examples:

- **JezzBall** (1992): An atom touching a wall still being built stops it and costs a life.
- **KBounce** (2000): A hit on the wall's body removes the new wall and costs a life; a head-on hit on the growing tip makes it permanent there.
- **Late** (2005): A fired cut runs until it completes or a ball strikes it; the cutter survives a few hits.
- **Filler** (2008): A bouncing ball running into a growing filler ball ends it, and collisions while growing cost lives.
- **圈地运动** (2009): Stars, gears and odd-shaped objects must not touch the growing line; only five hits are allowed for the whole run.
- **Sweet Split** (2012): A wrong line costs a life.
- **Zombie Brain Seizure** (2015): If a bouncing brain touches a line before it is finished, you lose.
- **caffeinatedsheep** (2018): Sheep break fences that are not finished in time.
- **FillBottom** (2020): A guarding ball ends the game if it detects the line while it is being built.
- **Pumping Square** (2023): A ball touching a rectangle while it grows fails the attempt.
- **Bubble.Fill: Retro Area Arcade** (2025): An enemy square touching a growing bubble pops it.
- **Containment (hau-game-studio)** (2026): One hit: an anomaly touching an unfinished barrier ends the whole run.

Variants:

- JezzBall (1992): an atom touching a wall being built stops it and costs a life
- KBounce (2000): a ball hitting the body removes the whole new wall and costs a life, but a ball meeting the growing head head-on stops the wall there and makes it permanent with no penalty; a side hit on the tip just bounces
- Late (2005): multi-hit cutter; it survives a few ball hits before it is destroyed
- IceBreaker (2000), Containment (2026): only the half that is hit is lost (see Two-half walls)
- 圈地运动 (2009): only five hits are allowed for the whole run
- Containment (hau-game-studio) (2026): one hit on an unfinished barrier ends the whole run
- FillBottom (2020): a guarding ball ends the game if it detects the line being built
- Zombie Brain Seizure (2015): a brain touching an unfinished line loses the game
- Filler (2008), Filler 2 (2009), Fill it! (Vvalter) (2010), Orbis (2026), Bubble.Fill (2025): growing balls or bubbles are the vulnerable shape
- 色球圈地 (2010): a growing ball also fails on touching the border
- Pumping Square (2023): a ball touching a growing rectangle fails the attempt
- caffeinatedsheep (2018): sheep break fences that are not finished in time
- Sweet Split (2012): a wrong line costs a life

## Two draw speeds (Fast/Slow Draw)

The trail can be drawn at a fast or a slow speed, chosen per cut with separate buttons, a held modifier, or a choice made before leaving the edge. The slow line stays exposed longer and pays more, in score or in sturdier territory. Its score payoff is the 'Slow-draw score multiplier' family.

Games: 19 · lineages: qix, gals-panic

Examples:

- **Qix** (1981): Separate Fast Draw and Slow Draw buttons; the Atari 400/800 port uses one button for the red slow line.
- **Jin** (1982): Qix bootleg on Defender hardware with two draw buttons; slow draw scores more.
- **Stix** (1983): Holding fire draws slower.
- **Statix** (1984): Has a slow speed; areas drawn slowly score triple.
- **Kix (BBC Micro)** (1986): Holding the draw key draws slowly; releasing it after the line has started switches to quick drawing.
- **Perestroika Girls** (1993): Two draw buttons, fast and slow.
- **VGA Kix** (1993): Alt speeds the stylus up and Ctrl slows it down.
- **QIX Spider Quest** (2015): One hold-to-speed-up button replaces the arcade's separate fast and slow draw buttons.
- **qixxy** (2016): Fast draw plus a slow draw at 0.3x speed.
- **Stix Disruption** (2024): Holding X while leaving the edge draws at half speed.
- **Eight Bit Qix** (c. 2026): Slow draw scores 300 points per percent and fast draw 150; draw speed is also a difficulty option.
- **Moonlight Territory** (2026): The line type is picked before leaving the edge; the slow line builds stone forts with double durability.

Variants:

- Qix (1981): separate Fast Draw and Slow Draw buttons; the Atari 400/800 port draws a normal line by moving and the red slow line with the button
- Jin (1982): Qix bootleg on Defender hardware with two draw buttons; slow draw scores more
- Stix (1983): holding fire draws slower
- Frenzy (1984): an area drawn only at slow speed scores 2x; Statix (1984): slow areas score triple
- Kix (BBC Micro) (1986): hold the key to draw slowly; releasing it after the line has started switches to quick drawing
- VGA Kix (1993): Alt speeds the stylus up and Ctrl slows it down
- Qix (Flash, Drunk Men Work Here) (2004 or earlier): Z draws fast Stix, X draws slow Stix
- qixxy (2016): slow draw at 0.3x speed
- Stix Disruption (2024): hold X while leaving the edge for half speed; releasing at once gives a normal fill
- Qyx (2022): fast and slow mapped to the two buttons of 2-button pads
- QIX Spider Quest (2015): one hold-to-speed-up button (Space) replaces the separate buttons
- Eight Bit Qix (c. 2026): slow scores 300 points per percent, fast 150; draw speed is also a difficulty option
- QWYX (c. 2026): slow draw scores double, as in arcade Qix
- Quantum-X (c. 2026): A and B select fast or slow
- RPG Maker MZ Territory Action Plugin (2026): each speed has its own configurable speed and score value
- Stake That Claim (2026): a careful line earns triple territory points; a quick line escapes danger
- Moonlight Territory (2026): picked before leaving the edge; the slow line builds stone forts with double durability instead of wooden territory

## Button-gated departure (hold to draw)

The marker moves freely along the border and claimed edges. It can enter the unclaimed field only while a draw button is held, or after pressing one. The trail claims area when it reaches the border or claimed land again. This is the arcade Qix control model.

Games: 14 · lineages: qix, gals-panic

Examples:

- **Qix** (1981): Leaving the border needs a draw button (Fast or Slow Draw); the Atari 5200 port also needs a button press to start drawing.
- **王子天蚕变** (2006): Draw only while holding Space; the line must return to your own area to close a region.
- **Patchwork Heroes** (2010): Hold the cut button and draw a line fully across the warship.
- **Stix (PICO-8)** (2019): A single action button (X) leaves the grid and draws.
- **Secret Camera** (2023): Move along the edges and hold Space to draw a line.
- **LewdQix** (2024): Standard Qix control: hold Space to draw.
- **Stix Disruption** (2024): X leaves the grid and draws, and the same button fires in co-op.
- **QL-x** (2026): Border-only movement unless Space is held to draw; three lives, 75% target.
- **Territory Action** (2026 (estimated)): Hold Space while moving off the border to draw; the line must connect to another border to claim.
- **Gravity (GBA)** (unknown): Move along the safe edge, trace lines and close them onto the edge or captured land.
- **HIDDEN JOURNEY: ASIA** (2026): Hold Space / A to draw; drawing also switches off the not-drawing invincibility.
- **Territory Arcade** (2026): A line can start anywhere on the edge of your territory.

Variants:

- Qix (1981): the Fast and Slow Draw buttons gate departure; the Atari 5200 port also needs a button press to start drawing (contrast the auto-drawing Atari 400/800 port)
- 王子天蚕变 (2006): draw only while Space is held; the line must return to your own area to close
- Stix (PICO-8) (2019): a single action button leaves the grid and draws
- Stix Disruption (2024): the same draw button also fires in co-op
- Patchwork Heroes (2010): hold the cut button and draw a line fully across the warship
- QL-x (2026): border-only movement unless Space is held
- Territory Action (2026 (estimated)): the line must connect to another border to claim
- Pickme Qix (c. 2026): Space starts drawing; touchscreen input also supported
- HIDDEN JOURNEY: ASIA (2026): holding draw switches off the not-drawing invincibility
- Quantum-X (c. 2026): A and B both start a line, at fast or slow speed
- Territory Arcade (2026): a line can start anywhere on the edge of your territory

## Enemy cuts or erases the open trail

An enemy reaching the unfinished trail cuts or erases it and the pending capture is lost, instead of the contact always being an instant death. Whether the player also loses a life or health varies by game. Direct contact with the player usually still kills.

Games: 14 · lineages: qix, xonix, gals-panic

Examples:

- **LadyLove** (1990): An enemy touching the line being drawn erases it and costs a life.
- **Mamba** (1991): The snake crossing the unfinished web erases only that web, without a kill.
- **Mamba 2** (1992): A snake crossing an unfinished web line erases only that line; only touching the spider costs a life.
- **Twin Qix** (1995): An enemy touching the trail while you draw is not an instant miss.
- **Vivid Dolls** (1998): Enemies break the line they touch.
- **Project Uncover** (2026): An enemy touching the line in progress erases it.
- **Neon Capture** (2026): An enemy that hits the line before it closes destroys the line.
- **Stake That Claim** (2026): Rival balls that reach your unfinished line cut it.
- **Ink Fill** (2026): Enemies can break an unfinished trail, so it must be protected until it closes.
- **LandSlicer: Slice & Conquer** (2026): Enemies break your trail; Trail Armor is an upgradable stat.
- **Qurvix** (2026): The morphing Qurvix crossing your trail destroys it and drains health.
- **panic_Territory Expedition** (2026): Purple path-breakers cut the trail, which fails only the current expedition.

Variants:

- Mamba (1991), Mamba 2 (1992): a snake crossing the unfinished web erases only that web, with no life lost; only touching the spider kills
- LadyLove (1990): the line is erased and a life is lost
- Twin Qix (1995): an enemy touching the trail is not an instant miss
- Vivid Dolls (1998), Glowfield (2026): enemies, or anything, touching the line break it
- Stake That Claim (2026): rival balls reaching the line cut it
- SPLARG LAND GRAB (c. 2026): Splargs can cut the open trail
- Ink Fill (2026): the trail must be protected until it closes
- LandSlicer: Slice & Conquer (2026): Trail Armor is an upgradable stat
- Qurvix (2026): the morphing Qurvix destroys the trail and drains health
- panic_Territory Expedition (2026): purple path-breakers cut the trail, failing only the current expedition
- Neon Capture (2026), Project Uncover (2026): a hit before closing destroys the line

## Retreat along the open trail (retractable trail)

While a trail is open, the player can go back along it, erasing it toward the start, and so abandon a cut safely instead of being forced to close it. Some games have the player steer the retreat. Others run it automatically when a button is released or held, and some forbid it outright.

Games: 13 · lineages: qix, volfied, xonix, gals-panic

Examples:

- **Volfied** (1989): Arcade: the ship can retrace its own unfinished line.
- **Volfied (PC Engine port)** (1989): Lines cannot be erased.
- **Volfied (Mega Drive port)** (1991): Mode A keeps arcade retracing; in modes P and Q lines cannot be erased.
- **Perestroika Girls** (1993): Reversing along the line being drawn erases it.
- **Fortix** (2009): The line in progress can be retracted.
- **VoidMania** (2026): Holding SPACE retraces the line to safety, the only escape from a lit fuse.
- **In My Imagination** (2026): Releasing the held button retraces at double speed; you cannot turn during it and can still be hit.
- **Landgrab - Line Cutting Arcade** (2026): Hold CUT to draw; releasing retreats back along the unfinished line.
- **Moonlight Territory** (2026): Retrace the open line to retreat.
- **Neon Capture** (2026): A double tap reverses direction along the run.
- **Xonix Wars Territory Capture** (2026): Driving back along your own trail is allowed with no penalty.
- **Cosmo Xonix: Space Arcade** (2026): iOS build: backing up along your own trail instead of dying on it.

Variants:

- Perestroika Girls (1993): reversing along the line being drawn erases it
- Volfied (1989): the arcade ship can retrace its unfinished line
- Volfied (PC Engine port) (1989): lines cannot be erased, so every started line must be finished
- Volfied (Mega Drive port) (1991): mode A keeps retracing; modes P and Q forbid erasing
- Fortix (2009), Lightfish (2011): the line in progress can be retracted
- VoidMania (2026): holding SPACE retraces the line to safety, the only escape from a lit Fuse
- In My Imagination (2026): releasing the cut button retraces at double speed; you cannot turn and can still be hit
- Landgrab - Line Cutting Arcade (2026): releasing CUT retreats along the line and you remain hittable
- Moonlight Territory (2026): retrace the open line to retreat
- Neon Capture (2026): a double tap reverses direction along the run
- Xonix Wars Territory Capture (2026), Cosmo Xonix: Space Arcade (2026): backing up along your own trail carries no penalty instead of being fatal

## Dash or boost burst

A player-triggered burst of speed or a lunge, gated by a cooldown, charges or an energy meter. It is used to escape danger or reach safety. Some versions capture instantly, run along the trail, or work only while the player is not drawing.

Games: 13 · lineages: qix, io-territory, other

Examples:

- **Hot Slice: Lust Exposed** (2024): Adds a dash move alongside the line-cutting.
- **Smokescreen** (2025): Shift to sprint.
- **Pyrodrome** (2025): Boost meter filled by driving on your own territory.
- **Project Uncover** (2026): Space is a dash that escapes danger or captures territory instantly; Dash is also a level-up upgrade.
- **Glowfield** (2026): A power dashes along your own trail.
- **Gravebloom** (2026): The DROP vessel dashes through a gap; MOTH surges ahead.
- **Lazy Drawer: Line Survivors** (2026): Dash out of danger while managing the trail gauge.
- **PaperCraft: Territory Capture** (2026): Double-tap dash.
- **Snake Conquest** (2026): Boost with regenerating energy plus Adrenaline, a brief boost that uses no energy.
- **looprush** (2026): 4x speed for 0.18 s on a 12 s cooldown, only while not drawing a trail.
- **Pulsebound: The Expanse** (unknown): Dash on a button to escape drones; larger claims refill dash charge.
- **Warix** (TBA (unreleased)): Boost spends an energy ring to dodge, expand faster or chase.

Variants:

- Hot Slice: Lust Exposed (2024): a dash move alongside line cutting
- Project Uncover (2026): Space dashes to escape or to capture territory instantly; Dash is also a level-up upgrade
- Glowfield (2026): a power dashes along your own trail
- Gravebloom (2026): the DROP vessel dashes through a gap; MOTH surges ahead
- Pulsebound: The Expanse: larger claims refill dash charge
- Smokescreen (2025): Shift to sprint
- Pyrodrome (2025): the boost meter fills while driving on your own territory
- PaperCraft: Territory Capture (2026): double-tap dash
- Snake Conquest (2026): boost on regenerating energy plus Adrenaline, a brief boost that uses no energy
- looprush (2026): 4x speed for 0.18 s on a 12 s cooldown, only while not drawing
- Warix (TBA (unreleased)): boost spends an energy ring to dodge, expand faster or chase
- Kingpins.io: Space boost
- Lazy Drawer: Line Survivors (2026): dash out of danger while managing the trail gauge

## Self-closing loop trail (no home base)

The trail is laid freely in the open field, with no border or home territory. A loop closes when the avatar crosses or touches its own trail, and whatever lies inside the loop is captured, destroyed or damaged.

Games: 12 · lineages: other

Examples:

- **Quantum** (1982): The trackball probe leaves a tail; crossing the tail closes a loop.
- **Disco No. 1** (1982): The roller-skater skates a complete loop around one or more tough guys.
- **Do! Run Run** (1984): Mr. Do's running line encloses ('inscribes') parts of the maze.
- **Mr. Do! Run Run (Atari ST)** (1990): A rope line trails behind Mr. Do and is looped around dots.
- **Ouroboy** (2025): Touching your own tail tip closes the loop; crossing your own body cuts the snake instead of killing you.
- **Overheat** (2025): A drifting car's skid trail is the capture line.
- **Smokescreen** (2025): Hold to lay smoke behind the ship; a closed smoke loop destroys the enemies inside.
- **Snake Loop** (2025): Circle the snake around foxes.
- **Schloop** (2025): A snake encircles objects and enemies to devour them.
- **Encircle (chlowo)** (2025): Looping your path around enemies in a bullet-hell shooter defeats them.
- **Loopinball** (2025): A pinball's physics-driven trail is the line looped around bumpers.
- **Lazy Drawer: Line Survivors** (2026): Your walking trail closes loops that burst damage on everything inside.

Variants:

- Quantum (1982): a trackball probe's tail closes a loop when crossed
- Disco No. 1 (1982): a roller-skater skates complete loops around tough guys
- Do! Run Run (1984), Mr. Do! Run Run (Atari ST) (1990): a running line or rope inscribes parts of the maze or loops around dots
- Ouroboy (2025): touching your own tail tip closes the loop; crossing your own body cuts the snake instead of killing you
- Overheat (2025): a drifting car's skid trail is the capture line
- Smokescreen (2025): hold to lay smoke; a closed smoke loop destroys the enemies inside
- Snake Loop (2025), Schloop (2025): a snake encircles foxes, objects or enemies to devour them
- Encircle (chlowo) (2025): looping around enemies in a bullet-hell shooter defeats them
- Loopinball (2025): a pinball's physics-driven trail loops around bumpers
- Lazy Drawer: Line Survivors (2026): walking-trail loops burst damage on everything inside

## Rail-bound line movement

The player can move only along the lines of a fixed lattice, maze or web, and paints or claims each segment it walks. It can never cut into the open field, so all capture and coverage happens on lines that already exist.

Games: 12 · lineages: amidar-painter

Examples:

- **Make Trax** (1981): The brush moves along the corridors of a maze and paints the paths it covers.
- **Amidar** (1982): Movement is limited to the lines of a fixed Amidakuji (ladder) grid.
- **Hot Shocker** (1982): Dudley walks along the strands of a web and recolours them.
- **Boxer Rebellion** (1982): Boxes are outlined by tracing their edges rather than by free-form cuts.
- **Crazy Tracer** (1983): The player traces the edges of a fixed rectangular lattice.
- **Damper** (1983): Moves around a power grid on fixed pathways.
- **Traxx** (1983): The player moves along a rectangular grid and paints each section passed.
- **Gapper** (1986): Gapper walks the blue lines of a rectangular grid, turning each line red.
- **Zoom!** (1988): Skates along the gridlines of isometric boards; edge painting replaces area cutting.
- **2nd Space** (1993): The robot can only move along rectangle borders.
- **Painter** (1993): Walks a grid of lines; each line passed changes colour.
- **Squarex** (1996): Squares are captured by going along their sides instead of with free cuts.

Variants:

- Amidar (1982): movement limited to a fixed Amidakuji (ladder) grid
- Make Trax (1981): a brush paints the maze corridors it covers
- Hot Shocker (1982): Dudley recolours the strands of a web rather than a rectangular grid
- Boxer Rebellion (1982), Squarex (1996): boxes are captured by tracing their sides
- Crazy Tracer (1983): traces the edges of a fixed rectangular lattice
- Damper (1983): fixed power-grid pathways, described as Zolyx with fixed pathways
- Traxx (1983), Gapper (1986), Painter (1993): each grid section walked changes colour
- Zoom! (1988): skates the gridlines of isometric boards
- 2nd Space (1993): the robot moves only along rectangle borders

## Free roaming on claimed land (Xonix land-and-sea model)

When not cutting, the player can move anywhere on claimed land (the frame plus captured area), not just along its boundary, and can start a cut from any boundary point reached that way. In the classic Xonix form there is no draw button: the cursor leaves a trail only in the open 'sea', and reaching land again closes the trail and triggers the capture.

Games: 10 · lineages: xonix, gals-panic

Examples:

- **Xonix** (1984): Cursor moves freely on claimed 'land' and leaves a trail only in the open 'sea'.
- **Zolyx** (1987): The claimed area is the safe base and the trail is drawn into the unclaimed area.
- **Xonix (X11/Macintosh reimplementation)** (1995): The cut closes when the trail reaches filled land.
- **AQuix** (1997): Player dot roams the frame and claimed area; on leaving it turns into a 'Quix' that draws a trail.
- **Gal Pani X** (2002 (demo 2000)): The player moves freely inside claimed land growing from the centre rectangle instead of being locked to edges.
- **Cartoon Xonix** (2004): Trail is a chain of dots cut from the claimed area into the covered area.
- **Xobox (Rockbox plugin)** (2006): Player leaves filled land to draw a trail and fills on return.
- **Xonix (KolibriOS)** (2006): Player can stand on land with no trail; a trail exists only while out in the unclaimed area.
- **Xonix 3D 2** (2013): Drive a ball across the field to draw a line.
- **In My Imagination** (2026): The player can reposition through already-claimed territory.

Variants:

- Xonix (1984): the cursor roams land and trails only in the sea
- AQuix (1997): the dot turns into a 'Quix' that draws on leaving the claimed area
- Cartoon Xonix (2004): the trail is a chain of dots
- Xonix (KolibriOS) (2006): no trail exists while standing on land
- Xonix 3D 2 (2013): drive a ball across the field to draw
- Gal Pani X (2002 (demo 2000)): free movement inside claimed land that grows from a centre rectangle, rather than being edge-locked
- In My Imagination (2026): reposition through claimed territory, but cutting needs a held button

## Perpetual motion (avatar never stops)

The avatar keeps moving without input, and the controls only steer it. Stopping is either impossible or needs a dedicated stop input, so the player cannot wait in place and must plan turns ahead.

Games: 10 · lineages: amidar-painter, other, io-territory, volfied, qix

Examples:

- **Jeepers Creepers** (1982): An optional 'coast' movement keeps the bug sliding along its path after the joystick is released.
- **Gridd Worz** (1984): The ship always keeps moving in its last direction; keys only steer it.
- **Achtung, die Kurve!** (1993): Each dot moves at constant speed.
- **Splix.io** (c. 2016 (unconfirmed)): P freezes you, but a frozen player can still be killed, even on their own land.
- **Pauper.Io!** (2026): The mouse sets a direction and movement continues.
- **looprush** (2026): Continuous movement on the board.
- **VOLTFIELD: 80s Classic Arcade** (2026): The ship never stops; swipe to turn.
- **Qurvix** (2026): A swipe launches the marker and a tap stops it; tilt control is an alternative.
- **TileMan.io** (unknown): E or P stops you in place.
- **Moss Covers Everything** (unknown): The moss ball always moves forward; two buttons only turn it left or right.

Variants:

- Moss Covers Everything: always moves forward; two buttons only turn it left or right
- Achtung, die Kurve! (1993): each dot moves at constant speed
- VOLTFIELD: 80s Classic Arcade (2026): the ship never stops; swipe to turn
- Gridd Worz (1984): always keeps moving in its last direction like a Tron light-cycle
- Jeepers Creepers (1982): an optional 'coast' setting keeps the bug sliding along its path after the stick is released
- Splix.io (c. 2016 (unconfirmed)): P freezes you, but a frozen player can still be killed, even on their own land
- TileMan.io: E or P stops you in place
- Pauper.Io! (2026): the mouse sets a direction and movement continues
- looprush (2026): continuous movement on the board
- Qurvix (2026): a swipe launches the marker and a tap stops it; tilt control is an alternative

## Pointer-drawn lasso (no avatar)

There is no avatar. The player draws the enclosing line directly with a stylus, mouse or finger, anywhere on the field and not anchored to a border, and only the line itself is at risk.

Games: 9 · lineages: other, qix

Examples:

- **firmament i-a** (2001): The mouse pointer draws the line that encloses flowing pieces.
- **Yoshi Touch & Go** (2005): Draw a circle around an enemy to trap it in a bubble.
- **Pokémon Ranger** (2006): Loops are drawn around a moving Pokémon with the stylus.
- **Pokémon Ranger: Shadows of Almia** (2008): Lifting the stylus dodges attacks without losing progress.
- **Pokémon Ranger: Guardian Signs** (2010): Loops are drawn with the Capture Styler.
- **Sneak Peeling** (2020): A freehand closed shape drawn anywhere is cut over time on release; the fire demon detecting the cut fails it.
- **Realm of Tile** (2022): No avatar: drag a finger across tiles to convert them.
- **Encircle (Cyantist)** (2025): Freehand loops around enemies, drawn by mouse drag or touch.
- **Rodeo Rampage** (2025): Draw a lasso loop with the mouse.

Variants:

- Pokémon Ranger (2006), Pokémon Ranger: Guardian Signs (2010): loops are drawn around a moving Pokémon with the Capture Styler
- Pokémon Ranger: Shadows of Almia (2008): lifting the stylus dodges attacks without losing progress
- Yoshi Touch & Go (2005): a circle drawn around an enemy traps it in a bubble
- Rodeo Rampage (2025): a mouse-drawn lasso loop
- firmament i-a (2001): the pointer draws the line that encloses flowing pieces
- Encircle (Cyantist) (2025): freehand loops by mouse drag or touch
- Sneak Peeling (2020): a closed freehand loop drawn anywhere; on release the board is cut along it over time, and the attempt fails if the fire demon detects the cut in progress
- Realm of Tile (2022): no loop; dragging a finger across tiles converts them

## Anchor-to-anchor links

Lines can run only between fixed anchors such as stars, planets, portals, towers or dots. The player visits anchors in sequence, and the straight segments between them form the enclosure.

Games: 9 · lineages: other

Examples:

- **Itazura Tenshi** (1984): The angel flies into scattered stars to connect constellations; lines run between fixed points.
- **Star Trigon** (2002): Hops from planet to planet form large triangles.
- **Spider: The Secret of Bryce Manor** (2009): The spider trails silk as it jumps between surfaces.
- **Ingress** (2013): Players link real-world portals.
- **Spider: Rite of the Shrouded Moon** (2015): Same jump-and-strand rule as the predecessor.
- **Clubhouse Games: 51 Worldwide Classics (Dots and Boxes)** (2020): Draw one line between two adjacent dots per turn.
- **Ink Dots: Territory Capture** (2026): Unbroken chains of dots on a grid surround rival dots.
- **Pulsebound: The Expanse** (unknown): Touch three different relay towers to close a triangle.
- **Color Conquest** (unknown): Connect dots to form enclosed shapes.

Variants:

- Itazura Tenshi (1984): the angel connects constellations by flying into stars; no area is claimed
- Star Trigon (2002): planet-to-planet hops form large triangles
- Spider: The Secret of Bryce Manor (2009), Spider: Rite of the Shrouded Moon (2015): silk trails between surfaces as the spider jumps
- Ingress (2013): real-world portals are linked
- Pulsebound: The Expanse: touching three different relay towers closes a triangle, with self-chosen routes
- Color Conquest: connect dots to form enclosed shapes
- Clubhouse Games: 51 Worldwide Classics (Dots and Boxes) (2020): one line between two adjacent dots per turn
- Ink Dots: Territory Capture (2026): unbroken chains of dots on a grid surround rival dots

## Eight-way diagonal movement

The marker and its trail can move in eight directions, so cuts can contain 45-degree segments as well as horizontal and vertical ones. This needs an 8-way stick, keypad diagonals or free mouse control. Most other games are orthogonal-only, and some state that rule explicitly.

Games: 9 · lineages: qix, gals-panic, other

Examples:

- **Styx** (1983): 8-way movement: Stix can be drawn diagonally.
- **Spider Web** (1989): Mouse or 8-direction keyboard control using number-pad diagonals.
- **Gals Panic II** (1993): An 8-way joystick allows diagonal lines.
- **Fantasia** (1994): Two players on an 8-way joystick.
- **Paradise** (1994): 8-way joystick on a vertical screen, two players.
- **Paparazzi** (1996): 8-way joystick with a single button, two players simultaneous.
- **Gal Pani X** (2002 (demo 2000)): GOG Dreamlist notes diagonal movement.
- **Vertex (Komodor)** (2025): Lines are orthogonal only.
- **Territory Reveal** (2026): 8-way movement.

Variants:

- Styx (1983): Stix drawn diagonally
- Gals Panic II (1993), Fantasia (1994), Paradise (1994): 8-way joystick, two players; Paradise on a vertical screen
- Paparazzi (1996): 8-way joystick with a single button, two players simultaneous
- Gal Pani X (2002 (demo 2000)): diagonal movement noted on the GOG Dreamlist
- Spider Web (1989): mouse or number-pad diagonals
- Territory Reveal (2026): 8-way movement
- Vertex (Komodor) (2025): the opposite rule stated explicitly; lines are orthogonal only

## Consumable drawing resource

A shared meter (fuel, line segments, silk, ink, paint or health) is spent as the player draws or travels, and it runs down over the stage. Running dry ends or stalls the attempt. Some games refill it, or turn what is left into points.

Games: 9 · lineages: qix, other

Examples:

- **Stix** (1983): The synthesizer has a finite fuel supply.
- **Torch 2081** (1986): A fuel gauge limits flight time, and leftover fuel becomes points at the end of the level.
- **Spider** (1994): The length of line the player can draw is capped by the 'web power' available.
- **Spider: The Secret of Bryce Manor** (2009): Precision mode limits silk.
- **Spider: Rite of the Shrouded Moon** (2015): Silk is limited: trap insects before you run out.
- **Smokescreen** (2025): Laying smoke drains the ship's own health bar.
- **Lazy Drawer: Line Survivors** (2026): You dash and draw while managing a trail gauge.
- **point line surface** (2026 (Early Access)): Collect energy to earn new segments; a planned Hex Shop spends segments on rule mutators.
- **Splash&Dash** (unknown (coming soon)): Painting uses a paint tank that drifting refills.

Variants:

- Stix (1983): the synthesizer has a finite fuel supply
- Torch 2081 (1986): a fuel gauge limits flight time; leftover fuel becomes points at level end
- Spider (1994): the 'web power' available caps how much line can be drawn
- point line surface (2026 (Early Access)): segments are refilled by collecting energy; a planned Hex Shop spends them on rule mutators
- Spider: Rite of the Shrouded Moon (2015): limited silk; trap insects before it runs out
- Spider: The Secret of Bryce Manor (2009): precision mode limits silk
- Lazy Drawer: Line Survivors (2026): a trail gauge is managed while dashing and drawing
- Splash&Dash: a paint tank refilled by drifting
- Smokescreen (2025): laying smoke drains the ship's own health bar

## Hold-to-grow filler shapes

Instead of drawing lines, the player places a shape (a circle, bubble or rectangle) that grows while the input is held. It freezes into permanent, safe claimed area on release or on contact. The claimed area is the total area of the frozen shapes. In some games a placed shape can be grown again later.

Games: 8 · lineages: jezzball

Examples:

- **Filler** (2008): Hold the mouse to grow a filler ball and release to freeze it; it also stops when it touches another filler ball.
- **Filler 2** (2009): A filler grows until it touches a bouncing ball or another filler; release fixes it in place.
- **Fill it! (Vvalter)** (2010): Hold the left button to grow a white ball; it stops on release or when it hits a wall.
- **色球圈地** (2010): Click anywhere to place a ball and hold to keep it growing.
- **Hundreds** (2013): Touching a circle grows it and counts its number up.
- **Pumping Square** (2023): A rectangle grows centred on the touch point while held; placed rectangles can be grown further.
- **Bubble.Fill: Retro Area Arcade** (2025): Hold to grow a bubble and release to lock it; locked bubbles are permanent and safe.
- **Orbis: Bubble Fill Reflex Game** (2026): Hold to grow a bubble and release to anchor it.

Variants:

- Filler (2008): hold the mouse to grow a ball, release to freeze; it also stops on touching another filler ball
- Filler 2 (2009): grows until it touches a bouncing ball or another filler; release fixes it
- Fill it! (Vvalter) (2010): stops on release or when it hits a wall
- 色球圈地 (2010): click anywhere to place a ball and hold to keep it growing
- Hundreds (2013): regrowable; touching a circle grows it and counts its number up toward the level total
- Pumping Square (2023): regrowable; a rectangle grows centred on the touch point only while held, and placed rectangles can be grown further
- Bubble.Fill: Retro Area Arcade (2025): locked bubbles are permanent and safe
- Orbis: Bubble Fill Reflex Game (2026): release anchors the bubble

## Miss resolution: trail erased, respawn point

Sets what happens to the open cut and the player's position after a hit. The open trail is removed and claimed area is kept. The player reappears at the start of the abandoned line or at a fixed point, and a respawn near an enemy can cost a second life.

Games: 8 · lineages: qix, xonix, volfied

Examples:

- **Stix** (1983): When caught while drawing, you restart where the line began, and a nearby quark can cost another life at once.
- **Qix (ZX Spectrum, PCW type-in)** (1985): Being caught sends you back to where the line started and costs a life.
- **Mamba** (1991): Snake touching the spider costs a life, erases the web and resets the spider to the top-left corner; captured areas stay.
- **Mamba 2** (1992): Touching the spider costs one of three lives and sends it back to the top-left corner; claimed areas stay.
- **Coach Tzabar** (1997): Dying loses the current cut only; cleared sections stay.
- **Lovely Girls** (1998): You respawn at top centre after touching your own trail.
- **Xobox (Rockbox plugin)** (2006): Trail is erased and the player is sent back to the start position.
- **Territory Raider** (2026): Touching an enemy, or being reached by a spark, costs a life and rolls the trail back.

Variants:

- Stix (1983): you restart where the line began, and a nearby quark can cost another life at once
- Qix (ZX Spectrum, PCW type-in) (1985): sent back to where the line started
- Territory Raider (2026): touching an enemy or being reached by a spark rolls the trail back
- Mamba (1991), Mamba 2 (1992): the web is erased and the spider reset to the top-left corner; captured areas stay
- Lovely Girls (1998): respawn at top centre
- Xobox (Rockbox plugin) (2006): the trail is erased and the player sent back to the start position
- Coach Tzabar (1997): dying loses only the current cut; cleared sections stay

## Grid-step four-direction movement

The avatar moves one cell at a time in the four cardinal directions. Turns are 90 degrees and trails occupy whole cells.

Games: 7 · lineages: io-territory

Examples:

- **Splix.io** (c. 2016 (unconfirmed)): Grid territory with lines drawn cell by cell.
- **Paper-io (MakeCode Arcade)** (2021): Tile map; bots make random 90-degree turns.
- **Paper Loop** (2026): Square by square in four directions.
- **Pauper.Io!** (2026): Movement on character cells; 3,588 playable cells.
- **looprush** (2026): One steering option is cardinal keys on a square board.
- **圈地大作战** (2026): A neon ship moving on a grid.
- **TileMan.io** (unknown): Grid territory capture.

Variants:

- Splix.io (c. 2016 (unconfirmed)): lines drawn cell by cell
- Paper-io (MakeCode Arcade) (2021): tile map; bots make random 90-degree turns
- Paper Loop (2026): square by square in four directions
- Pauper.Io! (2026): character cells, 3,588 playable
- looprush (2026): cardinal keys on a square board as one steering option
- 圈地大作战 (2026): a neon ship moving on a grid
- TileMan.io: grid territory capture

## Per-stroke length cap

A single stroke, rope, strand or excursion has a maximum length or span. Going past it invalidates the stroke, breaks the strand or yanks the player back. Upgrades or the avatar's growth raise the cap.

Games: 7 · lineages: other, io-territory

Examples:

- **Pokémon Ranger** (2006): Combined loop length is capped and the cap grows with Styler level.
- **Spider: The Secret of Bryce Manor** (2009): A silk strand breaks if the jump gap is too wide.
- **Spider: Rite of the Shrouded Moon** (2015): A jump across too wide a gap breaks the strand.
- **Scalar Snake** (2024): Enclose with your body; captured blocks increase the snake's size.
- **Rodeo Rampage** (2025): Limited rope: a drawing longer than the cap is invalid.
- **Sewernir** (2025): Going too far snatches you back; rope length is upgraded between levels.
- **Snake Conquest** (2026): Length sets how far your trail can reach.

Variants:

- Pokémon Ranger (2006): combined loop length is capped and the cap grows with Styler level
- Rodeo Rampage (2025): a drawing longer than the rope is invalid
- Sewernir (2025): going too far snatches you back; rope length is upgraded between levels
- Spider: The Secret of Bryce Manor (2009), Spider: Rite of the Shrouded Moon (2015): a strand breaks if the jump gap is too wide
- Scalar Snake (2024): the snake's body is the trail and captured blocks grow it
- Snake Conquest (2026): snake length sets how far the trail can reach; grow longer to attempt bigger captures

## Location- or state-dependent speed

Movement speed depends on where the player is or what it is doing. It may be faster on its own territory or along walls, boosted only on safe ground, or capped while cutting, so that retreats home are rewarded and long cuts stay exposed longer.

Games: 7 · lineages: qix, io-territory, other

Examples:

- **Splatoon (Turf War)** (2015): In squid form you swim through your team's ink to move, hide and refill; enemy ink slows and damages you.
- **Pyrodrome** (2025): Driving over your own territory builds a boost meter.
- **Qixotic** (2025): Speed boost while moving through your own territory.
- **SPLARG LAND GRAB** (c. 2026): Shift gives turbo speed, but only while on safe ground.
- **Territory Arcade** (2026): A speed cap on the cutter makes long cuts risky.
- **Grid Riders** (2026): No trail and slightly higher speed inside your own area.
- **PaperCraft: Territory Capture** (2026): Speed boost while running along walls.

Variants:

- SPLARG LAND GRAB (c. 2026): Shift turbo works only on safe ground
- Territory Arcade (2026): the cutter is speed-capped, so long cuts are risky
- Pyrodrome (2025): driving over your own territory builds a boost meter
- Qixotic (2025): speed boost while moving through your own territory
- Grid Riders (2026): no trail and slightly higher speed inside your own area
- PaperCraft: Territory Capture (2026): speed boost while running along the arena walls
- Splatoon (Turf War) (2015): squid form swims fast through your team's ink (even up walls), hides you and refills ink; enemy ink slows you, cannot be swum through and slowly damages you

## Committed vs cancellable cuts

Sets whether a cut, once started, can be stopped, cancelled or undone. In committed forms, a cutter that leaves safe land keeps going until the cut closes and releasing the input does not save it, or a fired wall cannot be recalled. Other games add a cancel gesture during aiming or an undo after placement.

Games: 7 · lineages: qix, jezzball

Examples:

- **Late** (2005): A fired cut cannot be stopped.
- **Jezz Mania: Better Jezzball** (2021): Dragging above the field cancels the wall before it starts building.
- **Bubble.Fill: Retro Area Arcade** (2025): An Undo power-up removes a placed bubble.
- **Territory: Claim & Conquer** (2026): Once off safe land the trail cannot be stopped; releasing the thumb does not save you.
- **Space Cutter** (2026): The cut continues after the finger lifts and stops by itself when the cut completes.
- **Fill It! Arcade** (2026): Lifting the finger near an edge auto-flies the rest of the sketched route.
- **Linsips** (2026): The first line cannot be undone, and the clock and balls keep moving while you place the second.

Variants:

- Territory: Claim & Conquer (2026): once off safe land the trail cannot be stopped; releasing the thumb does not save you
- Space Cutter (2026): the cut continues after the finger lifts and stops itself when complete
- Fill It! Arcade (2026): lifting the finger near an edge auto-flies the rest of the sketched route
- Late (2005): a fired cut cannot be stopped
- Jezz Mania: Better Jezzball (2021): dragging above the field cancels the wall before it starts building
- Bubble.Fill: Retro Area Arcade (2025): an Undo power-up removes a placed bubble
- Linsips (2026): the first line cannot be undone, and the clock and balls keep moving while you place the second

## Single fixed draw speed

There is only one drawing speed and at most one draw button, so there is no Fast/Slow choice and no slow-draw score multiplier. A capture is valued only by the area it claims.

Games: 6 · lineages: qix, volfied

Examples:

- **Fill 'Er Up!** (1983): One drawing speed, with no two-speed, two-point drawing.
- **Qix (FM-7)** (1983): No draw buttons; lines are drawn at close to arcade Fast Draw speed.
- **Super Qix** (1987): A 4-way lever and a single draw button.
- **Volfied** (1989): One fixed draw speed; score depends only on area claimed.
- **Twin Qix** (1995): A 4-way lever and a single line button labelled Draw Faster.
- **Mix** (2022): Lines are drawn at one constant speed.

Variants:

- Fill 'Er Up! (1983): no two-speed, two-point drawing
- Qix (FM-7) (1983): no draw buttons; lines at close to arcade Fast Draw speed
- Super Qix (1987): 4-way lever and a single draw button
- Twin Qix (1995): a single line button labelled Draw Faster
- Volfied (1989): one fixed speed, unlike Qix; score depends only on area claimed
- Mix (2022): removes Qix's choice; lines at one constant speed

## Limited number of cuts per level

A level grants a fixed number of lines, shapes, balls or touches. Every placement uses up a scarce resource, so the target has to be reached in few cuts.

Games: 6 · lineages: qix, jezzball, other

Examples:

- **Brainstorm (TI-86)** (2002): Only three lines to capture a ball inside the point-giving areas.
- **Bix** (2008): 'Line limits' is one of the Bix Challenge galaxy twists.
- **Filler** (2008): A limited number of filler balls per level.
- **色球圈地** (2010): Each level gives a limited number of balls.
- **Realm of Tile** (2022): A limited number of touches per stage favours long continuous drags.
- **Linsips** (2026): Exactly one horizontal and one vertical line.

Variants:

- Bix (2008): 'Line limits' is one of the Bix Challenge galaxy twists
- Filler (2008), 色球圈地 (2010): a limited number of balls per level
- Linsips (2026): exactly one horizontal and one vertical line
- Brainstorm (TI-86) (2002): only three lines to wall a ball into point-giving areas
- Realm of Tile (2022): a limited number of touches per stage favours long continuous drags

## Auto-draw on leaving safe ground

There is no draw button: any move from the border or claimed land into unclaimed space starts a trail at once, so stepping off safe ground is itself the commitment. The Xonix land-and-sea model and io-style loop capture also work this way (see those families).

Games: 5 · lineages: qix

Examples:

- **Qix** (1981): In the Atari 400/800 port, moving draws a normal line.
- **Qix (FM-7)** (1983): Moving off the border into the field draws a Stix automatically, at roughly Fast Draw speed.
- **Fortix** (2009): Drawing starts automatically on entering unclaimed land.
- **Project Uncover** (2026): Line drawing ('silhouette cutting') starts automatically when the player leaves the safe zone.
- **panic_Territory Expedition** (2026): Leaving the safe zone leaves a path behind; the route and the existing safe zone enclose the claim.

Variants:

- Qix (1981): the Atari 400/800 port draws a normal line just by moving; the button is kept for the slow line
- Qix (FM-7) (1983): no draw buttons; Stix drawn automatically at about Fast Draw speed
- Fortix (2009): drawing starts on entering unclaimed land
- Project Uncover (2026): 'silhouette cutting' starts automatically on leaving the safe zone
- panic_Territory Expedition (2026): leaving the safe zone leaves a path; the route and the safe zone together enclose the claim

## Stall penalty without a Fuse

Stopping mid-cut is punished without a chasing Fuse: by death at once, by a charge that builds until it explodes, or by creatures that attack a player who stays still. A milder variant allows a brief pause.

Games: 5 · lineages: qix

Examples:

- **Styx** (1983): Stopping or leaving a line unfinished is fatal.
- **Stix** (1983): Stopping too long while drawing builds up energy until the synthesizer explodes.
- **Qiks** (1984): Creatures attack if you stay in one place too long.
- **Frenzy** (1984): The craft can pause briefly.
- **Torch 2081** (1986): Stopping while building a panel makes the construction line unstable and destroys the glider.

Variants:

- Styx (1983): stopping or leaving a line unfinished is fatal
- Stix (1983): stopping too long builds energy until the synthesizer explodes
- Torch 2081 (1986): stopping makes the construction line unstable and destroys the glider, replacing Qix's Fuse
- Qiks (1984): creatures attack if you stay in one place too long
- Frenzy (1984): the craft can pause briefly

## Vehicle-physics steering

The drawing avatar is a vehicle with momentum, controlled with accelerate, brake, turn or drift rather than direct direction input.

Games: 5 · lineages: io-territory, other

Examples:

- **Pyrodrome** (2025): A drifting truck lays the trail.
- **Qixotic** (2025): Hoverbikes with accelerate, brake and turn controls.
- **Overheat** (2025): A drifting car's skid trail is the capture line.
- **Grid Riders** (2026): GL Tron-inspired car racer.
- **Kingpins.io** (unknown (likely 2026)): Cars driving through a neon city.

Variants:

- Pyrodrome (2025): a drifting truck lays the fire trail
- Qixotic (2025): hoverbikes with accelerate, brake and turn
- Grid Riders (2026): a GL Tron-inspired car racer
- Kingpins.io: cars driving through a neon city
- Overheat (2025): a drifting car's skid trail is the capture line

## Two-half walls with independent fates

Each wall is two halves growing in opposite directions, and each half completes or breaks on its own. An enemy breaking one half removes only that half and its penalty, and the other half can still finish and stay as a partial wall.

Games: 5 · lineages: jezzball

Examples:

- **IceBreaker** (2000): Each broken half costs a life, and letting a line break on purpose can leave small trap areas.
- **Jezzball Jam** (2014): A post-launch update lets the red and blue halves of a line start independently in some situations.
- **Jezz Mania: Better Jezzball** (2021): Each wall has two halves, and an atom destroys only the half it hits.
- **Containment** (2026): A ball breaks only the half it hits, and a completed half stays.
- **Jezzball NES** (2026): A half that reaches solid ground turns to stone independently.

Variants:

- IceBreaker (2000): each broken half costs a life; letting a line break on purpose can leave small trap areas
- Jezzball Jam (2014): a post-launch update lets the red and blue halves start independently in some situations
- Jezz Mania: Better Jezzball (2021): an atom destroys only the half it hits
- Containment (2026): a completed half stays when the other breaks
- Jezzball NES (2026): a half reaching solid ground turns to stone independently

## Edge-launched straight cut

From the edge the player triggers a cut that travels straight across the field by itself instead of steering a trail. Every cut is a straight chord, and it is exposed while it travels.

Games: 4 · lineages: qix

Examples:

- **Shocker** (1988): The man moves around the tank's edge; the fire button sends a straight line across the tank to bisect it.
- **Cubixx** (2009): The Cubot fires a laser line across the cube to cut away its sides.
- **Curvebot Evolved** (2011): Pressing both touch buttons sends the edge-running robot straight across, drawing an edge-to-edge cut.
- **Quarosel** (2023): Hold to aim, release to execute the cut; the opponent can counter it while it is under way.

Variants:

- Shocker (1988): the man moves round the tank's edge on two switches; fire sends a straight line across to bisect it
- Curvebot Evolved (2011): pressing both touch buttons sends the edge-running robot straight across
- Cubixx (2009): the Cubot fires a laser line across the cube to cut away its sides
- Quarosel (2023): hold to aim, release to execute; the opponent can counter the cut while it is under way

## Pointer-drawn trail (freehand or planned route)

The cut starts from the border and is traced with a mouse or finger at any angle, instead of a marker being steered in four directions. Either the path is drawn directly, or the player plans the route ahead with a sketch or waypoints and the marker follows it. A planned route can be harmless until it is flown.

Games: 4 · lineages: qix, gals-panic

Examples:

- **Pix Panic** (2015 or earlier): Tap and drag outside the border to set waypoints; tap inside the revealed border to move along its edge.
- **Area of Pirates** (2020): Set a sailing route by touch; completing the voyage charts that sea area.
- **Quick Impulse Xpansion** (2021): Hold the left mouse button from the screen border to draw a freehand path.
- **Fill It! Arcade** (2026): Doodle-to-move: the dotted route ahead is harmless, and turn assist snaps the ship onto nearby lanes.

Variants:

- Quick Impulse Xpansion (2021): hold the left mouse button from the border and draw a freehand path
- Area of Pirates (2020): set a sailing route by touch; completing the voyage charts that sea area
- Pix Panic (2015 or earlier): tap or drag outside the border to place waypoints joined by straight segments at any angle ('360 degrees of freedom'); tap inside the revealed border to move along its edge
- Fill It! Arcade (2026): doodle the route ahead; the dotted planned part cannot be hit, and turn assist snaps the ship onto nearby lanes

## Jump or teleport across the field

An action moves the player across unclaimed or enemy-held space without drawing, so it is not limited to borders and its own trail. Some versions land only on safe claimed ground.

Games: 4 · lineages: qix, xonix

Examples:

- **Time Bokan (cancelled Qix-style arcade game)** (1995): A jump button lets the marker move across the open field instead of only along borders and Stix.
- **3D天蚕变** (2011): A 'warp' pickup exists in the asset names (effect undocumented).
- **Xonix Blast** (2012): Long press teleports through the enemy area to a safe region, collecting bonuses on the way.
- **PIX (Sega Genesis / Mega Drive)** (2026): Dedicated teleport button (B on the pad, X on the keyboard).

Variants:

- Time Bokan (cancelled Qix-style arcade game) (1995): a jump button moves the marker across the open field instead of only along borders and Stix
- PIX (Sega Genesis / Mega Drive) (2026): a dedicated teleport button (B on the pad, X on the keyboard)
- Xonix Blast (2012): a long press teleports through the enemy area to a safe region, collecting bonuses on the way
- 3D天蚕变 (2011): a 'warp' pickup appears in the asset names; its effect is undocumented

## No reversing onto the open trail

While drawing, the player cannot turn back along its fresh trail: either the reverse input is ignored or reversing counts as a fatal self-collision. This is the opposite of a retractable trail.

Games: 4 · lineages: xonix, qix, io-territory

Examples:

- **Araña** (1990): Retracing your path costs a life.
- **Xonix Blast** (2012): Flick controls do not allow reversing back into the dangerous area.
- **Blobbed Away** (2025): Crossing your own trail or moving backward along it kills you.
- **Turf Rollers** (2026): No 180-degree turns on the spot.

Variants:

- Araña (1990): retracing your path costs a life
- Blobbed Away (2025): moving backward along your trail kills you
- Xonix Blast (2012): flick controls do not allow reversing back into the dangerous area
- Turf Rollers (2026): no 180-degree turns on the spot

## In-field avatar launches walls

The player is an avatar that moves freely through the open field, not along the border and not as a bare pointer, and launches cuts or walls from its own position. The avatar itself may be a target while it moves or captures.

Games: 4 · lineages: jezzball

Examples:

- **Land Breaker** (1999): The device moves freely inside the field, fires a laser both ways and can move again right after firing.
- **Stealin** (2016): A tank is steered by swipe-and-hold and divides the field by swipe; enemy soldiers must not touch it while it captures.
- **JEZZAK** (2023): A D-pad-driven avatar: B rotates it and A extends the 'isolator' wall.
- **Coconut's Coco-Net** (2026): Two fighters move around the arena with grappling hooks and build walls.

Variants:

- Land Breaker (1999): the device fires a laser both ways and can move again right after firing
- Stealin (2016): a tank steered by swipe-and-hold divides the field by swipe; enemy soldiers must not touch it while it is capturing
- JEZZAK (2023): a D-pad avatar; B rotates it and A extends the 'isolator' wall
- Coconut's Coco-Net (2026): two fighters move round the arena with grappling hooks and build walls

## Held speed-up button

A dedicated button or setting raises movement speed for as long as it is held, separately from pickups. Some games forbid drawing while it is in use.

Games: 4 · lineages: volfied, gals-panic, amidar-painter

Examples:

- **Demolition Herby** (1982): The accelerator lets the car ram chasers, but it cannot paint while speeding unless every chaser is off the track.
- **Volfied (Mega Drive port)** (1991): Mode Q (original Qix rules, no items) adds a separate fast-move button.
- **Ultimate Qix (Genesis port of Volfied)** (1991): In mode C a button speeds up the ship.
- **エロルドさん、いらっしゃい** (2019): Option to set always-dash or always-walk.

Variants:

- Volfied (Mega Drive port) (1991): mode Q (original Qix rules, no items) adds a separate fast-move button
- Ultimate Qix (Genesis port of Volfied) (1991): in mode C a button speeds up the ship
- エロルドさん、いらっしゃい (2019): walk and dash speeds, with an option to lock always-dash or always-walk
- Demolition Herby (1982): the accelerator lets the car ram chasers, but it cannot paint while speeding unless every chaser is off the track; chasers can speed up too

## Continuous heading with capped turn rate

The avatar has a free heading that turns gradually at a maximum rate instead of snapping between grid directions, so trails are curves with wide turning circles.

Games: 3 · lineages: other, io-territory

Examples:

- **Achtung, die Kurve!** (1993): Two buttons steer left and right with a limited turn rate, giving curved trails.
- **Paper Loop 2** (2026): Real heading and gradual turns instead of the first game's grid steps.
- **looprush** (2026): Optional free heading with a turn-rate limit as an alternative to cardinal keys.

Variants:

- Achtung, die Kurve! (1993): two buttons rotate the heading left or right at a limited rate
- Paper Loop 2 (2026): a real heading with gradual turns replaces the first game's grid steps
- looprush (2026): an optional free heading with a turn-rate limit, as an alternative to cardinal keys

## Launched physics-body trail

Instead of steering a marker, the player launches a physics body by dragging and releasing or by flicking it. Its path, bouncing off walls, is the trail, and the number of shots or flicks limits or grades the capture.

Games: 3 · lineages: qix, io-territory, other

Examples:

- **Loopinball** (2025): A pinball's physics-driven trail is the line looped around bumpers.
- **Ink Fill** (2026): Drag and release to launch; the unfinished trail must be protected until it closes; stars for fewer shots.
- **Marble Land Grab** (2026): Return within 3 flicks; everything inside the marble's path is claimed.

Variants:

- Ink Fill (2026): drag and release a ball; its trail seals off enemy-free areas, and stars reward finishing in fewer shots
- Marble Land Grab (2026): the marble must return home within 3 flicks; a classic mode plays turn by turn as 2-player hot-seat
- Loopinball (2025): a pinball's physics-driven trail is looped around bumpers

## Movement confined to the line network

When safe, the player can move only along lines: the border and lines already drawn. Each new line extends that network, and some games close parts of it.

Games: 3 · lineages: qix

Examples:

- **Torch 2081** (1986): You cannot travel along edges shared by two built panels, only along the perimeter and edges facing open space.
- **Vertex (Komodor)** (2025): The droid moves along new or existing orthogonal lines.
- **point line surface** (2026 (Early Access)): The character moves only along its own network of drawn lines.

Variants:

- point line surface (2026 (Early Access)): the character moves only along its own network of drawn lines
- Vertex (Komodor) (2025): the droid moves along new or existing orthogonal lines
- Torch 2081 (1986): edges shared by two built panels are closed; only the outer perimeter and panel edges facing open space can be travelled

## Rectangle-only captures

Every capture is drawn as a rectangle rather than as an arbitrary path.

Games: 3 · lineages: qix, gals-panic

Examples:

- **Doodlebug** (1984): The Bug kills only if it touches the line of an unfinished rectangle.
- **XPOSED SWITCHED** (2023): Captures are rectangles only, each uncovering part of the hidden background.
- **Dream Snake Adventure** (2026): Cut rectangles into the arena to win territory while dodging enemies.

Variants:

- Doodlebug (1984): the open shape is an unfinished rectangle, and the Bug kills only by touching its line
- XPOSED SWITCHED (2023): each rectangle uncovers part of the hidden background
- Dream Snake Adventure (2026): rectangles are cut into the arena while dodging enemies

## Placed wall structures

Instead of drawing a trail, the player places wall pieces, blocks or towers. Closed rings of them become territory, and the structures can be damaged.

Games: 3 · lineages: other, io-territory

Examples:

- **Rampart** (1990): Tetris-like wall pieces are placed in a timed build phase; pieces are often larger than the gaps.
- **SINTOU 〜侵闘〜** (2007): Blocks are placed in 3D to wall in ground; taller stacks make sturdier walls.
- **Defly.io** (unknown): A helicopter places towers joined by walls; enclosed regions become territory.

Variants:

- Rampart (1990): Tetris-like wall pieces are placed in a timed build phase; oversized pieces leave awkward leftovers for later repairs
- SINTOU 〜侵闘〜 (2007): blocks placed in 3D wall in ground; taller stacks make sturdier walls
- Defly.io: a helicopter places towers within a build range that join with walls; build range, tower shield and tower health are upgradeable, and towers can be shot down

## Permanent lethal trails (light-cycle model)

Every trail stays on the field as a solid wall until the round ends. Touching any trail or the border is a crash, so free space shrinks as play goes on.

Games: 3 · lineages: other

Examples:

- **Blockade** (1976): Two arrows leave permanent trails; crashing into either trail or the border scores a point for the opponent.
- **Achtung, die Kurve!** (1993): Trails stay until the game ends; random gaps let a player escape an enclosure.
- **YOUR GAME** (2023): Walking leaves a red floor trail that neither the player nor enemies can walk on.

Variants:

- Blockade (1976): two arrows leave permanent trails; a crash scores a point for the opponent
- Achtung, die Kurve! (1993): random gaps open in trails, so a player can escape an enclosure; this is its main addition to Červi
- YOUR GAME (2023): walking leaves a red floor trail that neither the player nor enemies can walk on; being enclosed on all four sides is game over

## Off-safe-ground exposure limit

A meter or warning tied to the open cut limits how long or how far the player can stay off claimed land. It may be a resource that drains from the moment the player leaves the edge, or a range beyond which the trail warns or vanishes.

Games: 3 · lineages: xonix, amidar-painter

Examples:

- **Amidar** (1982): On roller stages the roller runs out of paint if it strays too far from filled boxes, and the unfinished lines vanish.
- **Reef Reveal** (2026): An air meter starts draining the moment you leave the shore.
- **Cosmo Xonix: Space Arcade** (2026): The trail heats orange when you push too far from home.

Variants:

- Reef Reveal (2026): an air meter drains from the moment you leave the shore, capping how long a cut can stay open
- Cosmo Xonix: Space Arcade (2026): the trail heats orange when you push too far from home
- Amidar (1982): on roller stages the paint runs out if the roller strays too far from filled boxes, and the unfinished lines vanish

## Concurrent wall limit

A rule caps how many walls or shapes can be under construction at once. One is the classic limit, but some rules allow several builders, or any number.

Games: 3 · lineages: jezzball

Examples:

- **JezzBall Classic** (2011): A rule mod allows two wallbuilders at once.
- **Pumping Square** (2023): Any number of rectangles can be placed.
- **Coconut's Coco-Net** (2026): Each player can have only one wall active at a time.

Variants:

- JezzBall Classic (2011): a rule mod allows two wallbuilders at once
- Pumping Square (2023): any number of rectangles can be placed
- Coconut's Coco-Net (2026): each player can have only one wall active at a time

## Any-angle straight cuts

Straight cut lines can be drawn at any angle by dragging or swiping, not only horizontally or vertically, so the field splits along the segment into polygonal regions.

Games: 2 · lineages: jezzball

Examples:

- **iSlash** (2010): A swipe cuts across the shape at any angle.
- **Sweet Split** (2012): Walls are drawn at any angle by dragging.

Variants:

- iSlash (2010): a swipe slices across the shape at any angle
- Sweet Split (2012): walls are dragged at any angle and grow, so a wrong line costs a life

## Decaying or vanishing unfinished trail

Instead of an instant death or a clean erase, the open trail starts to disappear and the player must reach safety before it is gone, or the excursion simply fails.

Games: 2 · lineages: xonix, io-territory

Examples:

- **Tinnitus** (2022): An enemy touching your path makes it decay quickly; reach a safe zone before it vanishes or restart the level.
- **Snake Conquest** (2026): An unfinished route can disappear.

Variants:

- Tinnitus (2022): an enemy touching the path makes it decay quickly; reach a blue or grey safe zone before it vanishes or the level restarts
- Snake Conquest (2026): an unfinished route can disappear (the trigger is not stated)

## Straight strand walls

A button starts and stops a straight strand or line from the avatar. Strands persist and add up into walls, instead of each one closing an area.

Games: 2 · lineages: other

Examples:

- **Spider Web** (1989): One button starts and stops a straight web strand; strands persist and build a web that catches flies.
- **Brainstorm (TI-86)** (2002): Three lines wall a ball into point-giving areas.

Variants:

- Spider Web (1989): one button starts and stops a straight web strand; strands build a web that catches flies
- Brainstorm (TI-86) (2002): three lines wall a ball into point-giving areas, a JezzBall-like wall rule

## Shots as the drawing tool

Projectiles make the capture instead of movement. Either a loop formed by your shots encircles a target, or each bullet recolours the cells it hits.

Games: 2 · lineages: other

Examples:

- **Go Around** (2025): An enemy dies when a loop of your shots encircles it.
- **Paint Tanks** (unknown): Tank bullets recolour map cells to your colour to capture area.

Variants:

- Go Around (2025): shoot around enemies, never at them; an enemy dies when a loop of your shots encircles it
- Paint Tanks: tank bullets recolour map cells to your colour

## Backtracking undoes progress

Moving back over your own unfinished work, or making a movement error, reverses progress instead of being neutral, and can make enemies more aggressive.

Games: 2 · lineages: amidar-painter

Examples:

- **Pepper II** (1982): Going back over an unfinished segment unzips the zipper trail the player has laid.
- **Gridd Worz** (1984): Re-crossing cleared cells or bumping the edge adds cells back and makes the Drones home in on the player.

Variants:

- Pepper II (1982): going back over an unfinished segment unzips the zipper trail
- Gridd Worz (1984): re-crossing cleared cells or bumping the edge adds cells back to the remaining count and makes the Drones home in

## Instant slash cut

A cut applies the moment it is drawn, with no growth phase, so it cannot be intercepted while under construction. The difficulty comes from enemy placement and the cut budget instead.

Games: 1 · lineages: jezzball

Examples:

- **iSlash** (2010): The cut is instant, with no marker walking the edge.

Variants:

- iSlash (2010): the cut is instant, with no marker walking the edge

## Arc captures from control points

Each capture is a circular arc set by three points the player places with the mouse, instead of a straight line or a steered path. The player is exposed while the arc is being captured.

Games: 1 · lineages: qix

Examples:

- **Enveloping Darkness** (2025): Three mouse-placed control points set the arc; spaceship missiles can hit you while you capture it.

Variants:

- Enveloping Darkness (2025): three mouse-placed control points; spaceship missiles can hit you during the capture

## Cuts chained across faces

On a polyhedral field, holding a modifier while crossing a vertex carries the current cut onto the next face, so one cut can span several faces.

Games: 1 · lineages: qix

Examples:

- **Cubixx** (2009): Holding L or R while crossing a vertex chains faces into one cut.

Variants:

- Cubixx (2009): holding L or R while crossing a vertex chains faces into one cut

## Wall pushing instead of drawing

There is no trail. Each of the four walls has its own key and moves inward a fixed step per press, shrinking the arena, and only the wall moved last can be hit by the enemy.

Games: 1 · lineages: qix

Examples:

- **Qix (Tilt type-in)** (1987): One key per side pushes that wall in 2 pixels for 1 point; touching the last-moved wall loses random points.

Variants:

- Qix (Tilt type-in) (1987): one key per side pushes that wall in 2 pixels for 1 point; the bouncing line touching the last-moved wall costs 0-19 points at random

## Perpendicular-only departure

The player can leave the border only by moving perpendicular to it, straight into the field; moves along the border keep it on the border.

Games: 1 · lineages: qix

Examples:

- **Boundarpy** (c. 2019): The player leaves the border only by moving perpendicular to it.

Variants:

- Boundarpy (c. 2019): the border can be left only perpendicular to it

## Lockstep twin movers

Two linked arrows move in lockstep, so a path has to be plotted on which they do not collide.

Games: 1 · lineages: qix

Examples:

- **Territory Arrow** (2026): Twin linked arrows move in lockstep.

Variants:

- Territory Arrow (2026): twin linked arrows; the page does not say whether they are enemies or player-controlled

## Invincibility gauge while not drawing

Moving without drawing makes the player invincible while an energy gauge lasts. Starting to draw switches the invincibility off, and the gauge recovers while not drawing.

Games: 1 · lineages: qix

Examples:

- **HIDDEN JOURNEY: ASIA** (2026): The gauge recovers in the non-drawing state; drawing turns invincibility off.

Variants:

- HIDDEN JOURNEY: ASIA (2026): holding Space / A to draw turns invincibility off

## Hold to keep the trail open (precision draw)

Holding a button changes movement speed and stops the trail from solidifying into claimed land while held. This gives finer control and larger bonus areas at the cost of longer exposure.

Games: 1 · lineages: xonix

Examples:

- **OVERWORLD** (2026): Holding A or B changes speed and keeps the trail from solidifying; captures beyond the level target score bonus.

Variants:

- OVERWORLD (2026): holding A or B keeps the trail open; captures beyond the level target score a bonus

## Shoot your own trail to escape

The player can fire at their own open trail to blast an exit block through it, escaping a self-trap at a score cost.

Games: 1 · lineages: xonix

Examples:

- **Claim (DaNuTree)** (2026): Shoot your own trail in the facing direction to blast an exit block, at a score cost.

Variants:

- Claim (DaNuTree) (2026): shoot in the facing direction to blast an exit block, at a score cost

## Own drawn line shields contact

Enemies can travel on the player's drawn lines, but touching an enemy while it is on the player's own line is not a miss.

Games: 1 · lineages: gals-panic

Examples:

- **Dancing Eyes** (1996): Touching an enemy that is on your own drawn line is not a miss.

Variants:

- Dancing Eyes (1996): touching an enemy on your own line is safe; the P item also stuns enemies touching your line

## Two cursors joined by a wrapping line

The player steers two endpoints at once with twin sticks. The line between them wraps around poles in the field, so loops form by wrapping rather than by one cursor returning.

Games: 1 · lineages: other

Examples:

- **Libble Rabble** (1983): Twin-stick control of two arrows joined by a line that wraps around poles to form loops.

Variants:

- Libble Rabble (1983): two arrows joined by a line that wraps around poles

## Hooked rope with pins

The trail is a rope that starts on a wall hook, and the loop closes only when it is reattached to the same wall side. Floor pins anchor it mid-field without closing it, and the rope can be dropped and restarted at will.

Games: 1 · lineages: other

Examples:

- **Sewernir** (2025): Rope attaches to wall hooks, closes only on the starting wall side and uses floor pins as mid-field anchors.

Variants:

- Sewernir (2025): the rope also lures enemies

## Orbit-and-jump movement

The avatar automatically circles the anchor it stands on, and the only action is timing the jump to the next anchor. A mistimed jump falls off and costs a life.

Games: 1 · lineages: other

Examples:

- **Star Trigon** (2002): The player circles the planet they stand on and must time each jump, or falls off and loses a life.

Variants:

- Star Trigon (2002): circle a planet and time each jump to the next

## Expiring trap walls

The player closes walls behind itself that trap pursuers, but each wall reopens after a few seconds and only a few can be closed at once.

Games: 1 · lineages: other

Examples:

- **Lock 'n' Chase** (1981): Doorways closed behind the player trap the police; at most two are closed at once and each reopens after a few seconds.

Variants:

- Lock 'n' Chase (1981): at most two doorways closed at once, each reopening after a few seconds

## Auto-laid territory markers

Movement automatically drops claim markers on every square passed, and the markers themselves are the territory, with no enclosure needed.

Games: 1 · lineages: other

Examples:

- **Harapeko Bakka** (1994): Dinosaurs on a 9x9 grid automatically drop eggs of their colour along their path to claim squares.

Variants:

- Harapeko Bakka (1994): dinosaurs on a 9x9 grid drop eggs of their colour along their path

## Drawn paths as platforms

Lines the player draws become solid paths that carry the character around hazards, and a separate input erases them.

Games: 1 · lineages: other

Examples:

- **Yoshi Touch & Go** (2005): Drawn lines become cloud paths that open alternate routes; blowing into the microphone erases them.

Variants:

- Yoshi Touch & Go (2005): drawn cloud paths open alternate routes; blowing into the microphone erases them

## Damaging trail

The trail itself is the weapon: enemies touching it take damage over time, so the player attacks by walking, with no aiming.

Games: 1 · lineages: other

Examples:

- **Lazy Drawer: Line Survivors** (2026): Enemies touching your walking trail take damage over time.

Variants:

- Lazy Drawer: Line Survivors (2026): no weapons or aiming; the walking trail damages enemies

## Momentum grappling hook

Every action button fires a fast grappling hook that pulls the player with momentum. The hook is used both to move and to attack, alongside wall building.

Games: 1 · lineages: jezzball

Examples:

- **Coconut's Coco-Net** (2026): Every button fires the hook; holding a button reaches farther to place an item.

Variants:

- Coconut's Coco-Net (2026): the net and ball buttons also carry an item, and holding a button reaches farther to place it

## Overcharged build speed with self-destruct risk

The player can pump extra energy into the wall builder so walls grow faster, but overcharging past a limit makes the player explode. Safety is traded for a shorter exposure window.

Games: 1 · lineages: jezzball

Examples:

- **JEZZAK** (2023): Cranking forward overcharges the isolator; too much overcharge makes the player explode.

Variants:

- JEZZAK (2023): cranking forward overcharges the isolator

## Hop-marked cube lines

The player hops cell by cell across an isometric cube pyramid. The hops mark horizontal or diagonal lines of cubes, and marked lines drop out of play, partitioning the pyramid.

Games: 1 · lineages: jezzball

Examples:

- **Q\*BALL** (2025): Hops across a Q\*bert-style pyramid mark lines of cubes, which then drop out of play.

Variants:

- Q\*BALL (2025): Q\*bert-style hopping marks lines that drop out

## Hold-to-trace line with a retracting tag

A line is drawn on the grid only while a trace button is held, and a tag rides it from its start. On release the tag runs back to the player and retracts the line; if the line has fully enclosed grid blocks, the tag circles them and removes them.

Games: 1 · lineages: amidar-painter

Examples:

- **Wonder Stick** (1998): The penguin draws only while the trace button is held; the tag returns on release or circles fully enclosed blocks, which vanish.

Variants:

- Wonder Stick (1998): a penguin traces lines and enclosed blocks vanish

## Forward-only self-consuming track

The player can only move forward along the lines and erases every line left behind, so the playable network shrinks over time. Reaching a dead end with no line left costs a life.

Games: 1 · lineages: amidar-painter

Examples:

- **Mr. TNT** (1983): Lines are erased behind the player; a dead end with no line left costs a life.

Variants:

- Mr. TNT (1983): each erased section scores 10 times the stage number

## Wide path

The drawn path is wider than a single line, so the trail covers more ground and makes a larger target.

Games: 1 · lineages: io-territory

Examples:

- **Territory Grid** (unknown): Leave your safe zone and draw a wide path.

Variants:

- Territory Grid: a wide path is drawn out of the safe zone and reconnected home

## GPS walking capture

The player moves physically. They drop an anchor, walk a closed loop on real streets and close it near the anchor to claim the polygon inside.

Games: 1 · lineages: io-territory

Examples:

- **Plotta: Walking Map Game** (2026): Walk a closed loop on real streets and close it near your anchor; only the polygons are shared.

Variants:

- Plotta: Walking Map Game (2026): only the closed land polygons are shared, not raw GPS paths
