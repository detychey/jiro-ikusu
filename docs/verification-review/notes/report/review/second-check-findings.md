# Second check of the corrected report (2026-11-11)

Three checkers read the corrected report after the 40 findings of the first review were applied. Their findings are below. All were applied to the report, except where a note says otherwise.

## check:fixes

Verdict: 39 of the 40 findings are fixed correctly. I checked the new numbers against the sources and they hold: the CPU hours, F3's capacity, the whole-PC electricity, the 250 to 600 bounties, the 13 to 15% aggregation figure, the 1.1 to 1.3 h on an L4, the M5.8 ids, --reverse and ci:heavy. K26 is fixed in the text, but the archive sent to the owner lacks report/, so the Cloudflare arithmetic it relies on cannot be checked. The other problems are small. A few figures were not moved to the new whole-PC basis or to the new definitions. The cap's justification is weak. Two leftover wordings could mislead. No finding changes a decision.

Checked: I read the whole of doc-rev101, the diff, kept-findings.md and recompute.py (and ran it). In the repository I opened VERIFICATION.md :700-712, :775-784, :940-944 and :984-992, DEPLOYMENT.md :173-180 and :243-253, README :609, :711-712 and :854, the plan's M5 table and :2011, and check-rules-version.sh. I grepped the workflows for ci:heavy. In the notes I opened escrow/final.md, spec.md :49-55 and :245-251, redteam-ordering.md :26-32 and redteam-implementation.md :20-26. I also checked audit/cost.md, consistency.md :85, ops.md :11, ux.md :385, design-resume.js :20, report/cloudflare.md, agents-check.md, bundle/README.md and the contents of verification-review-notes.tar.gz. My notes are in review2/fixes.md.

### R1 [medium] 15. Appendix C (Working notes)

- Quote: The research notes for sections 9 and 10, their fact-checks, the script behind the cost table, the Cloudflare arithmetic, and the review of this report
- Problem: The archive the appendix says was sent to the owner has no report/ folder. Its agents, cloud, recompute.py, cloudflare.md and review files are all missing from it. Row K's cost figure (K26) and sections 9 and 10 therefore cannot be re-checked from the notes the owner holds.
- Evidence: `tar tzf verification-review-notes.tar.gz` (dated 10 Nov 16:12) lists only README.md, audit/, escrow/, optimistic/ and research/. report/cloudflare.md says it was written on 11 November. bundle/README.md describes report/, but the archive was not rebuilt.
- Fix asked: Rebuild the archive from bundle/ with report/ included and send it again. Then add to Appendix C: 'The archive was sent again on 11 November with the report/ folder.'

### R2 [low] 10. The two home cards

- Quote: Against renting, the RTX 5060 Ti pays for itself only after tens of thousands of runs (estimate).
- Problem: The break-even still uses electricity for the card alone, but the home rows now count the whole PC. On the whole-PC basis, the saving against a marketplace card is close to zero, so the card may never pay for itself.
- Evidence: recompute.py:33 uses e1e8 = 0.0063 USD, the card alone. Whole PC: 0.0074 to 0.0137 USD per run. Against a RunPod 4090 (0.012 to 0.016) the saving is 0 to 0.008 USD, so 86,000 runs or never. Against a Vast 5090 (0.020) it is 0.0065 to 0.0128 USD, so 54,000 to 138,000 runs for 692 to 896 USD.
- Fix asked: Against renting, the RTX 5060 Ti saves at most about one cent of power per run. It pays for itself after about 50,000 runs at best, and never against the cheapest marketplace cards (estimate).

### R3 [low] 8. Escrow rules (cap row)

- Quote: Four, not two, because a heavy run on the RTX 3060 may cost more than two fees of power (estimate)
- Problem: 'Heavy run' is undefined. The report's own figures show that the cost-maximising run on the RTX 3060 also costs more than four fees, so the reason suggests that four fees is enough when it is not.
- Evidence: Section 10: 4.5 to 10 h on the RTX 3060. At 170 W x 1.5 to 1.8 and 0.25 EUR per kWh: 0.29 to 0.77 EUR, which is 0.32 to 0.86 USD, or 3 to 8 run fees (fee 0.1025 USD). Even the card alone gives 2.1 to 4.6 fees.
- Fix asked: Four, not two, leaves room for slow runs on the RTX 3060 (estimate). The cost-maximising run can still cost more than four fees of power there.

### R4 [low] 11. Economics (cost table)

- Quote: | Proving on a home card | under 0.01 EUR of electricity | 0.01 to 0.03 EUR | estimate, whole PC |
- Problem: On the whole-PC basis, the planned card costs from 0.007 EUR per bot-style run. Section 10 gives 0.007 EUR, so this cell disagrees with it.
- Evidence: recompute.py: 5060 Ti at 1.5x is 0.0066 EUR, 3060 at 1.8x is 0.0279 EUR. Section 10 table: '0.010 to 0.028 EUR | 0.007 to 0.012 EUR'.
- Fix asked: | Proving on a home card | under 0.01 EUR of electricity | 0.007 to 0.03 EUR | estimate, whole PC |

### R5 [low] 10. Estimated proving time by card (L4 row)

- Quote: | L4 | 24 GB | 2.4 to 2.7 min | 27 to 30 s | One third-party measurement of another program |
- Problem: K3 was fixed for the RTX 5090 row only. The L4 time for this guest is scaled in the same way, but its basis still reads like a direct measurement.
- Evidence: recompute.py:10 applies a factor of 1.67 to 1.86 to the RTX 5090 reference for the L4. Section 10, Not verified: 'The L4 figure assumes that one third-party measurement carries over.'
- Fix asked: | L4 | 24 GB | 2.4 to 2.7 min | 27 to 30 s | Estimate from a third-party measurement of another program |

### R6 [low] 10. Measuring before choosing (step 3)

- Quote: prove a human-style and a bot-style run three times
- Problem: K5 was fixed in decision 5, item 1 and section 12, but not here. No six-level human-style run file exists, so this step cannot be done as written.
- Evidence: audit/cost.md:257: only two human level journals exist. Decision 5 and item 1 now name contracts/test/fixtures/zk-run.json, which has 16 segments and 15.4 million user cycles (VERIFICATION.md:988).
- Fix asked: prove `zk-run.json` and one whole bot run three times

### R7 [low] 8. Residual risks

- Quote: Every tool settles a funded run through `claim`; the refund opens after 7 days
- Problem: The text does not say what the 7 days count from. A reader may count them from the outside settlement. The refund opens 7 days after settlement closes, which can be weeks later.
- Evidence: escrow/final.md:54: refund when 'settled and unclaimed after settlementEnd + CLAIM_GRACE (7 days)'. Escrow rules row: 'Refund of an unclaimed bounty 7 days after settlement closes'.
- Fix asked: Every tool settles a funded run through `claim`. The depositor gets a refund 7 days after settlement closes.

### R8 [low] 2. Scope, method and evidence labels

- Quote: A usage limit cut off one of the three red-team reviewers of the optimistic designs, and their final judge.
- Problem: Section 12 says only that the judge 'was not run'. The notes show that no judge report exists, but not that a usage limit was the cause. K31 itself noted this was not confirmed.
- Evidence: design/ holds no judge.md (design-resume.js:183 names it). redteam-implementation-work/ has no report. Section 12: 'the final judge was not run'.
- Fix asked: A usage limit cut off one of the three red-team reviewers of the optimistic designs. Their final judge was not run.

## check:consistency

Verdict: The corrected report holds together. Most recurring numbers agree. The renumbered decisions (1-15) and work items (1-10) are cross-referenced correctly, and the counts in lead sentences match their lists. No high-severity problem remains. Two medium issues affect key figures. The summary and decision 11 say settling "a run" costs a quarter of its fee, but that is true only for a human-style run. The bot-style bounty floor is also below the report's own arithmetic. The rest is low: the rationale for the cap, F3 against the advice to settle during the season, terms left from before the edits, a non sequitur in work item 1, and a few labels.

Checked: Read all of doc-rev101.md, the diff, and kept-findings.md. Ran recompute.py. Checked escrow/spec.md (cost table), escrow/final.md (C3, C4), redteam-implementation.md and redteam-ordering.md, audit/cost.md, design/redteam-liveness.md, research/proof-services.md, arbitrum-native.md and cloudflare.md, plus the archive contents. In the repo: VERIFICATION.md lines 405, 745, 778, 917-943 and 986-990, DEPLOYMENT.md lines 150, 173-196 and 245-252, Season.sol (MAX_GRACE, rake), the M5 table of IMPLEMENTATION_PLAN.md, ci:heavy in the workflows, check-rules-version.sh --reverse, and README 7.3, 7.5 and D2. Notes: scratchpad/report/review2/consistency.md

### C1 [medium] 1. Summary; 13 (decision 11)

- Quote: Settling a run costs about a quarter of its fee in gas on Arbitrum One, above the 20% rake cap (estimate).
- Problem: The quarter holds only for a human-style run. Section 11 puts a bot-style run at 45 to 51% of the fee. The summary and decision 11 ('settling a run costs about a quarter of its fee in gas') state the lower bound as the general case, so they understate the gap the owner must close.
- Evidence: doc-rev101.md:404, 'Same, in ETH' row: human 25 to 27%, bot-style 45 to 51%. escrow/spec.md:471-472: human claim 0.0000123 to 0.0000136 ETH, 25 to 27%; bot-style (gate-set journals) 0.0000225 to 0.0000253 ETH, 45 to 51%. Decision 11 at doc-rev101.md:481 repeats 'a run'.
- Fix asked: Summary: 'Settling a run costs a quarter to a half of its fee in gas on Arbitrum One, above the 20% rake cap (estimate).' Decision 11: 'Economics: settling a run costs 25 to 51% of its fee in gas, above the 20% rake cap'.

### C2 [medium] 9. What a third-party agent needs to earn

- Quote: about 0.06 USD for a bot-style run (estimate)
- Problem: This understates the report's own numbers. Bot-style claim gas is 45 to 51% of a 0.1025 USD fee. Section 11 puts proving on a rented RTX 5090 at about 0.02 USD. Withdrawal adds 0.002 USD. A prover paid 0.06 USD loses money. The earlier text said 0.05 to 0.07, and this edit was not one of the kept findings.
- Evidence: 0.45 x 0.1025 = 0.046 and 0.51 x 0.1025 = 0.052 USD of gas (s11, line 404). GPU time is 0.017 to 0.020 USD (s10 table, RunPod and Vast RTX 5090). Withdrawal is 0.002 USD (s9 table). Total: 0.065 to 0.074 USD. The human-style figure checks: 0.026 to 0.028 + 0.003 to 0.004 + 0.002 = 0.031 to 0.034.
- Fix asked: '...and about 0.07 USD for a bot-style run (estimate).'

### C3 [low] 8. Escrow rules (cap row)

- Quote: Four, not two, because a heavy run on the RTX 3060 may cost more than two fees of power (estimate)
- Problem: By the report's own figures, the only run that costs more than two fees of power on the RTX 3060 is the cost-maximising run, and it also costs more than four fees. Bot-style and cautious runs cost far less than two fees. A reader would think four fees covers heavy runs. Section 9 already says the cost-maximising run exceeds the cap.
- Evidence: recompute.py: RTX 3060 at 1.5 to 1.8 times rated power costs 0.0101 to 0.0279 EUR per 100 million cycles. Times 29 for 2.9 billion cycles that is 0.29 to 0.81 EUR, or 0.33 to 0.91 USD. Two fees are 0.205 USD and four fees 0.41 USD. A bot-style run costs 0.011 to 0.031 USD (s10).
- Fix asked: 'Four, not two, leaves room above a bot-style run. The cost-maximising run can cost 0.3 to 0.9 USD of power on the RTX 3060, more than the cap (estimate).'

### C4 [low] 4. F3

- Quote: Best runs are final only at the season's end, so proofs fall in the grace period.
- Problem: This says all proving must happen in the grace period. Other parts of the report recommend settling during the season: the residual risks (s8), the 1,000-run ranking ('proving through the season, as runs are committed', s10) and the liveness risk (s12). The two passages contradict each other.
- Evidence: doc-rev101.md:95 (F3). Lines 205, 365 and 448 recommend settling during the season. A run can be settled before the deadline. Only knowing which run is best has to wait until the season ends.
- Fix asked: 'A player's best run is known only at the season's end. A prover that settles only best runs therefore works in the grace period.'

### C5 [low] 14. Proposed work plan (closing line)

- Quote: Before any mainnet season: the lock with a stake, a deeper contract review, and an answer to the economics of section 11.
- Problem: Section 13 lists five mainnet decisions: economics, the lock, vendor risk, unbounded replay cost, and reviews including the legal review. This line names only three of them and reads as the complete list.
- Evidence: doc-rev101.md:453: 'five must be settled before any mainnet season'. Decisions 11 to 15 are at lines 481-485, and decisions 13 and 14 and the legal review are missing from line 504.
- Fix asked: 'Before any mainnet season: decisions 11 to 15 of section 13. These are the economics, the lock with a stake, the vendor risk, the bound on replay cost, and the contract and legal reviews.'

### C6 [low] 14. Proposed work plan (item 1)

- Quote: The lockfile change forces a clean CI build of about an hour, so the pull request goes without the `ci:heavy` label.
- Problem: The sentence gives no real reason, so it reads as a non sequitur. The source's reason is that the month's Actions minutes were almost used up. A long clean build plus the heavy jobs triggered by ci:heavy would exhaust them.
- Evidence: escrow/redteam-implementation.md:23: the clean zk-exec build took '62 min 35 s on a 2-vCPU runner [repo], while this month's Actions minutes were at about 1,460 of 1,500 [repo]'. In .github/workflows/*.yml, ci:heavy triggers the e2e, nightly, zk-prove and stylus-gas jobs.
- Fix asked: 'The lockfile change forces a clean CI build of about an hour. This month's Actions budget was nearly spent, at about 1,460 of 1,500 minutes. So the pull request goes without the `ci:heavy` label.'

### C7 [low] 4. F6

- Quote: They do not clear a level as scripted.
- Problem: The edit made the subject singular ('A cost-maximising run ... costs'), so 'They' has no antecedent. It is unclear whether the run or its journals fail to clear.
- Evidence: diff lines 98 and 101: the old subject was 'Scripted journals of one-cell captures', and the new one is 'A cost-maximising run'.
- Fix asked: 'Its journals do not clear a level as scripted.'

### C8 [low] 12. Risks and what is not verified

- Quote: The worst-case journal on a real zkVM
- Problem: The edits renamed this run 'the cost-maximising run' everywhere else (F6, s9, s10, decision 14). This row still uses the old term. It also implies a true worst case, which the report does not claim, since the 2.9 billion comes from one scripted policy.
- Evidence: doc-rev101.md:439, compared with lines 98, 250, 286, 339, 352 and 484. design/redteam-liveness.md:58 gives a 'true bound about 0.76 billion' per level, above the scripted figure.
- Fix asked: 'The cost-maximising run on a real zkVM'

### C9 [low] 10. Cloud hosting benchmark

- Quote: Every proving time is an estimate, scaled from one third-party measurement of another program on an RTX 5090.
- Problem: The next bullet and the card table contradict this. The L4 uses its own third-party measurement and the RTX 4090 uses third-party logs. The L4 row's basis also omits the word estimate, though its times are estimates for this guest. In section 5, the circuit row labelled 'measured' contains a sizing-model estimate.
- Evidence: doc-rev101.md:266 ('The L4 uses a third-party measurement of its own') and 276-279 (RTX 4090 'third-party logs'; L4 basis 'One third-party measurement of another program'). Line 114 has the 109 to 187 million gates figure under 'measured', but App A line 524 says 'the run size is a sizing model'.
- Fix asked: s10: 'Every proving time is an estimate, scaled from third-party measurements of other programs.' L4 basis: 'Estimate from one third-party measurement of another program'. s5 circuit row label: 'measured, estimate'.

### C10 [low] 10. Cost per proof; 1. Summary

- Quote: Google Cloud Run, zonal redundancy off
- Problem: Zonal redundancy is never explained. Yet it sets the price and the quota, and the cautions and section 10 rest on it. The summary also uses 'qualified', 'rake' and 'spot' before the body defines them.
- Evidence: 'Zonal redundancy' appears at lines 300, 301, 314, 322 and 338 with no definition. 'Qualified' is defined at line 57, after its use at line 16. 'Spot' is defined at line 258, after its use at line 19.
- Fix asked: Add after the cost table: 'Zonal redundancy keeps spare GPU capacity in another zone, at a higher price. With it off, a zone outage can stop the service.'

## check:owner

Verdict: The report is usable for today's decisions. Its counts hold: 15 decisions, 10 items and 11 options, and its section 10 and 11 arithmetic recomputes. The first step can be executed: zk-run.json exists, M5.5 is in the plan, M5.8 is free, --reverse exists and ci:heavy is used. Four medium problems remain. The notes archive lacks report/, so sections 9 and 10 cannot be re-checked. The report omits that, with one prover, bounties mostly pay the owner. The ci:heavy reasoning in item 1 is wrong. The first step is ambiguous about rented cards and the non-Linux case. The other findings are low.

Checked: I read all of doc-rev101, kept-findings, the diff and escrow/final.md, plus parts of spec.md and agents.md. I ran recompute.py and listed the contents of verification-review-notes.tar.gz. In the repository I checked zk-run.json against VERIFICATION.md:969-988 and the plan ids (M5.4 deferred, M5.5 present, M5.8 free). I checked that check-rules-version.sh accepts --reverse, the ci:heavy workflows, the ci.yml zk-exec filter and the zk-host commands. I also checked Season.sol for the rake cap, MAX_GRACE and rollover, DEPLOYMENT.md:196, the README aggregation text, and plan section 1.1 against CLAUDE.md.

### R1 [medium] 15. Appendix C

- Quote: The notes behind this report were sent to the owner as one archive, `verification-review-notes.tar.gz`.
- Problem: The archive has no report/ folder, which the table claims. So the notes behind sections 9 and 10 (agents and cloud), recompute.py and the Cloudflare arithmetic cannot be re-checked by a third party. The section 15 lead promises they can.
- Evidence: `tar tzf verification-review-notes.tar.gz` (dated 2026-11-10 16:12, 44 entries) lists only ./audit, ./escrow, ./optimistic, ./research and README.md. report/cloudflare.md says it was 'Written 2026-11-11', after the archive.
- Fix asked: Rebuild the archive with report/agents.md, agents-check.md, cloud.md, cloud-check.md, compute_out.md, recompute.py, cloudflare.md and review/, then send it again. Otherwise write: 'The notes for sections 9 and 10 are in a second archive, sent on 11 November.'

### R2 [medium] 11. Economics (Who pays)

- Quote: Recommended for testnet; mainnet still needs one of the levers below
- Problem: The escrow notes give three reasons to pause before building, and the report states only two. The missing one: with one prover, bounties mostly pay the owner for settlements the operator already promises for free (decision 3). This bears on decision 5, which builds the escrow.
- Evidence: escrow/final.md:9: '(3) with one prover, the escrow mostly pays the owner money players post.' A grep of the report finds no equivalent sentence. Decision 3 keeps free operator settlement of every qualified best run.
- Fix asked: Append: 'With one prover, a bounty mostly pays the owner for a settlement the operator already owes. The escrow adds value only once other provers compete.' Repeat it in the Why of decision 5.

### R3 [medium] 14. Proposed work plan, item 1

- Quote: The lockfile change forces a clean CI build of about an hour, so the pull request goes without the `ci:heavy` label.
- Problem: Leaving the label off does not avoid the hour-long build. ci.yml's zk-exec job rebuilds anyway on any change under referee/zk. The label only adds zk-prove's multi-hour CPU proofs. A reader may expect no long build and run out of Actions minutes.
- Evidence: ci.yml:406-413 says a cold host build takes about 63 minutes, on a lockfile change. Its filter (ci.yml:427-440) includes 'referee/zk/**' and needs no label. zk-prove.yml:57 is the job gated by ci:heavy. Plan :2270 says November's minutes ran low.
- Fix asked: 'The lockfile change makes ci.yml rebuild the prover from clean, about an hour of Actions minutes. Check the month's budget first. Do not add `ci:heavy`, which would also start hours of CPU proving.'

### R4 [medium] 13. Decisions, decision 2 and first question

- Quote: Measure before building: work item 1 on the RTX 3060, plus about 3 USD of rented cards
- Problem: The first step is ambiguous. Decision 2 and section 10 add rented cards, but item 1 measures only the owner's card. The rented plan needs RunPod, Google Cloud and Vast.ai accounts, and none exists. If the machine is not Linux, decision 5's gate 'on the owner's card' cannot be run.
- Evidence: Section 14 item 1 names only 'the owner's card'. Section 10, Measuring step 2 rents four cards, among them an RTX 3060. Section 2: 'no cloud account were available'. Section 10: Google's default GPU quota 'was not found'. Decision 5: 'proves in minutes on the owner's card'.
- Fix asked: 'Work item 1 on the owner's RTX 3060. The rented cards of section 10 come after it and need accounts on RunPod, Google Cloud and Vast.ai.' First question: 'If not, item 1 and the gate of decision 5 run on a rented RTX 3060.'

### R5 [low] 1. Summary

- Quote: If a large cloud is required, Cloud Run fits single requests and spot machines fit batches (section 10).
- Problem: The owner asked about Cloudflare and about one proof per level. The summary, section 10 and decision 9 (where to host) give neither answer. The answers sit only in table rows of sections 5 and 6.
- Evidence: Section 6 row K: 'Use it for the request API and queue only'. Section 5 row 'One proof per level'. A grep of sections 1, 10 and 13 finds no 'Cloudflare' and no 'per level'.
- Fix asked: Append two sentences. 'Cloudflare has no GPU for custom code, so it can only host the request API and queue (section 6, row K).' 'A proof per level saves neither work nor memory, and it is verified six times (section 5).'

### R6 [low] 14. Proposed work plan

- Quote: Before any mainnet season: the lock with a stake, a deeper contract review, and an answer to the economics of section 11.
- Problem: Section 13 sets five decisions before mainnet. This closing line names three. It leaves out vendor risk (13), unbounded replay cost (14) and the legal review (15). A reader of section 14 alone sees an incomplete gate.
- Evidence: Section 13, 'Before any mainnet season', has rows 11 to 15. Row 15 reads 'A contract review at least as deep as the last one, and the legal review'.
- Fix asked: 'Before any mainnet season: decisions 11 to 15 of section 13. These are the economics, the lock with a stake, the vendor risk, the replay cost bound, and the contract and legal reviews.'

### R7 [low] 9. What a third-party agent needs to earn

- Quote: about 0.06 USD for a bot-style run (estimate)
- Problem: The bot-style floor uses the gas of a human-style claim. A bot-style claim costs about twice the gas, so the floor is understated by about a fifth.
- Evidence: spec.md:471 gives a bot-style claim at 0.047 to 0.053 USD. With 0.002 to withdraw and 0.017 to 0.020 of RTX 5090 time, the floor is 0.066 to 0.075 USD. agents.md:212 used 0.025 to 0.028 for the claim.
- Fix asked: 'about 0.07 USD for a bot-style run (estimate)'

### R8 [low] 14. Proposed work plan, item 1

- Quote: Prove `contracts/test/fixtures/zk-run.json` and one whole bot run on the owner's card.
- Problem: The repository has no whole bot run file, so the second proof cannot be started as written. The committed run file was cut short with --short. zk-host's existing execute-run takes six vectors, not a run file.
- Evidence: seasons/testnet-0/runs/ holds only run-1.json, which DEPLOYMENT.md:174 says was made with --short. DEPLOYMENT.md:97: without --short, e2e.mjs proves the whole bot run. referee/zk/host/src/main.rs:14 shows 'execute-run <six game vector files>'.
- Fix asked: 'Prove `zk-run.json` and one whole bot run that `e2e.mjs --cases happy-path` writes without `--short` on the local chain.'

### R9 [low] 13. Decisions, decision 6

- Quote: It halves proving time and moves no vector, so the rules version stays. The deployed image id then changes only once
- Problem: Once item 4 merges, main builds a guest with a new image id. The deployed ZkReferee still pins the old one until item 10. Any season settled on generation 1 in between, including M5.5's, needs a prover built before item 4. The report does not say so.
- Evidence: DEPLOYMENT.md:195: a new verify program forces a new generation, and a new season on the same generation keeps its ZkReferee. escrow/final.md C15: 'One zk-host binary per image id'.
- Fix asked: Append: 'Until item 10 deploys, the operator proves with a zk-host built at the deployed commit.'

### R10 [low] 8. What three red-team reviews changed

- Quote: and the host refuses a payee without a checksum.
- Problem: The report drops must-have 12 of the escrow notes, which asks for a cold payee. The owner's agent signs from a hot key, and putting that key in the proof exposes the earnings.
- Evidence: escrow/final.md:76: 'Checksummed payee in the host (C6); payee should be a cold address or a Safe.' A grep of the report finds no 'cold address' or 'Safe'.
- Fix asked: Append: 'The payee should be a cold address or a Safe, never the hot key that pays gas.'

### R11 [low] 14. Proposed work plan

- Quote: The escrow notes hold a draft, and the first pull request adds the items to the plan.
- Problem: The draft's ids predate the new items 2 and 4, so copying them would misnumber the plan. The draft's own text also disagrees with itself on which id is the format change.
- Evidence: escrow/final.md build order: M5.8 measurement, M5.9 payee, M5.10 escrow, M5.11 prover, M5.12 dApp, M5.13 tooling, M5.14. Its line C9 says 'M5.8 (format) and M5.9 (escrow)'. Plan section 1.1: ids are stable.
- Fix asked: 'The escrow notes hold a draft. Its ids predate items 2 and 4, so the first pull request numbers the items again before adding them.'

## What was done with them

- All findings were applied, with these adjustments.
- consistency/C10: only zonal redundancy was defined in place; the summary keeps the words qualified, rake and spot, which the body defines.
- owner/R8: work item 1 now says that the end-to-end script writes a whole bot run when it runs without `--short`.
- fixes/R1 and owner/R1: the archive was rebuilt with the report folder and sent again.
