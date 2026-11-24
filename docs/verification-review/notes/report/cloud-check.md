# Fact-check of cloud.md (prover hosting benchmark), 2026-11-10

Method: I opened the sources again (official pages and APIs where I could reach them), reran scripts/compute.py, and redid the arithmetic. Tags: P = primary source, S = secondary source, I = inference.

## Verdicts

| Id | Verdict | What I checked |
|---|---|---|
| F1 yardstick | confirmed | research/risc0-gpu.md lines 122-135: the table in hemilabs PR 21 (dated 2026-10-16) gives 565.8 ms per segment, 10.70 s succinct and 12.67 s Groth16 for 12 segments. Recursion = (10.70 - 12 x 0.5658)/12 = 0.326 s. Wrap = 12.67 - 10.70 = 1.97 s. 96 x 0.8917 + 1.97 = 87.57 s, and 16 x 0.8917 + 1.97 = 16.24 s (script rerun). The guest was a busy loop (SimpleLoop), not this project's guest. [S, I] |
| F3 AWS on-demand | confirmed (partly secondary) | Vantage: g6.xlarge 0.8048, g7e.2xlarge 3.36312 (8 vCPU, 64 GiB, RTX PRO 6000 96 GiB), p5.4xlarge 6.88. I did not reopen the AWS price file. [S] |
| F4 AWS quota | confirmed | docs.aws.amazon.com ec2-instance-quotas: "Running On-Demand G and VT instances" default 0, P 0, both adjustable. Spot quotas for G/VT and P are also 0. [P] |
| F5 Spot Advisor | confirmed, but stale | spot-advisor-data.json, Last-Modified 2026-03-20: savings g4dn 60, g5 56, g6 49, g6e 50, g7e 68, p5.4xlarge 9. The data has no g7.2xlarge entry. [P] |
| AWS spot prices (table rows) | corrected | They are derived from savings that are 8 months old. Vantage shows today's spot as g6.xlarge 0.592 (cloud.md: 0.41), g7e.2xlarge 2.012 (1.08) and p5.4xlarge 4.536 (6.26). The public spot.js feed is dated 2024-05-13. [S] |
| F6 GCP g2 | confirmed (indirectly) | The GCP pricing pages render prices client-side, so I could not read the numbers. Vantage gives the g2-standard-4 VM part as 0.1468; with the L4 GPU at 0.56 that is 0.7068. g4, a2 and a3 are unverified. [S] |
| F7 Cloud Run | corrected (incomplete) | run/pricing: L4 0.0001867 and RTX PRO 6000 0.00036522 per second are the non-zonal-redundancy prices. With zonal redundancy they are 0.0002909 and 0.00056913. CPU is 0.000018 and memory 0.000002. The GPU docs say zonal redundancy "is turned on for new services" by default, start in about 5 s, require minimums of 4 vCPU/16 GiB and 20 vCPU/80 GiB, auto-grant 3 GPUs of quota with zonal redundancy off, require instance-based billing, and run driver 580 (CUDA 13.0). Request timeout: default 300 s, maximum 3,600 s. [P] |
| F8 Azure prices | confirmed | Retail Prices API, eastus: NC4as_T4_v3 0.526 (spot 0.164059), NV36ads_A10_v5 3.2 (0.59136), NC24ads_A100_v4 3.673 (0.67877), NC40ads_H100_v5 6.98 (1.418336). Container Apps: T4 7.3e-05/s, A100 0.000529/s, vCPU active 2.4e-05/s, memory 3e-06 per GiB-s. [P] |
| F9 Azure Container Apps | confirmed | Learn gpu-serverless-overview (ms.date 2026-09-21): A100 and T4 only, per-second billing, scale to zero, and quota enabled by default for EA and pay-as-you-go customers. Driver 570, moving to 580 (CUDA 12.x to 13.x). [P] |
| F10 RunPod | confirmed with one exception | runpod.io/pricing, "Updated November 9, 2026": 5090 0.69/1.19, 4090 0.34/0.89, L4 0.44/0.59, RTX PRO 6000 1.69/2.49. Serverless: 32 GB 5090 1.79, PRO 4500 1.15, 24 GB PRO 1.34, 24 GB 0.75. The pricing page does not list an RTX PRO 4500 pod, so the pod price 0.34/0.72 is unsupported there. The serverless docs: billed from worker start to stop, rounded up to the second, with cold start billed and image pull "normally" unbilled. [P] |
| F10b RunPod timeouts (missing) | new fact | endpoint-configurations: the execution timeout defaults to 600 s in the console and 300 s through REST v2, with a range of 5 s to 7 days. Async results are kept for 30 min. [P] |
| F11 Vast.ai | confirmed (the market moves) | My bundles query at 22:3x UTC, verified, single GPU, on-demand: 5090 median 0.804 (54 offers), 4090 0.536, 3090 0.282, 5060 Ti 0.130, 3060 0.076. These are within about 25% of the report's figures. [P] |
| F12 Modal | confirmed | modal.com/pricing: L4 0.000222, L40S 0.000542, RTX PRO 6000 0.000842, A10 0.000306 per second. CPU is 0.0000131 per physical core-s (1 core = 2 vCPU), minimum 0.125 core. Memory is 0.00000222 per GiB-s. Starter plan: 30 USD a month. The "4 cores" in the all-in figure is an assumption. [P] |
| F13 Hetzner | confirmed | matrix-gpu: GEX45 has an RTX PRO 4000 Blackwell SFF 24 GB, i5-13500 and 64 GB, for 214.00 EUR a month or 0.3429 EUR an hour, plus a 209 EUR setup fee. Prices exclude VAT. Location: HEL1 only. Also listed: GEX63 (RTX PRO 6000 Max-Q) at 999 EUR a month or 1.6009 an hour, plus 999 setup. [P] |
| F14 5060 Ti price | corrected | gpuprix.com Germany, "updated 10 Nov 2026": the lowest price is 617 EUR (ASUS Dual OC). Earlier 2026 reports range from 539 to 653 EUR. The 799 EUR figure is not today's low price. [S] |
| F15 GPU specs | confirmed | nvidia.com 5060 family page: 4,608 cores, 2.57 GHz boost, 180 W, 128-bit bus, so 4,608 x 2.57 x 2 = 23.7 TFLOPS. RTX 3060 page: 3,584 cores, 1.78 GHz, 170 W, 192-bit, 550 W system power. 448 GB/s is not on NVIDIA's page. [P/S] |
| F16 home energy | confirmed (arithmetic), corrected (premise) | 170 W x 569 s / 3.6e6 = 0.0269 kWh. However, 170 W is the card's TGP, not the wall draw: the host CPU executes the guest and the PSU loses power. Wall power is plausibly 250-300 W, which multiplies energy by about 1.5-1.8. The conclusion is unchanged because the amounts are cents. [I] |
| F17 break-even | corrected | The script is internally consistent. It uses 799 EUR and an L4 factor of 3x. With 617 EUR (692 USD), every break-even shrinks by a factor of 0.772: 9,000 to 88,700 runs. With the measured L4 ratio of 1.76x, break-even against GCP L4 rises to 692/(0.0303 - 0.0063) = 28,900 runs (37,400 at 896 USD), not 19,800. [I] |
| F18 worst case | confirmed | ceil(2.9e9/2^20) = 2,766, and 2,766 x 0.8917 + 1.97 = 2,468 s = 41.1 min. [I] |
| F19 fixed path | confirmed | referee/zk/README.md:58 gives the root as /home/runner/work/jiro-ikusu/jiro-ikusu. Using it as a Docker WORKDIR is an untested inference. The README itself describes only CI and a bind mount. [P, I] |
| Lambda | confirmed | lambda.com/pricing: A10 1.29, A100 40 GB 1.99, H100 PCIe 3.79, GH200 2.59; "These prices take effect November 16, 2026". The page does not state billing granularity. [P] |
| DigitalOcean | confirmed | gpu-droplets pricing: L40S 1.57, RTX 4000 Ada 0.76, RTX 6000 Ada 1.57; per-second billing with a 5-minute minimum. Powered-off droplets are still billed. A single-GPU H100 is 4.41 (cloud.md omits it). [P] |
| L4 time rows (AWS g6, GCP g2, Cloud Run L4, RunPod L4) | corrected | They use a factor of 1.9 to 6.0 against the 5090. The only measurement, an AWS g6.xlarge, is 1.67 to 1.86x (risc0-gpu.md lines 160-163). The low end therefore excludes the measurement. Corrected: 146 to 163 s per 1e8 run if the measurement transfers. That gives 0.029 to 0.032 USD on GCP g2 and 0.033 to 0.036 on AWS g6 per 1e8 run, and 33 to 36 USD per 1,000 runs on AWS g6 (report: 37 to 118). [I] |

## Arithmetic

- L4 at the measured ratio: 87.57 x 1.67 = 146 s, and 87.57 x 1.86 = 163 s. GCP: 0.7068 x 146/3600 = 0.0287 USD. AWS: 0.8048 x 163/3600 = 0.0364 USD.
- Cloud Run L4 all-in with zonal redundancy: 0.0002909 x 3600 + 4 x 0.000018 x 3600 + 16 x 0.000002 x 3600 = 1.047 + 0.259 + 0.115 = 1.42 USD/h, against 1.0465 without it. RTX PRO 6000: 2.049 + 1.296 + 0.576 = 3.92 USD/h, against 3.19.
- 5060 Ti: 617 EUR x 1.1214 = 692 USD. Break-even against GCP L4 busy at 1.76x: rent 0.0303, energy 0.0063, so 692/0.0240 = 28,900 runs.

## Reasoning flaws

1. The L4 range ignores the only measurement on that class of card. This inflates the cost of the hyperscaler L4 options by up to 3.2x and feeds the "avoid AWS/GCP, 2 to 30 times the cost" verdict. On busy L4 the measured gap to RunPod's community 4090 is about 2 to 2.5x.
2. Spot prices come from savings percentages 8 months old. Vantage's current spot prices differ by -28% to +86%.
3. Cloud Run is priced without zonal redundancy, which is not the default. The 3-GPU auto-quota applies only when it is off. The report should state the opt-out, or price the default at 1.42 and 3.92 USD/h.
4. Season costs assume every run is 1e8 cycles. Human-style runs are 15 to 18M cycles, about 1/6 of that. A season of human runs costs about one sixth as much.
5. The 5060 Ti capex of 799 EUR is about 30% above today's tracker low. Home energy uses the card's TGP, not the wall draw.
6. Serverless latency assumes the default timeouts are fine. RunPod's default of 300 or 600 s would kill a 1e8 run on L4-class workers (up to 525 s by the report's own numbers) and every worst-case run. Cloud Run's default of 300 s would kill these too, and its 3,600 s maximum is below the report's own L4 or RTX PRO 4500 estimates for 2.9e9 cycles.

## Missing

- RunPod execution timeout: defaults of 600 s (console) and 300 s (REST v2), maximum 7 days; async results are kept for 30 min.
- Cloud Run: zonal redundancy is on by default (about +56% on the GPU price), the request timeout maximum is 60 min, and the driver is 580 (CUDA 13.0). Azure ACA is moving to driver 580. CUDA 12.8 images are forward compatible, but the version should be pinned and tested.
- Current AWS spot prices from Vantage (g6.xlarge 0.592, g7e.2xlarge 2.012, p5.4xlarge 4.536).
- Hetzner GEX63 (RTX PRO 6000 Max-Q, 96 GB) at 1.6009 EUR an hour or 999 EUR a month, plus 999 setup. Hetzner prices exclude VAT, and the GEX45 is HEL1 only.
- DigitalOcean also sells a single H100 at 4.41 and an RTX 6000 Ada at 1.57. Powered-off droplets are still billed.
