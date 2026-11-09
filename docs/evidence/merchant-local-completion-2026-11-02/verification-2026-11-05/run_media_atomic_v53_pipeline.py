from pathlib import Path
import subprocess,json,datetime,os,sys
from qualify import ROOT,E,snapshot,write
source='merchant-media-atomic-source-v53'
s=json.loads((E/(source+'.source.json')).read_text()); assert snapshot()['files']==s['files']
stages=[
 ('shared-types-build',['pnpm','--filter','@letbuyy/shared-types','build','--force'],ROOT),
 ('cms-typecheck',['pnpm','--filter','@letbuyy/cms-core','typecheck'],ROOT),
 ('gateway-typecheck',['pnpm','--filter','@letbuyy/api-gateway','typecheck'],ROOT),
 ('ts-client-typecheck',['pnpm','--filter','@letbuyy/api-client','typecheck'],ROOT),
 ('merchant-typecheck',['pnpm','--filter','@letbuyy/merchant-web','typecheck'],ROOT),
 ('gateway-unit',['node','--import','tsx','--test',*map(str,sorted((ROOT/'services/api-gateway/src/__tests__').glob('*.test.ts')))],ROOT),
 ('root-contracts',['node','--import','tsx','--test',*map(str,sorted((ROOT/'tests/contracts').glob('*.test.ts'))),*map(str,sorted((ROOT/'tests/contracts').glob('*.test.mjs')))],ROOT),
 ('shared-tests',['pnpm','--filter','@letbuyy/shared-types','test'],ROOT),
 ('gateway-db-lane',['node','--test','tests/governance/gateway-db-lane.test.mjs'],ROOT),
]
results=[]
write(E/'media-atomic-v53-pipeline.active.json',{'supervisor_pid':os.getpid(),'source_sha256':s['sha256'],'status':'RUNNING'})
for label,command,cwd in stages:
 assert snapshot()['files']==s['files']
 print('Starting '+label,flush=True)
 with (E/('media-atomic-v53-'+label+'.log')).open('x') as log:
  proc=subprocess.run(command,cwd=cwd,stdout=log,stderr=subprocess.STDOUT)
 unchanged=snapshot()['files']==s['files']
 receipt={'stage':label,'exit_code':proc.returncode,'source_unchanged':unchanged,'source_sha256':s['sha256'],'command':command,'cwd':str(cwd)}
 results.append(receipt);write(E/('media-atomic-v53-'+label+'.terminal.json'),receipt)
 if proc.returncode or not unchanged: break
if len(results)==len(stages) and all(r['exit_code']==0 and r['source_unchanged'] for r in results):
 print('Starting disposable governance capsule',flush=True)
 proc=subprocess.run(['python3',str(E/'merchant_media_atomic_v53_governance_capsule.py')],cwd=ROOT)
 results.append({'stage':'isolated-governance','exit_code':proc.returncode,'source_unchanged':snapshot()['files']==s['files']})
status='PASS' if len(results)==len(stages)+1 and all(r['exit_code']==0 and r['source_unchanged'] for r in results) else 'FAIL'
write(E/'media-atomic-v53-pipeline.terminal.json',{'status':status,'source_sha256':s['sha256'],'results':results,'finished_at':datetime.datetime.now(datetime.timezone.utc).isoformat()})
print(status,flush=True);sys.exit(status!='PASS')
