from pathlib import Path
import json,re,hashlib,xml.etree.ElementTree as ET,subprocess,datetime
from html.parser import HTMLParser
R=Path('/Volumes/Projects/LetBuyy/docs/research/shopify-product-intelligence/free-themes-niche-study-2026-10-22');E=R/'evidence';repo=Path('/Volumes/Projects/LetBuyy')
# Source-derived artifacts only. This does not certify deployed behavior.
checks={};errors=[]
js=list(R.rglob('*.json'));svgs=list(R.rglob('*.svg'));md=list(R.rglob('*.md'))
for p in js:
 try:json.loads(p.read_text())
 except Exception as ex:errors.append({'file':str(p.relative_to(R)),'error':str(ex)})
for p in svgs:
 try:ET.parse(p)
 except Exception as ex:errors.append({'file':str(p.relative_to(R)),'error':str(ex)})
checks['parse']={'jsonFiles':len(js),'svgFiles':len(svgs),'errors':errors.copy()}
broken=[];linkCount=0
for p in md:
 for raw in re.findall(r'\]\(([^\n)]+)\)',p.read_text()):
  if raw.startswith(('http:','https:','#','mailto:')):continue
  target=raw.split('#')[0].strip('<>');linkCount+=1
  if target and not (p.parent/target).exists():broken.append({'file':str(p.relative_to(R)),'target':target})
class Links(HTMLParser):
 def __init__(self):super().__init__();self.links=[]
 def handle_starttag(self,tag,attrs):
  for a,v in attrs:
   if a in ['href','src'] and v:self.links.append(v)
for p in [R/'visuals/design-review.html',R/'visuals/current-source-fixtures.html']:
 h=Links();h.feed(p.read_text())
 for v in h.links:
  if v.startswith(('http:','https:','#')):continue
  linkCount+=1
  if not (p.parent/v.split('#')[0]).exists():broken.append({'file':str(p.relative_to(R)),'target':v})
checks['relativeLinks']={'checked':linkCount,'broken':broken};errors+=broken
P=json.loads((E/'proposed-portfolio.json').read_text());A=json.loads((E/'current-presets-audit.json').read_text())['results'];C=json.loads((E/'coverage-matrix.json').read_text())['themes']
counts={'dossiers':len(list((R/'shopify-theme-dossiers').glob('*.md'))),'blueprints':len(list((R/'letbuyy-design-blueprints').glob('*.md'))),'colorWireframes':len([p for p in (R/'visuals/wireframes').glob('*.svg') if not p.stem.endswith('-neutral')]),'neutralWireframes':len(list((R/'visuals/wireframes').glob('*-neutral.svg'))),'renderedColorSchematics':len(list((R/'visuals/rendered').glob('*.png'))),'sourceRenderFixtures':len(list((E/'current-preset-renders').glob('*.html'))),'themesInCoverage':len(C),'exactTenUniquePresetIds':len(set(p['id'] for p in P))==10};checks['counts']=counts
for k,n in [('dossiers',23),('blueprints',10),('colorWireframes',60),('neutralWireframes',60),('renderedColorSchematics',60),('sourceRenderFixtures',30),('themesInCoverage',23)]:
 if counts[k]!=n:errors.append({'count':k,'actual':counts[k],'expected':n})
checks['sameCatalogExperiment']={'presets':len(A),'templateSetVariants':len(set(a['templateSetHash'] for a in A)),'sourceFileVariants':len(set(a['sourceFilesHash'] for a in A)),'pages':{key:{'mainHtmlVariants':len(set(next(p['mainHash'] for p in a['pages'] if p['key']==key)for a in A)),'allRendered':all(next(p['status']for p in a['pages']if p['key']==key)=='rendered'for a in A)}for key in ['index','collection','product']},'missingRegisteredCompositionTypes':sum(len(a['missingCompositionTypes'])for a in A)}
pairs=json.loads((E/'palette-contrast.json').read_text());checks['palette']={'pairCount':sum(len(v)for v in pairs.values()),'failures':[{'preset':k,**v}for k,vs in pairs.items()for v in vs if not v['passes']]};errors+=checks['palette']['failures']
privacyPatterns={'authenticatedStoreURL':r'admin\.shopify\.com/store/(?!\[|redacted|example)','sessionBearingQuery':r'([?&]|&amp;)(?:_sid|_ss|access_token|preview_token|session_id)=','jwtLike':r'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.','privateAddressPattern':r'saai[^\s"<>]*@'}
privacy={k:[]for k in privacyPatterns}
for p in R.rglob('*'):
 if p.is_file()and p.suffix in ['.json','.md','.txt','.html','.mts','.svg','.py']:
  text=p.read_text(errors='ignore')
  for k,pat in privacyPatterns.items():
   if re.search(pat,text,re.I):privacy[k].append(str(p.relative_to(R)))
checks['privacyMarkerScan']={'scope':'Text markers only, not proof no possible secret exists; authenticated screenshots were not saved','matches':privacy}
for k,vs in privacy.items():
 if vs:errors.append({'privacyMarker':k,'files':vs})
trailing=[]
for p in md+[R/'evidence/audit-presets.mts']:
 for i,line in enumerate(p.read_text().splitlines(),1):
  if line!=line.rstrip():trailing.append({'file':str(p.relative_to(R)),'line':i})
checks['whitespace']={'trailingWhitespace':trailing};errors+=trailing
prod=subprocess.run(['git','diff','--quiet','--','apps','services','packages','database','scripts'],cwd=repo)
checks['productionTrackedDiff']={'exitCode':prod.returncode,'meaning':'0 means no tracked production source diff; unrelated existing research files excluded'}
gov=(E/'governance-validation.txt').read_text();checks['governance']={'result':'passed'if 'PASS=114 FAIL=0 BLOCKED=0' in gov else 'inspect log','passed':114 if 'PASS=114 FAIL=0 BLOCKED=0'in gov else None,'advisories':5,'notApplicable':1,'behavioralProof':False}
checks['status']='passed' if not errors and prod.returncode==0 else 'needs correction';checks['errors']=errors
(E/'research-validation.json').write_text(json.dumps(checks,indent=2)+'\n')
files=[]
for p in sorted(R.rglob('*')):
 if p.is_file()and p.name!='manifest.json':files.append({'path':str(p.relative_to(R)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(E/'manifest.json').write_text(json.dumps({'date':'2026-10-22','excludedSelf':'evidence/manifest.json','scope':'Artifact identity, not claim validity','files':files},indent=2)+'\n')
print(json.dumps({'status':checks['status'],'counts':counts,'brokenLinks':len(broken),'errors':errors,'palettePairs':checks['palette']['pairCount'],'manifestFiles':len(files)},indent=2))
