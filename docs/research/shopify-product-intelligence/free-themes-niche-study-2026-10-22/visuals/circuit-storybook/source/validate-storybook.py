from pathlib import Path
import json,hashlib,struct,zipfile,sys,importlib.util
ROOT=Path(__file__).resolve().parent.parent
repo=Path('/Volumes/Projects/LetBuyy')
spec=importlib.util.spec_from_file_location('programme_audit',repo/'docs/implementation/niche-theme-programme/verify_mockups.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
theme={'name':'Circuit','key':'circuit','artifactPath':str(ROOT.relative_to(repo))}
if not (ROOT/'validation.json').exists():
 (ROOT/'validation.json').write_text(json.dumps({'status':'validation_in_progress','productionBehaviorCertified':False})+'\n')
audit=module.audit(theme)
fixtures=json.loads((ROOT/'fixtures.json').read_text());cart=fixtures['cart'];calculated=sum(x['unitPrice']*x['quantity'] for x in cart['lines'])
arithmetic={'computedSubtotal':calculated,'declaredSubtotal':cart['subtotal'],'computedTotal':calculated+cart['shipping']-cart['discount'],'declaredTotal':cart['total'],'passed':calculated==4180==cart['subtotal'] and calculated+cart['shipping']-cart['discount']==4260==cart['total']}
audits=json.loads((ROOT/'responsive-audit.json').read_text());exports=json.loads((ROOT/'exports.json').read_text());stress=json.loads((ROOT/'stress-audit.json').read_text())
font_ok=all(a['fonts']['status']=='loaded' and a['fonts']['inter400'] and len(a['fonts']['loadedFaces'])>0 for a in audits)
export_dimensions=all(tuple(struct.unpack('>II',(ROOT/e['file']).read_bytes()[16:24]))==(e['width'],e['height']) for e in exports)
export_hashes=all(hashlib.sha256((ROOT/e['file']).read_bytes()).hexdigest()==e['sha256'] for e in exports)
script_errors=[(a['scene'],a['device'],a['pageErrors']) for a in audits if a['pageErrors']]
stress_ok=all(a['scrollWidth']<=a['width'] and a['brokenImages']==[] for a in stress['records'])
visual=json.loads((ROOT/'visual-review.json').read_text())
raster=json.loads((ROOT/'raster-audit.json').read_text())
gallery=json.loads((ROOT/'gallery-qa.json').read_text())
interactions=json.loads((ROOT/'local-interaction-checks.json').read_text())
correction=json.loads((ROOT/'correction-hash-proof.json').read_text())
manifest=json.loads((ROOT/'source-manifest.json').read_text())
source_hashes=all(hashlib.sha256((ROOT/file).read_bytes()).hexdigest()==sha for file,sha in manifest['sources'].items())
extended=visual['status']=='local_visual_review_complete' and raster['passed'] and gallery['passed'] and all(c['passed'] for c in interactions['checks']) and correction['passed'] and source_hashes
counts={'scenes':len(json.loads((ROOT/'scenes.json').read_text())),'individualPngs':len(list((ROOT/'images').glob('*.png'))),'boards':len(list((ROOT/'boards').glob('*.png')))}
record={'theme':'Circuit','phase':'milestone_1_mockups','localArtifactChecksPassed':audit['passed'] and arithmetic['passed'] and font_ok and export_dimensions and export_hashes and not script_errors and stress_ok and extended,'counts':counts,'independentSchemaAudit':audit,'arithmetic':arithmetic,'fontReadinessPassed':font_ok,'exportDimensionsMatchPngHeaders':export_dimensions,'exportHashesCurrent':export_hashes,'pageErrors':script_errors,'stressNoOverflowOrBrokenImages':stress_ok,'stressRecords':len(stress['records']),'rasterDecodeAndNonBlankPassed':raster['passed'],'sourceHashesCurrent':source_hashes,'galleryQaPassed':gallery['passed'],'localInteractionChecks':interactions['checks'],'profileCorrectionPreserved42Others':correction['passed'],'captureMethod':'Playwright fresh headless Chromium, native PNG full-page, DPR 1, chromiumSandbox:true, no user/shared tabs','visualReview':'Author local visual review complete in visual-review.json; coordinator acceptance remains separate','productionBehaviorCertified':False,'governance':'Not run in shared dirty checkout; coordinator explicitly prohibits cleanup/build gates here. Artifact-only changes, no topology/import/package/env/governance-memory or production changes.','residualLimits':['Mockup controls are presentation references and are labelled proposed in capabilities.json','No completed payment, signup, persisted account change or provider evidence','No full WCAG, assistive technology or production performance certification','Hindi expansion and root 200% text stress are local fixture probes, not merchant translation acceptance']}
(ROOT/'validation.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps(record,indent=2));sys.exit(0 if record['localArtifactChecksPassed'] else 1)
