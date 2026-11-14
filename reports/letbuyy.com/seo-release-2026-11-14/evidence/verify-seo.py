import csv,hashlib,json,pathlib,sys,xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
from urllib.parse import urlsplit,urljoin
from urllib.request import build_opener, HTTPRedirectHandler, Request
from urllib.error import HTTPError

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs): return None

class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.lang='';self.title='';self.in_title=False;self.canonical=[];self.alts={};self.meta={}
        self.h1=0;self.main=0;self.schemas=0;self.schema_errors=[];self.script=None
        self.anchors=set(); self.hrefs=set()
    def handle_starttag(self, tag, attributes):
        a=dict(attributes)
        if a.get('id'):self.anchors.add(a['id'])
        if tag=='html':self.lang=a.get('lang','')
        if tag=='title':self.in_title=True
        if tag=='main':self.main+=1
        if tag=='h1':self.h1+=1
        if tag=='a' and a.get('href'):self.hrefs.add(a['href'])
        if tag=='meta':self.meta[a.get('name','').lower()]=a.get('content','')
        if tag=='link' and a.get('rel')=='canonical':self.canonical.append(a.get('href'))
        if tag=='link' and a.get('hreflang'):self.alts[a['hreflang']]=a.get('href')
        if tag=='script' and a.get('type')=='application/ld+json':self.script=''
    def handle_data(self, text):
        if self.in_title:self.title+=text
        if self.script is not None:self.script+=text
    def handle_endtag(self, tag):
        if tag=='title':self.in_title=False
        if tag=='script' and self.script is not None:
            try:json.loads(self.script);self.schemas+=1
            except ValueError as error:self.schema_errors.append(str(error))
            self.script=None

out=pathlib.Path(sys.argv[1])
prior=pathlib.Path('reports/letbuyy.com/seo-completion-2026-11-07/release-verification')
build=sys.argv[2]; base=sys.argv[3]
known=list(csv.DictReader((prior/'evidence/candidate/PRODUCTION-CANONICAL-URL-INVENTORY.csv').open()))
def get(path):
    try:r=build_opener(NoRedirect).open(Request(base+path,headers={'Accept-Encoding':'identity'}),timeout=30)
    except HTTPError as e:r=e
    with r:return r.status,r.headers,r.read().decode('utf-8','replace')

def inspect(old):
    path=old['path'];status,headers,body=get(path);p=Page();p.feed(body);errors=list(p.schema_errors)
    if status!=int(old['status']):errors.append('status differs')
    location=headers.get('Location')
    if status==308 and location!=old['redirect']:errors.append('redirect target differs')
    if status==200:
        for key,actual in [('lang',p.lang),('title',p.title),('robots',p.meta.get('robots','')),('description',p.meta.get('description','')),('h1_count',str(p.h1)),('main_count',str(p.main)),('jsonld_blocks',str(p.schemas))]:
            if old[key]!=actual:errors.append(key+' differs')
        if p.canonical!=json.loads(old['canonical']):errors.append('canonical mismatch')
        if p.alts!={a['lang']:a['href'] for a in json.loads(old['hreflang'])}:errors.append('hreflang mismatch')
        if any('127.0.0.1' in x for x in p.canonical+list(p.alts.values())):errors.append('loopback canonical')
    return {'path':path,'status':status,'redirect':location,'title':p.title,'language':p.lang,'robots':p.meta.get('robots'),'canonical':p.canonical,'alternates':p.alts,'jsonld':p.schemas,'errors':errors}

with ThreadPoolExecutor(max_workers=3) as pool:rows=list(pool.map(inspect, known))
ns={'s':'http://www.sitemaps.org/schemas/sitemap/0.9'}
idx={r['path']:r for r in rows}
status,_,body=get('/sitemap.xml')
(out/'sitemap.xml').write_text(body)
entries=[u.text for u in ET.fromstring(body).findall('s:url/s:loc',ns)]
assert status==200
errors=[r for r in rows if r['errors']]
assert len(entries)==189 and len(set(entries))==189
guides=[u for u in entries if '/resources/' in u and len(urlsplit(u).path.split('/'))==5 and '/authors/' not in u and '/tag/' not in u]
assert len(guides)==105
for u in entries:
    row=idx[urlsplit(u).path]
    assert row['status']==200 and row['canonical']==[u] and 'noindex' not in (row['robots'] or ''),row
    for lang,alt in row['alternates'].items():
        if lang=='x-default':continue
        sibling=idx[urlsplit(alt).path]
        assert u in sibling['alternates'].values(),(u,alt)
status,_,body=get('/robots.txt')
(out/'robots.txt').write_text(body)
assert status==200 and 'https://www.letbuyy.com/sitemap.xml' in body
checks=[]
for locale in ('in','in-hi','in-ta'):
    d=idx['/'+locale+'/sitemap']
    assert d['status']==200 and 'noindex' in d['robots'] and 'follow' in d['robots'] and d['canonical'][0] not in entries
    status,_,body=get('/'+locale+'/resources/rss.xml')
    assert status==200
    items=ET.fromstring(body).findall('channel/item')
    links=[item.findtext('link') for item in items]
    assert links and all(link.startswith('https://www.letbuyy.com/'+locale+'/resources/') for link in links)
    checks.append({'locale':locale,'rssItems':len(items),'directory':'200 noindex/follow and excluded from XML'})
negative={}
for path in ('/in/resources/authors/unknown-profile','/in-hi/resources/tag/not-a-real-topic','/in-ta/resources/platform/missing-guide'):
    negative[path]=get(path)[0]
assert all(status==404 for status in negative.values()),negative
summary={'build':build,'origin':base,'urls':len(rows),'success':sum(r['status']==200 for r in rows),'redirects':sum(r['status']==308 for r in rows),'sitemap':len(entries),'guides':len(guides),'jsonld':sum(r['jsonld'] for r in rows),'negative':negative,'localeChecks':checks,'errors':errors}
(out/'url-regression.json').write_text(json.dumps({'summary':summary,'rows':rows},ensure_ascii=False,indent=2))
native=list(csv.DictReader((prior/'NATIVE-LANGUAGE-REVIEW.csv').open()))
for r in native:
    served=idx[urlsplit(r['page']).path]
    translated=pathlib.Path('apps/marketing/web/src/lib/i18n/content')/r['language']/'articles'/f"{r['slug']}.json"
    data=translated.read_bytes()
    assert hashlib.sha256(data).hexdigest()==r['localizedSourceSHA256']
    assert json.loads(data)['sourceHash']==r['sourceHash']
    assert served['status']==200 and served['language']==r['language']
    r['candidateBuild']=build;r['servedStatus']=200;r['servedLanguage']=served['language']
with (out/'NATIVE-LANGUAGE-REVIEW.csv').open('w',newline='') as f:
    writer=csv.DictWriter(f,fieldnames=native[0]);writer.writeheader();writer.writerows(native)
print(json.dumps(summary,ensure_ascii=False,indent=2));print('Editorial source rows:',len(native))
raise SystemExit(bool(errors))
