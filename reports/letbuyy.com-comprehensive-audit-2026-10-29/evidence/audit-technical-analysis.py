from pathlib import Path
from urllib.parse import urljoin,urlsplit,urlunsplit
from collections import Counter,defaultdict,deque
import json,xml.etree.ElementTree as ET,hashlib,re
R=Path('/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy.com-comprehensive-audit-2026-10-29')
C=json.loads((R/'evidence/crawl.json').read_text()); rows=C['pages']; html=[p for p in rows if 'title' in p]; live=[p for p in html if p.get('status')==200 and urlsplit(p['url']).scheme=='https' and urlsplit(p['url']).netloc=='www.letbuyy.com' and re.match(r'^/in(?:-ta|-hi)?(?:/|$)',urlsplit(p['url']).path) and '__seo-audit' not in p['url'] and 'seo-audit-nonexistent' not in p['url']]; D={p['url']:p for p in live}
def meta(p,name): return [x.get('content','') for x in p.get('meta',[]) if x.get('name',x.get('property'))==name]
def ca(p): return [x.get('href','') for x in p.get('links',[]) if x.get('rel')=='canonical']
def alts(p):return {x.get('hreflang'):x.get('href') for x in p.get('links',[]) if x.get('rel')=='alternate' and x.get('hreflang')}
def norm(u):
 p=urlsplit(u); return urlunsplit((p.scheme,p.netloc,p.path.rstrip('/') or '/','',''))
def nodes(v):
 if isinstance(v,dict):
  yield v
  for x in v.values():yield from nodes(x)
 elif isinstance(v,list):
  for x in v:yield from nodes(x)
ns={'s':'http://www.sitemaps.org/schemas/sitemap/0.9','x':'http://www.w3.org/1999/xhtml'}; tree=ET.parse(R/'evidence/sitemap.xml'); sitemap=[e.find('s:loc',ns).text for e in tree.findall('s:url',ns)]; sm_alts={e.find('s:loc',ns).text:{a.get('hreflang'):a.get('href') for a in e.findall('x:link',ns)} for e in tree.findall('s:url',ns)}
issues=defaultdict(list); typecounts=Counter(); locale=Counter(); article=[]; schema_rows={}; schema_errors=[]; all_nodes={}; graph=defaultdict(set); inlinks=defaultdict(set); external=Counter(); image_count=0; alt_missing=0; alt_empty=0; dim_missing=0; srcset=0; load=Counter(); unique_images=set(); preloads=[]; dup_titles=defaultdict(list); dup_descriptions=defaultdict(list)
for p in live:
 u=p['url']; path=urlsplit(u).path; locale[path.split('/')[1]]+=1; canonical=ca(p); dup_titles[p['title']].append(u)
 if len(canonical)!=1: issues['missing_or_multiple_canonical'].append(u)
 elif canonical[0]!=u:
  issues['canonical_mismatch'].append(u)
  if canonical[0]==re.sub(r'/in(?:-ta|-hi)?(?=/|$)','',u,count=1):issues['locale_stripped_canonical'].append(u)
 if not meta(p,'description'):issues['missing_description'].append(u)
 else:dup_descriptions[meta(p,'description')[0]].append(u)
 if len([h for h in p.get('headings',[]) if h.get('tag')=='h1'])!=1:issues['h1_not_one'].append(u)
 if 'noindex' in ','.join(meta(p,'robots')+meta(p,'googlebot')).lower() or 'noindex' in p.get('headers',{}).get('x-robots-tag','').lower():issues['noindex'].append(u)
 if not meta(p,'og:image'):issues['missing_og_image'].append(u)
 if not meta(p,'og:url'):issues['missing_og_url'].append(u)
 elif canonical and meta(p,'og:url')!=canonical:issues['og_url_diff_canonical'].append(u)
 if not meta(p,'og:type'):issues['missing_og_type'].append(u)
 aa=alts(p)
 if aa and u not in aa.values():issues['hreflang_self_missing'].append(u)
 for code,target in aa.items():
  if code=='x-default':continue
  if target in D and u not in alts(D[target]).values():issues['hreflang_return_missing'].append({'url':u,'code':code,'target':target})
  if target in D and ca(D[target])!=[target]:issues['hreflang_target_noncanonical'].append({'url':u,'code':code,'target':target})
 for a in p.get('anchors',[]):
  t=norm(urljoin(u,a['href'])); tp=urlsplit(t)
  if tp.netloc=='www.letbuyy.com' and tp.scheme=='https': graph[u].add(t);inlinks[t].add(u)
  elif tp.scheme in ['http','https']:external[tp.netloc]+=1
 for im in p.get('images',[]):
  image_count+=1;alt_missing+='alt'not in im;alt_empty+=im.get('alt')=='';dim_missing+=not(im.get('width') and im.get('height'));srcset+='srcset'in im; load[im.get('loading','default')]+=1;unique_images.add(urljoin(u,im.get('src','')))
 pp=[l for l in p.get('links',[]) if l.get('rel')=='preload' and l.get('as')=='image']
 if pp:preloads.append({'url':u,'count':len(pp)})
 nn=[]
 for s in p.get('schemas',[]):
  try: nn.extend(list(nodes(json.loads(s) if isinstance(s,str) else s)))
  except Exception as e:schema_errors.append({'url':u,'error':str(e)})
 all_nodes[u]=nn
 for n in nn:
  ts=n.get('@type',[]);ts=[ts] if isinstance(ts,str) else ts
  for t in ts:typecounts[t]+=1
  if 'Article'in ts:
   article.append(u); schema_rows[u]=n
   if not n.get('image'):issues['article_image_absent'].append(u)
   aut=n.get('author',{});aut=[aut] if isinstance(aut,dict) else aut
   if any(not(a.get('url')or a.get('sameAs')) for a in aut):issues['article_author_identity_absent'].append(u)
   if any(a.get('name')=='LetBuyy Team' and a.get('@type')=='Person' for a in aut):issues['team_author_person'].append(u)
   if n.get('mainEntityOfPage',{}).get('@id')!=u:issues['article_identity_diff_canonical'].append(u)
  if 'SoftwareApplication'in ts and not(n.get('aggregateRating')or n.get('review')):issues['software_rating_or_review_absent'].append(u)
  if 'BreadcrumbList'in ts:
   if any(isinstance(x.get('item'),str) and x['item'].startswith('/') for x in n.get('itemListElement',[])):issues['breadcrumb_relative_items'].append(u)
for u in sitemap:
 if u in D:
  if ca(D[u])!=[u]:issues['sitemap_noncanonical'].append(u)
  if u in issues['noindex']:issues['sitemap_noindex'].append(u)
for u,aset in sm_alts.items():
 for code,t in aset.items():
  if t not in sm_alts:issues['sitemap_hreflang_url_not_listed'].append({'url':u,'target':t})
  elif aset!=sm_alts[t]:issues['sitemap_hreflang_nonreciprocal'].append({'url':u,'target':t})
  if t in D and ca(D[t])!=[t]:issues['sitemap_hreflang_noncanonical_target'].append({'url':u,'target':t})
depth={'https://www.letbuyy.com/in':0};q=deque(depth)
while q:
 u=q.popleft()
 for t in graph[u]:
  if t in D and t not in depth:depth[t]=depth[u]+1;q.append(t)
orphan=[u for u in D if not inlinks[u] and u!='https://www.letbuyy.com/in']; article_depth={u:depth.get(u) for u in article}
previous=Path('/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy.com-audit-2026-10-29/evidence/crawl.json'); old=json.loads(previous.read_text()); O={p['url']:p for p in old['pages'] if 'title'in p}; changes=[]; compared=0
for u,p in D.items():
 if u not in O:continue
 compared+=1;before=O[u];fields={}
 for k,b,a in [('status',before.get('status'),p.get('status')),('title',before.get('title'),p.get('title')),('canonical',ca(before),ca(p)),('meta_description',meta(before,'description'),meta(p,'description')),('robots',meta(before,'robots'),meta(p,'robots')),('h1',[h['text']for h in before.get('headings',[])if h.get('tag')=='h1'],[h['text']for h in p.get('headings',[])if h.get('tag')=='h1']),('og_image',meta(before,'og:image'),meta(p,'og:image')),('schema',before.get('schemas'),p.get('schemas'))]:
  if b!=a:fields[k]={'before':b,'after':a}
 if fields:changes.append({'url':u,'changes':fields})
out={'complete':C.get('complete'),'updated_at':C['updated_at'],'page_count':len(live),'locales':dict(locale),'issues':dict(issues),'schema_counts':dict(typecounts),'schema_errors':schema_errors,'articles':article,'articles_missing_sitemap':sorted(set(article)-set(sitemap)),'sitemap_entries':len(sitemap),'sitemap_lastmods':dict(Counter(e.text for e in tree.findall('s:url/s:lastmod',ns))),'duplicate_titles':{k:v for k,v in dup_titles.items()if len(v)>1},'duplicate_descriptions':{k:v for k,v in dup_descriptions.items()if len(v)>1},'image_summary':{'occurrences':image_count,'unique_sources':len(unique_images),'missing_alt':alt_missing,'empty_alt':alt_empty,'missing_dimensions':dim_missing,'with_srcset':srcset,'loading':dict(load)},'image_preloads':preloads,'inlink_counts':{u:len(inlinks[u])for u in D},'click_depths':depth,'depth_distribution':dict(Counter(depth.values())),'article_depths':article_depth,'orphan_candidates':orphan,'external_domains':dict(external),'drift':{'previous_path':str(previous.relative_to(R.parent.parent)),'compared':compared,'changes':changes},'non200':[{'url':p['url'],'status':p.get('status'),'error':p.get('error'),'history':p.get('history')}for p in rows if p.get('status')!=200],'article_schema':schema_rows}
(R/'evidence/technical-analysis.json').write_text(json.dumps(out,ensure_ascii=False,indent=2));print(json.dumps({k:v for k,v in out.items()if k in ['complete','page_count','locales','sitemap_entries','sitemap_lastmods','image_summary','depth_distribution','orphan_candidates','non200']},ensure_ascii=False,indent=2));print('Issue counts',{k:len(v)for k,v in out['issues'].items()});print('drift',out['drift']['compared'],len(changes))
