"""Read-only verification of the audit inventory on an explicitly supplied loopback server.
Run in the installed SEO skill's managed Python environment (bs4/requests).
The isolated production server used for this run has a synthetic public pricing gateway.
"""
import json,pathlib,urllib.parse as U,concurrent.futures,time,csv,datetime,xml.etree.ElementTree as E,requests
from bs4 import BeautifulSoup
ROOT=pathlib.Path(__file__).resolve().parents[3]
OUT=pathlib.Path(__file__).resolve().parents[1]
BASE='http://127.0.0.1:9007';ORIGIN='http://localhost:9006'
prior=json.loads((ROOT/'reports/letbuyy.com-comprehensive-audit-2026-10-29/evidence/crawl.json').read_text())
paths=sorted({U.urlsplit(p['url']).path for p in prior['pages'] if p.get('status')==200 and p.get('title') and p.get('evidence_html') and U.urlsplit(p['url']).path.startswith(('/in','/in-hi','/in-ta'))})
# Prior inventory also contains one deliberately invalid tag probe, checked separately below.
paths = [path for path in paths if not path.endswith('/tag/seo-audit-nonexistent-20261029')]
assert len(paths)==489,len(paths)
selected=['/in','/in-hi','/in-ta','/in/pricing','/in-hi/pricing','/in-ta/pricing','/in/resources/payments','/in/resources/payments/gst-for-ecommerce-india','/in-hi/resources/ecommerce/how-product-reviews-increase-conversion','/in-ta/resources/platform/merchant-web-guide','/in/create','/in/resources/search']
def inspect(path):
 t=time.monotonic();res=requests.get(BASE+path,headers={'User-Agent':'Googlebot'},timeout=30);s=BeautifulSoup(res.text,'html.parser');issues=[]
 canonical=[t.get('href')for t in s.find_all('link')if'canonical'in t.get('rel',[])];meta={t.get('name')or t.get('property'):t.get('content')for t in s.find_all('meta')};title=s.title.get_text(' ',strip=True)if s.title else '';heads=[h.get_text(' ',strip=True)for h in s.find_all('h1')];segment=path.split('/')[1];lang={'in':'en','in-hi':'hi','in-ta':'ta'}[segment];url=ORIGIN+path
 if res.status_code!=200:issues.append('status '+str(res.status_code))
 if canonical!=[url]:issues.append('canonical '+str(canonical))
 if not title:issues.append('missing title')
 if title.lower().count('letbuyy')>1:issues.append('duplicate brand in title')
 if not s.html or s.html.get('lang')!=lang:issues.append('root language')
 if len(heads)!=1:issues.append('H1 count '+str(len(heads)))
 if meta.get('og:url')!=url:issues.append('og:url '+str(meta.get('og:url')))
 if meta.get('og:locale')!=lang+'_IN':issues.append('og:locale')
 if not meta.get('og:image'):issues.append('og:image missing')
 noindex=any('noindex'in (t.get('content')or'')for t in s.find_all('meta')if t.get('name')in['robots','googlebot'])
 expected=path.endswith(('/create','/demo','/resources/search'))
 if noindex!=expected:issues.append('index policy')
 alts={t.get('hreflang'):t.get('href')for t in s.find_all('link',hreflang=True)};bare='/'+('/'.join(path.split('/')[2:]))
 for key,seg in [('en-IN','in'),('hi-IN','in-hi'),('ta-IN','in-ta'),('x-default','in')]:
  want=ORIGIN+'/'+seg+(''if bare=='/'else bare)
  if alts.get(key)!=want:issues.append('alternate '+key)
 schemas=[]
 for script in s.find_all('script',type='application/ld+json'):
  try:
   obj=json.loads(script.get_text());schemas.extend(obj.get('@graph',[obj])if isinstance(obj,dict)else obj)
  except Exception:issues.append('JSON-LD parse')
 for obj in schemas:
  typ=obj.get('@type')
  if typ=='SoftwareApplication'and'offers'in obj:issues.append('unverified software offer')
  if typ=='Article':
   if obj.get('url')!=url or obj.get('mainEntityOfPage',{}).get('@id')!=url:issues.append('article identity')
   if obj.get('author',{}).get('name')=='LetBuyy Team'and obj['author'].get('@type')!='Organization':issues.append('team typed as Person')
   if obj.get('publisher',{}).get('@id')!=ORIGIN+'/#organization':issues.append('publisher identity')
  if typ=='BreadcrumbList'and any(not str(x.get('item','')).startswith(ORIGIN+'/'+segment)for x in obj.get('itemListElement',[])):issues.append('breadcrumb identity')
  if typ=='WebSite':
   if any(not x.get('url','').startswith(ORIGIN+'/'+segment)for x in obj.get('hasPart',[])):issues.append('website content membership')
 if path in selected:(OUT/'evidence'/('page-'+path.replace('/','_')+'.html')).write_text(res.text)
 links=sorted({U.urlsplit(U.urljoin(url,a['href'])).path for a in s.find_all('a',href=True)if U.urlsplit(U.urljoin(url,a['href'])).netloc==U.urlsplit(ORIGIN).netloc})
 body=s.select_one('#article-body');text=body.get_text(' ',strip=True)if body else ''
 if 'how-product-reviews-increase-conversion'in path and any(x in title+' '+text for x in ['270%','4.6%','1.7%']):issues.append('stale conversion promise')
 if 'gst-for-ecommerce-india'in path and body and body.find('table'):issues.append('stale GST rate table')
 return {'path':path,'status':res.status_code,'title':title,'canonical':canonical,'root_lang':s.html.get('lang')if s.html else None,'h1':heads,'noindex':noindex,'og_url':meta.get('og:url'),'og_locale':meta.get('og:locale'),'alternates':alts,'schema_types':[o.get('@type')for o in schemas],'links':links,'errors':issues,'seconds':round(time.monotonic()-t,3)}
rows=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=2)as pool:
 for row in pool.map(inspect,paths):
  rows.append(row)
  if len(rows)%50==0:print('Inspected',len(rows),'of',len(paths),flush=True)
errors=[{'path':r['path'],'errors':r['errors']}for r in rows if r['errors']]
# Every declared sitemap URL must belong to the retained canonical200 set.
rootxml=requests.get(BASE+'/sitemap.xml',timeout=20);root=E.fromstring(rootxml.text);ns={'s':'http://www.sitemaps.org/schemas/sitemap/0.9','x':'http://www.w3.org/1999/xhtml'};locs=[x.text for x in root.findall('s:url/s:loc',ns)];known={ORIGIN+r['path']:r for r in rows}
for u in locs:
 if u not in known or known[u]['status']!=200 or known[u]['noindex']:errors.append({'url':u,'errors':['sitemap target not retained canonical200']})
article_rows=[r for r in rows if 'Article'in r['schema_types']];missing=[ORIGIN+r['path']for r in article_rows if ORIGIN+r['path']not in locs]
if missing:errors.append({'errors':['articles omitted from sitemap'],'urls':missing})
(OUT/'evidence/sitemap.xml').write_text(rootxml.text)
feeds=[]
for segment in ['in','in-hi','in-ta']:
 for kind in ['rss.xml','sitemap.xml']:
  res=requests.get(BASE+f'/{segment}/resources/{kind}',timeout=20);doc=E.fromstring(res.text);links=[e.text for e in doc.findall('.//item/link')]if kind=='rss.xml'else[e.text for e in doc.findall('s:url/s:loc',ns)]
  bad=[u for u in links if not u.startswith(ORIGIN+'/'+segment+'/resources')or u not in known]
  if bad:errors.append({'feed':segment+'/'+kind,'errors':['noncanonical item links'],'urls':bad})
  feeds.append({'locale':segment,'kind':kind,'status':res.status_code,'items':len(links),'language':doc.findtext('.//language'),'errors':bad});(OUT/'evidence'/f'{segment}-{kind}').write_text(res.text)
# A bounded invalid-tag probe must be a real404, not an empty200.
invalid=[]
for segment in ['in','in-hi','in-ta']:
 res=requests.get(BASE+f'/{segment}/resources/tag/seo-audit-nonexistent-20261029',headers={'User-Agent':'Googlebot'},timeout=20);invalid.append({'path':f'/{segment}/resources/tag/seo-audit-nonexistent-20261029','status':res.status_code})
 if res.status_code!=404:errors.append({'path':invalid[-1]['path'],'errors':['invalid tag not404']})
robots=requests.get(BASE+'/robots.txt',timeout=15).text;(OUT/'evidence/robots.txt').write_text(robots)
if robots.count('Sitemap:')!=1 or any(x in robots for x in ['themes.','apps.','developer.']):errors.append({'errors':['stale robots sitemap declaration']})
result={'captured_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'mode':'Production build; isolated synthetic public pricing gateway, not production financial data','base':BASE,'canonical_origin':ORIGIN,'html_pages':len(rows),'article_pages':len(article_rows),'sitemap_entries':len(locs),'missing_articles':missing,'feeds':feeds,'invalid_tag_probes':invalid,'errors':errors,'passed':not errors}
(OUT/'evidence/local-url-inventory.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2));(OUT/'evidence/local-verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
with(OUT/'LOCAL-URL-INVENTORY.csv').open('w',newline='')as f:
 keys=['path','status','title','canonical','root_lang','h1','noindex','og_url','og_locale','schema_types','errors'];w=csv.DictWriter(f,fieldnames=keys);w.writeheader()
 for r in rows:w.writerow({k:json.dumps(r[k],ensure_ascii=False)if isinstance(r[k],(list,dict))else r[k]for k in keys})
print(json.dumps(result,ensure_ascii=False,indent=2))
