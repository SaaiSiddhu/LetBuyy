"""Read retained controller evidence; never opens an app or database."""
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

REPO = Path('/Volumes/Projects/LetBuyy')
OWN = REPO / 'docs/implementation/niche-themes-2026-10-23/circuit/completion-2026-10-24'
SOURCE = REPO / 'docs/implementation/theme-editor-2026-10-23/completion-2026-10-24/runtime07-20261025'


def read(name):
    return json.loads((SOURCE / name).read_text())


def ref(path):
    return {
        'path': str(path.relative_to(REPO)),
        'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
        'bytes': path.stat().st_size,
    }


cycle = read('CIRCUIT_LOCAL_EDITOR_CYCLE_RESUME02.json')
temporary = read('CIRCUIT_EDITOR_BINDINGS_TEMPORARY_READDED.json')
clean = read('CIRCUIT_EDITOR_BINDINGS_CLEAN_FINAL.json')
assert cycle['lastStep'] == 'COMPLETE_FINITE_LOCAL_ATOMIC_CYCLE_FULL_THEME_OPEN'
assert cycle['runId'] == temporary['runId'] == clean['runId'] == '49ada80bc494'
assert cycle['version'] == '2.1.0' and cycle['ordersCreated'] == 0
assert not cycle['stockOrProductFactsChanged'] and cycle['providerActions'] == 0
assert len(cycle['evidence']) == 9 and len(cycle['cases']) == 12
files = [SOURCE / name for name in [
    'CIRCUIT_LOCAL_EDITOR_CYCLE_RESUME02.json',
    'CIRCUIT_EDITOR_BINDINGS_TEMPORARY_READDED.json',
    'CIRCUIT_EDITOR_BINDINGS_CLEAN_FINAL.json',
]]
texts = {}
image_encodings = {}
for e in cycle['evidence']:
    assert e['runId'] == cycle['runId']
    for key in ['ax', 'screenshot']:
        p = SOURCE / e[key]
        assert p.is_file() and p.stat().st_size > 0
        if key == 'screenshot':
            raw = p.read_bytes()
            if raw.startswith(b'\x89PNG\r\n\x1a\n'):
                image_encodings[e[key]] = 'image/png'
            else:
                assert raw.startswith(b'\xff\xd8\xff') and raw.endswith(b'\xff\xd9')
                image_encodings[e[key]] = 'image/jpeg'
        else:
            texts[e['label']] = p.read_text()
        files.append(p)

root, child_a, child_b = cycle['temporaryLabels']
field_value = 'Circuit temporary declared-field roundtrip'
saved = texts['circuit-declared-field-full-reload']
assert 'text Saved' in saved
assert f'Shipping information, Value: {field_value}' in saved
tree = texts['circuit-root-children-reorder-hide-full-reload']
assert 'text Saved' in tree and f'Label, Value: {child_a}' in tree
assert 'Toggle Badge block visibility, Value: 0' in tree
assert tree.count('Remove child block') >= 2
hidden = texts['circuit-public-hidden-tree-and-unique-field']
shown = texts['circuit-public-shown-children']
removed = texts['circuit-public-child-removed-sibling-preserved']
readded = texts['circuit-a2-readded-published']
assert root in hidden and child_b in hidden and child_a not in hidden and field_value in hidden
assert f'{root} {child_b} {child_a}' in shown
assert root in removed and child_b in removed and child_a not in removed
assert f'{root} {child_b} {cycle["readdedLabel"]}' in readded
restored = texts['circuit-original-property-controls-restored-reload']
assert 'text Saved' in restored and 'Shipping information' in restored
assert field_value not in restored
public_clean = texts['circuit-clean-public-original-content']
assert not any(x in public_clean for x in [root, child_a, child_b, field_value])

binding = temporary['binding']
draft_nodes = binding['draft']['ownedTemporaryAndHostNodes']
raw_nodes = [n for n in draft_nodes if n['path'].startswith('/sections/template/4/blocks/')]
assert [n['label'] for n in raw_nodes] == [root, child_b, cycle['readdedLabel']]
ids = [n['idField'] for n in raw_nodes]
assert len(set(ids)) == 3 and all(re.fullmatch(r'block-[0-9a-f-]{36}', x) for x in ids)
template_nodes = [n for n in draft_nodes if n['path'].startswith('/templates/index/sections/forge-service-index/blocks/')]
assert {n['mapKey']: n['label'] for n in template_nodes} == dict(zip(ids, [root, child_b, cycle['readdedLabel']]))
for kind in ['draft', 'release']:
    assert not any(n.get('label', '').startswith('Circuit temporary') for n in clean['binding'][kind]['ownedTemporaryAndHostNodes'] if n.get('label'))
assert clean['binding']['instance']['id'] == binding['instance']['id']
assert clean['binding']['instance']['packageVersionId'] == binding['instance']['packageVersionId']

digest_limitation = (
    binding['draft']['workingManifestSha256'] == binding['release']['snapshotSha256']
    and binding['draft']['ownedTemporaryAndHostNodes'] != binding['release']['ownedTemporaryAndHostNodes']
)
now = datetime.now(timezone.utc).isoformat()
accepted_field_ops = ['valid_edit', 'clear_or_optional_absence', 'save', 'full_reload', 'publish', 'public_readback']
out = {
    'recordedAt': now,
    'classification': 'READONLY_RETAINED_RUNTIME07_EDITOR_COMPONENT_REVIEW',
    'status': 'ACCEPT_BOUNDED_OBSERVED_COMPONENTS_FULL_ROWS_PARTIAL',
    'reviewer': 'Circuit owner; independent of the Editor controller, programme acceptance pending',
    'runtimeRunId': cycle['runId'],
    'controller': '01a166eb-66bb-7042-bb47-2aaafef26f53',
    'scope': 'One home-template trust-badges host, shippingText and one badge root with two direct badge children; no grandchildren.',
    'physicalReview': {
        'artifactsRehashed': len(files),
        'axRecordsRead': len(texts),
        'actualScreenshotEncodings': image_encodings,
        'screenshotNameCaveat': 'Controller .png filenames contain JPEG bytes; original bytes and names preserved, actual encoding verified before review.',
        'screenshotsVisuallyInspected': [
            '076-circuit-root-children-reorder-hide-full-reload.png',
            '080-circuit-a2-readded-published.png',
            '081-circuit-original-property-controls-restored-reload.png',
            '082-circuit-clean-public-original-content.png',
        ],
        'storedRootAndDirectChildrenDistinctIds': ids,
        'draftTemplateMirrorIdsAndLabelsAgree': True,
        'cleanFinalNoOwnedTemporaryNodes': True,
    },
    'actualBindings': {
        'siteId': binding['instance']['siteId'],
        'instanceId': binding['instance']['id'],
        'packageId': binding['instance']['packageId'],
        'packageVersionId': binding['instance']['packageVersionId'],
        'temporaryDraft': binding['draft']['id'],
        'temporaryDraftVersion': binding['draft']['version'],
        'temporaryRelease': binding['release']['id'],
        'temporaryReleaseSourceDraftVersion': binding['release']['sourceDraftVersion'],
        'cleanDraft': clean['binding']['draft']['id'],
        'cleanDraftVersion': clean['binding']['draft']['version'],
        'cleanRelease': clean['binding']['release']['id'],
        'cleanReleaseSourceDraftVersion': clean['binding']['release']['sourceDraftVersion'],
        'sourceBundleDigestIndependentlyMatchedToInstalledVersion': False,
        'bindingTimeCaveat': 'Temporary draft and prior release are different acknowledged revisions. Clean-final binding was read after Editor moved the site to another theme; it does not claim Circuit remains the current site theme.',
    },
    'acceptedObservedComponents': [
        'Shipping text control value survives save/full reload and is consumed by the published page; clearing restores original empty field and public content.',
        'One badge root and two direct children have distinct stored IDs mirrored in the same exact home-template host.',
        'Direct-child B-before-A order and A hidden state survive reload; hidden public page omits A and contains root/B.',
        'Published child show includes A; subsequent removal omits A while root/B remain; re-added A2 is published after B.',
        'Final editor/public evidence and clean-final bounded binding have no owned temporary root/children/field marker.',
    ],
    'controllerReportedNotSeparatelyTraceProved': [
        'Cancel removal retained both children.',
        'Undo restored two children and Redo cleaned them.',
    ],
    'requirementOverlay': [
        {'caseId': 'CE-F-section/trust-badges/shippingText', 'status': 'PARTIAL', 'acceptedOperations': accepted_field_ops, 'remaining': ['invalid_or_limit_rejection', 'private_preview', 'exact_installed_descriptor_lineage']},
        {'caseId': 'CE210-B-trust-badges-badge', 'status': 'PARTIAL', 'remaining': ['root_sibling_reorder', 'root_hide_show', 'root_re_add', 'private_preview', 'cross_template_preservation', 'exact_installed_descriptor_lineage']},
        {'caseId': 'CE210-F-trust-badges-badge-label', 'status': 'PARTIAL', 'remaining': ['private_preview', 'exact_installed_descriptor_lineage']},
        {'caseId': 'CE210-N-trust-badges-badge', 'status': 'PARTIAL', 'acceptedDepths': [2], 'remaining': ['depth3_grandchildren', 'private_preview', 'cross_template_preservation', 'exact_installed_descriptor_lineage']},
    ],
    'openEvidenceCorrelation': {
        'temporaryDigestEqualsDespiteDifferentNodeProjection': digest_limitation,
        'status': 'NO_DISCREPANCY_OBSERVED' if not digest_limitation else 'OPEN',
        'disposition': 'Initial truncated-output reading concern was corrected with the complete raw arrays: both temporary draft and release contain root/B/A2 with the same IDs. Correction sent to Editor. This review hashes the retained artifact, not a newly queried full database manifest.',
    },
    'preview': {
        'status': 'OPEN',
        'finding': 'ED-R07-PREVIEW-DEVICE-02',
        'observation': 'Retained desktop editor screenshots show blank live-preview content. No private preview, tablet/mobile, responsive or accessibility acceptance inferred.',
    },
    'coverageDisposition': {
        'original25': {'PASS': 10, 'PARTIAL': 5, 'NOT_RUN': 10},
        'original288Overlay': {'PARTIAL': 1, 'NOT_RUN': 287},
        'new210Overlay': {'PARTIAL': 3, 'NOT_RUN': 12},
        'wholeCasePassesAdded': 0,
        'sealedSourceRequirementAddendumModified': False,
        'controller12AtomicReferencesAreNot12WholeCases': True,
    },
    'preservation': {'ordersCreatedByThisReview': 0, 'stockMutations': 0, 'appCalls': 0, 'databaseCalls': 0, 'nativeExecutions': 0, 'sourceEdits': 0},
    'fullThemeCertificate': False,
    'artifacts': [ref(p) for p in files],
}
dest = OWN / 'runtime07-queue-preparation/EDITOR_LOCAL_CYCLE02_RECONCILIATION.json'
dest.write_text(json.dumps(out, indent=2) + '\n')
print(json.dumps({'path': str(dest.relative_to(REPO)), 'sha256': ref(dest)['sha256'], 'artifacts': len(files), 'wholeCasePassesAdded': 0, 'partialRequirementOverlay': 4, 'temporaryDigestLimitation': digest_limitation}))
