# Where to host the prover: AWS, Google Cloud, Azure and specialised GPU clouds against a home GPU

Design-review report, written 2026-11-10. Topic: the owner asked for a benchmark of cloud options such as Google Cloud and AWS to host the RISC Zero 3.0.6 prover. This report builds on two earlier research notes from the same day (`research/risc0-gpu.md`, `research/proof-services.md`) and on the ProofBounty specification after red team (`escrow/final.md`). It re-reads every price it uses from the official page or API today.

**Tags.** **[P]** primary source read today (official pricing page or API, official documentation). **[S]** secondary source (third-party measurement, tracker, search summary, encyclopedia). **[I]** inference or estimate: my arithmetic or reasoning, with the arithmetic shown. **Nothing was measured on this project's guest, and no cloud instance was started.** Every proving time below is either a third-party measurement on another program or an estimate derived from one. Sources are numbered in section 12, each with URL and date.

Conversion rates [P]: 1 EUR = 1.1214 USD (ECB reference rate, 2026-11-10); 1 ETH = 2,050.545 USD (Coinbase spot, 2026-11-10 22:29 UTC). The 0.00005 ETH run fee is therefore 0.1025 USD.

All derived numbers come from `scratchpad/report/scripts/compute.py`; its full output is `scratchpad/report/compute_out.md`.

---

## 0. Answer in brief

1. **Clouds cost about the same per proof; what differs is how fast the GPU is, how billing starts and stops, and the paperwork.** At the reference speed (an RTX 5090: 87.6 s for a 1e8-cycle run [I from S]), one batched 1e8-cycle run costs **0.012 to 0.03 USD** on a marketplace RTX 4090 or 5090 (RunPod, Vast.ai). It costs **0.03 to 0.12 USD** on a hyperscaler L4 (AWS g6, GCP G2) and **0.07 to 0.67 USD** on hyperscaler A10, A100, H100 or RTX PRO 6000 machines [I]. A season of 1,000 such runs costs **12 to 30 USD** on marketplace pods against **33 to 120 USD** on hyperscaler L4s [I].
2. **One proof on demand is dominated by start-up, not proving.** A human-style run (16 million cycles) takes about 16 s on a 5090 and 0.003 USD of GPU time, but a cold serverless request costs **0.02 to 0.08 USD**, and a cold virtual machine costs **0.06 to 0.66 USD** [I]. Scale-to-zero serverless GPUs that bill per second are the only cloud form that suits one proof at a time: RunPod Serverless, Google Cloud Run with GPUs, Azure Container Apps serverless GPUs, Modal.
3. **AWS and Google Compute Engine are the most expensive way to get this proof, and the slowest to set up.** A new AWS account has a quota of **0** for G and VT instances and must ask for more [P]. The single-GPU sizes are the old or slow cards (T4, A10G, L4), or large machines priced at 1.9 to 6.9 USD/h (L40S, RTX PRO 6000, H100). Their spot prices are 9% to 68% below on demand [P]. **Google Cloud Run** is the exception worth keeping: it scales to zero, bills per second, starts an instance in "approximately 5 seconds", and grants 3 GPUs of quota automatically on the first deployment [P]. It offers an L4 at 1.05 USD/h all-in and an RTX PRO 6000 (96 GB, same die as the 5090) at 3.19 USD/h all-in [I from P].
4. **The home GPU wins on cost by a wide margin, and by enough on the planned card.** The owned RTX 3060 costs **0.007 to 0.016 EUR of electricity per 1e8-cycle run** and about **0.001 to 0.003 EUR per human-style run**, at 0.25 EUR/kWh [I]. It is slow: about **10 to 22 minutes per 1e8 run** at segment po2 19, which a 12 GB card probably needs [I]. The RTX 5060 Ti 16 GB costs **from 799 EUR** today [S]. It would take about **6 to 9 minutes per 1e8 run** [I]. Buying it beats renting only after **about 12,000 to 115,000 runs**, depending on what it replaces (section 7). It is justified by latency and independence from vendors, not by cost.
5. **No option meets a 10-minute deadline for the legal worst case** (about 2.9 billion cycles): that run takes about **41 minutes even on an RTX 5090** [I]. A bounty deadline rule must exclude such runs or allow hours.
6. **Recommendation.** Testnet: the home RTX 3060, with a RunPod or Vast.ai pod rented by the hour as a fallback. 1,000 runs per season: prove continuously at home during the season, and burst on marketplace pods (several in parallel) near the settlement end. Hyperscaler spot is the choice only if a contract and invoice from a large vendor are required. Bounties within 10 minutes at any hour: the home GPU first, with a scale-to-zero serverless endpoint as overflow (RunPod Serverless 32 GB, or Cloud Run RTX PRO 6000 if a hyperscaler is preferred). Before any of this, **measure** (section 11): about 3 USD on three rented cards that bracket the owned and the planned card.

---

## 1. Workload and the yardstick

| Quantity | Value | Tag, source |
|---|---|---|
| Human-style run | 15 to 18 million cycles; this report uses **16 million** = 16 segments of 2^20 | context of this review |
| Bot run | 70 to 137 million; this report uses **1e8** = 96 segments (1e8 / 1,048,576 = 95.4, rounded up) | context; risc0-gpu.md |
| Legal worst case | about 2.9 billion cycles = 2,766 segments | context |
| Reference speed, upstream RISC Zero v3.0.6 with `--features cuda`, RTX 5090 | 0.5658 s per 2^20 segment + 0.3259 s recursion per segment + 1.97 s Groth16 wrap | S, third-party A/B measurement on a busy-loop guest (risc0-gpu.md §3.3 A) |
| 1e8-cycle run on a 5090 | 96 x 0.8917 + 1.97 = **87.6 s** | I |
| 16M-cycle run on a 5090 | 16 x 0.8917 + 1.97 = **16.2 s** | I |
| 2.9e9-cycle run on a 5090 | 2,766 x 0.8917 + 1.97 = 2,468 s = **41 min** | I |
| VRAM rule | 2^20-cycle segments need 9 to 10 GB; Boundless maps 8 GB to po2 19, 16 GB to po2 20; a fork measured a peak of about 12.1 GiB at po2 20 and a Groth16 key of about 7.25 GB that stays resident after a wrap | P (Boundless docs), S (fork), via risc0-gpu.md |
| Settlement gas | about 590,000 gas, 0.000012 to 0.000014 ETH = 0.025 to 0.029 USD on Arbitrum One | context; I conversion |

**Assumptions carried from the earlier research [I]:** a segment costs the same whatever it executes (the guest uses no precompile; the repository's CPU proofs of three different inputs took 396, 408 and 410 s per segment). The host CPU is not the bottleneck: the in-process prover runs a CPU preflight before each GPU segment, so a rented card with 4 slow vCPUs may run slower than these figures.

---

## 2. Price and offer, by provider

All prices are on demand, USD per hour, Linux, read 2026-11-10, unless stated. "Spot" is the published spot, preemptible or interruptible price where one is published.

### 2.1 AWS EC2, US East (N. Virginia)

| Instance | GPU, VRAM | vCPU, RAM | On demand | Spot (from Spot Advisor savings) | Interruption band | Tag |
|---|---|---|---:|---:|---|---|
| g4dn.xlarge | 1 x T4, 16 GiB | 4, 16 GiB | 0.526 | about 0.210 (60% saving) | 10-15% | P |
| g5.xlarge | 1 x A10G, 22 GiB | 4, 16 GiB | 1.006 | about 0.443 (56%) | over 20% | P |
| g6.xlarge | 1 x L4, 22 GiB | 4, 16 GiB | 0.8048 | about 0.410 (49%) | over 20% | P |
| g6.2xlarge | 1 x L4, 22 GiB | 8, 32 GiB | 0.9776 | about 0.528 (46%) | 10-15% | P |
| g6e.xlarge | 1 x L40S, 44 GiB | 4, 32 GiB | 1.861 | about 0.931 (50%) | over 20% | P |
| g7.2xlarge (new) | 1 x RTX PRO 4500 (Blackwell), 32 GiB | 8, 32 GiB | 2.520 | not in Spot Advisor | | P |
| g7e.2xlarge (new) | 1 x RTX PRO Server 6000 (Blackwell), 96 GiB | 8, 64 GiB | 3.36312 | about 1.076 (68%) | 15-20% | P |
| p5.4xlarge | 1 x H100, 80 GiB | 16, 256 GiB | 6.880 | about 6.261 (9%) | under 5% | P |
| g6f.xlarge / 2xlarge / 4xlarge | 1/8, 1/4, 1/2 of an L4: 2.79, 5.59, 11.18 GiB | | 0.2375 / 0.475 / 0.95 | | | P; **below the VRAM rule, unusable** |
| g5g.xlarge | T4G on an ARM (Graviton) host | 4, 8 GiB | 0.42 | | | P; **ARM host: the GPU Groth16 route is x86-64 in practice (risc0-gpu.md §2), unusable** |

- Billing: "by the hour or second (minimum of 60 seconds)"; Linux partial hours "billed per-second" [P, source 3].
- Quota: the default quota of "Running On-Demand G and VT instances" is **0**, and of "Running On-Demand P instances" is **0**. Both are adjustable on request [P, source 4]. A new account must file a quota request before its first GPU instance.
- Spot: the Spot Advisor data (last modified 2026-03-20) gives the saving against on demand and a monthly interruption band. The old public spot price feed is from 2024-05-13 and lacks g6e and g7, so I did not use it [P, sources 5, 6]. The spot price is my product of the on-demand price and the Advisor's saving [I]. Spot interruptions come with a "two-minute warning" [P, source 7].
- Data transfer: "AWS customers receive 100GB of data transfer out to the internet free each month"; data in is listed separately. The per-GB figures did not render from the page template [P, source 3].
- Region: US East (N. Virginia) only was read.

### 2.2 Google Cloud, Iowa (us-central1, the pages' default)

| Machine | GPU, VRAM | vCPU, RAM | On demand | Spot | Other | Tag |
|---|---|---|---:|---:|---|---|
| n1-standard-4 + 1 x T4 | T4, 16 GB | 4, 15 GiB | 0.190 + 0.35 = **0.540** | T4 spot not extracted | T4 1-year CUD 0.22, 3-year 0.16 | P, I sum |
| g2-standard-4 | 1 x L4, 24 GB | 4, 16 GiB | **0.7068** | **0.4230** | flex CUD 1-year 0.558 | P |
| g2-standard-8 | 1 x L4 | 8, 32 GiB | 0.8536 | 0.5108 | | P |
| a2-highgpu-1g | 1 x A100 40 GB | 12, 85 GiB | **3.6734** | **2.1880** | DWS Flex-start 2.00 | P |
| a2-ultragpu-1g | 1 x A100 80 GB | 12, 170 GB | 5.0688 | 3.0362 | Flex-start 2.40 | P |
| a3-highgpu-1g | 1 x H100 80 GB | 26, 234 GB | **not sold on demand**: "you must create instances by using Spot VMs or Flex-start VMs" | about 6.59 per GPU (a3-highgpu-8g spot 52.70 / 8) | Flex-start about 4.79 per GPU (38.32 / 8) | P, I division |
| g4-standard-48 (new, G4) | 1 x RTX PRO 6000 (Blackwell), 96 GB | 48, 180 GiB | **4.4999** | **1.7178** | Flex-start 2.25 | P |
| g4-standard-6 / -12 / -24 | 1/8, 1/4, 1/2 of an RTX PRO 6000: 12, 24, 48 GB | 6, 12, 24 | 0.6469 / 1.2938 / 2.588 | 0.2469 / 0.4938 / | | P; fractional; that CUDA proving works on a fraction is **unverified** |

- Billing: "All vCPUs, GPUs, and GB of memory are charged a minimum of 1 minute ... After 1 minute, instances are charged in 1 second increments" [P, source 10].
- Spot: "discounts of 60-91% off of the corresponding on-demand price for most machine types and GPUs", with "smaller discounts ... for A3 machine types". Preemption notice is 0 s by default, configurable to 30 or 120 s [P, sources 8, 11].
- Quota: A2, A3, G2 and G4 need only the GPU quota of their type, not a CPU quota [P, source 12]. I did not find the default GPU quota of a new project on the pages read: **could not verify**.

**Cloud Run with GPUs** [P, sources 13, 14, 15]:

| Item | L4 | RTX PRO 6000 Blackwell |
|---|---|---|
| VRAM | 24 GB | 96 GB |
| Minimum instance | 4 vCPU, 16 GiB | 20 vCPU, 80 GiB |
| GPU price, non-zonal redundancy | 0.0001867 USD/s = 0.6721 USD/h | 0.00036522 USD/s = 1.3148 USD/h |
| vCPU 0.000018 USD/s, memory 0.000002 USD/GiB-s | 4 x 0.0648 + 16 x 0.0072 = 0.3744 USD/h | 20 x 0.0648 + 80 x 0.0072 = 1.872 USD/h |
| **All-in at the minimum size** | **1.0465 USD/h** [I] | **3.1868 USD/h** [I] |
| Regions | europe-west1, europe-west4, us-central1, us-east4 and Asian regions, some by invitation | asia-southeast1, asia-south2, europe-west4, us-central1 |
| Driver | 580.x.x (CUDA 13.0) | same |

- "can scale down to zero"; instances "start in approximately 5 seconds, at which point the processes running in your container can start to use the GPU". "You must use instance-based billing ... GPU is billed for the entire duration of the instance lifecycle."
- Quota: "Projects using Cloud Run nvidia-l4 GPUs in a region for the first time are automatically granted 3 GPU quota (zonal redundancy off) when the first deployment is created"; the same for the RTX PRO 6000 (3,000 milliGPU).
- Cloud Run **jobs** also take GPUs: "GPU for jobs follow No zonal redundancy pricing". A job is the natural fit for a batch of runs; a service is the fit for an HTTP bounty endpoint.
- Not checked: the maximum request timeout of a Cloud Run service. The 2.9e9-cycle worst case needs about 41 minutes on the fastest card.

### 2.3 Microsoft Azure, East US

| Size | GPU, VRAM | vCPU, RAM | On demand | Spot | Tag |
|---|---|---|---:|---:|---|
| NC4as_T4_v3 | 1 x T4, 16 GB | 4, 28 GiB | **0.526** | 0.1641 | P |
| NV36ads_A10_v5 | 1 x A10, 24 GB | 36, 440 GiB | **3.20** | 0.5914 | P |
| NV18ads / NV12ads_A10_v5 | 1/2, 1/3 of an A10: 12, 8 GB | 18, 12 | 1.60 / 0.908 | | P; fractional, below or at the edge of the VRAM rule |
| NC24ads_A100_v4 | 1 x A100, 80 GB | 24, 220 GiB | **3.673** | 0.6788 | P |
| NC40ads_H100_v5 | 1 x H100 (PCIe), 94 GB | 40, 320 GiB | **6.98** | 1.4183 | P |
| NC144lds_xl_RTXPRO6000BSE_v6 (new) | 1 x RTX PRO 6000 Blackwell Server Edition, 96 GB | 144, 264 GiB | 5.50 | not extracted | P; Learn page dated 2026-05-11 |
| NC24lds_xl_RTXPRO6000BSE_v6 | 1/4 of an RTX PRO 6000, 24 GB | 24, 72 GiB | 1.13 | 0.2088 | P; fractional, unverified for CUDA proving |

- The Retail Prices API rows carry "Spot" and "Low Priority" types. The newest Spot rows are dated 2026-11-01 (T4, H100) [P, source 16].
- No single-GPU L4 or L40S size was found in East US.

**Azure Container Apps, serverless GPUs** [P, sources 17, 18, 19]:

- GPUs: T4 and A100 only. Profiles `Consumption-GPU-NC8as-T4` and `Consumption-GPU-NC24-A100`, 8 to 24 vCPU and 56 to 220 GiB per replica. "Multi and fractional GPU replicas aren't supported."
- Meters: "Standard NC T4 v3 GPU Usage" 0.000073 USD/s = 0.2628 USD/h; "Standard NC A100 v4 GPU Usage" 0.000529 USD/s = 1.9044 USD/h. Active vCPU 0.000024 USD/s and memory 0.000003 USD/GiB-s are billed on top.
- All-in, with my choice of replica size [I]: T4 with 4 vCPU and 16 GiB = 0.2628 + 0.3456 + 0.1728 = **0.781 USD/h**; A100 with 8 vCPU and 32 GiB = 1.9044 + 0.6912 + 0.3456 = **2.941 USD/h**.
- "per-second billing with scale down to zero"; "Customers with enterprise agreements and pay-as-you-go customers have A100 and T4 quota enabled by default."
- Driver: current 570 with "CUDA runtime 12.x", moving to 580 and 13.x. A100 in 9 regions including East US, West US, Sweden Central and Italy North; T4 in 17 regions.
- Cold start: the page recommends "artifact streaming" from a premium Azure Container Registry and storage mounts for large files. It gives no figure.

### 2.4 Specialised providers

| Provider | Offer | GPU, VRAM | vCPU, RAM | On demand USD/h | Spot or interruptible | Billing, minimum | Scale to zero | Tag, source |
|---|---|---|---|---:|---:|---|---|---|
| RunPod pods | RTX 5090 | 32 GB | 9, 35 GB (secure) | **0.69** community / **1.19** secure | | "billed by the second", "no fees for data ingress or egress" | no (stop the pod) | P, sources 20, 21, 22 |
| | RTX 4090 | 24 GB | 6, 41 GB | **0.34** / 0.89 | | same | | P |
| | RTX 3090 | 24 GB | 16, 125 GB | 0.22 / 0.50 | | | | P |
| | RTX 5080 | 16 GB | | 0.39 / 0.59 | | | | P |
| | L4 | 24 GB | 12, 50 GB | 0.44 / 0.59 | | | | P |
| | L40S | 48 GB | 16, 94 GB | 0.79 / 1.09 | | | | P |
| | RTX PRO 4500 (Blackwell) | 32 GB | | 0.34 / 0.72 | | | | P |
| | RTX PRO 6000 (Blackwell SE) | 96 GB | | 1.69 / 2.49 | | | | P |
| | A100 80 GB PCIe | 80 GB | 8, 117 GB | 1.19 / 1.79 | | | | P |
| | H100 PCIe | 80 GB | 16, 188 GB | 1.99 / 2.89 | | | | P |
| RunPod Serverless (flex workers) | 32 GB class (5090) | | | **1.79** | | per second, "rounded up to the nearest second"; image pull while scaled down "not billed"; idle timeout default 5 s | **yes** | P, sources 20, 23 |
| | 24 GB class (4090 PRO) | | | 1.34 | | | yes | P |
| | 24 GB class (L4, A5000, 3090) | | | 0.75 | | | yes | P |
| | 32 GB RTX PRO 4500 | | | 1.15 | | | yes | P |
| | 16 GB class (A4000, A4500, RTX 4000, RTX 2000) | | | 0.58 | | | yes | P |
| | 96 GB RTX PRO 6000 | | | 3.49 | | | yes | P |
| Vast.ai (verified, rentable, single GPU; read 22:23 UTC) | RTX 5090 | 32 GB | median 32 cores, 63 GB | median **0.830** (51 offers, min 0.476) | median bid 0.533 | "Per-second billing" (earlier research) | no | P, source 24 |
| | RTX 4090 | 24 GB | | median 0.513 (43 offers, min 0.397) | 0.360 | | | P |
| | RTX 3090 | 24 GB | | 0.229 (28) | 0.147 | | | P |
| | RTX 5080 | 16 GB | | 0.326 (14) | 0.188 | | | P |
| | RTX 5060 Ti | 16 GB | median 12 cores, 31 GB | **0.143** (35, min 0.104) | 0.117 | | | P |
| | RTX 4060 Ti | 16 GB | | 0.164 (19) | 0.141 | | | P |
| | RTX 3060 | 12 GB | median 6 cores, 28 GB | **0.082** (28, min 0.042) | 0.054 | | | P |
| | T4 / L4 / A10 / L40S | | | 0.134 (2) / 0.708 (2) / 0.243 (1) / 0.788 (6) | | | | P |
| | RTX PRO 6000 WS / Server | 96 GB | | 1.669 (17) / 1.738 (13) | 1.120 / 1.533 | | | P |
| Lambda (prices effective 2026-11-16) | A10 | 24 GB | 30, 226 GiB | 1.29 | | "bills in one-minute increments" | no | P, sources 25, 26 |
| | A100 SXM or PCIe 40 GB | 40 GB | 30, 220 GiB | 1.99 | | | | P |
| | H100 PCIe | 80 GB | 26, 225 GiB | 3.79 | | | | P |
| | GH200 | 96 GB | 64, 432 GiB | 2.59 | | | | P; ARM host, unusable for the GPU Groth16 route |
| Modal | L4 / A10 / L40S / RTX PRO 6000 / T4 | 24 / 24 / 48 / 96 / 16 GB | CPU 0.0000131 USD per physical core-s, memory 0.00000222 USD/GiB-s | GPU only: 0.7992 / 1.1016 / 1.9512 / 3.0312 / 0.5904 | | per second; Starter plan "$30 / month free credits"; "Using a GPU requires having a valid payment method on file" | **yes** | P, sources 27, 28, 29 |
| | all-in with 4 physical cores, 16 GiB [I] | | | L4 1.116, L40S 2.268, RTX PRO 6000 3.348 | | | | I |
| CoreWeave | single-GPU: GH200 only | 96 GB | 72, 480 GB | 6.50 | | not read | Kubernetes | P, source 30; other GPUs only as 8-GPU nodes (L40S 18.00, RTX PRO 6000 20.00 per node) |
| DigitalOcean (owns Paperspace) | RTX 4000 Ada / RTX 6000 Ada / L40S | 20 / 48 / 48 GB | 8, 32-64 GiB | 0.76 / 1.57 / 1.57 | | "billed per second with a 5-minute minimum" | no | P, source 31 |
| Paperspace | A4000 | 16 GB | 8, 45 GB | 0.76 | | "billed per hour" | no | P, source 32; other rows of that page were ambiguous after parsing |
| Scaleway | L4-1-24G | 24 GB | 8, 48 GB | **0.75 EUR** = 0.841 USD | | billed per minute | no | **S**: the official page refused automated fetches (HTTP 403); the figure and per-minute billing come from a search summary of Scaleway's pricing page and FAQ; the product exists in Scaleway's public API with L40S-1-48G and H100-1-80G [P, sources 33, 34] |
| OVHcloud Public Cloud | l4-90 / a10-45 / l40s-90 / a100-180 / h100-380 | 24 / 24 / 48 / 80 / 80 GB | 22 / 30 / 15 / 15 / 30 vCPU | 1.00 / 1.00 / 1.80 / 3.07 / 2.99 | | billing granularity **not confirmed**; the cost rows below assume a full hour | no | P, source 35 |
| Hetzner dedicated | GEX45: RTX PRO 4000 Blackwell SFF | 24 GB | i5-13500, 64 GB | **EUR 214 per month or EUR 0.3429 per hour, plus EUR 209 setup** | | monthly or hourly, one-time setup fee | no (bare metal) | P, source 36 |
| | GEX63 (named on the page): RTX PRO 6000 Blackwell Max-Q | 96 GB | Core Ultra 7 265, 128 GB | EUR 999 per month or EUR 1.6009 per hour, plus EUR 999 setup | | | | P; the page layout makes the product-to-price pairing slightly ambiguous |

**Supply note [S].** Several outlets reported in October 2026 that the RTX 5090 was being withdrawn from retail in favour of workstation parts; NVIDIA denied it (Wikipedia, citing Tom's Hardware and TweakTown, source 38). Marketplace 5090 supply is still deep today: 51 verified Vast.ai offers. Plans that rely on rented 5090s should keep the RTX PRO 6000 (same die) or 4090 as the fallback.

---

## 3. GPU-by-GPU check against the VRAM rule

| GPU | VRAM | po2 to use | Fits the rule? | Note |
|---|---:|---|---|---|
| RTX 5090, RTX PRO 4500, RTX PRO 6000, L40S, A100, H100 | 32 to 96 GB | 20 (21 possible on 32 GB or more, unverified upstream) | yes | |
| RTX 4090, RTX 3090, L4, A10, A10G | 22 to 24 GB | 20 | yes | AWS shows L4 and A10G as 22 GiB |
| RTX 5060 Ti, RTX 4060 Ti, RTX 5080, T4 | 16 GB | 20 per the Boundless table; 19 per the Boundless CLI wizard and if the wrap runs out of memory | probably at 20; at 19 surely | STARK and wrap run one after the other; a fork measured 12.1 GiB at po2 20, then 7.25 GB for the wrap key |
| RTX 3060 | 12 GB | **19** | yes at 19; po2 20 probably does not fit (12.1 GiB peak against 12 GiB) | about 30% slower than po2 20 [S, fork: 44.0 s vs 57.6 s for the same proof] |
| Fractional GPUs (AWS g6f, GCP g4-standard-6/12/24, Azure NV12/NV18ads, Azure NC24/36lds) | 3 to 48 GB slices | | VRAM may fit, CUDA behaviour on vGPU slices unverified | do not plan on them without a test |
| T4 (sm_75) | 16 GB | 20 or 19 | VRAM yes | a fork reported a ptxas failure for sm_75 in its own sppark fork; upstream on sm_75 untested (risc0-gpu.md §11) |

---

## 4. Performance per GPU

### 4.1 What is published

| GPU | Published figure for RISC Zero 2.x or 3.x | Tag |
|---|---|---|
| RTX 5090 | upstream v3.0.6: 565.8 ms per 2^20 segment, 0.33 s recursion per segment, 1.97 s wrap | S (risc0-gpu.md §3.3 A) |
| RTX 4090 | 3.0.5 and 3.0.6 logs without cycle counts; a fork at 1.3 to 1.4 MHz; RISC Zero's own 2023 datasheet is for the old circuit. Earlier research put a 1e8 run at 130 to 165 s (1.5 to 1.9 times the 5090). | S, I |
| L4 (AWS g6.xlarge) | upstream ^3.0.3: whole proofs took 1.67 to 1.69 times the 5090's time, 1.86 times on the marginal cost per event | S (void-reference-impl, 2025-10-01) |
| RTX 5080 | fork: about 1.0 MHz against 1.4 MHz for its 4090 | S |
| Boundless docs | "264 kHz for one 16 GB GPU" (October 2024, zkp 1.1.1, old circuit) | P, outdated |
| T4, A10G, A100, L40S, H100, RTX 3060, 4060 Ti, 5060 Ti, RTX PRO 4500/6000 | **none found** today. A search found only a fork's 5090 and 4090 runs, older zkVM benchmark sites and Fenbushi's undated-version GPU figures | P (search, sources 37) |

### 4.2 Estimates for the cards without a figure

There is no RISC Zero 3.x figure for most cards, so I scale the 5090 measurement by published hardware throughput figures: memory bandwidth and FP32 throughput [S, Wikipedia tables and NVIDIA's RTX 3060 page, sources 38, 39, 40]. A STARK prover is bound by memory traffic and integer arithmetic, so neither figure is exact. **Every factor below is an estimate [I].** The rule used: low end = the smaller of the bandwidth ratio and the FP32 ratio to the 5090; high end = the larger, times 1.4. The 1.4 is the gap seen between the 5080's spec ratio (about 1.86) and its measured slowdown (about 2.3 to 2.6). The L4 is the exception: its measured 1.67 to 1.86 is better than either spec ratio, so I keep the measurement as its low end.

| GPU | Bandwidth GB/s | FP32 TFLOPS | Ratio to 5090 (bw / FP32) | **Time factor used (low to high)** | 1e8 run, s | 16M run, s |
|---|---:|---:|---|---|---:|---:|
| RTX 5090 | 1,792 | 104.8 | 1 / 1 | 1.0 | 88 | 16 |
| RTX PRO 6000 (Blackwell) | 1,792 (WS) | 110 (Max-Q) to 126 (WS) | about 1 | 0.9 to 1.4 | 79 to 123 | 15 to 23 |
| H100 PCIe | 2,039 | 51.2 | 0.88 / 2.05 | 0.9 to 2.9 | 79 to 254 | 15 to 47 |
| RTX 4090 | | | | 1.5 to 1.9 (earlier research) | 131 to 166 | 24 to 31 |
| L40S | 864 | 91.6 | 2.07 / 1.14 | 1.1 to 2.9 | 96 to 254 | 18 to 47 |
| RTX PRO 4500 (Blackwell) | 896 | 54.9 | 2.0 / 1.91 | 1.9 to 2.8 | 166 to 245 | 31 to 45 |
| RTX 3090 | | | | 2.5 to 3.3 (earlier research: 4090 at 0.55 to 0.65) | 219 to 289 | 41 to 54 |
| L4 | 300 | 30.3 | 5.97 / 3.46 | **1.9 (measured) to 6.0** | 166 to 525 | 31 to 97 |
| A10 / A10G | 600 | 31.2 | 2.99 / 3.35 | 3.0 to 4.7 | 263 to 412 | 49 to 76 |
| A100 | 1,555 | 19.5 | 1.15 / 5.37 | 1.2 to 7.5 (wide: HBM bandwidth vs weak FP32) | 105 to 657 | 19 to 122 |
| RTX PRO 4000 Blackwell SFF (Hetzner GEX45) | 432 | 24.05 | 4.15 / 4.36 | 4.1 to 6.1 | 359 to 534 | 67 to 99 |
| **RTX 5060 Ti 16 GB** | 448 | 23.7 | 4.0 / 4.42 | **4.0 to 6.2** | **350 to 543** | **65 to 101** |
| RTX 4060 Ti 16 GB | not sourced | not sourced | | no estimate made; expect the 5060 Ti's order or slower | | |
| **RTX 3060 12 GB, at po2 19** | not on NVIDIA's page (192-bit GDDR6) | 3,584 cores x 2 x 1.78 GHz = 12.76 | about 5 (if 360 GB/s, unverified) / 8.21 | (5.0 to 11.5) x 1.31 for po2 19 = **6.5 to 15** | **569 to 1,314** | **106 to 244** |
| T4 | 320 | 8.1 | 5.6 / 12.9 | 5.6 to 18 | 490 to 1,576 | 91 to 292 |

Arithmetic example, RTX 5060 Ti: 1792 / 448 = 4.0; 104.8 / 23.7 = 4.42; high = 4.42 x 1.4 = 6.2; 87.6 s x 4.0 = 350 s; 87.6 x 6.2 = 543 s.

**What this means.** The fast end is the 5090 class (5090, RTX PRO 6000, probably H100), at 1.3 to 2 minutes per 1e8 run. The middle is 4090, L40S, RTX PRO 4500 and 3090, at 2 to 5 minutes. L4, A10 and A100 range from 2 to 11 minutes, wide because nothing pins them. The 16 GB consumer cards take 6 to 9 minutes, and the RTX 3060 and T4 take 10 to 26 minutes. A human-style run is about a sixth of each.

---

## 5. Costs

Formulas [I]: busy cost = price x seconds / 3,600. Cold request = price x max(start-up + proving, minimum charge) / 3,600. Season = price x (N x seconds per run + one start-up) / 3,600 on one instance. Always on = price x 720 h.

**Start-up assumptions [I, estimates, not measured]:**
- Container image about 8 GB: zk-host binary, CUDA runtime, and the 2.34 GB Groth16 component, which is about 5 GB unpacked.
- **Serverless, billed cold start: 60 s.** On RunPod, pulling the image happens "while the worker is scaled down and [is] not billed" [P]. Cloud Run starts an instance "in approximately 5 seconds" [P]. That leaves process start, loading the kernels, and the first read of the Groth16 key (a fork saw 2.96 s for the first wrap against 2.0 s afterwards [S]). 60 s is a margin, not a measurement.
- **Virtual machine, billed cold start: 300 s** (boot, driver, pulling 8 GB at 100 to 200 MB/s, first key read).
- **CUDA kernels must be compiled ahead of time for the target GPU.** RISC Zero warns that kernels "may need to be JIT compiled. This can take a few minutes" [P, risc0-gpu.md]. That would ruin every cold start. Building with `NVCC_APPEND_FLAGS` for sm_75, sm_86, sm_89, sm_90 and sm_120, as Boundless does without sm_90, avoids it [P, risc0-gpu.md §3.2].

### 5.1 The main table (paste-ready)

Prices in USD. Ranges come from the time factors of section 4.2. The source of every price is in section 2.

| Option | GPU | On demand USD/h | Spot USD/h | s per 1e8 run | USD per 1e8 run, busy | s per 16M run | USD per 16M run, busy | USD one cold 16M request | USD one cold 1e8 request | Season of 100 / 1,000 / 10,000 runs of 1e8, USD | GPU-hours for 10,000 | Always on 30 days, USD |
|---|---|---:|---:|---|---|---|---|---|---|---|---|---:|
| AWS g4dn.xlarge | T4 | 0.526 | 0.210 | 490 to 1,576 | 0.072 to 0.230 | 91 to 292 | 0.013 to 0.043 | 0.057 to 0.087 | 0.116 to 0.274 | 7.2 to 23 / 72 to 230 / 717 to 2,303 | 1,362 to 4,379 | 379 |
| AWS g5.xlarge | A10G | 1.006 | 0.443 | 263 to 412 | 0.073 to 0.115 | 49 to 76 | 0.014 to 0.021 | 0.097 to 0.105 | 0.157 to 0.199 | 7.4 to 11.6 / 74 to 115 / 734 to 1,150 | 730 to 1,143 | 724 |
| AWS g6.xlarge | L4 | 0.805 | 0.410 | 166 to 525 | 0.037 to 0.118 | 31 to 97 | 0.007 to 0.022 | 0.074 to 0.089 | 0.104 to 0.185 | 3.8 to 11.8 / 37 to 118 / 372 to 1,175 | 462 to 1,460 | 579 |
| AWS g6e.xlarge | L40S | 1.861 | 0.931 | 96 to 254 | 0.050 to 0.131 | 18 to 47 | 0.009 to 0.024 | 0.164 to 0.179 | 0.205 to 0.286 | 5.1 to 13.3 / 50 to 131 / 498 to 1,313 | 268 to 705 | 1,340 |
| AWS g7.2xlarge | RTX PRO 4500 | 2.520 | n/a | 166 to 245 | 0.117 to 0.172 | 31 to 45 | 0.022 to 0.032 | 0.232 to 0.242 | 0.327 to 0.382 | 11.9 to 17.4 / 117 to 172 / 1,165 to 1,717 | 462 to 681 | 1,814 |
| AWS g7e.2xlarge | RTX PRO 6000 | 3.363 | 1.076 | 79 to 123 | 0.074 to 0.115 | 15 to 23 | 0.014 to 0.021 | 0.294 to 0.302 | 0.354 to 0.395 | 7.6 to 11.7 / 74 to 115 / 737 to 1,146 | 219 to 341 | 2,421 |
| AWS p5.4xlarge | H100 | 6.880 | 6.261 | 79 to 254 | 0.151 to 0.485 | 15 to 47 | 0.028 to 0.090 | 0.601 to 0.663 | 0.724 to 1.059 | 15.6 to 49 / 151 to 486 / 1,507 to 4,854 | 219 to 705 | 4,954 |
| GCP n1-standard-4 + T4 | T4 | 0.540 | n/a | 490 to 1,576 | 0.074 to 0.236 | 91 to 292 | 0.014 to 0.044 | 0.059 to 0.089 | 0.119 to 0.281 | 7.4 to 23.7 / 74 to 237 / 736 to 2,365 | 1,362 to 4,379 | 389 |
| GCP g2-standard-4 | L4 | 0.707 | 0.423 | 166 to 525 | 0.033 to 0.103 | 31 to 97 | 0.006 to 0.019 | 0.065 to 0.078 | 0.092 to 0.162 | 3.3 to 10.4 / 33 to 103 / 327 to 1,032 | 462 to 1,460 | 509 |
| GCP a2-highgpu-1g | A100 40 GB | 3.673 | 2.188 | 105 to 657 | 0.107 to 0.670 | 19 to 122 | 0.020 to 0.124 | 0.326 to 0.430 | 0.413 to 0.976 | 11 to 67 / 108 to 671 / 1,073 to 6,702 | 292 to 1,824 | 2,645 |
| GCP a3-highgpu-1g, spot | H100 | not sold | 6.588 | 79 to 254 | 0.144 to 0.465 | 15 to 47 | 0.027 to 0.086 | 0.576 to 0.635 | 0.693 to 1.014 | 15 to 47 / 145 to 465 / 1,443 to 4,648 | 219 to 705 | 4,743 |
| GCP g4-standard-48 | RTX PRO 6000 | 4.500 | 1.718 | 79 to 123 | 0.099 to 0.153 | 15 to 23 | 0.018 to 0.028 | 0.393 to 0.403 | 0.474 to 0.528 | 10.2 to 15.7 / 99 to 154 / 986 to 1,533 | 219 to 341 | 3,240 |
| **GCP Cloud Run L4** (4 vCPU, 16 GiB) | L4 | 1.047 | n/a | 166 to 525 | 0.048 to 0.153 | 31 to 97 | 0.009 to 0.028 | **0.026 to 0.046** | 0.066 to 0.170 | 4.9 to 15.3 / 48 to 153 / 484 to 1,527 | 462 to 1,460 | 753 |
| **GCP Cloud Run RTX PRO 6000** (20 vCPU, 80 GiB) | RTX PRO 6000 | 3.187 | n/a | 79 to 123 | 0.070 to 0.109 | 15 to 23 | 0.013 to 0.020 | **0.066 to 0.073** | 0.123 to 0.162 | 7.0 to 10.9 / 70 to 109 / 698 to 1,085 | 219 to 341 | 2,294 |
| Azure NC4as_T4_v3 | T4 | 0.526 | 0.164 | 490 to 1,576 | 0.072 to 0.230 | 91 to 292 | 0.013 to 0.043 | 0.057 to 0.087 | 0.116 to 0.274 | 7.2 to 23 / 72 to 230 / 717 to 2,303 | 1,362 to 4,379 | 379 |
| Azure NV36ads_A10_v5 | A10 | 3.200 | 0.591 | 263 to 412 | 0.234 to 0.366 | 49 to 76 | 0.043 to 0.068 | 0.310 to 0.335 | 0.500 to 0.633 | 24 to 37 / 234 to 366 / 2,336 to 3,659 | 730 to 1,143 | 2,304 |
| Azure NC24ads_A100_v4 | A100 80 GB | 3.673 | 0.679 | 105 to 657 | 0.107 to 0.670 | 19 to 122 | 0.020 to 0.124 | 0.326 to 0.430 | 0.413 to 0.976 | 11 to 67 / 108 to 670 / 1,072 to 6,701 | 292 to 1,824 | 2,645 |
| Azure NC40ads_H100_v5 | H100 | 6.980 | 1.418 | 79 to 254 | 0.153 to 0.492 | 15 to 47 | 0.028 to 0.091 | 0.610 to 0.673 | 0.735 to 1.074 | 15.9 to 50 / 153 to 493 / 1,529 to 4,925 | 219 to 705 | 5,026 |
| **Azure Container Apps T4** (4 vCPU, 16 GiB) | T4 | 0.781 | n/a | 490 to 1,576 | 0.106 to 0.342 | 91 to 292 | 0.020 to 0.063 | 0.033 to 0.076 | 0.119 to 0.355 | 10.7 to 34 / 106 to 342 / 1,064 to 3,421 | 1,362 to 4,379 | 562 |
| **Azure Container Apps A100** (8 vCPU, 32 GiB) | A100 80 GB | 2.941 | n/a | 105 to 657 | 0.086 to 0.537 | 19 to 122 | 0.016 to 0.100 | 0.065 to 0.149 | 0.135 to 0.586 | 8.6 to 54 / 86 to 537 / 859 to 5,366 | 292 to 1,824 | 2,118 |
| RunPod pod, community | RTX 5090 | 0.69 | n/a | 88 | 0.017 | 16 | 0.003 | 0.061 | 0.074 | 1.7 / 16.8 / 168 | 243 | 497 |
| RunPod pod, secure | RTX 5090 | 1.19 | n/a | 88 | 0.029 | 16 | 0.005 | 0.105 | 0.128 | 3.0 / 29 / 290 | 243 | 857 |
| **RunPod pod, community** | RTX 4090 | 0.34 | n/a | 131 to 166 | **0.012 to 0.016** | 24 to 31 | 0.002 to 0.003 | 0.031 | 0.041 to 0.044 | **1.3 to 1.6 / 12.4 to 15.7 / 124 to 157** | 365 to 462 | 245 |
| RunPod pod, secure | RTX 4090 | 0.89 | n/a | 131 to 166 | 0.033 to 0.041 | 24 to 31 | 0.006 to 0.008 | 0.080 to 0.082 | 0.107 to 0.115 | 3.3 to 4.2 / 33 to 41 / 325 to 411 | 365 to 462 | 641 |
| RunPod pod, community | L4 | 0.44 | n/a | 166 to 525 | 0.020 to 0.064 | 31 to 97 | 0.004 to 0.012 | 0.040 to 0.049 | 0.057 to 0.101 | 2.1 to 6.5 / 20 to 64 / 203 to 642 | 462 to 1,460 | 317 |
| RunPod pod, community | RTX PRO 4500 | 0.34 | n/a | 166 to 245 | 0.016 to 0.023 | 31 to 45 | 0.003 to 0.004 | 0.031 to 0.033 | 0.044 to 0.052 | 1.6 to 2.3 / 16 to 23 / 157 to 232 | 462 to 681 | 245 |
| RunPod pod, community | RTX PRO 6000 | 1.69 | n/a | 79 to 123 | 0.037 to 0.058 | 15 to 23 | 0.007 to 0.011 | 0.148 to 0.152 | 0.178 to 0.198 | 3.8 to 5.9 / 37 to 58 / 370 to 576 | 219 to 341 | 1,217 |
| **RunPod Serverless 32 GB** | RTX 5090 | 1.79 | n/a | 88 | 0.044 | 16 | 0.008 | **0.038** | **0.073** | 4.4 / 44 / 435 | 243 | 1,289 |
| RunPod Serverless 24 GB PRO | RTX 4090 | 1.34 | n/a | 131 to 166 | 0.049 to 0.062 | 24 to 31 | 0.009 to 0.012 | 0.031 to 0.034 | 0.071 to 0.084 | 4.9 to 6.2 / 49 to 62 / 489 to 619 | 365 to 462 | 965 |
| RunPod Serverless 24 GB | L4, A5000, 3090 | 0.75 | n/a | 166 to 525 | 0.035 to 0.110 | 31 to 97 | 0.006 to 0.020 | 0.019 to 0.033 | 0.047 to 0.122 | 3.5 to 11 / 35 to 110 / 347 to 1,095 | 462 to 1,460 | 540 |
| RunPod Serverless 32 GB | RTX PRO 4500 | 1.15 | n/a | 166 to 245 | 0.053 to 0.078 | 31 to 45 | 0.010 to 0.015 | 0.029 to 0.034 | 0.072 to 0.098 | 5.3 to 7.9 / 53 to 78 / 532 to 783 | 462 to 681 | 828 |
| Vast.ai median | RTX 5090 | 0.830 | 0.533 | 88 | 0.020 | 16 | 0.004 | 0.073 | 0.089 | 2.1 / 20 / 202 | 243 | 598 |
| Vast.ai median | RTX 4090 | 0.513 | 0.360 | 131 to 166 | 0.019 to 0.024 | 24 to 31 | 0.004 | 0.046 to 0.047 | 0.062 to 0.067 | 1.9 to 2.4 / 19 to 24 / 187 to 237 | 365 to 462 | 369 |
| Vast.ai median | RTX 3090 | 0.229 | 0.147 | 219 to 289 | 0.014 to 0.018 | 41 to 54 | 0.003 | 0.022 | 0.033 to 0.038 | 1.4 to 1.9 / 14 to 18 / 139 to 184 | 608 to 803 | 165 |
| Vast.ai median | RTX 5060 Ti | 0.143 | 0.117 | 350 to 543 | 0.014 to 0.022 | 65 to 101 | 0.003 to 0.004 | 0.015 to 0.016 | 0.026 to 0.034 | 1.4 to 2.2 / 14 to 22 / 139 to 216 | 973 to 1,508 | 103 |
| Lambda (from 2026-11-16) | A10 | 1.29 | n/a | 263 to 412 | 0.094 to 0.148 | 49 to 76 | 0.018 to 0.027 | 0.125 to 0.135 | 0.202 to 0.255 | 9.5 to 14.9 / 94 to 148 / 942 to 1,475 | 730 to 1,143 | 929 |
| Lambda (from 2026-11-16) | A100 40 GB | 1.99 | n/a | 105 to 657 | 0.058 to 0.363 | 19 to 122 | 0.011 to 0.067 | 0.177 to 0.233 | 0.224 to 0.529 | 6.0 to 36 / 58 to 363 / 581 to 3,631 | 292 to 1,824 | 1,433 |
| Lambda (from 2026-11-16) | H100 PCIe | 3.79 | n/a | 79 to 254 | 0.083 to 0.267 | 15 to 47 | 0.015 to 0.050 | 0.331 to 0.365 | 0.399 to 0.583 | 8.6 to 27 / 83 to 268 / 830 to 2,674 | 219 to 705 | 2,729 |
| Modal (4 cores, 16 GiB) | L4 | 1.116 | n/a | 166 to 525 | 0.052 to 0.163 | 31 to 97 | 0.010 to 0.030 | 0.028 to 0.049 | 0.070 to 0.181 | 5.2 to 16.3 / 52 to 163 / 516 to 1,628 | 462 to 1,460 | 803 |
| Modal (4 cores, 16 GiB) | L40S | 2.268 | n/a | 96 to 254 | 0.061 to 0.160 | 18 to 47 | 0.011 to 0.030 | 0.049 to 0.068 | 0.099 to 0.198 | 6.1 to 16 / 61 to 160 / 607 to 1,600 | 268 to 705 | 1,633 |
| Modal (4 cores, 16 GiB) | RTX PRO 6000 | 3.348 | n/a | 79 to 123 | 0.073 to 0.114 | 15 to 23 | 0.014 to 0.021 | 0.069 to 0.077 | 0.129 to 0.170 | 7.4 to 11.5 / 73 to 114 / 733 to 1,140 | 219 to 341 | 2,410 |
| DigitalOcean (5-min minimum) | L40S | 1.57 | n/a | 96 to 254 | 0.042 to 0.111 | 18 to 47 | 0.008 to 0.021 | 0.139 to 0.151 | 0.173 to 0.242 | 4.3 to 11.2 / 42 to 111 / 420 to 1,108 | 268 to 705 | 1,130 |
| OVHcloud l4-90 (hourly assumed) | L4 | 1.00 | n/a | 166 to 525 | 0.046 to 0.146 | 31 to 97 | 0.009 to 0.027 | 1.00 | 1.00 | 4.7 to 14.7 / 46 to 146 / 462 to 1,460 | 462 to 1,460 | 720 |
| OVHcloud l40s-90 (hourly assumed) | L40S | 1.80 | n/a | 96 to 254 | 0.048 to 0.127 | 18 to 47 | 0.009 to 0.024 | 1.80 | 1.80 | 5.0 to 12.9 / 48 to 127 / 482 to 1,270 | 268 to 705 | 1,296 |
| Scaleway L4-1-24G (EUR 0.75, S) | L4 | 0.841 | n/a | 166 to 525 | 0.039 to 0.123 | 31 to 97 | 0.007 to 0.023 | 0.077 to 0.093 | 0.109 to 0.193 | 4.0 to 12.4 / 39 to 123 / 389 to 1,228 | 462 to 1,460 | 606 |
| Hetzner GEX45 (EUR 0.3429/h, **plus EUR 209 = 234 USD setup**) | RTX PRO 4000 SFF | 0.385 | n/a | 359 to 534 | 0.038 to 0.057 | 67 to 99 | 0.007 to 0.011 | 0.38 + setup | 0.38 + setup | 3.9 to 5.7 / 38 to 57 / 384 to 571, each plus 234 | 997 to 1,484 | 277 hourly, or EUR 214 = 240 USD monthly |
| **Home RTX 3060 12 GB, owned** (170 W, EUR 0.25/kWh) | RTX 3060, po2 19 | | | **569 to 1,314** | **0.008 to 0.017** (energy) | **106 to 244** | **0.0014 to 0.0032** | same as busy (always on) | same | 0.75 to 1.7 / 7.5 to 17 / 75 to 174 | 1,580 to 3,650 | idle power only (section 7) |
| **Home RTX 5060 Ti 16 GB, to buy** (180 W, from EUR 799) | RTX 5060 Ti | | | **350 to 543** | **0.005 to 0.008** (energy) | **65 to 101** | **0.0009 to 0.0014** | same as busy | same | 0.5 to 0.8 / 4.9 to 7.6 / 49 to 76, plus the card | 973 to 1,508 | idle power only |

**Reading the table.**
- **Per run, busy:** marketplace consumer cards (RunPod community 4090 at 0.012 to 0.016, Vast.ai 3090 or 5060 Ti at 0.014 to 0.022) are the cheapest rented options. The 5090 class costs 0.017 to 0.029. The hyperscalers' cheapest is GCP g2 L4 at 0.033 to 0.103. AWS and GCP A100 and H100 are 5 to 30 times the cheapest.
- **One cold request:** serverless wins. A human-style proof costs about 0.02 to 0.08 USD (RunPod Serverless 24 GB at 0.019 to 0.033, Cloud Run L4 at 0.026 to 0.046, RunPod 32 GB at 0.038). A cold virtual machine costs 0.06 to 0.66. OVHcloud costs a full hour if it bills hourly (not confirmed).
- **Season of 1,000 runs of 1e8:** 12 to 30 USD on marketplace pods, 33 to 118 USD on hyperscaler L4s on demand, and about half that on spot.
- **One machine for 10,000 runs** needs 219 to 4,379 GPU-hours (9 to 182 days). A batch at season end must fan out across many instances: the cost is the same, the wall time divides.
- **Hyperscaler spot halves the price:** GCP g2 L4 at 0.423 USD/h gives about 20 to 62 USD for 1,000 runs [I: 1,000 x 166 to 525 s x 0.423 / 3,600]. Spot only suits jobs that can be re-run (section 8).

**Against the run fee (0.1025 USD) and settlement gas (0.025 to 0.029 USD) [I]:** a human-style run proven cold on serverless costs about 0.02 to 0.08 USD of GPU time plus 0.027 USD of gas, or 45% to 105% of the fee. Proven in a batch on a marketplace pod, the GPU share falls to about 0.003 USD and the total to about 0.03 USD (30% of the fee). At home it is gas only.

---

## 6. What running the prover involves, by family

### 6.1 Common to all

- **Image with the fixed build path.** The guest image id must match the one pinned onchain. The repository's rule is "one fixed absolute path: the repository root is `/home/runner/work/jiro-ikusu/jiro-ikusu`" (`referee/zk/README.md:58`) [P, repository].
  - In a container that is simply the `WORKDIR` of the build stage: no bind mount is needed.
  - Build once with `--features cuda` and `NVCC_APPEND_FLAGS` for every target architecture. `-arch=native` targets only the build machine's GPU, and a builder with no GPU has no native target [P, risc0-gpu.md §2; I].
  - Then check `zk-host image-id` against the onchain `imageId()`, copy the binary and the `risc0-groth16` component into a slim runtime image on a CUDA 12.8+ base, and pin that image by digest.
  - The runtime path does not matter after the build: the guest ELF is embedded in the binary [I from risc0-gpu.md §6].
- **The prover needs no secret.**
  - The proof is a function of public chain data. Under ProofBounty, the payee is a public value inside the proof, so a copied proof pays the named payee (escrow/final.md §2).
  - The **hot key that pays gas** belongs to a separate small submitter, not to the GPU machine. That can be the home machine supervised by the agent, a cheap always-on CPU VM, or a cloud secret manager or KMS signer in the same project. The submitter should hold a capped ETH balance (about 0.0006 ETH buys roughly 50 settlements at 0.000012 ETH each [I]). The payee should be a cold address or a Safe (escrow/final.md, must-have 12).
- **Job trigger.** A queue of run ids fed by the prover loop (`RunCommitted` events, owner obligations first, then bounties by value per GPU-second, as in escrow/final.md C4). The GPU worker pulls one run id, rebuilds the run file from chain data, proves, and returns seal and public values. It holds no state except a cache by run id.
- **All-or-nothing proving.** The host keeps everything in memory and saves nothing until the proof is complete (context). Any interruption (spot reclaim, serverless timeout, OOM, a stopped pod) loses the whole run's work. On a 5090 that is 1.5 minutes for a 1e8 run, and up to 41 minutes for the worst case. Re-queue on failure. Prefer on-demand capacity for runs longer than a few minutes. Check the platform's maximum execution time against the worst case before accepting a run.
- **Data egress.** Inputs (six journals, a run file) and outputs (a 260-byte seal and about 2.3 KB of public values) are kilobytes: egress is negligible everywhere. The only bulk transfer is pulling the 8 GB image. Pull it from a registry in the same provider and region, or from a free public registry:
  - pulling into AWS is inbound traffic [P: listed separately from the 100 GB of free outbound];
  - RunPod charges "no fees for data ingress or egress" [P];
  - Modal egress is 0.04 USD/GB [P].
  - Pulling 8 GB from another cloud's registry on every cold start could cost the source cloud's internet egress per pull. I did not read registry egress prices.

### 6.2 Per family

| Family | Image and start-up | Trigger | Hot key | Spot or interruption | Egress | Effort to first proof |
|---|---|---|---|---|---|---|
| AWS EC2 (g4dn, g5, g6, g6e, g7, g7e, p5) | an AMI with the NVIDIA driver (or a Deep Learning AMI), the container image pulled from ECR; about 3 to 5 min to boot and pull [I] | SQS queue polled by a small agent, or AWS Batch | separate signer (KMS or a small instance) | spot "two-minute warning" [P]; monthly interruption bands 10 to over 20% for g4dn, g5, g6, g6e [P] | 100 GB free out per month [P] | **quota request first (default 0 for G and VT)** [P] |
| GCP Compute Engine (N1+T4, G2, A2, A3, G4) | a VM image with the driver, the image from Artifact Registry; 1-minute minimum then per second [P] | Pub/Sub, or Batch | Secret Manager or a KMS signer | spot notice 0 s by default, configurable 30 or 120 s [P] | not read | GPU quota for the type; default for a new project not found |
| **GCP Cloud Run (L4, RTX PRO 6000)** | container only, driver 580/CUDA 13.0 provided; "approximately 5 seconds" to a usable GPU, plus the image pull [P] | HTTP request (service) or a job execution per batch | separate | no spot; billed for the whole instance lifetime [P] | not read | 3 GPUs of quota granted on first deployment [P] |
| Azure VMs (T4, A10, A100, H100, RTX PRO 6000) | as AWS | Service Bus or Batch | Key Vault | Spot rows priced [P]; eviction notice not read | not read | vCPU family quota (default not read) |
| **Azure Container Apps serverless (T4, A100)** | container; driver 570, CUDA 12.x provided [P]; artifact streaming recommended | HTTP or Container Apps jobs | Key Vault | no spot | not read | "pay-as-you-go customers have A100 and T4 quota enabled by default" [P] |
| RunPod pods | container on a GPU host, per-second billing; stopping or terminating is up to the operator | the agent starts a pod, runs the batch, terminates it (API) | separate | community hosts may be less reliable than secure (not quantified) | "no fees for data ingress or egress" [P] | account and credit |
| **RunPod Serverless** | container; image pull while scaled down "not billed"; FlashBoot to cut cold starts [P] | HTTP endpoint with a queue (`/run`, `/status`) | separate | flex workers scale to zero; active workers run 24/7 [P] | none | account and credit |
| Vast.ai | Docker container on a third-party host; per-second billing | the agent rents, proves, destroys (API) | separate | interruptible (bid) instances can be outbid [P earlier] | per offer | account and credit; host quality varies |
| Modal | Python-defined container; "Containers boot in about one second", plus warm-up; `min_containers` keeps warm ones [P] | function call or web endpoint | Modal secrets | none | 0.04 USD/GB [P] | payment method for GPUs [P]; 30 USD per month of credit |
| Lambda, DigitalOcean, Paperspace, OVHcloud, Scaleway | ordinary VMs; Lambda per minute, DigitalOcean per second with a 5-minute minimum [P] | as AWS | separate | none published | not read | self-serve |
| CoreWeave | Kubernetes, single GPU only on GH200 (ARM host) | Kubernetes Jobs | Kubernetes secrets | spot prices on 8-GPU nodes [P] | not read | enterprise onboarding (not verified) |
| Hetzner GEX45/GEX63 | bare-metal server you install yourself; hourly or monthly plus a one-time setup fee equal to about one month [P] | as the home GPU | on the box or separate | none | not read | order and wait for provisioning (time not read) |
| **Home GPU** | the same image or a native build at the fixed path; always warm | the agent's local queue | on the home machine or a separate signer | power or network loss; the ISP; one machine | home upload, negligible | already there for the 3060 |

---

## 7. Home options in detail

| Item | RTX 3060 12 GB (owned) | RTX 5060 Ti 16 GB (to buy) | Tag |
|---|---|---|---|
| Price | 0 (sunk) | **from 799.00 EUR** (several models at 799 EUR; Geizhals data via hardwaredealz, read 2026-11-10) = 896 USD | S; I conversion |
| Board power | 170 W (NVIDIA: "Graphics card power (W) 170") | 180 W (Wikipedia RTX 50 table) | P / S |
| po2 | 19 | 20 (19 if the wrap runs out of memory) | S, I |
| 1e8 run | 569 to 1,314 s (9.5 to 22 min) | 350 to 543 s (5.8 to 9.1 min) | I |
| Energy per 1e8 run | 0.170 kW x 569 to 1,314 s / 3,600 = 0.027 to 0.062 kWh, = **0.0067 to 0.0155 EUR** | 0.180 x 350 to 543 / 3,600 = 0.0175 to 0.0271 kWh, = **0.0044 to 0.0068 EUR** | I |
| 16M run | 106 to 244 s; 0.0050 to 0.0115 kWh = **0.0012 to 0.0029 EUR** | 65 to 101 s; 0.0032 to 0.0050 kWh = **0.0008 to 0.0013 EUR** | I |
| 2.9e9 worst case | 2,766 segments x 0.8917 x 6.5 to 15 = 4.5 to 10.3 h | 2,766 x 0.8917 x 4.0 to 6.2 = 2.7 to 4.3 h | I |
| 1,000 runs of 1e8 | 158 to 365 h (6.6 to 15 days) | 97 to 151 h (4 to 6.3 days) | I |
| Idle cost to stay always on | not measured. If the whole PC idles at 60 W: 60 W x 720 h = 43.2 kWh = **10.8 EUR per month** | same assumption | I, estimate |

Card power only is counted per run. The CPU, the rest of the PC and the PSU losses are not, and they may add 30% to 60% (unmeasured estimate).

**When buying beats renting (break-even for the 5060 Ti) [I].** Runs = 896 USD / (rental cost per run − home energy per run), using the middle of each range:

| What the 5060 Ti replaces | Rent per run | Home energy per run | Break-even runs |
|---|---:|---:|---:|
| GCP g2 L4 on demand, busy, 1e8, factor 3 | 0.0516 | 0.0063 | 896 / 0.0453 = **19,800** |
| Vast.ai 5090 median, busy, 1e8 | 0.0202 | 0.0063 | 896 / 0.0139 = **64,300** |
| RunPod community 4090, busy, 1e8, factor 1.7 | 0.0141 | 0.0063 | 896 / 0.0078 = **114,900** |
| Vast.ai 5060 Ti median, busy, 1e8 | 0.0178 | 0.0063 | 896 / 0.0115 = about **78,000** |
| AWS g6.xlarge, cold VM per human-style request, factor 3 | 0.0780 | 0.0012 | 896 / 0.0768 = **11,700** |
| RunPod Serverless 5090, cold per human-style request | 0.0379 | 0.0012 | 896 / 0.0367 = **24,400** |
| Cloud Run L4, cold per human-style request, factor 3 | 0.0316 | 0.0012 | 896 / 0.0304 = **29,400** |

At 1,000 runs per season the card pays for itself in about **12 to 115 seasons**. On cost alone it does not pay. Its case rests on three other things:
- latency: always warm, so a bounty of a human-style run is served in 1 to 2 minutes;
- no vendor or quota dependency;
- 16 GB, which allows po2 20 and roughly halves the 3060's time.

A cheaper middle path is to rent a 5060 Ti on Vast.ai (0.143 USD/h) for the measurement before buying.

---

## 8. Spot, interruption and the all-or-nothing proof

- **Exposure per run is short on fast cards.** A 1e8 run is 1.3 to 9 minutes on most cards. AWS gives a two-minute warning [P]; GCP gives 0, 30 or 120 s depending on configuration [P].
  - The prover cannot checkpoint, so a warning only helps to stop pulling new jobs.
  - The expected loss is the interruption probability times the run time.
  - AWS publishes interruption frequency as a monthly band (10-15% to over 20% for the L4, A10G and L40S sizes) [P]. Over a few minutes the chance of losing a given run is small [I].
- **Spot fits** season batches of short runs, with automatic re-queueing.
- **Spot does not fit** the worst case (41 minutes on a 5090, hours on an L4) or deadline-bound bounties. Use on-demand or serverless capacity for those.
- **Serverless timeouts.** RunPod's execution timeout is configurable [P]. Cloud Run's and Container Apps' maximum request durations were not checked; Cloud Run jobs suit long runs.
- **Speculative proving (escrow/final.md C4)** shrinks the end-of-season risk more than any choice of cloud. It means proving at `RunCommitted`, not at the deadline.

---

## 9. Ranking by scenario

### 9.1 Testnet season, a few tens of runs

| Rank | Option | Why |
|---|---|---|
| 1 | **Home RTX 3060** | Already owned; about 2 to 4 minutes per human-style run and 10 to 22 minutes per bot run [I]; a few cents of electricity for the season. It is also the measurement the escrow plan requires before anything else (escrow/final.md, must-have 9). |
| 2 | RunPod pod RTX 4090 or 5090, community, rented by the hour | 0.34 to 0.69 USD/h; a few tens of runs in under an hour; about 1 USD in total. Fallback if the 3060 fails at po2 19 or on VRAM. |
| 3 | Vast.ai RTX 5060 Ti or 3090 | 0.14 to 0.23 USD/h; also measures the planned card before buying it. |
| 4 | GCP g2-standard-4 (L4), or Cloud Run L4 | Only if a hyperscaler is wanted for billing or trust. Cloud Run's automatic quota beats Compute Engine's request. |
| Avoid | AWS (quota request), A100 or H100 anywhere (5 to 30 times the cost for no gain at this scale), fractional GPUs (unverified) | |

### 9.2 1,000 runs per season, proven in batches

| Rank | Option | Season cost for 1,000 x 1e8 [I] | Why |
|---|---|---|---|
| 1 | **Home GPU proving continuously during the season** (5060 Ti, or 3060), triggered at `RunCommitted` | 4.9 to 7.6 USD of energy (5060 Ti); 7.5 to 17 USD (3060) | Cheapest. 1,000 runs need 4 to 6 days of 5060 Ti time, or 7 to 15 days of 3060 time, so this works only if proving is spread over the season, not packed into a 24 to 48 h grace. |
| 2 | **RunPod community 4090 or 5090 pods, several in parallel**, for the end-of-season burst and as a backstop | 12 to 17 USD | Cheapest rented capacity; per-second billing; ten pods turn about 40 GPU-hours into about 4 hours of wall time at the same cost. |
| 3 | Vast.ai 5090, 4090 or 3090 | 14 to 24 USD | Same economics; host quality varies; interruptible bids are cheaper still. |
| 4 | GCP g2 L4 spot (0.423 USD/h), or AWS g6 spot (about 0.41) | about 20 to 62 USD | When a large vendor's contract and invoice matter. Spot is acceptable for short runs with re-queueing. |
| 5 | GCP Cloud Run job on RTX PRO 6000 | 70 to 109 USD | Hyperscaler with no VM management and automatic quota; 5090-class speed. |
| Avoid | AWS/GCP/Azure A100, H100 or A10 on demand (107 to 671 USD), and anything billed hourly with a setup fee unless kept all season (Hetzner) | | |

### 9.3 Bounties served within about 10 minutes at any hour

The deadline is latency = queue wait + cold start + proving. A 2.9e9 run cannot meet it anywhere (41 minutes on a 5090), so the deadline rule must scale with cycles.

| Rank | Option | Latency for a 16M run / 1e8 run [I] | Cost | Why |
|---|---|---|---|---|
| 1 | **Home GPU, always on, plus a serverless overflow endpoint** | 3060: 2 to 4 min / 10 to 22 min (fails 10 min for bot runs). 5060 Ti: 1 to 2 min / 6 to 9 min | energy plus idle power (about 11 EUR/month, estimated); overflow per request below | Warm at all hours; the overflow covers queue peaks, large runs and outages. |
| 2 | **RunPod Serverless 32 GB (5090)** | about 1.3 min / 2.5 min including a 60 s cold start | 0.038 / 0.073 USD per request; zero when idle | Fastest scale-to-zero card found; per-second billing; image pull not billed. |
| 3 | **GCP Cloud Run RTX PRO 6000** | about 1.3 min / 2.5 to 3 min | 0.066 to 0.073 / 0.12 to 0.16 USD | The hyperscaler choice: same speed class, 3 GPUs of quota granted automatically, but a minimum instance of 20 vCPU and 80 GiB. |
| 4 | GCP Cloud Run L4, RunPod Serverless 24 GB, Modal L4 | 1.5 to 2.6 min / 4 to 10 min | 0.02 to 0.05 / 0.05 to 0.18 USD | Cheaper per hour but slow enough that a bot run may miss 10 minutes. |
| 5 | An always-on rented pod (RunPod community 4090) | 0.5 min / 2.5 min | 245 USD per month | Only if bounty volume pays for it. ProofBounty caps a bounty at 4 run fees, about 0.41 USD (escrow/final.md C3), so this needs about 600 or more bounties a month. |
| Avoid | Always-on hyperscaler VMs (379 to 5,026 USD per month); Azure Container Apps T4 (a slow card, 8 to 26 min per bot run) | | | |

---

## 10. Overall recommendation

1. **Measure first** (section 11): about 3 USD. Every number above rests on one third-party 5090 measurement of a different program.
2. Use the **home RTX 3060 for the testnet**. Decide on the RTX 5060 Ti after measuring one on Vast.ai: buy it if the 3060 cannot hold po2 19 with the wrap, or if bounty latency for bot runs matters.
3. Build **one pinned container image** (fixed build path, multi-architecture SASS, the Groth16 component inside) and run the same image at home, on RunPod pods for batches, and on one serverless endpoint as overflow. Keep the gas key outside it.
4. Do not use AWS or GCP Compute Engine for this workload unless a corporate contract is required. If a hyperscaler is required, **Google Cloud Run** (L4 or RTX PRO 6000) is the only one that fits both batch and on-demand use without a quota request.

---

## 11. Measurement protocol (a few dollars)

**Goal:** measure the real prover, this guest, at the pinned image id, on three cards that bracket the decision: an RTX 5090 (the reference), an L4 (the hyperscaler card), and an RTX 5060 Ti (the planned card). Add an RTX 3060 as a proxy for the owned card if the owner's own machine is not yet ready.

**Budget [I]:**

| Card | Where | Price | Time | Cost |
|---|---|---|---|---|
| RTX 5090 | RunPod community | 0.69 USD/h | 1 h | 0.69 USD |
| L4 | GCP g2-standard-8 (8 vCPU, so the CPU is not the limit), or Cloud Run L4 | 0.85 USD/h | 1.5 h | 1.28 USD |
| RTX 5060 Ti | Vast.ai median | 0.143 USD/h | 2 h | 0.29 USD |
| RTX 3060 | Vast.ai median | 0.082 USD/h | 3 h | 0.25 USD |
| **Total** | | | | **about 2.5 USD**, plus registry storage |

Build on the owner's machine or a CI runner, not on the rented GPU: building the CUDA kernels takes long, and a third party reports 1,094 s at `-j8` [S, risc0-gpu.md].

**Steps.**
1. **Build once.** In a Dockerfile whose build stage has `WORKDIR /home/runner/work/jiro-ikusu/jiro-ikusu`, add the opt-in `cuda` feature (risc0-gpu.md §5). Set `NVCC_APPEND_FLAGS` to generate code for sm_86, sm_89 and sm_120 (plus sm_75 and sm_90 if the T4 or H100 are tested). Run `cargo build --release --locked -p zk-host --features cuda`. Install the `risc0-groth16` component at `~/.risc0/extensions/v0.1.0-risc0-groth16`. Copy both into a runtime stage on an `nvidia/cuda:12.8` (or newer) runtime base. Push the image and record its digest and size.
2. **Check identity before anything.** On each instance, run `zk-host image-id` and compare it with `cast call <ZkReferee> 'imageId()(bytes32)'` on Arbitrum Sepolia. Stop if they differ.
3. **Record the machine.** `nvidia-smi -q` (GPU, driver, CUDA, VRAM, power limit), `lscpu` (model, vCPU), `free -g`, region or host id, and the price per hour at start.
4. **Time the cold start.** Measure from "instance requested" to "container running", and from "container running" to "first segment started". Record the image pull time separately.
5. **Calibrate against RISC Zero's own benchmark (optional, 10 minutes).** In a checkout of `v3.0.6`, run `cargo run -F cuda -r --example datasheet`. It prints RV32IM throughput per po2, and the lift, join, succinct, identity_p254 and groth16 times.
6. **Prove the real workloads**, three times each, with `zk-host prove --run <file> --season <file>` and `--payee` once M5.9 exists:
   - (a) a human-style run (the fixture `contracts/test/fixtures/zk-run.json`, or a recorded 15 to 18 M-cycle run);
   - (b) a bot run of about 1e8 cycles;
   - (c) on the 5090 only, one long run of about 1e9 cycles, to confirm linear scaling.
   - Use po2 20, then po2 19 on the 16 GB and 12 GB cards (also po2 20 on the 3060, to see whether it fails).
7. **Record per proof:**
   - cycles and segment count;
   - seconds for execute, the composite proof, the succinct compress and the Groth16 compress (wrap);
   - total wall time;
   - peak VRAM (`nvidia-smi --query-gpu=memory.used,power.draw --format=csv -lms 200`);
   - peak host RSS (the host already prints `peak_rss`);
   - average and peak GPU power;
   - the selector printed (`0x73c457ba`) and `verified: yes`.
8. **Verify onchain once per card.** Submit one seal to the deployed verifier on Arbitrum Sepolia (`eth_call` or a settlement), to confirm that GPU proofs verify like CPU proofs.
9. **Write the results** into `docs/VERIFICATION.md` as a table: card, po2, s per segment, s for recursion per segment, s for the wrap, totals for 16M and 1e8, peak VRAM, W, USD per run at the hour price. Then replace the factors of section 4.2 and rerun `scripts/compute.py`.
10. **Stop every instance**, and check the provider's billing page for the actual charge against the estimate.

---

## 12. Could not verify

1. **Any proving time on this guest, and any RISC Zero 3.x figure for T4, A10G, A100, L40S, H100, RTX 3060, 4060 Ti, 5060 Ti, RTX PRO 4500 or RTX PRO 6000.** Section 4.2 factors are estimates from hardware specifications, and they disagree with the one L4 measurement.
2. **RTX 3060 memory bandwidth:** NVIDIA's page gives the 192-bit bus but not the bandwidth; the 360 GB/s used for the low end is unverified. **RTX 4060 Ti** specifications were not obtained.
3. **Whether po2 20 fits 16 GB with the in-process STARK then wrap sequence on upstream**, and whether po2 19 fits 12 GB with the wrap.
4. **CUDA proving on fractional or vGPU slices** (AWS g6f, GCP G4 fractions, Azure NV A10 fractions and NC lds RTX PRO 6000 quarters).
5. **Current AWS spot prices:** the public feed is from 2024; spot is derived from the Spot Advisor savings of 2026-03-20.
6. **GCP T4 spot price; the default GPU quota of a new GCP project; Azure VM GPU quota defaults; Azure VM eviction notice.**
7. **Scaleway's official page** (HTTP 403 to automated fetches): the 0.75 EUR/h and per-minute billing are from a search summary. **OVHcloud billing granularity.** **Hetzner GEX63 price pairing** (page layout), Hetzner locations and provisioning time.
8. **Maximum request or execution duration** on Cloud Run services and Azure Container Apps.
9. **Registry egress** when an image is pulled across clouds.
10. **Cold-start times:** 60 s serverless and 300 s VM are assumptions, not measurements.
11. **Idle power of the owner's PC.**
12. **The euro price** of the RTX 5060 Ti is a tracker's figure (799 EUR), not a checkout; prices were reported rising in November 2026 [S].
13. **Lambda prices** quoted take effect on 2026-11-16; current ones need a login.
14. **CoreWeave single-GPU availability** beyond GH200, and its onboarding requirements.

---

## 13. Sources

All read on 2026-11-10 unless a date is given. "Undated" means the page shows no date.

1. Earlier research of this review: `scratchpad/research/risc0-gpu.md`, `scratchpad/research/proof-services.md` (2026-11-10), and the specification `scratchpad/escrow/final.md` (2026-11-10). Their own primary sources are listed there.
2. AWS EC2 on-demand price file, US East (N. Virginia), Linux: https://b0.p.awsstatic.com/pricing/2.0/meteredUnitMaps/ec2/USD/current/ec2-ondemand-without-sec-sel/US%20East%20(N.%20Virginia)/Linux/index.json (fetched 22:19 UTC).
3. AWS EC2 On-Demand pricing page: https://aws.amazon.com/ec2/pricing/on-demand/ (billing granularity, data transfer text).
4. AWS EC2 instance quotas: https://docs.aws.amazon.com/ec2/latest/instancetypes/ec2-instance-quotas.html
5. AWS Spot Instance Advisor data: https://spot-bid-advisor.s3.amazonaws.com/spot-advisor-data.json (Last-Modified 2026-03-20).
6. AWS legacy spot price feed: https://website.spot.ec2.aws.a2z.com/spot.js (Last-Modified 2024-05-13; not used).
7. AWS spot interruption notices: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/spot-instance-termination-notices.html
8. Google Cloud GPU pricing: https://cloud.google.com/products/compute/gpus-pricing (default region Iowa).
9. Google Cloud accelerator-optimized pricing: https://cloud.google.com/products/compute/pricing/accelerator-optimized ; general-purpose pricing (N1): https://cloud.google.com/products/compute/pricing/general-purpose
10. Google Cloud VM instance pricing, billing model: https://cloud.google.com/compute/vm-instance-pricing
11. Google Cloud Spot VMs: https://cloud.google.com/compute/docs/instances/spot
12. Google Cloud accelerator-optimized machines and quotas: https://cloud.google.com/compute/docs/accelerator-optimized-machines ; https://cloud.google.com/compute/resource-usage
13. Cloud Run pricing: https://cloud.google.com/run/pricing
14. Cloud Run GPU for services: https://cloud.google.com/run/docs/configuring/services/gpu
15. Cloud Run GPU for jobs: https://cloud.google.com/run/docs/configuring/jobs/gpu
16. Azure Retail Prices API: https://prices.azure.com/api/retail/prices with filters on `armSkuName` and `armRegionName eq 'eastus'` (Virtual Machines; Azure Container Apps).
17. Azure size pages on Microsoft Learn: https://learn.microsoft.com/en-us/azure/virtual-machines/sizes/gpu-accelerated/ncast4v3-series , /nvadsa10v5-series , /nca100v4-series , /ncadsh100v5-series (ms.date 2024-07-31), /nc-rtxpro6000-bse-v6-series (ms.date 2026-05-11).
18. Azure Container Apps serverless GPUs: https://learn.microsoft.com/en-us/azure/container-apps/gpu-serverless-overview (ms.date 2026-09-21).
19. Azure Container Apps workload profiles: https://learn.microsoft.com/en-us/azure/container-apps/workload-profiles-overview
20. RunPod pricing page: https://www.runpod.io/pricing ("Updated November 9, 2026").
21. RunPod public GraphQL API, `gpuTypes { securePrice communityPrice }`: https://api.runpod.io/graphql
22. RunPod pod pricing docs: https://docs.runpod.io/pods/pricing
23. RunPod Serverless pricing docs: https://docs.runpod.io/serverless/pricing
24. Vast.ai offers API: https://console.vast.ai/api/v0/bundles/ (verified, rentable, single-GPU offers, 2026-11-10 22:23 UTC; script `scratchpad/report/scripts/vast_stats.py`, raw files in `scratchpad/report/dl/vast/`).
25. Lambda pricing: https://lambda.ai/pricing ("These prices take effect November 16, 2026").
26. Lambda billing docs: https://docs.lambda.ai/public-cloud/billing/
27. Modal pricing: https://modal.com/pricing
28. Modal cold start guide: https://modal.com/docs/guide/cold-start
29. Modal GPU guide: https://modal.com/docs/guide/gpu
30. CoreWeave pricing: https://www.coreweave.com/pricing
31. DigitalOcean GPU Droplets pricing: https://www.digitalocean.com/pricing/gpu-droplets
32. Paperspace pricing: https://www.paperspace.com/pricing
33. Scaleway pricing page https://www.scaleway.com/en/pricing/gpu/ (HTTP 403 to automated fetch); figures from a web search summary of that page and the Scaleway FAQ (secondary).
34. Scaleway public product API: https://api.scaleway.com/instance/v1/zones/fr-par-2/products/servers (GPU types; prices returned as 0.0).
35. OVHcloud Public Cloud prices: https://www.ovhcloud.com/en/public-cloud/prices/
36. Hetzner GPU dedicated servers: https://www.hetzner.com/dedicated-rootserver/matrix-gpu/
37. Web search for RISC Zero 3.x per-GPU benchmarks (results: hemilabs/risc0 PR 13, Fenbushi 2025-08-29, zkbenchmarks.com, babybear-labs), 2026-11-10.
38. Wikipedia, List of Nvidia graphics processing units: https://en.wikipedia.org/wiki/List_of_Nvidia_graphics_processing_units (T4, A10, A100, H100, L4, L40S, RTX PRO 4000/4500/6000 Blackwell rows); GeForce RTX 50 series wikitext: https://en.wikipedia.org/w/index.php?title=GeForce_RTX_50_series&action=raw (5060 Ti, 5090 bandwidth, FP32, TDP; RTX 5090 supply reports of October 2026 citing Tom's Hardware, TechPowerUp and TweakTown).
39. NVIDIA GeForce RTX 3060 family specifications: https://www.nvidia.com/en-us/geforce/graphics-cards/30-series/rtx-3060-3060ti/
40. RTX 5060 Ti 16 GB euro prices: https://www.hardwaredealz.com/hardware/gpu/nvidia-geforce-rtx-5060-ti-16gb ("ab 799,00 €", Geizhals price feed; page undated); search results of 2026-11-10 including bestvaluegpu.com and wccftech.com on November price rises (secondary).
41. ECB euro reference rates: https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml (2026-11-10: USD 1.1214).
42. Coinbase ETH-USD spot: https://api.coinbase.com/v2/prices/ETH-USD/spot (2026-11-10 22:29 UTC: 2,050.545).
43. Repository, read only: `referee/zk/README.md` (fixed build path, line 58); `contracts/test/fixtures/zk-run.json` (exists).

Working files: `scratchpad/report/scripts/compute.py` (all derived numbers), `scratchpad/report/compute_out.md` (its output), `scratchpad/report/scripts/vast_stats.py`, downloads in `scratchpad/report/dl/`.
