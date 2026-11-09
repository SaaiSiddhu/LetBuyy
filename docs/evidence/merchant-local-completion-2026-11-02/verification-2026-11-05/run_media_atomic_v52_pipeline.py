from pathlib import Path
import subprocess,json,datetime,sys,os
from qualify import ROOT,E,snapshot,write
source='merchant-media-atomic-source-v52'
s=json.loads((E/(source+'.source.json')).read_text());before=json.loads((E/'merchant-media-atomic-source-v51.source.json').read_text())
assert snapshot()['files']==s['files']
changed=sorted(p for p in set(s['files'])|set(before['files'])if s['files'].get(p)!=before['files'].get(p));assert changed==['tests/governance/gateway-db-lane.test.mjs']
prior=json.loads((E/'media-atomic-v51-pipeline.terminal.json').read_text())
reused=[x for x in prior['results']if x['stage']!='gateway-db-lane'];assert len(reused)==8 and all(x['exit_code']==0 and x['source_unchanged']for x in reused)
results=[];write(E/'media-atomic-v52-pipeline.active.json',{'supervisor_pid':os.getpid(),'source_sha256':s['sha256'],'status':'RUNNING'})
cmd=['node','--test','tests/governance/gateway-db-lane.test.mjs']
with(E/'media-atomic-v52-gateway-db-lane.log').open('x')as log:r=subprocess.run(cmd,cwd=ROOT,stdout=log,stderr=subprocess.STDOUT)
results.append({'stage':'gateway-db-lane','exit_code':r.returncode,'source_unchanged':snapshot()['files']==s['files']})
if not r.returncode and results[0]['source_unchanged']:
 print('Reviewed gateway database lane passed. Starting isolated governance.',flush=True)
 r=subprocess.run(['python3',str(E/'merchant_media_atomic_v52_governance_capsule.py')],cwd=ROOT)
 results.append({'stage':'isolated-governance','exit_code':r.returncode,'source_unchanged':snapshot()['files']==s['files']})
status='PASS'if len(results)==2 and all(x['exit_code']==0 and x['source_unchanged']for x in results)else'FAIL'
write(E/'media-atomic-v52-pipeline.terminal.json',{'status':status,'source_sha256':s['sha256'],'results':results,'reused_source51_gates':reused,'reuse_proof':{'only_change':changed,'scope':'Only reviewed gate inventory changed. No runtime, request schema, SDK, owned fixture, migration, application or other test input changed. Source51 passing gates reused; the failed catalog case is replaced by its actual52rerun.'},'finished_at':datetime.datetime.now(datetime.timezone.utc).isoformat()})
print(status,flush=True);sys.exit(status!='PASS')
