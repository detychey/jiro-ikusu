# Red team: ordering, theft and economics of ProofBounty

Labels: [repo] = recorded in the repository; [here] = measured or run in this review; [spec] = the spec's own measurement; [est] = estimate.

Read: spec.md, proto ProofBounty.sol, ZkReferee.diff, contracts/src/Challenge.sol, Season.sol, ZkReferee.sol, core/src/replay.rs, referee/zk/guest/src/{lib.rs,bin/verify.rs}, referee/zk/host/src/{lib.rs,prove.rs}, web/src/chain/calldata.ts, seasons/testnet-0.json, docs/ECONOMY.md §1-3, docs/DEPLOYMENT.md (EIP-7623 note).

New test [here]: proto/contracts/test/RedTeamOrdering.t.sol, 2 tests, both pass (forge 1.8.6):
- test_ForeignJournalsBaitIsPostableButNeverClaimable: run Y commits run X's journals; post on Y succeeds; X's real proof cannot claim Y before or after X settles (Challenge.OutcomeRunNonceMismatch, branch A); the deposit returns only after the settlement end.
- test_SelfClaimBaitLeavesTheHonestProverNothing: the poster claims its own bounty with its own proof; the honest prover's claim reverts with NoBounty.

## Theft: nothing found

- Payee authenticity, branch A: payeeOf and ZkReferee.verifiedPublicValues run the same abi.decode(proof,(bytes,bytes)) on the same calldata, so non-canonical offsets give both the same publicValues; sha256 covers the payee word. The season's referee is fixed in Season.open (paramsBySeason is written once), so "bountyOf > 0 implies pinned referee" holds for the life of the run.
- Branch B: commitment + Season.weightOf + pinned verifyRun. checkOutcome is not re-run, but the only way to be Settled/Late is to have passed it with the same deterministic Outcomes. A run that committed another run's journals can never be Settled, so it can never reach branch B (test above).
- Dirty payee word: abi.decode to address reverts in payeeOf and in verifyRun alike. Old-format proofs (2,304 B) are refused by length.
- Proofs copied from a pending, included or reverted claim: payee bound. A direct settleRun with that copy sends the prover's next claim to branch B. A re-randomized seal gives the same payee and the same run id, so one payout.
- Double spend: a payout implies a settled run (branch A settled it; branch B needs it), so post can never revive bountyOf, and stale depositOf is unreachable. Refunds and the claim split the deposits exactly.
- Refund/claim overlap on an unsettled run: refund needs ts > settlementEnd, settleRun needs ts <= settlementEnd. They are disjoint.
- Sequencer, relay, RPC provider, Timeboost express lane: can reorder, delay or drop, never redirect. Ordering power only decides which of two independent provers wins. I did not verify the lead's priority-fee claim (c), and nothing here depends on it.
- Smart-account players: web/src/chain/calldata.ts already finds commitRun inside wallet calls and traces.
- EIP-7623 floor on large claims: docs/DEPLOYMENT.md:155 records that ArbOS does not charge it [repo], so the gas formula stands.

## Economic and liveness attacks

### 1. Buying out the one GPU near the settlement end (medium-high)
- One home GPU and a FIFO "take if profitable" rule (spec §5 step 5). Its time check is per run (`settlementEnd - now >= 2*proving + 600`) and ignores the queue.
- Attacker runs legal journals of about 2.9e9 cycles [lead]: about 2,766 segments. At the lead's 4060 Ti class rate of 8-15 min per 1e8 cycles, that is 3.9 to 7.3 h per run [est]. The RTX 3060 is unmeasured and likely no faster.
- testnet-0 grace is 86,400 s [repo], so 4 to 6 such runs fill it.
- Cost per run [est]: fee 0.00005 ETH, a full commit of about 864k gas (about 0.000017 ETH), and a bounty priced at the prover's own cost. That comes to about 0.0002 to 0.0003 ETH, or about $0.5 at $2,092.
- Total: about $2-3 keeps the only prover busy. Rivals' late bounties go untaken and refund, and the attacker's pro-rata share of the pot grows.
- The spec does not stop it. W2 names liveness, not this attack.
- Fix: earliest-deadline or value-per-GPU-second scheduling with a queue-aware deadline check; a per-run cycle cap near the end of grace; prove cheap human runs speculatively on RunCommitted.

### 2. Bait bounty with self-claim (medium)
- The poster (or a partner) proves its own run beforehand, posts a large bounty to lure provers, and claims it back first.
- Cost to the attacker: claim gas, about 0.000013 ETH for human runs and up to 0.00004 for full journals, plus post gas of 0.000002. The bounty comes back.
- Loss to the victim: proving time, up to 3.9-7.3 h per heavy run on the owner's card [est]. This combines with issue 1 and costs the attacker even less there.
- B13 accepts the loser's work as a residual. Point 8, a lock with a stake, is the real fix.
- Cheap fix now: during proving, poll bountyOf/BountyPaid and kill zk-host when the bounty is paid. Discount bounties from posters whose past bounties were claimed by a payee linked to them or within one block.

### 3. Slower card vs speculative fast prover (medium, economics)
- A 5090 that proves every RunCommitted [est: about 16 s per human run, about 41 min per 2.9e9-cycle run] claims within one block of BountyPosted.
- The owner's 3060, which starts on BountyPosted, then wins nothing.
- Per lost race the loser pays:
  - Human runs: about 1-3 min of GPU, under $0.01 [est].
  - Heavy runs: hours of GPU.
  - Gas: none if step 7's eth_call runs first; otherwise one NoBounty revert, about 30k L2 gas plus the L1 fee of 7.5-55 KB, at most about 0.000002-0.000013 ETH [est from spec prices].
- The spec accepts this (W5).

### 4. Branch B pays for useless proofs (medium, W6)
- A run settled outside the escrow (a player settling directly, settleLevel x6, a zero-payee proof) keeps its bounty. Any third-party GPU then earns it by re-proving, with no settlement deadline risk and from settlement until settlementEnd + 7 d.
- "The owner's prover leaves those" binds only the owner.
- The player loses the full bounty, for example 0.00002 ETH, 40% of the fee, for nothing.
- The spec only partly stops it: it is the price of protecting provers from copiers.
- Possible narrowing: pay branch B only to the payee of a proof whose seal digest the escrow saw... that is defeated by re-randomization. Better to keep it, and make the dApp refuse to settle a funded run except through claim.

### 5. Pre-check gap: replay-valid but settlement-invalid journals (low)
- A run that commits foreign journals (another run's, a Training-mode journal, swapped level order, a wrong rules version): replay accepts them, so a proof exists, but checkOutcome rejects them forever. post accepts them (test above).
- prove.rs already calls check_levels with RUN_FIELDS (runNonce, levelIndex, drawSlot, mode, rulesVersion) before proving. Spec step 4 states only "if replay rejects".
- Fix: execute-run must apply check_levels with RUN_FIELDS against a run file built from chain data (runNonce from Challenge.runs, draw computed locally), and the season file must equal Season.paramsOf.
- Otherwise a prover proves for nothing, though step 7's eth_call still saves it the gas.

### 6. Player pays for a settlement that earns nothing (low-medium)
- The spec warns only about Late runs. A bounty is equally wasted on:
  - a run with clears < minClears (unqualified);
  - a run that does not rank above the player's current best (Season.ranksAbove);
  - a run later displaced by a better settled run.
- dApp fix: compute qualification and compare with bestRunOf before posting.
- Break-even [est, testnet-0, rake 10%, one run per player]: payout is about 0.000045 ETH × score/mean score. A 0.00002 ETH bounty plus 0.000002 post gas pays off only above about 49% of the mean score. Below that, settling loses money (W1).

### 7. Dust and spam (low)
- 1 wei posts cost the attacker about 97k gas (0.000002 ETH) each and lock nothing of anyone else's.
- Fix: the prover should check the gas floor (575k + 17 × bytes, known from calldata) before running the executor. Then forcing an executor run on 2.9e9 cycles costs the attacker at least the claim-gas floor plus the 0.00005 run fee.

### 8. Unpriced bounties (low)
- No price exists onchain. A player whose under-priced bounty sits untaken cannot tell price from liveness until the refund date, and then loses the payout.
- Fix: publish the prover's formula, and have the dApp flag "untaken after N minutes".

### 9. Deadline censorship (low)
- A claim sent shortly before settlementEnd can be delayed by the sequencer. The fallback, forced inclusion through the delayed inbox, takes about 24 h. The run then refunds and the prover loses its work.
- The 2 × proving + 600 s rule does not cover this.
- It needs a misbehaving sequencer, so accept it.

## Tried and could not break
See the list above, plus:
- Withdrawing or shrinking a bounty during proving: no path before refund dates; post only adds.
- Top-ups by strangers: they only add.
- Another season or other weights: the run nonce and season weights bind them.
- Two escrows over one referee: each pays the same payee.
- Reentrancy through withdraw, refund or Season: none found.
