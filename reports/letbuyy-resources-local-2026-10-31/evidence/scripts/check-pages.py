from pathlib import Path
from html.parser import HTMLParser
import urllib.request as R,urllib.parse as U,urllib.error,concurrent.futures,json,csv,datetime,xml.etree.ElementTree as E,time
w=Path('/tmp/letbuyy-resources-20261031');catalogue=json.loads((w/'catalogue.json').read_text());base='http://127.0.0.1:9006'
class P(HTMLParser):
 def __init__(self):super().__init__(convert_charrefs=True);self.h1=[];self.title='';self.lang='';self.links=[];self.ids=[];self.canon=[];self.content=[];self.heading=None;self.main_depth=0;self.skip=0
 def handle_starttag(self,t,a):
  a=dict(a)
  if t=='html':self.lang=a.get('lang','')
  if a.get('id'):self.ids.append(a['id'])
  if t=='main':self.main_depth+=1
  if t in ['script','style']:self.skip+=1
  if t in ['h1','title']:self.heading=[t,'']
  if t=='a'and a.get('href'):self.links.append(a['href'])
  if t=='link'and a.get('rel')=='canonical':self.canon.append(a.get('href'))
 def handle_data(self,x):
  if self.heading:self.heading[1]+=x
  if self.main_depth and not self.skip:self.content.append(x)
 def handle_endtag(self,t):
  if self.heading and t==self.heading[0]:
   if t=='h1':self.h1.append(self.heading[1])
   else:self.title=self.heading[1]
   self.heading=None
  if t=='main':self.main_depth=max(0,self.main_depth-1)
  if t in ['script','style']:self.skip=max(0,self.skip-1)
class NoRedirect(R.HTTPRedirectHandler):
 def redirect_request(self,*a,**k):return None
opener=R.build_opener(NoRedirect);targets=[]
for locale in catalogue['locales']:
 prefix='/'+locale+'/resources'
 for tail,kind in [('', 'hub'),('/search','search'),('/changelog','changelog'),('/releases','releases')]:targets.append((prefix+tail,kind))
 for a in catalogue['articles']:targets.append((prefix+'/'+a['category']+'/'+a['slug'],'article'))
 for c in catalogue['categories']:targets.append((prefix+'/'+c['slug'],'category'))
 for t in catalogue['tags']:targets.append((prefix+'/tag/'+U.quote(t,safe=''),'tag'))
 for a in catalogue['authors']:targets.append((prefix+'/authors/'+a,'publisher'))
 for a in catalogue['retired_authors']:targets.append((prefix+'/authors/'+a,'retired-author'))
 for x in ['rss.xml','sitemap.xml']:targets.append((prefix+'/'+x,'xml'))
 for tail in ['/platform/missing-guide','/tag/not-a-real-topic','/authors/unknown-profile']:targets.append((prefix+tail,'negative-control'))
def check(target):
 path,kind=target;start=time.monotonic()
 try:
  r=opener.open(R.Request(base+path,headers={'User-Agent':'LetBuyy-Local-Resources-Verification/2026-10-31'}),timeout=90);status=r.status;headers={k.lower():v for k,v in r.headers.items()};body=r.read().decode();r.close()
 except urllib.error.HTTPError as e:status=e.code;headers={k.lower():v for k,v in e.headers.items()};body=e.read().decode()
 p=P();p.feed(body);errors=[];expected=308 if kind=='retired-author'else 404 if kind=='negative-control'else 200
 if status!=expected:errors.append('Expected '+str(expected))
 if kind=='xml':
  try:E.fromstring(body)
  except E.ParseError:errors.append('Invalid XML')
 elif kind=='retired-author':
  if U.urlsplit(headers.get('location','')).path!='/'+path.split('/')[1]+'/resources/authors/letbuyy-team':errors.append('Wrong redirect')
 elif kind!='negative-control':
  lang={'in':'en','in-hi':'hi','in-ta':'ta'}[path.split('/')[1]]
  if p.lang!=lang:errors.append('Wrong HTML language')
  if len(p.h1)!=1:errors.append('Expected one rendered H1')
  if not p.title:errors.append('Missing page title')
  if len(p.canon)!=1 or U.unquote(U.urlsplit(p.canon[0]).path)!=U.unquote(path):errors.append('Wrong canonical path')
  if kind=='article'and len(' '.join(p.content).strip())<150:errors.append('Article content missing')
 row={'path':path,'kind':kind,'status':status,'title':p.title,'h1':' | '.join(p.h1),'language':p.lang,'canonical':' | '.join(p.canon),'content_characters':len(' '.join(p.content)),'redirect':headers.get('location'),'elapsed_seconds':round(time.monotonic()-start,3),'errors':errors,'links':p.links,'ids':p.ids}
 return row
with concurrent.futures.ThreadPoolExecutor(max_workers=2)as pool:rows=list(pool.map(check,targets))
known={U.unquote(x['path']):x for x in rows};broken=[];fragments=[]
for row in rows:
 if row['status']!=200 or row['kind']=='xml':continue
 for href in row['links']:
  url=U.urlsplit(U.urljoin(base+row['path'],href));path=U.unquote(url.path)
  if url.hostname not in ['127.0.0.1','localhost']or url.port!=9006 or '/resources'not in path:continue
  target=known.get(path)
  if not target or target['status']not in [200,308]:broken.append({'from':row['path'],'href':href})
  elif url.fragment and U.unquote(url.fragment)not in target['ids']:fragments.append({'from':row['path'],'href':href})
summary={'captured_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'base_url':base,'source_articles':len(catalogue['articles']),'article_pages_checked':sum(x['kind']=='article'for x in rows),'total_checked':len(rows),'by_kind':{k:sum(x['kind']==k for x in rows)for k in sorted(set(x['kind']for x in rows))},'status_counts':{str(s):sum(x['status']==s for x in rows)for s in sorted(set(x['status']for x in rows))},'failures':[{'path':x['path'],'errors':x['errors']}for x in rows if x['errors']],'broken_resource_links':broken,'broken_fragments':fragments}
summary['passed']=not(summary['failures']or broken or fragments);(w/'http-results.json').write_text(json.dumps({'summary':summary,'rows':rows},ensure_ascii=False,indent=2));print(json.dumps(summary,ensure_ascii=False),flush=True)
assert summary['passed'],summary
