# Territory-capture genre research

What the games in the lineages of *Qix* and *Volfied* do, and which of their mechanics could add variety to Jiro-ikusu.

**Status: research notes, not a specification.** The project [README](../../README.md) is the specification and wins over anything here. Nothing here is scheduled or decided: the ideas are proposals, the [open questions](#open-questions-for-the-owner) are the owner's, and an idea enters [`IMPLEMENTATION_PLAN.md`](../../IMPLEMENTATION_PLAN.md) only as a work item of its own, with the follow-up work [`CLAUDE.md`](../../CLAUDE.md) requires for what it changes. Taito's titles and other games' names appear here only to say where a mechanic comes from; they stay out of Jiro's product names (README §13, D13).

## Files

| File | What it holds |
|---|---|
| [`CATALOG.md`](CATALOG.md) | 710 games, ports and clones in 16 categories and 8 lineages, each with its distinctive mechanics and sources |
| [`catalog.json`](catalog.json) | The catalog's data, with notes and every source |
| [`TAXONOMY.md`](TAXONOMY.md) and [`taxonomy/`](taxonomy) | 628 mechanic families drawn from the catalog, in 12 axes, with the games that show each |
| [`IDEAS.md`](IDEAS.md) and [`ideas/`](ideas) | 143 concept ideas for Jiro-ikusu, each judged for feasibility, fairness and play |

## How it was built

Both stages ran as multi-agent workflows: language-model agents that searched the web (for the catalog) or read this repository (for the ideas), whose outputs code merged and further agents checked.

### The catalog

1. **Sweep.** Eight agents searched in parallel, each from one angle: Taito's own releases and ports; other arcade boards and image-reveal games; home computers and consoles from 1982 to 1999; shareware, Flash and early mobile; modern indie stores and game jams; homebrew, fantasy consoles, small handhelds and open source; adjacent genres and minigames; regional scenes (Soviet, Japanese, Chinese, Korean and others, searched in their own languages). They found 756 entries, 524 after merging titles.
2. **Gap-fill.** Three completeness critics read the list and searched for what it missed: one walked platforms, one walked periods, one hunted games that change the formula. Three rounds added 166, 62 and 41 titles.
3. **Reconcile.** One agent merged 41 groups of duplicates found under different names: 785 entries became 732.
4. **Verify.** A verifier checked every entry against its sources, and a second agent reviewed each one the verifier flagged. 710 were kept (324 confirmed, 376 corrected, 10 rescued by the second check) and 22 dropped; [`CATALOG.md`](CATALOG.md#not-included) gives the reason for each.

Limits:

- **Not exhaustive.** The third gap-fill round still found 41 new titles, so the long tail (jam games, mobile clones, regional releases) is not exhausted. The [Qixote wiki](https://wiki.ryliejamesthomas.net/doku.php?id=qixote) lists more names that no other source confirms.
- **Mechanics come from sources, not play.** Entries say what manuals, reviews, store pages, wikis and videos describe; nobody played the games for this survey.
- **The web-search budget ran out during verification**, so some checks fetched known pages directly instead of searching.
- 55 entries have no known year.

### The taxonomy and the ideas

1. **Taxonomy.** Ten agents, each reading a tenth of the catalog, extracted the mechanic families their games show (1,336). One agent per axis merged them into 628 families across 12 axes ([`TAXONOMY.md`](TAXONOMY.md)).
2. **Ideation.** Each designer got a brief of Jiro's rules, levels and modes, its hard constraints (determinism and seeded draws, one core for the RP2040, wasm and the zk guest, the wedgie's RAM and tick budget, proving cost, consensus formats, the search bot, the fairness of the six-level draw, the 240×240 screen, D13) and the cost tiers of [`IDEAS.md`](IDEAS.md). One designer per axis and five more with a cross-cutting lens (new levels on v1 knobs, human edge, presentation, modes and social play, bold combinations) proposed 222 ideas.
3. **Dedup.** One agent grouped near-duplicates into 47 groups, leaving 143 ideas; each keeps its merged variants.
4. **Judge.** Three judges scored every idea from 1 to 5, reading the repository as they needed: a skeptical core engineer (feasibility, true tier, cost), a fairness judge (D14, the search-bot gap, calibration, variance in the six-level draw) and a game designer (new decisions, readability at 4×4 px, fit with the rules). An idea is rejected when the engineer finds it infeasible or the fairness judge finds it unacceptable: 3 were, and 140 kept.
5. **Synthesize.** One agent wrote the recommendation below (shortlist, quick wins, packages, sequencing, open questions, the bot gap), and another the genre overview.

Limits:

- **Judgments are reviews, not measurements.** Cycle counts, RAM, timings and clear rates in the ideas are the agents' estimates unless they cite a committed report. A few agents built scratch levels to test a claim (a trial playtest of guarded islands, for example); those runs were not repeated and are not committed.
- **Scores are relative within a batch.** Each judge scored ideas ten at a time, so scores from different batches were never compared; treat a one-point difference as noise.

## The genre at a glance

Catalog entries by lineage and by decade of first release:

| Lineage | 1970s | 1980s | 1990s | 2000s | 2010s | 2020s | unknown | All |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Qix |  | 37 | 28 | 27 | 25 | 102 | 12 | 231 |
| Volfied |  | 1 | 1 |  | 6 | 18 |  | 26 |
| Xonix |  | 9 | 19 | 9 | 22 | 41 | 22 | 122 |
| JezzBall |  |  | 8 | 20 | 21 | 26 | 6 | 81 |
| Gals Panic |  |  | 24 | 10 | 8 | 26 | 4 | 72 |
| .io territory |  | 1 |  |  | 12 | 43 | 7 | 63 |
| Amidar and painters |  | 46 | 8 | 1 |  | 3 |  | 58 |
| Other | 1 | 9 | 8 | 11 | 5 | 19 | 4 | 57 |
| **All** | 1 | 103 | 96 | 78 | 99 | 278 | 55 | 710 |

The 2020s hold 278 of the 710 entries, 102 of them in the Qix lineage. Most Amidar-style painters date from the 1980s; the Gals Panic line peaks in the 1990s and again in the 2020s; Volfied's descendants are almost all from after 2010; and apart from *Territoire* (1985), the .io lineage starts with *Paper.io* in 2016.

### Qix

Arcade Qix (1981) defines this lineage. The marker rides the border and the edges of claimed land, and a held draw button lets it leave into the open field. The unfinished Stix is exposed to the roaming line creature (the Qix). Sparx patrol the edges, a Fuse burns along a stalled trail, and claiming 75% clears the stage. Early-1980s follow-ups (Styx, Stix, Statix, Kix, Frenzy, Torch 2081) varied draw speeds, score multipliers, stall penalties and which side of a cut is claimed. Super Qix (1987) went to one draw button, with items and hidden pictures. Later games wrapped the field onto 3D objects (Cubixx, Spherical Qix), added forts and turrets (Fortix), and made cutting subtractive (Patchwork Heroes, Curvebot Evolved). The large 2025-2026 wave of mobile and Steam releases (Neon Divide, Space Cutter, Territory: Claim & Conquer, Moonlight Territory and others) adds boss phases, upgrade drafts, daily seeds, enemies that warn before they attack, and touch controls.

Milestones:

- **Qix** (1981): Sets the template. Fast and Slow Draw buttons, with slow-drawn area scoring double. Sparx patrol the edges, a Fuse punishes stopping, and timer-released Super Sparx chase onto the trail. The clear is 75%, which operators can set from 50% to 90%. Two Qix appear from level 3, and splitting them raises a multiplier up to 9x.
- **Styx** (1983): 8-way movement allows diagonal Stix. The score multiplier cycles by colour (1x, 5x, 10x). Border caterpillars grow longer from level 4 and reset when trapped. Each percent above 80% pays 1,000 points, and stopping mid-line is fatal.
- **Stix** (1983): Slow draw pays 10x instead of 2x. The synthesizer has finite fuel. Stopping too long builds energy until it explodes, a stall penalty with no Fuse. A quark and anti-quark walk the inner border, and when the timer runs out the game ends.
- **Frenzy** (1984): Always claims the smaller side, so Leptons trapped there die. A level usually ends once every Lepton is killed rather than at an area quota, and at 95% fill all remaining enemies count as captured.
- **Super Qix** (1987): Replaces the two speeds with one draw button. A fire creeps along a paused line instead of the Fuse. Enclosures drop items (speed, Stop, Barrier, Double markers, Warp, Extra life) and keyword letters. Each round hides a picture, and 98% earns a free credit.
- **Twin Qix** (1995): An enemy touching the trail no longer means an instant miss. The clear threshold starts at 70% and rises. Versus play uses side-by-side fields with unlimited lives: the first to 95% wins the round, and each player's side reveals a different half of the picture.
- **Cubixx** (2009): Wraps the field onto the six faces of a cube. Holding L or R carries a cut across a vertex onto the next face. Each face has a droid that chases trails cut across it, and cuts that span several faces multiply the score. The HD version adds split-screen co-op and deathmatch for up to 7.
- **Fortix** (2009): Gives the formula a fortress theme. Capturing forts and dragons kills them permanently. Towers shoot once a line starts and can be captured while they reload. Walls cannot be used to close a line, keys open gates of their colour, terrain slows drawing, and a level map records crowns.

### Volfied

Volfied (1989) drops the Qix's edge Sparx and Fuse. Instead each stage has one boss with expendable minions, and item blocks are opened by enclosing them (speed, laser, time stop, shield pause, minion clear, and a boss-killing star). A border shield drains over time. An enemy touching the line sends a spark along it instead of killing outright, and the ship can retrace its unfinished line. There is one fixed draw speed, scoring depends only on area, and hidden jackpot rules exist. Console ports already sold rule choices as modes: the PC Engine port forbids erasing lines, the Mega Drive version and Ultimate Qix offer modes A/P/Q and A/B/C, and Qix Neo adds an arrange mode. Descendants (Volfield, Pakal, Animal Volfied, Mokoko X, ArcField, CUT Arcade, Starcutter, VoidMania, Volfi, Territory Raider) keep the boss-per-stage structure. They grow it into scripted bosses with phases, item crates, boss-trap win routes, daily seeds, upgrade drafts and season passes.

Milestones:

- **Volfied** (1989): Defines the lineage: boss and minions instead of Sparx, enclosure-opened item blocks, and a spark that runs along a touched line. It also adds a draining border shield, retractable lines, scoring by area only, and hidden clears (immobilise the enemies; enclose the boss with the first line for 1,000,000).
- **Ultimate Qix (Genesis port of Volfied)** (1991): Puts several rule sets on one engine. Mode A keeps the arcade spark rule under a stage timer. Modes B and C kill instantly on line contact, and mode C adds a speed button.
- **Volfield** (2016): Bonus and penalty boxes share the field (+/-1000 points, shield time, ships), so opening a box is a gamble. Players can set their own background per level. It has a 36-level mode beside an arcade mode, and leaderboards by 24 hours, 7 days, all time and country.
- **Animal Volfied** (2016): Introduces squeeze capture: shrinking the open area traps and destroys enemies without fully enclosing them.
- **ArcField: Neon Territory** (2025): Screen-filling bosses with weak spots. A spark chases along the red line in place of instant death, and getting too close to an enemy triggers a 0.3 s proximity shock. Lettered power-up tiles are claimed by enclosure, and lives carry over across 15 handcrafted levels.
- **Starcutter: Space Arcade** (2026): Ten bosses with one signature trick each (dash, line hunting, drones, mines, teleport, shockwave, land eating, light beam, reflection), and a final boss that uses them all. A Nova crate kills a boss outright. Daily shared sectors, an Expedition mode with upgrade picks, and a Cage the Boss bonus at 90-95%.
- **VoidMania** (2026): 21 enemy behaviours. Holding SPACE retraces the line, the only escape from a lit fuse. Trapping the boss is an alternative to the 80% clear. Sector modifiers (fog, rush, mirror, dark void), and a soundtrack that intensifies while an enemy has touched the line.
- **Territory Raider** (2026): The boss shoots faster above 40% claimed and fires spreads above 65%. Each life has a 60 s timer, and enemies speed up at 20 s and 10 s left. From stage 11, elemental patches rotate every 10 stages and are removed by enclosing them. Boss shots vanish on claimed land, and rocks are left out of the 80% target.

### Xonix

Xonix (1984) defines a land-and-sea model. There is no draw button: the cursor roams all claimed land freely and lays a trail only in the open 'sea'. Balls bounce diagonally in the sea, a separate enemy roams claimed land, and returning to land fills every pocket without a ball (only the trail if every pocket holds one). Zolyx (1987) and many clones refined this. The lineage has an unusual number of hobbyist and open-source reimplementations (X11/Macintosh, KolibriOS, Apple II, PICO-8, Rockbox, TI calculators) that document exact rules. Commercial versions moved to isometric 3D (AirXonix), reskins (Pac-Xon, Urbanix, Kids Xonix), enemies that eat claimed land, and shops (Xonix Blast). Recent mobile titles (Cosmo Xonix, GraviNix, Gotta Xonix, Claim) add worlds, bosses, collections, seasons, stealth and cash-out decisions.

Milestones:

- **Xonix** (1984): Defines the land-and-sea rules: free movement on claimed land, an automatic trail in the sea, diagonal balls that bounce off land and each other, and a land enemy on claimed ground. Each ball-free pocket fills, and trails left when every pocket holds a ball become walls for herding. One more ball arrives each level.
- **Zolyx** (1987): Several balls and no Qix, two of the enemy dots starting on claimed land, and a timed 75% target. Touching your own trail is fatal. The ZX Spectrum version spawns a chaser behind any line kept open too long, and the player has a limited stock of 'reverses'.
- **Xonix (X11/Macintosh reimplementation)** (1995): Two enemy classes, each bound to its own terrain. Flyers stay in the sea and kill through the trail; eaters cross filled land and kill only by touching the player. One more flyer arrives every level and one more eater every fifth. A machine-wide score file can optionally email the dethroned leader.
- **AirXonix** (2000): An isometric 3D field flown by a helicopter-like craft. Striped balls destroy claimed territory, mines roam claimed land, and spiked balls block level completion. Speed-up and slow-down pickups, five game types, and harder settings add stages.
- **Pac-Xon** (by early 2010): A Pac-Man reskin: ghosts are the bouncers and fruit are the power-ups (cherries speed you up, bananas slow the ghosts). Later levels add ghosts on straight paths, big ghosts and enemies that eat finished walls, and enclosed ghosts can be captured.
- **Urbanix** (2010): Claimed land becomes a town of houses. Housecrashers cannot hurt the player but destroy houses, Helisharks grab the player until shaken off, and some worlds need one to three capture passes. The clear goal is a points gauge rather than an area share.
- **Cosmo Xonix: Space Arcade** (2026): 63 levels in 7 worlds chosen on a 3D planet. Each world ends with a titan that cannot be hit and is beaten only by taking its ground. Trail hunters, breakers and spiked rocks; mini-bosses join a collection; per-level leaderboards, monthly seasons, and backing up along your own trail with no penalty.
- **Claim (DaNuTree)** (2026): At 75% the player may cash out, or push on for a growing bonus that one catch wipes out. Guards have vision cones, pillars block sight, and a Smoke Bomb hides the player. You can shoot your own trail to escape at a score cost. Mystery orbs give power-ups or power-downs, and there are Normal, Chaos and Zen modes.

### JezzBall

JezzBall (1992) removes the edge-walking marker. The player clicks any open cell and a straight wall grows both ways from it, vulnerable until it reaches a wall. Regions left without atoms are claimed, the target is 75% within a time limit, and each level adds an atom and a life. Clones (Barrack, IceBreaker, KBounce) split walls into halves that complete or break on their own and tuned the collision rules. Offshoots changed what the player places: hold-to-grow balls and rectangles (Filler, Hundreds, Pumping Square), instant cuts at any angle (iSlash), and swipe or drag walls on touch screens. Later games add large atom catalogues and power-ups (Jezz Mania), crank control and an avatar on the field (JEZZAK), and deterministic, verifiable play (Jezzball NES).

Milestones:

- **JezzBall** (1992): Defines point-launched growing walls with a right-click orientation toggle. An atom touching a wall under construction costs a life, and wall-closed regions without atoms fill. The target is 75% within a time limit. Lives at the start of a level equal the atom count, which caps at 50 from level 49.
- **IceBreaker** (2000): Each wall is two halves with independent fates. Each broken half costs a life, and breaking a line on purpose can leave small trap areas. The bonus beyond 80% grows exponentially, and the score drains about a point per second.
- **KBounce** (2000): A ball meeting the growing tip head-on makes the wall permanent there with no penalty. Level n has n+1 balls and n+1 lives, the time limit is 30x(n+2) seconds, and each remaining life pays 15 points.
- **Late** (2005): A mouse-aimed cutter that survives a few hits and whose cuts cannot be stopped once fired. Ball types diversify: goo balls split and reform, unstable triples explode when tightly enclosed, some balls teleport, and 'cold-blooded' balls home in on the cutter when they see it.
- **Filler** (2008): Replaces walls with hold-to-grow balls that freeze into claimed area. Each level grants a limited number of balls, the target is two-thirds, and a squashed bouncer respawns on the side away from the player.
- **iSlash** (2010): Any-angle swipe cuts that apply instantly, with no growth phase, and remove the cut-off part if no ninja stars are in it. The goal is the fewest cuts. Metal edges, saws and near-invisible stars, paid power-up packs, and 50 multiplayer race levels.
- **Jezz Mania: Better Jezzball** (2021): A large atom catalogue: atoms that speed up per bounce, slow down per bounce, turn at random, break finished walls, rush walls under construction, or spawn babies. A marker previews the wall, building starts on finger lift, and dragging above the field cancels. Spike walls, and a composite score times a level multiplier.
- **Jezzball NES** (2026): Fully deterministic from power-on. The recap shows the RNG seed and a CRC32 code, and a verifier replays the input recording against a SHA-256-pinned ROM with per-level checkpoint codes. The 9-digit score saturates instead of rolling over.

### Gals Panic

Gals Panic (1990) turns Qix-style capture into a picture reveal. The clear target is 80% of a woman's silhouette, not of the field. A mood meter reacts to silhouette versus background claims, a boss roams each round, and the reward escalates over a character's three rounds. Sequels started play from a rectangle inside the field, scrolled the field, added versus races on split fields, gave bosses attacks, and in Gal Pani X added bullet-hell bosses, graze scoring and branching routes. Photo-model arcade games (Fantasia, Super Model, Paradise, Zip & Zap, Harem Challenge) introduced graded ROM sets and operator photo grades. The modern Steam and mobile wave (Pretty Girls Panic!, Re: Gals Panic, Gensou, Landgrab and many 2024-2026 releases) centres on galleries, animated and Live2D rewards, voice acting and story framing.

Milestones:

- **Gals Panic** (1990): Silhouette-only coverage at 80%. A 20-step mood meter runs from 0 (lose a life) to 20 (clear regardless of coverage). A boss each round, monster pictures that force a replay, a post-round roulette, and an arc of 6 girls x 3 rounds.
- **Gals Panic II** (1993): Claiming starts from a rectangle inside the field and cannot connect to the outer border. The meter becomes time-based, an 8-way stick allows diagonal lines, and a break-out mini-game awards a life. It also has a Quiz Version and an optional prize-card dispenser, and its Special Edition adds shooting enemies.
- **Fantasia** (1994): Moves the silhouette reveal to photographed models. The bad image is a celebrity portrait, and a round finished while it shows must be replayed. Two players on 8-way joysticks.
- **Dancing Eyes** (1996): The field is a panel grid on a 3D polygon model, which can be rotated after the clear. Player and enemies move only on grid lines. The next stage is chosen from three (41 in all). Lettered items freeze the timer, widen clears or swap cleared and uncleared panels, and a KIDS mode skips the undressing stages.
- **Gals Panic S - Extra Edition** (1997): Versus on split halves of one silhouette, where the first to 80% wins. A large capture or a P item lets the player shoot the boss, but attacking too much enrages it: it then destroys territory and kills even off the trail. Pictures are tiered at 90% and 100%, and EXTRA coins unlock an alternate picture.
- **Gal Pani X** (2002 (demo 2000)): Starts from a random centre rectangle with free movement on claimed land. Bullet-hell bosses that shrink as free space shrinks. Grazing builds a combo, and bombs turn bullets into points. Three clear routes (80%, 100% opening an EX stage, or surrounding the boss), branching routes, replays and an unlockable hitbox display.
- **Pretty Girls Panic!** (2016): Steam-era revival. A water-filled barrier hides 13 girls over 50 stages, the normally safe edge has crabs, contact costs a 'tool' (life), and cleared stages fill a gallery. Its PLUS edition (2021) adds 22 voiced characters and partner bond progression.
- **Landgrab - Line Cutting Arcade** (2026): Trapping the boss outside the silhouette makes 100% possible. Hold CUT to draw, release to retreat. Pushing for 90-100% risks losing that cut's clear, points and a life. Online races for 2-4 players send attacks on big claims, with weekly leagues, daily missions and bond levels.

### .io territory

The home-territory loop model: the safe base is your own territory, leaving it lays a vulnerable trail, and returning claims the loop. Single-player and two-player games (Territoire 1985, 陣取り 1993, Queeks 1996) used it before Paper.io (2016) and Splix.io made it an online arena genre. There, crossing a rival's open trail eliminates them and loops steal rival land. Variants moved to hex tiles (Hexar.io, Superhex.io, Hexanaut.io), 3D shapes and maps (Paper.io 3D, Paper.io 4), vehicles (Pyrodrome, Qixotic, Grid Riders), team modes, battle royale with shrinking zones, and capture-the-flag or base objectives. A large 2026 cluster adds bot personalities, self-play neural bots, roguelite runs, ranked seasons and GPS walking capture.

Milestones:

- **Territoire** (1985): An early home-territory contest: two snakes each mark out their own terrain, and whoever encloses the most area wins.
- **陣取り (Evio)** (1993): A single-player home-territory loop. The dot grows its own blob, leaving it lays a line, and returning adds the enclosed part. The outer frame is lethal, enclosing the snake wins, and the score counts 100 hidden points on a 10x10 grid.
- **Paper.io** (2016): Defines the io loop: leave your land to draw a tail and return to claim it. An enemy touching your tail eliminates you, rivals' land can be stolen, and a match is won only by owning the whole map.
- **Splix.io** (c. 2016 (unconfirmed)): A grid version drawn cell by cell, with lobbies of 60-90 players. A killed player's whole area is removed and the killer sees +500. Spectator mode, and a freeze key that still leaves you killable.
- **Paper.io 2** (2018): Crossing your own tail is game over, and hitting a rival's tail erases their whole territory. Power-ups attack rivals, and skins unlocked by objectives change your land's look. The Steam version adds 45 custom maps, a map per country, and local split-screen for 4.
- **Hexanaut.io** (2022): Hex grid with capturable totems (speed, a slowing zone, a teleport gate, a spy tower that reveals the minimap). Capturing levels you up. At 20% a player becomes king and must hold the crown for 3 minutes while visible to all, and there is no respawn.
- **Paper Loop** (2026): On-device neural bots trained by self-play, beside a hand-written scripted bot. Sealing a rival's trail inside your capture eliminates it, and a live minimap shows the arena. The sequel adds a free heading and a circular arena.
- **Plotta: Walking Map Game** (2026): GPS walking capture: walk a closed loop on real streets and close it near your anchor. A loop over a neighbour's land takes the overlap, and full encirclement takes all of it. Only the polygons are shared, never the GPS paths, with global, country and neighbourhood leaderboards.

### Amidar and painters

Rail-bound painting: the player moves only along a fixed lattice or maze and claims the segments it walks. Make Trax (1981) counts painted paths, and Amidar (1982) fills a box once all its sides are painted. The early 1980s produced many arcade and home clones (Kid Grid, Pepper II, Oh Mummy, Gridder, Jolly Jogger, Time Runner, Potty Painter) with zipper trails, hidden prizes, Pac-Man-style turnabouts on enemies, limited jump or stun charges, gap blockers and chasers with a stated pursuit rule. Later entries are few: isometric boards (Zoom!), password-based mazes with hidden lines (Painter), a four-player tile battle (Live Wire!), and a 2025 revival (Painter Man!!).

Milestones:

- **Make Trax** (1981): Every maze path must be painted, with no enclosure. Two rollers crush chasing fish for 50 up to 9,000 points, the fish learn to dodge the rollers, and intruders leave footprints that must be repainted.
- **Amidar** (1982): An Amidakuji ladder grid where a box fills once all four sides are painted. Filling the corner boxes makes enemies killable for 200-1,600, with three jumps per life. Collecting stages alternate with painting stages, a perimeter Tracer turns into a trail follower, and there is an Amidakuji bonus stage.
- **Pepper II** (1982): A zipper trail that the Whippersnapper unzips if left unfinished, across four connected mazes per level. An energizer alternates between pitchfork and halo, and a prize is hidden under one segment.
- **Oh Mummy** (1983): Enclosing a tomb box reveals a scroll, a mummy, a key, a tomb or nothing, and the key and tomb are both required to clear. A released mummy carries over into the next level.
- **Gapper** (1986): A single Seeker takes the shortest route to cut the player off. The player can cut a short-lived gap at 5 points each. Lines turn from blue to red, a square pays 50, and a flashing box pays 100 only if enclosed while lit.
- **Zoom!** (1988): 36 faux-3D isometric boards. A tile flashes once its edges are coloured, but the board ends only when every line is skated. Spilers erase lines, some enemies slow the player instead of killing, two players play at once, and finishing a board kills all its enemies.
- **Live Wire!** (1999): Up to four players claim tiles on one grid by drawing all four sides. Power-ups steal tiles already owned, and the score counts tiles held, tiles stolen and kills.
- **Painter Man!!** (2025): A modern maze painter: every wall of a castle room must be painted while AI lions chase. A paint spill makes lions turn away and can trap them.

### Other

Games that claim or capture without the border-and-trail Qix setup. They include light-cycle permanent trails (Blockade, Achtung, die Kurve!), loops closed on your own trail that destroy or collect what is inside (Quantum, Libble Rabble, Do! Run Run), island splitting along fault lines (Dig Dug II), placed wall pieces (Rampart), stylus lassos with no avatar (Pokémon Ranger, Yoshi Touch & Go), links between fixed anchors (Ingress, Star Trigon, Spider), and team coverage painting (Splatoon). Since 2025 there is a cluster of survivors-like and bullet-hell games in which closing a loop is the attack (Smokescreen, Encircle, Go Around, Lazy Drawer).

Milestones:

- **Blockade** (1976): The light-cycle model: two arrows leave permanent lethal trails, each crash scores for the opponent, and the operator sets matches to 3-6 crashes.
- **Libble Rabble** (1983): Twin sticks steer two arrows joined by a line that wraps around poles. Loops harvest Mushlins, and loops you close yourself score more. A detector signals hidden chests that open only to a small loop. Shears and Demons cut the line, and bonus letters open a timed stage.
- **Dig Dug II** (1985): A jackhammer cracks an island along predefined fault lines. The smaller piece sinks with everything on it, the player included if careless. The score scales with enemies sunk at once, and the last enemies flee into the sea.
- **Rampart** (1990): Tetris-like wall pieces placed in a timed build phase. Each enclosed castle grants cannons, and a battle phase damages the walls, which must be repaired. Losing every enclosed castle ends the game. Played with a trackball, and in versus across rivers.
- **Pokémon Ranger** (2006): No avatar: loops are drawn around a moving target with a stylus. Each target needs a set number of loops, and the count resets if the line breaks. Loop length is capped by the Styler's level, attacks drain its HP, and captured Pokémon can be spent once as assists.
- **Ingress** (2013): Links between real-world portals. A triangle of links creates a field whose Mind Units scale with the human population under it. Destroying any one link breaks the field. Two factions compete.
- **Splatoon (Turf War)** (2015): Coverage without enclosure: online 4v4 teams paint turf for 3 minutes. Your team's ink lets you swim, hide and refill, enemy ink slows and damages you, and splatted players respawn at the team's start.
- **Lazy Drawer: Line Survivors** (2026): A survivors-style fusion. The walking trail damages enemies, and closed loops burst damage on everything inside. Each stage has waves, a mid-boss and a boss. Players pick 1 of 3 from 30+ upgrades, with 26 hidden synergies and charms bought with run gold, in runs of about 15 minutes.

## Mechanics taxonomy

[`TAXONOMY.md`](TAXONOMY.md) summarizes each axis and lists its families. The 12 axes, with their most common families:

| Axis | Families | Most common |
|---|---:|---|
| [Movement and drawing](TAXONOMY.md#movement-and-drawing) | 73 | [Home-territory loop capture (Paper.io model)](taxonomy/movement-and-drawing.md#home-territory-loop-capture-paperio-model) (54); [Open trail vulnerable to enemies](taxonomy/movement-and-drawing.md#open-trail-vulnerable-to-enemies) (43); [Self-crossing penalty (own trail is lethal)](taxonomy/movement-and-drawing.md#self-crossing-penalty-own-trail-is-lethal) (38) |
| [Capture rules](TAXONOMY.md#capture-rules) | 67 | [Area-percentage clear threshold](taxonomy/capture-rules.md#area-percentage-clear-threshold) (177); [Perimeter-complete box capture (Amidar model)](taxonomy/capture-rules.md#perimeter-complete-box-capture-amidar-model) (45); [Enclosed enemies are destroyed or captured](taxonomy/capture-rules.md#enclosed-enemies-are-destroyed-or-captured) (42) |
| [Field enemies](TAXONOMY.md#field-enemies) | 74 | [Mixed enemy roster](taxonomy/field-enemies.md#mixed-enemy-roster) (78); [Bouncing ball enemies](taxonomy/field-enemies.md#bouncing-ball-enemies) (57); [Homing chasers](taxonomy/field-enemies.md#homing-chasers) (45) |
| [Edge and claimed-area enemies](TAXONOMY.md#edge-and-claimed-area-enemies) | 26 | [Border patrollers (Sparx)](taxonomy/edge-and-claimed-enemies.md#border-patrollers-sparx) (62); [Stall fuse](taxonomy/edge-and-claimed-enemies.md#stall-fuse) (18); [Territory eaters](taxonomy/edge-and-claimed-enemies.md#territory-eaters) (16) |
| [Terrain and geometry](TAXONOMY.md#terrain-and-geometry) | 44 | [Interior obstacles and walls](taxonomy/terrain-and-geometry.md#interior-obstacles-and-walls) (28); [Non-rectangular field outlines](taxonomy/terrain-and-geometry.md#non-rectangular-field-outlines) (18); [Lethal static terrain and traps](taxonomy/terrain-and-geometry.md#lethal-static-terrain-and-traps) (15) |
| [Items and power-ups](TAXONOMY.md#items-and-power-ups) | 54 | [Player speed boost](taxonomy/items-and-power-ups.md#player-speed-boost) (56); [Field pickups collected by touch](taxonomy/items-and-power-ups.md#field-pickups-collected-by-touch) (53); [Enemy freeze (time stop)](taxonomy/items-and-power-ups.md#enemy-freeze-time-stop) (49) |
| [Scoring and risk](TAXONOMY.md#scoring-and-risk) | 58 | [Overfill percentage bonus](taxonomy/scoring-and-risk.md#overfill-percentage-bonus) (28); [Big single-capture bonus](taxonomy/scoring-and-risk.md#big-single-capture-bonus) (24); [Clear-speed bonus](taxonomy/scoring-and-risk.md#clear-speed-bonus) (22) |
| [Level structure and progression](TAXONOMY.md#level-structure-and-progression) | 54 | [Per-level enemy ramp](taxonomy/level-structure-and-progression.md#per-level-enemy-ramp) (85); [Worlds, chapters and themed stage groups](taxonomy/level-structure-and-progression.md#worlds-chapters-and-themed-stage-groups) (41); [Narrative frame and story campaign](taxonomy/level-structure-and-progression.md#narrative-frame-and-story-campaign) (31) |
| [Reveal and presentation](TAXONOMY.md#reveal-and-presentation) | 43 | [Hidden-picture reveal](taxonomy/reveal-and-presentation.md#hidden-picture-reveal) (127); [Themed reskin of capture roles](taxonomy/reveal-and-presentation.md#themed-reskin-of-capture-roles) (19); [Silhouette target display](taxonomy/reveal-and-presentation.md#silhouette-target-display) (17) |
| [Multiplayer and competition](TAXONOMY.md#multiplayer-and-competition) | 41 | [Trail cut eliminates its owner](taxonomy/multiplayer-and-competition.md#trail-cut-eliminates-its-owner) (37); [Online leaderboards](taxonomy/multiplayer-and-competition.md#online-leaderboards) (37); [Simultaneous shared-field versus capture](taxonomy/multiplayer-and-competition.md#simultaneous-shared-field-versus-capture) (31) |
| [Modes and meta](TAXONOMY.md#modes-and-meta) | 44 | [Endless mode](taxonomy/modes-and-meta.md#endless-mode) (38); [Picture gallery and memory mode](taxonomy/modes-and-meta.md#picture-gallery-and-memory-mode) (26); [Daily shared challenge](taxonomy/modes-and-meta.md#daily-shared-challenge) (25) |
| [Controls, time and pacing](TAXONOMY.md#controls-time-and-pacing) | 50 | [Level countdown timer](taxonomy/controls-time-and-pacing.md#level-countdown-timer) (80); [Timed match, largest territory wins](taxonomy/controls-time-and-pacing.md#timed-match-largest-territory-wins) (24); [Swipe steering](taxonomy/controls-time-and-pacing.md#swipe-steering) (20) |

## Concept ideas

[`IDEAS.md`](IDEAS.md) lists all 143 ideas by tier and score; the pages under [`ideas/`](ideas) give each one in full. Score is the sum of the three judges' scores, out of 15.

| Tier | Kept | Rejected | Best score |
|---|---:|---:|---:|
| [T0 Presentation](IDEAS.md#t0-presentation-24) | 24 | 0 | 13 |
| [T1 Level data v1](IDEAS.md#t1-level-data-v1-16) | 16 | 1 | 13 |
| [T2 Level format v2](IDEAS.md#t2-level-format-v2-5) | 5 | 0 | 13 |
| [T3 New core rule](IDEAS.md#t3-new-core-rule-68) | 68 | 0 | 12 |
| [T4 Input or journal](IDEAS.md#t4-input-or-journal-8) | 8 | 0 | 11 |
| [T5 Mode, scoring or contracts](IDEAS.md#t5-mode-scoring-or-contracts-19) | 19 | 2 | 11 |

Of the 143 ideas, the fairness judge found that 51 narrow the gap between search bots and skilled humans, 35 leave it as it is, 43 widen it and 14 are unclear. The recommendation that follows is the synthesis agent's, quoted as written apart from links.

### Shortlist

1. [Minion patrol and respawn forecast](ideas/edge-and-claimed-enemies.md#minion-patrol-and-respawn-forecast) (`edge-and-claimed-enemies#1`, T0, score 13): Joint top score (13). The forecast stays exact until the next capture because minions read only the rail. It reuses the core's pub right_hand_step and is T0. It narrows the gap by showing humans what search already simulates, and the respawn blink removes the row-major respawn surprise (R4.7-7, PIN-11) that only bots know. The one weakness is short lead time: 8 ticks on the seven period-1 levels.
2. [Boss turn tells](ideas/human-edge.md#boss-turn-tells) (`human-edge#1`, T0, score 12): The best fit among the presentation ideas: it telegraphs a seeded event without making it learnable across runs, so D14 holds. Tells are an exact function of key and tick. Build it as one overlay with [reveal-and-presentation#1](ideas/reveal-and-presentation.md#boss-path-forecast-overlay) (path forecast). Condition: the draw must come from a wasm/natmod export of the core, never a JS re-implementation of fmix32 and R4.6-7. Caveat: lead time is counted in boss moves, so the help is smallest on the high-weight period-1 levels.
3. [Edge-line HUD with commit readout](ideas/presentation-wedgie.md#edge-line-hud-with-commit-readout) (`presentation-wedgie#8`, T0, score 12): The browser half makes the D5 bank-or-push decision informed in Challenge ('X banks N' against 'clear pays at least M', via the existing level_score). That is information search already computes, with no consensus change. The wedgie edge-line half is weak (1-px lines on the rail) and can be dropped.
4. [Lesson ladder](ideas/level-structure-and-progression.md#lesson-ladder) (`level-structure-and-progression#3`, T1, score 13): The cheapest item with a clear gap benefit. Its lessons teach banking under D5 and the overshoot finish, the two levers where search beats the reference mix most. It is Training-only and T1, provided the lessons live in their own directory so CLAUDE.md's playtest and calibration chain and make_app_levels.py's 16-level pairing are not triggered.
5. [Daily shared seed](ideas/modes-and-meta.md#daily-shared-seed) (`modes-and-meta#3`, T0, score 13): A proven habit hook at zero consensus cost: Training accepts any nonce (§6.3), and the 'jiro.daily' tag cannot collide with consensus tags. The Sprint board adds a genuinely new objective (fastest clear). Boards are local or shared between friends, which rightly concedes that search would own a public board. The wedgie needs natmod keccak and draw exports.
6. [Per-level medal tiers in Training](ideas/modes-and-meta.md#per-level-medal-tiers-in-training) (`modes-and-meta#4`, T0, score 13): Self-imposed feats (Untouched, Single stroke, Boxed, Stranded, Last breath) create new decision contexts on the 16 existing levels, computed from state the shell already sees. Gold must be set per level: at 9,500 it is out of reach for humans on the B8 levels. It shares one art pipeline with [presentation-wedgie#1](ideas/presentation-wedgie.md#picture-reveal-under-claimed-land).
7. [Endless climb with carried lives](ideas/modes-and-social.md#endless-climb-with-carried-lives) (`modes-and-social#5`, T0, score 13): A strong wedgie fit. The device is Training-only with 16 fixed levels; this adds unseen boards, a run-level lives budget and X as a whole-run cash-out, all as plain v1 level bytes played by the unchanged core. The generator belongs in a no_std crate shared by wasm and natmod, with a bounded retry loop and an open-field fallback.
8. [Pace ghost of a best run](ideas/multiplayer-and-competition.md#pace-ghost-of-a-best-run) (`multiplayer-and-competition#1`, T0, score 12): A same-seed asynchronous rival with no new rules, which sharpens commit timing. Define its ghost/link format once and reuse it for the daily seed, the replay take-over and the duel. Draw the ghost so it cannot be mistaken for a real trail.
9. [Proven level codes](ideas/modes-and-meta.md#proven-level-codes) (`modes-and-meta#6`, T0, score 13): Gives the level editor a sharing loop in which every shared level has a replay-checked proof that it can be cleared. It is also a free trial of the 'completed once needs proof' problem the deferred Superchallenge must solve. The importer must check mode 0, levelIndex 0 and the proof nonce itself. Import is browser-only in practice (codes can reach about 33 KB).
10. [Street grid: seal segments to pen the boss](ideas/v1-levels.md#street-grid-seal-segments-to-pen-the-boss) (`v1-levels#2`, T1, score 13): Play 5 on existing knobs alone. Captures become graph cuts on a street network, guards are confined to block islands until a seal joins them to the main rail, and permanent stranding comes from R = 2,700. The geometry checks out and the scripted bots can play it. It widens the gap slightly (min-cut timing), so its weight needs watching.
11. [Slow giant, fast patrol: hide in the field](ideas/v1-levels.md#slow-giant-fast-patrol-hide-in-the-field) (`v1-levels#10`, T1, score 13): Inverts the game's geography (rail dangerous, field safe from minions) with periods alone, and turns D4's mid-cut stop into a tactic. A D14 coverage check was run by the judge. Fits mid-ladder, and the gap is about neutral.
12. [Guarded islands: release or remove the guard](ideas/edge-and-claimed-enemies.md#guarded-islands-release-or-remove-the-guard) (`edge-and-claimed-enemies#2`, T1, score 12): The only T1 board that has already been played: a trial playtest gave 50.5% clears and a median of 7,500 bp, so it can be calibrated. Annex, enclose or ignore is a readable three-way choice with a neutral gap. R must be long for 'remove the guard' to matter.
13. [Topology season: one field shape per slot](ideas/v1-levels.md#topology-season-one-field-shape-per-slot) (`v1-levels#14`, T1, score 12): The right vehicle for the T1 work: 16 different kinds of board instead of 10 open-field variants, with scratch sources already compiled and partly measured. The judge flagged the calibration risk (seal and anchor boards mispriced by a mix that only cuts rectangles) as real, so roll it out through Training first and add the missing mix policies before it enters a paid season.
14. [Overtime after the clear](ideas/controls-time-and-pacing.md#overtime-after-the-clear) (`controls-time-and-pacing#1`, T3, score 12): The best rule change in the set (play 5, fair 4, narrows). It nests a second push-your-luck round inside every cleared level without softening D5, lets humans harvest toward a ceiling that search already sits at, and the judges find that Challenge.sol and the Outcome need no change. Two things must be pinned first: the refill abuse (E at most 3 or a minimum capture size) and the crossing-tick order.
15. [Last-life lifeline on the rail](ideas/items-and-power-ups.md#last-life-lifeline-on-the-rail) (`items-and-power-ups#8`, T3, score 12): Adds a third branch to the signature commit decision at the moment it matters most (last life, half the target claimed). It narrows the gap at the bottom of the distribution because search almost never reaches its last life. It is cheap, uses free seed bytes and keeps D5's zero for a failed fetch. The Manhattan-distance pick must be fixed to rail reachability.
16. [Salvage when the lives run out](ideas/scoring-and-risk.md#salvage-when-the-lives-run-out) (`scoring-and-risk#6`, T5, score 11): The strongest pure fairness lever: no seed use, no state, and done as a core constant (not a level field) it needs only a RULES_VERSION bump. Turning the mix's D5 zeros into partial scores lowers exactly the hard-level weights where search's 2.03x pot share comes from, and makes per-level scores less bimodal. It drains Commit's meaning (play 2), so it competes with [multiplayer-and-competition#11](ideas/multiplayer-and-competition.md#claim-lines-that-insure-against-zero) for the owner's one D5 softening.
17. [Rail hunters](ideas/field-enemies.md#rail-hunters) (`field-enemies#11`, T3, score 12): Play 5: hunters contest the landing point of every cut and give fast cut, the D4 stop and feints new roles. The behaviour is visible and reactive, so the gap is neutral and D14 is untouched, at no RAM cost. It must not ship until the left-hand trace after reversal and the sense reset after a lost life are proven by the coverage property test, given D7's history.
18. [Counter-rotating patrols](ideas/edge-and-claimed-enemies.md#counter-rotating-patrols) (`edge-and-claimed-enemies#3`, T3, score 12): The cheapest T3 rule with a big effect on rail play: pincers and gaps that open and close instead of fixed spacing. It is an exact mirror of R4.7-2/R4.7-3/PIN-06, and the v1 state hash already carries a per-slot period. Bundle it with [field-enemies#3](ideas/field-enemies.md#mixed-speed-minion-roster) (per-slot periods, kept to small ratios) in one level-format bump, and rerun the mirrored coverage test.
19. [Island start](ideas/terrain-and-geometry.md#island-start) (`terrain-and-geometry#4`, T2, score 13): Joint top score (13) and the cheapest rule that turns the opening into a strategic choice: island growth free of minions against bridging to the long border rail. It adds 9 level bytes and no per-tick work, and the state hash stays v1. Needed first: a PIN-01 change with a RULES_VERSION bump, an unbiased candidate pick (count = 3 is biased today), and a seed-byte allocation, since byte 4 bits 2-3 are contested.
20. [Ramming slow minions from behind](ideas/field-enemies.md#ramming-slow-minions-from-behind) (`field-enemies#4`, T3, score 12): Gives the player an aggressive verb on the rail, aimed at the minion-heavy levels where the mix falls furthest behind (trio 20%, swarm 21%, doom 11% against search's 100%). The gap narrows, and it reuses presence 2 and the existing respawn lifecycle. Still to do: pin the countdown tick, make headings visible at corners, and give the mix a ram step before calibration.

### Quick wins

Small, low-risk changes that could start first:

1. [Minion patrol and respawn forecast](ideas/edge-and-claimed-enemies.md#minion-patrol-and-respawn-forecast) (`edge-and-claimed-enemies#1`, T0, score 13): T0, exact by construction, built on the core's pub right_hand_step. Narrows the gap in Challenge without touching consensus or calibration.
2. [Boss turn tells](ideas/human-edge.md#boss-turn-tells) (`human-edge#1`, T0, score 12): T0 boss turn tells, merged with [reveal-and-presentation#1](ideas/reveal-and-presentation.md#boss-path-forecast-overlay)'s dotted path into one overlay. Ship it once the core exposes the deflection draw and a boss-forecast step through wasm; never re-implement the rule in JS. Fix the horizon per season.
3. [Edge-line HUD with commit readout](ideas/presentation-wedgie.md#edge-line-hud-with-commit-readout) (`presentation-wedgie#8`, T0, score 12): Browser HUD 'X banks / clear pays / weight' computed with the existing level_score. A few hours of client work that makes D5's decision legible in paid play.
4. [Shape-coded sprites, colour-blind palettes and level themes](ideas/presentation-wedgie.md#shape-coded-sprites-colour-blind-palettes-and-level-themes) (`presentation-wedgie#9`, T0, score 12): Opt-in Okabe-Ito and high-contrast palettes plus shape-coded sprites. The browser boss is still magenta next to the red trail, so this is a real accessibility fix for paid play. Device themes can follow.
5. [Capture impact feedback](ideas/presentation-wedgie.md#capture-impact-feedback) (`presentation-wedgie#3`, T0, score 11): A capture '+x.x%' popup and the clearing capture's overshoot readout teach that claim is score. Drop the 2-px shake and the delayed band reveal, which hide state for up to 4 ticks.
6. [Lesson ladder](ideas/level-structure-and-progression.md#lesson-ladder) (`level-structure-and-progression#3`, T1, score 13): T1 lessons in their own directory (for example levels/lessons/src), Training only. Teaches the D5 bank and the overshoot finish. Add success feedback for 'Bank it' and 'Big finish', and check L3/L6 spawns for validity.
7. [Daily shared seed](ideas/modes-and-meta.md#daily-shared-seed) (`modes-and-meta#3`, T0, score 13): Browser half is clean today: journal_hash and draw already exist in jiro-wasm, and Training accepts any nonce. The wedgie half waits for natmod keccak and draw exports.
8. [Pace ghost of a best run](ideas/multiplayer-and-competition.md#pace-ghost-of-a-best-run) (`multiplayer-and-competition#1`, T0, score 12): Browser pace ghost on an existing journal and a second wasm instance. Define one ghost/link format keyed by RULES_VERSION and level id, and reuse it for the daily seed and duels.
9. [Per-level medal tiers in Training](ideas/modes-and-meta.md#per-level-medal-tiers-in-training) (`modes-and-meta#4`, T0, score 13): Feats are pure functions of jc.status fields (add claimable as a 24th field). Ship the feats first, with gold tiers set per level, and the picture album later with [presentation-wedgie#1](ideas/presentation-wedgie.md#picture-reveal-under-claimed-land).
10. [Run postcard from public journals](ideas/reveal-and-presentation.md#run-postcard-from-public-journals) (`reveal-and-presentation#5`, T0, score 12): Almost all existing code: web/src/chain/calldata.ts already recovers the six journals and the replay page replays them. Render lazily and never label anyone a bot.
11. [Slow giant, fast patrol: hide in the field](ideas/v1-levels.md#slow-giant-fast-patrol-hide-in-the-field) (`v1-levels#10`, T1, score 13): T1, data only, easy (greedy 99%). A good first Training-only extra board while the tools learn to handle level sets beyond the season's 16.
12. [Street grid: seal segments to pen the boss](ideas/v1-levels.md#street-grid-seal-segments-to-pen-the-boss) (`v1-levels#2`, T1, score 13): T1, data only, geometry and validity checked. Training first; it enters Challenge only at a season boundary with its own calibration.
13. [Guarded islands: release or remove the guard](ideas/edge-and-claimed-enemies.md#guarded-islands-release-or-remove-the-guard) (`edge-and-claimed-enemies#2`, T1, score 12): T1 and already trial-playtested (50.5% clears). A Training-only board now, a calibrated season slot later.

### Packages

Shortlisted and related ideas grouped into deliveries that share their prerequisites:

#### Training arcade layer

*Tiers up to T1.* Free-play variety and social hooks on the wedgie and in the browser, with zero consensus impact: Training accepts any nonce, and nothing here is paid.

Gives players reasons to come back without touching rules, vectors or season weights.

- The lesson ladder teaches the hidden rules (D5 banking, door sealing, stranding, the overshoot finish).
- Ghosts, the daily seed, take-over and duels give same-seed comparison through one shared journal-plus-level link format.
- Medal feats and a picture reveal turn the 16 known levels into new decision contexts.
- Postcards make public Challenge journals inspectable.
- Proven level codes give the editor a sharing loop.
- The endless climb gives the Training-only wedgie unseen boards.

The whole package is client code, plus one T1 lesson set kept outside levels/src so CLAUDE.md's playtest and calibration chain never fires. Boards stay local or shared between friends; any public board would belong to search.

Ideas: [Lesson ladder](ideas/level-structure-and-progression.md#lesson-ladder), [Pace ghost of a best run](ideas/multiplayer-and-competition.md#pace-ghost-of-a-best-run), [Daily shared seed](ideas/modes-and-meta.md#daily-shared-seed), [Per-level medal tiers in Training](ideas/modes-and-meta.md#per-level-medal-tiers-in-training), [Picture reveal under claimed land](ideas/presentation-wedgie.md#picture-reveal-under-claimed-land), [Run postcard from public journals](ideas/reveal-and-presentation.md#run-postcard-from-public-journals), [Replay take-over practice](ideas/modes-and-social.md#replay-take-over-practice), [Proven level codes](ideas/modes-and-meta.md#proven-level-codes), [Duel on identical seeded games](ideas/modes-and-social.md#duel-on-identical-seeded-games), [Endless climb with carried lives](ideas/modes-and-social.md#endless-climb-with-carried-lives).

Sequence:

1. Tools prerequisite: a separate level-set directory for the lessons, and make_app_levels.py appending them at weight 10,000.
2. Lesson ladder.
3. One ghost/link format (level bytes + journal, keyed by RULES_VERSION and level id), then the pace ghost in the browser.
4. Daily seed in the browser. Then natmod exports for keccak and draw, so the wedgie can join.
5. Medal feats: add claimable to jc.status, set gold per level.
6. One art pipeline in the Shadow's spare nibble (masked compare, obstacle flag, rail kept in the frame colour). Medal album and picture reveal share it.
7. Run postcard from calldata.ts and the replay page, rendered lazily.
8. Replay take-over in the browser only. Force mode 0, and wait for the owner's answer on revealed Challenge nonces.
9. Proven level codes, after the scripted bots build for wasm.
10. Sealed duel variant.
11. Endless climb last: the generator in a no_std crate shared by wasm and natmod, bounded retries with an open-field fallback, then re-measure the wedgie RAM on qemu.

#### Readable board

*Tiers up to T0.* Legibility aids that give humans, within the current tick, the information search already computes. These are T0, but they reach Challenge.

Narrows the human-search gap without a rule change. One forecast overlay shows the exact minion patrol and respawn cell and the boss's upcoming seeded turns and path, computed by running the core's own Boss::step, the deflection draw and right_hand_step on copies through wasm (and the natmod on the wedgie), so rules still live once. Alongside it: a commit readout (what X banks against what a clear pays), colour-blind palettes and shape coding, capture and overshoot feedback, and browser-only tick-locked sound. The capture preview comes last and stays optional: it is only right for an instant close, and it costs about 10 ms per tick on the device. Because these aids raise human medians unevenly (most on boss-heavy levels, least on the period-1 high-weight levels), they change how humans score against bot-derived weights. Ship them at a season boundary and freeze their horizon per season.

Ideas: [Minion patrol and respawn forecast](ideas/edge-and-claimed-enemies.md#minion-patrol-and-respawn-forecast), [Boss turn tells](ideas/human-edge.md#boss-turn-tells), [Boss path forecast overlay](ideas/reveal-and-presentation.md#boss-path-forecast-overlay), [Edge-line HUD with commit readout](ideas/presentation-wedgie.md#edge-line-hud-with-commit-readout), [Shape-coded sprites, colour-blind palettes and level themes](ideas/presentation-wedgie.md#shape-coded-sprites-colour-blind-palettes-and-level-themes), [Capture impact feedback](ideas/presentation-wedgie.md#capture-impact-feedback), [Generated sound with stereo minion cues and a danger drone](ideas/presentation-wedgie.md#generated-sound-with-stereo-minion-cues-and-a-danger-drone), [Live capture preview](ideas/presentation-wedgie.md#live-capture-preview).

Sequence:

1. Core-side pure exports through wasm and natmod: the deflection draw and a boss/minion forecast on copies.
2. Minion patrol and respawn forecast (exact).
3. Boss tells plus dotted path, with horizon H fixed as a per-season client constant.
4. Commit readout in the browser HUD.
5. Palettes and shape coding.
6. Capture popup and overshoot readout, without shake or delayed reveal.
7. Browser sound, with minion clicks throttled.
8. Capture preview, optional, browser first.

#### New boards on v1 knobs

*Tiers up to T1.* More board variety from level data alone (T1): no rule change and no RULES_VERSION bump. New level ids enter Challenge only at a season boundary.

Replaces 'open field with harder knobs' with real topologies that the scripted bots can play and calibrate:

- slow giant (rail dangerous, field safe);
- street grid (graph cuts, island guards, permanent stranding);
- guarded islands;
- shaped arenas (disc, octagon, plus, twin rooms);
- binding short clocks, the one knob all 16 levels leave at its maximum;
- letterbox;
- tree maze;
- pillar lattice.

They are assembled into a topology season and later fed from a calibrated offline library.
The recurring risk is calibration fidelity. The reference mix cuts only open rectangles: it never seals, hunts or holds B. Seal and anchor boards (vault, track, street grid, pillars) and staircase outlines will therefore be mispriced until the mix gains those policies or a season of player journals recalibrates them.
Excluded:

- the racetrack (an all-or-nothing seal that widens the gap);
- the low-target one-cut and sprint-cage levels (weight blow-up);
- [v1-levels#11](ideas/v1-levels.md#bank-it-a-level-that-never-clears) (rejected).

Ideas: [Slow giant, fast patrol: hide in the field](ideas/v1-levels.md#slow-giant-fast-patrol-hide-in-the-field), [Street grid: seal segments to pen the boss](ideas/v1-levels.md#street-grid-seal-segments-to-pen-the-boss), [Guarded islands: release or remove the guard](ideas/edge-and-claimed-enemies.md#guarded-islands-release-or-remove-the-guard), [Shaped arena outlines](ideas/terrain-and-geometry.md#shaped-arena-outlines), [Short-clock sprint levels](ideas/controls-time-and-pacing.md#short-clock-sprint-levels), [Letterbox band: one-axis squeeze](ideas/v1-levels.md#letterbox-band-one-axis-squeeze), [Tree maze: every seal cuts off a subtree](ideas/v1-levels.md#tree-maze-every-seal-cuts-off-a-subtree), [Pillar lattice of mid-field anchors](ideas/wild-combinations.md#pillar-lattice-of-mid-field-anchors), [Topology season: one field shape per slot](ideas/v1-levels.md#topology-season-one-field-shape-per-slot), [Season levels drawn from a calibrated library](ideas/level-structure-and-progression.md#season-levels-drawn-from-a-calibrated-library).

Sequence:

1. Generalize the tools beyond SEASON_LEVELS = 16. Level-set directories carry their own targets.json, and Training gets its own level list (§8.1 says 'all 16').
2. Ship slow giant, street grid and guarded islands as a Training-only set. Shaped arenas follow, twin rooms only with a high target.
3. Collect Training journals and compare human claims with the mix on the seal and anchor boards.
4. Add the missing reference-mix policies (seal a door, strand a minion, cut staircase rectangles) and write a new playtest report and calibration file.
5. Assemble the topology season: replace slots in a new season file with new level ids and the new calibration. Keep the old level bytes so earlier runs still settle.
6. Build the offline calibrated library generator with a pocket-width check (no seed-independent boss-free zones), its filters re-tested on today's 16.

#### Rules v3: endgame and second chances

*Tiers up to T4.* A single rules release that goes after the bot gap where it actually lives: D5 zeros on the high-weight hard levels, and the overshoot finisher.

Search already sits at 98.5% of the ceiling and almost never dies. The roughly 2x pot-share gap over the mix therefore comes mostly from the mix's zeroed and committed levels, multiplied by large weights (doom 64,620 at a mix median of 1,857 bp).

The package:

- Overtime after the clear: a nested push-your-luck round in which humans harvest toward the ceiling in small banked cuts. It leaves D5 intact, and the Outcome and contracts stay the same.
- Last-life lifeline: a costly third branch at the last life.
- One owner-chosen D5 softening, either a salvage share as a core constant or the crown line, not both.
- Optionally later, abandoning a cut with Y for the shield charge. That is T4: journal v2, plus amendments to D8 and D6.

All of these are forgiveness that search does not need, so the gap narrows. Each needs a scripted-bot policy before calibration, or the weights misprice it.

Ideas: [Overtime after the clear](ideas/controls-time-and-pacing.md#overtime-after-the-clear), [Last-life lifeline on the rail](ideas/items-and-power-ups.md#last-life-lifeline-on-the-rail), [Salvage when the lives run out](ideas/scoring-and-risk.md#salvage-when-the-lives-run-out), [Claim lines that insure against zero](ideas/multiplayer-and-competition.md#claim-lines-that-insure-against-zero), [Abandon a cut on demand](ideas/human-edge.md#abandon-a-cut-on-demand).

Sequence:

1. Scripted-bot policies first: an overtime exit rule, a lifeline fetch rule, and the committer's rule above the crown or salvage line.
2. Overtime with O = 0 reproducing today's behaviour. Pin the crossing tick and cap the refill (E at most 3, or a minimum capture size). Its O and E knobs ride on the shared level bytes v2.
3. Lifeline as a global rule, with reachability along the rail instead of Manhattan distance, and the 'arrived while invulnerable' gap fixed.
4. Salvage as a core constant (no level field), or the crown line with the 0xFFFF sentinel collision fixed. Owner's choice.
5. Rerun the bot-advantage report and recalibrate.
6. Abandon-cut on Y only if the owner amends D8 and D6, as a separate journal v2 step.

#### Level format v2: living rail

*Tiers up to T3.* Per-level knobs and new rail entities that make minions something to read and exploit, not just dodge. The rail is where humans lose most lives on the hard levels.

The package has a format half and an entities half.

Format half: one level bytes v2 that still decodes the 472-byte v1, so the 16 level ids survive. It adds per-slot minion periods, the minion hand, island start candidates and the overtime knobs.

Entities half, built on that format:

- counter-rotating patrols and mixed speeds (pincers, opening gaps);
- island start (a two-phase opening);
- ramming slow minions from behind;
- rail hunters that contest the landing point of each cut;
- optional experiments: strand-refills-shield, a counter-patrolling warden, and field sweepers on fixed tracks.

Each entity must keep the D7 coverage property, proven by the property test rather than argued from symmetry, and must get a scripted-bot model before calibration. Gap effects range from neutral to narrowing, except sweepers (neutral to slightly widening) and mixed speeds with large period ratios (slight widening).

Ideas: [Mixed-speed minion roster](ideas/field-enemies.md#mixed-speed-minion-roster), [Counter-rotating patrols](ideas/edge-and-claimed-enemies.md#counter-rotating-patrols), [Island start](ideas/terrain-and-geometry.md#island-start), [Ramming slow minions from behind](ideas/field-enemies.md#ramming-slow-minions-from-behind), [Rail hunters](ideas/field-enemies.md#rail-hunters), [Stranding a minion refills the shield](ideas/items-and-power-ups.md#stranding-a-minion-refills-the-shield), [Counter-patrolling warden](ideas/items-and-power-ups.md#counter-patrolling-warden), [Sweepers on fixed tracks](ideas/terrain-and-geometry.md#sweepers-on-fixed-tracks).

Sequence:

1. Seed-byte registry in README §6.4 before any seeded field. Byte 4 bits 2-7 and bytes 9-31 are claimed by colliding ideas: island start, twin boss and orientation all want byte 4; sweepers and the token want 11-16; lifeline, relics and flags want 17-20.
2. Level bytes v2 (decode v1 unchanged, re-pin the order of codes 20 and 21), shipped inside the Rules v3 release.
3. Counter-rotating hand plus per-slot periods, with small ratios. Rerun the mirrored coverage test.
4. Island start: PIN-01 rewrite, unbiased candidate pick.
5. Ramming: pin the countdown tick and the corner and orientation cases, and give the mix a ram step.
6. Rail hunters: prove the left-hand trace and the sense reset, and add vectors for the local minima.
7. Strand refill, warden and sweepers as level-flagged experiments, each measured with the bot-advantage report before entering a season.

### Sequencing

Where the project stands: rules are frozen at RULES_VERSION 2, and seasons/calibration-1.json holds the bot-derived weights. M4 (referee and contracts) is under way and M5's testnet season comes next. Each season commits its rulesVersion, its 16 level ids and its weights at open, and nothing changes them mid-season. A new rules version or new level set therefore means a new season, and the previous season's runs keep settling under their own referee until end plus grace. The packages are staged by what they touch:

1. Now, in parallel with M4 and M5 (no consensus impact):
   - All of 'Training arcade layer'.
   - The tools prerequisite: level sets beyond the season's 16, with a separate lessons directory and a Training-only level list. This keeps CLAUDE.md's playtest, calibration and make_app_levels.py chain from firing for non-season boards.
   - The natmod keccak and draw exports for the wedgie. These are a module rebuild, not a rule change.
2. Before testnet-1 opens, or at a later season boundary: 'Readable board'. It is T0, but it changes how humans score in Challenge relative to bot weights. So land it between seasons, freeze its forecast horizon per season, and record the client version, so the first season's human journals measure its effect. Do not change it mid-season.
3. During the first testnet seasons:
   - The 'New boards on v1 knobs' levels play in Training only, and their journals are compared with the reference mix.
   - The missing mix policies (seal, hunt, hold B, ram, overtime exit) go in as a new playtest report and a new calibration file. Never edit calibration-1 in place once a season references it.
4. First season boundary after M5.6 has closed and paid out a full season: a new season file may swap slots for calibrated new boards (new level ids, rules still 2), keeping old level bytes for settlement.
5. Rules v3 as a single release:
   - Contents: 'Rules v3: endgame and second chances' plus the format half of 'Level format v2: living rail' (level bytes v2 that still decode v1, so today's ids survive), with the seed-byte registry written first.
   - Costs: one bump instead of several, each of which costs regenerated vectors, a playtest rerun, recalibration, a new ZkReferee image and a new season.
   - Timing: adopt it at a season boundary, with the v2 seasons' human journals as the baseline the bot-advantage rerun is compared against.
6. Rules v4: the entities of 'Level format v2: living rail' (ramming, hunters, then optional sweepers, warden and strand refill), each after v3's season data shows the gap and calibration behaving.
7. Not scheduled:
   - T5 economics: the score-capped clear league, weekly shared six, boss finale slot, trade-off cards, run-wide lives pool and slow-motion allowance. These wait for measured mainnet economics.
   - Community map slots ([modes-and-social#9](ideas/modes-and-social.md#community-map-slots-in-the-season-a-reworked-superchallenge-paid)) are the closest reworked Superchallenge, but they stay with deferred M6 and TODO.md until a legal read: as written, the selection is a paid draw with a cash royalty.
   - Twin-boss levels ([level-structure-and-progression#10](ideas/level-structure-and-progression.md#twin-bosses-and-the-dividing-wall)) are the most promising later research track, and only in the variant that ends the level at separation, because that variant keeps D7's single region. D9 must be revisited first.

## The bot gap

The fairness judges agree that no mechanic closes the roughly 2x pot-share gap between search and the reference mix. The search edge stays an economic problem (README §7.4), but mechanics can move it at the margins and in a predictable direction.

**Where the gap lives.** Search already reaches 98.5% of a ceiling (claimable minus B squared) that most mechanics do not raise, and it almost never loses a life. Its lead over the mix comes mostly from D5 zeros and low commits on the hard levels, multiplied by their large weights: doom has a weight of 64,620 at a mix median of 1,857 bp, against maze at 13,692. Against greedy, its lead (1.29x) comes mainly from the big final overshoot capture.

**What narrows it.**

- Forgiveness search does not need: salvage, the last-life lifeline, the crown line, overtime, abandon-cut, retractable trail, reversal charges, extra lives. Salvage was judged to narrow it substantially, because it lifts hard-level medians and thereby lowers the weights that amplify search.
- Overshoot compression: overtime harvesting, a score cap near the target, a per-capture greed cap, the exit gate. These narrow it, and the cap and greed cap narrow it strongly, at the cost of compressing skill at the top.
- Legibility aids: boss tells and forecast, minion forecast, commit readout, capture preview. These give humans part of search's short-horizon foresight. Their help is uneven: it is smallest on the period-1, high-weight levels, where lead times counted in boss moves shrink to about 0.5 s. That shifts human difficulty against the bot-derived weights.

**What widens it.**

- Precision timing, multi-entity tracking, or foreknowledge of seeded events: sweepers, sparks, wake beads, wind-up charges, tethered or split twin bosses, capture flags, figure weighting, bounties, quick-chain and clear-speed bonuses, slow-cut premium, breath limit and stall fuse (search never stalls mid-cut, humans do), seal-timing boards like the racetrack.
- Rewards that scale with foresight, worst of all. The split multiplier was rejected for this.

**Narrowing that was discounted.** Several claimed narrowings relied on the measured single-core bot's padding (short clocks, the tide, speed bonuses). The README's threat model is a multi-core real-time bot, so those effects were discounted.

**Recurring fairness risks.**

- Calibration fidelity. The scripted mix never holds B, presses Y, seals, hunts or rams, so any mechanic it ignores is mispriced, and drawing that level becomes luck in the six-level draw.
- Exploits that search would find exactly: permanent stun chaining, barricade minion traps (a D7 regression), fright herding, the line-of-sight pin, relic re-placement timing, and hunt quotas, which the judges said need seeding under D14.

**Recommendation.** The most gap-efficient path is a combination: the forgiveness and overshoot rules of a rules v3 release, plus the legibility aids, plus mix policies that model what humans actually do, plus weights from player journals as soon as a season produces them.

## Open questions for the owner

1. May the official Challenge client ship foresight aids (boss turn tells and path, minion forecast, commit readout, capture preview)? D14 keeps games unlearnable across runs, but these aids raise human medians unevenly against bot-derived weights. If yes, must the horizon and the aid set be fixed per season?
2. D5: which single softening, if any, should rules v3 adopt: overtime after the clear (D5 untouched), the last-life lifeline, a salvage share when lives run out, or a crown line above which the claim is kept? Salvage and the crown line remove most of Commit's purpose.
3. D8: may Y (and the last reserved mask bit 7) become a game action? It can carry only one of: abandon a cut, rail barricade, reversal charges, spur wall or focus. Each needs journal v2. None is a pause, but D8's text must be amended.
4. D6: may the shield become renewable or multi-charge (strand refills it, per-level charge stock, vault, discharge, long-hold recharge), or does one charge per level stay a pillar?
5. D4: is any fuse-like pressure acceptable in a later version (stall fuse, rail rider, breath limit, restless boss), given that every such idea measured as widening the gap?
6. Should the reference bot mix in levels/targets.json gain new policies (hold B, seal doors, hunt strands, ram, overtime exit)? Every rule or board idea needs one to be calibratable, but changing the mix moves every level's weight and needs a new calibration file.
7. Should Challenge seasons rotate level sets (a topology season, or later a calibrated library)? If so, how often, given that each rotation needs new calibration, invalidates human practice, means rebuilding the wedgie's level file, and starts on bot-only weights?
8. Should the Training page refuse, or warn on, the nonce of a live Challenge run? The mode byte does not enter the level seed, so replay take-over and rewind make save-state splicing of a revealed paid level easy for semi-technical players (the §7.2 residual).
9. Is a twin-boss rule (D9 revision) worth pursuing, and only in the form that ends the level at separation so D7's single-region coverage argument holds?
10. Public boards: should the project ever publish a public season wall of medals or daily results, knowing that search would top every board on a known seed?

## Untried design space

What the catalog barely shows, from the overview agent; each line is a gap in the genre, not a recommendation:

- Verifiable deterministic competition: only Jezzball NES publishes seed-and-checksum replay verification against a pinned ROM. Fixed-tick determinism, seeds or simulation-verified stages are mentioned only by Containment, Ink Fill and Unveil, and no catalogued leaderboard is built on replay verification.
- Stakes-based play: rewards outside the game appear in only three titles (Gals Panic II prize cards, Gals Panic S2 phone numbers, a Penky redemption-ticket set). No catalogued game has entry fees or paid tournaments with verified outcomes.
- Asynchronous head-to-head on identical conditions: daily shared challenges are common (25), but ghost racing (4), a weekly race on one shared board (Bix) and spectator mode (Splix.io) are rare, and only Kunitori Returns pits players against friends' replay data.
- Opponents that learn or adapt: adaptive enemy AI appears in 3 games (Make Trax, Curvebot Evolved, LiM Grid Wars), dynamic rank in 1 (GALS HUNTER) and self-play neural bots in 2 (Paper Loop, Paper Loop 2).
- Music-driven play: enemies moving on the beat (Lightspace, Orbis), on-beat release scoring (Orbis) and music that intensifies with danger (VoidMania) are the only examples.
- Accessibility: switch-accessible controls appear once (Shocker, 1988) and enemies coded by shape rather than colour once (Neon Divide). Configurable colour schemes appear twice.
- Asymmetric multiplayer: a player controlling the enemies (3), a support shooter in co-op (Stix Disruption) and role reversal (3) are rare. Co-op is almost always two players drawing on one pooled field.
- Volumetric capture: only Jezz Cubed partitions a 3D volume. Cube, sphere and model surfaces (9) and 3D rendering (12) keep capture on a 2D surface.
- Field topology and dynamics: wrap-around edges (2), layouts that change mid-match (2), procedural layouts (2), a one-dimensional field (Xonitix) and a flowing field (firmament i-a) are barely explored.
- Alternative capture resolution: the side with fewer enemies (Bix), capture by disconnection (Grid Riders), cells claimed simultaneously turning neutral (looprush), equal ball counts per quadrant (Linsips) and decay of isolated cells (Q\*BALL) each appear once, against 33 games that claim enemy-free regions.
- Rules that shape greed: penalties for oversized captures (Enveloping Darkness), choosing a risk tier before a cut (Domain Expansion) and multipliers scaled by exposure (2) are rare, against 24 big-capture bonuses. Pushing past the quota or banking appears in only 6.
- Enemy ecology: enemies acting on each other appears only in predation in pens (Critter Round-Up), luring enemies into each other (YOUR GAME) and minions feeding the boss (Dig Dug: Digging Strike).
- Territory that must be maintained: claimed area decaying without an enemy (FillBottom, Orbis Survival) and enclosures that must stay intact to count (Rampart, Ingress, Moonlight Territory) are rare.
- Items that act on territory: swapping claimed and unclaimed cells (Dancing Eyes), a weapon gated by territory (Moonlight Territory), absorbing enemy powers (Orbis) and a second marker (Super Qix) each appear once.
- Hidden-information scoring and vision: a hidden grid of scoring points (陣取り Evio), hidden or darkened field areas (2) and spotlight darkness (Orbis) are rare. Sight-based stealth appears in 7.
- Unusual inputs: microphone (Yoshi Touch & Go), programming the drawing units (Matsuo & Takagi's 陣取りゲーム), crank (ISOL8, JEZZAK), tilt (4) and trackball (3) are rare compared with buttons, swipes and drags.
- User creation: level editors (5) and user-supplied pictures (5) are rare. Only Dream Snake Adventure and Lightspace share user levels online.
