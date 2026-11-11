# Review: accuracy of sections 9 (agents) and 10 (cloud), doc-rev40.md

Checked against report/agents.md, agents-check.md, cloud.md, cloud-check.md, compute_out.md, recompute.py (rerun with python3 -I), research/risc0-gpu.md:150-170, and the @x402/mcp 2.30.0 README in report/chk/pkg/package/README.md:276,288.

## Arithmetic redone (all agree within rounding)
- Time table: every row = 87.57 s / 16.24 s x factor (5090 1, PRO6000 0.9-1.4, 4090 1.5-1.9, L40S/H100 up to 2.9, L4 1.67-1.86, A10 3.0-4.7, A100 1.2-7.5, 5060 Ti 4.0-6.2, 3060 6.5-15, T4 5.6-18). OK.
- Cost table: all 21 rows match recompute.py / compute_out.md (batch = price x s/3600; cold = price x (60 or 300 + s)/3600; 1,000 runs). OK.
- Worst case 2,766 seg -> 41.1 min on 5090; 3060 4.45-10.3 h; 5060 Ti 2.74-4.25 h. OK.
- Break-even 10,000-115,000 = union of 617 EUR low (9,576) and 799 EUR high (115,466). Acceptable.
- Fee share 0.03-0.07 + 0.027 gas = 56-95% of 0.1025. OK.
- Bounty cap 0.41; heaviest run 0.48 USD on 5090 at 0.69. OK.
- Corrections applied: L4 1.67-1.86 yes; AWS spot tracker yes; Cloud Run zonal yes (caution + label); 5060 Ti 617-799 yes; serverless timeouts yes; season mix yes; whole-PC power only as a note, NOT propagated (finding 1).

## Findings
1. Whole-PC power not propagated: 3060 at 1.5-1.8x = 0.0101-0.0279 EUR = 11-31 USD per 1,000 bot runs; overlaps marketplace 12-24. "5 to 17 USD of electricity" and "Home is the cheapest" overstate.
2. "two to three times more" ignores spot L4 (GCE spot 17-19 USD per 1,000; AWS spot 24-27), which the ranking itself uses.
3. Cloud Run "the one that fits" vs ranking (spot L4 VMs for a vendor invoice) vs decision 8; Cloud Run L4 batch 42-47 USD is the dearest L4.
4. Cloud Run 3,600 s max vs heaviest run: L4 1.14-1.27 h of proving (recompute.py), so it cannot finish. Missing caveat.
5. x402/mcp "600 s at most": README line 276 lists maxRequestTimeoutSeconds default 600 (client option); line 288 maxTimeoutSeconds default 60. Both configurable.
6. "The cheapest costs 245 USD per month": Vast 5060 Ti 103 USD/month, Vast 3090 165 (compute_out.md:40-41).
7. Bounty floor "0.05 to 0.07 on a rented RTX 5090": source upper end is L4 GPU; derived from 137M run with human claim gas.
8. "No hosted facilitator serves Arbitrum Sepolia": source supports "lists", not "serves".
9. Section 11 home electricity 0.01-0.03 EUR vs section 10 0.004-0.016 EUR.
10. Summary "the same proof at about 1.5 minutes" vs source: busy-loop guest on a fork's PR, scaled.
11. Lambda price takes effect 16 Nov; Hetzner excludes VAT.
12. @x402/mcp builds on MCP SDK v1; compatibility with stateless 2026-07-28 unverified (agents-check:45) not stated.
13. "heavy run" undefined in summary.
