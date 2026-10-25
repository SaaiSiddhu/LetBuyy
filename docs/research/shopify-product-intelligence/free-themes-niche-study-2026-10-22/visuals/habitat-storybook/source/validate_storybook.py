"""Validate current design artifacts without relying on unrelated shared Git state."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
import json,zipfile,hashlib,struct
from PIL import Image
P=Path(__file__).resolve().parent.parent
errors=[];checks={}
def check(name,result,detail=None):
    checks[name]={'passed':bool(result),'detail':detail}
    if not result:errors.append(name)
scenes=json.loads((P/'scenes.json').read_text());exports=json.loads((P/'exports.json').read_text());audit=json.loads((P/'responsive-audit.json').read_text());stress=json.loads((P/'stress-audit.json').read_text())
check('15 distinct scenes',len(scenes)==15 and len({s['id'] for s in scenes})==15)
pngs=list((P/'images').glob('*.png'));boards=list((P/'boards').glob('*.png'))
check('45 individual PNGs',len(pngs)==45,len(pngs));check('15 additional boards',len(boards)==15,len(boards))
check('45 export and audit records',len(exports)==len(audit)==45)
expected={(s['id'],d) for s in scenes for d in ['desktop','tablet','mobile']}
check('unique scene-device exports',{(e['scene'],e['device']) for e in exports}==expected and len(exports)==len(expected))
check('unique scene-device audits',{(e['scene'],e['device']) for e in audit}==expected and len(audit)==len(expected))
dimensions=[];hashes=[];decoded_hashes=[]
for e in exports:
    p=P/e['file'];b=p.read_bytes();im=Image.open(p);im.load();v=e['viewport'];size=im.size
    check('PNG '+p.name,b[:8]==b'\x89PNG\r\n\x1a\n' and im.format=='PNG' and size==(e['width'],e['height']) and size[0]==v['width'] and size[1]>=v['height'] and v['dpr']==1)
    check('SHA '+p.name,hashlib.sha256(b).hexdigest()==e['sha256'])
    dimensions.append({'file':e['file'],'width':size[0],'height':size[1]});hashes.append(hashlib.sha256(b).hexdigest());decoded_hashes.append(hashlib.sha256(str(size).encode()+im.convert('RGB').tobytes()).hexdigest())
check('all 45 distinct decoded exports',len(set(decoded_hashes))==45)
for p in boards:
    b=p.read_bytes();im=Image.open(p);im.load();check('board PNG '+p.name,b[:8]==b'\x89PNG\r\n\x1a\n' and im.format=='PNG' and im.width==1541 and im.height>=700)
check('actual viewport / no overflow / images ready',all(a['width']==a['requestedViewport']['width'] and a['height']==a['requestedViewport']['height'] and a['dpr']==1 and a['scrollWidth']<=a['width'] and not a['brokenImages'] for a in audit))
check('font readiness',all(a['fontsReady'] and (any('Geist' in f['family'] and f['status']=='loaded' for f in a['fonts']) if a['scene'] in ['10-sign-in','11-sign-up'] else any('Source Sans Pro' in f['family'] and f['status']=='loaded' for f in a['fonts']) and any('Libre Baskerville' in f['family'] and f['status']=='loaded' for f in a['fonts'])) for a in audit))
with zipfile.ZipFile(P/'Habitat-45-mockups.zip') as z:
    check('ZIP exact count',len(z.namelist())==45 and len(set(z.namelist()))==45)
    check('ZIP exact current PNG bytes',all(z.read(Path(e['file']).name)==(P/e['file']).read_bytes() for e in exports))
    check('ZIP integrity',z.testzip() is None)
class Links(HTMLParser):
    def __init__(self):super().__init__();self.links=[]
    def handle_starttag(self,t,attrs):
      for k,v in attrs:
       if k in ['src','href'] and v:self.links.append(v)
missing=[]
for p in P.rglob('*.html'):
    parser=Links();parser.feed(p.read_text())
    for link in parser.links:
      x=urlsplit(link)
      if x.scheme or link.startswith('#') or not x.path:continue
      if not (p.parent/unquote(x.path)).exists():missing.append({'html':str(p.relative_to(P)),'target':link})
check('local HTML links',not missing,missing)
for p in P.rglob('*.json'):
    try:json.loads(p.read_text())
    except Exception:errors.append('Invalid JSON '+str(p))
f=json.loads((P/'fixtures.json').read_text());cart=f['cart'];subtotal=sum(l['unitMinor']*l['quantity'] for l in cart['lines'])
check('cart / order arithmetic',subtotal==cart['subtotalMinor'] and subtotal+cart['shippingMinor']-cart['discountMinor']==cart['totalMinor']==2580000)
check('no invented delivery date',f['deliveryDate'] is None and f['order']['deliveryDate'] is None)
check('all four generated assets and prompts',len(json.loads((P/'generation-prompts.json').read_text())['assets'])==4 and all((P/a['file']).exists() and a.get('prompt') for a in json.loads((P/'generation-prompts.json').read_text())['assets']))
stress_overflow=[{'scene':s.get('scene'),'test':s['test'],'width':s.get('width'),'scrollWidth':s.get('scrollWidth')} for s in stress if s.get('scrollWidth',0)>s.get('width',0)]
check('stress reflow / language / text enlargement',not stress_overflow,stress_overflow)
check('menu keyboard Escape and focus return',any(s['test']=='mobile menu Escape/focus return' and s['closed'] and s['focusReturned'] for s in stress))
check('reduced motion observed',any(s['test']=='reduced motion' and s['matches'] and s['scrollBehavior']=='auto' for s in stress))
report={'schemaVersion':1,'theme':'Habitat','designVersion':'1.0','milestone':'Mockup artifacts only','passed':not errors,'imageCount':len(pngs),'boardCount':len(boards),'checks':checks,'errors':errors,'dimensions':dimensions,'visualReview':'See visual-review.json; file counts alone are insufficient','sourceBoundary':'Only visuals/habitat-storybook authored. Existing dirty apps/services/packages/database preserved; no clean-worktree claim.','governance':'No historical gate totals reused; programme-wide governance is coordinator-owned. This validator checks artifacts, not production architecture.','limits':['Mockup source is not working commerce, identity, payment or order delivery.','Assistive technology, real merchant languages, actual device performance and production security remain implementation acceptance.','Coordinator portfolio review and Milestone 1 programme exit remain separate.']}
(P/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'passed':report['passed'],'images':len(pngs),'boards':len(boards),'errors':errors,'missingLinks':missing,'stressOverflow':stress_overflow},ensure_ascii=False))
raise SystemExit(0 if report['passed'] else 1)
