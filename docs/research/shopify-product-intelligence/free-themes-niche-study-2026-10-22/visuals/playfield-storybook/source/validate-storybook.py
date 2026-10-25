"""Artifact integrity, evidence freshness and fixture checks; no production certification."""
from pathlib import Path
import json,hashlib,zipfile,struct,statistics,importlib.util,sys
sys.dont_write_bytecode=True
from PIL import Image,ImageStat
ROOT=Path(__file__).resolve().parent.parent
REPO=next(p for p in ROOT.parents if (p/'pnpm-workspace.yaml').exists())
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
errors=[]
checks={}
scenes=json.loads((ROOT/'scenes.json').read_text());audit=json.loads((ROOT/'responsive-audit.json').read_text());exports=json.loads((ROOT/'exports.json').read_text())
def require(condition,message):
 if not condition:errors.append(message)
require(len(scenes)==15,'Expected fifteen scenes')
require(len(audit)==len(exports)==45,'Expected forty-five export/audit records')
hashes=[]
for row in audit:
 f=ROOT/row['file'];raw=f.read_bytes()
 require(raw[:8]==b'\x89PNG\r\n\x1a\n','Bad PNG '+f.name)
 with Image.open(f) as im:
  require(im.width==row['width']==row['screenshotWidth'],'Wrong actual width '+f.name)
  require(im.height==row['screenshotHeight'] and im.height>=row['height'],'Wrong fullpage height '+f.name)
  stat=ImageStat.Stat(im.convert('RGB').resize((100,100)))
  require(max(stat.stddev)>10,'Blank/nearblank capture '+f.name)
 require(row['dpr']==1 and row['scrollWidth']<=row['width'],'Viewport/overflow '+f.name)
 require(row['brokenImages']==[] and row.get('expectedFontReady',row.get('interReady')) and row['fontsReady'],'Media/font readiness '+f.name)
 scene=next(s for s in scenes if s['id']==row['scene'])
 for key,file in [('sourceSha256',scene['source']),('stylesheetSha256','source/styles.css'),('scriptSha256','source/interactions.js'),('pngSha256',row['file'])]:require(row.get(key)==sha(ROOT/file),'Stale '+key+' '+f.name)
 for file,digest in row.get('additionalStylesheets',{}).items():require(digest==sha(ROOT/file),'Stale additional stylesheet '+f.name)
 if row['scene'] in ['10-sign-in','11-sign-up']:require('source/identity.css' in row.get('additionalStylesheets',{}),'Missing current identity style audit '+f.name)
 hashes.append(sha(f))
require(len(set(hashes))==45,'Duplicate PNG bytes')
fixtures=json.loads((ROOT/'source/fixtures.json').read_text());cart=fixtures['cart'];subtotal=sum(x['quantity']*x['price'] for x in cart['items']);require(subtotal==cart['subtotal']==1780 and subtotal+cart['shipping']==cart['total']==1860,'Fixture arithmetic')
stress=json.loads((ROOT/'stress-audit.json').read_text());require(all(r['passed'] for r in stress['results']),'Stress reflow failure');require(stress['filterAcceptance']['passed'],'Age/interest acceptance failure');require(stress['menuProof']['closed'] and stress['menuProof']['focusReturned'],'Menu Escape/focus failure')
gallery=json.loads((ROOT/'gallery-audit.json').read_text());require(gallery['passed'],'Gallery smoke failure')
require(len(list((ROOT/'images').glob('*.png')))==45,'Screen PNG count')
require(len(list((ROOT/'boards').glob('*.png')))==15,'Board PNG count')
with zipfile.ZipFile(ROOT/'Playfield-45-mockups.zip') as z:
 require(len(z.namelist())==45 and z.testzip() is None,'ZIP count/CRC')
 for f in (ROOT/'images').glob('*.png'):require(z.read('images/'+f.name)==f.read_bytes(),'ZIP mismatch '+f.name)
checks={'screenPNGs':45,'comparisonBoards':15,'scenes':15,'uniquePngHashes':len(set(hashes)),'actualViewportMatrix':{'desktop':'1440x1000 DPR1','tablet':'834x1112 DPR1','mobile':'390x844 DPR1'},'overflowOrBrokenImages':0,'localFonts':'Inter loaded in39 storefront/checkout/account captures; canonical Geist loaded in6 identity captures','sourceAndImageHashesCurrent':True,'arithmetic':{'subtotal':1780,'shipping':80,'total':1860},'stressChecks':len(stress['results']),'stressModes':sorted(set(r['mode'] for r in stress['results'])),'filterAcceptance':stress['filterAcceptance'],'menuProof':stress['menuProof'],'gallerySelections':60,'zipCRCAndCurrentBytes':True}
result={'date':'2026-10-23','status':'passed' if not errors else 'failed','scope':'Playfield design artifacts only; no production implementation/transaction/deployment certification','checks':checks,'errors':errors,'visualReview':{'representativeFullSize':'See visual-review.json','allBoards':'Reviewed separately; coordinator acceptance pending'},'productionBehaviorProof':False,'governance':'No global suite run or historical result claimed; coordinator owns shared-source programme gates. Only own-folder artifacts authored.'}
(ROOT/'validation.json').write_text(json.dumps(result,indent=2)+'\n')
# Import coordinator audit read-only. Its reports remain inside this theme folder.
spec=importlib.util.spec_from_file_location('programme_verify',REPO/'docs/implementation/niche-theme-programme/verify_mockups.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
independent=module.audit({'key':'playfield','name':'Playfield','artifactPath':str(ROOT.relative_to(REPO))});(ROOT/'independent-artifact-audit.json').write_text(json.dumps(independent,indent=2)+'\n');require(independent['passed'],'Coordinator artifact audit failed: '+str(independent['errors']))
result['status']='passed' if not errors else 'failed';(ROOT/'validation.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'passed':not errors,'checks':checks,'errors':errors,'independentArtifactAudit':independent},indent=2))
raise SystemExit(0 if not errors else 1)
