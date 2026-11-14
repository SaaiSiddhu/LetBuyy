from pathlib import Path
import subprocess,json,datetime,time,urllib.request,os
r=Path.cwd();w=Path('/tmp/letbuyy-mobile-performance-20261030');buildtime=(w/'candidate/apps/marketing/web/.next/BUILD_ID').stat().st_mtime
while True:
 try:
  p=w/'acceptance-stages.json';s=json.loads(p.read_text())
  if p.stat().st_mtime>buildtime and len(s)==7:
   assert all(x['exit_code']==0 for x in s),s
   break
 except (FileNotFoundError,json.JSONDecodeError):pass
 time.sleep(10)
rows=[]
def run(name,cmd,timeout=1000):
 print(name+' started',flush=True)
 with(w/(name+'.log')).open('w')as f:
  try:code=subprocess.run(cmd,stdout=f,stderr=subprocess.STDOUT,timeout=timeout).returncode
  except subprocess.TimeoutExpired:code=124
 rows.append({'stage':name,'exit_code':code,'finished_at':datetime.datetime.now(datetime.timezone.utc).isoformat()});(w/'final-qa-stages.json').write_text(json.dumps(rows,indent=2));print(name+' finished '+str(code),flush=True)
 return code
for name,script in [('visual-acceptance','visual-compare.cjs'),('scroll-acceptance','scroll-visual.cjs'),('spa-acceptance','spa-cascade.cjs'),('capability-acceptance','capability-acceptance.cjs')]:run(name,['node',str(w/script)])
results=[json.loads((w/n).read_text())for n in ['visual-comparison.json','scroll-visual.json','spa-cascade.json']];design={'captured_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'build_id':(w/'candidate/apps/marketing/web/.next/BUILD_ID').read_text().strip(),'visual_cases':len(results[0]['rows']),'natural_scroll_cases':len(results[1]['rows']),'client_navigation_cases':len(results[2]['rows']),'passed':all(x['exit_code']==0 for x in rows)};(w/'design-acceptance.json').write_text(json.dumps(design,indent=2))
proxylog=(w/'pricing-proxy.log').open('w');proxy=subprocess.Popen(['node',str(w/'pricing-proxy.cjs')],stdout=proxylog,stderr=subprocess.STDOUT)
serverlog=(w/'pricing-recovery-server.log').open('w');server=subprocess.Popen(['pnpm','exec','next','start','--hostname','127.0.0.1','--port','9043'],cwd=w/'candidate/apps/marketing/web',env={**os.environ,'LETBUYY_API_URL':'http://127.0.0.1:9042/v1','NEXT_PUBLIC_MARKETING_URL':'http://127.0.0.1:9039','NEXT_PUBLIC_ACCOUNTS_URL':'http://localhost:9002'},stdout=serverlog,stderr=subprocess.STDOUT)
(w/'pricing-processes.json').write_text(json.dumps({'proxy_pid':proxy.pid,'server_parent_pid':server.pid,'ports':[9042,9043]}))
for i in range(40):
 try:
  with urllib.request.urlopen('http://127.0.0.1:9043/robots.txt',timeout=2)as res:assert res.status==200
  break
 except Exception:time.sleep(.5)
run('pricing-recovery',['node',str(w/'pricing-recovery.cjs')],300)
run('normal-local-smoke',['node',str(w/'normal-local-smoke.cjs')],300)
for name,cmd in [('types-final',['pnpm','--dir','apps/marketing/web','typecheck']),('lint-final',['pnpm','--dir','apps/marketing/web','lint']),('tests-final',['pnpm','--dir','apps/marketing/web','test']),('marketing-validator-final',['node','scripts/validators/marketing-dead-twin-validator.mjs']),('package-export-validator-final',['node','scripts/validators/package-export-validator.mjs'])]:run(name,cmd,300)
assert all(x['exit_code']==0 for x in rows),rows
print('All final QA stages passed',flush=True)
