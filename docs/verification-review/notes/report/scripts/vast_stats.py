import json, sys, subprocess, statistics, datetime, urllib.parse, os

OUT = sys.argv[1]
GPUS = ["RTX 5090","RTX 4090","RTX 3090","RTX 5080","RTX 5070 Ti","RTX 5060 Ti","RTX 4060 Ti","RTX 3060","Tesla T4","L4","A10","L40S","A100 PCIE","A100 SXM4","H100 PCIE","H100 SXM","RTX PRO 6000 WS","RTX PRO 6000 S"]

def fetch(gpu, kind):
    q = {"verified": {"eq": True}, "rentable": {"eq": True}, "rented": {"eq": False},
         "num_gpus": {"eq": 1}, "gpu_name": {"eq": gpu}, "type": kind,
         "order": [["dph_total", "asc"]], "limit": 500}
    path = os.path.join(OUT, f"vast_api_{gpu.replace(' ', '_')}_{kind}.json")
    cmd = ["curl", "-sS", "-G", "-A", "generic-research-client", "--max-time", "40", "-o", path,
           "https://console.vast.ai/api/v0/bundles/", "--data-urlencode", "q=" + json.dumps(q)]
    subprocess.run(cmd, check=True)
    with open(path) as f:
        return json.load(f).get("offers", [])

print("read at", datetime.datetime.utcnow().isoformat() + "Z")
print("gpu | type | offers | min | p25 | median | p75 | vram_GB(median) | cpu_ram_GB(median) | cores_eff(median)")
for gpu in GPUS:
    for kind in ("on-demand", "bid"):
        offers = fetch(gpu, kind)
        key = "dph_total" if kind == "on-demand" else "min_bid"
        prices = sorted(o[key] for o in offers if o.get(key))
        if not prices:
            print(f"{gpu} | {kind} | 0")
            continue
        q = statistics.quantiles(prices, n=4) if len(prices) >= 4 else [prices[0], statistics.median(prices), prices[-1]]
        vram = statistics.median(o["gpu_ram"] for o in offers) / 1024
        ram = statistics.median(o["cpu_ram"] for o in offers) / 1024
        cores = statistics.median(o["cpu_cores_effective"] for o in offers)
        print(f"{gpu} | {kind} | {len(prices)} | {prices[0]:.3f} | {q[0]:.3f} | {statistics.median(prices):.3f} | {q[2]:.3f} | {vram:.0f} | {ram:.0f} | {cores:.0f}")
