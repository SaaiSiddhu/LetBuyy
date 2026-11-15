from pathlib import Path
import subprocess,json,datetime,os,sys,hashlib
from qualify import ROOT,E,snapshot,write
source='merchant-kyc-receipt-source-v44'
s=json.loads((E/(source+'.source.json')).read_text()); assert snapshot()['files']==s['files']
stages=[
 ('merchant-typecheck',['pnpm','--filter','@letbuyy/merchant-web','typecheck'],ROOT),
 ('merchant-read-security',['node','--import','tsx','--test','tests/owned-store-resolution.test.mjs','tests/private-intake-readback.test.ts','tests/settings-read-contract.test.ts'],ROOT/'apps/merchant/web'),
 ('root-contracts',['node','--import','tsx','--test','tests/contracts/*.test.ts','tests/contracts/*.test.mjs'],ROOT),
]
# Expand test globs as explicit argv; never pass through a shell.
stages=[(label,command[:4]+[str(p.relative_to(ROOT)) for pattern in ['*.test.ts','*.test.mjs'] for p in sorted((ROOT/'tests/contracts').glob(pattern))],cwd)if label=='root-contracts'else(label,command,cwd)for label,command,cwd in stages]
results=[]
write(E/'kyc-receipt-v44-pipeline.active.json',{'supervisor_pid':os.getpid(),'source_sha256':s['sha256'],'status':'RUNNING'})
for label,command,cwd in stages:
 assert snapshot()['files']==s['files']
 print('Starting '+label,flush=True)
 with (E/('kyc-receipt-v44-'+label+'.log')).open('x') as log:
  proc=subprocess.run(command,cwd=cwd,stdout=log,stderr=subprocess.STDOUT)
 unchanged=snapshot()['files']==s['files']
 receipt={'stage':label,'exit_code':proc.returncode,'source_unchanged':unchanged,'source_sha256':s['sha256'],'command':command,'cwd':str(cwd)}
 results.append(receipt);write(E/('kyc-receipt-v44-'+label+'.terminal.json'),receipt)
 if proc.returncode or not unchanged: break
if len(results)==len(stages) and all(r['exit_code']==0 and r['source_unchanged'] for r in results):
 print('Starting disposable governance capsule',flush=True)
 proc=subprocess.run(['python3',str(E/'merchant_kyc_receipt_v44_governance_capsule.py')],cwd=ROOT)
 results.append({'stage':'isolated-governance','exit_code':proc.returncode,'source_unchanged':snapshot()['files']==s['files']})
status='PASS' if len(results)==len(stages)+1 and all(r['exit_code']==0 and r['source_unchanged'] for r in results) else 'FAIL'
write(E/'kyc-receipt-v44-pipeline.terminal.json',{'status':status,'source_sha256':s['sha256'],'results':results,'finished_at':datetime.datetime.now(datetime.timezone.utc).isoformat()})
print(status,flush=True);sys.exit(status!='PASS')
