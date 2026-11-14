"""Recompute content evidence from the shared audit crawl; never fetches URLs."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urljoin,urlsplit
import json,re,collections
R=Path(__file__).resolve().parents[1]
class ContentParser(HTMLParser):
 def __init__(self,html):
  super().__init__();self.stack=[];self.body_text=[];self.body_anchors=[];self.anchor=None;self.feed(html)
 def handle_starttag(self,tag,attrs):
  a=dict(attrs); inside=any(x[1] for x in self.stack); own=a.get('id')=='article-body' or 'arc-body' in a.get('class','').split()
  if tag not in {'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}: self.stack.append((tag,inside or own))
  if tag=='a' and (inside or own): self.anchor={'href':a.get('href',''),'text':''}
 def handle_data(self,data):
  if any(x[1] for x in self.stack): self.body_text.append(data)
  if self.anchor is not None:self.anchor['text']+=data
 def handle_endtag(self,tag):
  if tag=='a' and self.anchor is not None:self.body_anchors.append(self.anchor);self.anchor=None
  for i in range(len(self.stack)-1,-1,-1):
   if self.stack[i][0]==tag: del self.stack[i:];break
def nodes(o):
 if isinstance(o,dict):
  yield o
  for v in o.values(): yield from nodes(v)
 elif isinstance(o,list):
  for v in o: yield from nodes(v)
c=json.loads((R/'evidence/crawl.json').read_text()); pages=[p for p in c['pages'] if p.get('status')==200 and p.get('evidence_html')]
articles=[]
for p in pages:
 schemas=[]
 for s in p.get('schemas',[]):
  try:schemas.extend(nodes(json.loads(s) if isinstance(s,str) else s))
  except (ValueError,TypeError):pass
 if not any(x.get('@type')=='Article' for x in schemas):continue
 h=ContentParser((R/p['evidence_html']).read_text()); text=' '.join(' '.join(h.body_text).split()); anchors=h.body_anchors
 external=[a for a in anchors if urlsplit(urljoin(p['url'],a['href'])).hostname not in {'www.letbuyy.com','letbuyy.com'} and a['href'].startswith(('http:','https:'))]
 internal=[a for a in anchors if a['href'] and not a['href'].startswith('#') and urlsplit(urljoin(p['url'],a['href'])).hostname in {'www.letbuyy.com','letbuyy.com'}]
 # Keep quantitative claim snippets short; raw HTML remains the authoritative evidence.
 claim_flags=[]
 for flag,pattern in {'270_lift':r'270\s*%','zero_failure':r'zero failure','billion_daily':r'1 billion daily','case_result':r'Jaipur-based kurta','tcs_1_percent':r'TCS.{0,70}1%','api_app_installation':r'(install|publish).{0,40}app','performance_percent':r'\d+[–−-]?\d*%'} .items():
  if re.search(pattern,text,re.I):claim_flags.append(flag)
 articles.append({'url':p['url'],'locale':urlsplit(p['url']).path.split('/')[1],'title':p.get('title'),'evidence_html':p['evidence_html'],'captured_at':p.get('captured_at'),'body_tokens':len(text.split()),'body_anchor_count':len(anchors),'body_external_reference_count':len(external),'body_contextual_internal_count':len(internal),'body_contextual_internal':internal,'body_external_references':external,'claim_flags':claim_flags,'body_container_found':bool(text)})
out={'crawl_complete':c['complete'],'crawl_updated_at':c['updated_at'],'article_count':len(articles),'article_counts_by_locale':dict(collections.Counter(a['locale'] for a in articles)),'body_container_count':sum(a['body_container_found'] for a in articles),'article_body_without_external_references':[a['url'] for a in articles if a['body_container_found'] and not a['body_external_reference_count']],'article_body_without_contextual_internal_links':[a['url'] for a in articles if a['body_container_found'] and not a['body_contextual_internal_count']],'articles':articles}
(R/'evidence/content-analysis.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)); print(json.dumps({k:v for k,v in out.items() if k not in {'articles','article_body_without_external_references','article_body_without_contextual_internal_links'}},ensure_ascii=False,indent=2))
