from pathlib import Path
import subprocess,json,datetime,os,sys
from qualify import ROOT,E,snapshot,write
source='merchant-media-feedback-source-v54';s=json.loads((E/(source+'.source.json')).read_text());assert snapshot()['files']==s['files']
f='/Users/saai_mithra/Library/Developer/flutter/bin/flutter';app=ROOT/'apps/merchant/mobile'
files=sorted(map(str,(app/'test').glob('media_*test.dart')))+['test/inventory_feedback_test.dart']
stages=[('focused-media-feedback',[f,'test','--no-pub','--reporter','expanded',*files]),('flutter-full',[f,'test','--no-pub','--reporter','expanded']),('flutter-analysis',[f,'analyze','--no-pub'])];results=[]
write(E/'media-feedback-v54-pipeline.active.json',{'supervisor_pid':os.getpid(),'source_sha256':s['sha256'],'status':'RUNNING'})
for label,command in stages:
 assert snapshot()['files']==s['files'];print('Starting '+label,flush=True)
 with(E/('media-feedback-v54-'+label+'.log')).open('x')as log:r=subprocess.run(command,cwd=app,stdout=log,stderr=subprocess.STDOUT)
 row={'stage':label,'exit_code':r.returncode,'source_unchanged':snapshot()['files']==s['files'],'source_sha256':s['sha256'],'command':command};results.append(row);write(E/('media-feedback-v54-'+label+'.terminal.json'),row)
 if r.returncode or not row['source_unchanged']:break
if len(results)==len(stages)and all(x['exit_code']==0 and x['source_unchanged']for x in results):
 print('Starting isolated governance',flush=True);r=subprocess.run(['python3',str(E/'merchant_media_feedback_v54_governance_capsule.py')],cwd=ROOT);results.append({'stage':'isolated-governance','exit_code':r.returncode,'source_unchanged':snapshot()['files']==s['files']})
status='PASS'if len(results)==len(stages)+1 and all(x['exit_code']==0 and x['source_unchanged']for x in results)else'FAIL';write(E/'media-feedback-v54-pipeline.terminal.json',{'status':status,'source_sha256':s['sha256'],'results':results,'finished_at':datetime.datetime.now(datetime.timezone.utc).isoformat()});print(status,flush=True);sys.exit(status!='PASS')
