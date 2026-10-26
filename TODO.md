# TODO

Deferred work. Each item keeps the analysis done so far, so it can be picked up without redoing it.

## Superchallenge mode

Deferred on 2026-10-26, after the specification review in [detychey/jiro-ikusu#1](https://github.com/detychey/jiro-ikusu/pull/1). It is not scheduled. It needs its own design pass and a legal read before any work starts.

### The draft's design

- A player generates a map, by hand or at random, and mints it for $1.
- Each run on the map costs $0.01.
- Once the map has been completed once, the minter claims half of its leftover value.
- Any player can then pay $0.01 per run to beat the minter's score, and win half of the accumulated value.

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
| Mint | $1 buys a map NFT (ethblockdigger's `MapNFT`). The layout is either random, from a pay-then-reveal seed, or hand-made and passing the validity check. |
| Opening | The map opens to challengers after its first verified clear, normally the minter's. That run sets the opening record. |
| Runs | $0.01 each. Every run gets its own post-payment seed for the spawns, so a journal prepared for one run is useless in another, and the minter's only edge is knowing the layout. That seed needs a start transaction per run, so prepaying runs in batches would save token transfers but not transactions. Problem 5 stays open: price runs higher, or accept gas comparable to the fee. |
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
