import re,html,sys
t=open(sys.argv[1],errors='replace').read()
s=re.sub(r'<script.*?</script>',' ',t,flags=re.S); s=re.sub(r'<style.*?</style>',' ',s,flags=re.S); s=re.sub(r'<[^>]+>',' ',s); s=html.unescape(s); s=re.sub(r'\s+',' ',s)
open(sys.argv[1]+'.txt','w').write(s)
n=int(sys.argv[3]) if len(sys.argv)>3 else 2
for k in sys.argv[2].split('|'):
  for x in list(re.finditer(k,s))[:n]: print('>>',k,':',s[max(0,x.start()-120):x.start()+260])
