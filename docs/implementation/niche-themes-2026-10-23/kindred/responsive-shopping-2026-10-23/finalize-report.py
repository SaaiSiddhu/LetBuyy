"""Package owned QA receipts; never runs a browser, server, fixture or DB."""
import collections
import datetime
import hashlib
import json
import pathlib
import subprocess

base = pathlib.Path('docs/implementation/niche-themes-2026-10-23/kindred')
folder = base / 'responsive-shopping-2026-10-23'
read = lambda name: json.loads((folder / name).read_text())
digest = lambda file: hashlib.sha256(pathlib.Path(file).read_bytes()).hexdigest()
save = lambda name, value: (folder / name).write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n')
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
browser, clears, fixture = map(read, ['browser-report.json', 'native-clear-links-report.json', 'fixture-manifest.json'])
assert len(browser['rows']) == len(clears['rows']) == 24
assert browser['browserClosed'] and clears['browserClosed'] and fixture['resources'] == 'server_closed'
assert not fixture['sourceDrift'] and not fixture['changedPreviousEvidence'] and fixture['fetchCalls'] == 0
assert clears['status'] == 'PASS' and sum(len(row['clearLinks']) for row in clears['rows']) == 120
assert sum(row['status'] == 'PASS' for row in browser['rows']) == 22
assert sum(row['initialDom']['noMatchingProducts'] for row in clears['rows']) == 12
assert all(row['applyFocus']['active'] and row['applyFocus']['width'] == '2px' for row in browser['rows'])

# Preservation checks only. The independent review remains closed.
prior = read('independent-388-preservation.json')
assert all(digest(row['file']) == row['sha256'] for row in prior['files'])
closure = json.loads((base / 'review-388-final-closure.json').read_text())
receipt_checks = [{'file': row['path'], 'expectedSha256': row['sha256'], 'currentSha256': digest(row['path']), 'matches': digest(row['path']) == row['sha256']} for row in closure['evidence']]
sql_checks = [{'file': row['path'], 'expectedSha256': row['currentSha256'], 'currentSha256': digest(row['path']), 'matches': digest(row['path']) == row['currentSha256']} for row in closure['sourceMatch']]
assert all(row['matches'] for row in receipt_checks + sql_checks)
prior.update(checkedAt=now, filesChanged=[], closureReceiptHashChecks=receipt_checks, sqlPreservationOnly=sql_checks, testsRerun=False, reviewReopened=False)
save('independent-388-preservation.json', prior)
listener = subprocess.run(['lsof', '-nP', '-iTCP:43275', '-sTCP:LISTEN'], capture_output=True, text=True)
assert listener.returncode == 1 and listener.stdout == ''
save('resource-release.json', {
    'recordedAt': now, 'owner': 'Kindred', 'slot': 2, 'state': 'RELEASED', 'port': 43275,
    'server': {'pid': fixture['pid'], 'session': 82485, 'exitCode': 0, 'closedAt': fixture['closedAt'], 'receipt': 'fixture-manifest.json'},
    'browser': {'mainSession': 52808, 'clearLinkSession': 96941, 'exitCodes': [0, 0], 'closedInFinally': True, 'receipts': ['browser-report.json', 'native-clear-links-report.json']},
    'listenerCheck': {'command': 'lsof -nP -iTCP:43275 -sTCP:LISTEN', 'exitCode': listener.returncode, 'stdout': listener.stdout},
    'processInventory': 'NOT_RUN: sandbox denies ps; server exec completion and signal-handler closure are recorded independently',
    'databaseStarted': False, 'heldAppsTouched': False, 'userTabsTouched': False, 'fullBuildStarted': False,
})
widths = []
for width in [320, 768, 1440]:
    rows = [row for row in browser['rows'] if row['width'] == width]
    widths.append({'width': width, 'captures': len(rows), 'passed': sum(row['status'] == 'PASS' for row in rows), 'failed': sum(row['status'] == 'FAIL' for row in rows)})
failed = [row for row in browser['rows'] if row['status'] == 'FAIL']
defect = {
    'id': 'KQA-01', 'priority': 'P2', 'status': 'OPEN_FROZEN_SOURCE_NO_FIX',
    'title': 'Long merchant brand compresses desktop navigation at 768px',
    'exactSelectors': [f'.kr-theme .lb-header__nav-links > a:nth-of-type({index})' for index in range(1, 5)],
    'brand': 'Kindred उपहार और Thoughtfully Selected Everyday Celebrations', 'width': 768,
    'routes': ['collection', 'search'],
    'observedLinks': [{'label': row['observed']['label'], 'width': row['observed']['width'], 'height': row['observed']['height']} for row in failed[0]['defects']],
    'reproductionUrls': [row['defects'][0]['reproduction'] for row in failed],
    'screenshots': [row['screenshot'] for row in failed], 'documentOverflow': False,
    'description': 'Four navigation links wrap into narrow vertical strips. Widths 18.61–31.77px fail the 44px acceptance target. Document remains 768px wide.',
    'writerAllocation': 'Coordinator to allocate a focused header correction; no production source changed by this QA.',
}
summary = {
    'completedAt': now, 'scope': fixture['scope'], 'status': 'FAIL_ONE_OPEN_HEADER_DEFECT', 'widths': widths,
    'layoutCases': {'passed': 22, 'failed': 2, 'captures': 24},
    'nativeInteractions': {'status': 'PASS', 'applySort': 24, 'clearAllRecovery': 24, 'nextPrevious': 24, 'independentClearClicks': 120, 'independentClearCasesPassed': 24, 'initialEmptyDomPositiveControls': 12},
    'keyboard': {'tabObservations': sum(len(row['keyboard']) for row in browser['rows']), 'hiddenPanelFocus': 0, 'applyFocusCases': 24, 'outline': '2px solid observed', 'scope': 'Static native controls; header hydration/menu activation NOT_RUN'},
    'defects': [defect], 'sourceHashes': fixture['sourceHashes'],
    'notRun': ['Installed API/SQL filter correctness', 'Installed buyer/merchant/theme/hosted checkout and saved-order lifecycle: all19 cases NOT_RUN', 'Application header custom-element hydration/menu activation', 'Real payment, deployment, database or full-app build'],
    'preservation': {'m1Files': 91, 'earlierNarrowHeaderScreenshots': 15, 'changed': 0, 'independent388': 'Closed review and its saved source/receipt pins preserved; no rerun or reopened review'},
    'resources': {'slot': 2, 'state': 'RELEASED', 'port': 43275, 'receipt': 'resource-release.json'},
    'evidence': {'browser': 'browser-report.json', 'individualClears': 'native-clear-links-report.json', 'renderExport': 'fixture-manifest.json', 'lifecyclePreparation': 'installed-gifts-lifecycle.plan.json'},
    'runnerCorrections': ['Query comparison is limited to Kindred filter/search forms; shared header starts separate search.', 'Transport normalization drops an absent optional search:undefined.', 'Empty DOM asserts the actual Kindred No matching products. heading.', 'Connector normalization treats a scalar and a single-element array as equivalent values without spreading text.'],
    'priorAttemptsPreserved': True,
}
save('qualification-summary.json', summary)
report = '''# Kindred responsive shopping QA

**22/24 layout cases pass. One P2 defect remains open on collection and search at 768px with a long merchant name.** Production source stayed frozen. This isolated static exporter uses the current Kindred v2 factory, real Liquid/CSS/render assembly and admitted discovery response projection. Live SQL filtering, installed lifecycle and header hydration remain NOT_RUN.

| Width | Captures | PASS | FAIL |
| --- | ---: | ---: | ---: |
'''
for row in widths:
    report += f"| {row['width']} | {row['captures']} | {row['passed']} | {row['failed']} |\n"
report += '''
Both collection and search were captured in four states: supplied gift filters; repeated unrelated connector/country/category/search keys with sort and page; actual admitted empty response; long merchant/collection and hostile inert labels. The collection fixture represents the store `/products` listing; it does not prove live collection-membership SQL behavior.

| Check | Result | Evidence |
| --- | --- | --- |
| Native Apply/sort and canonical FormData/query roundtrip | PASS, 24 cases | Actual DOM FormData, submitted URLs and parsed values in `browser-report.json`. |
| Independent clear URLs | PASS, 120 native clicks in 24 cases | `native-clear-links-report.json`; removes exactly one key/value, preserves unrelated keys and resets page. Both repeated connector values are cleared independently. |
| Clear-all recovery and next/previous | PASS, 24 cases each | Actual navigation and canonical parsed URLs; recovery renders one paginated product. |
| Actual admitted empty response | PASS, 12 initial controls | Zero card DOM nodes and exact **No matching products.** heading, then successful recovery. Finite fixture response proof; SQL correctness NOT_RUN. |
| Keyboard | PASS for bounded static controls | 432 Tab observations; no hidden panel focus; all 24 Apply controls have visible 2px solid focus. Hydrated menu activation NOT_RUN. |
| Viewport/fonts/contrast/media | PASS except KQA-01 targets | No measured horizontal document/text overflow, broken image, painted hidden state, missing approved font or contrast failure in the 24 captures. |
| Hostile supplied labels | PASS for admitted static render | Initial DOM has no script or inline handler nodes; script/image-like labels remain inert text. Existing sanitizer policy is unchanged. |
| Installed API/DB/buyer/checkout/historical readback | NOT_RUN | No database, held app, seed, install/publish, identity, cart or order was started. |

## KQA-01 — compressed navigation at 768px

**P2, open; no production fix made.** Set merchant name to `Kindred उपहार और Thoughtfully Selected Everyday Celebrations`, viewport 768px, with the ordinary four navigation links. Reproduce either initial long-label route using the allocated exporter:

- `/store/kindred-qa-long-labels/products?limit=1&sort=display_order&min_price=1000&max_price=2000&occasion=birthday&recipient=friend`
- `/store/kindred-qa-long-labels/search?limit=1&sort=display_order&min_price=1000&max_price=2000&occasion=birthday&recipient=friend`

Selectors: `.kr-theme .lb-header__nav-links > a:nth-of-type(1)` through `:nth-of-type(4)`. Occasions/For whom/Under a budget/Ready-made sets measure 18.97/18.61/28.58/31.77px wide, with text broken into vertical strips. Document width stays 768px: this is header compression and target width failure. Exact dimensions/URLs are in `qualification-summary.json`.

Screenshots: `screenshots/collection-long-labels-768.png` and `screenshots/search-long-labels-768.png`. Coordinator writer allocation is required for a focused correction; all shared and Kindred production source remains frozen. The 320px mobile and 1440px desktop long-name cases pass these measurements. Representative 320px search, 768px long-name collection and 1440px collection screenshots were visually inspected. These bounded checks do not certify full installed accessibility.

## Installed gifts preparation

`INSTALLED_GIFTS_LIFECYCLE.md` and `installed-gifts-lifecycle.plan.json` prepare 19 cases, **all NOT_RUN**, against the Editor's exact single 14-product recipe set. The data/schema probe passes and leaves every live binding null. It never calls the setup hook or creates a UUID, token or order. Base oracle: one existing ₹1,100 gift product, stock 8, no variants, three fixed contents rows, supplied image roles; actual shared ₹20 COD rate gives ₹1,120 server total. The proposed occasion/recipient merchant edit remains on that same product.

## Preservation and release

All 91 frozen M1 files and all 15 earlier narrow-header screenshots hash unchanged. Independent388 reports, final receipts and both SQL pins remain preserved; the closed review was not reopened or rerun. Proof: `fixture-manifest.json` and `independent-388-preservation.json`.

**Slot 2 / port 43275 is RELEASED.** Browser runners closed in finally and exited 0. Server PID 15342/session 82485 closed normally and exited 0; `lsof` finds no listener. `resource-release.json` records closure. No held app, user tab, database or full build was touched.

`evidence-hashes.json` pins the owned supplementary files. Earlier runner attempts and screenshots are retained as labelled history; corrections were confined to QA query/heading oracles, with no production or sanitizer change. Full raw DOM/FormData/query/bounds/focus observations remain in the two browser receipts.
'''
(folder / 'REPORT.md').write_text(report)
status = json.loads((base / 'STATUS.json').read_text())
status.update(current_action='Responsive shopping QA complete: 22/24 layouts pass; KQA-01 long-brand header at 768px open; 120 independent clear clicks pass; 19 installed gifts cases prepared NOT_RUN; production frozen', browser_resources='closed; server15342 stopped; no listener on 43275; slot 2 explicitly RELEASED', next_step='Coordinator allocate KQA-01 header writer and later single shared installed fixture; no production fixes authorized in this slice')
status['responsive_shopping'] = {'report': 'responsive-shopping-2026-10-23/REPORT.md', 'summary': 'responsive-shopping-2026-10-23/qualification-summary.json', 'layoutPassed': 22, 'layoutFailed': 2, 'openDefect': 'KQA-01', 'independentClearClicksPassed': 120, 'nativeActionCasesPassed': 24, 'sourceDrift': 0, 'preservedFiles': 106, 'slot': 2, 'port': 43275, 'state': 'released', 'installedGiftsCasesNotRun': 19}
(base / 'STATUS.json').write_text(json.dumps(status, indent=2) + '\n')
handoff = base / 'HANDOFF.md'
text = handoff.read_text()
heading = '# Kindred v2 module handoff\n\n'
assert text.startswith(heading)
paragraph = 'Supplementary responsive discovery QA is complete in `responsive-shopping-2026-10-23/REPORT.md`: 22/24 layouts pass; KQA-01 records compressed long-brand navigation at 768px on collection/search, with exact selectors and screenshots. All 24 native Apply/sort/recovery/pagination cases and 120 independent clear clicks pass. Production remains frozen; no fix was made. The shared 14-product gifts plan is schema-checked with 19 installed cases all NOT_RUN and no invented identities. All 91 M1 files, 15 earlier narrow-header screenshots and independent388 evidence are preserved. Browser/server are closed and slot 2/port 43275 explicitly released.\n\n'
if not text.startswith(heading + paragraph):
    handoff.write_text(heading + paragraph + text[len(heading):])
files = [file for file in sorted(folder.rglob('*')) if file.is_file() and file.name != 'evidence-hashes.json']
save('evidence-hashes.json', {'recordedAt': now, 'scope': 'Owned supplementary QA files only; this manifest excludes itself', 'files': [{'file': str(file.relative_to(folder)), 'sha256': digest(file), 'bytes': file.stat().st_size} for file in files]})
print(json.dumps({'layoutPassed': 22, 'layoutFailed': 2, 'nativeClearsPassed': 120, 'preservedFiles': 106, 'evidenceFiles': len(files), 'slot2': 'RELEASED', 'installedCases': '19 NOT_RUN'}))
