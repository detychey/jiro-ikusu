# Attestation routes that are not validity proofs

Research date: 2026-11-10. Every page below was opened on that date unless a publication date is given. Each fact is marked **[P]** primary source (official documentation, a repository file, or a contract read), **[S]** secondary source, or **[I]** my inference. Sources older than twelve months are marked *old*. Source ids (A1, T3, ...) point to section 12. Nothing was compiled or deployed: every gas figure for a contract that does not exist yet is an estimate, and says so.

The question: what would the project gain and lose by replacing the proof with an attestation, and are there forms that keep most of the trust properties? And could the player produce it in the browser?

## 1. The answer, with the facts that decide it

**An attestation that the contract believes saves about 0.000023 ETH (US$0.048, 46 % of the run fee) and 9 to 17 CPU-hours per verified run, and in exchange it puts validity on a signer. Every such form violates the owner's constraint. The form that keeps most of the trust properties is an attestation that is only a claim, which a validity proof can overturn inside a window. For this game that claim needs neither a TEE nor an oracle network, and the player's browser can make it.**

The facts that decide it:

1. **What an attestation can save is bounded and known.** A zk-verified run costs 804,194 gas plus a 0.0000184 ETH proof: 0.0000346 ETH, 69 % of the 0.00005 ETH fee, at today's base fee of 0.02011 gwei (S2, C1). Of that, 576,603 gas is settlement that any design pays. The part an attestation removes is the Groth16 verification (227,591 gas) and the proof: 0.000023 ETH, US$0.048. A signature check in its place costs about 8,000 gas, 0.3 % of the fee [I]. The larger gain is time: milliseconds instead of 9 to 17 hours on 4 cores. [P for the measured figures]
2. **TEE attestation can be verified on Arbitrum One today, but one verification costs more than a run.** Automata's DCAP Attestation v1.1 is deployed on Arbitrum One and Arbitrum Sepolia (`AutomataDcapAttestationFee` at `0xaDdeC7e85c2182202b66E331f2a4A0bBB2cEEa1F`; I read 8,747 bytes of code at that address on both chains). Its README gives about 4 million gas for a full onchain verification with the P-256 precompile and 5 million without, and 493,000 to 522,000 gas for a zk-wrapped one. [P] (A1, A3, C2) At today's fee 4 million gas is 0.00008 ETH, 161 % of a run fee. So a quote is verified once, to register an enclave's key, and each run then carries a plain signature. The P-256 precompile is live on Arbitrum One and Sepolia: I called it with a fresh signature and it cost about 6,900 gas. [P] (C3)
3. **Since September 2025 every mainstream server TEE has had its attestation forged in the lab with a cheap memory interposer, and the vendors call it out of scope.** WireTap (SGX, DDR4, under US$1,000), Battering RAM (SGX and SEV-SNP, DDR4, under US$50), TEE.fail (SGX, TDX and SEV-SNP, DDR5, under US$1,000, quotes forged at the `UpToDate` level) and DDRop (TDX attestation forged in about two minutes, US$159 of parts, disclosed 2026-09-14). All need physical access to a machine, which may be the attacker's own. Intel and AMD: no fix, physical security is the mitigation. [P] (T1 to T5) A referee that accepts a quote from any genuine machine can therefore be forged by anyone with a server and a soldering iron. One that accepts quotes only from the operator's hosted machine is a trusted signer with extra steps.
4. **The largest production user of TEE proofs does not let them stand alone.** Base's Azul proof system (mainnet, May 2026) gives a TEE-only proposal the long window, 7 days at launch and 5 since the Beryl upgrade, and states: "The ZK path is permissionless and can override an invalid TEE-backed claim." The TEE path is permissioned and uses a registrar that keeps the list of accepted signers. [P] (B1) That is the shape that fits the owner's constraint: the signer can only be wrong until challenged.
5. **The verifier a TEE referee would call has an owner who can replace it.** Automata's entrypoint is `Ownable`; its owner can call `setQuoteVerifier`, `setZkConfiguration` and `addVerifyRoute`. On Arbitrum One the owner is `0xdf841b239be7a6b37366005107069b7410da4ff9`, an address with no code and a nonce of 168, so a plain key and not a multisig contract; the fee is 0 bp today. [P] (A4, C2) The repository refuses exactly this for RISC Zero: `ZkReferee` "never calls the upgradeable router, whose owner could add a route that accepts forged proofs" (`docs/ECONOMY.md`). [P] (S3)
6. **The oracle and compute networks named in the brief churned in 2026.** Chainlink Functions and Chainlink Automation are sunset (Functions: mainnet 2026-06-30 on most pages). [P] (L1, L6) Gelato Web3 Functions shut down on 2026-03-31 according to a competitor's migration guide, and Chainlink published its own Gelato migration guide on 2026-02-16. [S] (G1, L7) Lit Protocol launched its threshold network "Naga" on 2026-01-20 and on 2026-04-01 launched "Chipotle" (v3), an API server inside an Intel TDX enclave on Phala Cloud, whose documentation lists the Naga actions as deprecated. [P] (I1 to I4) EigenCompute is a "Mainnet Alpha", "Not recommended for customer funds". [P] (E1) Boundless has made the Kailua repository read-only. [P] (B3) A small team that takes one of these as a dependency takes that churn.
7. **Chainlink's replacement, CRE, could run the Rust core, and its word would still be a signer's.** CRE workflows are wasm, a custom Rust plugin can be linked in (TS SDK 1.6.0, 2026-04-20), Arbitrum One is supported, and the limits fit (5 minutes, 100 MB, 250 KB HTTP responses, 50 KB reports). Deployment needs an approved access request, the price is not published, and the result is a report signed by Chainlink's node operators. [P] (L2 to L5, L8)
8. **UMA's optimistic oracle is three orders of magnitude out of scale.** On Arbitrum One, `OptimisticOracleV3.getMinimumBond` returns 500 USDC for USDC and 0.11 WETH for WETH, and `defaultLiveness` is 7,200 s. [P] (C4) 500 USDC is 4,833 run fees. A dispute goes to a token-holder vote on Ethereum in 24-hour commit and 24-hour reveal rounds, and UMA lists Arbitrum as "unmonitored". [P] (U1, U2) A vote on the output of a deterministic program adds nothing when a proof can decide it.
9. **The plain design keeps the proof as the court and removes it from the normal path.** Journals are already public in `commitRun` calldata and replay costs milliseconds in a browser (repository), so anyone can check any claim for free, and the existing `ZkReferee` can settle any dispute. Proofs are then made only for disputes. The price is a liveness assumption (one honest watcher gets a transaction included inside the window) and a window that must exceed Arbitrum's 24-hour force-inclusion delay. [P for the inputs, I for the conclusion] (S1, N1) The sibling report `optimistic.md` in this folder works out the contract; I did not verify it.

## 2. Baseline

From `README.md` §7, `docs/VERIFICATION.md` and `docs/ECONOMY.md` [P] (S1 to S3), priced at Arbitrum One's base fee of 0.02011 gwei (block 522,996,833, 2026-11-10 13:58 UTC) and ETH at US$2,069 (CoinGecko 2,068.49, Coinbase 2,069.35, the same minute) [P] (C1). The base fee moves: the repository read 0.020036 gwei on 2026-11-02, and the sibling report read 0.028 gwei half an hour before me.

| Quantity | Gas or ETH | US$ | Share of the 0.00005 ETH fee (US$0.1035) |
|---|---:|---:|---:|
| Groth16 verification of one run proof | 227,591 gas, 0.0000046 ETH | 0.0095 | 9.2 % |
| Proof on Boundless, p50 (2026-11-02) | 0.0000184 ETH | 0.0381 | 36.8 % |
| `settleRun` without the referee | 576,603 gas, 0.0000116 ETH | 0.0240 | 23.2 % |
| One zk-verified run, total | 0.0000346 ETH | 0.0715 | 69.1 % |
| What an attestation can remove | 0.0000230 ETH | 0.0475 | 46.0 % |

Trust today: no signer. A payout can be forged only by breaking RISC Zero's proof system, its Groth16 setup, or the core. It can be blocked by the owner of RISC Zero's emergency stop, who can only pause, and in practice by the operator not proving, since a player needs 9 to 17 hours on 4 cores, 16 GiB and an x86 Docker image to prove a run alone (`docs/ECONOMY.md`, "the operator is in practice the only prover").

The specification already states the constraint this report tests against: "The contracts never accept the service's signature or word in place of a proof: that is the oracle design ethblockdigger rejected, where one compromised key could pay out" (README §7.5). [P] (S1)

## 3. Three trust shapes

Every option below is one of three shapes. The shape, not the vendor, decides whether the owner's constraint holds.

| Shape | A result is accepted because | Forged by | Constraint |
|---|---|---|---|
| **Proven** (today) | a proof verifies | a break of the proof system | holds |
| **Believed** | a key signed it: an operator, a quorum of node operators, a token vote, or a CPU vendor's key chain plus whoever holds the machine | whoever controls or extracts the key | violated |
| **Claimed, overridable by proof** | nobody proved it wrong inside a window, and anyone could have | the claimant, only if every watcher is asleep or censored for the whole window | holds, with a liveness assumption added |

A TEE quote is a signature. Its chain ends at Intel's, AMD's or AWS's root key, and the statement it signs is "a machine I certified ran this code", which is true only while nobody has opened the machine. So "TEE attestation" belongs in the second row unless a proof can override it.

## 4. TEE attestation verified onchain on Arbitrum

### 4.1 What is deployed on Arbitrum One

**Automata DCAP Attestation v1.1** verifies Intel SGX and TDX quotes (versions 3, 4 and 5). [P] (A1 to A4, C2)

- **Addresses, the same on Arbitrum One (42161) and Arbitrum Sepolia (421614):** `AutomataDcapAttestationFee` `0xaDdeC7e85c2182202b66E331f2a4A0bBB2cEEa1F`, `PCCSRouter` `0xaf2a0D5473062b36E2dE986DA09d945EB26d492B`, plus the onchain PCCS contracts that hold Intel's collateral. `eth_getCode` returns 8,747 and 13,475 bytes on both chains.
- **Gas, from the README:** onchain "~4-5M gas", "~4M with RIP-7212 precompile, ~5M without"; RISC Zero Groth16 522k; SP1 Groth16 493k; SP1 Plonk 569k. Proving the wrapper takes under a minute on Boundless or under 30 s on Succinct's network, by the same table. These are not Arbitrum-specific measurements, and I found none.
- **The precompile:** Arbitrum has had P-256 verification since ArbOS 31, and ArbOS 50 lists EIP-7951. [S] (N2) My own probe: a call to `0x…0100` with a freshly generated P-256 signature returns 1 on Arbitrum One and Arbitrum Sepolia, returns empty for a corrupted signature, and `eth_estimateGas` is 6,914 gas above the same calldata sent to a plain address. [P] (C3) So the 4 million figure applies.
- **Admin:** `owner()` is `0xdf841b239be7a6b37366005107069b7410da4ff9`; `getBp()` is 0, so no fee is charged today; the owner can set a fee, replace a quote verifier, and add or change zk routes and program ids. `eth_getCode` of the owner returns nothing and its transaction count is 168: it is an externally owned account, one key.
- **Audits:** Trail of Bits, February 2025 (v1.0), and an OpenZeppelin audit of a dependent verifier in October 2025, whose finding is fixed in v1.1.

**AMD SEV-SNP and AWS Nitro.** I found no SEV-SNP quote verifier deployed on Arbitrum. For AWS Nitro, full onchain verification is out of reach: Marlin measured "less than 70 million" gas in stages on Arbitrum Sepolia (2024-04-11, *old*), and Espresso's documentation gives "around 63 million gas" and says that after Fusaka "on-chain attestation verification became infeasible for L2s and L3s". Both exceed Arbitrum's 32 million gas per transaction. The zk-wrapped path costs about 260,000 to 270,000 gas plus a proof of about 0.3 PROVE, about US$0.13 at 2026-01-08 prices. [P] (M4, X1)

### 4.2 The shape a TEE referee would take here

This is the pattern of Flashbots' Flashtestations, built for Unichain's block builder: a TDX machine registers an address through Automata's verifier, a policy contract lists the approved workload measurements, and later signatures from that address are trusted. [P] (F1) Applied to this project [I]:

1. **The enclave program** is the core built natively, wrapped like the zk guest: read six levels, six journals and six weights, replay, and output the same 2,304 bytes of public values. It then signs their hash with a key generated inside the enclave. It needs no network and no state. One core still: this is the native target that the tests already build.
2. **`TeeReferee`**, a third `IReferee`: `proof` is a 65-byte signature; the contract recovers the signer and requires it to be registered. Registration verifies a quote once through Automata, requires the measurement to equal an immutable constant, and reads the key from the quote's report data.
3. **Per run:** `ecrecover` (3,000 gas), one storage read and 65 bytes of calldata: about 8,000 gas [I], against 227,591 gas and a proof. A verified run falls from 0.0000346 ETH to about 0.0000118 ETH, 23.5 % of the fee.
4. **Per registration:** 4 million gas (US$0.17) onchain, or about 0.5 million gas (US$0.02) plus a wrapper proof. Registration repeats when the key rotates and when Intel's collateral moves on: Automata's deployment already carries TCB evaluation numbers 20 and 21. [P] (A3)

Two things make it heavier than it looks.

- **Pinning the measurement is not one constant.** For a dstack application the identity is spread over MRTD, RTMR0 to RTMR2 (the OS image) and RTMR3, a SHA-384 hash chain over an event log that includes the compose hash and the key provider. Phala's chain-of-trust guide describes replaying it offchain and names no onchain verifier. [P] (P3) Doing it in a contract means SHA-384 in Solidity, or a trusted registrar that does it offchain, which is what Base runs. [I] (B1)
- **The verifier is someone else's upgradeable contract** (fact 5). Pinning the versioned quote verifier instead of the entrypoint narrows this, but that verifier still reads collateral through Automata's PCCS contracts. [I]

### 4.3 Where the enclave would run

| Host | What it is, November 2026 | Price | Maturity and trust notes |
|---|---|---|---|
| **Phala Cloud (dstack)** | Docker containers in Intel TDX VMs. dstack is a Linux Foundation Confidential Computing Consortium project, audited by zkSecurity. AMD SEV-SNP is "new and experimental"; AWS Nitro is listed. [P] (P2) | `tdx.small`, 1 vCPU, 2 GB, 20 GB: US$0.058 per hour, disk US$0.000139 per GB-hour; about US$44 a month always on. [P] (P1) | In production; Lit v3 runs on it. Hardware is at OVH and other bare-metal hosts, hyperscaler support "in progress" (2025-10-28, *old*). [P] (P4) The TEE.fail authors showed a malicious host forging all of dstack's attestation. [P] (T3) |
| **EigenCompute** | Docker image in a TEE on Google Cloud. | SEV-SNP 2 vCPU, 4 GB: US$0.07 per hour; TDX 4 vCPU, 16 GB: US$0.33 per hour. [P] (E2) | "Mainnet Alpha", "Not recommended for customer funds", "Developer is trusted", no SLA. Trust includes Google's attestation service and a single KMS run by EigenLabs, which "can theoretically decrypt environment variables". [P] (E1, E3) |
| **Marlin Oyster** | Enclaves (its guides verify AWS Nitro attestations), rented as VMs or used as a serverless pool. The serverless contracts are on Arbitrum One (Relay `0xD28179711eeCe385bc2096c5D199E15e6415A4f5`). A contract calls `relayJob` with USDC and an ETH callback deposit; three executors run a JavaScript function in `workerd` and a gateway calls back. Limits: 100 MB, 5 minutes, "5% average CPU utilization". [P] (M1 to M3) | Not published per request; the example deposits 5 USDC and 0.005 ETH. | The only option native to Arbitrum One, and almost unused: the Relay proxy emitted 4 logs in the last 52 million blocks, about 170 days at the 3.5 blocks per second between the repository's reading of 2026-11-02 and mine, and the subscription relay none. [P] (C5) Whether `workerd` there can instantiate a wasm module I could not verify. |
| **Oasis ROFL** | TDX or SGX applications managed from Oasis Sapphire; mainnet since 2025-07-02. [P][S] (O1, O4) | Testnet offer: 5 TEST per hour for 2 vCPU, 4 GiB. Mainnet price not found. [P] (O3) | The documented way to reach another EVM chain is a secp256k1 key generated in the enclave; the guide's destination contract has no attestation check. [P] (O2) On Arbitrum that is a plain trusted address. |
| **Lit Protocol v3 "Chipotle"** | A hosted API that runs a JavaScript "Lit Action" inside an Intel TDX enclave on Phala Cloud and signs with a key bound to the action's hash by contracts on Base. Actions can load WebAssembly "compiled from Rust". Limits: 15 minutes, 64 MB, 16 MB of code and parameters. [P] (I1 to I3) | US$0.01 per second, one-second minimum; minimum top-up US$5. [P] (I2) | Live since 2026-04-01, the second new architecture of 2026. New releases that may hold keys are approved by the "Lit multisig". [P] (I1, I4) |
| **AWS Nitro, self-run** | An enclave on the operator's AWS account. | EC2 rates, not researched. | AWS is both the hardware owner and the attestation signer. Onchain verification needs the zk wrapper (4.1). |

At these prices an always-on Phala VM (US$44 a month) costs the same as the proofs and verification of about 940 runs a month (US$0.0475 each). Below that volume Boundless proofs are cheaper than a standing enclave; an enclave started for an hour at season end costs cents. [I] Cost is not what separates the options.

### 4.4 TEE breaks, 2025 to 2026, and what they imply

| Attack | Disclosed | Target | Cost of the device | Result |
|---|---|---|---|---|
| Battering RAM | embargo ended 2025-09-30 (*old*) | Intel Scalable SGX, AMD SEV-SNP, DDR4 | under US$50 (bill of materials US$47.62) | plaintext read and write in SGX enclaves; on SEV-SNP the security processor is made to "attest the modified VM as genuine" [P] (T2) |
| WireTap | 2025, ACM CCS '25 (*old*) | Intel SGX, DDR4, 3rd-generation Xeon Scalable | under US$1,000 with the logic analyzer | the quoting enclave's ECDSA attestation key, from one signing operation; forged quotes accepted by DCAP. Demonstrated against Phala (cluster and master keys), Secret Network (consensus seed), Crust and IntegriTEE [P] (T1) |
| TEE.fail | Intel advisory 2025-10-28, IEEE S&P '26 (*old*) | Intel SGX and TDX, AMD SEV-SNP with ciphertext hiding, DDR5 | under US$1,000 without the logic analyzer | the per-CPU Provisioning Certification Key: "With this key, we can forge attestations from both TDX and SGX", passing at `UpToDate`. Demonstrated against BuilderNet, dstack and Secret Network [P] (T3) |
| DDRop | 2026-09-14, ACM CCS '26 | Intel TDX, Scalable SGX, AMD SEV-SNP, DDR5 | US$159 | drops memory writes: on TDX it forces debug mode, and "the backdoored VM passes remote attestation as if it were the trusted one", in about two minutes by the CSA note; on SEV-SNP it copies victim pages [P][S] (T4, T5) |

All four need physical access to the machine and control of its host software. The TEE.fail page gives Intel's position: interposer attacks are out of the threat model and "there is no current mitigation besides separately ensuring physical security of the TDX-enabled server". AMD "does not plan to publish any updates to their SEV-SNP firmware". On DDRop both vendors say physical attacks on memory are out of scope; no CVE; a lasting fix "would require memory-encryption engines with integrity and freshness". [P] (T3, T4)

What this implies for a referee:

- **A permissionless TEE referee is forgeable.** If any genuine CPU with the right measurement may register, the attacker uses a machine they own. An Ethereum Research post of 2026-05-26 puts it this way: "Without PoE, a TDX attestation from an OVH server is indistinguishable from one produced in an attacker's garage", and "Everyone moved to permissioned. Or was already there." [S] (T6)
- **A permissioned TEE referee is a trusted signer with a longer list of people behind it.** Allow only the operator's machine in a named data center, and a payout can be forged by whoever has hands on that machine (the host, or the operator if it self-hosts), by the CPU vendor's key hierarchy, and by the owner of the verifier contract. Flashbots runs BuilderNet this way, "in a permissioned model", in "approved cloud environments", with IP allowlists (2025-10-28, *old*). [P] (F2)
- **The mitigations on offer are roadmap items.** "Proof of Cloud" is a registry of machines vouched to sit in real data centers; by the Ethereum Research post only its first level, human witnesses, operates. Intel's Platform Ownership Endorsement is under evaluation. Hardware built to resist physical attackers is "years away". [S] (T5, T6)

### 4.5 Verdict on TEE alone

It works, it is cheap per run, and it violates the constraint on three counts: a vendor's key, the custody of one machine, and an upgradeable verifier. It adds a reproducible VM image, measurement pinning, collateral upkeep, key rotation and a hosting account. It removes the prover. For a prize pool, that trades a cryptographic assumption for a physical one in the year physical attacks on it got cheaper.

## 5. Oracle and compute networks that could run the wasm core

### 5.1 Chainlink Functions: gone. Chainlink Runtime Environment: possible, gated, and a signer

- **Functions and Automation are sunset.** Chainlink's documentation index says: "Do not retrieve Chainlink Functions or Chainlink Automation pages. Those products are sunset." The migration guide: "Chainlink Functions has been deprecated (mainnet: June 30, 2026, testnet: June 15, 2026)". Some Chainlink pages give 2026-09-01 (search listing [S]). Both dates have passed. [P] (L1, L6) Its limits and prices no longer matter.
- **CRE** is the successor: a workflow is a wasm binary that every node of a Chainlink DON runs; the DON signs a report, and a forwarder contract delivers it to a receiver contract. [P] (L6, L9)
  - **Can the core run inside?** Yes. TypeScript workflows run in a Javy/QuickJS wasm binary, and since TS SDK 1.6.0 (2026-04-20) a workflow can link "custom Rust logic" built for `wasm32-wasip1`; the guide names proof verification and compute-heavy work as uses. Go workflows are the other SDK. [P] (L5)
  - **Limits (2026-10-29):** execution 5 minutes; memory 100 MB; wasm binary 100 MB; HTTP response 250 KB and request 120 KB; onchain report 50 KB; write gas 10 million; EVM log trigger event at most 5 KB and 10 per 6 s; HTTP trigger 1 per 30 s per workflow; consensus observation 25 KB; 3 workflows per organization. [P] (L2)
  - **Against six journals:** a full run is 49,604 bytes of commit calldata and a typical one 1,604 (`docs/VERIFICATION.md`). A log event cannot carry the journals (5 KB). The workflow would read the commit transaction with `getTransactionByHash`, which returns the transaction's `data`, or fetch it over HTTP, and check it against the stored commitment. Whether a 49.6 KB transaction passes through the read capability I could not verify, and a value passed through consensus is capped at 25 KB. [P for the limits, I for the path] (L2, L4)
  - **Arbitrum One:** supported since CLI 1.0.0; forwarder `0xF8344CFd5c43616a4366C34E3EEE75af79a74482`, 8,591 bytes of code. [P] (L3, C2)
  - **Access and price:** "Deploying workflows to a Chainlink DON requires approval" through an access request that asks for the purpose. Usage is billed in "CRE credits"; "For pricing details, reach out via the in-app support". No public price per execution. [P] (L8, L7)
  - **Trust:** "true multi-node Byzantine Fault Tolerant (BFT) consensus" across node operators. [P] (L9, 2025-11-04, *old*) Forged by a colluding quorum of the DON or by whoever configures the forwarder's signer set. Blocked by Chainlink: access, quotas, price, or another sunset.

### 5.2 Gelato Web3 Functions: shut down

A competitor's migration guide says "Gelato Web3 Functions shuts down on March 31, 2026", covering TypeScript functions, Solidity functions and automated transactions. [S] (G1) Chainlink's "Migrate from Gelato Web3 Functions to Chainlink CRE" is dated 2026-02-16 and describes Gelato as "a single-executor model". [P] (L7) I could not open Gelato's own documentation: it returned an expired certificate to `curl` and HTTP 503 to the fetch tool. Even when live it was one executor, a trusted signer.

### 5.3 Lit Actions

Covered in the table of 4.3. The 2026 product is a hosted TDX enclave, not a threshold network; the Naga-era helpers "that coordinated threshold signing across nodes" are deprecated. [P] (I3) It can run the wasm core for about US$0.01 a run, 9.7 % of the fee, and the Arbitrum contract would trust one address whose key lives in Lit's enclave. Forged by Lit's release multisig, by Phala's host, or by a TDX break. Blocked by Lit.

### 5.4 EigenLayer AVS frameworks

- **WAVS** (Layer): services are WASI components written in Rust, Go, JavaScript or Python. Operators run them and sign; an aggregator submits "the bundled signatures and result payloads as a single transaction" once the quorum set in the service manager is met. The operator set is proof-of-authority (an owner assigns weights, "audited and production-ready") or restaked through EigenLayer or Symbiotic. The documentation mentions v1.0.0; I found no list of chains that names Arbitrum. [P] (W1)
- **Othentic**: a task performer, attesters and an attestation-center contract; RedStone and others run operators on it. I have only search listings; its documentation returned HTTP 503. [S] (W3)
- **EigenLayer multichain verification**, which would carry Ethereum-restaked security to another chain, is "early-access" and "available on testnet in v1.7.0" in the documentation's main branch. [P] (W2)

A framework supplies the plumbing, not the operators. A small team would run the nodes itself, which is a multisig over its own machines, or recruit and pay operators, which is a company-sized task for US$0.10 runs. Forged by a quorum of operators. All of it is the "believed" shape.

## 6. Optimistic oracle: UMA OOv3 on Arbitrum

- **Deployed:** `OptimisticOracleV3` `0xa6147867264374F324524E30C02C331cF28aa879` on Arbitrum One. [P] (U3)
- **Read at block 522,998,188:** `defaultLiveness()` 7,200 s; `defaultCurrency()` is bridged USDC.e; `getMinimumBond` is 500,000,000 for USDC and USDC.e (500 USDC) and 0.11 WETH; the Store's final fee is 250 USDC and 0.055 WETH; `burnedBondPercentage()` is 0.5. [P] (C4)
- **Disputes:** forwarded to UMA's DVM on Ethereum. Stakers vote in rounds, "a 24-hour commit period" then "a 24-hour reveal period", on a fixed schedule; a dispute "must be at least 4 hours old to enter a new voting round"; a round needs 65 % of staked UMA to agree, and votes that miss quorum roll to the next round. So 48 hours at best. [P] (U2, U4)
- **Monitoring:** Risk Labs runs monitoring bots for two integrations, Across on Ethereum and Polymarket and predict.fun on Polygon. Arbitrum is in the "Unmonitored" table. [P] (U1)

Judged here: one assertion per run would lock 500 USDC, 4,833 times the fee, for two hours, and any holder of 500 USDC could delay a payout by two days or more. One assertion per season, over a Merkle root of results, brings the cost per run to nothing, and leaves the final word with a token vote about a number that a 0.04-dollar proof can settle exactly. It is the "believed" shape with a delay. OOv3 has "escalation managers" that can replace the vote with custom logic (documentation index; page not opened); with the zk referee as that logic, UMA would add a 500 USDC bond and nothing else. [I]

## 7. The plain design: a claim that a validity proof can overturn

### 7.1 An operator signature or a season root with no challenge

This is ethblockdigger's `Season`, whose "points still come from an oracle-posted Merkle root", and the design README §7.5 rejects. [P] (S1) One key can pay out. Cost per run: none. It is the baseline of the "believed" shape, and everything in sections 4 to 6 is a more expensive version of it.

### 7.2 Add a window and the proof as the court

Three facts about this game make the optimistic form unusually cheap to trust [P] (S1, S2):

- **The data is already public and bound.** `commitRun` puts the six journals in calldata and stores their commitment. No data-availability question arises.
- **Checking a claim is free.** Native replay of a run takes milliseconds, and the browser already replays journals in wasm. Every player's browser can check every other player's claim.
- **The court exists.** `ZkReferee` verifies a run proof for 227,591 gas, and a proof costs about US$0.04 on Boundless or 9 to 17 hours of a 4-core machine.

The shape [I], of the family that Base's Azul and OP Succinct Lite belong to (B1, B2):

1. A claim: the six Outcomes of a committed run, posted with a bond. **The claimant can be the operator, or the player's own browser**, which computes the Outcomes with the wasm core it already ships. No proof is made.
2. A window. Anyone who replays the run and finds a different result challenges, with a bond.
3. A validity proof decides. Either the challenger proves the true Outcomes, or the claimant must prove the claim and loses by timeout. The second form handles a journal that replay rejects without a guest change, because no proof of an Outcome can exist for it; the first form would need a guest that can prove a rejection, which today's guest cannot ("On zk, no valid proof can exist", README §7.3).
4. The loser's bond pays the proof and the gas. Kailua's README states the rule: "All proving costs are borne by the dishonest party in the protocol". [P] (B3)

What it gives and takes:

- **Forged by** a false claimant, only if no watcher challenges inside the window. The operator's season job already rebuilds and replays every committed run from chain data (`docs/ECONOMY.md`), so it is a watcher by construction, and every browser can be one.
- **Blocked by** a false challenger, for the time it takes to produce a proof, at the price of a bond; by a sequencer that censors for the whole window; and by a pause of RISC Zero's verifier, which stops disputes as it stops settlement today.
- **The window** must be longer than Arbitrum's force-inclusion delay, a `delayBlocks` of 7,200 parent-chain blocks, 24 hours, or a censoring sequencer could run out the clock. [P] (N1) It must also cover a proof: minutes on a prover market, 9 to 17 hours on a CPU. The sibling report arrives at 36 to 48 hours to challenge and about 48 hours to defend, so the season's grace grows from the proposed 48 hours to about 4 days.
- **Cost per verified run:** the settlement overhead and a bond that comes back. With today's `settleRun` calldata that is about 0.0000118 ETH, 23 % of the fee; a path that does not publish the journals a second time would be near 235,000 gas, under 10 % of the fee (the sibling report's estimate, not measured). Proofs: one per dispute, so normally none.
- **Dependencies:** none added, and none removed. The zk stack stays as the court that rarely sits. The Stylus referee, if activations reopen, could be the court instead.
- **Maturity of the pattern:** in production on Base (2026) and on OP Stack chains through OP Succinct Lite. [P][S] (B1, B2) The reference implementation of the RISC Zero variant, Kailua, is "read-only and will receive no further updates, including security fixes". [P] (B3) The contract here would be the project's own and small, and dispute code that never runs is where bugs hide.

### 7.3 The season Merkle root variant

One root per season, posted by the operator, with a window. It saves a storage write per run and costs more machinery [I]:

- **Sums.** The payout divides by the total of qualified points. A plain Merkle root cannot show that the total is the sum of its leaves; that needs a Merkle-sum tree, or totals computed onchain as claims arrive, which is today's `Season`.
- **Uniqueness and omission.** A challenge must be able to show a player listed twice, a player's better run left out, and a run that is not on time, each with its own proof path.
- **Scale.** At a few hundred best runs per season, a claim stored per run costs about one storage slot each, a fraction of a cent. The root pays off at thousands of runs.

Per-run claims reuse `Season`'s accounting unchanged and are the simpler form at this scale.

### 7.4 A TEE or an oracle as the claimant

Base's choice (fact 4). The claim comes from an enclave instead of a browser, and the proof still overrides it. Base does not shorten the window for it: a TEE-only proposal waits the long window, and only TEE and ZK together get one day. [P] (B1) So a TEE in front of a challengeable claim buys a second line of defence if every watcher sleeps, not speed, at the price of everything in section 4. For a game whose claims any browser can check in milliseconds, the watchers are the cheaper second line. It can be added later without changing the first design, because the claimant is just an address.

### 7.5 Gain and loss, in numbers

| | zk every best run (today) | Believed attestation (TEE or oracle alone) | Claim overridable by proof |
|---|---|---|---|
| Cost of one verified run | 0.0000346 ETH, 69 % of the fee | about 0.0000118 ETH, 23.5 %, plus hosting or a per-call price | about 0.0000118 ETH, 23 %; under 10 % with a lean path (estimate) |
| Proofs per season | one per player with a best run | none | one per dispute |
| Time to a final result | hours of proving, inside the grace | seconds | the window: about 2 to 4 days |
| Validity rests on | a proof system | a vendor key and a machine, or node operators | a proof system, plus one live watcher |
| New dependencies | none | TEE host, quote verifier, image pipeline; or an oracle account | none |

## 8. Could the player do it in the browser?

- **A browser cannot produce a hardware attestation of a computation.** No web API exposes an SGX, TDX or SEV quote. WebAuthn attestation certifies an authenticator's key, not what a page computed; app-integrity tokens on phones are issued by Apple's and Google's servers, which is the "believed" shape with a platform vendor as the signer. [I] I did not look for a source that states the negative.
- **A player can rent an enclave.** A Phala `tdx.small` costs US$0.058 an hour, so a player could attest their own run for cents, outside the browser. Under a permissionless TEE referee that is also how a forger would get in (4.4).
- **The browser can make the claim.** It already holds the wasm core, the levels and the journals; computing the six Outcomes takes milliseconds. Under 7.2 that claim, with a bond, is the whole of the player's part, and the wallet's own transaction is the only signature involved. The browser can also check every other player's claim, which is the part that keeps the claims honest.

So within this family the answer to "can the player generate the proof himself in the browser" is: not a proof and not an attestation, but the claim that takes the proof's place in the normal path, and the check that guards it.

## 9. Every option against the same questions

| Option | Constraint | Who can forge a payout | Who can block one | Cost per verified run beyond settlement | New dependencies | Maturity |
|---|---|---|---|---|---|---|
| zk proof per best run (today) | holds | a break of RISC Zero's proof system or setup | the stop's owner (pause); the operator by not proving | 227,591 gas + 0.0000184 ETH: US$0.0475 | none | deployed on testnet |
| Claim + validity-proof override, per run | holds, plus liveness | a false claimant if nobody challenges in the window | a false challenger for a proving time; a sequencer censoring past 24 h; a paused verifier | none normally; a returned bond | none | pattern in production elsewhere; contract to write |
| Season root + override | holds, plus liveness | the operator if nobody challenges | the same, and the operator by not posting | none | none | more to write: sum tree, omission proofs |
| TEE claim + override (Azul shape) | holds, plus liveness | a TEE break and silent watchers together | the TEE host; a false challenger | about 8,000 gas; hosting US$0.06 per hour | TEE host, Automata verifier, image pipeline | in production on Base with Nitro |
| TEE alone (Automata DCAP + TDX) | violated | whoever has hands on an accepted machine; the vendor's keys; Automata's owner key | the host; a TCB recovery; the verifier's owner | about 8,000 gas; registration 4 M gas or 0.5 M + proof | the same | parts deployed on Arbitrum; assembly is custom |
| Rented attested compute (Lit v3, Marlin, EigenCompute, ROFL) | violated | the service's operator or release key; its host; a TEE break | the service | Lit: US$0.01; others unpublished | an account and a vendor API | Lit live since 2026-04; EigenCompute alpha; Marlin's Arbitrum relay nearly idle |
| Chainlink CRE workflow | violated | a quorum of the DON; the forwarder's configurer | Chainlink: access, quotas, price, sunset | unpublished | CRE account, CLI, SDK, receiver contract | active, access by request |
| AVS committee (WAVS, Othentic) | violated | a quorum of operators | the same quorum | operator fees | an operator set to recruit or run | frameworks exist; no operators come with them |
| UMA OOv3 | violated | UMA voters, or a wrong assertion nobody disputes in 2 h | anyone with 500 USDC, for 48 h or more | a 500 USDC bond locked per assertion | UMA contracts, an L2 to L1 dispute relay | deployed; unmonitored on Arbitrum |
| Operator signature or root, no challenge | violated | the operator's key | the operator | none | none | trivial |
| Chainlink Functions, Gelato Web3 Functions | not applicable | | | | | sunset in 2026 |

## 10. Ranked view

1. **A per-run claim that a validity proof can overturn, with the player's browser or the operator as claimant.** The only attestation form that keeps the constraint. No new dependency, proofs only on dispute, cost per verified run from 69 % of the fee to 23 % or lower. It costs a longer grace, bonds, and a liveness assumption the specification chose against in §7.3 ("it is proven rather than disputed"), so it is the owner's call.
2. **Today's proof per best run.** Stronger than 1 by the liveness assumption, and already built. It stays as the fallback and as the court.
3. **The season Merkle root with the same override.** The same trust as 1 with more code. Worth it only at thousands of verified runs.
4. **A TEE as claimant in front of 1.** Defence in depth at the price of a second stack. Not before 1 exists, and not obviously ever at this scale.
5. **A TEE alone.** Cheap, fast, and it violates the constraint on a vendor's key, one machine's custody and an upgradeable verifier, in the year DDRop made forging a TDX attestation a US$159 job.
6. **Rented attested compute and Chainlink CRE.** The same violation, plus a vendor that can change terms. CRE is the most capable of them and the least open: approval to deploy, no public price.
7. **An AVS committee, UMA, a bare operator signature.** A committee nobody would staff, a bond 4,833 times the fee, and the design the specification already rejected.

## 11. What I could not verify

- Any Arbitrum-specific gas measurement of Automata's DCAP verification; the 4 to 5 million and 493,000 to 522,000 figures are the README's, chain not stated.
- Who holds the key of Automata's owner address on Arbitrum One (it is a plain account, not a multisig contract), and whether the versioned quote verifiers can be pinned without the owner's entrypoint.
- The price of a zk-wrapped DCAP quote proof on Boundless or Succinct's network; the only figure found is Espresso's US$0.13 for a Nitro attestation in January 2026.
- Chainlink CRE's price per execution, the size of its DONs, and whether `getTransactionByHash` returns a 49.6 KB calldata within its limits.
- Gelato's own statement of the Web3 Functions shutdown: its documentation failed TLS and returned 503; the date comes from a competitor.
- The exact Chainlink Functions sunset date: Chainlink pages give 2026-06-30 and 2026-09-01.
- Whether Marlin Oyster Serverless can instantiate a wasm module in `workerd`, and its price per request; Marlin's page dates.
- Oasis ROFL's mainnet machine prices, and any onchain verifier of ROFL attestations on Arbitrum.
- Othentic's current state: only search listings; its documentation returned 503.
- Any SEV-SNP quote verifier deployed on Arbitrum.
- The dates of the EigenCompute documentation files (read from the repository's main branch; the hosted site returned 403) and whether its promotional pricing still applies.
- The OpenZeppelin audit of Flashtestations (listed as 2026-06-26 in search results; not opened), and the exact Base Azul mainnet date (reports give 2026-05-21 to 2026-05-29).
- That no browser API can attest a computation: stated from knowledge of the platform, not from a source.
- The sibling report's contract design and its window and gas estimates, which section 7 quotes.
- UMA's "Escalation Managers" page, and the WAVS documentation beyond its first 100,000 characters, which were not read.

## 12. Sources

Repository (read-only, at `the repository root`):

- **S1** `README.md` §3, §6.4, §7.1 to §7.5, §8.4, §10. [P]
- **S2** `docs/VERIFICATION.md`: "zk costs", "Challenge gas", "Settlement gas", "D2: the backend", measured 2026-11-02. [P]
- **S3** `docs/ECONOMY.md` §2 and §3, rows "zk prover trust" and "the operator is in practice the only prover". [P]

Contract reads and probes, 2026-11-10, public RPC endpoints `https://arb1.arbitrum.io/rpc` and `https://sepolia-rollup.arbitrum.io/rpc` [P]:

- **C1** Arbitrum One block 522,996,833: base fee 0.02011 gwei. ETH price: `https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd` (2,068.49) and `https://api.coinbase.com/v2/prices/ETH-USD/spot` (2,069.345), 13:58 UTC.
- **C2** `eth_getCode` of `0xaDdeC7e85c2182202b66E331f2a4A0bBB2cEEa1F` (8,747 bytes) and `0xaf2a0D5473062b36E2dE986DA09d945EB26d492B` (13,475 bytes) on both chains; `owner()` and `getBp()` of the former on Arbitrum One, and `eth_getCode` (empty) and `eth_getTransactionCount` (168) of that owner; `eth_getCode` of the CRE forwarder `0xF8344CFd5c43616a4366C34E3EEE75af79a74482` (8,591 bytes).
- **C3** P-256 precompile probe at `0x0000000000000000000000000000000000000100`: valid signature returns 1, corrupted returns empty; `eth_estimateGas` 32,813 against 25,899 for the same calldata to a plain address on Arbitrum One, 30,787 against 23,873 on Sepolia.
- **C4** UMA `OptimisticOracleV3` `0xa6147867264374F324524E30C02C331cF28aa879` and Store `0x2d6FAD39059f5FCe80bFf691F8f0Bb30D5d4f214` on Arbitrum One, block 522,998,188.
- **C5** `eth_getLogs` for the Marlin Relay `0xD28179711eeCe385bc2096c5D199E15e6415A4f5` and Subscription Relay `0x8Fb2C621d6E636063F0E49828f4Da7748135F3cB` over the 52 million blocks before 522,997,558.

TEE verification onchain:

- **A1** Automata DCAP Attestation README. `https://github.com/automata-network/automata-dcap-attestation` (main; file date unknown). [P]
- **A2** Release note v1.1. `https://github.com/automata-network/automata-dcap-attestation/blob/main/releases/v1.1/NOTE.md` (date unknown). [P]
- **A3** Deployment list. `https://github.com/automata-network/automata-dcap-attestation/blob/main/rust-crates/libraries/network-registry/deployment/current/DEPLOYMENT.md` (date unknown). [P]
- **A4** `evm/contracts/AttestationEntrypointBase.sol` and `AutomataDcapAttestationFee.sol`, same repository, main. [P]
- **F1** Flashtestations README. `https://github.com/flashbots/flashtestations` (main; date unknown). [P]
- **F2** Flashbots, "Why TEE.fail is bullish for BuilderNet", 2025-10-28 (*old*). `https://collective.flashbots.net/t/why-tee-fail-is-bullish-for-buildernet-hardening-the-path-to-permissionless-blockbuilding/5349` [P]
- **M4** Marlin, "On-chain verification of AWS Nitro Enclave attestations", 2024-04-11 (*old*). `https://blog.marlin.org/on-chain-verification-of-aws-nitro-enclave-attestations` [P]
- **X1** Espresso, "ZK Attestation Verification" (prices of 2026-01-08). `https://docs.espressosys.com/network/concepts/rollup-developers/integrating-an-optimistic-rollup/zk-attestation-verification` [P]
- **N2** Arbitrum forum, ArbOS 31 "Bianca" and ArbOS 50 "Dia" proposals (search listing; not opened). `https://forum.arbitrum.foundation/t/aip-arbos-31-bianca-activation-of-arbitrum-stylus-rip-7212-support-nova-fee-router-proposal/25904`, `https://forum.arbitrum.foundation/t/constitutional-aip-arbos-version-50-dia/29835` [S]

TEE breaks:

- **T1** WireTap. `https://wiretap.fail/` (2025, ACM CCS '25; *old*). [P]
- **T2** Battering RAM. `https://batteringram.eu/` (embargo to 2025-09-30; *old*). [P]
- **T3** TEE.fail. `https://tee.fail/` (Intel advisory 2025-10-28, IEEE S&P '26; *old*). [P]
- **T4** DDRop. `https://ddropattack.eu/` (coordinated disclosure 2026-09-14, ACM CCS '26). [P]
- **T5** Cloud Security Alliance, research note on DDRop, 2026-09-16. `https://labs.cloudsecurityalliance.org/research/csa-research-note-ddrop-confidential-computing-trust-2026091/` [S]
- **T6** "Physical integrity, attestation, and the state of permissionless TEEs", Ethereum Research, 2026-05-26. `https://ethresear.ch/t/physical-integrity-attestation-and-the-state-of-permissionless-tees/24964` [S]

TEE hosts:

- **P1** Phala Cloud pricing. `https://phala.com/pricing` (© 2026; no date). [P]
- **P2** dstack README. `https://github.com/Dstack-TEE/dstack` (date unknown). [P]
- **P3** Phala, "Chain of trust". `https://docs.phala.com/phala-cloud/attestation/chain-of-trust` (no date). [P]
- **P4** Phala's response to the DDR5 attack, 2025-10-28 (*old*). `https://phala.com/posts/phala-ddr5` [P]
- **E1** EigenCompute overview. `https://github.com/Layr-Labs/eigencloud-docs/blob/main/docs/eigencompute/get-started/eigencompute-overview.md` (date unknown; hosted at `docs.eigencloud.xyz`, which returned 403). [P]
- **E2** EigenCompute billing. `https://github.com/Layr-Labs/eigencloud-docs/blob/main/docs/eigencompute/get-started/billing.md` (date unknown). [P]
- **E3** EigenCompute security and trust model. `https://github.com/Layr-Labs/eigencloud-docs/blob/main/docs/eigencompute/concepts/security-trust-model.md` (date unknown). [P]
- **M1** Marlin contract addresses. `https://docs.marlin.org/oyster/contracts` (© 2026; no date). [P]
- **M2** Marlin serverless protocol and limits. `https://docs.marlin.org/oyster/protocol/serverless/` and `.../smart-contract-requests/workflow/request-response-lifecycle` (no date). [P]
- **M3** Marlin, smart contract request execution. `https://docs.marlin.org/oyster/build-serverless/quickstart/execute_web3` (no date). [P]
- **O1** Oasis ROFL. `https://docs.oasis.io/build/rofl/` (updated 2026-07-24). [P]
- **O2** Oasis, cross-chain key generation. `https://docs.oasis.io/build/use-cases/key-generation` (updated 2026-09-11). [P]
- **O3** Oasis ROFL deploy workflow. `https://docs.oasis.io/build/rofl/workflow/deploy` (updated 2026-07-24). [P]
- **O4** ROFL mainnet launch, press release of 2025-07-02 (search listing; *old*). `https://dailyhodl.com/2025/07/02/oasis-protocol-foundation-launches-rofl-mainnet-verifiable-off-chain-compute-framework-powering-ai-applications/` [S]
- **I1** Lit, architecture and verification. `https://developer.litprotocol.com/architecture/index.md`, `https://developer.litprotocol.com/architecture/verification/index.md` (no date). [P]
- **I2** Lit, pricing and limits. `https://developer.litprotocol.com/management/pricing.md`, `https://developer.litprotocol.com/lit-actions/limits.md` (no date). [P]
- **I3** Lit, WebAssembly and the migration from Naga. `https://developer.litprotocol.com/llms-full.txt` (no date). [P]
- **I4** Lit blog: "Now Live: Lit Protocol V1", 2026-01-20, `https://spark.litprotocol.com/v1-live/`; "Lit V3 Is Live", 2026-04-01, `https://spark.litprotocol.com/lit-v3-is-live-confidential-compute-and-key-management-in-one-api/`. [P]

Oracle and compute networks:

- **L1** Chainlink documentation index. `https://docs.chain.link/llms.txt` (no date). [P]
- **L2** CRE service quotas, updated 2026-10-29. `https://docs.chain.link/cre/service-quotas` [P]
- **L3** CRE supported networks, updated 2026-10-19, and forwarder directory, updated 2026-09-18. `https://docs.chain.link/cre/supported-networks-ts`, `https://docs.chain.link/cre/guides/workflow/using-evm-client/forwarder-directory-ts` [P]
- **L4** CRE EVM client reference, updated 2026-09-18. `https://docs.chain.link/cre/reference/sdk/evm-client-ts` [P]
- **L5** CRE custom Rust plugins, updated 2026-04-20. `https://docs.chain.link/cre/guides/operations/custom-rust-plugins-ts` [P]
- **L6** "Migrate from Chainlink Functions to Chainlink CRE", updated 2026-05-11. `https://docs.chain.link/cre/reference/clf-migration-ts` [P]
- **L7** "Migrate from Gelato Web3 Functions to Chainlink CRE", updated 2026-02-16, with the pricing note. `https://docs.chain.link/cre/reference/gelato-migration-ts` [P]
- **L8** CRE deploying workflows, updated 2026-05-12; requesting deploy access, updated 2026-10-09; release notes to CLI 1.39.0, 2026-10-21. `https://docs.chain.link/cre/guides/operations/deploying-workflows`, `https://docs.chain.link/cre/guides/operations/deploy-access`, `https://docs.chain.link/cre/release-notes` [P]
- **L9** CRE consensus computing, updated 2025-11-04 (*old*). `https://docs.chain.link/cre/concepts/consensus-computing` [P]
- **G1** KeeperHub, "Migrate from Gelato Functions" (no date; a competitor). `https://docs.keeperhub.com/guides/gelato-migration` [S]
- **W1** WAVS documentation. `https://docs.wavs.xyz/llms-full.txt` (no date; first 100,000 characters read). [P]
- **W2** EigenLayer multichain verification overview. `https://github.com/Layr-Labs/eigencloud-docs/blob/main/docs/eigenlayer/developers/concepts/multichain/multichain-overview.md` (date unknown). [P]
- **W3** Othentic: RootData profile (updated 2026-08-31) and RedStone's operator guide, search listings only. `https://www.rootdata.com/projects/detail/othentic?k=MTEwMzc%3D`, `https://docs.redstone.finance/docs/avs/running-avs-operator-mainnet` [S]

UMA:

- **U1** UMA network information. `https://docs.uma.xyz/resources/network-addresses` (no date). [P]
- **U2** "How does UMA's oracle work?" `https://docs.uma.xyz/protocol-overview/how-does-umas-oracle-work` (no date). [P]
- **U3** UMA contract addresses for chain 42161. `https://github.com/UMAprotocol/protocol/blob/master/packages/core/networks/42161.json` (date unknown). [P]
- **U4** UMA DVM 2.0 and bond and liveness guidance. `https://docs.uma.xyz/using-uma/voting-walkthrough/dvm-2.0`, `https://docs.uma.xyz/developers/setting-custom-bond-and-liveness-parameters` (no date). [P]

Claims overridable by proof:

- **B1** Base, Azul proof system specification, with the Beryl note. `https://docs.base.org/base-chain/specs/upgrades/azul/proofs` (no date). [P] Succinct, "Base Adds ZK Proofs to Base Azul with SP1", 2026-05-04. `https://blog.succinct.xyz/base-sp1/` [S]
- **B2** Celo forum, OP Succinct Lite on mainnet and its 2026-05-26 upgrade (search listing; not opened). `https://forum.celo.org/t/jello-hardfork-successfully-activates-on-mainnet-introducing-op-succinct-lite/12754` [S]
- **B3** Kailua README, with the read-only notice and audits to 2026-02-12. `https://github.com/boundless-xyz/kailua` (date unknown). [P]
- **N1** Arbitrum, "The Sequencer and censorship resistance". `https://docs.arbitrum.io/how-arbitrum-works/sequencer` (© 2026; no date). [P]
