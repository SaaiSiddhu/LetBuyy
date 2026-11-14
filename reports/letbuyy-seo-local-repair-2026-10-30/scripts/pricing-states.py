import pathlib,json,time,requests,datetime,re
from bs4 import BeautifulSoup
T=pathlib.Path('/tmp/letbuyy-seo-repair-20261030');rows=[]
for mode in ['ready','counter_error','empty','pricing_error','timeout']:
 (T/'gateway-mode.txt').write_text(mode);t=time.monotonic();res=requests.get('http://127.0.0.1:9007/in/pricing',headers={'User-Agent':'Googlebot'},timeout=20);s=BeautifulSoup(res.text,'html.parser');text=s.select_one('#pricing').get_text(' ',strip=True);unavailable='Pricing is temporarily unavailable.'in text;cards=s.select('article.pricing-plan-card');row={'mode':mode,'status':res.status_code,'seconds':round(time.monotonic()-t,3),'heading':s.h1.get_text(' ',strip=True),'cards':len(cards),'fixture_plan_in_initial_html':'SEO fixture Launch'in text,'founding_price_in_initial_html':bool(re.search(r'₹\s*31\.25',text)),'regular_price_in_initial_html':bool(re.search(r'₹\s*37\.25',text)),'unavailable':unavailable,'text':text[:1200]}
 expected=(mode in['ready','counter_error'])
 row['passed']=res.status_code==200 and (row['fixture_plan_in_initial_html']if expected else not row['fixture_plan_in_initial_html']) and (row['founding_price_in_initial_html']if expected else True) and (unavailable if mode in['pricing_error','timeout']else not unavailable)
 rows.append(row);print(mode,row['passed'],row['seconds'],flush=True)
(T/'gateway-mode.txt').write_text('ready');path=pathlib.Path('reports/letbuyy-seo-local-repair-2026-10-30/evidence/pricing-states.json');path.write_text(json.dumps({'captured_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'method':'Raw initial HTML, synthetic public gateway fixtures. Not actual commercial prices.','rows':rows,'passed':all(x['passed']for x in rows)},ensure_ascii=False,indent=2))
