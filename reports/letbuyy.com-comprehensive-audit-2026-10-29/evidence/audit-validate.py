from pathlib import Path
import json,csv,re,collections,xml.etree.ElementTree as ET
R=Path('/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy.com-comprehensive-audit-2026-10-29');errors=[];warnings=[];checks=[]
for p in R.rglob('*.json'):
 try:json.loads(p.read_text())
 except Exception as e:errors.append('JSON parse: '+str(p.relative_to(R))+': '+str(e))
checks.append('All saved JSON parses')
issues=json.loads((R/'issue-register.json').read_text());fields=['issue_id','category','title','severity','confidence','finding_state','affected_url_count','representative_urls','template_or_page','evidence','business_impact','recommended_fix','owner_role','effort','dependencies','validation_steps','success_indicator']
assert len(issues)==len({i['issue_id'] for i in issues})==23
for i in issues:
 for k in fields:
  if k not in i or i[k] in ['',None,[]]: errors.append('Missing issue field '+i['issue_id']+' '+k)
 if len(set(i['affected_urls']))!=i['affected_url_count']:errors.append('Issue count mismatch '+i['issue_id'])
 for p in i['evidence_files']:
  if not (R/p).exists():errors.append('Issue evidence missing '+i['issue_id']+' '+p)
checks.append('23 unique full-field issue records and affected counts/evidence')
c=json.loads((R/'evidence/crawl.json').read_text());a=json.loads((R/'evidence/technical-analysis.json').read_text());d=json.loads((R/'audit-data.json').read_text());assert len(c['pages'])==499 and c['complete'] and c['queued_remaining']==0
assert c['initial_attempt_count']+c['supplementary_attempt_count']==500
assert a['page_count']==489 and a['locales']=={'in':163,'in-ta':163,'in-hi':163}
assert len(a['articles'])==len(a['articles_missing_sitemap'])==105
assert len(a['issues']['locale_stripped_canonical'])==303
assert len(a['issues']['canonical_mismatch'])==309
assert not a['schema_errors']
assert d['summary']['health_score'] is None and all(x['score'] is None for x in d['categories'])
assert len(list(csv.DictReader((R/'URL-INVENTORY.csv').open())))==499
assert len(list(csv.DictReader((R/'ISSUE-REGISTER.csv').open())))==23
assert len(json.loads((R/'toolkit-coverage.json').read_text()))==35
checks.append('Crawl/locale/canonical/article/CSV/coverage counts agree; unavailable scores remain null')
for p in c['pages']:
 for f in ['evidence_html','evidence_headers']:
  if p.get(f) and not (R/p[f]).exists():errors.append('Missing captured evidence '+p[f])
for p in R.rglob('*.md'):
 for target in re.findall(r'\]\(([^)]+)\)',p.read_text()):
  target=target.split('#')[0]
  if not target or re.match(r'^[a-zA-Z][a-zA-Z0-9+.-]*:',target):continue
  target=target.strip('<>')
  if not (p.parent/target).exists():errors.append('Broken local link '+str(p.relative_to(R))+' -> '+target)
checks.append('Crawl evidence paths and Markdown links checked')
# Headers must not retain cookies or authorization tokens. Do not print values.
for p in R.rglob('*.headers'):
 if re.search(r'(?im)^(set-cookie|authorization|proxy-authorization):',p.read_text()):errors.append('Sensitive header class '+str(p.relative_to(R)))
for name in ['home-mobile-menu.png','contact-mobile-controls.png','pricing-mobile.png','article-mobile.png']:
 if not (R/'screenshots'/name).exists():errors.append('Missing screenshot '+name)
checks.append('Representative screenshots exist; custom response header evidence omits credential/cookie header classes')
result={'status':'failed' if errors else 'passed','checked_at':'2026-10-29','checks':checks,'errors':errors,'warnings':warnings,'scope':'artifact integrity and independent count checks; not site or production certification','source_modified_by_this_audit':False}
(R/'evidence/deliverable-validation.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
if errors:raise SystemExit(1)
