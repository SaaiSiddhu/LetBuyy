from pathlib import Path
import subprocess,json,datetime,os,sys,hashlib
from qualify import ROOT,E,snapshot,write
source='merchant-media-recovery-source-v28'
s=json.loads((E/(source+'.source.json')).read_text()); assert snapshot()['files']==s['files']
stages=[
 ('gateway-db-lane',['node','--test','tests/governance/gateway-db-lane.test.mjs'],ROOT),
 ('dart-client-tests',['/Users/saai_mithra/Library/Developer/flutter/bin/dart','test','--reporter','expanded'],ROOT/'packages/dart/api_client'),
 ('dart-client-analysis',['/Users/saai_mithra/Library/Developer/flutter/bin/dart','analyze'],ROOT/'packages/dart/api_client'),
 ('flutter-full',['/Users/saai_mithra/Library/Developer/flutter/bin/flutter','test','--no-pub','--reporter','expanded'],ROOT/'apps/merchant/mobile'),
 ('flutter-analysis',['/Users/saai_mithra/Library/Developer/flutter/bin/flutter','analyze','--no-pub'],ROOT/'apps/merchant/mobile'),
 ('media-visual',['env','LETBUYY_MEDIA_RECOVERY_VISUAL_DIR='+str(E/'media-recovery-rendered-v28'),'/Users/saai_mithra/Library/Developer/flutter/bin/flutter','test','--no-pub',str(E/'media_recovery_visual_v22_test.dart'),'--reporter','expanded'],ROOT/'apps/merchant/mobile'),
]
results=[]
write(E/'media-v28-pipeline.active.json',{'supervisor_pid':os.getpid(),'source_sha256':s['sha256'],'status':'RUNNING'})
for label,command,cwd in stages:
 assert snapshot()['files']==s['files']
 print('Starting '+label,flush=True)
 with (E/('media-v28-'+label+'.log')).open('x') as log:
  proc=subprocess.run(command,cwd=cwd,stdout=log,stderr=subprocess.STDOUT)
 unchanged=snapshot()['files']==s['files']
 receipt={'stage':label,'exit_code':proc.returncode,'source_unchanged':unchanged,'source_sha256':s['sha256'],'command':command,'cwd':str(cwd)}
 results.append(receipt);write(E/('media-v28-'+label+'.terminal.json'),receipt)
 if proc.returncode or not unchanged: break
if len(results)==len(stages) and all(r['exit_code']==0 and r['source_unchanged'] for r in results):
 print('Starting disposable governance capsule',flush=True)
 proc=subprocess.run(['python3',str(E/'merchant_media_recovery_v28_governance_capsule.py')],cwd=ROOT)
 results.append({'stage':'isolated-governance','exit_code':proc.returncode,'source_unchanged':snapshot()['files']==s['files']})
status='PASS' if len(results)==len(stages)+1 and all(r['exit_code']==0 and r['source_unchanged'] for r in results) else 'FAIL'
write(E/'media-v28-pipeline.terminal.json',{'status':status,'source_sha256':s['sha256'],'results':results,'finished_at':datetime.datetime.now(datetime.timezone.utc).isoformat()})
print(status,flush=True);sys.exit(status!='PASS')
