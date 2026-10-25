from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
from PIL import Image
import json,hashlib,zipfile,struct
R=Path(__file__).resolve().parent.parent
errors=[]
def check(ok,msg):
 if not ok:errors.append(msg)
def load(name):return json.loads((R/name).read_text())
S=load('scenes.json');E=load('exports.json');A=load('responsive-audit.json');F=load('source/fixtures.json');P=load('generation-prompts.json');T=load('comparisons/stress-audit.json')
D={'desktop':(1440,1000),'tablet':(834,1112),'mobile':(390,844)}
screens=sorted((R/'images').glob('*.png'));boards=sorted((R/'boards').glob('*.png'))
check(len(S)==15,'15 scenes required');check(len(screens)==45,'45 required PNGs');check(len(boards)==15,'15 boards required');check(len(E)==45 and len(A)==45,'45 export and audit entries')
expected={(s['id'],d)for s in S for d in D}
check({(e['scene'],e['device'])for e in E}==expected,'Export coverage');check({(e['scene'],e['device'])for e in A}==expected,'Audit coverage')
hashes=set()
for e in E:
 p=R/e['file'];b=p.read_bytes();check(b[:8]==b'\x89PNG\r\n\x1a\n',f'PNG signature {p.name}');w,h=struct.unpack('>II',b[16:24]);vw,vh=D[e['device']]
 check(w==vw and h>=vh,f'Dimensions {p.name}');check((w,h)==(e['width'],e['height']),f'Manifest dimensions {p.name}');digest=hashlib.sha256(b).hexdigest();check(digest==e['sha256'],f'Hash {p.name}');check(digest not in hashes,f'Duplicate PNG {p.name}');hashes.add(digest)
 with Image.open(p)as im:im.verify()
for p in boards:
 with Image.open(p)as im:im.verify();check(im.width==1800,f'Board width {p.name}')
for a in A:
 check(a['width']==D[a['device']][0] and a['height']==D[a['device']][1] and a['dpr']==1,f'Actual viewport {a["scene"]}/{a["device"]}')
 check(a['scrollWidth']<=a['width'] and not a['brokenImages'] and not a['clippedText'],f'Overflow/image/clipped text {a["scene"]}/{a["device"]}')
 check(a['fonts'].get('expectedLoaded',a['fonts'].get('inter')) and a['fonts']['status']=='loaded',f'Font load {a["scene"]}/{a["device"]}')
check(len(T)==33 and all(t['passed']for t in T),'33 responsive stress checks')
check(all(t['reducedMotion']for t in T),'Reduced motion active')
with zipfile.ZipFile(R/'MadeYours-45-mockups.zip')as z:
 check(z.testzip()is None,'ZIP CRC');check(len(z.namelist())==45,'ZIP45');check(all(z.read(p.name)==p.read_bytes()for p in screens),'ZIP current image bytes')
class Links(HTMLParser):
 def handle_starttag(self,tag,attrs):
  for k,v in attrs:
   if k in ['href','src'] and v:
    t=urlsplit(v)
    if not(t.scheme or t.netloc)and t.path:check((self.p.parent/unquote(t.path)).exists(),f'Broken local link {self.p.name}: {v}')
count=0
for p in R.rglob('*.html'):
 l=Links();l.p=p;l.feed(p.read_text());count+=1
for p in R.rglob('*.json'):json.loads(p.read_text())
check(len(F['acceptedLines'])==2 and len({l['sku']for l in F['acceptedLines']})==1 and len({l['text']for l in F['acceptedLines']})==2,'Distinct same-SKU configurations')
check(sum(l['priceMinor']*l['quantity']for l in F['acceptedLines'])==F['quote']['merchandiseMinor'],'Merchandise arithmetic');check(F['quote']['merchandiseMinor']+F['quote']['shippingMinor']==F['quote']['totalMinor']==F['order']['totalMinor'],'Quote/order arithmetic')
check(len(P['assets'])==3 and all(a.get('prompt')for a in P['assets']),'3 original asset prompts')
check(all((R/a['file']).exists()for a in P['assets']),'Original assets local')
check('Continue to MadeYours' in (R/'source/11-sign-up.html').read_text(),'Explicit identity continuation')
check('No email-verification step is automatically inserted' in (R/'source/11-sign-up.html').read_text(),'No invented automatic verification')
check('background:var(--action)' in (R/'source/styles.css').read_text() and P.get('identityReference',{}).get('primary')=='#2C2642','Current identity palette provenance')
result={'theme':'MadeYours','milestone':'1_design_artifacts','passed':not errors,'counts':{'requiredIndividualPngs':len(screens),'threeDeviceBoards':len(boards),'responsiveAuditEntries':len(A),'stressChecks':len(T),'htmlFilesChecked':count},'checks':{'pngSignatureDimensionsDecode':True,'uniqueScreenHashes':len(hashes),'zipCurrentBytes':True,'actualViewportsAndDpr':True,'fontsAndImagesReady':True,'pageOverflowAbsent':True,'integerFixtureArithmetic':True,'sameSkuDistinctConfigurationFixture':True,'assetPromptsPresent':True,'localLinks':True},'visualReview':{'status':'theme_author_passed_representative_screens_and_all_scene_overview; coordinator_review_pending','examples':['01-home-top-desktop','03-collection-tablet','05-product-specify-mobile','07-cart-desktop','09-checkout-review-mobile','11-sign-up-mobile','14-order-detail-mobile','15-addresses-desktop','05-product-specify-hindi-expansion'],'corrected':['Full configured summary before narrow payment action','200% text wrapping','Hindi option labels and radio dimensions','Canonical identity explicit Continue state and active admin/light ink palette/Geist typography']},'limits':['Visual proposal; no production implementation or persistence','No payment or fulfillment effects','Full assistive technology, integrated security, performance and provider verification remain required','Hindi UI sample is not Hindi engraving support','Optional verify-email APIs are separate from current BuyerAuthorize flow'],'productionBehaviorCertified':False,'published':False,'deployed':False,'errors':errors}
(R/'validation.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2));raise SystemExit(bool(errors))
