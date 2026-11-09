from pathlib import Path
import subprocess,json,datetime,sys
from qualify import ROOT,E,snapshot,write
s=json.loads((E/'merchant-recovery-source-v13.source.json').read_text());assert snapshot()['files']==s['files']
report={'source_sha256':s['sha256'],'started_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'checks':{}}
for label,args,cwd in [('analysis',['/Users/saai_mithra/Library/Developer/flutter/bin/flutter','analyze','--no-pub'],ROOT/'apps/merchant/mobile'),('governance',['node','scripts/validate-governance.mjs'],ROOT)]:
 with(E/('recovery-v13-'+label+'.log')).open('x')as log:r=subprocess.run(args,cwd=cwd,stdout=log,stderr=subprocess.STDOUT)
 report['checks'][label]={'exit_code':r.returncode}
 if r.returncode:break
report.update(finished_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),source_unchanged=snapshot()['files']==s['files'])
report['status']='PASS'if len(report['checks'])==2 and all(x['exit_code']==0 for x in report['checks'].values())and report['source_unchanged']else'FAIL'
write(E/'recovery-v13-independent-local-gates.json',report);print(json.dumps(report));sys.exit(0 if report['status']=='PASS'else 1)
