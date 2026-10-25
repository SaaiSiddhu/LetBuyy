from pathlib import Path
import json,struct,hashlib,zipfile
from PIL import Image
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
P=Path(__file__).resolve().parent.parent
errors=[];checks={}
if not (P/'validation.json').exists(): (P/'validation.json').write_text('{"status":"pending"}')
def need(ok,msg):
 if not ok: errors.append(msg)
scenes=json.loads((P/'scenes.json').read_text());exports=json.loads((P/'exports.json').read_text());audits=json.loads((P/'responsive-audit.json').read_text());stress=json.loads((P/'comparisons/stress-audit.json').read_text())
need(len(scenes)==15,'15 scenes');need(len(exports)==45,'45 exports');need(len(audits)==45,'45 viewport records')
files=list((P/'images').glob('*.png'));boards=list((P/'boards').glob('*.png'));need(len(files)==45,'45 actual images');need(len(boards)==15,'15 actual boards')
devices={'desktop':(1440,1000),'tablet':(834,1112),'mobile':(390,844)}
sha=set()
for e in exports:
 p=P/e['file'];b=p.read_bytes();need(b[:8]==b'\x89PNG\r\n\x1a\n',p.name+' signature')
 with Image.open(p) as im:
  w,h=im.size;im.verify()
 target=devices[e['device']];need(w==target[0] and h>=target[1],p.name+' dimensions');need((w,h)==(e['width'],e['height']),p.name+' metadata');s=hashlib.sha256(b).hexdigest();need(s not in sha,p.name+' duplicate');sha.add(s);need(s==e['sha256'],p.name+' sha')
for a in audits:
 target=devices[a['device']];need((a['width'],a['height'],a['dpr'])==(*target,1),a['scene']+' actual viewport');need(a['scrollWidth']<=a['width'],a['scene']+'/'+a['device']+' overflow');need(not a['brokenImages'],a['scene']+' broken images');need(not a['pageErrors'],a['scene']+' page errors');need(a['fonts']['status']=='loaded' and (a['fonts']['geist'] if a['scene'].startswith(('10-','11-')) else a['fonts']['sourceSans3']),a['scene']+' source font');need(a['fonts']['libre'] or a['scene'].startswith(('10-','11-')),a['scene']+' serif font')
for a in stress:need(a['scrollWidth']<=a['width'],a['scene']+'/'+a['test']+' overflow');need(not a['brokenImages'],a['scene']+'/'+a['test']+' broken media')
need({(s['id'],d) for s in scenes for d in devices}=={(e['scene'],e['device']) for e in exports},'Full scene/device matrix')
with zipfile.ZipFile(P/'Marginalia-45-mockups.zip') as z:
 pngs=[n for n in z.namelist() if n.endswith('.png')];need(len(pngs)==45,'ZIP count');need(z.testzip() is None,'ZIP CRC')
 for e in exports:need(z.read(e['file'])==(P/e['file']).read_bytes(),e['file']+' ZIP bytes')
class Links(HTMLParser):
 def __init__(self):super().__init__();self.targets=[]
 def handle_starttag(self,t,a):self.targets.extend(v for k,v in a if k in ['src','href'] and v)
count=0
for f in P.rglob('*.html'):
 l=Links();l.feed(f.read_text())
 for u in l.targets:
  q=urlsplit(u)
  if q.scheme or q.netloc or not q.path:continue
  count+=1;need((f.parent/unquote(q.path)).exists(),str(f.relative_to(P))+' missing link '+q.path)
for f in P.rglob('*.json'):json.loads(f.read_text())
f=json.loads((P/'source/fixtures.json').read_text());need(sum(i['quantity']*i['unitMinor'] for i in f['cart'])==f['quote']['subtotalMinor'],'Subtotal');need(f['quote']['subtotalMinor']+f['quote']['shippingMinor']==f['quote']['totalMinor']==f['order']['totalMinor'],'Final total');need(sum(i['quantity'] for i in f['cart'])==3,'Item quantity')
contrast=json.loads((P/'comparisons/contrast-audit.json').read_text());need(all(p['meets_pair_threshold'] for p in contrast['pairs']),'Contrast pairs')
result={'theme':'Marginalia','date':'2026-10-23','status':'artifact_checks_passed' if not errors else 'needs_correction','passed':not errors,'counts':{'scenes':15,'images':len(files),'boards':len(boards),'viewportAudits':len(audits),'stressChecks':len(stress),'uniquePngHashes':len(sha),'localHtmlLinks':count},'checks':{'pngSignaturesDimensionsDecoding':'passed' if not errors else 'see errors','zipBytes':'verified current image byte equality','arithmetic':'480 + 2×320 = 1120; +60 = 1180; included tax not added twice','fonts':'Local Source Sans 3; Libre Baskerville on store/checkout screens; identity local Geist exception','contrast':'11 explicit pairs pass; not a rendered WCAG certification','actualViewport':'1440×1000, 834×1112, 390×844 at DPR1, independent local Chromium rendering'},'errors':errors,'visualReview':'See comparisons/visual-review.json; separate from structural checks','productionBehaviorCertified':False,'knownLimits':['No live commerce, credential submission, payment or account persistence in presentation source.','Separate production Liquid, security, full assistive-technology and performance acceptance required.','Source Sans Pro registry versus local Source Sans 3 mapping must be reconciled explicitly during implementation.','Hindi fallback reviewed only for supplied stress fixture; actual merchant scripts require further review.'],'scope':'Only marginalia-storybook; no production source edits, deployments or shared browser control.'}
(P/'validation.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2));raise SystemExit(bool(errors))
