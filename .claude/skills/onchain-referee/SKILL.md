---
name: onchain-referee
description: Use when designing or writing smart contracts for Jiro Ikusu — run purchase, entropy, journal commit and settlement, seasons, map NFTs — or the onchain referee that replays journals (Stylus, zkVM verifier or EVM). Pair with the ethskills `ship` skill for current Ethereum facts.
---

# Onchain referee and contracts

## Architecture

- **Money lives in Solidity.** Reuse ethblockdigger's patterns (README §10): pay-then-reveal entropy, commit-then-settle (with Jiro's duration-based deadline), keyless settlement, the solvency invariant, `Season`.
- **Compute lives in the referee,** which replays journals through the core. The backend is decision D2 (README §7.3). Prefer reusing the core, as a Stylus contract or a zkVM guest, over writing the rules a second time in Solidity.

## Gas: measure, don't assume

- **No 1M-gas full replay on the EVM.** The estimate is 5–20M gas per 3-minute level. For comparison, ethblockdigger's synthetic Solidity tick (`contracts/src/spike/ReplayTickSpike.sol`) cost 11.6k–54.6k gas. Before choosing a backend, build a spike and measure it, as ethblockdigger did with `scripts/contracts/gasSpike.ts`.
- **Settle levels separately when needed,** one level per transaction. The run commitment (README §6.4) lets each level settle on its own.
- **If an EVM referee is chosen:**
  - keep all replay state in memory, with no storage writes in the replay loop;
  - use bitboards (60-bit rows in 64-bit lanes) for the grid and the fill;
  - parse the journal with `calldataload` and shifts.

## Security

- **Never accept a seed or a score from the client.** The seed comes from pay-then-reveal; the score comes from the referee.
- **Bind every journal to its run.** The journal header's `runNonce` and `levelId` must match the stored run, so copying someone else's winning journal fails. Its `rulesVersion` must match the season's.
- **Enforce the commit deadline at settlement:** reveal time, plus the journals' ticks used at 15 Hz, plus the slack (README §7.2). Never use a fixed window; it leaves the unused time of early-ending levels free for retries and practice.
- **Decode strictly** (README §6.3) and reject anything malformed.
- **USDC has 6 decimals.** Use `SafeERC20`.
- **Make periodic actions permissionless.** Season close and map expiry must be callable by anyone, with a reason to call them.
- **No private keys** in the settlement path.
- **Never use `block.prevrandao` on Arbitrum,** where it is a constant.

## Done when

- Unit tests pass, and invariant tests check solvency after every operation.
- A run goes through pay, reveal, commit and settle end to end on Arbitrum Sepolia.
- The PR records the measured gas numbers.
