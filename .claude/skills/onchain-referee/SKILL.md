---
name: onchain-referee
description: Use when designing or writing smart contracts for Jiro-ikusu — run purchase, entropy, journal commit and settlement, seasons — or the onchain verifier that runs the game core on journals (Stylus referee or zkVM proof verifier). Pair with the ethskills `ship` skill for current Ethereum facts.
---

# Onchain referee and contracts

## Architecture

- **Money lives in Solidity.** Reuse ethblockdigger's patterns (README §10): pay-then-reveal entropy, commit-then-settle (with Jiro's duration-based deadline), keyless settlement, the solvency invariant, `Season`.
- **Verification runs the one core,** never a second implementation of the rules in Solidity (D1). The core either runs as a Stylus contract that replays the journal, or as a zkVM guest whose proof is verified onchain (README §7.3, D2).
- **One verifier interface,** `IReferee` (README §7.3), whatever the backend: `verifyRun` for a whole run, `verify` for one level, and `rulesVersion`. The referee returns the decoded header fields and the draw slot in each Outcome, so the contracts never parse journal bytes or compute the draw.

## Cost: measure, don't assume

- **Gate: 1M gas per level on Stylus.** ethblockdigger's Stylus referee measured 0.84M–3.25M gas per full replay of its heavier game (its `docs/DEPLOYMENT.md` B2). Measure Jiro's on a local Arbitrum node while activations on the public chains are paused.
- **zk fallback, the testnet backend (D2).** About 228k gas to verify one Groth16 run proof (M4.8); testnet seasons verify each run's proof on its own, without aggregation (README §7.3). Use the zkVM chosen in M1, where the agent's tooling decides first and cost second (README §7.3). Measure cycles per level and the proving cost before relying on it.
- **Verify by exception.** Only runs that money depends on get verified; every other run costs one commit transaction.
- **Settle levels separately if a run doesn't fit one transaction.** The run commitment (README §6.4) lets each level settle on its own.

## Security

- **Never accept a seed or a score from the client.** The seed comes from pay-then-reveal; the score comes from the referee.
- **Bind every journal to its run.** Each Outcome's `runNonce`, `journalHash` and `levelIndex` must match the run being settled, so copying someone else's winning journal fails. Its `levelId` must be the season's level in its `drawSlot`, its `mode` 1, and its `rulesVersion` the season's (README §7.2).
- **Enforce the commit deadline at settlement:** reveal time, plus the journals' ticks used at 15 Hz, plus the slack (README §7.2). Never use a fixed window; it leaves the unused time of early-ending levels free for retries and practice.
- **Decode strictly** (README §6.3) and reject anything malformed.
- **Native ETH (D12).** Require `msg.value` to equal the season's fee exactly. Pay out by pull (claims and withdrawals), never by push, and follow checks-effects-interactions in every function that sends ETH.
- **Make periodic actions permissionless.** Season close must be callable by anyone, with a reason to call it.
- **No private keys** in the settlement path.
- **Never use `block.prevrandao` on Arbitrum,** where it is a constant.

## Done when

- Unit tests pass, and invariant tests check solvency after every operation.
- A run goes through pay, reveal, commit and settle end to end on Arbitrum Sepolia.
- The PR records the measured verification costs.
