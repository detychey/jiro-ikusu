# Skeptic pass over six reviews of doc-rev40.md

Checked against repo (DEPLOYMENT.md 170-200, 238-256; VERIFICATION.md 696-712, 768-790, 930-990; README 640-648, 708-714, 848-858; IMPLEMENTATION_PLAN 36-44, 1540-1545, 1990-2015; Season.sol 190-222; e2e.mjs 824-829) and notes (escrow/final.md whole; proto ProofBounty.sol grep: no cap, no paused(); redteam-implementation.md:23; redteam-ordering.md:30; spec.md:249; audit/cost.md 228-262; audit/trust.md live-1; consistency.md:85; recompute.py rerun; compute_out.md; cloud-check.md 25,40-50; agents-check.md 16,38,45; chk README 270-292; research/risc0-gpu.md:122,378; ethproofs-leaders.md 1-20; arbitrum-native.md:266).

Key arithmetic
- CPU: formula 467 s x seg + 170 s: 67 seg = 8.7 h, 131 seg = 17.0 h; 6.3 h only at 338 s/seg (derived). 96 seg (1e8) = 9.0 to 12.5 h.
- Aggregation: 530,256 - 227,591 + 8,400 + 278,653/100 = 313,852 gas; at the report's implied 2.12e-11 to 2.29e-11 ETH/gas (590k -> 25-27%) = 13.3 to 14.4% of fee.
- Home whole PC (recompute.py): 3060 x1.5-1.8 = 0.0101-0.0279 EUR = 11-31 USD/1000; 5060 Ti 0.0066-0.0122 EUR = 7-14 USD/1000; card only 5-17 USD.
- Spot L4 GCE 17.2-19.2, AWS 24.1-26.8 USD/1000 vs RunPod 4090 12.4-15.7.
- Always-on: Vast 5060 Ti 103 USD/month; 103/0.41 = 251.
- Worst case: L4 1.14-1.27 h, PRO 6000 37-58 min, beyond/near Cloud Run 3,600 s cap.
- Cloudflare figures: no working note holds them (grep).

Rejected: 120 ms replay (lead measured it; audits 143/185 ms within method noise), browser chained proofs (conclusion unchanged), Ethproofs 2-7 s (accurate for leaders), agents bounty 0.05-0.07 (corrected value inside range), SDK v1 risk (optional later endpoint), Lambda/VAT note (no decision impact), MEV in section 8 (rules table answers copying), conception step for human measurement (length), "50 to 90 times" (approximate, consistent with 2M-gate limit), "11 tests fail" claim (not re-checked, not needed).
