"""Mechanical evidence validation only; no application, browser, SQL or tests."""
from pathlib import Path
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
import sys

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[3]
assert ROOT == Path('/Volumes/Projects/LetBuyy')

def load(path):
    return json.loads(path.read_text())

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def resolve(document, pointer):
    value = document
    for part in pointer.lstrip('/').split('/'):
        part = part.replace('~1', '/').replace('~0', '~')
        value = value[int(part)] if isinstance(value, list) else value[part]
    return value

checks = []
def check(name, condition):
    if not condition:
        raise AssertionError(name)
    checks.append({'name': name, 'result': 'CONSISTENT'})

for path in OUT.glob('*.json'):
    load(path)
checks.append({'name': 'All owned JSON documents parse', 'result': 'CONSISTENT'})
inventory = load(OUT / 'CAPABILITY_INVENTORY.json')
coverage = load(OUT / 'COVERAGE.json')
snapshot = load(OUT / 'SOURCE_SNAPSHOT.json')
original = load(ROOT / coverage['originalIndex'])
artifact = json.loads((ROOT / inventory['source']['capture']).read_text().split('$liquidbundle$')[1])
bundle = artifact['document']['liquidBundle']
check('Exact frozen 2.0.0 bundle SHA', hashlib.sha256(json.dumps(bundle, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest() == inventory['source']['bundleSha256'])
check('Every captured template enumerated once', {t['key'] for t in inventory['templates']} == set(bundle['templates']))
check('21 page templates plus 2 shared groups', inventory['counts']['pageTemplates'] == 21 and inventory['counts']['sharedGroupTemplates'] == 2)
check('All 45 section types enumerated once', {s['type'] for s in inventory['sections']} == set(bundle['sections']) and len(inventory['sections']) == 45)
check('All section-instance identities retained', {(i['template'], i['sectionId']) for i in inventory['sectionInstances']} == {(t, s) for t, template in bundle['templates'].items() for s in template['sections']})
check('All 13 declared block contexts enumerated', {(b['sectionType'], b['type']) for b in inventory['blocks']} == {(t, b['type']) for t, section in bundle['sections'].items() for b in section['schema']['blocks']})
check('All 141 effective field descriptors resolve exactly to source', len(inventory['fields']) == 141 and all({k:v for k,v in resolve(artifact, f['sourcePointer']).items() if k != 'id'} == {k:v for k,v in f['descriptor'].items() if k != 'id'} for f in inventory['fields']))
cases = coverage['cases']
check('Case IDs unique', len({c['caseId'] for c in cases}) == len(cases))
retained = {c['caseId']:c for c in cases if c['family'] == 'RETAINED_ORIGINAL'}
check('Exact original 26 IDs, clauses and statuses preserved', len(retained) == 26 and all(retained[c['id']]['requirement'] == c['required'] and retained[c['id']]['originalStatus'] == c['freshCorrectedRunStatus'] == retained[c['id']]['status'] for c in original['pendingObligations']))
check('Every template/section/block/field/default-instance has a mapped case', all('TL-ED-TEMPLATE-' + t['key'] in {c['caseId'] for c in cases} for t in inventory['templates']) and all('TL-ED-SECTION-' + s['type'] in {c['caseId'] for c in cases} for s in inventory['sections']) and all('TL-ED-BLOCK-' + b['id'] in {c['caseId'] for c in cases} for b in inventory['blocks']) and all('TL-ED-FIELD-' + f['id'] in {c['caseId'] for c in cases} for f in inventory['fields']) and len([c for c in cases if c['family'] == 'SECTION_INSTANCE']) == 32)
check('All current cases and operation slots remain NOT_RUN', all(c['status'] == 'NOT_RUN' and all(s == 'NOT_RUN' for s in c['operations'].values()) and all(s == 'NOT_RUN' for fields in c.get('fieldOperationSlots', {}).values() for s in fields.values()) for c in cases))
check('No invented evidence, actor, runtime or acceptance', all(not c['evidence'] and c['observed'] is None and c['runtime']['runId'] is None and c['review']['status'] == 'PENDING' for c in cases))
check('Rollup counts describe actual requirement records', coverage['currentCounts'] == dict(Counter(c['status'] for c in cases)) and coverage['countsByFamily'] == dict(Counter(c['family'] for c in cases)))
protected = [c for c in cases if c['applicability']['value'] == 'PROTECTED_SEAM_DENIAL']
check('App activation excluded, safe denial remains required', protected and all(c['required'] and c['activation']['status'] == 'CONSTITUTIONALLY_EXCLUDED' and c['operations']['no_misleading_active_control'] == 'NOT_RUN' for c in protected))
check('Every dormant app descriptor retains the same restriction', all(c['applicability']['value'] == 'PROTECTED_SEAM_DENIAL' for c in cases if c.get('sectionType') == 'app-block-slot' or c.get('blockType') == '@app'))
check('Historical 22 evidence pins retained without reuse credit', all(e['matchesOriginalPin'] for e in coverage['historicalEvidenceIntegrity']) and len(coverage['historicalEvidenceIntegrity']) == 22)
check('Five journey-source contracts linked', len(load(OUT / 'JOURNEY_CONTRACTS.json')['contracts']) == 5 and all('contractReference' in c['source'] for c in cases if c['caseId'].startswith(('TL-ADD-IDENTITY','TL-ADD-CART','TL-ADD-CHECKOUT','TL-ADD-RAZORPAY','TL-ADD-HISTORY','TL-ADD-REVERSAL'))))
proposal = load(OUT / 'PROPOSAL.v2.json')
check('Rejected V1 and current V2 are separately preserved', (OUT / 'PROPOSAL.json').is_file() and (OUT / 'declared-copy-output.UNAPPLIED.diff').is_file() and not proposal['runtimeOrTestRun'] and proposal['review']['status'] == 'PENDING')
check('Proposal base remains exact current source', digest(ROOT / proposal['target']) == proposal['baseSha256'])
cert = load(OUT / 'CERTIFICATION.json')
check('No certification or goal completion claimed', cert['goalStatus'] == 'active' and cert['FULL_THEME_CERTIFIED'] is False and cert['LOCAL_E2E_VERIFIED'] == cert['RAZORPAY_TEST_VERIFIED'] == 'NOT_RUN' and cert['REVIEW_ACCEPTED'] == 'PENDING' and cert['PRODUCTION_DEPLOYED'] == 'NOT_REQUESTED')
changed = [f['path'] for f in snapshot['files'] if f.get('sha256') and digest(ROOT / f['path']) != f['sha256']]
source_changes = [p for p in changed if not p.startswith('docs/')]
check('No captured product/source bytes changed', not source_changes)
receipt = {'recordedAt': datetime.now(timezone.utc).isoformat(), 'classification': 'MECHANICAL_DOCUMENT_CONSISTENCY_ONLY_NOT_PRODUCT_GOVERNANCE_OR_RUNTIME_TESTS',
           'checks': checks, 'consistentChecks': len(checks), 'requirementRecords': len(cases),
           'boundedSnapshotFiles': len(snapshot['files']), 'changedEvidenceSinceIntake': changed,
           'sourceChanges': source_changes, 'runtimeActions': 0, 'databaseActions': 0,
           'newProductPasses': 0, 'independentAcceptance': False}
receipt_name = sys.argv[1] if len(sys.argv) == 2 else 'VALIDATION.json'
assert receipt_name in ['VALIDATION.json', 'VALIDATION.v2.json']
with (OUT / receipt_name).open('x') as f:
    f.write(json.dumps(receipt, indent=2) + '\n')
print(json.dumps({'status':'DOCUMENTS_CONSISTENT_NOT_PRODUCT_ACCEPTANCE', 'checks':len(checks),
                  'requirementRecords':len(cases),'sourceChanges':source_changes,
                  'changedEvidenceSinceIntake':changed,'newProductPasses':0},indent=2))
