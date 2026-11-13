# Consistency review of doc-rev40.md

## Repeated numbers checked (agree unless noted)
- Run fee 0.00005 ETH = 0.10 USD (s3, s10): agree (0.1025).
- CPU 338-467 s/segment = 295+43 / 410+57 (s3 vs App B): agree.
- 6 to 17 h per run (s1, s3, s6, s11): repo says 8.7-11 h real bot runs, 16-17 h heaviest (DEPLOYMENT.md:245-252); s11 puts it under a 100M-cycle column (about 96 segments = 9 to 12.5 h). s1 states it as done, though no full run was proven.
- 70 to 137 million cycles (s3, s7): agree with DEPLOYMENT.md table and VERIFICATION.md:405.
- 15-18 M human cycles (s3, App A), 16 M reference (s10, s11): agree.
- 120 ms browser replay (s3, s5, s7, App A): agree.
- 22 times / 2.9 billion (F6, App A, s12): 2.9e9/130.7e6 = 22.2, agree. 41 min on 5090: 2,766 seg x 0.89 + 2 = 2,491 s, agree.
- 227,591 gas (s3, s11, App B): agree. 8,400 + 279,000 vs 278,653: rounding.
- 530,256 / 804,194 / 590,000 / 930,000 gas: agree with gas-table.txt + 223,800.
- 25-27% of fee, 0.000012-0.000014 ETH, 0.027 USD (s8, s10, s11, s13): agree with escrow/spec.md:469.
- 1.2 to 2.7 paid runs: 0.0000123/0.00001 and 0.0000136/0.000005: agree.
- Bounty 0.000015-0.00002 ETH = 30-40% = 0.03-0.04 USD (s9, s11): agree.
- Cap 4 fees = 0.41 USD (s8, s9, s10, s13): agree. 245/0.41 = 598 bounties: agree, but 245 is not the cheapest always-on GPU in the s10 table (Vast 5060 Ti 0.14/h = about 104 USD per month, compute_out.md).
- 152 lines, 84 tests, five invariants (s6, s8, App A): agree (final.md:57, spec.md:585).
- 54% / 71% flood fill, "halves" (s4, s11, s13, App A): agree.
- 75 vectors (App A twice): agree.
- 4-8% of pot (s1, s6): agree with design/redteam-economic.md:17.
- 5 Nov 2026 Boundless (s1, s6): agree.
- Counts: findings 10 (s4, s7), options 11 = 2+1+8 (s6), steps 10 (s7), decisions 4+5+5 (s13), items 9 (s14), rules 4 (s9), models 3 (s11), risks 3 (s12), limits 3 (s2), cautions 3 (s10): all match. "They added four things" (s8) lists four, but the cap (final.md C3, from liveness #8) is also a red-team addition and s7 step 9 credits it.
- Proving times by card (s10 table vs home-card table): rounding agrees. s6 option B "6 to 15 min on a mid-range 16 GB card" disagrees with s10 (5.8-9.1 min for the RTX 5060 Ti); s10 itself calls 8-15 min "an earlier, rougher estimate".
- Home electricity per bot run: s10 0.004-0.016 EUR (card only); s11 0.01-0.03 EUR (recompute.py: RTX 3060 at 1.5-1.8x whole PC). Basis not stated.
- 0.003 USD (s10, RunPod 0.69/h) vs 0.004 USD (s11, Vast 0.83/h) for the same proof on a rented 5090: rates differ, both stated loosely.
- 50 to 90 times (s5): 109/2 to 187/2 = 55 to 94.
- 416 bytes "per level" (s8): a one-level proof; 6 x 416 = 2,496, not 2,336 (final.md:49).
- Research topics: s2 "Eleven topics", App C "Nine notes" (plus agents and cloud notes in report/ = 11; not said).
- Reviewers: s2 "cut off two reviewers of the optimistic designs" vs s12 "Two of three reviewers finished". design/ has economic and liveness red-team notes, implementation work folder without a note: one red-team reviewer cut off. Second cut-off not found in notes; uncertain.

## Cross-references checked
s1 -> s9, s10, s12, s13; s6 I -> s5; s8 -> s11; s9 -> s8; s10 -> s11 (forward), s4 (heaviest legal run), s14; s11 -> s4, s10; s12 -> first work item; s13 decisions -> sections 4/F6, 6, 8, 9, 10, 11, 12 and items 1, 2-3, 4-9; s14 -> s11. All point to the right place.
Gaps: s13 decision 9 and s9 recommend an MCP wrapper and a remote endpoint; s6 K and s7 step 4 keep Cloudflare as front door; none has a work item in s14.

## Summary vs body
- Omits the economics blocker (s11, s13 decision 10: no paid mainnet until gas < rake) and the vendor/emergency-stop risk (F4, decision 12).
- "Third-party figures put the same proof at about 1.5 minutes": s10 says it is an estimate scaled from another program.
- "heavy run" (s1) = bot-style run; "heaviest run" (s3, s5) = 130.7 M documented; "heaviest legal run" (s9, s10) = 2.9 B. Easy to confuse.

## Section order
1 to 15 present, in order. s9 and s10 use reference runs and gas defined in s11; s10 says "as in section 11". Acceptable, noted only.
