from pathlib import Path
import json,csv,shutil,hashlib,difflib,datetime,subprocess
r=Path.cwd();w=Path('/tmp/letbuyy-resources-20261031');out=r/'reports/letbuyy-resources-local-2026-10-31';e=out/'evidence';e.mkdir(parents=True,exist_ok=True)
h=json.loads((w/'http-results.json').read_text());b=json.loads((w/'browser-results.json').read_text());c=json.loads((w/'css-confirmation.json').read_text());before=json.loads((w/'dev-overlay-before.json').read_text());after=json.loads((w/'dev-overlay-after.json').read_text());assert h['summary']['passed']and b['passed'];assert b['article_pages']==105 and len(b['rows'])==147;assert before['hit_tag']=='NEXTJS-PORTAL'and after['hit_tag']!='NEXTJS-PORTAL'and not after['console_errors'];assert all(x['matches_previously_verified_source']for x in c['files'])
for name in ['catalogue.json','http-results.json','http-results-initial.json','http-check.log','http-check-initial.log','browser-results.json','browser-check.log','browser-check-initial.log','browser-check-dock-obstruction.log','css-confirmation.json','dev-overlay-before.json','dev-overlay-after.json','typecheck.log','resources-375.png','resources-1366.png','guide.png','dev-overlay-before.png','dev-overlay-after.png']:
 if(w/name).exists():shutil.copy2(w/name,e/name)
for name in ['check-pages.py','browser-check.cjs','browser-check-initial.cjs','inspect-dev-overlay.cjs','inspect-dev-overlay-after.cjs','write-report.py']:
 (e/'scripts').mkdir(exist_ok=True);shutil.copy2(w/name,e/'scripts'/name)
startup=(w/'server.log').read_text().splitlines();(e/'startup.log').write_text('\n'.join(startup[:15])+'\n')
p=r/'apps/marketing/web/next.config.ts';old=(w/'next.config.before.ts').read_text();new=p.read_text();patch=''.join(difflib.unified_diff(old.splitlines(True),new.splitlines(True),fromfile='a/apps/marketing/web/next.config.ts',tofile='b/apps/marketing/web/next.config.ts'));(out/'TASK-CHANGES.patch').write_text(patch)
with(out/'URL-CHECKS.csv').open('w',newline='')as f:
 cols=['path','kind','status','title','h1','language','canonical','content_characters','elapsed_seconds','redirect','errors'];writer=csv.DictWriter(f,fieldnames=cols);writer.writeheader()
 for x in h['rows']:writer.writerow({k:' | '.join(x[k])if k=='errors'else x.get(k,'')for k in cols})
receipt={'captured_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'user_facing_date':'2026-10-31','branch':subprocess.check_output(['git','branch','--show-current'],text=True).strip(),'head':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'base_url':h['summary']['base_url'],'http':h['summary'],'browser_articles':b['article_pages'],'browser_template_samples':b['resource_template_checks'],'browser_interactions':b['interactions'],'css':c,'source_change':{'path':'apps/marketing/web/next.config.ts','purpose':'Disable the development indicator that overlaps the mobile article Contents control','before_sha256':hashlib.sha256(old.encode()).hexdigest(),'after_sha256':hashlib.sha256(new.encode()).hexdigest(),'added_lines':2,'deleted_lines':0},'deployed':False,'app_css_modified_this_task':False,'article_records_modified_this_task':False,'shared_data_or_provider_writes':False,'passed':True};(out/'verification.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2))
report=f'''# Local marketing resources verification — 31 October 2026

The marketing development server is running at [127.0.0.1:9006/in](http://127.0.0.1:9006/in). The resource library is available at [English](http://127.0.0.1:9006/in/resources), [Hindi](http://127.0.0.1:9006/in-hi/resources) and [Tamil](http://127.0.0.1:9006/in-ta/resources). Nothing was deployed.

All 35 source articles remain present, providing 105 localized article pages. The current source-derived resource URL inventory passes all 435 checks: **414 HTTP 200 responses** (408 HTML pages plus six XML feeds), **12 expected permanent author redirects**, and **nine expected 404 negative controls**. There are no broken resource destinations or heading fragments within the inspected resource links.

| Current route type | URLs checked |
| --- | ---: |
| Articles/guides | 105 |
| Categories | 21 |
| Tags | 267 |
| Resource hubs | 3 |
| Search | 3 |
| Publisher | 3 |
| Changelog and release empty states | 6 |
| XML feeds | 6 |
| Retired author redirects | 12 |
| Invalid-route negative controls | 9 |

Browser verification opened **all 105 article pages**, using alternating mobile/desktop widths, plus **42 representative resource-template views** at both widths across EN/HI/TA. Visible headings/content, page language, loaded article images, horizontal overflow and uncaught page errors passed these samples. Actual desktop/mobile journeys passed library search, keyboard result navigation, opening a real guide, bookmark save/remove, and jumping to an existing heading through the appropriate contents UI. No external form, shared database or payment/provider mutation was performed; bookmarks were synthetic browser-local state.

## Why the large CSS deletions appeared

The preceding performance task moved independent home and resource rules out of the shared stylesheet so unrelated pages download less blocking CSS. Its first broader split changed typography and was reverted; the accepted narrower split kept shared cascade dependencies in their original order. The deletion-heavy intermediate edit in the supplied screenshot does not represent empty final stylesheets.

Current files were rechecked against the previously verified hashes:

| Stylesheet | Lines | Bytes | Loaded from |
| --- | ---: | ---: | --- |
| globals.css | 10,574 | 356,415 | Root layout |
| home.css | 2,991 | 98,238 | Locale homepage |
| resources.css | 1,405 | 88,430 | Resources layout |

These three files total **543,083 bytes**, versus 540,347 bytes in the task-start shared stylesheet. This was chiefly a split of delivered CSS, not removal of all resource styling. The current home/resource imports exist, and all three file hashes match the previously verified final files. The prior split proof preserved 3,136 rule/declaration/condition fingerprints; its 36 visual, 28 scroll and 10 client-navigation comparisons remain dated prior evidence. Today's checks independently verify page opening, responsive layouts and reading interactions. No application CSS or article record was changed in this task.

## One local development fix

The Next.js development indicator intercepted the mobile reading dock's Contents button. An actual hit-test returned `NEXTJS-PORTAL` at the button center, with no runtime-error dialog or console error. Added `devIndicators: false` to the existing Next configuration; after automatic restart the hit-test reaches the button's own content, and the real mobile/desktop contents interactions pass. This changes the development indicator setting, with no deployment. Marketing TypeScript checking and scoped whitespace checking pass.

[Exact two-line configuration patch]({out/'TASK-CHANGES.patch'}) · [Current configuration]({p}) · [Before obstruction evidence]({e/'dev-overlay-before.json'}) · [After evidence]({e/'dev-overlay-after.json'}).

## Evidence and limitations

[URL inventory]({out/'URL-CHECKS.csv'}) · [Structured verification]({out/'verification.json'}) · [Browser results]({e/'browser-results.json'}) · [CSS confirmation]({e/'css-confirmation.json'}).

![Current resource library, desktop]({e/'resources-1366.png'})

The initial HTTP harness treated the lower-case `location` header as case-sensitive; its failed receipt is retained, and the corrected redirect checks passed. The initial interaction selector targeted an unused older mobile TOC component; the test was corrected to use the real floating article dock. That exposed the actual development-indicator obstruction, which was fixed and retested. All 147 already-passing page-opening cases were retained when rerunning the affected interaction checks. The HTTP inventory and initial browser page loads preceded the indicator-only configuration fix; the affected control flows and hit-test were verified after it.

This is a local development verification, not a production audit or performance benchmark. Full browser/assistive-technology coverage, physical devices, signup/billing, field Core Web Vitals and live indexing are outside this check. Existing middleware deprecation and prior performance/shared-UI backlog items are not claimed resolved here. Existing unrelated working-tree changes and environment files were preserved. The marketing server is intentionally left running on port 9006.
'''
(out/'VERIFICATION.md').write_text(report);print(json.dumps({'report':str(out/'VERIFICATION.md'),'http_checks':435,'browser_page_checks':147,'css_unchanged':True,'source_change':'2 added config lines','deployed':False}))
