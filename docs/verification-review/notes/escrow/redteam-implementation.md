# Red team: implementation and repository rules (ProofBounty spec, 2026-11-10)

Read-only on the repository. Tags: [repo] recorded in the repository, [me] measured or checked by me, [spec] from the spec without a re-check, [est] estimate.

## What I checked against the code

- `Challenge.settleRun` (contracts/src/Challenge.sol:148) has no caller check, and `runs` and `settlements` are public getters, so a contract can settle and then read the status. [me]
- `ZkReferee` with one more word: `(ScoredOutcome[6], address)` and `(ScoredOutcome, address)` are static, so the encoding is a plain concatenation; the prototype diff is correct. [me, by reading; prototype tests pass]
- Branch B (a run already settled): `Challenge.checkOutcome` is private, but every field it checks except the weight comes from the journal header or the image: replay.rs:43-79 takes journalHash, levelId, runNonce, levelIndex, drawSlot (from the nonce) and mode from the journal, and rulesVersion from the core. `Season.open` requires `referee.rulesVersion() == params.rulesVersion` (Season.sol:135-138), and `Season.weightOf` reverts through `slotOf` (Season.sol:255-263) exactly as `levelInSeason` does. So the escrow has no second copy of `checkOutcome`: it reuses `RunDerivations.runCommitment` and `Season.weightOf`. Sound. [me]
- Re-run: `forge test --match-contract "ProofBountyGas|ProofBountyTest"` in the prototype gives 70 passed, 0 failed. [me]
- Fixture use: `ZkReferee.t.sol` reads only `.challengeRun` (RUN, :23) and `.level` (:188, :197-203). `.run` and `.worstCase` are read only by `ZkVerify.t.sol`, which verifies each seal under **that fixture's own `imageId`** with the bare Groth16 verifier (:91-95). [me]
- Re-proving times [repo, docs/VERIFICATION.md:699-701, :988]: run 3,297 s, worstCase 13,177 s, challengeRun 7,638 s (4 CPUs), level 2,128 s (2-vCPU runner, 2^19). The level would take about 1,000 s on 4 CPUs [est: 2 segments of 2^20 × 400 s, plus about 110 s of recursion and 170 s of Groth16]. All four: about 25,000 s, or 7 h. Only the two that ZkReferee.t.sol needs: about 8,700 s, or 2.4 h. GPU: nothing measured anywhere; at the lead's RTX 4090 rate, minutes [lead/est].
- The CPU path's Groth16 step runs in Docker (prove.rs header; zk-prove.yml pulls `risczero/risc0-groth16-prover`). The claim that the `cuda` feature removes Docker was not checked [lead].
- Image id: the repository is built at the fixed path `/home/runner/work/jiro-ikusu/jiro-ikusu` (docs/VERIFICATION.md:679). The owner's GPU machine must use that path, the same `r0.1.97.0` toolchain and Linux (RISC Zero's CUDA prover targets Linux; the owner's OS is unknown).
- `Season.open` takes the referee per season (Season.sol:9-10, :129-157). A new `ZkReferee` does not need a new `Season` or `Challenge` in code. The need for a new generation comes from project policy: docs/DEPLOYMENT.md:195 and the deployments schema, which has exactly one `Referee` key per generation.
- testnet-0 opened about 2026-11-09 12:15 UTC, with a length of 1 day and a grace of 1 day (seasons/testnet-0.json), so its settlement ends about 2026-11-11 12:15 UTC. No old-format proof is needed after M5.8 merges. Run 2 of testnet-0 is committed and unsettled.
- `jiro_core::keccak::keccak256` is public (core/src/lib.rs:24, core/src/keccak.rs). The host can check an EIP-55 checksum by adding `jiro-core` as a host dependency. The guest's image id does not change, because the guest is its own workspace (referee/zk/Cargo.toml `exclude = ["guest"]`).
- Normative text: README.md:645 says the public values *are* `abi.encode(uint16 weightBp, Outcome)` per level. That sentence must change in the same PR as ZkReferee, by CLAUDE.md's `contracts/src/**` row and because the README wins.
- Threat table (docs/ECONOMY.md:52) cites `ZkReferee.t.sol: test_VerifyRun_RevertsOnTamperedPublicValues` and `ZkVerify.t.sol: test_aLevelProofOfAnotherScoreReverts` as evidence against a forged score. Both flip the **last byte**, which becomes the payee's last byte. Both tests still pass, but neither tests a score any more.
- e2e.mjs:707-719 `realProof` reuses `<run file>.proof.json` without checking its image id or layout, and calls `zk-host prove` without `--payee`.
- Sizes (plan §1.1: M is at most 1,000 changed lines, L at most 2,000): the prototype's ProofBounty.sol has 152 lines, ProofBounty.t.sol 726, ProofBountyGas.t.sol 213, ProofBountyInvariant.t.sol 267. That is 1,358 lines of Solidity before deploy.mjs, localnet.mjs, the deployments schema, the e2e cases and the README §7.5 and ECONOMY rows. The spec sizes M5.9 as M.
- Plan: M5.4 is deferred, and the next free id is M5.8, as the spec says. The spec makes M5.5 depend on M5.12, which needs a GPU, keys and a new generation, so M5.6 (testnet season 1, M5's done-when) waits for the owner's hardware.
- CI: adding the `cuda` feature changes referee/zk/Cargo.lock. ci.yml's zk-exec job uses rust-cache with a shared key, so the next build is clean: 62 min 35 s on a 2-vCPU runner [repo], while this month's Actions minutes were at about 1,460 of 1,500 [repo].
- Unrelated: GUIDELINES.md was deleted (commit 244cc5f), but CLAUDE.md imports it and plan §1.1 cites it.

## Gas per call (prototype, mock verifier behind the real emergency stop; [spec], tests re-run by me)

| Call | Mock | Real [est, +223,800 for verification] |
|---|---:|---:|
| post, first / top-up / second depositor | 97,436 / 63,236 / 80,336 | same |
| claim, unsettled run, typical / gate-set / full journals | 364,880 / 707,956 / 1,174,601 | ~588,700 / ~931,800 / ~1,398,400 |
| claim, settled run, typical | 230,323 | ~454,100 |
| refund | 67,481 | same |
| withdraw | 37,949 | same |
| escrow overhead over a direct settleRun | 52,354 to 67,190 | same |

## Audit surface

- New code holding ETH: ProofBounty, 152 lines and 5,805 bytes of runtime.
- ZkReferee: about 25 changed lines.
- Guest: about 15 lines, under a new image id.
- Host: about 80 lines.
- slither: 11 new results, none a reentrancy result [spec].
- The contract's logic is small. The expensive part is the proving pipeline around it, which is unmeasured on the named GPUs.

## Simplest safe subset and split

1. **M5.8 Payee in the public values** (M): guest, ZkReferee.payeeOf, host `--payee` with an EIP-55 check through `jiro_core::keccak`, the two score-tamper tests moved to byte `len-33`, and new payee tests. Re-prove **only `challengeRun` and `level`**: about 2.4 h on 4 CPUs, or minutes on a GPU. Keep `run` and `worstCase` as records of image `0xa3013dc4`, and have ZkVerify append a payee word only when a fixture has a `payee` key. Same PR: README §7.3 (line 645), referee/zk/README, docs/VERIFICATION.md lengths, the ABI and bindings, the ECONOMY test names.
2. **M5.9 ProofBounty contract** (L): the contract, unit, invariant and gas tests, README §7.5 and §8.4, the ECONOMY threat rows, the ABI. Stack it on M5.8 and merge the two together, so that the image-id churn lands only if the escrow is approved.
3. **M5.13 ProofBounty tooling** (M): deploy.mjs, localnet, the optional deployments key, the e2e bounty cases, the bindings, and the `realProof` cache check of image id and payee.
4. **M5.10 GPU prover** (M): measure on the RTX 3060 first with zk-run.json; then the cuda feature, run-file `execute-run`, the bounty loop, docs/PROVER.md.
5. **M5.11 dApp bounties** (M).
6. **M5.12 Sepolia deployment** (S).
7. **M5.5 without a dependency on M5.12**: testnet-1 must not wait for the GPU.
