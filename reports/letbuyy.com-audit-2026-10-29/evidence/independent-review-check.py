import json,pathlib,re,gzip,xml.etree.ElementTree as ET
from html.parser import HTMLParser
R=pathlib.Path(__file__).resolve().parents[1]
class Page(HTMLParser):
 def __init__(self,html):
  super().__init__(); self.links=[]; self.meta=[]; self.h1=0; self.schemas=[]; self.schema=False; self.buf=''; self.feed(html)
 def handle_starttag(self,t,a):
  a=dict(a)
  if t=='link': self.links.append(a)
  if t=='meta': self.meta.append(a)
  if t=='h1': self.h1+=1
  if t=='script' and a.get('type')=='application/ld+json': self.schema=True; self.buf=''
 def handle_data(self,d):
  if self.schema: self.buf+=d
 def handle_endtag(self,t):
  if t=='script' and self.schema:
   self.schemas.append(json.loads(self.buf)); self.schema=False
 def canon(self): return [x.get('href') for x in self.links if x.get('rel')=='canonical']
 def og(self): return {x['property']:x.get('content') for x in self.meta if x.get('property','').startswith('og:')}
def nodes(v):
 if isinstance(v,dict):
  yield v
  for x in v.values(): yield from nodes(x)
 elif isinstance(v,list):
  for x in v: yield from nodes(x)
c=json.loads((R/'evidence/crawl.json').read_text()); english=[p for p in c['pages'] if p.get('status')==200 and (p['url'].endswith('/in') or '/in/' in p['url']) and 'evidence_html' in p and 'text/html' in p.get('headers',{}).get('content-type','')]
sitemap=ET.parse(R/'evidence/letbuyy-seo-sitemap.xml').getroot(); ns={'s':'http://www.sitemaps.org/schemas/sitemap/0.9'}; urls={e.text for e in sitemap.findall('s:url/s:loc',ns)}
stripped=[]; mismatch=[]; articles=[]; offers=[]; missing_h1=[]; problems=[]
for p in english:
 parsed=Page((R/p['evidence_html']).read_text()); ca=parsed.canon(); expected=p['url'].replace('/in/','/')
 if ca==[expected] and expected!=p['url']: stripped.append(p['url'])
 if ca!=[p['url']]: mismatch.append(p['url'])
 if parsed.h1!=1: missing_h1.append({'url':p['url'],'h1':parsed.h1})
 for s in parsed.schemas:
  for n in nodes(s):
   if n.get('@type')=='Article': articles.append(p['url'])
   if n.get('@type')=='SoftwareApplication': offers.append(n.get('offers',{}).get('price'))
for p in R.rglob('*.json'):
 try: json.loads(p.read_text())
 except Exception as e: problems.append(str(p))
local={}
for label in ['local-home','local-category','local-pricing','live-home']:
 p=R/'evidence/independent-review-samples'/(label+'.html.gz')
 if p.is_file():
  q=Page(gzip.decompress(p.read_bytes()).decode()); local[label]={'canonical':q.canon(),'h1_count':q.h1,'og':q.og(),'software_offers':[n.get('offers') for s in q.schemas for n in nodes(s) if n.get('@type')=='SoftwareApplication']}
local_s=ET.fromstring(gzip.decompress((R/'evidence/independent-review-samples/local-sitemap.xml.gz').read_bytes())); local_urls={e.text for e in local_s.findall('s:url/s:loc',ns)}
out={'saved_evidence_recomputed':{'english_html_pages':len(english),'locale_stripped_canonicals':len(stripped),'all_canonical_mismatches':len(mismatch),'articles':len(articles),'articles_missing_sitemap':len(set(articles)-urls),'sitemap_entries':len(urls),'software_offer_count':len(offers),'all_software_offers_zero':all(x=='0' for x in offers),'missing_h1':missing_h1,'json_errors':problems},'fresh_spot_checks':local,'local_sitemap_entries':len(local_urls),'relative_lift_1_7_to_4_6':round((4.6-1.7)/1.7*100,4)}
assert out == json.loads((R/'evidence/independent-review.json').read_text()), 'Saved review differs from recomputed evidence'
print('PASS: review evidence reproduces from saved crawl HTML/XML and fresh sample snapshots.')
