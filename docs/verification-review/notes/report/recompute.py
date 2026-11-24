T1E8, T16 = 87.57, 16.24
def row(name, price, lo, hi, cold):
    a = (T1E8*lo, T1E8*hi); b = (T16*lo, T16*hi)
    busy = tuple(price*x/3600 for x in a)
    busy16 = tuple(price*x/3600 for x in b)
    coldreq = tuple(price*(cold+x)/3600 for x in b)
    cold1e8 = tuple(price*(cold+x)/3600 for x in a)
    season = tuple(price*(1000*x+cold)/3600 for x in a)
    print(f"{name:42s} {price:6.3f}/h | 1e8 {a[0]:5.0f}-{a[1]:5.0f}s ${busy[0]:.4f}-{busy[1]:.4f} | 16M {b[0]:4.0f}-{b[1]:4.0f}s ${busy16[0]:.4f}-{busy16[1]:.4f} | cold16 ${coldreq[0]:.4f}-{coldreq[1]:.4f} | cold1e8 ${cold1e8[0]:.4f}-{cold1e8[1]:.4f} | 1000 ${season[0]:.1f}-{season[1]:.1f}")
L4=(1.67,1.86)
row('AWS g6.xlarge L4 on demand',0.8048,*L4,300)
row('AWS g6.xlarge L4 spot (tracker 0.592)',0.592,*L4,300)
row('GCE g2-standard-4 L4 on demand',0.7068,*L4,300)
row('GCE g2-standard-4 L4 spot',0.4230,*L4,300)
row('Cloud Run L4, zonal off',1.0465,*L4,60)
row('Cloud Run L4, zonal on (default)',0.0002909*3600+4*0.000018*3600+16*0.000002*3600,*L4,60)
row('Cloud Run PRO6000, zonal off',3.1868,0.9,1.4,60)
row('Cloud Run PRO6000, zonal on',0.00056913*3600+20*0.000018*3600+80*0.000002*3600,0.9,1.4,60)
row('Modal L4',1.1157,*L4,60)
row('RunPod serverless 24GB (L4 class)',0.75,*L4,60)
row('RunPod pod L4 community',0.44,*L4,300)
row('AWS g7e.2xlarge PRO6000 on demand',3.36312,0.9,1.4,300)
row('AWS g7e.2xlarge spot (tracker 2.012)',2.012,0.9,1.4,300)
row('RunPod 4090 community',0.34,1.5,1.9,300)
row('RunPod 5090 community',0.69,1,1,300)
row('RunPod serverless 5090',1.79,1,1,60)
row('Vast 5090 median',0.83,1,1,300)
row('Vast 5060Ti median',0.143,4.0,6.2,300)
print()
# break-even
for capex_eur in (617,799):
    capex=capex_eur*1.1214
    e1e8=0.0063; e16=0.0012
    cases={
     'GCE g2 L4 busy 1e8 @1.76x': 0.7068*T1E8*1.76/3600 - e1e8,
     'Vast 5090 busy 1e8': 0.83*T1E8/3600 - e1e8,
     'RunPod 4090 community busy 1e8 @1.7x': 0.34*T1E8*1.7/3600 - e1e8,
     'Vast 5060Ti busy 1e8 @5.1x': 0.143*T1E8*5.1/3600 - e1e8,
     'AWS g6 cold 16M @1.76x': 0.8048*(300+T16*1.76)/3600 - e16,
     'RunPod serverless 5090 cold 16M': 1.79*(60+T16)/3600 - e16,
     'Cloud Run L4 cold 16M @1.76x (zonal off)': 1.0465*(60+T16*1.76)/3600 - e16,
    }
    print('capex EUR',capex_eur,'USD',round(capex))
    for k,v in cases.items():
        print(f'   {k:45s} saving/run {v:.4f} -> break-even {capex/v:,.0f}')
# energy with whole PC
for name,w,lo,hi in (('3060',170,569,1314),('5060Ti',180,350,543)):
    for mult in (1.0,1.5,1.8):
        print(name,mult, [round(w*mult*t/3.6e6*0.25,4) for t in (lo,hi)], 'EUR per 1e8')
# worst case times
seg=2766
print('worst 5090 min', (seg*0.8917+1.97)/60, 'L4 h', [(seg*0.8917*f)/3600 for f in L4], 'PRO6000 min', [(seg*0.8917*f)/60 for f in (0.9,1.4)])
# always-on 4090 pod vs bounty cap
print('bounties/month to pay 245 at 0.41:', 245/0.41)
# cold serverless share of fee
fee=0.1025
print('human cold serverless range', (0.019+0.027)/fee, (0.08+0.027)/fee)
