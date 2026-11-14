import pathlib,requests,json
rows=[]
for path in ['/in/seo-audit-missing-20261030','/in/resources/payments/seo-audit-missing-20261030','/in/resources/seo-audit-missing-20261030']:
 r=requests.get('http://127.0.0.1:9007'+path,headers={'User-Agent':'Googlebot'},timeout=15);rows.append({'path':path,'status':r.status_code,'passed':r.status_code==404})
p=pathlib.Path('reports/letbuyy-seo-local-repair-2026-10-30/evidence/error-page-probes.json');p.write_text(json.dumps({'rows':rows,'passed':all(x['passed']for x in rows)},indent=2));print(json.dumps(rows))
