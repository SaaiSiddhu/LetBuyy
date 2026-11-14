from html.parser import HTMLParser
from pathlib import Path
from urllib.request import build_opener,HTTPRedirectHandler,Request
from urllib.error import HTTPError
from concurrent.futures import ThreadPoolExecutor
import json,datetime,xml.etree.ElementTree as ET
ROOT=Path.cwd(); W=Path('/tmp/letbuyy-seo-readiness-20261103'); BASE='http://127.0.0.1:9049'
class NoRedirect(HTTPRedirectHandler):
 def redirect_request(self,*a,**kw):return None
class Parse(HTMLParser):
 def __init__(self):super().__init__();self.title=[];self.inTitle=False;self.inHead=False;self.lang=None;self.canonical=[];self.ids=[];self.links=[];self.h1=0;self.main=0
 def handle_starttag(self,tag,a):
  a=dict(a)
  if tag=='html':self.lang=a.get('lang')
  if tag=='head':self.inHead=True
  if tag=='title'and self.inHead:self.inTitle=True
  if tag=='h1':self.h1+=1
  if tag=='main':self.main+=1
  if tag=='link'and a.get('rel')=='canonical':self.canonical.append(a.get('href'))
  if a.get('id'):self.ids.append(a['id'])
  if tag=='a'and a.get('href'):self.links.append(a['href'])
 def handle_endtag(self,tag):
  if tag=='title':self.inTitle=False
  if tag=='head':self.inHead=False
 def handle_data(self,d):
  if self.inTitle:self.title.append(d)
def fetch(path):
 try:r=build_opener(NoRedirect()).open(Request(BASE+path,headers={'User-Agent':'LetBuyy-local-readonly-verification'}),timeout=30)
 except HTTPError as e:r=e
 return r.code,dict(r.headers),r.read().decode('utf8')
old=json.loads((ROOT/'reports/letbuyy-lcp-followup-2026-11-01/evidence/html-results.json').read_text());rows=[]
def inspect(previous):
 status,headers,html=fetch(previous['path']);p=Parse();p.feed(html);errors=[]
 if status!=previous['status']:errors.append('Unexpected status')
 if status==200:
  for k,v in [('title',''.join(p.title)),('lang',p.lang),('canonical',p.canonical)]:
   if v!=(str(previous[k]).replace('127.0.0.1:9048','127.0.0.1:9006') if isinstance(previous[k],str) else [x.replace('127.0.0.1:9048','localhost:9006')for x in previous[k]]):errors.append('Changed '+k)
  if p.h1!=1:errors.append('H1 count')
  if '/resources' in previous['path']and p.main!=1:errors.append('Main landmark count')
 return dict(path=previous['path'],status=status,title=''.join(p.title),lang=p.lang,canonical=p.canonical,h1_count=p.h1,main_count=p.main,redirect=headers.get('Location')or headers.get('location'),errors=errors)
with ThreadPoolExecutor(max_workers=3)as pool:rows=list(pool.map(inspect,old['rows']))
feeds=[]
for locale in ['in','in-hi','in-ta']:
 for kind in ['rss.xml','sitemap.xml']:
  path='/'+locale+'/resources/'+kind;status,headers,body=fetch(path);tree=ET.fromstring(body);count=len(tree.findall('.//item'))if kind=='rss.xml'else len(tree.findall('.//{http://www.sitemaps.org/schemas/sitemap/0.9}url'))
  feeds.append(dict(path=path,status=status,count=count,passed=status==200 and count==(35 if kind=='rss.xml'else 43)))
status,headers,body=fetch('/sitemap.xml');tree=ET.fromstring(body);entries=len(tree.findall('.//{http://www.sitemaps.org/schemas/sitemap/0.9}url'))
negative=[]
for row in old['summary']['negative_controls']:
 status,_,_=fetch(row['path']);negative.append(dict(path=row['path'],status=status,passed=status==404))
summary=dict(captured_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),base=BASE,known_urls=len(rows),html_200=sum(r['status']==200 for r in rows),redirects=sum(r['status']==308 for r in rows),errors=[r for r in rows if r['errors']],feeds=feeds,sitemap_entries=entries,negative_controls=negative,canonical_note='Root production artifact on9006; prior comparison origin9048 normalized to9006 for metadata comparisons.')
(W/'public-urls.json').write_text(json.dumps(dict(summary=summary,rows=rows),indent=2));print(json.dumps(summary,indent=2));raise SystemExit(0 if not summary['errors']and all(r['passed']for r in feeds+negative)and entries==192 else 1)
