from pathlib import Path
import subprocess,json,datetime,sys,os
from qualify import ROOT,E,snapshot,write
source='merchant-recovery-source-v15'
s=json.loads((E/(source+'.source.json')).read_text());assert snapshot()['files']==s['files']
checks={};write(E/'recovery-v15-pipeline.active.json',{'supervisor_pid':os.getpid(),'source_sha256':s['sha256'],'status':'RUNNING'})
flutter='/Users/saai_mithra/Library/Developer/flutter/bin/flutter'
stages=[('flutter-v15-regression',[flutter,'test','--no-pub','--reporter','expanded']),('flutter-v15-analysis',[flutter,'analyze','--no-pub']),('kyc-recovery-visual-v5',['env','LETBUYY_KYC_RECOVERY_VISUAL_DIR='+str(E/'kyc-recovery-rendered-v5'),flutter,'test','--no-pub',str(E/'kyc_recovery_visual_v5_test.dart'),'--timeout','45s','--reporter','expanded'])]
for label,command in stages:
 print('Starting '+label,flush=True)
 r=subprocess.run(['python3',str(E/'qualify.py'),'run',source,label,*command],cwd=ROOT)
 checks[label]=r.returncode
 if r.returncode:break
if all(c==0 for c in checks.values())and len(checks)==3:
 print('Starting isolated governance capsule; working checkout cleanup forbidden',flush=True)
 r=subprocess.run(['python3',str(E/'merchant_recovery_v15_governance_capsule.py')],cwd=ROOT);checks['isolated-governance']=r.returncode
result={'finished_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source_sha256':s['sha256'],'checks':checks,'source_unchanged':snapshot()['files']==s['files']}
result['status']='PASS'if len(checks)==4 and all(c==0 for c in checks.values())and result['source_unchanged']else'FAIL'
write(E/'recovery-v15-pipeline.terminal.json',result);print(json.dumps(result));sys.exit(0 if result['status']=='PASS'else 1)
