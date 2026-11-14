import os,pathlib,subprocess,json,datetime
w=pathlib.Path('/tmp/letbuyy-seo-closeout-20261030');out=w/'lighthouse';out.mkdir(exist_ok=True)
chrome=subprocess.check_output(['node','-e',"process.stdout.write(require('@playwright/test').chromium.executablePath())"],text=True).strip();env={**os.environ,'CHROME_PATH':chrome};runs=[(name,9038,path,mode)for name,path in [('home','/in'),('pricing','/in/pricing'),('setup-guide','/in/resources/platform/building-first-letbuyy-store')]for mode in ['mobile','desktop']]
summary=[]
for name,port,path,mode in runs:
 target=out/f'{name}-{mode}.json';cmd=['npm','exec','--yes','--prefix',str(w/'perf'),'--package=lighthouse@13.6.0','--','lighthouse',f'http://127.0.0.1:{port}{path}','--chrome-flags=--headless --no-first-run','--only-categories=performance,accessibility,best-practices,seo','--output=json','--output-path='+str(target),'--quiet','--max-wait-for-load=45000']
 if mode=='desktop':cmd+=['--preset=desktop']
 with (out/f'{name}-{mode}.log').open('w')as log:
  try:r=subprocess.run(cmd,env=env,stdout=log,stderr=subprocess.STDOUT,timeout=180);code=r.returncode
  except subprocess.TimeoutExpired:code=124
 row={'name':name,'path':path,'port':port,'mode':mode,'exit_code':code}
 if code==0:
  data=json.loads(target.read_text());a=data['audits'];row.update(scores={k:v['score']for k,v in data['categories'].items()},lcp_ms=a['largest-contentful-paint']['numericValue'],cls=a['cumulative-layout-shift']['numericValue'],tbt_ms=a['total-blocking-time']['numericValue'],fcp_ms=a['first-contentful-paint']['numericValue'],failed_audits=[{'id':k,'title':v['title'],'score':v.get('score')}for k,v in a.items()if v.get('score')is not None and v.get('score')<1 and v.get('scoreDisplayMode')in['binary','numeric']]);row['runtime_error']=data.get('runtimeError')
 summary.append(row);(out/'summary.json').write_text(json.dumps({'captured_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'measurement':'Lighthouse lab data on local production artifacts; not CrUX or INP field measurement','rows':summary},indent=2));print(json.dumps(row),flush=True)
