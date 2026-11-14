from pathlib import Path
import csv,json,urllib.request as R,urllib.parse as U,urllib.error,concurrent.futures,html.parser,xml.etree.ElementTree as E,datetime
W=Path('/tmp/letbuyy-site-20261101');BASE='http://127.0.0.1:9044'
class Parser(html.parser.HTMLParser):
 def __init__(self):super().__init__(convert_charrefs=True);self.title='';self.h1=[];self.canon=[];self.meta={};self.alt={};self.links=[];self.ids=[];self.lang=None;self.schemas=[];self.capture=None;self.script=None
 def handle_starttag(self,t,a):
  a=dict(a)
  if t=='html':self.lang=a.get('lang')
  if a.get('id'):self.ids.append(a['id'])
  if t=='title':self.capture=['title','']
  if t=='h1':self.capture=['h1','']
  if t=='meta':self.meta[a.get('name',a.get('property',''))]=a.get('content','')
  if t=='link'and a.get('rel')=='canonical':self.canon.append(a.get('href'))
  if t=='link'and a.get('rel')=='alternate':self.alt[a.get('hreflang')]=a.get('href')
  if t=='a'and a.get('href'):self.links.append(a['href'])
  if t=='script'and a.get('type')=='application/ld+json':self.script=''
 def handle_data(self,d):
  if self.capture:self.capture[1]+=d
  if self.script is not None:self.script+=d
 def handle_endtag(self,t):
  if self.capture and t==self.capture[0]:
   if t=='title':self.title=self.capture[1]
   else:self.h1.append(self.capture[1])
   self.capture=None
  if t=='script'and self.script is not None:
   try:self.schemas.append(json.loads(self.script))
   except Exception:self.schemas.append({'invalid_json':True})
   self.script=None
class Stop(R.HTTPRedirectHandler):
 def redirect_request(self,*a,**k):return None
opener=R.build_opener(Stop)
paths=[r['path']for r in csv.DictReader(Path('reports/letbuyy-seo-local-repair-2026-10-30/LOCAL-URL-INVENTORY.csv').open())]
retired=['priya-commerce','arjun-developer','neha-payments','ravi-operations']
raw_samples=['/in','/in/pricing','/in/resources/authors/letbuyy-team','/in/resources/platform/introduction-to-apps','/in/resources/platform/building-first-letbuyy-store','/in-hi/resources/payments/gst-for-ecommerce-india','/in-ta/resources/ai-commerce/commerce-copilot-guide','/in/resources/changelog','/in/resources/releases']
(W/'html').mkdir(exist_ok=True)
def fetch(path):
 req=R.Request(BASE+path,headers={'User-Agent':'LetBuyy-Local-SEO-Verification/1.0'})
 try:r=opener.open(req,timeout=40);status=r.status;headers={k.lower():v for k,v in r.headers.items()};body=r.read().decode();r.close()
 except urllib.error.HTTPError as e:status=e.code;headers={k.lower():v for k,v in e.headers.items()};body=e.read().decode()
 p=Parser();p.feed(body);errs=[];red=any(path.endswith('/authors/'+s)for s in retired)
 if red:
  if status!=308:errs.append('retired profile must be permanent redirect')
  if U.urlsplit(headers.get('location','')).path!='/'+path.split('/')[1]+'/resources/authors/letbuyy-team':errs.append('wrong redirect target')
 else:
  if status!=200:errs.append('expected200')
  if p.canon!=[BASE+path]:errs.append('canonical')
  lang={'in':'en','in-hi':'hi','in-ta':'ta'}[path.split('/')[1]]
  if p.lang!=lang:errs.append('document language')
  if len(p.h1)!=1:errs.append('H1 count')
  if not p.title:errs.append('missing title')
  if p.meta.get('og:url')!=BASE+path:errs.append('social URL')
  if len(p.alt)<4:errs.append('language alternatives')
  if path.endswith(('/resources/changelog','/resources/releases'))and'noindex'not in p.meta.get('robots',''):errs.append('unverified release index policy')
  if any(s.get('invalid_json')for s in p.schemas):errs.append('invalid schema JSON')
  for s in p.schemas:
   if s.get('@type')=='Article'and(s.get('author',{}).get('@type')!='Organization'or s['author'].get('name')!='LetBuyy'):errs.append('unsupported author entity')
 if path in raw_samples:(W/'html'/(path.strip('/').replace('/','__')+'.html')).write_text(body)
 return {'path':path,'status':status,'title':p.title,'canonical':p.canon,'lang':p.lang,'h1':p.h1,'robots':p.meta.get('robots'),'redirect':headers.get('location'),'links':p.links,'ids':p.ids,'schema_types':[s.get('@type')for s in p.schemas],'errors':errs}
with concurrent.futures.ThreadPoolExecutor(max_workers=4)as pool:rows=list(pool.map(fetch,paths))
known={r['path']:r for r in rows};badlinks=[];fragments=[]
for r in rows:
 for href in r['links']:
  url=U.urlsplit(U.urljoin(BASE+r['path'],href))
  if url.netloc!=U.urlsplit(BASE).netloc:continue
  if url.path in known:
   if url.fragment and U.unquote(url.fragment) not in known[url.path]['ids']:fragments.append({'from':r['path'],'href':href})
  elif url.path not in['/signup','/in/signup','/in-hi/signup','/in-ta/signup','/sitemap.xml','/robots.txt']and not url.path.endswith(('/rss.xml','/sitemap.xml')):badlinks.append({'from':r['path'],'href':href})
xml=R.urlopen(BASE+'/sitemap.xml').read();(W/'sitemap.xml').write_bytes(xml);entries=[u.find('{*}loc').text for u in E.fromstring(xml)];sitemap_errors=[]
for url in entries:
 p=U.urlsplit(url).path;r=known.get(p)
 if not r or r['status']!=200 or'noindex'in(r['robots']or''):sitemap_errors.append(url)
article_paths=['/'+locale+'/resources/'+a['category']+'/'+a['slug']for a in json.loads(Path('reports/letbuyy-resources-local-2026-10-31/evidence/catalogue.json').read_text())['articles']for locale in['in','in-hi','in-ta']]
missing=[p for p in article_paths if BASE+p not in entries]
feed=[]
for locale in['in','in-hi','in-ta']:
 for kind in['rss.xml','sitemap.xml']:
  body=R.urlopen(BASE+'/'+locale+'/resources/'+kind).read();(W/(locale+'-'+kind)).write_bytes(body);tree=E.fromstring(body);feed.append({'locale':locale,'kind':kind,'count':len(tree.findall('.//item')if kind=='rss.xml'else tree.findall('{*}url'))})
extra=[]
for path in ['/in/resources/authors/unknown-profile','/in-hi/resources/tag/not-a-real-topic','/in-ta/resources/platform/missing-guide']:
 try:r=opener.open(BASE+path);status=r.status
 except urllib.error.HTTPError as e:status=e.code
 extra.append({'path':path,'status':status});assert status==404
summary={'captured_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'base':BASE,'requested':len(rows),'html_200':sum(r['status']==200 for r in rows),'retired_profile_redirects':sum(r['status']==308 for r in rows),'sitemap_entries':len(entries),'missing_articles':missing,'sitemap_errors':sitemap_errors,'page_errors':[{'path':r['path'],'errors':r['errors']}for r in rows if r['errors']],'unknown_internal_targets':badlinks,'broken_fragments':fragments,'feeds':feed,'negative_controls':extra}
(W/'html-results.json').write_text(json.dumps({'summary':summary,'rows':rows},ensure_ascii=False,indent=2));print(json.dumps(summary,ensure_ascii=False))
