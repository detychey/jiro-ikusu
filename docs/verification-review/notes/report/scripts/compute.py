"""Derived numbers for the cloud prover benchmark. Every input is listed with its source tag in cloud.md."""
import math

EUR_USD = 1.1214          # ECB reference rate 2026-11-10
ETH_USD = 2050.545        # Coinbase spot 2026-11-10 22:29 UTC
RUN_FEE_USD = 0.00005 * ETH_USD

SEG = 2 ** 20
# RTX 5090, upstream v3.0.6 (hemilabs PR 21 via risc0-gpu.md): segment 0.5658 s, recursion 0.3259 s, wrap 1.97 s
SEG_5090 = 0.5658 + 0.3259
WRAP_5090 = 1.97


def t5090(cycles):
    return math.ceil(cycles / SEG) * SEG_5090 + WRAP_5090


T_1E8 = t5090(1e8)
T_16M = t5090(16e6)

# Time factor relative to a 5090, low and high; see cloud.md section 4 for the basis of each.
FACTOR = {
    "RTX 5090": (1.0, 1.0),
    "RTX PRO 6000": (0.9, 1.4),
    "H100": (0.9, 2.9),
    "RTX 4090": (1.5, 1.9),
    "L40S": (1.1, 2.9),
    "RTX PRO 4500": (1.9, 2.8),
    "L4": (1.9, 6.0),
    "A100": (1.2, 7.5),
    "A10/A10G": (3.0, 4.7),
    "RTX 3090": (2.5, 3.3),
    "RTX PRO 4000 SFF": (4.1, 6.1),
    "RTX 5060 Ti": (4.0, 6.2),
    "RTX 3060 (po2 19)": (6.5, 15.0),
    "T4": (5.6, 18.0),
}

COLD_SERVERLESS_S = 60    # assumed billed cold start, image already cached on the host
COLD_VM_S = 300           # assumed: VM boot, 8 GB image pull, first key read; billed

# name, gpu key, USD/h on demand, spot USD/h or None, kind ('vm','serverless','monthly'), min billed seconds
OPTIONS = [
    ("AWS g4dn.xlarge", "T4", 0.526, 0.526 * 0.40, "vm", 60),
    ("AWS g5.xlarge", "A10/A10G", 1.006, 1.006 * 0.44, "vm", 60),
    ("AWS g6.xlarge", "L4", 0.8048, 0.8048 * 0.51, "vm", 60),
    ("AWS g6e.xlarge", "L40S", 1.861, 1.861 * 0.50, "vm", 60),
    ("AWS g7.2xlarge", "RTX PRO 4500", 2.52, None, "vm", 60),
    ("AWS g7e.2xlarge", "RTX PRO 6000", 3.36312, 3.36312 * 0.32, "vm", 60),
    ("AWS p5.4xlarge", "H100", 6.88, 6.88 * 0.91, "vm", 60),
    ("GCP n1-standard-4 + T4", "T4", 0.189999 + 0.35, None, "vm", 60),
    ("GCP g2-standard-4", "L4", 0.706832276, 0.423016, "vm", 60),
    ("GCP a2-highgpu-1g", "A100", 3.673385, 2.188015, "vm", 60),
    ("GCP a3-highgpu-1g (spot/flex only)", "H100", None, 52.700460712 / 8, "vm", 60),
    ("GCP g4-standard-48", "RTX PRO 6000", 4.49993, 1.71778, "vm", 60),
    ("GCP Cloud Run L4 (4 vCPU, 16 GiB)", "L4", 0.0001867 * 3600 + 4 * 0.000018 * 3600 + 16 * 0.000002 * 3600, None, "serverless", 1),
    ("GCP Cloud Run RTX PRO 6000 (20 vCPU, 80 GiB)", "RTX PRO 6000", 0.00036522 * 3600 + 20 * 0.000018 * 3600 + 80 * 0.000002 * 3600, None, "serverless", 1),
    ("Azure NC4as_T4_v3", "T4", 0.526, 0.164059, "vm", 60),
    ("Azure NV36ads_A10_v5", "A10/A10G", 3.2, 0.59136, "vm", 60),
    ("Azure NC24ads_A100_v4", "A100", 3.673, 0.67877, "vm", 60),
    ("Azure NC40ads_H100_v5", "H100", 6.98, 1.418336, "vm", 60),
    ("Azure Container Apps T4 (4 vCPU, 16 GiB)", "T4", 0.000073 * 3600 + 4 * 0.000024 * 3600 + 16 * 0.000003 * 3600, None, "serverless", 1),
    ("Azure Container Apps A100 (8 vCPU, 32 GiB)", "A100", 0.000529 * 3600 + 8 * 0.000024 * 3600 + 32 * 0.000003 * 3600, None, "serverless", 1),
    ("RunPod pod RTX 5090 community", "RTX 5090", 0.69, None, "vm", 1),
    ("RunPod pod RTX 5090 secure", "RTX 5090", 1.19, None, "vm", 1),
    ("RunPod pod RTX 4090 community", "RTX 4090", 0.34, None, "vm", 1),
    ("RunPod pod RTX 4090 secure", "RTX 4090", 0.89, None, "vm", 1),
    ("RunPod pod L4 community", "L4", 0.44, None, "vm", 1),
    ("RunPod pod RTX PRO 4500 community", "RTX PRO 4500", 0.34, None, "vm", 1),
    ("RunPod pod RTX PRO 6000 community", "RTX PRO 6000", 1.69, None, "vm", 1),
    ("RunPod serverless 32 GB (5090)", "RTX 5090", 1.79, None, "serverless", 1),
    ("RunPod serverless 24 GB (4090 PRO)", "RTX 4090", 1.34, None, "serverless", 1),
    ("RunPod serverless 24 GB (L4, A5000, 3090)", "L4", 0.75, None, "serverless", 1),
    ("RunPod serverless 32 GB (RTX PRO 4500)", "RTX PRO 4500", 1.15, None, "serverless", 1),
    ("Vast.ai RTX 5090 median", "RTX 5090", 0.830, 0.533, "vm", 1),
    ("Vast.ai RTX 4090 median", "RTX 4090", 0.513, 0.360, "vm", 1),
    ("Vast.ai RTX 3090 median", "RTX 3090", 0.229, 0.147, "vm", 1),
    ("Vast.ai RTX 5060 Ti median", "RTX 5060 Ti", 0.143, 0.117, "vm", 1),
    ("Lambda A10 (from 2026-11-16)", "A10/A10G", 1.29, None, "vm", 60),
    ("Lambda A100 40 GB (from 2026-11-16)", "A100", 1.99, None, "vm", 60),
    ("Lambda H100 PCIe (from 2026-11-16)", "H100", 3.79, None, "vm", 60),
    ("Modal L4 (4 cores, 16 GiB)", "L4", 0.000222 * 3600 + 4 * 0.0000131 * 3600 + 16 * 0.00000222 * 3600, None, "serverless", 1),
    ("Modal L40S (4 cores, 16 GiB)", "L40S", 0.000542 * 3600 + 4 * 0.0000131 * 3600 + 16 * 0.00000222 * 3600, None, "serverless", 1),
    ("Modal RTX PRO 6000 (4 cores, 16 GiB)", "RTX PRO 6000", 0.000842 * 3600 + 4 * 0.0000131 * 3600 + 16 * 0.00000222 * 3600, None, "serverless", 1),
    ("DigitalOcean L40S", "L40S", 1.57, None, "vm", 300),
    ("OVHcloud l4-90", "L4", 1.00, None, "vm", 3600),
    ("OVHcloud l40s-90", "L40S", 1.80, None, "vm", 3600),
    ("Scaleway L4-1-24G (EUR 0.75)", "L4", 0.75 * EUR_USD, None, "vm", 60),
    ("Hetzner GEX45 hourly (EUR 0.3429 + EUR 209 setup)", "RTX PRO 4000 SFF", 0.3429 * EUR_USD, None, "monthly", 3600),
]


def fmt(x, d=3):
    return f"{x:.{d}f}"


def run_cost(price, seconds, min_s):
    return price * max(seconds, min_s) / 3600


def rows():
    out = []
    for name, gpu, od, spot, kind, min_s in OPTIONS:
        lo, hi = FACTOR[gpu]
        t1e8 = (T_1E8 * lo, T_1E8 * hi)
        t16 = (T_16M * lo, T_16M * hi)
        price = od if od is not None else spot
        cold = COLD_SERVERLESS_S if kind == "serverless" else COLD_VM_S
        busy_1e8 = tuple(price * t / 3600 for t in t1e8)
        busy_16 = tuple(price * t / 3600 for t in t16)
        cold_16 = tuple(run_cost(price, cold + t, min_s) for t in t16)
        cold_1e8 = tuple(run_cost(price, cold + t, min_s) for t in t1e8)
        season = {n: tuple(price * (n * t + cold) / 3600 for t in t1e8) for n in (100, 1000, 10000)}
        hours = {n: tuple(n * t / 3600 for t in t1e8) for n in (100, 1000, 10000)}
        month = price * 720
        out.append(dict(name=name, gpu=gpu, od=od, spot=spot, price=price, t1e8=t1e8, t16=t16,
                        busy_1e8=busy_1e8, busy_16=busy_16, cold_16=cold_16, cold_1e8=cold_1e8,
                        season=season, hours=hours, month=month, kind=kind))
    return out


def home():
    res = {}
    for name, gpu, watts, capex_eur in (("RTX 3060 12 GB, owned", "RTX 3060 (po2 19)", 170, 0.0),
                                        ("RTX 5060 Ti 16 GB, bought", "RTX 5060 Ti", 180, 799.0)):
        lo, hi = FACTOR[gpu]
        r = {}
        for label, base in (("1e8", T_1E8), ("16M", T_16M)):
            t = (base * lo, base * hi)
            kwh = tuple(watts / 1000 * x / 3600 for x in t)
            eur = tuple(k * 0.25 for k in kwh)
            r[label] = dict(t=t, kwh=kwh, eur=eur, usd=tuple(e * EUR_USD for e in eur))
        r["capex_usd"] = capex_eur * EUR_USD
        res[name] = r
    return res


if __name__ == "__main__":
    print(f"T_1E8 on 5090 = ceil(1e8/2^20)={math.ceil(1e8/SEG)} x {SEG_5090:.4f} + {WRAP_5090} = {T_1E8:.2f} s")
    print(f"T_16M on 5090 = ceil(16e6/2^20)={math.ceil(16e6/SEG)} x {SEG_5090:.4f} + {WRAP_5090} = {T_16M:.2f} s")
    print(f"run fee = 0.00005 x {ETH_USD} = {RUN_FEE_USD:.4f} USD")
    print()
    print("| Option | GPU | USD/h on demand | USD/h spot | s per 1e8 run | USD per 1e8 run busy | s per 16M run | USD per 16M run busy | USD one cold 16M request | USD one cold 1e8 request | Season 100 / 1,000 / 10,000 runs of 1e8, USD | GPU-hours for 10,000 | Always on 30 days, USD |")
    print("|---|---|---:|---:|---|---|---|---|---|---|---|---|---:|")
    for r in rows():
        rng = lambda p, d=3: f"{fmt(p[0], d)} to {fmt(p[1], d)}"
        s = r["season"]
        print(f"| {r['name']} | {r['gpu']} | {fmt(r['od'],4) if r['od'] else 'n/a'} | {fmt(r['spot'],4) if r['spot'] else 'n/a'} | "
              f"{rng(r['t1e8'],0)} | {rng(r['busy_1e8'],4)} | {rng(r['t16'],0)} | {rng(r['busy_16'],4)} | {rng(r['cold_16'],4)} | {rng(r['cold_1e8'],4)} | "
              f"{rng(s[100],2)} / {rng(s[1000],1)} / {rng(s[10000],0)} | {rng(r['hours'][10000],0)} | {fmt(r['month'],0)} |")
    print()
    for name, r in home().items():
        print(name)
        for k in ("1e8", "16M"):
            v = r[k]
            print(f"  {k}: {v['t'][0]:.0f} to {v['t'][1]:.0f} s; {v['kwh'][0]:.4f} to {v['kwh'][1]:.4f} kWh; EUR {v['eur'][0]:.4f} to {v['eur'][1]:.4f}; USD {v['usd'][0]:.4f} to {v['usd'][1]:.4f}")
        print(f"  capex USD {r['capex_usd']:.2f}")
    # break-even for the 5060 Ti against a few rental references (USD per run)
    h = home()["RTX 5060 Ti 16 GB, bought"]
    capex = h["capex_usd"]
    refs = {
        "Vast 5090 median busy, 1e8": 0.830 * T_1E8 / 3600,
        "RunPod 4090 community busy, 1e8 (mid 1.7x)": 0.34 * T_1E8 * 1.7 / 3600,
        "GCP g2 L4 busy, 1e8 (mid 3x)": 0.706832276 * T_1E8 * 3.0 / 3600,
        "RunPod serverless 5090 cold, 16M": 1.79 * (COLD_SERVERLESS_S + T_16M) / 3600,
        "Cloud Run L4 cold, 16M (mid 3x)": (0.0001867 * 3600 + 0.2592 + 0.1152) * (COLD_SERVERLESS_S + T_16M * 3.0) / 3600,
        "AWS g6.xlarge cold VM, 16M (mid 3x)": 0.8048 * (COLD_VM_S + T_16M * 3.0) / 3600,
    }
    print()
    for k, rent in refs.items():
        for label in ("1e8", "16M"):
            pass
        own = sum(h["1e8"]["usd"]) / 2 if "1e8" in k else sum(h["16M"]["usd"]) / 2
        n = capex / (rent - own) if rent > own else float("inf")
        print(f"break-even 5060 Ti vs {k}: rent {rent:.4f} USD, own energy {own:.4f} USD, runs = {capex:.2f} / ({rent:.4f} - {own:.4f}) = {n:,.0f}")
