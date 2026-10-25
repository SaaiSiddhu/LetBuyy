"""Finite offline evidence extraction. Does not import/run product code or contact a service.

Generated records are descriptive evidence, subordinate to repository governance.
Run once for Phase 0; do not replace this packet with a later runtime's results.
"""
from pathlib import Path
from hashlib import sha256
from datetime import datetime, timezone
from collections import Counter
import json
import re

ROOT = Path('/Volumes/Projects/LetBuyy')
OUT = Path(__file__).resolve().parent
OWNER = OUT.parent
ARTIFACT = ROOT / 'docs/implementation/niche-theme-programme/release-playfield201/proposals/6bd27e70ca6f0a2169a15c3fe850d07bebb948a276002a483f730ac1f690885c/letbuyy-bloom-2.0.1.json'
M1 = ROOT / 'docs/research/shopify-product-intelligence/free-themes-niche-study-2026-10-22/visuals/playfield-storybook'
PROGRAMME = ROOT / 'docs/implementation/niche-theme-programme'
now = datetime.now(timezone.utc).isoformat()

def rel(p):
    return str(p.relative_to(ROOT))

def digest(p):
    return sha256(p.read_bytes()).hexdigest()

def pin(p):
    return {'path': rel(p), 'sha256': digest(p), 'bytes': p.stat().st_size}

def write(name, value):
    p = OUT / name
    if p.exists():
        raise RuntimeError(f'Append-only Phase 0 output already exists: {name}')
    p.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')

# Baseline existing owned/frozen evidence before any generated output is written.
preserved = [pin(p) for base in [OWNER, M1] for p in sorted(base.rglob('*'))
             if p.is_file() and OUT not in p.parents and p != OUT]

artifact = json.loads(ARTIFACT.read_text())
bundle = artifact['document']['liquidBundle']
historical_path = OWNER / 'installed-audit-9cd-2026-10-23/case-results.json'
historical = json.loads(historical_path.read_text())
matrix = OWNER / 'installed-fixture-preparation/LIFECYCLE_MATRIX.md'
handoff = json.loads((PROGRAMME / 'current-work-handoff.json').read_text())
state = json.loads((PROGRAMME / 'completion-2026-10-24/EXECUTION_STATE.json').read_text())

source_names = [
    'packages/theme-engine/src/playfield-theme.ts',
    'packages/theme-engine/src/playfield-theme-v201.ts',
    'packages/theme-engine/src/playfield-discovery.ts',
    'packages/theme-engine/src/playfield-styles.ts',
    'packages/theme-engine/src/niche-order-presentation.ts',
    'packages/theme-engine/src/first-party-theme-catalog.ts',
    'packages/commerce-core/src/playfield-facts.ts',
    'packages/commerce-core/src/niche-product-facts.ts',
    'apps/commerce/web/src/lib/theme-engine/data-binding-engine.ts',
    'apps/commerce/web/src/lib/theme-engine/variant-selection-url.ts',
    'apps/commerce/web/src/lib/theme-engine/liquid-hydration-islands.tsx',
    'apps/commerce/web/src/lib/theme-engine/variant-facts-controller.ts',
    'apps/commerce/web/src/lib/theme-engine/liquid-preview-inspector.ts',
    'apps/merchant/web/src/lib/api/request-origin.ts',
    'apps/merchant/web/src/components/theme-editor/SchemaFormRenderer.tsx',
    'apps/merchant/web/src/components/theme-editor/SectionTreePanel.tsx',
    'apps/merchant/web/src/components/theme-editor/BlockChildRow.tsx',
    'apps/merchant/web/src/components/theme-editor/TemplateSwitcherPanel.tsx',
    'apps/merchant/web/src/components/products/niche-facts/playfield-facts-editor.tsx',
    'apps/merchant/web/src/components/products/niche-facts/playfield-variant-facts-editor.tsx',
]
input_files = [ARTIFACT, historical_path, matrix,
               PROGRAMME / 'OWNERSHIP.md', PROGRAMME / 'capture-schedule.json',
               PROGRAMME / 'current-work-handoff.json',
               PROGRAMME / 'completion-2026-10-24/EXECUTION_STATE.json',
               PROGRAMME / 'completion-2026-10-24/EXECUTION_RUNBOOK.md',
               PROGRAMME / 'completion-2026-10-24/COMMON_EXECUTION_PROMPT.md',
               PROGRAMME / 'completion-2026-10-24/assignments/playfield.md',
               PROGRAMME / 'release-playfield201/catalog394-qualification/candidate-index.json',
               PROGRAMME / 'release-playfield201/catalog394-qualification/native-attempt01-interruption.json',
               OWNER / 'final-combined-source-2026-10-24/SOURCE_RELEASE.json',
               ROOT / 'docs/implementation/theme-editor-2026-10-23/evidence/stable936-kindred-finite-nonorder-boundary.json',
               ] + [ROOT / n for n in source_names]
missing_inputs = [rel(p) for p in input_files if not p.is_file()]
if missing_inputs:
    raise RuntimeError(f'Missing required inputs: {missing_inputs}')
inputs = [pin(p) for p in input_files]
input_by_path = {x['path']: x for x in inputs}

def ptr(*parts):
    return '/' + '/'.join(str(p).replace('~', '~0').replace('/', '~1') for p in parts)

def cases_for_field(field):
    typ = field['type']
    cases = ['valid_edit', 'save_acknowledged_revision', 'full_reload_reopen',
             'private_preview', 'publish_public_readback', 'safe_draft_recovery']
    if typ in ['text', 'textarea', 'richtext']:
        cases += ['clear_empty', 'long_English_Tamil_Hindi', 'escaped_markup', 'declared_length_boundary']
    elif typ in ['toggle', 'checkbox']:
        cases += ['true', 'false', 'absent_default']
    elif typ in ['range', 'number']:
        cases += ['declared_min_max_step', 'invalid_nonfinite_or_out_of_range', 'zero_if_schema_permits', 'clear_default']
    elif typ == 'select':
        cases += ['every_declared_option', 'invalid_option', 'clear_or_default']
    elif typ == 'color':
        cases += ['valid_color', 'invalid_color', 'clear_default', 'contrast_in_composed_page']
    elif typ == 'image':
        cases += ['owned_upload', 'library_select', 'replace', 'clear', 'unavailable_asset', 'actual_load_alt_crop_capability']
    elif typ in ['collection', 'product', 'page', 'blog', 'article']:
        cases += ['owned_resource_bind', 'replace', 'clear', 'deleted_unavailable_resource', 'foreign_resource_denial']
    elif typ == 'url':
        cases += ['relative_owned_url', 'approved_https_url', 'clear', 'unsafe_protocol_denial', 'unavailable_destination']
    if field.get('required'):
        cases += ['required_missing_denial']
    if field.get('visible_if'):
        cases += ['conditional_visible_hidden_value_preservation']
    return cases

operations = ['add_or_apply', 'edit', 'reorder', 'hide', 'show', 'save', 'full_reload',
              'private_preview', 'publish', 'public_readback', 'delete', 'save_reload_absence',
              'public_absence', 're_add', 'rebind', 'republish_readback', 'undo_redo_support_check',
              'conflict_recovery', 'lost_reply_recovery', 'unsaved_navigation_recovery']
sections = []
all_fields = []
block_defs = []
instances = []
templates = []
for name, definition in bundle['sections'].items():
    schema = definition['schema']
    source = definition['source'].split('{% schema %}')[0]
    section_id = 'section/' + name
    sections.append({'id': section_id, 'type': name, 'sourcePathInPackage': definition['path'],
                     'schemaPointer': ptr('document', 'liquidBundle', 'sections', name, 'schema'),
                     'sourceSha256': sha256(definition['source'].encode()).hexdigest(),
                     'schema': schema, 'editorBlockAttributesDeclared': 'block.editor_attributes' in source,
                     'allocation': 'PROTECTED_FROZEN_APP_EXTENSION_SEAM' if name == 'app-block-slot' else 'DECLARED_NOT_UI_VERIFIED'})
    for index, field in enumerate(schema['settings']):
        direct = ('section.settings.' + field['id']) in source
        binding = ('collection' if field['id'] == 'collectionId' and name in ['featured-products', 'product-grid'] else None)
        row = {'id': section_id + '/setting/' + field['id'], 'scope': 'section', 'sectionType': name,
               'fieldId': field['id'], 'descriptor': field,
               'pointer': ptr('document', 'liquidBundle', 'sections', name, 'schema', 'settings', index),
               'directLiquidReference': direct, 'runtimeDataBinding': binding,
               'requiredOperations': cases_for_field(field)}
        all_fields.append(row)
    for index, block in enumerate(schema['blocks']):
        bid = section_id + '/block/' + block['type']
        block_defs.append({'id': bid, 'sectionType': name, 'type': block['type'], 'schema': block,
                           'pointer': ptr('document', 'liquidBundle', 'sections', name, 'schema', 'blocks', index),
                           'nestedDefinitions': block.get('blocks', []),
                           'allocation': 'PROTECTED_FROZEN_APP_EXTENSION_SEAM' if block['type'] == '@app' else 'DECLARED_NOT_UI_VERIFIED'})
        for i, field in enumerate(block.get('settings', [])):
            all_fields.append({'id': bid + '/setting/' + field['id'], 'scope': 'section_block',
                               'sectionType': name, 'blockType': block['type'], 'fieldId': field['id'],
                               'descriptor': field,
                               'pointer': ptr('document', 'liquidBundle', 'sections', name, 'schema', 'blocks', index, 'settings', i),
                               'directLiquidReference': ('block.settings.' + field['id']) in source,
                               'requiredOperations': cases_for_field(field)})

for name, template in bundle['templates'].items():
    templates.append({'id': 'template/' + name, 'name': name, 'label': template['name'],
                      'layout': template['layout'], 'order': template['order'],
                      'role': 'shared_group_template' if name in ['header', 'footer'] else 'route_template',
                      'pointer': ptr('document', 'liquidBundle', 'templates', name)})
    for sid, instance in template['sections'].items():
        instances.append({'id': 'template/' + name + '/instance/' + sid,
                          'template': name, 'sectionInstanceId': sid, 'sectionType': instance['type'],
                          'orderIndex': template['order'].index(sid), 'initial': instance,
                          'settingDeclarationIds': [f['id'] for f in all_fields if f['scope'] == 'section' and f['sectionType'] == instance['type']],
                          'pointer': ptr('document', 'liquidBundle', 'templates', name, 'sections', sid)})

for group, data in bundle['config']['settings_schema']['settings'].items():
    for name, field in data['fields'].items():
        all_fields.append({'id': 'global/' + group + '/' + name, 'scope': 'theme', 'group': group,
                           'fieldId': name, 'descriptor': field,
                           'current': bundle['config']['settings_data']['current'].get(name),
                           'pointer': ptr('document', 'liquidBundle', 'config', 'settings_schema', 'settings', group, 'fields', name),
                           'requiredOperations': cases_for_field(field)})

standalone_blocks = []
for name, block in bundle['blocks'].items():
    standalone_blocks.append({'id': 'package_block/' + name, 'type': name, 'schema': block['schema'],
                              'path': block['path'], 'reachableSectionTypes': [s['type'] for s in block_defs if s['type'] == name],
                              'reachabilityStatus': 'NOT_PROVEN_BY_DECLARED_SECTION_BLOCK_TYPES',
                              'pointer': ptr('document', 'liquidBundle', 'blocks', name)})
    for i, field in enumerate(block['schema'].get('settings', [])):
        all_fields.append({'id': 'package_block/' + name + '/setting/' + field['id'],
                           'scope': 'package_block', 'blockType': name, 'fieldId': field['id'], 'descriptor': field,
                           'pointer': ptr('document', 'liquidBundle', 'blocks', name, 'schema', 'settings', i),
                           'requiredOperations': cases_for_field(field)})

facts_fields = [
    ('schemaVersion', 'literal', {'value': 1, 'merchantEditable': False}),
    ('ageBands', 'enum_array', {'values': ['3-5', '6-8', '9-12'], 'maxItems': 3, 'unique': True}),
    ('ageStatement', 'text', {'maxLength': 200}),
    ('interests', 'identifier_array', {'maxItems': 12, 'itemMaxLength': 40, 'pattern': '^[a-z][a-z0-9-]*$', 'unique': True}),
    ('productType', 'identifier', {'maxLength': 40, 'pattern': '^[a-z][a-z0-9-]*$'}),
    ('contents', 'object_array', {'maxItems': 30, 'children': {'label': {'required': True, 'minLength': 1, 'maxLength': 120}, 'quantity': {'integer': True, 'minExclusive': 0, 'max': 10000}}}),
    ('contentsComplete', 'boolean', {'completeRequiresNonemptyContents': True}),
    ('dimensions', 'nullable_object', {'unit': ['cm', 'mm'], 'children': ['label', 'length', 'width', 'height', 'unit'], 'labelMaxLength': 160, 'atLeastOneMeasuredAxis': True, 'axisMinExclusive': 0, 'axisMax': 10000}),
    ('additionalDimensions', 'object_array', {'maxItems': 20, 'children': ['label', 'length', 'width', 'height', 'unit'], 'labelRequired': True, 'labelMaxLength': 160, 'unit': ['cm', 'mm'], 'atLeastOneMeasuredAxis': True, 'axisMinExclusive': 0, 'axisMax': 10000}),
    ('materials', 'text', {'maxLength': 2000}), ('finish', 'text', {'maxLength': 1000}), ('care', 'text', {'maxLength': 2000}),
    ('warnings', 'object_array', {'maxItems': 20, 'children': {'text': {'minLength': 1, 'maxLength': 2000}, 'sourceLabel': {'minLength': 1, 'maxLength': 120}, 'editionLabel': {'maxLength': 120, 'optional': True}}}),
]
facts = [{'id': 'catalog/toys/' + key, 'key': key, 'type': typ, 'constraints': constraints,
          'authority': 'ToyFactsSchema / ToyVariantFactsSchema in packages/commerce-core/src/playfield-facts.ts',
          'commonOwner': 'PlayfieldFactsEditor', 'editionOwner': 'PlayfieldVariantFactsEditor',
          'variantIdentity': 'actual durable UUID owned by canonical enclosing variant command',
          'requiredOperations': ['edit_common', 'edit_selected_edition', 'save_readback_reopen', 'valid_invalid_limits',
                                 'inherit_omit', 'explicit_clear_if_schema_permits', 'false_zero_unknown_distinction',
                                 'preserve_sibling_UUIDs_and_untouched_stock', 'selected_PDP_cart_order_readback']}
         for key, typ, constraints in facts_fields]

bindings = [{'id': f['id'], 'type': f['descriptor']['type'], 'descriptor': f['descriptor'], 'sourcePointer': f['pointer']}
            for f in all_fields if f['descriptor']['type'] in ['image', 'url', 'product', 'collection', 'page', 'blog', 'article', 'video']]
context_resources = [{'id': 'route_context/' + n, 'template': n, 'identityAuthority': authority,
                      'requiredStates': ['owned', 'missing', 'unavailable', 'wrong_scope', 'correct_editor_preview_context']}
                     for n, authority in [('product', 'canonical product/variant UUID'), ('collection', 'canonical collection UUID'),
                                          ('page', 'canonical page identifier'), ('blog', 'canonical blog identifier'),
                                          ('article', 'canonical article identifier'), ('policy', 'canonical policy'),
                                          ('customers/order', 'own canonical order UUID')]]
interactions = [
    {'id': 'buyer/discovery', 'queryKeys': ['age_band', 'interest', 'search', 'sort', 'page'],
     'source': 'packages/theme-engine/src/playfield-discovery.ts', 'authority': 'validated canonical collection capabilities and facets',
     'states': ['both_choosers', 'age_only', 'interest_only', 'no_supported_chooser_search_fallback', 'selected_facet_absent_retained', 'true_empty', 'pagination', 'independent_clear', 'repeated_unrelated_query_preserved']},
    {'id': 'buyer/toy_cards', 'source': 'packages/theme-engine/src/playfield-theme.ts',
     'states': ['merchant_age_label', 'explicit_age_unknown', 'complete_partial_unknown_contents', 'empty_media', 'variant_chooser_link', 'OOS', 'server_price']},
    {'id': 'buyer/edition_facts', 'source': 'packages/theme-engine/src/playfield-theme-v201.ts',
     'states': ['unselected', 'inherited', 'explicit_unknown', 'paper', 'warning_provenance', 'showToyFacts_false', 'multiple_same_product_pickers', 'disconnect_reconnect', 'exact_variant_URL_reload_back_forward']},
    {'id': 'buyer/cart_checkout_history', 'authority': 'canonical server cart, hosted checkout, order snapshot and ledger',
     'states': ['two_distinct_editions', 'reload', 'OOS', 'uncertain_reply', 'COD', 'Razorpay_TEST', 'stale_CART_FACTS_CHANGED', 'immutable_old_new_orders']},
    {'id': 'buyer/no_child_profile', 'authority': 'merchant supplied recommendations for adult shoppers',
     'states': ['no_child_name_age_birthday_collection', 'unknown_warning_never_safety_claim']},
]

inventory = {
    'schemaVersion': 1, 'recordedAt': now, 'classification': 'SOURCE_DERIVED_PHASE0_EVIDENCE_NOT_AUTHORITY_OR_EXECUTION',
    'theme': 'Playfield', 'preset': 'bloom', 'targetVersion': '2.0.1', 'artifact': pin(ARTIFACT),
    'artifactStatus': 'RETAINED_PRIVATE_PROPOSAL; catalog394 first native attempt unqualified; no current installation/readiness claimed',
    'canonicalBundleSha256': artifact['bundleSha256'], 'payloadSha256': artifact['payloadSha256'],
    'runtimeIdentity': None, 'currentBrowserFixtureLease': None,
    'templates': templates, 'sectionDefinitions': sections, 'sectionInstances': instances,
    'blockDefinitions': block_defs, 'standalonePackageBlocks': standalone_blocks,
    'fieldDeclarations': all_fields, 'mediaAndResourceBindings': bindings, 'routeContextResources': context_resources,
    'catalogueFactControls': facts, 'advertisedInteractions': interactions,
    'settingPresets': [{'name': n, 'values': values, 'status': 'DECLARED_SHARED_PRESET_NOT_APPLIED'} for n, values in bundle['config']['settings_data']['presets'].items()],
    'layout': {n: {'path': v['path'], 'sourceSha256': sha256(v['source'].encode()).hexdigest()} for n, v in bundle['layout'].items()},
    'assetManifest': bundle['renderer']['assets'], 'performanceBudget': artifact['persistence']['rendererManifest']['performance_budget'],
    'limits': ['No product factory, export generator, browser, build, DB or network operation executed.',
               'Descriptor presence does not prove editor reachability or runtime implementation.',
               'No recursively nested block definition or preseeded block instance is declared in this artifact; test real supported nested context if admitted without inventing a theme type.',
               '@app remains a frozen protected seam under Constitution; inventory presence does not authorize third-party execution.',
               'Media alt and crop tested only where actually declared/exposed; missing promised control remains open.',
               'No performance budget is declared in this proposal; current approved shared budgets must be bound before claiming quality acceptance.'],
}
inventory['counts'] = {
    'templatesIncludingSharedGroups': len(templates), 'routeTemplates': sum(t['role'] == 'route_template' for t in templates),
    'sharedGroupTemplates': 2, 'sectionTypes': len(sections), 'sectionInstances': len(instances),
    'sectionBlockTypes': len(block_defs), 'standalonePackageBlockTypes': len(standalone_blocks),
    'fieldDeclarations': len(all_fields), 'fieldScopes': dict(Counter(f['scope'] for f in all_fields)),
    'mediaResourceFieldDeclarations': len(bindings), 'catalogueFactFields': len(facts),
    'preseededBlockInstances': sum(len(s['initial']['blocks']) for s in instances),
    'nestedBlockDefinitions': sum(len(b['nestedDefinitions']) for b in block_defs),
}

# Case groups are obligations, not reported test passes. Every new operation is NOT_RUN.
coverage = []
def add(cid, requirement, caps, ops, expected, dependencies=None, applicability='REQUIRED'):
    coverage.append({'id': cid, 'requirement': requirement, 'capabilityIds': caps,
                     'applicability': applicability, 'status': 'NOT_RUN', 'reviewStatus': 'PENDING',
                     'operations': [{'id': op, 'status': 'NOT_RUN'} for op in ops],
                     'expectedEvidence': expected, 'dependencies': dependencies or ['CURRENT_QUALIFIED_RUNTIME', 'EXPLICIT_EDITOR_ALLOCATION'],
                     'runtime': None, 'actorRealmSite': None, 'actualBindings': None, 'observations': [],
                     'effects': None, 'evidence': [], 'controller': None, 'reviewer': None})

original_rows = {}
for line in matrix.read_text().splitlines():
    if re.match(r'\| PF-I\d\d \|', line):
        parts = line.split(' | ')
        original_rows[parts[0].strip('| ')] = (parts[1], parts[2])
for old in historical['cases']:
    req, expected = original_rows[old['id']]
    add(old['id'], req, ['original_matrix/' + old['id']], ['execute_entire_original_case', 'independent_review'], expected,
        ['CATALOG394_NATIVE_QUALIFICATION', 'CURRENT_QUALIFIED_RUNTIME', 'EXPLICIT_EDITOR_ALLOCATION'])
    coverage[-1]['historicalEvidence'] = {'runId': historical['runId'], 'source': pin(historical_path),
                                         'fullCaseStatus': old['fullCaseStatus'], 'executionDetail': old['executionDetail'],
                                         'observation': old['controllerObservation'], 'qualification': old.get('auditQualification'),
                                         'files': old['evidence'], 'reuse': 'Retain original disposition only; not current 2.0.1 installed credit.'}

for t in templates:
    add('PF-T-' + t['name'].replace('/', '.'), 'Correct template/resource context and shared groups', [t['id']],
        ['open_correct_template_resource', 'private_preview', 'public_or_supported_private_route', 'missing_resource_recovery'],
        'Actual resource context and section order match declared template; customer/private pages enforce scope.')
for s in instances:
    add('PF-E-' + s['template'].replace('/', '.') + '-' + s['sectionInstanceId'],
        'Preserve and exercise exact shipped section instance in sacrificial draft', [s['id']], operations,
        'Exact section identity/type/settings/order/visibility and revision read back; public absence and re-add verified; user draft untouched.')
    for field in [f for f in all_fields if f['scope'] == 'section' and f['sectionType'] == s['sectionType']]:
        add('PF-V-' + s['template'].replace('/', '.') + '-' + s['sectionInstanceId'] + '-' + field['fieldId'],
            'Every shipped instance control reaches persisted and rendered output', [s['id'], field['id']], field['requiredOperations'],
            'Record exact accepted field value/revision and UI/API/readback/preview/public result; validation preserves safe draft.')
for s in sections:
    protected = s['type'] == 'app-block-slot'
    add('PF-A-' + s['type'], 'Addable declared section and every declared field', [s['id']],
        ['inspect_protected_seam_denial'] if protected else operations,
        'Preserve frozen extension boundary; no app execution.' if protected else 'Normal Add/apply and lifecycle on an admitted suitable sacrificial template; all declared settings connected.',
        applicability='REQUIRED_PROTECTION_CHECK' if protected else 'REQUIRED')
    if protected:
        coverage[-1]['capabilityIds'] += [f['id'] for f in all_fields if f['scope'] == 'section' and f['sectionType'] == s['type']]
        coverage[-1]['operations'].append({'id': 'preserve_declared_title_slot_without_extension_activation', 'status': 'NOT_RUN'})
    if not protected:
        for field in [f for f in all_fields if f['scope'] == 'section' and f['sectionType'] == s['type']]:
            add('PF-F-' + s['type'] + '-' + field['fieldId'], 'Declared section field in add/apply path', [s['id'], field['id']], field['requiredOperations'],
                'Exact field semantics/defaults/limits and output in actual added section. Existing instance proof may be linked with explicit matching inputs.')
for b in block_defs:
    protected = b['type'] == '@app'
    add('PF-B-' + b['sectionType'] + '-' + b['type'].replace('@', ''), 'Declared nested section-block lifecycle', [b['id']],
        ['inspect_protected_seam_denial'] if protected else operations + ['exact_preview_block_selection', 'stale_forged_ancestry_denial'],
        'No app activation.' if protected else 'Actual durable block identity, order/visibility/settings, delete/re-add and preview identity remain correctly scoped.',
        applicability='REQUIRED_PROTECTION_CHECK' if protected else 'REQUIRED')
for f in all_fields:
    if f['scope'] in ['section_block', 'theme', 'package_block']:
        add('PF-F-' + f['id'].replace('/', '.'), 'Declared field/control connected to authority', [f['id']], f['requiredOperations'],
            'Accepted exact field value and schema validation/persistence/rendering; any unreachable control remains an open gap.')
for b in standalone_blocks:
    add('PF-B-standalone-' + b['type'], 'Resolve standalone package block reachability without inventing a control', [b['id']],
        ['verify_supported_add_path', 'exact_identity_and_field_binding', 'lifecycle_if_exposed'],
        'Prove supported badge attachment or obtain an exact scoped owner correction; no blanket N/A.')
for name in bundle['config']['settings_data']['presets']:
    add('PF-PRESET-' + name, 'Declared shared settings preset application in sacrificial draft', ['settings_preset/' + name],
        ['inspect_supported_apply', 'apply_save_reload_preview', 'recover_Playfield_prior_document'],
        'Preset values are data, application/recovery acknowledged; frozen Playfield production design unaffected.')
for f in facts:
    ops = ['protected_schema_version_unchanged'] if f['key'] == 'schemaVersion' else f['requiredOperations']
    add('PF-C-' + f['key'], 'Canonical common/edition toy fact control and validation', [f['id']], ops,
        'Exact UUID/versioned canonical mutation/readback, omission versus explicit clear, buyer selected output and immutable order snapshot.',
        applicability='REQUIRED_PROTECTION_CHECK' if f['key'] == 'schemaVersion' else 'REQUIRED')

expanded = [
 ('EDITOR-AB', 'Seven-check A/B save, reload, preview, publish, restore A with retained B draft, reapply B', ['editor'], ['A_save_reload', 'A_preview_publish_public', 'B_save_reload_publish_public', 'restore_A', 'retain_B_draft', 'reapply_B', 'full_reload_readback']),
 ('EDITOR-INSPECT', 'Exact section AND block selection; forged/stale preview messages; correct resource/template context', ['editor'], ['section_select', 'block_select', 'wrong_window_origin_session_revision_denial', 'no_public_inspector_leak']),
 ('EDITOR-RECOVERY', 'Duplicate save, stale revision, unknown save reply, reauthentication and unsaved navigation preserve draft', ['editor'], ['duplicate', 'conflict', 'lost_ack_original_intent', 'reauth', 'navigation_guard', 'undo_redo_supported_contract']),
 ('MEDIA', 'Owned image upload/library, replace/clear, alt/crop where declared, real fonts and unavailable recovery', ['media'], ['upload', 'library_bind', 'replace', 'clear', 'actual_load', 'alt', 'crop_capability', 'font_load', 'unavailable']),
 ('RESOURCES', 'All collection/product/page/blog/article/menu/resource contexts stay owned and recover missing references', ['resource'], ['bind_replace_clear', 'resource_deleted', 'foreign_denial', 'full_reload_preview_public']),
 ('IDENTITY-NEW', 'New normal synthetic LetBuyy buyer signup, local verification, signin, consent/callback to intended store', ['identity'], ['signup', 'verification', 'signin', 'consent', 'callback', 'reload']),
 ('IDENTITY-STORE', 'Supported storefront customer entry, profile, addresses, logout, signin and recovery', ['identity'], ['store_entry', 'profile', 'address_create_edit_delete', 'logout', 'signin', 'session_recovery']),
 ('IDENTITY-DENIAL', 'Wrong-store/state/PKCE/code replay/expiry/cross-buyer/cross-store/realm denial positive-control first', ['identity'], ['positive_control', 'wrong_store', 'state', 'PKCE', 'code_replay', 'expired', 'cross_buyer_order', 'cross_store', 'buyer_merchant_realm']),
 ('DISCOVERY-COHORT', 'Adult finder capability branches and genuine query-result cohort on both collection/search', ['buyer/discovery'], ['both_choosers', 'age_only', 'interest_only', 'fallback', 'query_apply_reload', 'independent_clear', 'empty_recovery', 'past_end', 'repeated_unrelated_parameters', 'canonical_UI_agreement']),
 ('EDITION-URL', 'Selected actual UUID initial URL/reload/back/forward; invalid/foreign/duplicate query and disconnect/reconnect', ['buyer/edition_facts'], ['initial', 'reload', 'back_forward', 'invalid_foreign_duplicate', 'multiple_owner', 'disconnect_reconnect', 'OOS']),
 ('CART-LIFECYCLE', 'Canonical add/edit/remove/re-add/reload two-edition cart and current server totals', ['buyer/cart_checkout_history'], ['add', 'quantity', 'remove', 're_add', 'reload', 'two_editions', 'server_price_tax_discount']),
 ('CART-UNCERTAIN', 'Unknown cart acknowledgement blocks unsafe checkout and reconciles original intent without duplicate effects', ['buyer/cart_checkout_history'], ['lost_reply', 'blocked_checkout', 'canonical_read', 'same_intent_retry', 'exact_effects']),
 ('CHECKOUT-QUOTE', 'Address validation/serviceability/allowed shipping/tax/discount and changed totals', ['checkout'], ['address', 'serviceability', 'shipping', 'tax', 'discount', 'invalid_expired', 'changed_price_stock', 'reload_reentry']),
 ('CHECKOUT-COD', 'Normal hosted COD complete with original key idempotency and actual effect counts', ['checkout'], ['normal_COD', 'lost_ack_same_key', 'order_inventory_ledger_outbox_readbacks', 'buyer_merchant_views']),
 ('RAZORPAY-THEME', 'Actual Playfield Razorpay TEST browser purchase and real provider verification/webhook/local state', ['payment'], ['verify_TEST_mode_securely', 'browser_purchase', 'provider_order_payment_linkage', 'server_signature_verify', 'actual_provider_webhook_delivery', 'local_ledger_balanced', 'buyer_merchant_views']),
 ('RAZORPAY-SHARED', 'Reference exact-input shared adversarial PSP cohort once; never count mock or other-theme purchase as own success', ['payment'], ['decline_cancel_retry', 'invalid_signature_binding_amount_currency_tenant', 'duplicate_out_of_order_webhook', 'verify_webhook_race', 'PSP_success_local_failure_reconcile']),
 ('HISTORY-EDIT', 'Same UUID title/options/price/media/facts edits omit untouched stock after actual orders; old snapshots immutable', ['history'], ['capture_old_order_and_stock', 'edit_same_UUID', 'omit_stock', 'new_order', 'buyer_merchant_old_new_compare', 'archive_current_catalog', 'history_reload']),
 ('HISTORY-MISSING', 'Supported genuinely missing/malformed historical snapshots show explicit unavailable facts', ['history'], ['admit_genuine_historical_control', 'missing', 'malformed', 'no_live_catalog_fallback']),
 ('CANCEL-REFUND', 'Required canonical synthetic/test cancellation/refund/reversal and reconciliation with exactly one effect', ['history', 'payment'], ['admit_scoped_test_control', 'cancel', 'refund_or_reversal_supported', 'idempotency', 'ledger_reconciliation']),
 ('QUALITY-RESPONSIVE', 'Actual measured content widths and text/locale/font/image/error states', ['quality'], ['320', '390', '768', '834', '1440', '200_percent_text', 'long_English_Tamil_Hindi', 'no_overflow', 'missing_image', 'light_dark_supported_contract']),
 ('QUALITY-ACCESS', 'Keyboard, semantics, focus/return, validation announcements, reduced motion on composed tasks', ['quality'], ['keyboard', 'focus', 'names_roles', 'validation_announcement', 'screen_reader_available_scope', 'reduced_motion', 'contrast']),
 ('QUALITY-PERF', 'Approved budgets and useful readiness/interaction latency under recorded workload', ['quality'], ['bind_existing_budget', 'define_workload_device_network', 'record_samples_percentiles_requests_bytes', 'measure_readiness_interactions']),
 ('SECURITY', 'Exact-input Liquid/XSS/privacy/sandbox and tenant/auth financial relevant shared gates', ['security'], ['sandbox_escape', 'stored_XSS', 'private_metadata', 'tenant_positive_first_denial', 'source_runtime_lineage', 'money_property_concurrency_reconcile']),
 ('PRESERVATION', 'Frozen source/M1/accepted/archive bytes and owned resources conserved', ['preservation'], ['before_manifest', 'after_manifest', 'user_state_conservation', 'owned_cleanup_receipt']),
]
for key, req, caps, ops in expanded:
    deps = ['CURRENT_QUALIFIED_RUNTIME', 'EXPLICIT_EDITOR_ALLOCATION']
    if key.startswith('RAZORPAY'):
        deps += ['AUTHORIZED_TEST_ACCOUNT_AND_SECRET', 'OWNED_ACCEPTED_PUBLIC_HTTPS_WEBHOOK', 'QUALIFIED_SHARED_PROVIDER_COHORT']
    add('PF-X-' + key, req, caps, ops,
        'Sanitized actual UI/HTTP/DB/provider observations, exact hashes/IDs/versions and before/after effects; independent accepted review.', deps)

for row in coverage:
    row['sourceArtifact'] = {'path': rel(ARTIFACT), 'sha256': digest(ARTIFACT), 'version': '2.0.1'}
    row['nextAction'] = 'Bind to a current admitted artifact and exact finite owner/controller lease before execution.'
coverage_record = {'schemaVersion': 1, 'recordedAt': now, 'classification': 'REQUIRED_OBLIGATIONS_NOT_EXECUTION_COUNTS',
                   'targetTheme': 'Playfield 2.0.1', 'runtimeIdentity': None,
                   'currentOriginal14': {s: sum(r['status'] == s for r in coverage[:14]) for s in ['PASS', 'FAIL', 'NOT_RUN']},
                   'retainedHistoricalOriginal14': {'runId': historical['runId'], 'wholeCaseCounts': historical['counts'], 'executionDetails': historical['executionDetailCounts']},
                   'cases': coverage, 'requiredCaseGroups': len(coverage),
                   'requiredOperationRows': sum(len(x['operations']) for x in coverage),
                   'totalsRule': 'These are enumerated obligations, not distinct executed tests. Overlapping historical/source suites are not summed.',
                   'certification': {'LOCAL_E2E_VERIFIED': False, 'RAZORPAY_TEST_VERIFIED': False, 'REVIEW_ACCEPTED': False, 'FULL_THEME_CERTIFIED': False, 'PRODUCTION_DEPLOYED': 'NOT_REQUESTED'}}

write('PRESERVATION_BEFORE.json', {'recordedAt': now, 'scope': 'All existing Playfield implementation evidence and original M1 storybook files; no shared source claimed mutable', 'files': preserved})
write('SOURCE_PINS.json', {'recordedAt': now, 'classification': 'READ_INPUTS_NOT_RUNTIME_ADMISSION', 'files': inputs})
write('CAPABILITY_INVENTORY.json', inventory)
write('COVERAGE.json', coverage_record)
write('HANDOFF_OBSERVATION.json', {
    'recordedAt': now, 'currentHandoffRecordedAt': handoff['recordedAt'],
    'completionPhase': state['programmePhase'], 'helperActivation': state['helperActivation'],
    'activeBrowserLease': state['activeBrowserLease'], 'activeSharedWriter': state['activeSharedWriter'],
    'PlayfieldProposedQueue': 10, 'queueIsReservationOnly': True,
    'legacy936SafeCutoffUtc': handoff['runtimeLifecycle']['safeWorkingCutoffUtc'],
    'currentPlayfieldRuntimeHandoff': 'ABSENT', 'original14CurrentStatus': 'NOT_RUN',
    'old9cdResultsRetained': True, 'noRuntimeBrowserDatabaseBuildOrNetworkStarted': True,
    'noCrossChatMessageSent': True, 'automationNotReactivated': True,
})
print(json.dumps({'counts': inventory['counts'], 'coverageGroups': len(coverage), 'operationObligations': coverage_record['requiredOperationRows'], 'preservedFiles': len(preserved)}))
