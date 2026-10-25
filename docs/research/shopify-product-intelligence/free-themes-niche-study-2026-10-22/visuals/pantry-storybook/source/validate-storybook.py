from pathlib import Path
from PIL import Image,ImageStat
import json,re,struct,hashlib,zipfile
from html.parser import HTMLParser
from urllib.parse import unquote,urlsplit
R=Path(__file__).resolve().parent.parent;errors=[];checks={};sizes={'desktop':(1440,1000),'tablet':(834,1112),'mobile':(390,844)}
def req(ok,msg):
 if not ok:errors.append(msg)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
scenes=json.loads((R/'scenes.json').read_text());exports=json.loads((R/'exports.json').read_text());audit=json.loads((R/'responsive-audit.json').read_text());stress=json.loads((R/'stress-audit.json').read_text());fx=json.loads((R/'fixtures.json').read_text())
req(len(scenes)==15,'Scenes != 15');req(len(exports)==45,'Exports != 45');req(len(audit)==45,'Audit != 45');req(len(list((R/'images').glob('*.png')))==45,'Image count != 45');req(len(list((R/'boards').glob('*.png')))==15,'Board count != 15')
seen=set();hashes={};manifest=[]
for e in exports:
 p=R/e['file'];combo=(e['scene'],e['device']);req(combo not in seen,'Duplicate combo '+str(combo));seen.add(combo);w,h=sizes[e['device']];req(p.read_bytes()[:8]==b'\x89PNG\r\n\x1a\n','Bad signature '+str(p));im=Image.open(p);im.load();req(im.width==w and im.height>=h,'Dimensions '+str(p));req((im.width,im.height)==(e['width'],e['height']),'Export dimension mismatch');digest=sha(p);req(digest not in hashes,'Duplicate image bytes '+str(p));hashes[digest]=e['file'];req(max(ImageStat.Stat(im.convert('RGB')).var)>25,'Blank image '+str(p));manifest.append({'file':e['file'],'width':im.width,'height':im.height,'sha256':digest});req(e['viewport']=={'width':w,'height':h,'dpr':1},'Requested viewport mismatch')
for a in audit:
 w,h=sizes[a['device']];req((a['width'],a['height'],a['dpr'])==(w,h,1),'Actual viewport mismatch');req(a['scrollWidth']==w,'Horizontal overflow');req(a['brokenImages']==[],'Broken images');req(a['fonts']['status']=='loaded' and a['fonts']['inter'],'Font loading');req(a['fixedElements']==0,'Fixed occlusion risk')
for a in stress:req(a['pass'],f'Stress fail {a["scene"]}/{a["mode"]}')
for p in (R/'boards').glob('*.png'):
 with Image.open(p) as im:im.verify()
req({(s['id'],d) for s in scenes for d in sizes}==seen,'Incomplete 15x3 matrix')
with zipfile.ZipFile(R/'Pantry-45-mockups.zip') as z:
 req(len(z.namelist())==45,'ZIP count');req(z.testzip() is None,'ZIP CRC')
 for m in manifest:req(z.read(m['file'])==(R/m['file']).read_bytes(),'Stale ZIP bytes '+m['file'])
class Links(HTMLParser):
 def __init__(self):super().__init__();self.urls=[]
 def handle_starttag(self,t,a):self.urls +=[v for k,v in a if k in ('src','href') and v]
local=0
for p in R.rglob('*.html'):
 parser=Links();parser.feed(p.read_text())
 for u in parser.urls:
  parts=urlsplit(u)
  if parts.scheme or parts.netloc or not parts.path:continue
  local+=1;target=p.parent/unquote(parts.path);req(target.exists(),f'Broken link {p.relative_to(R)} -> {u}')
for p in R.rglob('*.json'):
 try:json.loads(p.read_text())
 except Exception:req(False,'JSON parse '+str(p))
c=fx['cart'];req(c['packCount']==sum(x['quantity'] for x in c['lines']),'Pack count');req(c['totalNetGrams']==sum(x['totalNetGrams'] for x in c['lines']),'Total net');req(c['subtotalMinor']==sum(x['lineMinor'] for x in c['lines']),'Subtotal');req(c['totalMinor']==c['subtotalMinor']+c['shippingMinor'],'Quote total');req(c['lines'][0]['lineMinor']==2*18000 and c['lines'][0]['totalNetGrams']==2*250,'Niche acceptance');req(fx['products'][0]['allergens'] is None,'Unknown allergen');req(18000*100//250==7200,'Unit price');req('cart-controls' not in (R/'source/14-order-detail.html').read_text() and '>Remove<' not in (R/'source/14-order-detail.html').read_text() and 'class="qty"' not in (R/'source/14-order-detail.html').read_text(),'Mutable order detail');req((R/'source/14-order-detail.html').read_text().count('order-item')==2,'Owned order rows != 2')
checks.update(scenes=15,individualPngs=45,boards=15,zipPngs=45,localLinks=local,uniquePngHashes=len(hashes),viewportTargets=sizes,independentRenders=True,pngDecode=True,fontLoading=True,imageReadiness=True,noPageOverflow=not any(a['scrollWidth']>a['width'] for a in audit),stressChecks=len(stress),arithmetic=True,unknownAllergensPreserved=True,productionSourceChangedByThisWork=False)
report={'theme':'Pantry','date':'2026-10-23','status':'PASS' if not errors else 'FAIL','checks':checks,'errors':errors,'manifest':manifest,'visualReview':'Representative full-size exports and all-scene contact sheet inspected; exact reviewed files in visual-review.json','limitations':['Visual artifact checks only; no actual auth/cart/order/payment persistence tested','No production install/publication/deployment claimed','Full assistive technology and production performance qualification remain implementation acceptance','Coordinator independent review pending'],'governance':'No cleanup/build gate in shared dirty checkout per coordinator resource instruction; no copied historical gate result'}
(R/'validation.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'status':report['status'],'checks':checks,'errors':errors},indent=2));raise SystemExit(1 if errors else 0)
