from pathlib import Path
from collections import Counter,defaultdict,deque
from urllib.parse import urlsplit,urljoin,urlunsplit
import json,csv,re,hashlib,datetime,os
R=Path('/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy.com-comprehensive-audit-2026-10-29'); E=R/'evidence'; F=R/'findings'; APP=Path('/Users/saai_mithra/Projects/Start_Up/LetBuyy/apps/marketing/web')
def read(p):return json.loads((R/p).read_text())
def write(p,v): (R/p).write_text(v if isinstance(v,str) else json.dumps(v,ensure_ascii=False,indent=2))
C=read('evidence/crawl.json'); A=read('evidence/technical-analysis.json'); B=read('evidence/browser-samples.json'); P=read('evidence/browser-performance.json'); issues=[]
for p in ['findings/technical-issues.json','findings/content-issues.json','findings/external-issues.json']:issues.extend(read(p))
def nodes(x):
 if isinstance(x,dict):
  yield x
  for v in x.values():yield from nodes(v)
 elif isinstance(x,list):
  for v in x:yield from nodes(v)
def clean(p):return p['url'] in A['inlink_counts']
cleanpages=[p for p in C['pages'] if clean(p)]; pageby={p['url']:p for p in C['pages']}
def add(id,cat,title,severity,state,urls,evidence,impact,fix,owner,effort,deps,validation,success,files,scope='Template-wide',confidence='High',sources=None):
 issues.append(dict(issue_id=id,category=cat,title=title,severity=severity,finding_state=state,confidence=confidence,affected_url_count=len(set(urls)),affected_urls=list(dict.fromkeys(urls)),representative_urls=list(dict.fromkeys(urls))[:6],template_or_page=scope,evidence=evidence,business_impact=impact,recommended_fix=fix,owner_role=owner,effort=effort,dependencies=deps,validation_steps=validation,success_indicator=success,evidence_files=files,source_references=sources or []))
software=[]
for p in cleanpages:
 for block in p.get('schemas',[]):
  for n in nodes(json.loads(block)):
   if n.get('@type')=='SoftwareApplication' and n.get('offers',{}).get('price')=='0':software.append(p['url'])
add('AUD-01','Commercial truth / Structured data','Free launch offer markup conflicts with paid plans and trial messaging','High','Confirmed',software,
 f'All {len(software)} clean locale pages emit SoftwareApplication.offers.price="0" and a free launch tier. Live rendered home/pricing samples show Launch ₹199/month (regular ₹299), Growth ₹699 (regular ₹999), and Scale/Commerce OS coming soon. Free-forever CTA text and 14-day trial messaging coexist. Observed price is not an owner-approved policy determination.',
 'Inconsistent acquisition promises can mislead readers and machine consumers about subscription obligations; no revenue or ranking impact is quantified.',
 'Resolve the approved current offer with the existing product/pricing authority. Synchronize visible copy, plan HTML, CTA, FAQ, translations, metadata and offer schema. Distinguish subscription, trial, zero commission, provider charges and GST. Remove an unsupported offer or generate an accurate one; do not invent a free plan or alter pricing to satisfy schema.',
 'Product/commercial owner + frontend engineer','0.5–1 engineer day after offer decision; editorial/translation time additional','Approved offer facts; existing gateway pricing authority; coordinate AUD-03.',
 'Compare initial HTML, hydrated plan cards, CTA/FAQ/legal copy and JSON-LD across all locales, including missing-price/provider-failure behavior. No contradictory free-forever promise may remain.',
 'Zero contradictory offer statements across inspected surfaces; visible offer and schema agree.', ['evidence/crawl.json','evidence/browser-samples.json', 'evidence/home-desktop-rendered.html','evidence/pricing-desktop-rendered.html'],sources=['https://developers.google.com/search/docs/appearance/structured-data/sd-policies'])
taxurls=['https://www.letbuyy.com/'+l+'/resources/payments/gst-for-ecommerce-india' for l in ['in','in-ta','in-hi']]
add('AUD-02','Content / Compliance','GST guide repeats superseded and overgeneralized guidance','High','Confirmed',taxurls,
 'English guide states TCS 1%, marketplace registration mandatory regardless of turnover, and apparel above ₹1,000 taxed at 12%. Translated equivalents repeat substantive guidance. Official records document the 2024 TCS reduction and conditional ecommerce registration exemption; 2025 rate changes include a ₹2,500 apparel threshold. The claimed June 2026 update did not remove these conflicts. All tax obligations were not exhaustively re-adjudicated.',
 'Merchants may rely on materially misleading compliance advice. This is a high-priority accuracy/trust issue independent of SEO rankings.',
 'Have a qualified tax reviewer resolve every threshold/rate/exemption/filing statement against applicable current notifications and conditions. Correct all languages, include dated primary references and real reviewer attribution, then review related launch/invoice/payment guides. Do not replace one blanket rule with another. A GSTR-2A mention alone is not an error: official portal help describes TCS details in Part C.',
 'Qualified tax reviewer + editorial/translation owner','1–3 reviewer/editor days for guide family; assumes access to current notifications and native-language review','Current applicable notifications, actual jurisdiction/product facts and real review ownership.',
 'Maintain a claim-to-source ledger with effective dates, exceptions and reviewer signoff. Recheck all three language variants, article/card metadata, linked guides and update dates.',
 'Zero unresolved documented conflicts in the reviewed guide family; every material compliance claim has an applicable dated primary source.',
 ['evidence/crawl.json','evidence/content-analysis.json','evidence/primary-source-log.json'],sources=['https://www.pib.gov.in/PressReleasePage.aspx?PRID=2087659&lang=2&reg=48','https://gstcouncil.gov.in/sites/default/files/2024-05/gst-ct-34-2023.pdf','https://www.pib.gov.in/FactsheetDetails.aspx?ModuleId=16&NoteId=150293&id=150293&lang=2&reg=48','https://tutorial.gst.gov.in/userguide/returns/GSTR_2A.htm'])
pricingurls=['https://www.letbuyy.com/'+l+p for l in ['in','in-ta','in-hi'] for p in ['', '/pricing']]
add('AUD-03','Rendering / Search experience','Public subscription prices arrive only after client fetching','Medium','Confirmed',pricingurls,
 'Initial home/pricing HTML contains loading skeletons in the pricing component, without actual plan cards/prices; rendered English home and pricing show ₹199/₹699 after waiting for the plan-card selector. Source Pricing.tsx fetches /api/founding-pricing in useEffect. Homepage illustrative product prices are not subscription-plan evidence.',
 'Public price/availability facts depend on additional rendering and network success; this is not proof Google cannot render them.',
 'Fetch approved public plan facts on the server through the existing gateway contract and seed the interactive client comparison. Keep one plan authority, bounded timeout/cache freshness, availability labels and truthful error/empty fallback. Isolate live slots-counter availability from otherwise valid public plans where the existing contract permits. Coordinate H1/title repair without making the homepage subsection another H1.',
 'Frontend/backend integration engineer','1–2 engineer days including timeout/cache/error/hydration verification','AUD-01 approved offer; existing public gateway pricing contract; TECH-06.',
 'With JS disabled, actual eligible plan name/price/trial conditions are visible; hydration agrees. Test upstream timeout/error/empty plans and stale counter without silently showing free/success. Verify all locales.',
 'Approved public plan facts visible before hydration and consistent after hydration, including honest unavailable states.', ['evidence/crawl.json','evidence/browser-samples.json','evidence/pricing-desktop-rendered.html'])
sat=['https://themes.letbuyy.com/sitemap.xml','https://apps.letbuyy.com/sitemap.xml','https://developer.letbuyy.com/sitemap.xml']
add('AUD-04','Robots / Sitemap discovery','Robots declares three sitemap hosts that do not resolve','Medium','Confirmed',sat,
 'Live robots.txt advertises these three satellite sitemap URLs. URL-safe resource fetches fail DNS resolution, and public dns.google A lookups return Status 3 (NXDOMAIN) for each. Root sitemap works. These are three declared resources, not three failed marketing HTML pages.',
 'Publishes dead discovery destinations and obscures which sitemap represents the active public estate; no site-wide crawl block was found.',
 'Confirm current ownership/intended publishing state, then remove stale declarations from the existing platform-links sitemap authority and retain active sitemap URLs. Do not activate dormant services or provision domains as an SEO repair.',
 'Frontend/platform owner','0.25–0.5 engineer day after ownership confirmation','Authoritative active sitemap/domain inventory; no new runtime activation.',
 'Fetch deployed robots and every declared sitemap from two resolvers/locations; each must resolve and return valid intended XML, with scope and canonical agreement.',
 'Zero nonresolving or retired sitemap declarations.', ['evidence/robots.txt','evidence/resource-probes.json'],scope='Three declared sitemap resources')
add('AUD-05','Performance / Images','Audit the homepage’s broad early image priority','Medium','Opportunity',['https://www.letbuyy.com/in'],
 'Raw homepage has 16 image preloads and 22 eager images, including lower-page capabilities/surfaces. Browser samples, 16 image-resource checks and unthrottled diagnostic paint observations were captured. PSI mobile/desktop hit quota limits; Unlighthouse timed out after 240s without route scores. No field CWV or proven performance regression exists.',
 'Unnecessary early images may compete for bandwidth/CPU on constrained devices, but bytes/priority counts alone do not demonstrate slow LCP.',
 'Collect repeatable production-equivalent mobile/desktop Lighthouse/network waterfalls and field data where enough traffic exists. Reserve eager/preload for actual critical content; measure responsive variants and motion CPU cost before changing lower sections. Preserve the real LCP asset priority. Use reduced-motion behavior and image dimensions already present.',
 'Frontend performance engineer','0.5 day measurement + 0.5–2 days targeted work if a bottleneck reproduces','Working Lighthouse or equivalent controlled lab; field/RUM access when available; stable before/after build.',
 'Compare equivalent throttling/device/network builds; repeat anomalous runs. Separate LCP/CLS diagnostic samples, Lighthouse lab/TBT and field INP. Verify image/animation visual parity and no new layout shift.',
 'Measured reduction in critical request contention/bytes with no visual or actual LCP/CLS regression; no promised score gain.', ['evidence/browser-performance.json','evidence/pagespeed.json','evidence/unlighthouse-mobile.json','evidence/resource-probes.json'],confidence='High for loading counts; medium for proposed benefit')
tags=[p['url'] for p in cleanpages if '/resources/tag/' in p['url']]
add('AUD-06','Programmatic / Information architecture','Curate tag landing pages before expanding the indexable archive set','Medium','Opportunity',tags,
 f'{len(tags)} known tag pages (89 per language) serve 35 articles per language. Many archives consist mostly of labels/cards. Their existence and length alone do not prove low quality, index bloat, doorway behavior or a penalty. Actual Google index/query data is unavailable.',
 'Overlapping navigation archives may have little distinct search purpose; helpful hubs may also be valuable. A deliberate policy avoids both indiscriminate expansion and harmful pruning.',
 'Keep and strengthen useful topic hubs; consolidate redundant tags or exclude navigation-only archives when justified by content/intent/discovery evidence. Keep all approved guides internally linked. Do not noindex simply for word count or remove all tags en masse.',
 'SEO/editorial owner + frontend engineer','1–2 days editorial mapping plus implementation once policy is chosen','TECH-01 archive URLs; actual first-party query/index data when available; content/topic map.',
 'Document each kept/consolidated/excluded class and its user purpose; verify article reachability and inspect relevant search behavior after recrawl. No new orphan articles or broken saved tag links.',
 'Approved archive policy consistently applied, with zero orphaned approved articles.', ['evidence/crawl.json','cluster-plan.json','evidence/technical-analysis.json'],scope='Known tag template across three languages; opportunity, not a defect count',confidence='Medium')
# Normalize full issue register and shared evidence references.
priority={'Critical':0,'High':1,'Medium':2,'Low':3,'Informational':4,'Info':4}
for i in issues:
 i['severity']='Informational' if i['severity']=='Info' else i['severity']
 i.setdefault('affected_urls',i['representative_urls']);i.setdefault('source_references',[]);i.setdefault('evidence_files',['evidence/crawl.json'])
 i.setdefault('implementation_example','See IMPLEMENTATION-BRIEFS.md and existing source authority; no paste-ready business facts invented.')
 i.setdefault('failure_check','The fix fails if the stated validation or success indicator does not hold, or it creates a discovery/content regression.')
 if 'evidence/crawl.json' not in i['evidence_files']:i['evidence_files'].append('evidence/crawl.json')
 i['affected_url_count_unit']='resources' if i['issue_id'] in ['AUD-04','TECH-10'] else 'pages'
issues.sort(key=lambda i:(priority[i['severity']],0 if i['finding_state']=='Confirmed' else 1,i['issue_id']))
write('issue-register.json',issues)
fields=['issue_id','category','title','severity','confidence','finding_state','affected_url_count','representative_urls','template_or_page','evidence','business_impact','recommended_fix','owner_role','effort','dependencies','validation_steps','success_indicator']
with (R/'ISSUE-REGISTER.csv').open('w',newline='') as f:
 w=csv.DictWriter(f,fieldnames=fields);w.writeheader()
 for i in issues:w.writerow({k:json.dumps(i[k],ensure_ascii=False) if isinstance(i[k],(list,dict)) else i[k] for k in fields})
# Build crawl graph/depths independently for each genuine locale homepage.
def norm(u):
 p=urlsplit(u);return urlunsplit((p.scheme,p.netloc,p.path.rstrip('/') or '/','',''))
G=defaultdict(set); incoming=defaultdict(set)
for p in cleanpages:
 for an in p.get('anchors',[]):
  u=norm(urljoin(p['final_url'],an['href']))
  if u in A['inlink_counts']:G[p['url']].add(u);incoming[u].add(p['url'])
depths={}
for lang in ['in','in-ta','in-hi']:
 start='https://www.letbuyy.com/'+lang;d={start:0};q=deque([start])
 while q:
  u=q.popleft()
  for v in G[u]:
   if v not in d and urlsplit(v).path.split('/')[1]==lang:d[v]=d[u]+1;q.append(v)
 depths.update(d)
write('evidence/link-graph-summary.json',{'method':'raw anchor BFS from each locale homepage separately; query/fragment normalized; not a JS interaction graph','depth_distribution':dict(Counter(depths.values())),'unreachable_from_own_locale_home':[p['url'] for p in cleanpages if p['url'] not in depths],'no_inlinks':[p['url'] for p in cleanpages if not incoming[p['url']] and p['url'] not in ['https://www.letbuyy.com/'+x for x in ['in','in-ta','in-hi']]],'depths':depths})
def meta(p,name):return [m.get('content','') for m in p.get('meta',[]) if m.get('name',m.get('property'))==name]
def pagetype(u):
 p=urlsplit(u).path;p=re.sub(r'^/in(?:-ta|-hi)?','',p)
 if not p:return 'Homepage'
 if '/resources/tag/' in p:return 'Tag archive'
 if '/resources/authors/' in p:return 'Author'
 if re.match('/resources/[^/]+/[^/]+$',p):return 'Article'
 if p in ['/resources/changelog','/resources/releases','/resources/search']:return p.rsplit('/',1)[-1].title()
 if re.match('/resources/[^/]+$',p):return 'Category'
 if p.startswith('/legal/'):return 'Legal document'
 return p.strip('/').title() or 'Homepage'
rows=[];allimages=[]
for p in C['pages']:
 u=p['url'];parsed=urlsplit(u);ss=[]
 for s in p.get('schemas',[]):
  try:ss.extend(n.get('@type') for n in nodes(json.loads(s)) if n.get('@type'))
  except Exception:pass
 als={l.get('hreflang'):l.get('href') for l in p.get('links',[]) if l.get('hreflang')}
 robot=meta(p,'robots')+meta(p,'googlebot');canon=[l['href'] for l in p.get('links',[]) if l.get('rel')=='canonical'];ins=[];outs=[]
 for a in p.get('anchors',[]):
  target=urljoin(p.get('final_url',u),a['href']);item={'url':target,'text':a.get('text','').strip(),'rel':a.get('rel','')}
  (ins if urlsplit(target).hostname in ['www.letbuyy.com','letbuyy.com'] else outs).append(item)
 ims=[]
 for im in p.get('images',[]):
  it=dict(im);it['absolute_src']=urljoin(p.get('final_url',u),it.get('src',''));it['page_url']=u
  it['lazy_method']='native' if im.get('loading')=='lazy' else ('perfmatters' if any(k.startswith('data-perfmatters') for k in im) else 'ewww' if any(k.startswith('data-ewww') for k in im) else 'js-generic' if any(k in im for k in ['data-src','data-srcset','data-lazy-src','data-original']) or 'lazyload' in im.get('class','') else 'none')
  ims.append(it)
  if clean(p):allimages.append(it)
 samples=[x for x in B['samples'] if x['url']==u]
 indexstate='not measured'
 if p.get('status',0)>=400:indexstate='HTTP error; not an indexable content success'
 elif p.get('status')==200:indexstate='noindex' if 'noindex' in ','.join(robot).lower()+p.get('headers',{}).get('x-robots-tag','').lower() else 'No exclusion found; actual indexing unverified'
 row={'requested_url':u,'final_url':p.get('final_url'),'discovery_source':C['discovery_sources'].get(u,[]),'http_status':p.get('status'),'transport_error':p.get('error'),'redirect_chain':p.get('history',[]),'captured_at':p.get('captured_at'),'page_type':pagetype(u),'crawl_depth':depths.get(u),'indexability_signals':indexstate,'robots_meta':robot,'x_robots_tag':p.get('headers',{}).get('x-robots-tag'),'canonical':canon,'title':p.get('title'),'meta_description':meta(p,'description'),'headings':p.get('headings',[]),'html_lang':p.get('html_lang'),'locale_path':parsed.path.split('/')[1] if len(parsed.path.split('/'))>1 else None,'hreflang':als,'schema_types':sorted(set(str(x) for x in ss)),'internal_links':ins,'external_links':outs,'images':ims,'visible_word_count':p.get('word_count'),'main_word_count':p.get('main_word_count'),'inlink_count':len(incoming[u]),'decoded_html_bytes':p.get('decoded_bytes'),'transfer_bytes':p.get('bytes_downloaded'),'http_fetch_seconds':p.get('fetch_seconds'),'rendering_observations':{'sampled':bool(samples),'samples':[x['device'] for x in samples],'evidence':'evidence/browser-samples.json' if samples else None,'raw_main_content':bool(p.get('main_text'))},'performance_evidence':'evidence/browser-performance.json' if any(x['url']==u for x in P) else None,'field_cwv':None,'evidence_html':p.get('evidence_html'),'evidence_headers':p.get('evidence_headers'),'initial_failed_attempt':p.get('prior_attempt')}
 rows.append(row)
write('evidence/url-inventory.json',rows);write('evidence/image-inventory.json',allimages)
with (R/'URL-INVENTORY.csv').open('w',newline='') as f:
 w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader()
 for row in rows:w.writerow({k:json.dumps(v,ensure_ascii=False) if isinstance(v,(dict,list)) else v for k,v in row.items()})
# Public source ledger records observations and retrieval bounds without full copyrighted source copies.
sources=[
 ('Google canonical guidance','https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls','Canonical/redirect/sitemap signals are preferences, not indexing guarantees.'),
 ('Google sitemaps','https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap','Final canonical URLs and accurate significant-change lastmod; no indexing guarantee.'),
 ('Google localized versions','https://developers.google.com/search/docs/specialty/international/localized-versions','Equivalent reciprocal language annotations; avoid cross-language canonical mistakes.'),
 ('Google software application','https://developers.google.com/search/docs/appearance/structured-data/software-app','Feature eligibility differs from parseable Schema.org JSON; genuine review/rating requirement.'),
 ('Google Article','https://developers.google.com/search/docs/appearance/structured-data/article','Accurate article/author/image identity; no fabricated credentials.'),
 ('Google AI features','https://developers.google.com/search/docs/appearance/ai-features','Ordinary SEO, visible text, no required special AI files.'),
 ('Google documentation updates','https://developers.google.com/search/updates','Checked live October29; FAQ rich-result retirement confirmed; update ledger verifiedOct22 and7daysold.'),
 ('Google Search Status','https://status.search.google.com/','Live dashboard showed no incidents when checked; not evidence of site-specific rank changes.'),
 ('Ministry of Finance TCS record','https://www.pib.gov.in/PressReleasePage.aspx?PRID=2087659&lang=2&reg=48','2024 record documents reduction of total TCS to0.5%; not a complete current legal review.'),
 ('Notification34/2023','https://gstcouncil.gov.in/sites/default/files/2024-05/gst-ct-34-2023.pdf','Conditional below-threshold single-state ecommerce goods registration exemption; conditions apply.'),
 ('2025 apparel reforms','https://www.pib.gov.in/FactsheetDetails.aspx?ModuleId=16&NoteId=150293&id=150293&lang=2&reg=48','Official Sep17 2025 textile factsheet describes ₹2500 threshold; exact current product classification/notifications need reviewer.'),
 ('2025 reform schedule','https://www.pib.gov.in/PressReleasePage.aspx?PRID=2163555&lang=2&reg=3','Primary search excerpts include Sep22 2025 implementation and above₹2500 apparel18%; full tool open exceeded byte cap.'),
 ('GST portal GSTR2A','https://tutorial.gst.gov.in/userguide/returns/GSTR_2A.htm','Official manual supports TCS receipt details in PartC; do not falsely flag that mention alone.'),
 ('Unlighthouse CLI','https://unlighthouse.dev/integrations/cli','Runtime/wrapper attempted; 4-route request timed out240seconds; no scores.'),
 ('Unlighthouse config','https://unlighthouse.dev/api/config','Reviewed actual route-cap/config interface; no production config changed.')]
write('evidence/primary-source-log.json',{'checked_on':'2026-10-29','method':'web primary-page opens/search; source-specific limits recorded','sources':[{'title':t,'url':u,'supports':n} for t,u,n in sources]})
write('evidence/provider-presence.json',{k:bool(os.environ.get(k)) for k in ['DATAFORSEO_LOGIN','DATAFORSEO_PASSWORD','FIRECRAWL_API_KEY','AHREFS_API_KEY','SERANKING_API_KEY','PROFOUND_API_KEY','BING_WEBMASTER_API_KEY','GOOGLE_API_KEY','MATOMO_API_TOKEN']})
# 35-route coverage, preserving distinction between operational checks and downstream unavailable inputs.
coverage={}
for file in ['findings/technical-coverage.json','findings/content-coverage.json','findings/external-coverage.json']:
 for x in read(file):
  key=x.get('command',x.get('route'));coverage[key]={'route':key,'applicable':x['applicable'],'why':x['why'],'status':x['status'],'evidence':x.get('evidence',x.get('evidence_or_output',[])),'missing_prerequisites':x.get('missing_prerequisites',x.get('missing_prerequisite','None')),'next_step':x.get('exact_next_step',x.get('next_step','None'))}
def cov(route,app,why,status,evidence,missing,nextstep):coverage[route]=dict(route=route,applicable=app,why=why,status=status,evidence=evidence,missing_prerequisites=missing,next_step=nextstep)
cov('doctor',True,'Core and browser readiness required','executed',['evidence/runtime-doctor.json'],'None','Retain isolated runtime; rerun only if environment changes.')
cov('setup',True,'Managed environment was absent; owner explicitly authorized repair/Chromium','executed',['evidence/runtime-setup.json','evidence/runtime-doctor.json'],'None','Setup completed without relaxing requirements or global Python installation.')
cov('updates',True,'Current policy/feature claims and historical interpretation','executed',['evidence/google-updates-ledger.json','evidence/primary-source-log.json'],'No causal search-performance timeline','Recheck live policies when implementing; correlate only if real trend data exists.')
cov('audit',True,'Whole live site request','executed',['FULL-SEO-AUDIT.md','ISSUE-REGISTER.csv','URL-INVENTORY.csv'],'Specified unmeasured categories remain explicit','Implement approved backlog separately and compare after authorized release.')
cov('google',True,'Search/index/performance evidence relevant','partially executed',['evidence/google-credential-status.json','evidence/pagespeed.json'],'No configured GSC/GA4/API credentials; PSI mobile/desktop quota errors; no CrUX','Provide read-only property access/export and available PSI quota; then run GSC/GA4/CrUX read commands without submissions.')
cov('dataforseo',True,'Optional controlled SERP/keyword/backlink enrichment','unavailable',['evidence/provider-presence.json','evidence/tool-discovery.json'],'No connected DataForSEO tool; no established credential/backend/budget','Connect an authorized read-capable provider and approve specific metered scope before calls; no paid credits consumed.')
cov('image-gen',True,'Audit-only asset plan useful; generation not required','executed',['IMAGE-ASSET-PLAN.md'],'Actual generation intentionally outside audit','Reuse verified existing assets first; commission factual UI captures or proposed art only under a later generation request.')
for route in ['firecrawl','ahrefs','profound','seranking']:
 cov(route,True,'Optional '+route+' enrichment may add coverage','unavailable',['evidence/tool-discovery.json','evidence/provider-presence.json'],'No connected executable provider tools or established account entitlement/budget','Connect configured read-only provider and approve any metered scope; then use workflow-specific documented endpoints.')
cov('bing',True,'Owned index/link evidence relevant; submissions prohibited','unavailable',['evidence/backlink-credential-status.txt'],'No Bing Webmaster credential or connected property access','Supply authorized read access/property export; query links/index reports only. Do not submit IndexNow.')
cov('matomo',True,'Organic landing/conversion analytics could enrich conclusions','unavailable',['evidence/matomo-credential-status.txt'],'No instance URL/token/site configured','Supply authorized read-only reporting configuration or exports; settings unchanged.')
cov('unlighthouse',True,'Representative multi-page lab analysis requested','unavailable',['evidence/unlighthouse-mobile.json'],'Documented wrapper request4routes mobile timed out after240s, no route results','Resolve npm/Unlighthouse runtime startup in scratch, then measure fixed representative mobile/desktop URLs; no score inferred.')
coverage['agentic']['evidence']=['evidence/agent-http.json','evidence/agent-ux.json','evidence/browser-samples.json','evidence/browser-performance.json']
coverage['agentic']['missing_prerequisites']='Lighthouse Agentic Browsing X/N unavailable; real-agent log validation and consequential action testing absent.'
coverage['agentic']['next_step']='Use available saved manual/HTTP/heuristic checks; obtain real Lighthouse agentic results before reporting X/N. No special discovery file is required merely for ranking.'
coverage['backlinks']['evidence']=['evidence/external/known-backlinks-verified.json','evidence/commoncrawl.json','evidence/backlink-credential-status.txt']
coverage['backlinks']['missing_prerequisites']='Complete link/referring-domain inventories, competitor history and authority metrics unavailable. Common Crawl helper returned no matching record, but bounded streaming cannot establish definitive absence.'
coverage['backlinks']['next_step']='Use owned GSC/Bing/provider exports; validate sampled links. Do not interpret one verified link as total count or Common Crawl nonmatch as proof of no authority.'
coverage['sxo']['evidence']+=['evidence/browser-samples.json','evidence/signup-fetch.json','evidence/contact-controls.json']
order=['doctor','setup','updates','audit','page','technical','content','content-brief','schema','sitemap','images','geo','agentic','plan','cluster','sxo','drift','ecommerce','programmatic','competitor-pages','local','maps','hreflang','google','backlinks','flow','dataforseo','image-gen','firecrawl','ahrefs','bing','matomo','profound','seranking','unlighthouse']
assert len(order)==35 and set(order)==set(coverage),(set(order)-set(coverage),set(coverage)-set(order))
write('toolkit-coverage.json',[coverage[k] for k in order]);write('TOOLKIT-COVERAGE.md','# SEO toolkit coverage\n\nAll 35 requested routes are accounted for. Executed describes the scoped audit work, not universal certainty or deployment. Missing prerequisites and exact next steps are explicit. No paid provider credits, submissions, settings changes, purchases, outreach or recurring jobs were used.\n\n| # | Route | Applicable / why | Status | Evidence/output | Missing prerequisite | Exact next step |\n|---|---|---|---|---|---|---|\n'+'\n'.join('| '+str(idx)+' | /seo '+k+' | '+('Yes' if coverage[k]['applicable'] else 'No')+' — '+coverage[k]['why'].replace('|','/')+' | '+coverage[k]['status']+' | '+('; '.join(coverage[k]['evidence']) if isinstance(coverage[k]['evidence'],list) else coverage[k]['evidence'])+' | '+str(coverage[k]['missing_prerequisites']).replace('|','/')+' | '+coverage[k]['next_step'].replace('|','/')+' |' for idx,k in enumerate(order,1))+'\n\nRuntime setup succeeded separately for core and Chromium. GSC/GA4/CrUX credentials were absent; public PSI failed quota on mobile and desktop. Unlighthouse returned timeout, not low scores. Local/maps/product-feed work is not applicable to the observed SaaS marketing origin; reassess if a real eligible property is separately scoped.\n')
# Measured browser diagnostics are not field CWV or repeatable Lighthouse results.
perf=[]
for p in P:
 obs=p.get('observations',{}); last=(obs.get('lcp') or [{}])[-1]
 perf.append({'url':p['url'],'device':p['device'],'method':p['method'],'last_lcp_candidate_ms':last.get('startTime'),'lcp_element':last.get('element'),'layout_shift_entry_count':len(obs.get('shifts',[])),'layout_shift_sum_diagnostic_only':sum(x['value'] for x in obs.get('shifts',[])),'longtasks_count':len(obs.get('longtasks',[])),'navigation':obs.get('navigation'),'field_inp':None})
write('evidence/browser-performance-summary.json',perf)
write('findings/performance-and-visual.md','# Performance, mobile and accessibility evidence\n\nPSI mobile and desktop returned rate-limit errors; the documented four-route Unlighthouse attempt timed out after 240 seconds without scores. No Lighthouse category score, Lighthouse Agentic Browsing X/N, CrUX percentile or field INP is available.\n\nSix cold-context headless Chromium observations cover homepage, pricing and GST article, each desktop/mobile. Network and CPU were unthrottled, one run each, six seconds of observation. These are diagnostic browser measurements, not representative field CWV or a reproducible mobile benchmark. Last LCP candidates ranged '+str(min(x['last_lcp_candidate_ms'] for x in perf))+'–'+str(max(x['last_lcp_candidate_ms'] for x in perf))+' ms in these conditions. Per-entry shift sums are diagnostics and do not implement the CLS session-window algorithm. No good/poor field verdict is assigned. See [measurement summary](../evidence/browser-performance-summary.json).\n\nThe homepage has16 image preloads and22 eager images, including lower sections. All489locale pages together have4413image occurrences,95distinct src URLs,0missing alt attributes and0missing dimension pairs. Emptyalt is common on decorative/redundant art and is not automatically wrong. Sixteen image assets were probed for bytes/format/dimensions; the512px organization PNG is225263bytes, a compression opportunity that does not prove an LCP issue.\n\nTwenty-three rendered samples cover every major template plus Tamil/Hindi homepages. Five English templates were also inspected at375×812. All23samples have no document horizontal overflow at their tested viewport. Visual screenshots were inspected for the mobile homepage, pricing and contact. The mobile hero H1 begins aroundy432; large art precedes the promise. The header CTA remains visible. This is a prioritization hypothesis, not evidence of lost conversions.\n\nThe mobile menu opens and Escape closes it in the measured browser sample. Contact initial-step inputs have associated visible labels or the country selector aria label. The component uses client-side step controls rather than a native form; no conclusion of broken submission follows from absence of a form tag. Empty inputs were not submitted and no personal data was entered. All required-state, keyboard/error/recovery paths are not certified.\n\nThe installed agent-UX helper returned100/100,75interactive nodes,0unnamed interactive nodes in its homepage sample. This is that tool’s local heuristic, not a WCAG score, whole-site guarantee or Lighthouse Agentic Browsing fraction. HTTP access checks include unverified user-agent requests; successful responses do not prove actual bot identity/indexing/citations. See [agent evidence](../evidence/agent-http.json) and [heuristic output](../evidence/agent-ux.json).\n')
# Issue render used by both full report and professional envelope.
def tostr(v):return '; '.join(map(str,v)) if isinstance(v,list) else str(v)
def issue_md(i):
 rep=' · '.join('['+u+']('+u+')' for u in i['representative_urls'][:4]); out=f"### {i['issue_id']} — {i['title']}\n\n**{i['severity']} · {i['finding_state']} · confidence: {i['confidence']} · {i['affected_url_count']} inspected {i['affected_url_count_unit']} · {i['template_or_page']}**\n\n**Evidence:** {i['evidence']}\n\n**Representative URLs:** {rep}\n\n**Why it matters:** {i['business_impact']}\n\n**Fix:** {i['recommended_fix']}\n\n**Owner / estimated effort:** {i['owner_role']} · {i['effort']}\n\n**Dependencies:** {tostr(i['dependencies'])}\n\n**Validation:** {tostr(i['validation_steps'])}\n\n**Success indicator:** {i['success_indicator']}\n\n**Evidence files:** "+', '.join('['+x+']('+x+')' for x in i['evidence_files'])+'\n'
 if i['source_references']:out+='\n**Primary references:** '+', '.join('[source '+str(n)+']('+u+')' for n,u in enumerate(i['source_references'],1))+'\n'
 return out+'\n'
severity=Counter(i['severity'] for i in issues);states=Counter(i['finding_state'] for i in issues)
summary=f'''# LetBuyy live SEO audit — executive summary

**Audited:** https://www.letbuyy.com/in · **Date:** 29 October 2026, Asia/Kolkata. Capture timestamps are preserved in UTC.

**Assessment:** The public site is accessible and provides substantial server-rendered content. The most pressing problems are inconsistent locale identities, contradictory commercial facts and unsourced or outdated advice. Fix correctness and discovery signals before expanding the content footprint. No site-wide indexing block, critical incident, penalty or measured ranking loss was demonstrated.

## Business context established from the site

Observed: LetBuyy presents a Commerce OS and online-store/merchant operations platform; marketing, subscription pricing and educational resources are the main page types. Copy explicitly targets Indian sellers, UPI/COD/GST use cases, INR prices, and English/Tamil/Hindi. Main actions are account signup, plan review, demo and contact. Public guides also target developers/agencies and existing operators. These are website observations, not inferences from the user’s timezone. The origin is a SaaS marketing property, not an inspected customer SKU store or eligible in-person local business.

Observed technology: Next.js script/image/rendering signals and Vercel headers; repository source confirms Next.js16/React19 and existing gateway-backed pricing. Local source differs from production. HTML, rendered DOM and source observations are identified separately.

## Coverage

- **499 distinct crawl/probe URLs discovered and inspected; 500 designated crawl attempts including one retry.** The initial crawl had496attempts; reconciliation fetched3ordinary tag/cart pages and retried one legal-page timeout. The final dataset has497HTTP200 responses and2deliberate404 probes.
- **489 clean marketing HTML pages:163perlanguage**, excluding aliases and deliberate invalid/error/discovery probes. All99root XML sitemap URLs inspected;105article equivalents (35perlanguage),267known tag archives,21category pages and15author pages are represented.
- **23 rendered samples** cover all major templates; homepage/pricing/article/contact/support have additional mobile samples. Four homepage viewport screenshots and other representative screenshots are saved. Six separate diagnostic browser performance samples cover3templates×2devices.
- Five primary competitor pages fetched and parsed; focused search-query evidence recorded. One selected public backlink verified.16image assets, three satellite sitemap hosts and two RSS feeds sampled. Public signup destination returned200; no signup/form action was submitted.

## Findings

**{len(issues)} unique findings:** {severity.get('Critical',0)}Critical, {severity['High']}High, {severity['Medium']}Medium, {severity['Low']}Low, {severity['Informational']}Informational. These counts include opportunities and needs-verification items: {states['Confirmed']}Confirmed, {states.get('Needs verification',0)}Needs verification, {states.get('Opportunity',0)}Opportunity. Affected counts overlap; do not sum them into unique broken pages.

-303resource canonicals omit the served locale;309total canonical mismatches include create/search inheritance.
-All105discovered localized articles are absent from the99entry XML sitemap;27listedURLs disagree with their canonicals.
-All489cleanlocale pages carry a free-offer schema, while rendered acquisition pages show paid subscriptions/trials.
-The GST guide contains documented conflicts with official material, and the270%conversion headline miscalculates the stated numbers.
-19English articles have quantified claims without in-body source links; merchant outcome and expert biographies require provenance verification.
-Subscription plan cards/prices depend on client fetching; all3pricing pages lackH1.
-Article structured-data identities/breadcrumbs omit locales; arbitrary nonexistent tag returnsindexable200.
-Three declared satellite sitemap hosts returnNXDOMAIN. Social metadata and RSS identity also need consistency work.

## First five actions

1. Confirm approved offer/availability facts; align copy and schema and correct material editorial/compliance claims across languages.
2. Reuse the existing locale metadata helper in the three bypassing resource templates; decide create/search and unknown-tag policies.
3. Server-render approved pricing through the existing gateway authority and add page-level H1/title without duplicating plan ownership.
4. Generate the approved article sitemap, truthful lastmod and final schema/feed identities; remove retired sitemap declarations.
5. Establish controlled lab and available first-party measurement; then test image priority, archive curation and category/CTA clarity.

## Measurement limits

Overall/category SEO scores are withheld: no transparent calibrated category scoring is justified here. The skill weights remain22%technical,23%content,20%on-page,10%schema,10%performance,10%AI,5%images, but missing metrics are not zeros or passes. GSC/GA4/CrUX and paid-provider access were not configured; actual rankings, index coverage, traffic, conversion and AI citations are unmeasured. PSI was quota-limited, Unlighthouse timed out, and browser diagnostic paint observations are not fieldCWV. No geolocated top10dataset, keyword volumes or full backlinks inventory exists. Native-language quality and consequential user journeys remain unverified.

Start with [the full audit](FULL-SEO-AUDIT.md), [issue register](ISSUE-REGISTER.csv), [repair briefs](IMPLEMENTATION-BRIEFS.md), [prioritized plan](PRIORITIZED-ACTION-PLAN.md) and [all35route coverage](TOOLKIT-COVERAGE.md). This audit changed no website/application source, production settings, DNS, analytics, GBP, submissions or schedules.
'''
# Restore plain spacing in hand-built summaries without modifying URLs/identifiers.
for old,new in [('496attempts','496 attempts'),('3ordinary','3 ordinary'),('163perlanguage','163 per language'),('all99','all 99'),('All99','All 99'),('105article','105 article'),('35perlanguage','35 per language'),('267known','267 known'),('21category','21 category'),('15author','15 author'),('16image','16 image'),('200responses','200 responses'),('303resource','303 resource'),('309total','309 total'),('All105','All 105'),('105discovered','105 discovered'),('99entry','99-entry'),('27listedURLs','27 listed URLs'),('All489cleanlocale','All 489 clean locale'),('270%conversion','270% conversion'),('19English','19 English'),('all3pricing','all 3 pricing'),('lackH1','lack H1'),('returnsindexable200','returns indexable 200'),('returnNXDOMAIN','return NXDOMAIN'),('22%technical','22% technical'),('23%content','23% content'),('20%on-page','20% on-page'),('10%schema','10% schema'),('10%performance','10% performance'),('10%AI','10% AI'),('5%images','5% images'),('fieldCWV','field CWV'),('top10dataset','top-10 dataset'),('all35route','all 35 route')]:summary=summary.replace(old,new)
summary=summary.replace('\n-','\n- ') if False else summary
summary=re.sub(r'(?m)^-(?=\S)','- ',summary)
write('EXECUTIVE-SUMMARY.md',summary)
header=summary.split('## First five actions')[0]
full=header+'\n## Method and evidence interpretation\n\nRobots-respecting crawl capped at500attempts including reconciliation, five worker maximum, one-second launch spacing, maximum3redirect hops,30srequest budget,4MiBpage cap, public-IP checks and TLS verification. Seed sources: live robots/root sitemap and locale home/navigation/footer links, plus bounded normalization/404/tag probes. Queries/actions/cart/logout/purchases/tracking loops excluded. The cart-tag false-positive was corrected before final reporting. No crawl queue remains; this exhausts the discovered safe graph, not unknowable orphan URLs or the entire domain estate. Supplementary resources/browser/measurements and competitor fetches are counted separately.\n\nRaw visible-word counts include visible navigation/decorative copy and may include collapsed sections. They are diagnostics, not content minimums. Empty-alt decorative images are not missing accessibility text. HTTP200/robotsallow, JSON parsing, schemaeligibility and actual indexing are distinct.\n\n## Confirmed problems, verification items and opportunities\n\n'+ '\n'.join(issue_md(i) for i in issues)
full+='''## Internal linking, information architecture and multilingual implementation

All 35 article records per language are linked through categories, related-guide/footer/navigation structures. No clean inspected content page lacked an inbound raw link in the sampled graph. Per-locale BFS and all discovered links are saved in evidence/link-graph-summary.json and URL-INVENTORY.csv. Raw anchor graph does not model a language-switcher button/router action; each language homepage is its own traversal root. This is not proof that all possible source/CMS URLs are reachable. All105article body containers lack contextual internal links and external reference anchors; existing related content is outside the bodies. Improve task context, not raw link count.

The three language paths are explicit equivalents. Root sitemap alternates are structurally reciprocal, but some target pages nominate incorrect canonicals (TECH-01/02/03). Both XML and HTML hreflang are permitted; duplicating methods is not automatically a defect. Canonical/alternate accuracy and actual translation availability are the priority. English/Tamil/Hindi HTML, metadata and shared claims were compared structurally; full native-language editorial accuracy and actual language-specific search performance are not certified.

Articles are35perlanguage and tags89perlanguage. This is a templated archive system, not an observed city doorway network. No faceted/query/calendar loops were expanded and no endless infinite-scroll discovery blocker was found in the saved raw graph. Search query variants, arbitrary tags and other subdomain estates are not exhaustively tested. Unknown tags have one explicit negative probe.

## Performance, mobile, accessibility and task journeys

See findings/performance-and-visual.md for separate browser diagnostics, screenshot observations and tool errors. Home/pricing/article/contact/support mobile samples showed no horizontal overflow at375px; that does not certify every viewport. Menu open/Escape-close worked in a real browser sample; the initial contact-step fields were labelled. Safe signup-destination fetch returned200. Contact/demo are multi-step client controls; no messages, accounts, payments, empty-form submission or personal data were sent. Form validation/recovery, Turnstile delivery, provider signup and downstream conversions remain untested.

The installed agent-UX100/100 is only its local homepage heuristic. Lighthouse Agentic BrowsingX/N is unavailable. Optional Markdown/llms/ai-catalog/WebMCP discovery absence is not an SEO failure. User-agent probes are unverified requests and cannot establish real bot identity, WAF allowlisting, actual crawling or citation visibility.

## Competitors, authority and strategy

See COMPETITOR-AND-AI-VISIBILITY.md for five freshly fetched primary competitor pages, search-query/location caveats, one verified backlink and source-backed crawler distinctions. No external authority score is assigned. The Common Crawl helper returned no matching domain record in its bounded fetch; its implementation can stop after byte/time bounds, so this is not proof of absence from the full dataset or of zero authority/backlinks. Historical competitor rank/traffic and complete link data are unavailable.

CONTENT-AND-CLUSTER-PLAN.md gives four detailed existing-page upgrade briefs, seven category groups and a provisional36phrase map. cluster-plan.json links17existing prioritypages; internal-link-matrix.csv proposes44contextual links. No controlled top10overlap/volume data exists, so the clusters are intent hypotheses, not measured keyword clusters or cannibalization findings. Improve existing pages before new comparison or location-page networks.

## Historical change and baseline

There was no configured earlier drift database. A real earlier same-day production capture supports a narrow163URLcomparison; no material compared metadata changes were found. This does not establish long-term stability or rank causation. A new homepage baseline and portable489page observed-current baseline were created, explicitly retaining known defects. No recurring monitoring was scheduled. See findings/drift.md and evidence/current-seo-baseline.json.

## Scope exclusions and missing data

Local/maps/GBP and consumer product feeds/UCP are not applicable to the observed software marketing origin. Illustrative product cards and a mailing/contact address do not establish a live merchant catalog or eligible in-person business. No need to fabricate local profiles, product ratings or marketplace adoption. Separately scope a real merchant storefront or eligible location before those specialized checks.

No authenticated GSC/GA4/CrUX/Bing/Matomo access, paid-provider backend, controlled geolocated SERP, keyword demand, full backlink history, real AI-answer citation series or field CWV was available. Schema syntax and required/recommended property checks ran locally, but interactive Schema Markup Validator/Google Rich Results Test was not executed; no rich-result display is guaranteed. Full native-language review, all asset byte/display pairings, full accessibility conformance, exact user recovery/provider flows, query variants and nonpublic pages remain unverified.

The isolated skill Python/Chromium setup succeeded without changing documented constraints or global Python. PSI mobile/desktop rate-limit errors and Unlighthouse240stimeout are saved as failures. No successful tool result is implied from a recipe, credential name or missing provider. TOOLKIT-COVERAGE.md covers every requested route and its next step.

At the next authorized audit after fixes/release, compare final locale identities, approved article coverage, truthful public offer/claim/schema states, initial plan HTML, negative-tag behavior and working discovery resources against this baseline. Then add actual index/query/field measurements when available. No specific ranking or revenue gain is promised.
'''
write('FULL-SEO-AUDIT.md',full)
# Action plan is dependency-first, not a fabricated deadline.
phases=[{'name':'Batch 1 — Public truth and URL policy','timeframe':'First implementation batch; reviewer availability determines duration','ids':['AUD-01','AUD-02','CONTENT-01','CONTENT-02','CONTENT-03','TECH-01','TECH-02','TECH-03','TECH-09']}, {'name':'Batch 2 — Pricing, discovery and entities','timeframe':'After relevant offer/indexability facts are settled','ids':['AUD-03','TECH-06','TECH-04','TECH-05','TECH-07','TECH-08','TECH-10','AUD-04','TECH-11']}, {'name':'Batch 3 — Existing-page usefulness and journey clarity','timeframe':'Following factual correction; no fixed content-production quota','ids':['CONTENT-04','CONTENT-05','EXT-01','AUD-06']}, {'name':'Batch 4 — Measured performance and authority','timeframe':'Start measurement early; optimize when a reproducible bottleneck exists','ids':['AUD-05']}]
byid={i['issue_id']:i for i in issues}
plan='# Prioritized action plan\n\nOrder uses evidence, affected breadth, merchant trust, dependencies and effort. Efforts are engineering/editor estimates with assumptions, not release promises; overlapping template work should be combined rather than summed. No deployment/submission is authorized by this document.\n\n'
for phase in phases:
 plan+='## '+phase['name']+'\n\n'+phase['timeframe']+'.\n\n| ID | Work | Owner | Effort / assumptions | Dependency | Acceptance |\n|---|---|---|---|---|---|\n'
 for id in phase['ids']:
  i=byid[id];plan+='| '+id+' | '+i['title']+' | '+i['owner_role']+' | '+i['effort']+' | '+tostr(i['dependencies']).replace('|','/')+' | '+i['success_indicator']+' |\n'
 plan+='\n'
plan+='''## Shared implementation decisions

- Resolve commercial truth, real author/result provenance and jurisdiction-specific compliance facts with the actual owners. These decisions must not block mechanical template investigation.
- Decide search/create/indexable archive policy before publishing the final sitemap. Broad tag pruning does not need to block self-canonical repairs for retained pages.
- Reuse canonical metadata helpers, article registry, public gateway plan contracts and brand assets. Do not add a parallel SEO/content/pricing authority or activate dormant marketplaces.
- Pair every change with explicit positive/negative acceptance: known/unknown tag, raw/hydrated pricing, all languages, empty/error/retry behavior, canonical/alternate/sitemap agreement and accurate claims.
- Keep production rollout and external submissions as separately authorized actions. Validate deployed HTML independently of local source; wait for actual recrawl/GSC evidence before claiming indexing success.

## Success measures

Immediate indicators:0incorrect retained canonicals;100%approved article sitemap coverage;0contradictory offers;0documented numerical/tax conflicts; accurate author/case provenance; plan facts in initial HTML;0invalid200tag pages;0dead sitemap declarations. Later indicators: Google-selected canonicals, indexed intended pages, qualified non-brand query impressions/CTR and signup/demo starts, and actual field LCP/INP/CLS where enough traffic exists. No numeric business uplift or ranking deadline is promised.
'''
write('PRIORITIZED-ACTION-PLAN.md',plan)
# Structured envelope required by packaged report generator; absent scores remain null.
groups=defaultdict(list)
for i in issues:
 cat='Content Quality' if i['issue_id'].startswith('CONTENT') or i['issue_id']=='AUD-02' else 'Technical SEO' if i['issue_id'] in ['TECH-01','TECH-02','TECH-03','TECH-04','TECH-05','TECH-09','TECH-10','AUD-04','AUD-06'] else 'Performance (CWV)' if i['issue_id']=='AUD-05' else 'Schema / Structured Data' if i['issue_id'] in ['TECH-07','TECH-11','AUD-01'] else 'On-Page SEO'
 groups[cat].append(i)
categories=[]
for name in ['Technical SEO','Content Quality','On-Page SEO','Schema / Structured Data','Performance (CWV)','AI Search Readiness','Images']:
 entries=[]
 for i in groups[name]:
  entries.append({**i,'id':i['issue_id'],'severity':'Info' if i['severity']=='Informational' else i['severity'],'description':i['evidence']+' Scope: '+str(i['affected_url_count'])+' '+i['affected_url_count_unit']+'. State: '+i['finding_state']+'. Confidence: '+i['confidence']+'. '+i['business_impact'],'recommendation':i['recommended_fix'],'validation':tostr(i['validation_steps']),'leading_indicator':i['success_indicator']})
 categories.append({'name':name,'score':None,'measurement_status':'qualitative measured scope; no numeric calibration' if name not in ['Performance (CWV)','AI Search Readiness'] else 'partial; field/citation outcomes not measured','what_works':['Public HTML contains substantial content; evidence and limits are explicit.'],'findings':entries})
write('audit-data.json',{'audit_date':'2026-10-29','timezone':'Asia/Kolkata','target_url':'https://www.letbuyy.com/in','summary':{'health_score':None,'business_type':'Observed commerce software/SaaS marketing and educational publisher for Indian merchants','top_findings':[i['title'] for i in issues if i['severity']=='High' and i['finding_state']=='Confirmed'],'quick_wins':['Correct arithmetic/headline and truthful offer claims','Repair retained locale canonicals using existing helper','Add page-level pricing H1','Include approved articles in canonical sitemap','Remove confirmed retired sitemap declarations'],'unique_findings':len(issues),'by_severity':dict(severity),'by_state':dict(states)},'measurement':{'distinct_crawl_urls':len(rows),'crawl_attempts':500,'clean_locale_html':len(cleanpages),'locale_counts':A['locales'],'root_sitemap_entries':99,'articles':105,'browser_samples':23,'diagnostic_browser_performance_samples':6,'lighthouse_scores':None,'field_cwv':None,'gsc':None,'ga4':None,'keyword_volumes':None,'ai_citations':None,'category_weights':{'technical':22,'content':23,'on_page':20,'schema':10,'performance':10,'ai':10,'images':5},'aggregate_status':'withheld; no invented missing-category scores','agent_ux_heuristic':{'score':100,'scope':'one homepage','not':'WCAG or Lighthouse X/N'},'lighthouse_agentic_fraction':None},'categories':categories,'action_plan':{'phases':[{'name':p['name'],'timeframe':p['timeframe'],'items':[byid[i]['title'] for i in p['ids']]} for p in phases]},'artifacts':{'findings_dir':'findings/','screenshots_dir':'screenshots/','issues':'ISSUE-REGISTER.csv','inventory':'URL-INVENTORY.csv','coverage':'TOOLKIT-COVERAGE.md','full_audit':'FULL-SEO-AUDIT.md'},'sources':[{'title':t,'url':u} for t,u,n in sources],'limits':['GSC/GA4/CrUX/Bing/Matomo and paid providers unavailable','PSI rate-limited; Unlighthouse timed out; no field CWV or Lighthouse score','Keyword clusters provisional; no controlled geolocated top10/volume data','No actual AI citation sample, full backlink inventory or long-term historical baseline','No consequential user submissions/provider transactions or native-language editorial certification'],'checks':{'no_live_changes':True,'no_app_source_changes':True,'no_paid_credits':True,'no_indexing_submissions':True,'no_schedules':True}})
print(json.dumps({'issues':len(issues),'severity':dict(severity),'state':dict(states),'inventory_rows':len(rows),'cleanpages':len(cleanpages),'coverage':len(coverage)},indent=2))
