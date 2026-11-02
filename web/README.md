# web

The browser game (README §3, plan M2.1): the core compiled to wasm (`web/wasm`, plan M1.11),
driven by a plain-canvas TypeScript shell.

## Stack (plan P8)

Vite and TypeScript with a plain canvas, vitest and ESLint, no UI framework. Versions are pinned
in `package.json`, with `package-lock.json`. TypeScript stays on 6.0, the newest release that
typescript-eslint supports. M2.2 adds one Playwright smoke test, and M5.1 adds ethers v6, the
version `scripts/contracts/` pins, for the Challenge page alone. M5.2 adds fake-indexeddb, a
development dependency only: the tests and the Challenge end-to-end run put the run store on
IndexedDB in memory, as Node has no IndexedDB.

## Run it

```bash
bash web/wasm/build-wasm.sh          # target/wasm32-unknown-unknown/release/jiro_wasm.wasm
npm --prefix web ci
npm --prefix web run dev             # http://localhost:5173
npm --prefix web run build           # web/dist, a static site
```

The page takes optional query parameters:

- `level`: a level name from the picker;
- `nonce`: a 32-byte run nonce in hex (by default each Training run draws a random one);
- `autoplay`: start without pressing Play;
- `hex`: a level's bytes in hex, played as "Edited level" (the level editor's Play button sets it).

The canvas exposes `data-state-hash`, `data-ticks-used` and, once the level has ended,
`data-end-reason`, for the smoke test.

## Training

The game page is Training (README §8.1): free, with no wallet, and no network call once the
engine and the levels have loaded. Each attempt draws a random run nonce, as README §6.3 allows
in Training. The picker lists the 16 levels, then the other levels: the open field, walls and
minions, and the editor's level. A level from any source, a file or the editor included, is
scored when it is one of the 16 levels, and plays unscored otherwise.

An attempt on one of the 16 levels scores as a season scores it (README §8.4): the core replays
the attempt's journal with the level's weight from `seasons/calibration-1.json` and gives its
`level_score`. The page refuses to start when its 16 levels are not that file's, under the
engine's rules version. Each level's best score stays in localStorage, under the rules version,
the level id and the weight it was made with, so a best counts only under the scoring it was
made with. Each new score is compared with the bests stored by every tab, not only this one's.
Without storage the page still plays, and keeps the bests for the page only. After each attempt
the end screen offers the journal, which the replay viewer replays.

## Replay viewer

`replay.html` (plan M2.3) watches and audits a journal: load a game vector with its `.trace`
file, or a level and a journal, each from a file or from hex; choosing one source clears the
others, so the page never replays an input left over from earlier. The core replays them as the
referee does and gives the Outcome; a journal the core rejects shows its error code. Play,
pause and step move through the ticks, and the slider seeks, which plays the journal again from
tick 0. Each tick shows its state hash and the inputs held, and a vector's trace is compared tick
for tick, with the first tick that differs.

## Level editor

`editor.html` (plan M2.5) edits a level: paint obstacles, place up to 3 minion spawns, which take
their slots in row-major order as a level source gives them (README §5), and set the boss body
size, its spawn rectangle and the other fields. An imported level gets its spawns numbered the
same way, and the page says so when that changes its bytes; a level with two minions on one
cell, which no source writes, is not imported. The editor has no format of its own: jiro-wasm's
`decode_level` and `encode_level` run the core's level codec on the editor's model, so a level
drawn here has the same bytes and `level_id` as its source compiled by the level tool. After
every change the core validates the bytes and shows the first rule they break, with its code.
It imports and exports `.bin` files and hex, and Play opens the game on the edited level.

## Challenge

`challenge.html` (plans M5.1, M5.2 and M5.7) is where Challenge runs (README §8.2) are played. It
connects the player's injected wallet (EIP-1193, `window.ethereum`), and when the
wallet is on another network it offers a switch, adding the network to the wallet if the wallet
does not know it. On the right network it shows the account's ETH balance and, on Arbitrum
Sepolia, a link to Arbitrum's list of faucets. Test ETH has no market price, so no fiat value is
shown. The footer lists the contract addresses of the deployment, linked to the explorer, and
the git sha the site was built from.

Once the wallet is on the right network, the page shows the season accepting runs: its run fee,
its players' pot so far (the fees less the rake, plus any rollover) and its parameters. It
refuses to buy a run unless the engine's rules version is the season's `rulesVersion` and the 16
shipped levels are the season's `levelIds`, slot by slot (`src/run/season.ts`); a run bought
anyway would never settle. Then a run goes, without a pause, from `startRun` with that season's
number and fee, through the wait for its entropy block, polling `isRevealable` every second, to
`revealRun` at once, the six drawn levels in mode 1 with a 3 s transition between them, and one
`commitRun` with the six journals as soon as the sixth level ends (README §7.2). A countdown
shows the slack left before the run's deadline, with the contract's formula, as if the run were
committed now, and the time left before `commitRun` refuses it. "End the run and commit it now"
closes the level in play and gives every unplayed level an X at tick 0. A hidden tab gets a
warning, in its title and on the page, as browsers throttle the timers of hidden tabs.

Every step is written to IndexedDB first (`src/run/store.ts`), and the level in play, its events
and its tick count, every second, at its start and at its end. When the wallet connects, the
page resumes the oldest run of the account that it holds and has not committed: it reads the
chain for a reveal or a commit whose receipt the reload lost, closes the interrupted level as
README §7.2 specifies, by replaying the stored events through tick c − 1 and appending an X
alone at tick c unless the level ended by then, and resumes at the next level. After the commit
the page shows the six Outcomes, as the core replays them with the season's weights, and offers
the run file of `docs/VERIFICATION.md`.

The page plays on Arbitrum Sepolia, or on the network `?network=<name>` names: `local` is the
anvil chain of `scripts/contracts/localnet.mjs --up`, on port 8545, where nothing advances
MockArbSys's block number: advance it past the run's entropy block with `cast send <ArbSys>
"setBlockNumber(uint256)" <n> --unlocked --from <account 0>`. It reads the newest
generation of `deployments/<network>.json` (deployments/README.md), as the repository held it
when the site was built; without that record it says so and does not connect.

Training, the replay viewer and the level editor stay wallet-free (README §8.1): a test follows
their imports and fails if they reach `src/chain/` or ethers.

## Chain

`src/chain/` is the web app's link to the contracts. Its typed bindings, `src/chain/bindings/`,
are generated from the ABIs of `contracts/abi/` (plan M4.3), and CI checks them for drift:

```bash
node web/scripts/bindings.mjs        # after scripts/contracts/abi.sh changed contracts/abi/
```

`web/scripts/chain-smoke.mjs` runs the module on a local chain: it loads `src/chain/` through
Vite, connects a wallet backed by one of the node's unlocked accounts, finds the season accepting
runs, and calls `startRun` for it with its number and fee:

```bash
node scripts/contracts/localnet.mjs --up
node web/scripts/chain-smoke.mjs --rpc http://127.0.0.1:8545
```

`web/scripts/challenge-e2e.mjs` runs a Challenge run end to end on a local chain (plan M5.2), on a
fake clock that the wallet stamps on each transaction, with the inputs of `jiro-tools playtest`'s
bots fed as keys, and reloads that rebuild the page's objects on the same store. It checks that
the commitment is the core's `run_commitment` of the stored journals, that the commit's calldata
carries them, that each journal is its bot's or the closed one of README §7.2, that the run file
reproduces the six Outcomes, and that `settleRun`, against MockReferee set to them, finds the run
on time. `--stale-season` lets the season end and the next open before `startRun`, which reverts:

```bash
cargo build -p jiro-tools --locked                    # the bots, target/debug/jiro-tools (--tools)
node scripts/contracts/localnet.mjs --up
node web/scripts/challenge-e2e.mjs --rpc http://127.0.0.1:8545
node web/scripts/challenge-e2e.mjs --rpc http://127.0.0.1:8545 --reload-at 3
node web/scripts/challenge-e2e.mjs --rpc http://127.0.0.1:8545 --reload-after-end out-of-lives
node web/scripts/challenge-e2e.mjs --rpc http://127.0.0.1:8545 --reload-after-end cleared
node web/scripts/challenge-e2e.mjs --rpc http://127.0.0.1:8545 --stale-season   # last: it opens a season
```

## Controls

The defaults are the arrow keys for the joystick, and the keys A, B and X for the device keys of
the same names: A cuts fast, B slows the player behind the shield, X banks the level (README §2).
The Controls panel rebinds each control to any key and refuses a key already bound to another
control. Bindings are stored in the browser's localStorage when it is available. The journal
records controls, not keys, so a binding never changes a game's outcome (D8).

Each tick samples the controls once (README §6.1). A key pressed and released between two
samples still counts in the next one, so a quick tap of X is never lost.

## Layout

| File | Role |
|---|---|
| `src/core.ts` | Typed loader of the `jiro-wasm` exports |
| `src/loop.ts` | The 15 Hz tick clock: tick k is due at t0 + k × 1000 / 15 ms; late ticks run as soon as possible, none is skipped or run twice |
| `src/input.ts` | Controls, bindings and the held keys |
| `src/storage.ts` | Values kept in localStorage as JSON, with a fallback when storage is missing or refuses |
| `src/session.ts` | One level in play, in Training or Challenge mode: core, clock and keys on the single input path |
| `src/shipped.ts` | The 16 shipped levels, `levels/*.bin`, by name in index order |
| `src/render.ts` | The 240 × 240 field at an integer scale, redrawing only the changed cells |
| `src/pages/training.ts` | The game page, Training: level picker, HUD, end screen, score and local bests, journal download, bindings panel |
| `src/pages/replay.ts` | The replay viewer: the view of a replayed journal, the trace comparison and the page |
| `src/pages/editor.ts` | The level editor: painting, fields, live validation, import, export and Play |
| `src/level.ts` | The editor's model of a level, its cells and fields, which the core encodes and decodes |
| `src/page.ts` | What the pages share: elements by id, loading the engine, the field's size, the HUD, error messages, claims in percent |
| `src/journal.ts` | The events of a journal the core has accepted |
| `src/pages/challenge.ts` | The Challenge page: wallet, network switch, balance and faucet link, season view, the run with its field, countdown and Outcomes, run file, footer |
| `src/run/season.ts` | The season check before `startRun`, and the season view's entries |
| `src/run/flow.ts` | A run from `startRun` to `commitRun`, resumable from the run store |
| `src/run/play.ts` | The six levels back to back, written to the store every second, closing a level by README §7.2, and the countdown's margin |
| `src/run/deadline.ts` | The commit deadline, with the contract's formula |
| `src/run/store.ts` | The runs in IndexedDB |
| `src/run/runfile.ts` | The run file v1 of `docs/VERIFICATION.md`: writing, reading and replaying it |
| `src/chain/networks.ts` | The networks the app plays on, with what a wallet needs to add them, and the page's network |
| `src/chain/deployments.ts` | The newest generation of a deployment record, and the records the site was built with |
| `src/chain/wallet.ts` | The injected wallet: connecting, the network check and switch, the signer, ETH amounts |
| `src/chain/contracts.ts` | The contracts through the bindings: the season accepting runs, `startRun`, the entropy block's state, `revealRun`, `commitRun`, decoded errors |
| `src/chain/footer.ts` | The footer's contract addresses and build sha |
| `src/chain/bindings/` | Generated by `scripts/bindings.mjs` from `contracts/abi/`: never edit by hand |
| `src/errors.ts` | The core's error codes by name, with their meaning |
| `test/*.test.ts` | vitest: the clock, the bindings, play, Training, replay and the level editor through the wasm build, the error names, the chain module on a mock EIP-1193 wallet, and the wallet-free pages' imports; the draw and run commitment, the deadline fixtures, the season check, the run's levels with reloads, the run store and the run file |
| `test/challenge.ts` | Plays a revealed run's levels without a chain, on a fake clock, with scripted keys and reloads |
| `test/drive.ts` | Plays a level through the page's session on a fake clock, with the controls of a journal or a script |
| `test/vectors.mjs` | The wasm parity runner of M1.11 (plain Node) |
| `scripts/bindings.mjs` | Generates `src/chain/bindings/` from `contracts/abi/` |
| `scripts/chain-smoke.mjs` | `startRun` through `src/chain/` on a local chain |
| `scripts/challenge-e2e.mjs` | A Challenge run from purchase to commit through `src/run/` on a local chain, with reloads |
