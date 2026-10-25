"""Verify saved, sanitized Editor evidence. No browser, HTTP, SQL or app startup."""
import hashlib
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[5]
OUT = Path(__file__).resolve().parent
EDITOR = ROOT / 'docs/implementation/theme-editor-2026-10-23/evidence'
CANDIDATE = Path('/private/tmp/theme-editor-candidate-20261023-final02')

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def read(name):
    return json.loads((OUT / 'inputs/editor' / name).read_text())

def ax(name):
    return (OUT / 'inputs/editor' / name).read_text()

def main():
    ledger = json.loads((EDITOR / 'playfield-browser-diagnostics.json').read_text())
    names = ledger['theme']['evidence'] + [
        'playfield-browser-diagnostics.json', 'final02-candidate-copy-receipt.json',
        'cart-playfield-before.json', 'cart-playfield-two-editions.json',
        'cart-playfield-overstock.json', 'cart-playfield-restored.json',
    ]
    dest = OUT / 'inputs/editor'
    dest.mkdir(parents=True, exist_ok=True)
    evidence = []
    for name in sorted(set(names)):
        source, target = EDITOR / name, dest / name
        data = source.read_bytes()
        if target.exists():
            assert target.read_bytes() == data, f'Existing copied evidence differs: {name}'
        else:
            target.write_bytes(data)
        evidence.append({'path': str(source.relative_to(ROOT)), 'copy': str(target.relative_to(ROOT)), 'sha256': sha(target)})

    checks = []
    assert ledger['runId'] == '9cd50e893016'
    assert ledger['candidate'] == str(CANDIDATE)
    assert ledger['databaseThroughMigration'] == 390
    assert sha(CANDIDATE / 'theme-editor-candidate-source.json') == ledger['sourceManifestSha256']
    checks.append('Exact saved run/candidate/manifest binding; no new runtime connection')

    releases = {}
    for label, filename in [('A','A'), ('B','B'), ('restoreA','restored-A'), ('reapplyB','reapplied-B')]:
        raw = read(f'playfield-publication-{filename}-proof.json')
        proof = raw.get('proof', raw)
        if 'proof' in raw:
            assert raw.get('httpStatus', raw.get('status')) == 200
        assert proof['packageVersion'] == '2.0.0'
        assert proof['orders'] == 0 and proof['installed'] == 5
        assert proof['editorObservations']['captureFailures'] == 0
        releases[label] = proof
    assert releases['A']['releaseSha256'] == releases['restoreA']['releaseSha256']
    assert releases['B']['releaseSha256'] == releases['reapplyB']['releaseSha256']
    assert releases['A']['releaseSha256'] != releases['B']['releaseSha256']
    assert len({proof['releaseId'] for proof in releases.values()}) == 4
    assert [releases[k]['sourceDraftVersion'] for k in ['A','B','restoreA','reapplyB']] == [2,5,None,7]
    checks.append('A/restoreA and B/reapplyB content hashes agree across four real release IDs')
    assert read('playfield-public-A-readback.json') == {'status':200,'anonymous':True,'markerA':True}
    for name, absent in [('B','AFound'),('restored-A','BFound'),('reapplied-B','AFound')]:
        public = read(f'playfield-public-{name}-readback.json')
        assert public['httpStatus'] == 200 and public['expectedFound'] is True and public[absent] is False
    assert 'Playfield saved heading B 9cd50e893016' in ax('playfield-retained-B-after-restore-A.ax.txt')
    checks.append('Anonymous public heading readbacks and retained saved draft B support recovery component')

    carts = {phase: read(f'cart-playfield-{phase}.json') for phase in ['before','two-editions','overstock','restored']}
    for cart in carts.values():
        assert cart['runId'] == ledger['runId'] and cart['guardVerified'] is True and cart['readOnly'] is True
        assert cart['result']['orders'] == 0
        assert cart['result']['siteId'] == '7dfc2cb7-b06e-411c-9b2a-0b44882705be'
    assert carts['two-editions']['result'] == carts['overstock']['result']
    assert carts['before']['result'] == carts['restored']['result']
    before = carts['before']['result']['activeCarts'][0]
    cart = carts['two-editions']['result']['activeCarts'][0]
    assert before['id'] == cart['id'] == '20467e3d-c3b3-409f-be6a-ee4874049a91'
    assert len(before['items']) == 1 and before['items'][0]['quantity'] == 2
    assert before['items'][0]['unitPrice'] == 560 and before['items'][0]['lineTotal'] == 1120
    assert len(cart['items']) == 2 and len({line['variantId'] for line in cart['items']}) == 2
    by_edition = {line['properties']['Edition']: line for line in cart['items']}
    assert set(by_edition) == {'Inherited','Paper'}
    expected_ids = {'Inherited':'39b713a7-44a5-4327-ae9f-40d45c76bc2d','Paper':'d21309b4-c4a0-4eca-a591-c5a3f01d138f'}
    for edition, line in by_edition.items():
        assert line['productId'] == ledger['productId'] and line['variantId'] == expected_ids[edition]
        assert line['quantity'] == 1 and line['unitPrice'] == line['lineTotal'] == 480 and line['currency'] == 'INR'
        assert line['nicheSnapshot']['version'] == 1
        assert line['nicheSnapshot']['selected_options'] == [{'name':'Edition','value':edition}]
    assert sum(line['lineTotal'] for line in cart['items']) == 960
    inherited = by_edition['Inherited']['nicheSnapshot']['facts']['toys']
    paper = by_edition['Paper']['nicheSnapshot']['facts']['toys']
    assert inherited['finish'] == 'Sample blue finish' and inherited['materials'] == 'Wood'
    assert sum(row['quantity'] for row in inherited['contents']) == 15
    assert paper['ageBands'] == ['9-12'] and paper['materials'] == 'Paper'
    assert paper['contents'] == [{'label':'paper sheets','quantity':36}]
    assert paper['warnings'] == [] and paper['additionalDimensions'] == []
    assert 'height' not in paper['dimensions'] and 'ageStatement' not in paper
    assert 'Subtotal ₹960 Total ₹960' in ax('playfield-PF-I07-two-editions-reload.ax.txt')
    checks.append('Two distinct canonical variant lines, quantity/prices/options/facts and UI reload agree')
    checks.append('Above-stock attempt leaves accepted whitelisted cart/order result byte-semantically equal')
    checks.append('Original two-Pink cart restored by exact whitelisted result equality')
    after = read('playfield-after-overstock-proof.json')
    assert after['httpStatus'] == 200 and after['proof']['orderId'] is None and after['proof']['siteOrderCount'] == 0
    assert after['proof']['productOrderLineCount'] == 0
    checks.append('Post-overstock order readback zero; no paired inventory-before hash so no full effects claim')

    selections = read('playfield-PF-I05-selected-bindings.json')
    actual_ids = [row['carriers'][0]['variantId'] for row in selections]
    assert actual_ids == [expected_ids['Inherited'],'2fcc0c0f-3551-419b-a72b-cc4bfe012898',expected_ids['Paper'],expected_ids['Inherited']]
    assert 'MaterialsWood' in selections[1]['carriers'][0]['text']
    assert '36 × paper sheets' in selections[2]['carriers'][0]['text']
    for name in ['unknown','paper']:
        content = ax(f'playfield-PF-I05-{name}.ax.txt')
        for phrase in ['₹480 6–8 years','15 items in total','Length 24 cm · Width 19 cm · Height 1.5 cm','Read before choosing','Wood']:
            assert phrase in content
    assert '(disabled) Add to cart' in ax('playfield-PF-I05-reload.ax.txt')
    assert 'This change must originate from this merchant app.' in ax('playfield-PF-I06-clear-materials-save.ax.txt')
    checks.append('Actual selected UUID cycle, stale outer claims, reload reset and origin-save denial retained')

    assert '1 products' in ax('playfield-PF-I03-age-interest-positive.ax.txt')
    assert '1 products' in ax('playfield-PF-I03-query-reload.ax.txt')
    assert 'Value: Newest' in ax('playfield-PF-I03-sort-state.ax.txt')
    assert 'Value: Any interest' in ax('playfield-PF-I03-clear-interest.ax.txt')
    age_clear = ax('playfield-PF-I03-clear-age.ax.txt')
    assert 'Loading storefront' in age_clear and 'interest=art' in age_clear.splitlines()[0] and 'age_band=' not in age_clear.splitlines()[0]
    checks.append('Positive/query reload/sort/interest-clear observed; age-clear only loading snapshot, not settled result')

    pins = json.loads((OUT / 'selected-facts-source-probe.json').read_text())['sources']
    source_hashes = []
    for pin in pins:
        current, candidate = sha(ROOT / pin['path']), sha(CANDIDATE / pin['path'])
        assert current == candidate == pin['sha256'], pin['path']
        source_hashes.append({**pin,'candidateSha256':candidate,'matchesPriorProbe':True})
    guard_path = 'apps/merchant/web/src/lib/api/request-origin.ts'
    guards = {'path':guard_path,'workspaceSha256':sha(ROOT/guard_path),'candidateSha256':sha(CANDIDATE/guard_path)}
    assert guards['candidateSha256'] == 'c288af9f88b5919f09c28391625801ee0c1331544085e01a60ad9252e4934631'
    assert guards['workspaceSha256'] == '4e1671afcb62bba3dc1d93a3e588b92e58d0d9ba7a3c081e8df4ee6ddb174f96'
    checks.append('Nine frozen fact/factory/picker sources match prior probe and actual candidate; released origin repair absent from candidate')

    observed = dict(Counter(row['status'] for row in ledger['cases']))
    assert observed == {'PARTIAL':4,'NOT_RUN':6,'FAIL':2,'PASS':1,'BLOCKED':1}
    # Three-valued full-case acceptance keeps partial/blocked cases uncredited.
    full = dict(Counter(row['status'] if row['status'] in ['PASS','FAIL'] else 'NOT_RUN' for row in ledger['cases']))
    assert full == {'NOT_RUN':11,'FAIL':2,'PASS':1}
    checks.append('All fourteen rows reconciled; partial/blocked work is not promoted to full-case PASS')
    result = {
        'recordedAt':datetime.now(timezone.utc).isoformat(),
        'classification':'INDEPENDENT_SAVED_EVIDENCE_AUDIT_NOT_NEW_BROWSER_EXECUTION',
        'runId':ledger['runId'],'candidate':str(CANDIDATE),'sourceManifestSha256':ledger['sourceManifestSha256'],
        'allAssertionsPassed':True,'checkGroups':checks,'controllerDispositionCounts':observed,'fullCaseStatusCounts':full,
        'releaseProofs':releases,'sourcePins':source_hashes,'originGuard':guards,'evidence':evidence,
        'limitations':['No own browser/API/SQL/runtime/DB/build/seeding activity','No full paired stock/payment/ledger/outbox invariance proof','No Playfield screenshot evidence in this ledger; saved AX is not screenshot/visual QA','No actual COD order; cart snapshots do not prove immutable order history','PF-I03 age-clear snapshot only loading; settled outcome unproven'],
        'automation':'KEEP_ACTIVE; all14 have not completed',
    }
    (OUT/'saved-evidence-verification.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps({'allAssertionsPassed':True,'checkGroups':len(checks),'copiedEvidence':len(evidence),'controllerDispositionCounts':observed,'fullCaseStatusCounts':full}))

if __name__ == '__main__':
    main()
