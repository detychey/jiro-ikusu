# Consistency pass on doc-rev101.md (2026-11-11)

## Numbers that recur (all agree unless marked)

| Figure | Places | Status |
| --- | --- | --- |
| Run fee 0.00005 ETH = 0.10 USD (0.1025) | s3, s10, s11 | ok |
| Bot-style 70-137 M cycles; 67-131 segments | s3, F1, s7 | ok (137 M = proving cycles, VERIFICATION.md:924) |
| Human-style 15-18 M; reference 16 M; fixture 16 segments | s3, F1, s10, s11, D5, App A | ok (VERIFICATION.md:988) |
| CPU 338-467 s/segment; 9-17 h bot; ~2 h human; 1.4-2.4 h; 9-12.5 h for 100 M | s1, s3, s6A, s11, App B | ok (95.4 seg x 338..467 + 170) |
| Largest proof 7,638 s ~ 2 h | s1, F1, App B | ok |
| GPU 5090 88 s / 16 s; 5060 Ti 5.8-9.1 min; 3060 9.5-22 min | s1, s6B, s10 | ok |
| Cost-max run 2.9 bn; 22x; 41 min 5090; 1.1-1.3 h L4; 3-10 h home | F6, s9, s10, App A | ok (3 vs 2.7 rounding) |
| Gas 227,591; 530,256; 590k; 930k; 804,194 | s3, s8, s11, App A/B | ok |
| Human claim 25-27 % fee; bot 45-51 % | s1, s8, s11, D11 | s1 and D11 say "a run": only human-style. FINDING |
| Bounty floor human 0.03-0.04, bot ~0.06 | s9 | bot: 0.046-0.052 gas + 0.017-0.020 GPU + 0.002 withdraw = 0.065-0.074. FINDING |
| Cap 4 fees = 0.41 USD; 250-600 bounties/month | s8, s9, s10, D5 | ok; cap rationale contradicts s10 numbers. FINDING |
| Rake 20 % cap; 0.000005 / 0.00001 ETH; 1.2-2.7 runs | s1, F8, s11, D11, App B | ok |
| Aggregation 8,400 + 278,653/279,000; 13-15 % | s11, D11, App B | ok |
| Home electricity 0.007-0.031 USD; 0.010-0.028 / 0.007-0.012 EUR | s10, s11 | ok (recompute.py) |
| Marketplace 0.012-0.022; L4 0.03-0.04; 1,000 runs 7-31 / 17-27 | s1, s10 | ok; "12 to 24" for pods not traced (table max 22), not reported |
| Counts: 11 options (2/1/8), 10 steps, 10 findings, 15 decisions (4/6/5), 10 work items, 40 corrections, 9 research notes, 5 audits, 3 red teams | s2, s6, s7, s13, s14, App C | ok, except s14 closing list omits D13-D15 items. FINDING |

## Cross-references after renumbering

D2 -> item 1; D4 -> items 2, 3; D5 -> items 5-10; D6 -> item 4; D10 -> item 8; "items 5 and 6 reviewed together"; s10 -> "first work item of section 14"; s12 -> first item; F4, F6 refs; sections 4, 8, 9, 10, 11, 12, 13: all correct. M5.5 exists, M5.8 is next free (plan:1899-1904).

## Terms

gate set defined at s2; segment, image id at s3; journal vs public values at s3; human/bot-style at s3; cost-maximising run at F6 but s12 still says "worst-case journal"; qualified, rake and spot used in s1 before definition (summary, tolerable); zonal redundancy never explained; F6 "They" has no plural antecedent after the edit; F3 says proofs fall in the grace period while s8, s10, s12 recommend settling during the season.

## Other

s14 item 1 "so the pull request goes without ci:heavy" is a non sequitur; the reason in escrow/redteam-implementation.md:23 is the Actions budget (1,460 of 1,500 minutes).
Labels: L4 row basis lacks "Estimate"; s5 circuit row "measured" includes a sizing-model estimate; s10 says every time is scaled from the 5090, but L4 and 4090 rows use other sources.
