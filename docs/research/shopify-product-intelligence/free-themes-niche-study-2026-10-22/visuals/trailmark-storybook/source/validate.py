from pathlib import Path
import json,hashlib,zipfile,struct,re
from PIL import Image
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
R=Path(__file__).resolve().parent.parent
errors=[]
def need(ok,msg):
 if not ok:errors.append(msg)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
S=json.loads((R/'scenes.json').read_text());E=json.loads((R/'exports.json').read_text());A=json.loads((R/'responsive-audit.json').read_text())
D={'desktop':(1440,1000),'tablet':(834,1112),'mobile':(390,844)}
need(len(S)==15,'15 scenes required');need(len(E)==45 and len(A)==45,'45 exports/audits required')
need(len(set((e['scene'],e['device'])for e in E))==45,'duplicate export key')
files=list((R/'images').glob('*.png'));boards=list((R/'boards').glob('*.png'));need(len(files)==45,'45 screen files');need(len(boards)==15,'15 board files')
hashes={}
for p in files+boards:
 raw=p.read_bytes();need(raw[:8]==b'\x89PNG\r\n\x1a\n',f'PNG signature {p.name}')
 with Image.open(p) as im:im.verify()
 if p in files:
  need(sha(p)not in hashes,'duplicate image bytes '+p.name);hashes[sha(p)]=p.name
for e in E:
 w,h=D[e['device']];p=R/e['file'];x,y=struct.unpack('>II',p.read_bytes()[16:24]);need((x,y)==(e['width'],e['height']),e['file']+' export dimensions');need(x==w and y>=h,e['file']+' render dimensions');need(e['viewport']==dict(width=w,height=h,dpr=1),e['file']+' viewport')
for a in A:
 w,h=D[a['device']];need(a['width']==w and a['height']==h and a['dpr']==1,'actual viewport '+a['scene']);need(a['scrollWidth']<=w,'overflow '+a['scene']);need(a['brokenImages']==[],'broken images '+a['scene']);need(not a['outOfBoundsControls'],'control bounds '+a['scene']);need(a['fonts']['inter'] and a['fonts']['status']=='loaded','fonts '+a['scene'])
class Links(HTMLParser):
 def __init__(self):super().__init__();self.targets=[]
 def handle_starttag(self,t,attrs):self.targets.extend(v for k,v in attrs if k in ('href','src') and v)
link_count=0
for p in R.rglob('*.html'):
 l=Links();l.feed(p.read_text())
 for target in l.targets:
  u=urlsplit(target)
  if u.scheme or u.netloc or not u.path:continue
  need((p.parent/unquote(u.path)).exists(),f'local link {p.name}: {u.path}');link_count+=1
for p in R.rglob('*.json'):
 try:json.loads(p.read_text())
 except ValueError:errors.append('JSON '+str(p))
with zipfile.ZipFile(R/'Trailmark-45-mockups.zip')as z:
 need(len(z.namelist())==45,'ZIP count');need(z.testzip()is None,'ZIP CRC')
 for p in files:need(z.read('images/'+p.name)==p.read_bytes(),'ZIP bytes '+p.name)
f=json.loads((R/'source/catalog-fixtures.json').read_text())['cart'];subtotal=sum(x['quantity']*x['unitPriceMinor']for x in f['lines']);need(subtotal==347000==f['subtotalMinor'],'subtotal');need(subtotal+f['shippingMinor']==356000==f['totalMinor'],'total');need(f['lines'][1]['quantity']*3==6,'shuttle contents')
interactions=json.loads((R/'comparisons/interaction-checks.json').read_text());need(all(x['passed']for x in interactions),'presentation interaction checks');
stress=json.loads((R/'comparisons/stress-audit.json').read_text());need(all(not x['outOfBoundsControls']for x in stress),'stress control bounds');stress_over=[dict(scene=x['scene'],kind=x['kind'],width=x['width'],scrollWidth=x['scrollWidth'])for x in stress if x['scrollWidth']>x['width']];need(not stress_over,'stress overflow '+str(stress_over))
# Opaque-pair contrast is a partial palette check, not page conformance.
def lum(h):
 c=[int(h[i:i+2],16)/255 for i in (1,3,5)];v=[x/12.92 if x<=.04045 else((x+.055)/1.055)**2.4 for x in c];return sum(x*y for x,y in zip(v,[.2126,.7152,.0722]))
pairs=[]
for role,fg,bg,minimum in [('text','#222B22','#F5F6F1',4.5),('support','#53604C','#F5F6F1',4.5),('action','#FFFFFF','#314E3B',4.5),('boundary','#708064','#FFFFFF',3),('focus','#005FCC','#FFFFFF',3),('inverse','#FFFFFF','#222B22',4.5),('error','#B42318','#FFF4F2',4.5),('warning','#7A3E00','#FFF4CE',4.5)]:
 x,y=sorted([lum(fg),lum(bg)]);ratio=(y+.05)/(x+.05);pairs.append(dict(role=role,foreground=fg,background=bg,ratio=round(ratio,2),minimum=minimum,pass_=ratio>=minimum));need(ratio>=minimum,'contrast '+role)
result=dict(theme='Trailmark',milestone='1_mockups',date='2026-10-23',passed=not errors,errors=errors,counts=dict(scenes=len(S),images=len(files),boards=len(boards),zipPngs=45,originalBitmapAssets=5),actualViewports=[dict(device=k,width=v[0],height=v[1],dpr=1)for k,v in D.items()],allRequiredExportsNoOverflow=all(a['scrollWidth']<=a['width']for a in A),allFontsLoaded=all(a['fonts']['inter']for a in A),allImagesReady=all(a['brokenImages']==[]for a in A),localHtmlLinks=link_count,pngDecoded=True,uniqueImageBytes=len(hashes)==45,zipMatchesCurrentPngs=True,arithmetic=dict(subtotalMinor=347000,shippingMinor=9000,totalMinor=356000,shuttles=6),stress=dict(records=len(stress),overflow=stress_over),palettePairs=pairs,visualReview='visual-review.json; separate from structural validation',limits=['No production integration or account/payment mutation','No full screen-reader/conformance/performance certification','Current mockups are proposed controls with dependencies in capabilities.json','Shared production build/governance not run per coordinator design-only resource instructions'],sourceHashes={str(p.relative_to(R)):sha(p)for p in sorted((R/'source').glob('*'))if p.is_file()},imageHashes={p.name:sha(p)for p in sorted(files)})
(R/'validation.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items()if k not in ['sourceHashes','imageHashes','palettePairs']},indent=2));raise SystemExit(0 if not errors else 1)
