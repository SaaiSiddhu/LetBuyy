from pathlib import Path
import subprocess,json,datetime,hashlib
from qualify import ROOT,E,snapshot,write
name='merchant-editor-feedback-source-v62';source=json.loads((E/(name+'.source.json')).read_text());assert snapshot()['files']==source['files']
stages=[('analysis',['python3',str(E/'qualify.py'),'run',name,'editor-feedback-v62-analysis','/Users/saai_mithra/Library/Developer/flutter/bin/flutter','analyze','--no-pub']),('full-flutter',['python3',str(E/'qualify.py'),'run',name,'editor-feedback-v62-full-flutter','/Users/saai_mithra/Library/Developer/flutter/bin/flutter','test','--no-pub','--reporter','expanded']),('governance',['python3',str(E/'merchant_editor_feedback_v62_governance_capsule.py')])]
results=[]
for label,args in stages:
 if snapshot()['files']!=source['files']:raise RuntimeError('Source drift before '+label)
 with(E/('editor-feedback-v62-'+label+'-supervisor.log')).open('x')as log:p=subprocess.run(args,cwd=ROOT,stdout=log,stderr=subprocess.STDOUT)
 results.append({'stage':label,'exit':p.returncode,'source_unchanged':snapshot()['files']==source['files']});write(E/'editor-feedback-v62-pipeline.progress.json',{'results':results})
 if p.returncode or not results[-1]['source_unchanged']:
  write(E/'editor-feedback-v62-pipeline.terminal.json',{'status':'FAILED','results':results,'source_sha256':source['sha256']});raise SystemExit(1)
write(E/'editor-feedback-v62-pipeline.terminal.json',{'status':'PASS','source_sha256':source['sha256'],'results':results,'finished_at':datetime.datetime.now(datetime.timezone.utc).isoformat()});print('Editor feedback62 qualification PASS',flush=True)
