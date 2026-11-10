# TODO

Deferred work. Each item keeps the analysis done so far, so it can be picked up without redoing it.

## Superchallenge mode

Deferred on 2026-10-26, after the specification review in [detychey/jiro-ikusu#1](https://github.com/detychey/jiro-ikusu/pull/1). It is not scheduled. It needs its own design pass and a legal read before any work starts.

### The draft's design

- A player generates a map, by hand or at random, and mints it for $1.
- Each run on the map costs $0.01.
- Once the map has been completed once, the minter claims half of its leftover value.
- Any player can then pay $0.01 per run to beat the minter's score, and win half of the accumulated value.

The project's currency is native ETH ([README §13](README.md#13-open-decisions), D12). On 2026-10-28 the owner suggested 0.0005 ETH per map and 0.000005 ETH per play on a map for this mode, the draft's 100:1 ratio of $1 to $0.01; the proposal below uses them.

### Problems

1. **The minter can always play their own map.** Wallets are free, so "beat the minter" cannot exclude the minter. The minter also knows the layout before minting, so they can practice or search it offline. They can then mint, set a strong score, let challengers fill the pot, and take the pot with a better run from a second wallet. The draft's design turns maps into honeypots.
2. **The minter profits from failure.** The pot grows when challengers fail, so the incentive is to design unfair maps rather than fun ones.
3. **"Half the accumulated value" is ambiguous.** Both readings break:
   - If the target stays the minter's score, each player who beats it takes half of what remains, and the pot drains geometrically.
   - If the target becomes the new record, a winner can take another half by beating their own record from a second wallet.
4. **Journals are public.** Unless a journal is bound to a run nonce and its player, anyone can copy a winning journal from the mempool and submit it first. ethblockdigger's commit-then-settle flow, with nonce binding, fixes this ([README §7.2](README.md#72-run-flow)).
5. **$0.01 is less than the gas.** A verified run takes several transactions (pay, reveal, commit, settle). On an L2 these cost about as much as the fee, or more.
6. **"Completed once" needs proof.** A hand-made map can be impossible. Completion has to be a verified clear, and maps need validity rules ([README §5](README.md#5-levels)).
7. **Legal exposure.** Per-map pots funded by player fees and paid to a winner, with the minter profiting, look like a banked game of chance in some jurisdictions. This is a sharper version of the regulatory risk in ethblockdigger's `TOKENOMICS.md` §8. Get a legal read before mainnet.

### Proposal: bounty rounds

| | |
|---|---|
| Mint | 0.0005 ETH buys a map NFT (ethblockdigger's `MapNFT`). The layout is either random, from a pay-then-reveal seed, or hand-made and passing the validity check. |
| Opening | The map opens to challengers after its first verified clear, normally the minter's. That run sets the opening record. |
| Runs | 0.000005 ETH each. Every run gets its own post-payment seed for the spawns, so a journal prepared for one run is useless in another, and the minter's only edge is knowing the layout. That seed needs a start transaction per run, and the ETH fee travels in that transaction, so prepaying runs in batches would save nothing. Problem 5 stays open: price runs higher, or accept gas comparable to the fee. |
| Fee split | Illustrative: 70% bounty pot, 20% minter royalty, 10% protocol. The minter earns when the map is played, not when challengers fail. |
| Record | Taking the record requires a minimum improvement, e.g. +1% claim. |
| Payout | The map runs in rounds of, e.g., 7 days. A round is extended if the record changes in its last hour, so a record can't be sniped at the bell. The record holder at the end of the round takes that round's pot. Beating your own record from a second wallet earns nothing extra. |
| Dormancy | After N days without runs, the pot goes to the record holder and the map closes. |

**Simpler fallback:** no per-map pots at all. Superchallenge fees feed the season pot, each map gets its own leaderboard, and minters earn royalties.

### What it needs from the rest of the project

- **Level format and validity check:** already shared with the 16 built-in levels ([README §5](README.md#5-levels)).
- **A map generator.** It turns a seed into level bytes: it draws obstacle shapes from the seed, then runs the validity check. If the check fails, the next attempt uses the next derived seed, so generation stays deterministic. The browser level editor already produces the same bytes for hand-made maps.
- **Map NFT and onchain rendering:** ethblockdigger's `MapNFT` and its Stylus map renderer ([README §10](README.md#10-reuse-from-ethblockdigger)). The renderer is subject to the same activation pause as the referee.
- **Journal mode:** the journal's `mode` value 2 is reserved for Superchallenge ([README §6.3](README.md#63-journal-bytes-v1)).

## Proving service

Planned on 2026-10-28 for a version after v1, and not scheduled. A third-party service takes a player's run through an API, proves it and settles it for the player. Its design is in [README §7.5](README.md#75-later-version-proving-service).

## Slow cuts

Deferred on 2026-11-10 by the owner, to a later stage, and not scheduled.

### The problem

The fast cut (A) costs almost nothing, so most players will hold it on every cut: a level's score depends only on its claim ([README §8.4](README.md#84-season-scoring)). Its only costs are:

- **Control:** both sub-steps of a tick go the same way, so a fast cut turns only on every second cell ([README §4.5](README.md#45-player)).
- **No shield:** with A and B held, B wins.
- **Minions:** a minion that stops on the cell a fast cut skipped still hits (the pass case, [README §4.9](README.md#49-hits-lives-and-respawn)). That is about the same risk per cell as a normal cut.

Against these, a fast cut halves the time its trail is open to the boss. It also saves time against the level's limit and the run's deadline. The reference mix's greedy and search bots hold A on every cut (`tools/src/bots/`).

### Proposal: a slow-cut bonus

In the reference game, Qix, an area closed entirely with Slow Draw scores double ([`docs/genre/CATALOG.md`](docs/genre/CATALOG.md#taito-releases-and-official-ports)). Here, the cells a cut captures without a single fast sub-step would count double in the level score, while the clear target stays on the plain claim.

- **Scoring only.** The bonus folds into `levelScore`, so the Outcome layout, the contracts and their ABI stay as they are. README §4.8 and §8.4 change.
- **Open questions:**
  - The factor: double, as in Qix, or less.
  - How does calibration's median effective claim (README §8.4, P11) count the bonus?

### A smaller alternative: one fast cut per level

A fast-cut charge per level, like the shield's *(D6)*: A takes effect while the charge is unspent, and the charge is spent when a cut that took a fast sub-step closes. It changes movement only, not scoring, so it is the smaller change in play. It costs as much as the bonus to build, though: the fixed cost below.

### What any rule change costs

Both options change the core's behavior, so each pays the same fixed cost ([`CLAUDE.md`](CLAUDE.md), sync table):

- **The rules:** `RULES_VERSION` from 2 to 3 and README §4. Each option adds player state, which the state hash covers, so the state hash goes to v2 ([README §6.4](README.md#64-seeds-and-commitments)) and every vector's trace is regenerated.
- **Bots and levels:** the bots change, which forces a new playtest report and a new check of the clear rates against `levels/targets.json`. Levels that leave their target need retuning.
- **Calibration:** a new calibration file, since `testnet-0` opened with `calibration-1.json`.
- **The zk referee:** a new image id, which means a new contract generation on Arbitrum Sepolia ([`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) §4) and new proof fixtures for the contract tests.
- **The client:** the HUD shows any new charge, and Training's bests restart, since they are kept per rules version.

Each rules version pays this once. The cheapest moment is before a season opens on the new rules, with any other core change in the same version. Testnet-1's journals record every A press, so its report (plan M5.6) can show how testers actually use the fast cut before this is decided.
