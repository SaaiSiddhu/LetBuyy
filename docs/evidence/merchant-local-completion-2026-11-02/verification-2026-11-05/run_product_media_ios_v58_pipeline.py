from qualify import ROOT,E,snapshot,write
import subprocess,json,datetime,os
source=json.loads((E/'merchant-product-media-ios-source-v58.source.json').read_text());assert snapshot()['files']==source['files']
stages=[('root-contracts',['node','--import','tsx','--test',*map(str,sorted((ROOT/'tests/contracts').glob('*.test.ts'))),*map(str,sorted((ROOT/'tests/contracts').glob('*.test.mjs')))],ROOT),('identity-unit',['pnpm','test'],ROOT/'apps/platform/identity'),('identity-types',['pnpm','exec','tsc','--noEmit','--incremental','false'],ROOT/'apps/platform/identity'),('shared-ui-unit',['pnpm','test'],ROOT/'packages/typescript/ui'),('shared-ui-build',['pnpm','build'],ROOT/'packages/typescript/ui'),('governance',['python3',str(E/'merchant_product_media_ios_v58_governance_capsule.py')],ROOT)]
results=[]
write(E/'product-media-ios-v58-pipeline.active.json',{'supervisor_pid':os.getpid(),'status':'RUNNING','source_sha256':source['sha256']})
for label,cmd,cwd in stages:
 assert snapshot()['files']==source['files']
 with(E/('product-media-ios-v58-'+label+'.log')).open('x')as log:result=subprocess.run(cmd,cwd=cwd,stdout=log,stderr=subprocess.STDOUT)
 state={'stage':label,'exit':result.returncode,'source_unchanged':snapshot()['files']==source['files'],'command':cmd,'cwd':str(cwd)};results.append(state);print(json.dumps(state),flush=True)
 if result.returncode or not state['source_unchanged']:break
ok=len(results)==len(stages)and all(x['exit']==0 and x['source_unchanged']for x in results)
write(E/'product-media-ios-v58-pipeline.terminal.json',{'status':'PASS'if ok else'FAIL','source_sha256':source['sha256'],'results':results,'finished_at':datetime.datetime.now(datetime.timezone.utc).isoformat()})
raise SystemExit(0 if ok else 1)
