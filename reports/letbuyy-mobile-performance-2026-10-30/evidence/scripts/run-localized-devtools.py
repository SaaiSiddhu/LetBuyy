from pathlib import Path
import subprocess,os,json,datetime
w=Path('/tmp/letbuyy-mobile-performance-20261030');out=w/'localized-devtools';out.mkdir(exist_ok=True);env={**os.environ,'CHROME_PATH':subprocess.check_output(['node','-e',"process.stdout.write(require('@playwright/test').chromium.executablePath())"],text=True).strip()};build_id=(w/'candidate/apps/marketing/web/.next/BUILD_ID').read_text().strip();prior=json.loads((out/'summary.json').read_text())if(out/'summary.json').exists()else{};assert not prior or prior.get('build_id')==build_id;rows=prior.get('rows',[])
for name,path in [('hindi-home','/in-hi'),('tamil-home','/in-ta'),('hindi-home-repeat','/in-hi'),('tamil-home-repeat','/in-ta'),('hindi-pricing','/in-hi/pricing'),('tamil-pricing','/in-ta/pricing')]:
 if any(row['name']==name and row['exit_code']==0 for row in rows):continue
 target=out/(name+'.json');cmd=['npm','exec','--yes','--prefix',str(Path('/tmp/letbuyy-seo-closeout-20261030/perf')),'--package=lighthouse@13.6.0','--','lighthouse','http://127.0.0.1:9039'+path,'--chrome-flags=--headless --no-first-run','--throttling-method=devtools','--only-categories=performance,accessibility,best-practices,seo','--output=json','--output-path='+str(target),'--quiet','--max-wait-for-load=45000']
 with(out/(name+'.log')).open('w')as f:r=subprocess.run(cmd,env=env,stdout=f,stderr=subprocess.STDOUT,timeout=180)
 row={'name':name,'path':path,'exit_code':r.returncode}
 if r.returncode==0:
  d=json.loads(target.read_text());a=d['audits'];row.update(scores={k:v['score']for k,v in d['categories'].items()},lcp_ms=a['largest-contentful-paint']['numericValue'],cls=a['cumulative-layout-shift']['numericValue'],tbt_ms=a['total-blocking-time']['numericValue'],throttling=d['configSettings']['throttling'],method=d['configSettings']['throttlingMethod'])
 rows.append(row);(out/'summary.json').write_text(json.dumps({'captured_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'build_id':build_id,'method':'Actual DevTools network/CPU throttling; separate from the default simulated Lantern model; no field data','rows':rows},indent=2));print(json.dumps(row),flush=True)
