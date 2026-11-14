import pathlib,json,requests,datetime
from bs4 import BeautifulSoup
rows=[]
for path,headers,want in [('/',{'Accept-Language':'hi-IN,hi;q=0.9'},'hi'),('/',{'Accept-Language':'ta-IN,ta;q=0.9'},'ta'),('/',{'Accept-Language':'en-IN,en;q=0.9'},'en'),('/in',{'Accept-Language':'ta-IN,ta;q=0.9'},'en'),('/in-ta',{'x-letbuyy-locale':'in','Accept-Language':'en-IN'},'ta')]:
 r=requests.get('http://127.0.0.1:9007'+path,headers=headers,allow_redirects=False,timeout=15);s=BeautifulSoup(r.text,'html.parser');loc=r.headers.get('Location','');lang=s.html.get('lang')if s.html else None
 passed=(r.status_code==307 and loc.endswith({'hi':'/in-hi','ta':'/in-ta','en':'/in'}[want])and'no-store'in r.headers.get('Cache-Control','')and'Accept-Language'in r.headers.get('Vary',''))if path=='/'else r.status_code==200 and lang==want
 rows.append({'path':path,'request_headers':headers,'status':r.status_code,'location':loc,'root_lang':lang,'cache_control':r.headers.get('Cache-Control'),'vary':r.headers.get('Vary'),'passed':passed})
p=pathlib.Path('reports/letbuyy-seo-local-repair-2026-10-30/evidence/locale-probes.json');p.write_text(json.dumps({'captured_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'rows':rows,'passed':all(x['passed']for x in rows)},indent=2));print(json.dumps(rows,indent=2))
