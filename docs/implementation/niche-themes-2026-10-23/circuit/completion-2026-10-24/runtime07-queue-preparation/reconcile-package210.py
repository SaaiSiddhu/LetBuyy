"""Read the already qualified promotion payload; prepare owned acceptance rows only."""
from pathlib import Path
import datetime
import hashlib
import json

ROOT = Path('/Volumes/Projects/LetBuyy')
OWN = ROOT / 'docs/implementation/niche-themes-2026-10-23/circuit/completion-2026-10-24'
SHARED = ROOT / 'docs/implementation/niche-theme-programme/completion-2026-10-24/child-customization-integration01'
CANDIDATE = Path('/private/tmp/letbuyy-shared-completion-20261024-06')
OUT = OWN / 'runtime07-queue-preparation'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def canonical_sha(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False,
                                     separators=(',', ':')).encode()).hexdigest()


def write(name, value):
    (OUT / name).write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n')


proposal = json.loads((SHARED / 'DISTRIBUTION_PROPOSAL.json').read_text())
sql = SHARED / 'customization210.up.proposal.sql'
expected_sql = next(x for x in proposal['files'] if x['path'] == sql.name)
assert sha(sql) == expected_sql['sha256'] and sql.stat().st_size == expected_sql['bytes']
segments = sql.read_text().split('$customization210$')
assert len(segments) == 3
items = json.loads(segments[1])
matches = [x for x in items if x['slug'] == 'letbuyy-forge']
assert len(matches) == 1
item = matches[0]
bundle = item['document']['liquidBundle']
expected_bundle = next(x for x in proposal['artifacts'] if x['slug'] == 'letbuyy-forge')
assert bundle['package']['version'] == '2.1.0'
assert bundle['package']['version_number'] == 5
assert canonical_sha(bundle) == expected_bundle['bundleSha256']

inventory_path = OWN / 'CAPABILITY_INVENTORY.json'
inventory = json.loads(inventory_path.read_text())
old = {x['type']: x for x in inventory['sectionTypes']}
assert set(old) == set(bundle['sections'])
manifest = item['persistence']['schemaManifest']
schema_changes, source_changes, contexts = [], [], []
for section_type, file in bundle['sections'].items():
    before = old[section_type]
    if before['schema'] != file['schema']:
        schema_changes.append({'sectionType': section_type, 'before': before['schema'],
                               'after': file['schema']})
    if before['sourceSha256'] != hashlib.sha256(file['source'].encode()).hexdigest():
        source_changes.append(section_type)
    for block_type, definition in manifest['section_schemas'][section_type]['blocks_schema'].items():
        if block_type.startswith('@app'):
            continue
        reusable = block_type in bundle['blocks']
        contexts.append({'sectionType': section_type, 'rootBlockType': block_type,
                         'parentKind': 'REUSABLE' if reusable else 'EXACT_FIRST_PARTY_INLINE',
                         'rootFields': list(definition.get('fields', {})),
                         'childType': 'badge', 'childFields': ['label'],
                         'requiredDepths': [2, 3], 'status': 'NOT_RUN'})

assert len(contexts) == 12
assert sum(x['parentKind'] == 'EXACT_FIRST_PARTY_INLINE' for x in contexts) == 10
assert set(bundle['blocks']) == {'badge'}
assert 'allowed_child_types' not in bundle['blocks']['badge']['schema']
assert {x['sectionType'] for x in schema_changes} == {'collection-product-list', 'trust-badges'}

source_files = ['packages/theme-engine/src/first-party-theme-catalog.ts',
                'packages/theme-engine/src/theme-bundle-core.ts',
                'apps/merchant/web/src/components/theme-editor/editor-block-actions.ts']
source_pins = [{'path': str(CANDIDATE / x), 'sha256': sha(CANDIDATE / x)} for x in source_files]
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
binding = {'runtimeRunId': '49ada80bc494', 'slug': 'letbuyy-forge', 'version': '2.1.0',
           'versionNumber': 5, 'bundleSha256': canonical_sha(bundle),
           'installedPackageId': None, 'installedVersionId': None, 'draftId': None,
           'releaseId': None, 'installedDescriptorObserved': False}
operations = ['select_correct_instance', 'add', 'edit_each_declared_field', 'reorder_siblings',
              'hide', 'show', 'save', 'full_reload', 'private_preview', 'publish',
              'public_readback', 'delete', 'save_reload_deleted', 're_add',
              'preserve_other_templates_and_original_package']


def row(case_id, requirement, **extra):
    return {'caseId': case_id, 'requirement': requirement, 'required': True,
            'status': 'NOT_RUN', 'review': {'status': 'PENDING', 'reviewer': None},
            'binding': binding, 'evidence': [], **extra}


rows = [row('CE210-B-trust-badges-badge', 'New service-information badge root lifecycle',
            sectionType='trust-badges', blockType='badge', operations=operations),
        row('CE210-F-trust-badges-badge-label', 'New service-information badge label field',
            sectionType='trust-badges', blockType='badge', field='label',
            operations=['edit', 'save', 'full_reload', 'private_preview', 'publish', 'public_readback'])]
for context in contexts:
    rows.append(row('CE210-N-' + context['sectionType'] + '-' + context['rootBlockType'],
                    'Badge children and grandchildren in this exact declared root context',
                    **context, operations=operations,
                    expected='Distinct stable root/child/grandchild UUIDs; child label at depths2/3; '
                             'correct selection, order and visibility after reload and public rendering.'))
rows.append(row('CE210-N-limits-and-protection', 'Existing nesting, cardinality and frozen app boundaries',
                operations=['depth4_refused', 'direct_root_limit50_retained', 'child_limit100_retained',
                            'declared_root_limits_retained', 'duplicate_uuid_refused',
                            'app_child_refused', 'unknown_type_refused', 'saved_tree_preserved_on_refusal'],
                expected='Normal visible limits first; API refusal branches require a separately admitted '
                         'negative scope. No app execution or schema relaxation. Shared source/native '
                         'guards remain attributed to their own cohorts.'))
assert len(rows) == 15 and len({r['caseId'] for r in rows}) == 15
counts = {'sectionTypes': len(bundle['sections']), 'sectionFields': sum(len(x['schema']['settings']) for x in bundle['sections'].values()),
          'declaredBlockPlacements': sum(len(x['schema']['blocks']) for x in bundle['sections'].values()),
          'effectiveBlockFields': sum(len(b.get('fields', {})) for s in manifest['section_schemas'].values() for b in s['blocks_schema'].values()),
          'protectedAppPlacements': sum(b.startswith('@app') for s in manifest['section_schemas'].values() for b in s['blocks_schema']),
          'protectedAppFields': sum(len(b.get('fields', {})) for s in manifest['section_schemas'].values() for t, b in s['blocks_schema'].items() if t.startswith('@app')),
          'inlineRootContexts': 10, 'reusableRootContexts': 2, 'newRequirementRows': len(rows)}
report = {'recordedAt': now, 'classification': 'SOURCE_ONLY_CURRENT_PACKAGE_REQUIREMENT_DELTA',
          'status': 'PREPARED_NOT_INSTALLED_OR_EXECUTED', 'binding': binding,
          'inputs': [{'path': str(sql), 'sha256': sha(sql), 'bytes': sql.stat().st_size},
                     {'path': str(SHARED / 'DISTRIBUTION_PROPOSAL.json'), 'sha256': sha(SHARED / 'DISTRIBUTION_PROPOSAL.json')},
                     {'path': str(inventory_path), 'sha256': sha(inventory_path)}, *source_pins],
          'historicalInventoryPreserved': True, 'counts': counts,
          'schemaChanges': schema_changes, 'changedSectionSources': source_changes,
          'childContexts': contexts,
          'exactDescriptorGate': 'Controller must compare normal installed manifest/package version and '
                                'section/block definitions to the pinned promoted bundle before module edits. '
                                'No eligibility is inferred from a version string alone.',
          'flatRows': 'Retain original288 NOT_RUN. The title field changes default Products to empty; '
                      'its existing row must verify empty/default and explicit heading behavior. '
                      'Existing customer-order-detail/heading row must verify configured heading. '
                      'All original45 sections remain declared; unsupported route/resource contexts need actual binding.',
          'sourceEligibility': 'Ten inline parents require exact first-party source and all reusable definitions. '
                               'The two badge root contexts use the reusable schema: undefined child allowlist '
                               'permits badge, explicit empty means none. Depth cap remains3.',
          'runtimeActions': 0, 'newCasePasses': 0, 'fullThemeCertified': False}
write('PACKAGE210_DESCRIPTOR_RECONCILIATION.json', report)
write('PACKAGE210_ADDITIONAL_REQUIREMENTS.json', {'recordedAt': now,
      'classification': 'UNEXECUTED_VERSION_SPECIFIC_REQUIREMENTS', 'binding': binding,
      'original288RowsUnchanged': True, 'rows': rows, 'counts': {'NOT_RUN': len(rows)},
      'countingRule': 'Requirements and suboperations only; no source, callback, native or UI execution credit.'})
print(json.dumps({'bundleHashExact': True, 'sqlHashExact': True, 'counts': counts,
                  'sourceOnly': True, 'newCasePasses': 0}))
