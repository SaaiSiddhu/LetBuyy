from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
import struct,zlib,json,hashlib,zipfile,datetime
R=Path(__file__).resolve().parent.parent
class Links(HTMLParser):
 def __init__(self):super().__init__();self.links=[]
 def handle_starttag(self,t,attrs):self.links += [v for k,v in attrs if k in ('src','href') and v]
def png(p):
 b=p.read_bytes();assert b[:8]==b'\x89PNG\r\n\x1a\n',p.name
 pos=8;ids=[];dims=None;chunks=[]
 while pos<len(b):
  n=struct.unpack('>I',b[pos:pos+4])[0];typ=b[pos+4:pos+8];data=b[pos+8:pos+8+n];crc=struct.unpack('>I',b[pos+8+n:pos+12+n])[0]
  assert zlib.crc32(typ+data)&0xffffffff==crc,p.name+' CRC';chunks.append(typ)
  if typ==b'IHDR':dims=struct.unpack('>II',data[:8])
  if typ==b'IDAT':ids.append(data)
  pos+=12+n
 assert b'IEND' in chunks and len(zlib.decompress(b''.join(ids)))>0,p.name+' decode'
 return dims
errors=[];checks={}
(R/'validation.json').write_text('{"passed":false,"status":"validation_running"}\n')
try:
 scenes=json.loads((R/'scenes.json').read_text());ex=json.loads((R/'exports.json').read_text());au=json.loads((R/'responsive-audit.json').read_text());stress=json.loads((R/'stress-audit.json').read_text())
 assert len(scenes)==15 and len(ex)==45 and len(au)==45
 files=list((R/'images').glob('*.png'));boards=list((R/'boards').glob('*.png'));assert len(files)==45 and len(boards)==15
 hashes=set()
 for e in ex:
  p=R/e['file'];w,h=png(p);assert w==e['viewport']['width'] and h>=e['viewport']['height'];assert w==e['width'] and h==e['height'];d=hashlib.sha256(p.read_bytes()).hexdigest();assert d==e['sha256'];assert d not in hashes;hashes.add(d)
 for p in boards:png(p)
 for a in au:assert a['width']==a['requested']['width'] and a['height']==a['requested']['height'] and a['dpr']==1 and a['scrollWidth']<=a['width'] and a['brokenImages']==[] and a['fonts']['status']=='loaded' and (a['fonts'].get('geist') if a['scene'] in ['10-sign-in','11-create-account'] else a['fonts']['lato']) and a['fonts']['cormorant']
 checks['exports']={'screens':45,'boards':15,'uniqueHashes':len(hashes),'PNG':'signatures, CRCs, IDAT decompression and dimensions verified','viewports':'actual1440x1000/834x1112/390x844 DPR1','fonts':'local Lato/Cormorant; canonical identity Geist exception loaded','horizontalOverflow':0,'brokenImages':0}
 assert stress['keyboardShade']['selected']=='tint-pink-clay' and stress['keyboardShade']['name']=='Pink Clay' and len(set(stress['keyboardShade']['colors']))==1
 assert stress['unavailableShadeDisabled'] and stress['menuEscape']['hidden'] and stress['menuEscape']['focusReturned']
 overflow=[{'scene':x['scene'],'condition':x['condition'],'width':x['width'],'scrollWidth':x['scrollWidth']} for x in stress['checks'] if x.get('scrollWidth',0)>x.get('width',0)]
 checks['extended']={'narrow320':len([x for x in stress['checks'] if x['condition']=='320px reflow']),'sameColourDistinctKeyboardVariant':True,'unavailableShadeDisabled':True,'menuEscapeFocusReturn':True,'overflowCases':overflow,'limits':stress['limitations']}
 assert not overflow,'Extended stress has horizontal overflow: '+str(overflow)
 fixture=json.loads((R/'fixtures.json').read_text());c=fixture['cart'];assert sum(x['unitMinor']*x['quantity'] for x in c['lines'])==c['subtotalMinor'];assert c['subtotalMinor']+c['shippingMinor']==c['totalMinor']==fixture['order']['totalMinor']
 checks['arithmetic']={'subtotalMinor':116000,'shippingMinor':6000,'totalMinor':122000,'tax':'included'}
 semantic=json.loads((R/'final-semantic-checks.json').read_text());assert semantic['passed'];checks['semantic']=semantic
 for x in stress['checks']:
  for action in x.get('primary',[]):assert action['color']=='rgb(255, 255, 255)' and action['background']=='rgb(44, 38, 66)'
 checks['identityPalette']='Current admin/light brand ink with white primary labels'
 with zipfile.ZipFile(R/'Dewdrop-45-mockups.zip','w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
  for p in sorted(files):z.write(p,'images/'+p.name)
 links=0
 for p in R.rglob('*.html'):
  h=Links();h.feed(p.read_text())
  for raw in h.links:
   u=urlsplit(raw)
   if u.scheme or u.netloc or not u.path:continue
   links+=1;assert (p.parent/unquote(u.path)).exists(),f'Broken local link: {p.relative_to(R)} {u.path}'
 checks['localLinks']=links
 for p in R.rglob('*.json'):json.loads(p.read_text())
 with zipfile.ZipFile(R/'Dewdrop-45-mockups.zip') as z:
  assert len(z.namelist())==45 and z.testzip() is None
  for p in files:assert z.read('images/'+p.name)==p.read_bytes()
 checks['archive']={'pngCount':45,'CRC':'pass','currentBytesMatch':True}
except Exception as e:errors.append(str(e))
report={'passed':not errors,'theme':'Dewdrop','phase':'mockups','validatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'checks':checks,'errors':errors,'visualReview':'Representative full-size screens inspected separately; coordinator portfolio review pending','productionBehaviorCertified':False,'governanceOrBuildClaim':False,'changedScope':'Dewdrop artifact subtree only'}
(R/'validation.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2));raise SystemExit(1 if errors else 0)
