# Review of doc-rev40.md: decision-readiness for the owner

Reviewer angle: can the owner act tomorrow, and can a third party trace each decision?
Sources opened: the report (all 585 lines); escrow/final.md; report/compute_out.md, cloud-check.md, cloud.md (always-on rows); research/ethproofs-leaders.md; audit/cost.md, audit/ops.md; repo IMPLEMENTATION_PLAN.md §1 and §10 (M5.5); README §7.3, §7.5; docs/DEPLOYMENT.md §3-4; docs/VERIFICATION.md 694-712, 960-990; contracts/src/Season.sol 40-46, 185-222; contracts/test/fixtures/zk-run.json; CLAUDE.md.

## Owner questions, where they are answered

| # | Question | Where | Plain answer? |
|---|---|---|---|
| 1 | Lighter / browser proof | §1 bullet 3, §5 | Yes |
| 2 | Per-level proof | One row of §5 table; §7 step 2 | Thin; absent from §1. Step 2 says "kept only as a dispute tool" though the dispute design was dropped |
| 3 | Ethproofs as reference | §6 last paragraph; §7 step 3 | Yes, but the 2-7 s figures are warm STARK only, no EVM wrap (ethproofs-leaders.md:13, :266), not said |
| 4 | Cloudflare paid service | §6 row K; §7 step 4 | One table row; no working note behind it; absent from §13 and §14 |
| 5 | Escrow, RTX 3060, competition | §8 | Yes |
| 6 | RTX 5060 Ti; MEV front-running | Decision 7; front-running only in §7 step 6 | Front-running never answered in §8 in plain words |
| 7 | MCP, x402, cloud benchmark | §9, §10 | Yes; but MCP recommendation has no work item |

## Findings (most severe first)

D1 high. Decision 5's gate and §10 step 3 ask to prove "a human-style run". No six-level human run file exists: only two human level journals (audit/cost.md:257; docs/ECONOMY.md:136). Item 1 says "one whole real run", undefined. final.md item M5.8 names contracts/test/fixtures/zk-run.json (16 segments, 15.4M user cycles, VERIFICATION.md:988), which is human-style size. Name the files and a numeric threshold.

D2 medium. "Now" decision 4 depends on the measurement: item 2 "Replace 'about an hour' with measured times"; item 3 "on the measured route". And the OS question gates decision 2 but sits after the table.

D3 medium. Summary "6 to 17 hours per run" and F3 "a few tens of runs per season" use bot journals. The report's own human-style CPU time is 1.4 to 2.4 h (§11); repo proofs took 1.25 h and 2.1 h (DEPLOYMENT.md:177; VERIFICATION.md:988). F1 "real runs need 67 to 131" contradicts §3 "15 to 18 million" (about 16 segments).

D4 medium. Front-running (owner question 6) answered only in §7 step 6. §8 never states the threat model (no public mempool; reverted claim or eth_estimateGas exposes the proof, spec.md:49; re-randomized seal).

D5 medium. Decision 9 recommends building the MCP wrapper; §14 has no work item for it. §9's third step (remote endpoint) dropped from decision 9. Cloudflare "request API and queue" (row K) also has no item and no decision.

D6 medium. Decision 8 reads "AWS and Compute Engine only if a large vendor's invoice is required, and then Cloud Run". §10 ranking recommends spot L4 VMs on Google or AWS for a vendor invoice, §10 lead recommends Cloud Run. Contradictory.

D7 medium. "only if bounties get a deadline", "Bounties served within 10 minutes", "A bounty deadline must scale": ProofBounty has no deadline (final.md §2; refund only at settlement end). Undefined term, no decision.

D8 medium. Decision 5 silently approves "a grace period of at least seven days". Grace is a season parameter owned by seasons/*.json (CLAUDE.md) and derived from the proving route in M5.5 (plan line 2001, round G2). final.md kept it as a separate decision O4.

D9 medium. §14 ignores plan §1.1: no M5.x ids, sizes, dependencies or "Needs user"; final.md §6 had them (M5.8-M5.14). Item 3 does not name M5.5. Item 2 omits plan M5.5's Boundless text (plan:1997). Item 5 omits regenerating contracts/abi/ (CLAUDE.md sync table).

D10 medium. F4 (High) has no decision: a stop gives the settled players the whole pot (Season.sol:194-218). §12 says "decide whether to pin an own verifier"; §13 decision 12 does not list it.

D11 low. Decision 6 "Yes" to a core/src rewrite on the evidence of 75 vectors only. The core is the referee; property suite and differential fuzzing (M1.10, M1.13) not run.

D12 low. "The cheapest costs 245 USD per month": compute_out.md shows Vast 5060 Ti 103 and Vast 3090 165 USD per month always on.
