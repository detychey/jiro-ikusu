# Native onchain re-execution: Stylus status, Arbitrum limits, pure EVM, other chains

Research date: 2026-11-10 (all onchain readings between 14:22 and 14:47 UTC).
Question: is there a way to re-execute the replay onchain without a prover, now or soon?

Labels: **[P]** primary source (official page, repository file, or an onchain read made in this session), **[M]** measured in this session with the scripts listed in section 8, **[S]** secondary source, **[I]** inference.

Method note. The shared web-search budget ran out part-way through the task. Everything in sections 1 and 2 was already sourced by then. For sections 3 and 4 I fetched primary pages directly by URL (docs, raw repository files, public RPC endpoints, registry APIs) instead of searching, so coverage there is narrower than a search would give. Section 7 lists what I could not source.

## 0. The answer, and the facts that decide it

**No. There is no native re-execution route on Arbitrum One or Arbitrum Sepolia today, and the one that may come back is neither lighter nor cheaper than the zkVM route.**

1. **Stylus activations are still paused on Arbitrum One, Nova and Sepolia** (`ArbWasm.activationGas()` = 2^64 − 1 on all three, read at 2026-11-10 14:25 UTC; ArbOS 61 on all three). [P]
2. **No plan exists to bring Stylus back permissionless.** The only proposal on the table is a *Stylus Activation Contract*: each new program, and each new version of it, needs a "limited audit" by an Arbitrum Security Program auditor, a pass posted on the governance forum, then an offchain activation signature from an Arbitrum Foundation multisig. Offchain Labs wrote on 2026-11-06 that "gated activation is likely the right long-term path, not a stopgap". Arbitrum Sepolia "will follow the same activation process". [P]
3. **Its temperature check passed narrowly on 2026-11-05**: 73.18M ARB for (57.3%), 54.46M against (42.7%), 931 voters. The binding onchain vote has not been submitted (no `ProposalCreated` on the core governor up to block 523,003,563). A constitutional proposal takes at least 34 days from submission to execution, and needs For + Abstain ≥ 151.7M ARB, twice what the temperature check gathered. Earliest possible reopening: mid-December 2026; realistic: Q1 2027; not assured. [P for the numbers, I for the dates]
4. **Even reopened, Stylus re-execution costs 13 to 20 times the run fee.** At today's base fee (0.020024 gwei, the 0.02 gwei floor) and ETH at $2,062.49: 1M gas = $0.0413, 30M gas = $1.24. The measured referee needs 5.1M to 11.6M gas per level, so 33.3M to 50.9M gas per run: $1.38 to $2.10 against a $0.103 fee, and above the 32M per-transaction cap, so a run settles level by level. The zk route costs about $0.071 per verified run. [P + repo measurements]
5. **Pure EVM is worse and breaks the one-implementation rule.** Measured here: the game's flood fill over 3,364 cells plus the capture pass costs 1.59M to 2.20M gas in hand-optimized Yul, 3.87M in careful Solidity and 13.1M in naive Solidity, against about 0.18M gas in Stylus. A level would cost roughly 44M to 139M gas in optimized Yul. No maintained tool compiles a Rust crate to EVM bytecode. [M, I]
6. **Other chains can run the core natively and cheaply, but the way back to Arbitrum is the problem.** Measured here: a run is 199M to 286M wasm instructions. That fits one transaction on NEAR (164 to 236 TGas of a 1,000 TGas limit, about $0.06 to $0.09), on the Internet Computer (limit 40 billion instructions) and on CosmWasm chains. Returning the six Outcomes to Arbitrum One needs an MPC or threshold signature (a trusted signer set), or a light-client bridge, which is a larger dependency than one zkVM verifier contract. [M, P, I]

So for this family the status quo stands: the zkVM proof is the only deployable path whose validity rests on no signer. Stylus remains a possible second backend later, for players who want to settle their own run without a prover and accept paying about $1.4 to $2.1 for it.

## 1. The Stylus activation pause (a)

### 1.1 What happened

| Fact | Source | Label |
|---|---|---|
| The Security Council executed an emergency action "completed at 11:30 EST on 2nd October 2026": a One-Step-Proof guard for BoLD, and "Temporarily pause activation of new Stylus contracts on Arbitrum One & Nova". | https://forum.arbitrum.foundation/t/security-council-emergency-action-2-10-2026/31530 (posted 2026-10-02, edited 2026-10-30) | P |
| Mechanism: "The Security Council called ArbOwner.setWasmActivationGas(2^64 - 1) to raise the Stylus activation gas requirement on Arbitrum One and Nova... This is a configuration change and does not require an ArbOS upgrade." | same | P |
| Arbitrum One: `setWasmActivationGas(18446744073709551615)` at block 511,026,298, 2026-10-02 15:30:55 UTC, tx `0x9eb3a4be3ba777f9fc82250eddc10f8356731cc97c09a70801d30ce33322c652`. | `eth_getLogs` on `ArbOwner` (0x70), https://arb1.arbitrum.io/rpc, read 2026-11-10 | P |
| **Arbitrum Sepolia was paused six minutes later**, although the forum post names only One and Nova: same call at block 315,027,193, 2026-10-02 15:36:44 UTC, tx `0x123ec40e38c2e9c51741c767d06fcbabd92c7d2ac40db242bcaeb193ed20745b`. No later `setWasmActivationGas` call on either chain. | `eth_getLogs`, https://sepolia-rollup.arbitrum.io/rpc, read 2026-11-10 | P |
| Still paused today: `activationGas()` = 18,446,744,073,709,551,615 on Arbitrum One (block 523,002,943, 14:25:46 UTC), Sepolia (block 327,897,095, 14:25:49 UTC) and Nova. All three run ArbOS 61 and Stylus version 3 with `expiryDays` 365; on One and Sepolia I also read `keepaliveDays` 31 and an ink price of 10,000. | `eth_call` on `ArbWasm` (0x71) and `ArbSys` | P |

### 1.2 The official reason

- "AI-assisted tooling has led to an increasing number of sophisticated attacks on hand-crafted WASM programs that do not use the standard Stylus compiler toolchain. These programs are specifically designed to cause unexpected behaviors such as degrading the chain's performance for all other users. To date, no attacks have been discovered that permits theft of user funds." [P, forum 31530]
- "New ArbOS releases have patched several reported bugs and known attacks over the past few months, but out of an abundance of caution, we have decided to temporarily pause new activations... to prevent the deployment of new hand-crafted WASM programs that are not yet patched by the current version of ArbOS." [P, forum 31530]
- The docs notice repeats it: "all Stylus findings from contracts that have been reviewed have only posed a denial-of-service risk to chain liveness". https://docs.arbitrum.io/notices/stylus-activation-pause-notice (undated, fetched 2026-11-10) [P]

### 1.3 What still works

- "Already-active Stylus contracts continue to execute until expiration. This pause does not deactivate them." "The ArbOS 61 upgrade renewed all active contracts on Arbitrum One, so no currently active contract expires before August 20, 2027." [P, forum 31530]
- "Renewal via keepalive stays permissionless and is unaffected by the pause." [P, forum 31530]
- "Reactivating an expired contract, or one that needs to be updated after a Stylus version change, is paused." "No new activations... including new versions of existing applications that require activation." [P, forum 31530]
- Deployment of the bytes stays open; only activation is blocked: "Deployment remains open to anyone, but a deployed Stylus contract cannot be called until it is activated." [P, AIP text]
- Activation is per code hash: "Multiple contracts can share the same activated codehash". https://docs.arbitrum.io/stylus/concepts/activation (undated) [P]. The project's referee was never activated on One or Sepolia, so this does not help it. [I, from `docs/VERIFICATION.md`]

### 1.4 The plan: permissioned activation

Source: "[Constitutional] AIP: Stylus Activation Contract", by Offchain Labs, forum thread created 2026-10-23, https://forum.arbitrum.foundation/t/constitutional-aip-stylus-activation-contract/31605, and the identical Snapshot text (proposal `0xbb3a36f5…a8b6`). All [P].

- "each new Stylus smart contract must pass a limited security audit by an Arbitrum Security Program auditor before it can be activated. Once a passing result is posted on the Arbitrum Forum... the Arbitrum Foundation provides an activation signature".
- The limited audit "confirms, among other things, that the contract was built from its source code with the standard Stylus compiler toolchain and does not contain hand crafted WASM". At a minimum the auditor would "rebuild the program with `cargo stylus` from the submitted commit, confirming the bytecode matches the deployed codehash".
- The contract atomically checks the signature, lowers the activation gas, activates, then restores the restriction.
- "Any new or upgraded code will require a new limited audit and activation signature."
- "Submissions would be processed on a reasonable efforts basis rather than on a fixed schedule." Requests go to an Arbitrum Foundation mailbox; the developer accepts the Foundation's activation terms. The Terms of Use are promised, not yet published (Foundation reply of 2026-10-28).
- Scope: "The proposal applies to Arbitrum One and Arbitrum Nova... **Arbitrum Sepolia is outside the scope of this proposal but will follow the same activation process (limited audit and activation signature).**"
- "It does not require an ArbOS version upgrade."
- "Protocol-level activation controls and the ability to deactivate a Stylus contract are planned for a later ArbOS proposal."
- Stated risks: "Builders would rely on the availability of the security auditors and the Arbitrum Foundation for new activations. Audit or signing delays, refusals, or loss of access to the signer could delay launches and updates."
- Trail of Bits, "Offchain Labs Stylus Permissioned Deployer, Security Assessment (Summary Report)", 2026-11-06: the contract "changes Stylus program activation from a permissionless process to a permissioned one on Arbitrum's first-party chains (One, Nova, and Sepolia)"; it has `deployBySig` and `activateBySig`; "An activation signature commits to a program's code hash and a deadline"; one informational finding. https://docs.arbitrum.io/audit-reports/2026_11_06_trail_of_bits_stylus_permissioned_deployer_summary_report.pdf [P]
- Offchain Labs, 2026-11-06 (post 13 of the thread): "Every issue we've seen needed hand-crafted WASM with patterns the compiler never emits." "Offchain Labs' view is that gated activation is likely the right long-term path, not a stopgap." "We're also exploring ways to make it a more core primitive, such as native Stylus precompiles." [P]
- ArbOS 70 is being prepared for the protocol-level version: commit `4b42e8c` of 2026-11-02 in `OffchainLabs/nitro-precompile-interfaces`, "ArbOwner, ArbWasm: add Stylus activators, deactivators and deactivateCodehash for ArbOS 70", adds `ArbOwner.addWasmActivator`, `addWasmDeactivator`, `ArbWasm.isActivator`, `allActivators`, and `deactivateCodehash(bytes32)` ("Caller must be a chain owner or a wasm deactivator"). https://raw.githubusercontent.com/OffchainLabs/nitro-precompile-interfaces/main/ArbWasm.sol and https://github.com/OffchainLabs/nitro-precompile-interfaces/commits/main/ArbWasm.sol [P]. No ArbOS 70 proposal exists on the forum yet. [P, forum search 2026-11-10]

### 1.5 The temperature check of 2026-10-29 to 2026-11-05

Snapshot, space `arbitrumfoundation.eth`, proposal `0xbb3a36f5149d731c9fd11c150634b9bf90f95e73b8ec85e88cd5541149c6a8b6`, read through `hub.snapshot.org/graphql` on 2026-11-10. [P]

| | |
|---|---|
| Voting window | 2026-10-29 20:45 UTC to 2026-11-05 20:45 UTC, state `closed` |
| For | 73,175,697 ARB (57.33%) |
| Against | 54,460,630 ARB (42.67%) |
| Abstain | 978 ARB |
| Voters | 931 |

It passed, but it is contested. Against-voters' reasons, from the thread [P]:
- "I haven't seen sufficient evidence that it addresses the underlying vulnerabilities or that compiler-generated code cannot trigger similar issues... we should maintain the pause" (delegate, 2026-11-05).
- "keeping activations paused until comprehensive, protocol-native activation and deactivation safeguards can be implemented at the ArbOS layer" (Cornell Blockchain, 2026-11-05).
- "we should just leave it deactivated... i just don't see enough adoption and usage" (delegate, 2026-11-02).

### 1.6 What must still happen, and when

1. Publish the final contract, addresses, governance payload, the Foundation multisig and its signers ("before the on-chain vote"). The Trail of Bits summary is out (2026-11-06). [P]
2. Onchain constitutional vote on the core governor `0xf07DeD9dC292157749B6Fd268E37DF6EA38395B9`. Not submitted as of Arbitrum One block 523,003,563 (2026-11-10 14:29 UTC): the last proposal created there is the L1-pricing one of 2026-10-26. [P]
3. Governor parameters read onchain: `votingDelay` 21,600 L1 blocks (3 days), `votingPeriod` 100,800 (14 days), late-quorum extension 14,400 (2 days), quorum 151.66M ARB. [P]
4. After the vote: 8 days in the L2 timelock, at least one challenge period for the L2-to-L1 message (about 6.4 days), 3 days in the L1 timelock. The constitution says a constitutional AIP "will typically require at least 42 days from the beginning of the temperature check". https://docs.arbitrum.foundation/dao-constitution (undated) [P]
5. Then "operational readiness" of the audit and signing process. [P]

Arithmetic [I]: 3 + 14 + 8 + 6.4 + 3 = 34.4 days at least from submission. A submission this week would execute around 2026-12-15 to 2026-12-20. Allowing for the publication steps still open, the year-end and the set-up of the audit and signing process, **January to February 2027 is the realistic first date for a gated activation on Arbitrum One**.

Quorum risk [P data, I reading]. Recent constitutional votes on the core governor:

| Created | Proposal | For + Abstain | Quorum | Against |
|---|---|---:|---:|---:|
| 2025-12-01 | ArbOS 51 and gas pricing | 263.7M | 218.0M | 0.0M |
| 2026-07-13 | ArbOS 61 | 218.6M | 187.4M | 0.0M |
| 2026-07-27 | Security Council election process | 214.0M | 187.4M | 0.0M |
| 2026-08-17 | PGA and Fast Feed | 176.8M | 160.9M | 0.0M |
| 2026-10-26 | L1-pricing parameters (open until 2026-11-12) | 98.4M so far | 151.8M | 0.0M |

Uncontested proposals clear quorum by 10% to 20%. The Stylus proposal had 54.5M ARB against in its temperature check; "Against" votes do not count toward quorum. If those voters stay against, the For side must find about 152M ARB out of the roughly 120M to 165M that would remain of the turnouts seen since July (177M to 219M). Passing is plausible, not safe.

### 1.7 What this means for the project [I]

- **Testnet is blocked too.** A Stylus referee on Arbitrum Sepolia will need the same audit and signature. The only place the project runs the Stylus backend today is a local nitro-devnode, as M4.2 and M4.16 do.
- **Each rules change is a new audit.** A `RULES_VERSION` bump or any rebuild changes the code hash, so it needs a new limited audit and signature, with no service level.
- **The build pipeline may need to change.** `referee/build-wasm.sh` builds with `cargo build --profile stylus`, runs its own `wasm-opt -Oz` (binaryen 120.0.0) and deploys with `cargo stylus deploy --wasm-file`. The auditor's stated check is a rebuild "with `cargo stylus` from the submitted commit" matching the deployed code hash, so a custom post-processing step is a risk to clear with the auditor first.
- **A new liveness dependency arrives with ArbOS 70**: a chain owner or "wasm deactivator" could deactivate a code hash. That would stop settlement through a Stylus referee, though it could not forge an Outcome.
- **Validity would still not rest on a signer.** The Foundation signature gates deployment, not results. The constraint that is hit is "keep dependencies and operations light".

## 2. Arbitrum One limits and prices today (b)

Onchain reads at Arbitrum One block 523,002,943, 2026-11-10 14:25:46 UTC, https://arb1.arbitrum.io/rpc. ETH at $2,062.49 (Coinbase spot, 14:26 UTC; CoinGecko $2,062.22). All [P] unless marked.

| Item | Value | Source |
|---|---|---|
| ArbOS version | 61 "Elara", activated on Arbitrum One 2026-08-20 17:08 UTC, on Sepolia 2026-06-29 | `ArbSys.arbOSVersion()` = 116 = 55 + 61; https://docs.arbitrum.foundation/network-upgrades |
| Per-transaction gas cap | 32,000,000 L2 execution gas, "not including parent chain gas" | `ArbGasInfo.getMaxTxGasLimit()`; https://docs.arbitrum.io/run-arbitrum-node/arbos-releases/arbos51 (EIP-7825 with 32M instead of 16M) |
| Block gas limit | `MaxBlockGasLimit` 32,000,000; effective 64M, since the last transaction of a block may overshoot by up to the transaction cap | `getMaxBlockGasLimit()`; https://docs.arbitrum.io/how-arbitrum-works/deep-dives/gas-and-fees |
| Other block-closing rule | 95,000 bytes of calldata per block under PGA ordering; 4 to 8 blocks per second | same docs page |
| Minimum base fee | 0.02 gwei (`getMinimumGasPrice()` = 20,000,000 wei), set on 2026-01-08 with ArbOS 51 | onchain; ArbOS 51 and 61 notes |
| Who can move the minimum | Since ArbOS 61, Offchain Labs, through a `BaseFeeManager` contract, "to any value between 0.01 gwei and 0.10 gwei", with no timelock, for two years | https://docs.arbitrum.io/run-arbitrum-node/arbos-releases/arbos61 |
| Base fee now | 0.020024 gwei (0.0202 gwei at 14:46 UTC; 0.020036 gwei on 2026-11-02 per the repo) | block header |
| Base fee algorithm | Multi-window, live: six (target, window) constraints read onchain: 60M gas/s over 9 s, 41M over 52 s, 29M over 329 s, 20M over 2,105 s, 14M over 13,485 s, 10M over 86,400 s | `getGasPricingConstraints()` |
| Multi-dimensional "dynamic pricing" | Not active. Instrumented in ArbOS 51 ("none of the constraints are enabled"), dropped from the ArbOS 61 vote. `getMultiGasPricingConstraints()` returns an empty list; `getMultiGasBaseFee()` returns the same fee for all nine resource kinds. | onchain; ArbOS 51 notes; roundup of 2026-07-29: "Dynamic Pricing is no longer being proposed to be activated as part of this proposal" |
| Calldata gas on L2 | Standard 16 gas per non-zero byte, 4 per zero byte | measured below |
| EIP-7623 calldata floor | **Not charged.** `NodeInterface.gasEstimateComponents` for 10,000 non-zero bytes sent to a code-less address: 183,613 L2 gas, against a floor of 421,000. Same on Sepolia. Docs: EIP-7623 "was intentionally not enabled for Arbitrum chains in ArbOS 40 Callisto". | measured [M]; ArbOS 51 notes |
| L1 data fee | 108,779,744 wei per brotli-compressed byte (5 ArbGas per byte), from an L1 price estimate of 6,798,734 wei per L1 gas; plus about 1.5e-8 ETH per transaction | `getPricesInWei()`, `getL1BaseFeeEstimate()` |
| L1 data fee per kilobyte | 1.09e-7 ETH ($0.00022) per compressed kB. Two samples of 25 recent transactions (14:28 and 14:47 UTC): medians 5.1e-8 and 5.3e-8 ETH ($0.0001) per kB of raw calldata, overall range 1.9e-8 to 1.0e-7 | [M] `native-dl/l1fee_sample_output.txt` (the second sample) |
| Pending change | Constitutional AIP for Ethereum's Glamsterdam: `parentGasFloorPerToken` 10 to 16, `perBatchGasCharge` 210,000 to 480,000; onchain vote ends 2026-11-12; executes only once Glamsterdam is live | https://forum.arbitrum.foundation/t/constitutional-aip-update-arbitrum-one-and-nova-l1-pricing-parameters-for-ethereum-glamsterdam/31555 (2026-10-07) |
| Ethereum L1, for scale | base fee 0.607 gwei, gas limit 60M, block 26,385,184 at 14:43 UTC | https://ethereum-rpc.publicnode.com |

Dollar costs at 0.020024 gwei and $2,062.49 [P arithmetic]:

| Gas | ETH | USD | Against the 0.00005 ETH fee ($0.103) |
|---:|---:|---:|---:|
| 1,000,000 | 0.0000200 | $0.0413 | 0.40× |
| 30,000,000 | 0.000601 | $1.24 | 12× |
| 32,000,000 (the cap) | 0.000641 | $1.32 | 12.8× |
| One level on Stylus, 5,109,935 to 11,599,408 | 0.000102 to 0.000232 | $0.21 to $0.48 | 2.0× to 4.6× |
| One run on Stylus, 33,327,143 to 50,911,304 (median 41.0M) | 0.000667 to 0.00102 | $1.38 to $2.10 ($1.69) | 13× to 20× |
| zk route: 804,194 gas plus 0.0000184 ETH of proving | 0.0000345 | $0.071 | 0.69× |
| Commit calldata, worst case 49,026 bytes | 0.0000157 L2 plus at most 0.0000053 L1 | $0.032 + $0.011 | 0.42× |

The Stylus gas figures are the repo's (`docs/VERIFICATION.md`, "D2: the backend", measured 2026-11-01 on nitro-devnode with `offchainlabs/nitro-node:v3.12.2`).

Sensitivity [I]: the base-fee floor can be set anywhere in 0.01 to 0.10 gwei without a vote. At 0.10 gwei a median Stylus run (41.0M gas) costs $8.46; at 0.01 gwei, $0.85. A gas-heavy referee carries that exposure; the zk route's 0.8M gas does not.

## 3. Pure EVM execution (c)

### 3.1 Measured: this game's capture in the EVM [M]

I ported `Grid::mark_boss_zone` (`core/src/grid.rs`) and the pass of `capture` (`core/src/capture.rs`) to Solidity, for gas measurement only, and ran it in `@ethereumjs/evm` 3.1.1 (Cancun), compiled by solc 0.8.28 with the optimizer at 200 runs. Sources: `native-evm/FillBench.sol`, `native-evm/bench.mjs`; output: `native-dl/evm_bench_output.txt`. The variants agree on the filled and captured counts in all four cases.

| Case | Naive Solidity: signed coordinates, checked arithmetic, 1 byte per cell | Careful Solidity: unchecked arithmetic, index neighbours, bounds-checked arrays | Hand-written Yul: 2 bits per cell, no bounds checks |
|---|---:|---:|---:|
| Fill of all 3,364 interior cells | 12,279,143 gas (3,650 per cell) | 2,974,060 gas (884 per cell) | 1,588,352 gas (472 per cell) |
| Pass over the 3,600 cells, cell by cell | 822,243 gas | 894,775 gas | 607,802 gas |
| Same pass, 128 cells per word (a different algorithm, same result) | | | 6,524 gas |
| **One worst-case capture** | **13,101,386 gas ($0.54)** | **3,868,835 gas ($0.16)** | **2,196,154 gas ($0.091), or 1,594,876 ($0.066) with the word pass** |
| Fill of 232 cells (boss confined), plus pass | 2,074,600 | 1,309,991 | 898,677, or 115,743 with the word pass |

With `viaIR` the fills cost more (582 gas per cell in Yul, 1,005 in careful Solidity); the naive variant is unchanged within 1%.

For comparison, the same capture costs about 183,736 gas in the Stylus referee (repo table: `capture-edge-rectangle` 497,251 minus `commit-at-tick-0` 313,515) and about 0.5 million zkVM cycles. So for this workload the EVM costs **8.7 to 12 times Stylus in optimized Yul, 21 times in careful Solidity and 71 times in naive Solidity**: 3.2 to 4.4 gas per RISC-V cycle in Yul, 7.7 in careful Solidity, 26 in naive Solidity.

### 3.2 Estimate: one tick, one level, one run in the EVM [I, from 3.1 and the repo's cycle counts]

| | Optimized Yul | Careful Solidity | Naive Solidity |
|---|---:|---:|---:|
| Idle tick (about 400 zkVM cycles; 73 gas in Stylus) | about 1,300 to 1,800 gas | about 3,100 gas | about 10,500 gas |
| Tick with a worst-case capture (the measured part) | 1.6M to 2.2M gas | 3.9M gas | 13.1M gas |
| 2,700 idle ticks | 3.5M to 4.8M gas | about 8.4M gas | about 28M gas |
| One level (Stylus 5.1M to 11.6M, scaled by the capture ratio) | about 44M to 139M gas, $1.8 to $5.7 | about 108M to 244M gas, $4.4 to $10 | about 360M to 830M gas |
| One six-level run | about 290M to 610M gas, $12 to $25 | about 0.7 to 1.1 billion gas | 2.4 to 3.6 billion gas |

A level does not fit the 32M cap in any style; in Yul it would need 2 to 5 chained transactions carrying the 948-byte state. Scaling a whole level by the capture ratio assumes captures dominate a heavy level, which the cycle counts support (an idle tick is about 400 cycles, a capture about 500,000). The README's reference point agrees in order of magnitude: another project's synthetic Solidity tick measured 11.6k to 54.6k gas with 10 to 50 enemies (`README.md` §7.3). Word-parallel bit tricks could cut the fill several times further, but only by writing a structurally different second implementation, which is exactly the consensus risk the owner rules out.

### 3.3 RISC-V and MIPS interpreter contracts

These contracts exist to execute **one** instruction of a disputed trace against Merkle proofs, not to run a program.

| Contract | Gas for one instruction step | Source | Label |
|---|---|---|---|
| Optimism Cannon `MIPS.sol` | 120k to 125k for register operations, about 127k for loads, 160k for stores, up to 242k (`lwl`, `lwr`); forge test gas, which includes the test's own overhead | `.gas-snapshot` of `ethereum-optimism/optimism` at tag `v1.1.4`: https://raw.githubusercontent.com/ethereum-optimism/optimism/v1.1.4/packages/contracts-bedrock/.gas-snapshot (2023, **stale**: `MIPS.sol` has since been replaced by `MIPS64.sol`, for which later tags publish no such snapshot) | P |
| Optimism Asterisc `RISCV.sol` (RV64) | 174k to 177k for register operations and branches, 206k to 217k for loads, 350k to 383k for atomics; forge test gas | https://raw.githubusercontent.com/ethereum-optimism/asterisc/master/rvsol/.gas-snapshot (undated; fetched 2026-11-10). README: "highly experimental software"; "Currently, Asterisc only supports the local devnet launched from the Optimism monorepo" | P |
| Cartesi `machine-solidity-step` (`UArchStep.step`) | not published in the README | https://raw.githubusercontent.com/cartesi/machine-solidity-step/main/README.md | P (absence) |

At 1.2e5 to 3.8e5 gas per instruction, bulk execution of 1e8 instructions is out of the question (1e13 gas). An interpreter that keeps registers and memory in EVM memory, without proofs, would cost on the order of 200 gas per instruction (fetch, decode, dispatch, two register reads, one write, program counter) [I, no published figure found]: 2e10 gas per run, about 625 full transactions and $830 at today's price.

The useful reading of this table is different [I]: a single-step RISC-V contract is the only prover-free design that keeps one Rust implementation on a plain EVM, as the one-step proof of an interactive dispute. That is the optimistic, dispute-game family, with bonds, timeouts and a watcher, not re-execution, and it is a large build for a small team. It is noted here because the per-step gas is what that family would pay once per dispute.

### 3.4 Compiling Rust or LLVM IR to EVM bytecode

| Tool | What it is | Status | Label |
|---|---|---|---|
| Slang / `solx` (Nomic Foundation, in the `matter-labs/solx` repository) | "an optimizing Solidity compiler for EVM... lowers it to MLIR, and an LLVM backend with an EVM target produces the bytecode" | "The project is in development and is not ready for production use." Solidity front end only. https://raw.githubusercontent.com/matter-labs/solx/main/README.md (fetched 2026-11-10) | P |
| Zink (`zinkc`) | A Rust-like contract language compiled through rustc and wasm to EVM bytecode | "still under active development, please DO NOT use it in production"; last crate release 0.1.12 on 2025-04-03 (19 months ago, **stale**). https://raw.githubusercontent.com/zink-lang/zink/main/README.md, https://crates.io/api/v1/crates/zinkc | P |
| EVM-LLVM (`etclabscore/evm_llvm`) | An EVM backend for LLVM, "it does not assume language frontends" | "At this moment, this project is based on LLVM 10", an LLVM release of 2020. https://raw.githubusercontent.com/etclabscore/evm_llvm/EVM/README.md | P |
| R55 | Rust contracts compiled to RISC-V, run next to the EVM in a modified execution environment | "experimental"; it is not EVM bytecode and needs a modified execution environment, so it cannot be deployed on Arbitrum One. https://raw.githubusercontent.com/r55-eth/r55/main/README.md | P |

So an LLVM backend that emits EVM bytecode exists and is under development, but only behind a Solidity front end and not production-ready. Nothing maintained takes an arbitrary `no_std` Rust crate to EVM bytecode. [I from the four pages; a broader search was not possible]

## 4. Other chains where the Rust core could run natively (d)

### 4.1 How big the job is, in wasm instructions [M]

I ran the committed browser build of the core (`target/wasm32-unknown-unknown/release/jiro_wasm.wasm`, release profile) under wasmtime 50.0.1 with fuel metering, one fuel unit per executed instruction, on the 32 gate-set vectors of `vectors/levels/`. The browser `replay` also hashes the state after every tick, which the referee does not, so I subtracted the measured cost of those hashes (167,025 to 167,112 instructions each). Script: `native-scripts/wasm_fuel.py`; output: `native-dl/wasm_fuel_levels.txt`.

| | wasm instructions |
|---|---:|
| Heaviest level (`10-worst`; 29.6M zkVM cycles; 11.6M Stylus gas) | 65.0M |
| Per level, heavier vector: minimum, median, maximum | 31.0M, 38.2M, 65.0M |
| Six-level run: lightest six, heaviest six | 199M, 286M |
| Level setup (`commit-at-tick-0`, one tick) | 2.0M |
| One idle tick (`open-field-empty`) | about 720 |
| One capture (`capture-edge-rectangle`) | about 1.2M |

That is about 2.2 wasm instructions per RV32IM cycle. A side observation [I]: the Stylus referee pays about 1,650 to 1,780 ink per browser-build instruction, while the Stylus price list charges 70 to 825 ink for arithmetic, loads, stores and branches and 3,800 for a `call` (https://docs.arbitrum.io/stylus/reference/opcode-hostio-pricing). The referee is built for size (`opt-level = "z"`, then `wasm-opt -Oz`), which keeps small functions as calls. With the size limit now 96 KB (ArbOS 61), building for speed is an untested lever on Stylus gas. It would need to be worth more than 10 times to bring a run near the fee.

### 4.2 Orbit chains: is Stylus activation open anywhere? [P, onchain]

I read `ArbWasm.activationGas()` on every Orbit mainnet chain of the official bridge list (https://raw.githubusercontent.com/OffchainLabs/arbitrum-token-bridge/master/packages/arb-token-bridge-ui/src/util/orbitChainsData.json, 33 chains) plus Robinhood Chain and Reya, at about 14:32 UTC. Results: `native-dl/orbit_probe_result.json`, `native-dl/orbit_probe_retry.json`.

| Status | Chains |
|---|---|
| Paused (2^64 − 1) | Arbitrum One, Nova, Sepolia; Robinhood Chain; Plume; ApeChain; SX; Humanity; Galactica; Earnm; HPP; World Mobile Chain; ChainBounty; Reya |
| Open (`activationGas` = 0) | T-REX (chain 1628, ArbOS 61, settles to Ethereum) |
| No gate (ArbOS 32, where the parameter does not exist) | Xai (chain 660279, Stylus version 2) |
| Not reachable from this session (proxy 502, HTTP 404 or an expired certificate) | Superposition, Sanko, Gravity, RARI, Edu Chain, Molten, Hychain, Syndicate and 14 others of the list |

The AIP says "Configuration of independently governed Arbitrum chains is handled separately", and almost every chain I could reach has followed the pause. Reya is worth a note: its per-transaction cap is 300M gas and its minimum price 0.0001 gwei, so a whole run would fit one transaction for about a cent there, but activation is paused there as well.

Bridging back from an Orbit chain [I]: an Orbit chain's messages reach its parent through its rollup contracts, after its challenge period, and are only as sound as its validator whitelist and its owner's upgrade keys. The repo's own skill notes say of Robinhood Chain that L2Beat rates it below Stage 0 with "only two whitelisted validators" (`.claude/skills/l2s/SKILL.md`, secondary). That is validity resting on a few named parties, which the owner rules out.

### 4.3 Other virtual machines

| Chain | Limit that matters | This workload | Cost | Label |
|---|---|---|---|---|
| NEAR (wasm), protocol version 88 | 1,000 TGas per receipt and per transaction (`max_gas_burnt` = `max_total_prepaid_gas` = 1e15); 822,756 gas per wasm instruction; price floor 0.0001 NEAR per TGas; 4 MiB arguments | Level: 26 to 54 TGas. Run: 164 to 236 TGas. **One transaction.** | 0.016 to 0.024 NEAR, $0.06 to $0.09 at $3.65 | P: `EXPERIMENTAL_protocol_config` on https://rpc.mainnet.fastnear.com, 2026-11-10; https://docs.near.org/protocol/transactions/gas ; M for the instruction counts |
| Internet Computer (wasm) | 40 billion instructions per update call; 0.4 cycles per instruction on a 13-node subnet ("40B instructions... would reserve 16B cycles"); 1 trillion cycles = 1 XDR, about $1.35 | Run: under 1% of the limit. | about $0.0002, before the fee of a threshold signature | P: https://raw.githubusercontent.com/dfinity/portal/master/docs/building-apps/canister-management/resource-limits.mdx and `.../essentials/gas-cost.mdx` (the XDR rate is dated 2025-05-22, stale) |
| CosmWasm chains (wasm) | 115 CosmWasm gas per instruction, 1,610 for branches and returns; 140,000 CosmWasm gas per SDK gas | Run: about 0.16M to 1.1M SDK gas depending on the share of branches. Fits a normal transaction. | chain-dependent, not sourced | P: https://cosmwasm.github.io/core/architecture/gas ; `wasmd` `gas_register.go`; `cosmwasm-vm` `engine.rs` (fetched 2026-11-10) |
| Solana (sBPF) | 1,400,000 compute units per transaction; heap at most 256 KiB | Roughly 1e8 instructions per run, so on the order of 65 to 100 chained transactions with the state kept in an account. Not single-shot. | not sourced | P for the limit: https://raw.githubusercontent.com/anza-xyz/agave/master/program-runtime/src/execution_budget.rs ; I for the rest |
| Polkadot Hub (PolkaVM, RISC-V, `pallet-revive`) | Call depth 5, code blob about 100 KB; weight limits per transaction not found | Rust contracts are "officially supported" by `pallet-revive`, but the module is "experimental" and the docs flag "PVM Preview Release... early-stage development and may be unstable or incomplete". | not sourced | P: https://docs.polkadot.com/reference/polkadot-hub/smart-contracts/ and https://docs.polkadot.com/smart-contracts/for-eth-devs/evm-vs-pvm/ (last updated 2026-06-29); https://raw.githubusercontent.com/paritytech/polkadot-sdk/master/substrate/frame/revive/README.md |
| Fluent (rWasm, EVM and wasm blended) | not sourced | Rust contracts supported. | not sourced | P: https://docs.fluent.xyz/ says "Currently in public testnet" (undated; `fluentbase-sdk` 1.5.1 of 2026-09-28) |
| MegaETH (EVM) | 10 billion gas per transaction, of which at most 200M "compute gas"; base fee 0.001 gwei | A hand-written Yul port of a level (44M to 139M gas) fits one transaction for $0.09 to $0.29. It is still a second implementation. | $0.6 to $1.3 per run | P: https://docs.megaeth.com/developer-docs/overview-3/resource-limits ; RPC read, block 31,524,263 |
| Monad (EVM) | 30M gas per transaction, 150M per block; charges the gas limit, not the gas used | No more room than Arbitrum. | | P: https://docs.monad.xyz/developer-essentials/gas-pricing |

### 4.4 What a bridge of the result back to Arbitrum One adds

| Route back | What the Arbitrum contract would have to trust | Label |
|---|---|---|
| NEAR, Omni Bridge | "Chain Signatures replaces this with a single MPC signature verification." A threshold of MPC nodes signs; the destination verifies one ECDSA signature. The older light-client bridge existed only toward Ethereum and took "between 4 and 8 hours due to the 4-hour challenge period". | P: https://docs.near.org/chain-abstraction/omnibridge/how-it-works (fetched 2026-11-10) |
| Internet Computer, chain-key ECDSA | "the private ECDSA key exists only as secret shares held by nodes"; a canister requests a signature. The Arbitrum contract would accept whatever one subnet's threshold of nodes signs. | P: https://raw.githubusercontent.com/dfinity/portal/master/docs/building-apps/network-features/signatures/t-ecdsa.mdx |
| Polkadot, Snowbridge | Light clients on both sides (BEEFY on Ethereum), no committee key, but the message lands on Ethereum L1, then needs a second hop to Arbitrum. At 0.607 gwei, 300k L1 gas alone is $0.38, more than three times the run fee. | P for the design: https://docs.polkadot.com/reference/polkadot-hub/bridging/ ; I for the cost |
| Another rollup (MegaETH, an Orbit chain settling to Ethereum) | That rollup's proof system and upgrade keys, its withdrawal delay, then L1 gas and an L1-to-Arbitrum message. | I |
| Guardian or validator-set bridges (for Solana and Cosmos chains) | A named signer set. | I, not sourced in this session |

Every row either puts a signer set under validity, which the owner excludes, or adds a light-client or proof system that is heavier than the single Groth16 verifier call the project already has. A zk light client is, in addition, a zk proof by another name.

## 5. Conclusion

- **Now:** no. On Arbitrum One and Sepolia, a new Stylus program cannot be activated, and nothing else on the chain can run the Rust core. The EVM can only run a rewrite of it, at 44M to 139M gas per level in the best case measured.
- **Soon:** only a permissioned Stylus. Not before mid-December 2026, more likely Q1 2027, subject to an onchain vote that 43% of the temperature-check weight opposed. It would bring an auditor and a Foundation signature into every release of the rules, on testnet as well, and it would cost 13 to 20 times the run fee per verified run until the referee is optimized by an order of magnitude.
- **Permissionless Stylus:** no date exists, and the team that builds it says gating is the long-term design.
- **Elsewhere:** NEAR, the Internet Computer and CosmWasm chains would run a whole run in one cheap transaction, but none has a way back to Arbitrum One that is both free of a signer set and lighter than a zkVM verifier.
- **Fewer dependencies than a zkVM:** none of these routes has them. The Stylus referee has one real advantage, which the owner's question touches: with it, a player settles their own run from the browser with ordinary transactions and no proof at all. That is worth keeping as a second backend behind `IReferee` for the day a gated activation is obtainable, at a cost a player would only pay when a payout is at stake.

What I would do with this in the repo [I]:
1. Keep D2 = zk. Stop treating "Stylus first" (README §7.3, point 4) as the default future: reword it to "Stylus if a gated activation is obtained and its gas is brought down".
2. Update the README status line of §7.3: Sepolia is paused since 2026-10-02 15:36 UTC by its own transaction, and reopening means audit plus signature, per code version.
3. If the Stylus backend is kept alive: move the build to a plain `cargo stylus` reproducible build, and try a speed-optimized build before any audit request, since both change the code hash.

## 6. Options, ranked

| # | Option | Fit | Why |
|---|---|---|---|
| 1 | Gated Stylus referee on Arbitrum One, later | possible | Same Rust core, no prover, player can self-settle; but not available before Q1 2027, audit and signature per version, $1.38 to $2.10 per run |
| 2 | One-step RISC-V contract inside a dispute game | weak | One implementation on a plain EVM, 175k to 380k gas per disputed step; experimental code, another family of design, heavy to build |
| 3 | Stylus on an Orbit chain that left activation open (T-REX, Xai) | no | Two obscure chains; result returns through their validators and owner keys |
| 4 | NEAR contract | no | One transaction, $0.06 to $0.09; result returns under an MPC signature |
| 5 | Internet Computer canister | no | Trivial compute; result is a subnet's threshold signature |
| 6 | CosmWasm chain | no | Trivial compute; no signer-free route to Arbitrum sourced |
| 7 | Solidity or Yul referee on Arbitrum One | no | Second implementation; 44M to 139M gas per level at best, 108M to 244M in careful Solidity |
| 8 | Yul referee on MegaETH | no | Fits one transaction per level; second implementation and a two-hop return |
| 9 | Bulk RISC-V interpreter in the EVM | no | About 2e10 gas per run |
| 10 | Solana or Polkadot Hub | no | 65 to 100 chained transactions, or a preview VM with a return through Ethereum L1 |

## 7. Could not verify

- The cost, turnaround and payer of the "limited audit", and the Foundation's activation Terms of Use (not published).
- The date of the onchain vote, and any date or proposal for ArbOS 70.
- News coverage of the pause beyond one article (cryip.co, 2026-11-04, secondary): the cryptobriefing article the README cites was not opened.
- The activation status of Superposition, Sanko, Gravity and 19 other Orbit chains of the official list: their RPC hosts were unreachable from this session. Of the 16 Orbit-stack chains I could read, 14 are paused.
- Polkadot Hub: per-transaction weight limits, whether contracts run under the PolkaVM interpreter or a compiler, and whether PVM contracts are enabled on Polkadot mainnet.
- Gas per step of Cartesi's `UArchStep` and of Optimism's current `MIPS64.sol`; the date of Asterisc's gas snapshot.
- Any published gas-per-instruction figure for an in-memory RISC-V or wasm interpreter written for the EVM; my 200 gas per instruction is an estimate.
- Block gas limits and prices of specific CosmWasm chains; Solana's fee per transaction and the sBPF instruction count of this core; the Internet Computer's fee for a threshold ECDSA signature.
- Whether Fluent has a mainnet (its docs say public testnet).
- Whether some maintained Rust-to-EVM compiler exists beyond the four projects checked.
- The Stylus gas a speed-optimized build of the referee would reach (not built: no long builds in this task).

## 8. Files of this research

All under `scratchpad/research/`.

| File | What |
|---|---|
| `native-scripts/chain_read.py`, `chain_read2.py` | Arbitrum One and Sepolia parameters (`native-dl/chain_read_output.txt`) |
| `native-scripts/pause_logs.py` | The two pause transactions (`native-dl/pause_logs_output.txt`) |
| `native-scripts/gov_logs.py`, `gov_quorum.py`, `gov_history.py` | Core governor proposals, quorum, past votes (`native-dl/gov_history_output.txt`) |
| `native-scripts/calldata_floor.py` | EIP-7623 floor test (`native-dl/calldata_floor_output.txt`) |
| `native-scripts/l1fee_sample.py` | L1 data fee per kilobyte on recent receipts (`native-dl/l1fee_sample_output.txt`) |
| `native-scripts/orbit_probe.py`, `orbit_retry.py` | Activation status across Orbit chains (`native-dl/orbit_probe_result.json`, `orbit_probe_retry.json`) |
| `native-scripts/wasm_fuel.py` | wasm instruction counts (`native-dl/wasm_fuel_levels.txt`, `wasm_fuel_game.txt`) |
| `native-evm/FillBench.sol`, `native-evm/bench.mjs` | EVM gas of the capture (`native-dl/evm_bench_output.txt`) |
| `native-dl/snapshot_stylus.json`, `forum_31530.json`, `forum_31605.json`, `forum_31555.json` | Snapshot proposal and forum threads as fetched |
| `native-dl/pdf/tob_stylus_deployer.pdf` | Trail of Bits summary report |

## 9. Sources

Arbitrum governance and announcements
- Security Council Emergency Action – 2/10/2026. https://forum.arbitrum.foundation/t/security-council-emergency-action-2-10-2026/31530 . Posted 2026-10-02, edited 2026-10-30.
- [Constitutional] AIP: Stylus Activation Contract. https://forum.arbitrum.foundation/t/constitutional-aip-stylus-activation-contract/31605 . Created 2026-10-23, last post 2026-11-06.
- Snapshot proposal. https://snapshot.org/#/s:arbitrumfoundation.eth/proposal/0xbb3a36f5149d731c9fd11c150634b9bf90f95e73b8ec85e88cd5541149c6a8b6 . Closed 2026-11-05 20:45 UTC; read through https://hub.snapshot.org/graphql on 2026-11-10.
- 2 November, 2026 – Roundup of Active/Upcoming Votes. https://forum.arbitrum.foundation/t/2-november-2026-roundup-of-active-upcoming-votes/31631 . 2026-11-02.
- 29 July, 2026 – Roundup of Active/Upcoming Votes. https://forum.arbitrum.foundation/t/29-july-2026-roundup-of-active-upcoming-votes/31121 . 2026-07-29.
- Trail of Bits, Stylus Permissioned Deployer summary report. https://docs.arbitrum.io/audit-reports/2026_11_06_trail_of_bits_stylus_permissioned_deployer_summary_report.pdf . 2026-11-06.
- [CONSTITUTIONAL] AIP: Update Arbitrum One and Nova L1-Pricing Parameters for Ethereum Glamsterdam. https://forum.arbitrum.foundation/t/constitutional-aip-update-arbitrum-one-and-nova-l1-pricing-parameters-for-ethereum-glamsterdam/31555 . 2026-10-07.
- Arbitrum Security Program. https://forum.arbitrum.foundation/t/arbitrum-security-program/31207 . 2026-08-13.
- Stylus Sprint Retrospective. https://forum.arbitrum.foundation/t/stylus-sprint-retrospective/31606 . 2026-10-23.
- The Constitution of the Arbitrum DAO. https://docs.arbitrum.foundation/dao-constitution . Undated, fetched 2026-11-10.
- Network upgrades table. https://docs.arbitrum.foundation/network-upgrades . Undated, fetched 2026-11-10.
- cryip.co, "Arbitrum Moves to Resume Stylus Contract Activations a Month After Pausing Them". https://cryip.co/?p=21895 . 2026-11-04. Secondary.

Arbitrum documentation and code
- Temporary pause on new Stylus activations. https://docs.arbitrum.io/notices/stylus-activation-pause-notice . Undated.
- Activation. https://docs.arbitrum.io/stylus/concepts/activation . Undated.
- Gas and fees. https://docs.arbitrum.io/how-arbitrum-works/deep-dives/gas-and-fees . Undated.
- ArbOS 61 Elara. https://docs.arbitrum.io/run-arbitrum-node/arbos-releases/arbos61 . Undated; describes the 2026-08-20 activation.
- ArbOS 51 Dia. https://docs.arbitrum.io/run-arbitrum-node/arbos-releases/arbos51 . Undated; activation 2026-01-08.
- Gas and ink costs. https://docs.arbitrum.io/stylus/reference/opcode-hostio-pricing . Undated.
- Gas metering. https://docs.arbitrum.io/stylus/concepts/gas-metering . Undated.
- `ArbWasm.sol`, `ArbOwner.sol`, `ArbGasInfo.sol`. https://raw.githubusercontent.com/OffchainLabs/nitro-precompile-interfaces/main/ArbWasm.sol (and siblings). Commit `4b42e8c`, 2026-11-02, per https://github.com/OffchainLabs/nitro-precompile-interfaces/commits/main/ArbWasm.sol .
- Orbit chains list. https://raw.githubusercontent.com/OffchainLabs/arbitrum-token-bridge/master/packages/arb-token-bridge-ui/src/util/orbitChainsData.json . Fetched 2026-11-10.
- `cargo-stylus` 0.10.10 and `stylus-sdk` 0.10.10, both published 2026-10-02. https://crates.io/api/v1/crates/cargo-stylus .

Onchain reads, 2026-11-10
- Arbitrum One https://arb1.arbitrum.io/rpc ; Arbitrum Sepolia https://sepolia-rollup.arbitrum.io/rpc ; Arbitrum Nova https://nova.arbitrum.io/rpc ; Robinhood Chain https://rpc.mainnet.chain.robinhood.com ; Reya https://rpc.reya.network ; Ethereum https://ethereum-rpc.publicnode.com ; MegaETH https://mainnet.megaeth.com/rpc ; Monad https://rpc.monad.xyz ; NEAR https://rpc.mainnet.fastnear.com .
- Prices: https://api.coinbase.com/v2/prices/ETH-USD/spot (and NEAR, SOL, DOT, ICP), 2026-11-10 14:26 to 14:40 UTC.

Interpreters and compilers
- https://raw.githubusercontent.com/ethereum-optimism/optimism/v1.1.4/packages/contracts-bedrock/.gas-snapshot . 2023, stale.
- https://raw.githubusercontent.com/ethereum-optimism/asterisc/master/rvsol/.gas-snapshot and https://raw.githubusercontent.com/ethereum-optimism/asterisc/master/README.md . Undated.
- https://raw.githubusercontent.com/cartesi/machine-solidity-step/main/README.md . Undated.
- https://raw.githubusercontent.com/matter-labs/solx/main/README.md ; https://raw.githubusercontent.com/zink-lang/zink/main/README.md ; https://raw.githubusercontent.com/etclabscore/evm_llvm/EVM/README.md ; https://raw.githubusercontent.com/r55-eth/r55/main/README.md . Fetched 2026-11-10.

Other chains
- NEAR gas. https://docs.near.org/protocol/transactions/gas . Undated. Omni Bridge. https://docs.near.org/chain-abstraction/omnibridge/how-it-works . Undated.
- Internet Computer. https://raw.githubusercontent.com/dfinity/portal/master/docs/building-apps/canister-management/resource-limits.mdx ; `.../building-apps/essentials/gas-cost.mdx` ; `.../building-apps/network-features/signatures/t-ecdsa.mdx` . Fetched 2026-11-10.
- CosmWasm. https://cosmwasm.github.io/core/architecture/gas ; https://raw.githubusercontent.com/CosmWasm/wasmd/main/x/wasm/types/gas_register.go ; https://raw.githubusercontent.com/CosmWasm/cosmwasm/main/packages/vm/src/wasm_backend/engine.rs . Fetched 2026-11-10.
- Solana. https://raw.githubusercontent.com/anza-xyz/agave/master/program-runtime/src/execution_budget.rs . Fetched 2026-11-10.
- Polkadot. https://docs.polkadot.com/reference/polkadot-hub/smart-contracts/ ; https://docs.polkadot.com/smart-contracts/for-eth-devs/evm-vs-pvm/ ; https://docs.polkadot.com/smart-contracts/for-eth-devs/gas-model/ ; https://docs.polkadot.com/reference/polkadot-hub/bridging/ . Last updated 2026-06-29. https://raw.githubusercontent.com/paritytech/polkadot-sdk/master/substrate/frame/revive/README.md .
- Fluent. https://docs.fluent.xyz/ ; https://raw.githubusercontent.com/fluentlabs-xyz/fluentbase/devel/README.md . Undated.
- MegaETH. https://docs.megaeth.com/developer-docs/overview-3/resource-limits ; https://docs.megaeth.com/developer-docs/overview-3/gas-model . Undated.
- Monad. https://docs.monad.xyz/developer-essentials/gas-pricing . Undated.

Repository
- `README.md` §7.3; `docs/VERIFICATION.md` ("Stylus activation", "Stylus gas", "End-to-end gas", "D2: the backend"); `core/src/capture.rs`, `grid.rs`, `game.rs`; `referee/build-wasm.sh`; `Cargo.toml` (`profile.stylus`).
