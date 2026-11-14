from pathlib import Path
import subprocess,os,json,datetime,shutil
w=Path('/tmp/letbuyy-mobile-performance-20261030');out=w/'http2-sensitivity';out.mkdir(exist_ok=True);env={**os.environ,'CHROME_PATH':subprocess.check_output(['node','-e',"process.stdout.write(require('@playwright/test').chromium.executablePath())"],text=True).strip()};rows=[]
baseline=w/'pre-strict-css-http2-sensitivity'
rows=[{**r,'reused_frozen_baseline':True,'source_captured_at':json.loads((baseline/'summary.json').read_text())['captured_at']}for r in json.loads((baseline/'summary.json').read_text())['rows']if r['variant']=='baseline']
for file in baseline.glob('baseline-*'):shutil.copy2(file,out/file.name)
for variant,port in [('candidate',9041)]:
 for name,path in [('home','/in'),('pricing','/in/pricing'),('setup-guide','/in/resources/platform/building-first-letbuyy-store')]:
  file=out/(variant+'-'+name+'.json');cmd=['npm','exec','--yes','--prefix','/tmp/letbuyy-seo-closeout-20261030/perf','--package=lighthouse@13.6.0','--','lighthouse',f'https://127.0.0.1:{port}'+path,'--chrome-flags=--headless --no-first-run --ignore-certificate-errors','--only-categories=performance','--output=json','--output-path='+str(file),'--quiet','--max-wait-for-load=45000']
  with file.with_suffix('.log').open('w')as f:r=subprocess.run(cmd,env=env,stdout=f,stderr=subprocess.STDOUT,timeout=180)
  row={'variant':variant,'port':port,'page':name,'exit_code':r.returncode}
  if not r.returncode:
   d=json.loads(file.read_text());a=d['audits'];row.update(lcp_ms=a['largest-contentful-paint']['numericValue'],tbt_ms=a['total-blocking-time']['numericValue'],cls=a['cumulative-layout-shift']['numericValue'],performance=d['categories']['performance']['score'],protocols=sorted(set(x.get('protocol','')for x in a['network-requests']['details']['items'])))
  rows.append(row);(out/'summary.json').write_text(json.dumps({'captured_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'method':'Additional default-simulated mobile A/B via read-only local TLS HTTP/2 proxy to the SAME frozen baseline and candidate artifacts. Self-signed local certificate accepted only by this diagnostic Chrome run; does not replace original HTTP/1.1 results or certify deployed protocols/field experience. Baseline rows reuse the unchanged frozen artifact measurements from this same session; their source timestamp is retained.','rows':rows},indent=2));print(json.dumps(row),flush=True)
