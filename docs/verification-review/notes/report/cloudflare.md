# Cloudflare figures used in the report (section 6, row K)

Written 2026-11-11 to record where the figures of row K come from. The facts were read on 2026-11-10 through Cloudflare's documentation search, during the main review session; they were not part of a research note until now.

## Facts read (third-party)

| Fact | Source page |
|---|---|
| Container instance types go up to `standard-4`: 4 vCPU, 12 GiB of memory, 20 GB of disk. Custom instance types are bounded by `standard-4`. | https://developers.cloudflare.com/containers/platform/limits/ and the changelog entry https://developers.cloudflare.com/changelog/post/2025-10-01-new-container-instance-types/ |
| Containers on the Workers Paid plan: 375 vCPU-minutes per month included, then 0.000020 USD per vCPU-second; 25 GiB-hours per month included, then 0.0000025 USD per GiB-second. | https://developers.cloudflare.com/containers/platform/pricing/ |
| Workers: 128 MB of memory per isolate, up to 5 minutes of CPU time per request on paid plans. | https://developers.cloudflare.com/workers/platform/limits/ |
| Queues support HTTP pull consumers, so a prover outside Cloudflare can pull jobs. | https://developers.cloudflare.com/queues/configuration/pull-consumers/ |
| No GPU is offered to custom container code. Workers AI runs Cloudflare's own model catalogue on GPUs, not user programs. | Containers limits and pricing pages above (no GPU instance type listed) |

## Arithmetic (estimate)

- One `standard-4` container hour, beyond the included allowance: 4 x 0.000020 x 3,600 = 0.288 USD of vCPU, plus 12 x 0.0000025 x 3,600 = 0.108 USD of memory. Disk is left out. Total: about 0.40 USD per hour.
- CPU proving time on 4 cores, from the repository's rates: 1.5 to 2.1 hours for a human-style run of 16 segments (report section 11), 9 to 17 hours for a whole bot run (report section 3).
- Cost per run: 1.5 x 0.40 = 0.60 USD at the low end, 17 x 0.40 = 6.8 USD at the high end. The report rounds this to "about 0.6 to 7 USD per run on CPU".
- Corrected on 2026-11-11, after the fourth check of the report: the human-style time read 1.4 to 2.4 hours, which is the range for 15 to 18 segments. The rounded figure does not move.

## Not checked

- Whether a Cloudflare vCPU proves at the rate of the 4 CPUs the repository measured on.
- Whether the Groth16 step can run there at all: on a CPU it runs in an x86 Docker image, and running Docker inside a Cloudflare container was not checked. The figure above may therefore cover only the part that can run.
- Disk pricing and egress.

## Conclusion used in the report

Cloudflare is not a place to prove: no GPU for custom code, and CPU proving there costs 6 to 70 times the run fee. It remains a good front door: a Worker for the request API and a Queue that a prover elsewhere pulls from.
