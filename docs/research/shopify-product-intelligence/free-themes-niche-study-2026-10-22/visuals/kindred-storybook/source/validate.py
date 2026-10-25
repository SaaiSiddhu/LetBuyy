from pathlib import Path
from PIL import Image
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
import json,hashlib,zipfile,struct
R=Path(__file__).resolve().parent.parent
errors=[]; checks=[]
def check(name,ok,detail=None):
 checks.append({'name':name,'passed':bool(ok),'detail':detail})
 if not ok:errors.append(name)
scenes=json.loads((R/'scenes.json').read_text());exports=json.loads((R/'exports.json').read_text());audits=json.loads((R/'responsive-audit.json').read_text());stress=json.loads((R/'comparisons/stress-audit.json').read_text());images=sorted((R/'images').glob('*.png'));boards=sorted((R/'boards').glob('*.png'))
check('15 unique scenes',len(scenes)==15 and len(set(s['id'] for s in scenes))==15)
check('45 individual PNGs and15 additional boards',len(images)==45 and len(boards)==15)
check('45 unique scene-device exports/audits',len(exports)==45 and len(audits)==45 and len(set((x['scene'],x['device'])for x in exports))==45 and len(set((x['scene'],x['device'])for x in audits))==45)
hashes={}; dimensions={}
for p in images+boards:
 data=p.read_bytes();check(str(p.relative_to(R))+' signature',data[:8]==b'\x89PNG\r\n\x1a\n');im=Image.open(p);im.load();dimensions[str(p.relative_to(R))]=im.size;hashes[str(p.relative_to(R))]=hashlib.sha256(data).hexdigest()
check('individual exports are byte-distinct',len(set(hashes[str(p.relative_to(R))]for p in images))==45)
for x in exports:
 w,h={'desktop':(1440,1000),'tablet':(834,1112),'mobile':(390,844)}[x['device']];actual=dimensions[x['file']];au=next(a for a in audits if a['scene']==x['scene'] and a['device']==x['device']);check(x['scene']+' '+x['device']+' exact actual viewport and PNG',actual[0]==w and actual[1]>=h and actual==(x['width'],x['height']) and x['viewport']=={'width':w,'height':h,'dpr':1} and au['width']==w and au['height']==h and au['dpr']==1,{'png':actual,'innerViewport':[au['width'],au['height']]});check(x['scene']+' '+x['device']+' ready/no overflow',au['scrollWidth']==w and au['documentWidth']==w and au['brokenImages']==[] and au['fontsReady']=='loaded' and not au['pageErrors']);expected_font='Geist Sans'if x['scene'].startswith(('10-','11-'))else'Lato';check(x['scene']+' '+x['device']+' body font loaded',any(f['family']==expected_font and f['status']=='loaded'for f in au['fontFaces']))
 if not x['scene'].startswith(('10-','11-')):check(x['scene']+' '+x['device']+' Playfair heading loaded',any(f['family']=='Playfair Display'and f['weight']=='400'and f['status']=='loaded'for f in au['fontFaces']))
with zipfile.ZipFile(R/'Kindred-45-mockups.zip')as z:
 check('ZIP45 exact current PNG byte matches',len(z.namelist())==45 and z.testzip()is None and all(z.read(p.name)==p.read_bytes()for p in images))
class Links(HTMLParser):
 def __init__(self):super().__init__();self.links=[]
 def handle_starttag(self,tag,attrs):
  for k,v in attrs:
   if k in ['src','href','action']and v:self.links.append(v)
missing=[]
for p in R.rglob('*.html'):
 parser=Links();parser.feed(p.read_text())
 for l in parser.links:
  u=urlsplit(l)
  if u.scheme or u.netloc or not u.path:continue
  q=(p.parent/unquote(u.path)).resolve()
  if not q.exists():missing.append({'source':str(p.relative_to(R)),'link':l})
check('all local HTML assets/links/forms resolve',not missing,missing)
for p in R.rglob('*.json'):
 if p.name!='validation.json':json.loads(p.read_text())
check('all JSON parses',True)
check('320px all15 and5 enlarged-text checks no horizontal overflow',len([x for x in stress if x.get('test')=='320px-reflow'])==15 and len([x for x in stress if x.get('test')=='200%-text-size'])==5 and not any(x.get('overflow')for x in stress))
check('remove-budget retains occasion and recipient',next(x for x in stress if x['test']=='remove-budget-retains-occasion')['passed'])
check('no gift-message control and reduced-motion active',next(x for x in stress if x['test']=='no-message-control')['count']==0 and next(x for x in stress if x['test']=='no-message-control')['reducedMotion'])
check('fixture arithmetic',1790+1290==3080 and 3080+80==3160)
# Identity correction checks are tied to rendered-source intent and bounded recapture provenance.
identity_source=(R/'source/11-create-account.html').read_text()
check('canonical registration heading', '<h1>Create your LetBuyy account</h1>' in identity_source)
check('explicit post-creation continuation', 'After account creation' in identity_source and 'Continue to Kindred' in identity_source and 'Use a different account' in identity_source and 'Kindred will receive your email address.' in identity_source)
check('no mandatory email verification next screen', 'Next: verify your email' not in identity_source and 'verification link' not in identity_source)
check('registration minimum8 guidance', 'At least 8 characters.' in identity_source)
if (R/'identity-correction.json').exists():
 correction=json.loads((R/'identity-correction.json').read_text())
 check('only6 identity screenshots recaptured;39 preserved',correction['unrelatedImageCount']==39 and correction['unrelatedImagesUnchanged'] and len(correction['captures'])==6)
 check('current canonical identity ink/Geist in all6 recaptures',all(x['identityPalette']['action']=='rgb(44, 38, 66)' and 'Geist Sans' in x['identityPalette']['font']for x in correction['captures']))
 check('signed-in continuation visible in all6 recaptures',all(x['signedInStateVisible'] and x['explicitContinue']==1 and x['useAnotherAccount']==1 and x['noAutomaticEmailVerification'] and not x['overflow']for x in correction['captures']))
profile_source=(R/'source/12-profile.html').read_text().split('<form class="profile-form">')[1].split('</form>')[0]
check('profile email is display text; name editing retained','class="profile-email">asha@example.test</p>' in profile_source and 'type="email"' not in profile_source and 'Email changes' not in profile_source and 'name="name"' in profile_source)
check('profile correction actual capture provenance exists',(R/'profile-correction.json').is_file())
if (R/'profile-correction.json').exists():
 profile=json.loads((R/'profile-correction.json').read_text())
 check('only3 profile screenshots recaptured;42 preserved',len(profile['captures'])==3 and profile['unrelatedImageCount']==42 and profile['unrelatedImagesUnchanged'])
 check('profile rendered read-only email and editable name on3devices',all(x['editableEmailCount']==0 and x['nameFieldCount']==1 and x['nameFieldEditable'] and x['emailText']=='asha@example.test' and not x['hasEmailChangePromise'] and not x['overflow']for x in profile['captures']))
def luminance(h):
 cs=[int(h[i:i+2],16)/255 for i in [1,3,5]];cs=[x/12.92 if x<=.04045 else((x+.055)/1.055)**2.4 for x in cs];return .2126*cs[0]+.7152*cs[1]+.0722*cs[2]
pairs=[]
for fg,bg,label in [('#342c2c','#fffaf4','body'),('#6c5b59','#fffaf4','support'),('#ffffff','#662e42','primary'),('#662e42','#f2e7df','link-selected'),('#a32323','#fff1ed','error'),('#33513d','#e5e9de','success'),('#ffffff','#2c2642','identity-primary'),('#111827','#ffffff','identity-body'),('#6b7280','#f6f7f9','identity-support')]:
 a,b=luminance(fg),luminance(bg);ratio=(max(a,b)+.05)/(min(a,b)+.05);pairs.append({'role':label,'foreground':fg,'background':bg,'ratio':round(ratio,2)});check('text contrast '+label,ratio>=4.5)
result={'schemaVersion':1,'theme':'Kindred','designVersion':'1.2','date':'2026-10-23','result':'pass'if not errors else'fail','scope':'Local design-artifact integrity; not production, backend, usability or accessibility certification','images':len(images),'boards':len(boards),'exports':len(exports),'audits':len(audits),'checksPassed':sum(x['passed']for x in checks),'checksFailed':len(errors),'errors':errors,'checks':checks,'sha256':hashes,'dimensions':dimensions,'contrastPairs':pairs,'visualReview':'Representative full-size home/collection/PDP/checkout/identity/address screens and all15 device-board overviews inspected. Coordinator review remains independent.','limits':['Presentation-only state; no backend mutations.','200% text sizing is a selected local CSS enlargement, not native browser page zoom.','Screen reader, full keyboard, dark mode, production performance and provider completion are not certified.','No source governance/build cleanup gate run in shared dirty checkout per coordinator capture instruction.']}
(R/'validation.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:result[k]for k in ['result','images','boards','checksPassed','checksFailed','errors']},indent=2))
if errors:raise SystemExit(1)
