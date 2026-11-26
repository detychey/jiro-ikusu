# Review notes: accuracy of options, conception, design, economics, work plan (sections 6, 7, 8, 11, 13, 14)

Checked: escrow/final.md, spec.md (lines 3, 54, 465-484, 585), redteam-{liveness,ordering,implementation}.md, gas-table.txt, full-suite.log, proto/contracts/src/ProofBounty.sol (no cap, no paused() check); audit/cost.md (lines 127-158, 246, 257); design/redteam-economic.md:17; research/{proof-services,ethproofs-leaders,arbitrum-native,attestation,risc0-gpu}.md; repo README.md:645, :669-684, :854; docs/VERIFICATION.md:778-784, :815; docs/DEPLOYMENT.md:150, :193-196; IMPLEMENTATION_PLAN.md §1.1, M4.15, M5.5; CLAUDE.md keep-in-sync table.

Arithmetic that holds: 364,880+223,800=588,680 (~590k); 707,956+223,800=931,756 (~930k); 0.0000123/0.00005=24.6%, 0.0000136/0.00005=27.2%; bot 45-51% (spec.md:471); rake 0.000005/0.00001; 1.2-2.7 runs (0.0000123/0.00001, 0.0000136/0.000005); bounty 30-40% (spec.md:484); 5%/44% hashes (cost.md:158); RTX 5090 16 s x 0.83/3600 = 0.0037 USD, 88 s = 0.020 USD; CPU human 15x338 s=1.41 h to 18x467+170 s=2.38 h; SP1 0.078 USD/0.1025 = 76%; flood fill halves human journals too (2.39M->1.25M, 2.96M->1.41M, cost.md:257).

Aggregation arithmetic: 530,256 - 227,591 + 8,400 + 278,653/100 = 313,852 gas; x 0.020214 gwei = 0.0000063 ETH, +0.0000004..0.0000017 L1 = 13.5-16% of fee: under the 20% cap, above a 10% rake.

Findings: see structured result (A1-A14).
