from pathlib import Path
import json,csv,hashlib,shutil,difflib,subprocess,datetime,re
r=Path.cwd();w=Path('/tmp/letbuyy-site-20261101');out=r/'reports/letbuyy-marketing-ui-2026-11-01';e=out/'evidence';e.mkdir(parents=True,exist_ok=True)
def read(n):return json.loads((w/n).read_text())
def copy(n):
 p=w/n;dest=e/n
 if p.is_dir():shutil.copytree(p,dest,dirs_exist_ok=True)
 else:dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest)
http=read('html-results.json');site=read('site-browser.json');templates=read('final-templates.json');visual=read('visual-accepted.json');support=read('visual-support-final.json');home=read('visual-home-final.json');touch=read('touch.json');assert site['passed']and templates['passed']and touch['passed'];assert http['summary']['requested']==489 and not http['summary']['page_errors'];assert len(site['rows'])==573 and len(templates['rows'])==48
for d in [visual,support,home]:assert all(not x['dom_differences']for x in d['rows'])
for n in ['interactions.json','animation-and-navigation.json','capability-acceptance.json','menu-visual.json','pricing-recovery.json','create-after.json','handoff.json','carousel-motion.json','css-retention.json']:assert read(n)['passed'],n
assert len(read('scroll-visual.json')['rows'])==28 and all(not x['dom_differences']for x in read('scroll-visual.json')['rows']);assert all(not x['differences']for x in read('spa-cascade.json')['rows'])
changes=[];patch=[];names=set(read('source-start.json'))|{'packages/typescript/ui/src/index.ts','packages/typescript/ui/snapshots/public-api.json'}
for name in sorted(names):
 old=(w/'before'/name).read_bytes();new=(r/name).read_bytes()
 if old==new:continue
 changes.append({'path':name,'before_sha256':hashlib.sha256(old).hexdigest(),'after_sha256':hashlib.sha256(new).hexdigest()});patch.extend(difflib.unified_diff(old.decode().splitlines(True),new.decode().splitlines(True),fromfile='a/'+name,tofile='b/'+name))
assert len(changes)==5,changes
(out/'SOURCE-CHANGES.patch').write_text(''.join(patch));(out/'SOURCE-MANIFEST.json').write_text(json.dumps({'basis':'Task-start dirty-tree files, not HEAD; preserve all other user work','changes':changes},indent=2))
fidelity=[]
for name in sorted(read('source-start.json')):
 a=(r/name).read_bytes();b=(w/'final'/name).read_bytes();assert a==b,name;fidelity.append({'path':name,'sha256':hashlib.sha256(a).hexdigest()})
(w/'source-fidelity.json').write_text(json.dumps({'count':len(fidelity),'all_equal':True,'files':fidelity},indent=2))
files=['css-control-proof.json','css-retention.json','source-fidelity.json','source-start.json','html-results.json','site-browser.json','final-templates.json','visual-comparison.json','visual-accepted.json','visual-sitemap.json','visual-support-final.json','visual-home-final.json','scroll-visual.json','spa-cascade.json','animation-and-navigation.json','capability-acceptance.json','interactions.json','create-before.json','create-after.json','pricing-recovery.json','handoff.json','touch.json','touch-dev.json','touch-policy-trial.json','touch-control-events-light.json','touch-policy-trial-events-light.json','touch-policy-trial-events-dark.json','touch-events-light.json','touch-events-dark.json','menu-visual.json','carousel-motion.json','ui-aliases-baseline-confirmation.json','pricing-live.json','build-control.log','build-final.log','build-local-api.log','build-touch-final.log','tests-final.log','types-final.log','lint-final.log','stylelint-final.log','ui-tests.log','ui-types.log','ui-api.log','ui-aliases.log','interactions-touch-final.log','create-local-api.log','touch-final.log','touch-dev.log','touch-control.log','touch-policy-trial.log','pricing-recovery.log','handoff.log','animation-local-api.log','visual.log','visual-sitemap.log','visual-support-final.log','visual-home-final.log','http-touch-final.log','site-browser.log','templates-touch-final.log','menu-visual-final.log','carousel-motion.log','pricing-recovery.png','create-fixed-375.png','create-fixed-1366.png','touch-light.png','touch-dark.png']
for n in files:
 if(w/n).exists():copy(n)
for folder in ['visual','scroll-visual','spa-cascade']:copy(folder)
for p in w.glob('menu-*.png'):copy(p.name)
trials=['interactions.log','interactions-dev-initial.log','before-final-visual-sitemap.log','create-final.log','touch-initial-selector.log','touch-initial-coordinates.log','touch-valid-hit-initial.log','before-final-site-browser.json','before-final-html-results.json']
for n in trials:
 if(w/n).exists():(e/'trials').mkdir(exist_ok=True);shutil.copy2(w/n,e/'trials'/n)
(e/'scripts').mkdir(exist_ok=True)
for p in w.iterdir():
 if p.suffix in ['.cjs','.py']and p.name not in ['create-before.cjs']:shutil.copy2(p,e/'scripts'/p.name)
checks=[('HTTP inventory','PASS','489 URLs:477 HTML 200+12 expected308; 192 sitemap URLs;3 negative404','html-results.json'),('All-public-page browser layouts','PASS','573 cases:every477 HTMLURL at one alternating viewport/theme plus 96 breakpoint cases','site-browser.json'),('Final configured template views','PASS','48 light/dark desktop/mobile cases after the final touch repair','final-templates.json'),('CSS split visual/control comparisons','PASS','96 retained base comparisons +10 support +10 post-fix home comparisons','visual-accepted.json'),('Natural scrolling','PASS','28 section comparisons, no containment override','scroll-visual.json'),('Client navigation and stylesheet lifetime','PASS','10 comparisons in preserved documents','spa-cascade.json'),('Globe/scroll/locale/pricing animations','PASS','7 modes including failed-worker fallback and reduced motion','animation-and-navigation.json'),('Capability previews','PASS','8 modules at 2 widths, keyboard wrap and resize','capability-acceptance.json'),('Real touch input','PASS','Light/dark coarse-pointer CDP gestures, card swipes and vertical scrolling','touch.json'),('Normal carousel motion','PASS','Autoplay advances, hover pauses, leaving hover resumes','carousel-motion.json'),('Header/contact/demo controls','PASS','6 desktop/mobile cases; validation/back and focus wrap/return','interactions.json'),('Availability errors and race','PASS','2 widths;network/503 unknown,404 available,200 occupied,late response ignored','create-after.json'),('Pricing fault and real recovery','PASS','Synthetic transport fault;real four-plan local catalogue,110 comparison rows','pricing-recovery.json'),('Account handoffs','PASS','4 local landing cases;no account/email form submission','handoff.json'),('Marketing unit/boundary','PASS','205 tests','tests-final.log'),('Shared UI units/API/types','PASS','53 tests;380 protected exports;typecheck','ui-api.log'),('Types/build/lint/stylelint','PASS with existing warnings','Final production build and types pass;0lint errors,5 existing warnings','build-touch-final.log'),('Shared UI alias gate','PRE-EXISTING FAILURE','Same18 recorded violations and unchanged inputs;no waiver','ui-aliases-baseline-confirmation.json'),('Physical mobile/Safari/Firefox/AT','NOT MEASURED','Only installed Chromium;physical devices and assistive technology untested',''),('Field CWV and performance backlog','NOT MEASURED','No new Lighthouse/CrUX run or performance-completion claim','')]
with(out/'CHECKS.csv').open('w',newline='')as f:
 wr=csv.writer(f);wr.writerow(['check','status','coverage','evidence']);wr.writerows(checks)
with(out/'URL-INVENTORY.csv').open('w',newline='')as f:
 cols=['path','status','title','lang','h1','canonical','errors'];wr=csv.DictWriter(f,fieldnames=cols);wr.writeheader()
 for x in http['rows']:wr.writerow({k:' | '.join(x[k])if isinstance(x[k],list)else x[k]for k in cols})
branch=subprocess.check_output(['git','branch','--show-current'],text=True).strip();head=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip();build=(w/'final/apps/marketing/web/.next/BUILD_ID').read_text().strip()
receipt={'captured_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'branch':branch,'head':head,'final_build_id':build,'final_review_origin':'http://127.0.0.1:9045','source_file_count':len(fidelity),'changed_source_files':len(changes),'html_urls':489,'all_page_browser_cases':573,'final_template_cases':48,'retained_css_comparisons':116,'natural_scroll_comparisons':28,'spa_comparisons':10,'source_css_rules_preserved':3136,'new_touch_policy_rules':1,'fixes':['Availability failures stay unknown and stale requests cannot overwrite edits','Create Site sign-in reaches existing account lookup','Mobile menu focus containment/return and desktop Escape focus return','Inner carousel scroll containers preserve horizontal card gestures and native vertical/pinch gestures'],'no_existing_css_rule_or_animation_keyframe_removed':True,'primary_functional_checks_passed':True,'whole_repository_green':False,'preexisting_alias_violations':18,'physical_device_acceptance':False,'field_cwv_measured':False,'deployed':False,'data_seed_reset_migration_or_provider_send':False};(out/'verification.json').write_text(json.dumps(receipt,indent=2))
report=f'''# Marketing desktop/mobile verification — 1 November 2026

The marketing site is running at [127.0.0.1:9006/in](http://127.0.0.1:9006/in). **The tested CSS split preserves the sampled design, typography, content, layouts and animations. Four existing interaction defects were repaired locally. Nothing was deployed.**

## Repairs

1. **Create Site availability:** failed requests previously displayed “Available,” and failed HTTP responses could display “Already taken.” Failures now remain unknown with translated retry feedback. Editing the address aborts the old request; a late response cannot overwrite the current field. Confirmed404 and successful200 reads retain available/occupied states.
2. **Wrong sign-in destination:** Create Site’s “Sign in” link led to signup. It now uses the existing account `/lookup` route, matching the marketing header. Both sign-in and signup reach their actual local email screens on desktop/mobile; no account was created or email submitted.
3. **Menu keyboard focus:** Escape closed menus without restoring trigger focus, and the mobile modal lacked focus containment. The header now reuses the existing shared `useFocusTrap` hook, restores mobile focus, and returns desktop Escape focus to its trigger. The hook is exported and protected by the additive public-API snapshot. Drawer/mega-menu animation remains intact.
4. **Real touch swipe cancellation:** the carousel’s inner scroll containers allowed the browser to cancel a horizontal gesture before pointerup. The same cancellation reproduced in the unsplit control. One scoped touch-action rule now applies the carousel policy to those inner containers. Actual Chromium touch events confirm horizontal swipes advance the card while vertical gestures scroll the page without changing cards; pinch zoom remains permitted by CSS. Both themes pass on the normal local site and final production build.

The patch changes five source/snapshot files. **No existing CSS rule/declaration/condition or animation keyframe was removed.** The original3,136 rule fingerprints remain, with one added gesture-policy rule (3,137 total). Artwork, fonts, palettes and animation definitions were not edited in this task.

[Task-only patch]({out/'SOURCE-CHANGES.patch'}) · [Source manifest]({out/'SOURCE-MANIFEST.json'}) · [CSS retention proof]({e/'css-retention.json'}).

## What was verified

| Coverage | Result |
| --- | --- |
| Public URLs |489: 477 HTML 200 and 12 intentional author 308; 192 sitemap URLs include105 localized articles;3 invalid-route controls return 404 |
| Full source browser scan |573 cases:all477 HTML URLs at an alternating desktop/mobile/theme setting, plus 96 responsive cases |
| Final configured build |48 additional primary-template desktop/mobile/light/dark views after the touch repair |
| CSS control comparison |96 base +10 support +10 post-repair homepage comparisons; geometry, typography, colours and copy match |
| Natural scroll and client navigation |28 natural-scroll section comparisons and 10 same-document Next navigation comparisons pass |
| Main animations |Worker, unsupported/failed-worker fallback, pause/resume, one-time finale, reduced motion, native touch mode, desktop wheel and locale transition checks pass |
| Capability carousel |All 8 previews fit at 2 widths;keyboard wrap/resize, actual touch swipes and normal autoplay/hover pause/resume pass |
| Open navigation |8 light/dark cases at 320/375 mobile,768 landscape and1366 desktop;menus fit and focus introduces no horizontal scrolling |
| Contact/demo |Desktop/mobile required-field validation and forward/back input preservation pass;no messages submitted |
| Pricing |Real local four-plan read;110/61 comparison filters;synthetic error/failed retry/real recovery pass |
| Account links |Real local signup and sign-in landing screens open at both widths;no credentials entered or forms submitted |
| Source gates |205 marketing/boundary tests,53 UI tests, types,production build,380 protected API exports and stylelint pass;ESLint has 0 errors and 5 pre-existing warnings |

Pages covered include home,pricing,create,demo,contact,support,legal hub/all15 documents,HTML sitemap,resources hub/categories/tags/search/publisher/changelog/releases and all105 EN/HI/TA articles, including specialized Liquid/theme guides. Viewport samples include320,375,768,1024,1366 and1920 CSS pixels;768×420 exercises landscape reflow. This is not every possible page×viewport×browser×state combination.

## CSS control and evidence lineage

The control is a **reconstructed unsplit comparison**, not an untouched historical production release: it uses the captured original rule/at-rule order, retains all current declarations, maps3,119 rules to that order and appends17 later performance rules. Its3,136 fingerprints exactly match the split source before today's touch repair. The control and split build share the same starting application code and public assets; this is not an untouched release snapshot. Four sitemap comparisons initially differed only in the visible local origin port; those four were individually rechecked with only origin text normalized. Screenshot pixel diagnostics remain recorded; bit-for-bit raster identity is not claimed.

The broad573-case scan ran on the final menu/create source artifact on9039. A subsequent isolated build corrected its explicit local public API/CSP origin; the final touch-only rule was then built on9045. All489 URL assertions,48 template views,affected menu/form controls,real touch input and 10 post-fix homepage/control comparisons were rechecked on that final artifact. Earlier main-animation tests were repeated after the menu/create fixes; the touch addition changes gesture policy, not animation code. Separate dated raw results are retained, rather than presented as one untouched build.

The initial touch harness used an obsolete selector and then coordinates near controls; both receipts remain. Hit-tested pointer-event tracing showed genuine pointercancel from the actual preview. The browser-only policy trial, unsplit failure and shipped-rule regression establish the correction. One isolated availability fixture initially lacked its public API/CSP origin; its build environment was corrected without changing CSP or environment files. A temporary sitemap rerun interrupted by a review-server rebuild is retained as a harness failure. These are separate from application defects.

## Runtime, checks and limits

The local Docker engine was off. Starting the existing engine restored its existing Supabase containers, and the local gateway on9010 returned the original four plans (Launch₹199,Growth₹699;Scale/Commerce OS coming soon). No database seed/reset/migration was performed. The local accounts app was started on9002 for actual CTA landing checks. Normal9006/9010/9002 and restored local data services are left available; only task-owned review servers are closed after collection.

The broader UI alias validator still reports the **same18pre-existing violations**, with unchanged inputs and exact baseline comparison. No palette change, alias-snapshot waiver or whole-repository-green claim was made. The additive public API snapshot intentionally protects the existing shared hook as export380. Prior mobile blocking/LCP warnings remain a separate performance backlog; no new field CWV/INP or Lighthouse result is claimed here.

Chromium desktop/mobile/touch emulation was available; Safari/WebKit and Firefox binaries were absent. Physical Android/iOS,assistive technology,200% text resizing,real form delivery,OTP/account creation,payments and deployed behavior are not certified. The navigation/UI harnesses blocked non-GET submissions; availability faults and races used intercepted public GETs. No message, account or payment form was submitted. No live-site,environment-file,provider or release change occurred. This is a local UI verification, not an exhaustive accessibility or production-speed certification.

[Checks and limits]({out/'CHECKS.csv'}) · [URL inventory]({out/'URL-INVENTORY.csv'}) · [Structured receipt]({out/'verification.json'}) · [Source fidelity]({e/'source-fidelity.json'}).
'''
# Improve spacing without changing identifiers/URLs in the evidence tables.
for a,b in [('original3,136','original 3,136'),('all477','all 477'),('include105','include 105'),('all105','all 105'),('all15','all 15'),('maps3,119','maps 3,119'),('appends17','appends 17'),('Its3,136','Its 3,136'),('broad573','broad 573'),('All489','All 489'),('on9039','on 9039'),('on9045','on 9045'),('same18pre-existing','same 18 pre-existing'),('export380','export 380')]:report=report.replace(a,b)
(out/'VERIFICATION.md').write_text(report);print(json.dumps({'report':str(out/'VERIFICATION.md'),'source_files_changed':len(changes),'source_fidelity_files':len(fidelity),'final_build':build}))
