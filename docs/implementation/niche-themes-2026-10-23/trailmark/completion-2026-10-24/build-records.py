"""Build finite source inventories and NOT_RUN cases; never execute application work."""
from pathlib import Path
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
import re
import subprocess

ROOT = Path(__file__).resolve().parents[5]
OUT = Path(__file__).resolve().parent
OLD = OUT.parent / 'installed-lifecycle'
B = json.loads(Path('/private/tmp/trailmark-source-bundle-20261024.json').read_text())
SCHEMA = json.loads(Path('/private/tmp/trailmark-source-schema-20261024.json').read_text())
AUDIT = json.loads((OLD / 'non-order-independent-audit-2026-10-24.json').read_text())
PLAN = json.loads((OLD / 'installed-trailmark-fixture.plan.json').read_text())
NOW = datetime.now(timezone.utc).isoformat()
HEAD = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
BRANCH = subprocess.check_output(['git', 'branch', '--show-current'], cwd=ROOT, text=True).strip()
def digest(data):
    return hashlib.sha256(data).hexdigest()
def compact(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()
def rel(path):
    return str(path.relative_to(ROOT))
def ref(path):
    p = ROOT / path if not isinstance(path, Path) else path
    return {'path': rel(p), 'sha256': digest(p.read_bytes())}
def save(name, data):
    (OUT / name).write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n')

# A local relative-import closure of the two pure factories; no generated output is authority.
visited = set()
def visit(p):
    p = p.resolve()
    if p in visited or not p.is_file():
        return
    visited.add(p)
    for spec in re.findall(r'(?:from\s*|import\s*)[\'\"](\.[^\'\"]+)[\'\"]', p.read_text()):
        target = p.parent / spec
        candidates = [target, Path(str(target) + '.ts'), Path(str(target) + '.tsx'), target / 'index.ts']
        for candidate in candidates:
            if candidate.is_file():
                visit(candidate)
                break
for source in ['packages/theme-engine/src/trailmark-theme.ts', 'packages/theme-engine/src/theme-bundle-core.ts']:
    visit(ROOT / source)
factory_closure = [ref(p) for p in sorted(visited)]
supporting = [
    'packages/theme-engine/src/theme-document.ts',
    'packages/theme-engine/src/theme-renderer.ts',
    'packages/commerce-core/src/trailmark-facts.ts',
    'packages/commerce-core/src/product-fact-snapshot.ts',
    'apps/merchant/web/src/components/products/niche-facts/trailmark-facts-editor.tsx',
    'apps/merchant/web/src/components/products/niche-facts/trailmark-variant-facts-editor.tsx',
    'apps/merchant/web/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx',
    'apps/merchant/web/src/components/theme-editor/SchemaFormRenderer.tsx',
    'apps/merchant/web/src/components/theme-editor/SectionTreePanel.tsx',
    'apps/merchant/web/src/components/theme-editor/BlockChildRow.tsx',
    'apps/merchant/web/src/components/theme-editor/TemplateSwitcherPanel.tsx',
    'apps/merchant/web/src/lib/theme-schemas.ts',
    'apps/commerce/web/src/lib/theme-engine/storefront-discovery.ts',
    'apps/commerce/web/src/lib/theme-engine/data-binding-engine.ts',
    'apps/commerce/web/src/lib/demo/trailmark-demo.ts',
    'packages/theme-engine/test/trailmark.test.ts',
    'pnpm-lock.yaml',
]
snapshot = {
    'schemaVersion': 1, 'classification': 'READ_ONLY_SOURCE_SNAPSHOT_NOT_RELEASE_OR_RUNTIME_ADMISSION',
    'recordedAt': NOW, 'head': HEAD, 'branch': BRANCH,
    'factoryImportClosure': factory_closure,
    'factoryClosureDigest': digest(compact(factory_closure)),
    'supportingInputs': [ref(s) for s in supporting],
    'sourceBundleCanonicalSha256': digest(compact(B)),
    'sourceSchemaCanonicalSha256': digest(compact(SCHEMA)),
    'releaseId': None, 'buildId': None, 'runtimeRunId': None,
    'acceptedAsInstalled': False,
    'extraction': {
        'kind': 'Pure versioned factory plus existing canonical persistence-schema adapter',
        'command': 'node --import tsx docs/implementation/niche-themes-2026-10-23/trailmark/completion-2026-10-24/extract-source.mts',
        'initialAttempt': {'command': 'node_modules/.bin/tsx /private/tmp/trailmark-source-inventory-20261024.ts', 'exitCode': 1, 'error': 'EPERM creating tsx CLI IPC pipe; application code did not execute'},
        'successfulMethod': 'Node tsx import hook; no IPC listener, app build, renderer, server, DB, browser or fixture',
        'nodeVersionObserved': 'v22.23.3',
    },
    'limits': ['Pure source-derived bundle only; actual installed schemas may differ.', 'No current source/release/runtime binding or execution grant.', 'Dirty shared checkout HEAD alone does not identify all working-tree inputs.'],
}
save('SOURCE_SNAPSHOT.json', snapshot)

form_path = ROOT / 'apps/merchant/web/src/components/theme-editor/SchemaFormRenderer.tsx'
form_types = sorted(set(re.findall(r"case '([^']+)'", form_path.read_text())))
types = []
blocks = []
bindings = []
for typ, section in B['sections'].items():
    schema = section['schema']
    fields = []
    for f in schema['settings']:
        item = {**f, 'rendererControlDeclared': f['type'] in form_types,
                'sourceMentionsSetting': bool(re.search(r'section\.settings\.' + re.escape(f['id']) + r'\b', section['source']))}
        fields.append(item)
        if f['type'] in ['image', 'url', 'product', 'collection', 'video', 'video_url', 'menu', 'page', 'blog']:
            bindings.append({'sectionType': typ, 'blockType': None, 'field': f['id'], 'kind': f['type'], 'installedStatus': 'NOT_RUN'})
    declarations = []
    for block in schema['blocks']:
        resolved = SCHEMA['section_schemas'][typ]['blocks_schema'][block['type']]
        row = {'sectionType': typ, 'blockType': block['type'], 'declaration': block,
               'resolvedEditorSchema': resolved, 'protectedSeam': block['type'] == '@app',
               'declaredChildTypes': B['blocks'].get(block['type'], {}).get('schema', {}).get('allowed_child_types'),
               'defaultInstances': [], 'runtimeStatus': 'NOT_RUN'}
        blocks.append(row)
        declarations.append(block['type'])
        for field, descriptor in resolved['fields'].items():
            if descriptor['type'] in ['image', 'url', 'product', 'collection', 'video', 'video_url', 'menu', 'page', 'blog']:
                bindings.append({'sectionType': typ, 'blockType': block['type'], 'field': field, 'kind': descriptor['type'], 'installedStatus': 'NOT_RUN'})
    types.append({'sectionType': typ, 'name': schema['name'], 'sourcePath': section['path'],
                  'sourceSha256': digest(section['source'].encode()), 'schema': schema,
                  'settings': fields, 'declaredBlockTypes': declarations,
                  'defaultInstances': [{'template': t, 'sectionId': sid} for t, template in B['templates'].items() for sid, s in template['sections'].items() if s['type'] == typ],
                  'addabilityObservedInInstalledEditor': 'NOT_RUN',
                  'protectedSeam': typ == 'app-block-slot'})

templates = []
for key, template in B['templates'].items():
    templates.append({'template': key, 'name': template['name'], 'layout': template['layout'],
                      'sharedGroup': key in ['header', 'footer'], 'order': template['order'],
                      'sections': [{'sectionId': sid, **s} for sid, s in template['sections'].items()],
                      'runtimeStatus': 'NOT_RUN'})

globals_ = [{'group': g, 'field': key, 'descriptor': f, 'factoryCurrent': B['config']['settings_data']['current'].get(key),
             'rendererControlDeclared': f['type'] in form_types, 'runtimeStatus': 'NOT_RUN'}
            for g, group in B['config']['settings_schema']['settings'].items() for key, f in group['fields'].items()]
design_root = ROOT / 'docs/research/shopify-product-intelligence/free-themes-niche-study-2026-10-22/visuals/trailmark-storybook'
promises = json.loads((design_root / 'capabilities.json').read_text())['features']

measure_fields = ['length.value', 'length.unit', 'weight.value', 'weight.unit', 'gripCircumference.value', 'gripCircumference.unit', 'dimensions.length', 'dimensions.width', 'dimensions.height', 'dimensions.unit']
common_fields = ['activity', 'equipmentType', *measure_fields, 'material', 'contents[]', 'conditions', 'care', 'compatibility.status', 'compatibility.reference', 'compatibility.note']
niche = {
    'canonicalOwner': 'packages/commerce-core/src/trailmark-facts.ts; existing product/variant editors and atomic catalogue commands',
    'commonFields': common_fields, 'variantFields': measure_fields,
    'protectedFields': ['version=1', 'enclosing product UUID', 'enclosing variant UUID', 'server-authoritative stock and price'],
    'distanceUnits': ['mm', 'cm', 'm', 'in'], 'massUnits': ['g', 'kg'],
    'equipmentTypes': ['racket', 'shuttles', 'storage', 'recreational-accessory'],
    'compatibilityStates': ['unconfirmed', 'merchant-supplied with nonempty reference'],
    'rules': ['Value and unit form one atomic fact.', 'Absent variant override inherits the entire common measurement.', 'Variant dimensions replace the entire group; absent height stays absent.', 'Clearing last override removes namespace; no empty override object.', 'No garment-size conversion, invented compatibility or safety certification.', 'Non-inventory edits omit untouched stock and preserve actual UUIDs.'],
}
inventory = {
    'schemaVersion': 1, 'theme': 'Trailmark', 'preset': 'ride', 'recordedAt': NOW,
    'classification': 'COMPLETE_SOURCE_DECLARATION_INVENTORY_NOT_INSTALLED_CAPABILITY_CERTIFICATION',
    'mandateVerified': {'requestingThreadId': '01a16ce5-e5ba-7191-ab2c-a1b76947d2b5', 'humanTurnId': '01a16cf8-99f0-7f51-852c-d0fd6ea08262', 'scope': '24 October ten-theme completion; immediate own evidence/private proposals only'},
    'sourceSnapshot': ref(OUT / 'SOURCE_SNAPSHOT.json'),
    'package': B['package'], 'schemaVersionDeclared': B['schema_version'], 'renderer': B['renderer'],
    'counts': {'templates': len(templates), 'sectionTypes': len(types), 'defaultSectionInstances': sum(len(t['sections']) for t in templates),
               'sectionSettingDeclarations': sum(len(s['settings']) for s in types), 'inlineBlockDeclarations': len(blocks),
               'contentBlockDeclarations': sum(not b['protectedSeam'] for b in blocks), 'protectedAppBlockDeclarations': sum(b['protectedSeam'] for b in blocks),
               'defaultBlockInstances': 0, 'reusableBlockDefinitions': len(B['blocks']), 'globalSettings': len(globals_), 'settingsPresets': len(B['config']['settings_data']['presets']), 'mediaAndResourceBindings': len(bindings)},
    'templates': templates, 'sectionTypes': types, 'inlineBlocks': blocks,
    'reusableBlocks': {k: {'schema': v['schema'], 'sourcePath': v['path'], 'sourceSha256': digest(v['source'].encode())} for k, v in B['blocks'].items()},
    'nestedBlocks': {'defaultNodes': [], 'declaredChildTypes': [], 'parseDepthLimit': 3,
                     'observation': 'No default block instances or explicit allowed_child_types in this factory. The canonical document can preserve children; shared Editor callbacks and visibility/reorder controls still require qualification. No child types invented.',
                     'requiredCoverage': 'Preserve/reject malformed or over-depth trees; exercise actually admitted nested declarations if the shared owner supplies a qualified contract.'},
    'globalSettings': globals_, 'settingsPresets': B['config']['settings_data']['presets'],
    'formControlTypesDeclared': form_types, 'mediaAndResourceBindings': bindings,
    'sourceMentionCheckLimit': 'sourceMentionsSetting is a lexical aid only. Product/collection/requireSelection bindings are consumed by the canonical data-binding engine; absence of a direct Liquid mention is not a missing-control verdict.',
    'nicheFacts': niche, 'advertisedCapabilities': promises,
    'designInputs': [ref(design_root / 'README.md'), ref(design_root / 'capabilities.json'), ref(design_root / 'source/05-product-specs.html')],
    'assets': {'rendererManifest': B['renderer']['assets'], 'approvedLeafAssetProvenance': ref(OUT.parent / 'asset-provenance.json'),
               'note': 'Empty factory renderer asset map does not prove approved public static image/font availability; test actual configured media under lease.'},
    'locales': B['locales'],
    'protectedSeams': ['@app declarations are preserved frozen seams under ARCH-R4/NEVER-R3, never activated as third-party checkout/theme execution.', 'Identity/security/business controls stay at canonical owners; schema presence does not authorize tenant/money/auth configuration.'],
    'installedInventoryStatus': 'NOT_RUN', 'needsCurrentInstalledSchemaReconciliation': True,
}
save('CAPABILITY_INVENTORY.json', inventory)

cases = []
def case(cid, requirement, *, category, template=None, st=None, sid=None, bt=None, field=None, operations=None, expected=None, limitations=None, finding=None):
    cases.append({'caseId': cid, 'requirement': requirement, 'theme': 'Trailmark', 'category': category,
        'template': template, 'sectionType': st, 'sectionId': sid, 'blockType': bt, 'blockId': None, 'field': field,
        'required': True, 'status': 'NOT_RUN', 'applicability': {'value': 'APPLICABLE', 'reason': 'Declared source capability or explicit completion requirement', 'reviewer': None},
        'operations': [{'operation': op, 'status': 'NOT_RUN', 'observed': None, 'evidence': []} for op in operations or ['execute']],
        'source': {'head': HEAD, 'closureManifest': 'SOURCE_SNAPSHOT.json', 'artifactHash': None, 'buildId': None, 'schemaVersion': B['schema_version']},
        'runtime': {'runId': None, 'mode': None, 'siteId': None, 'actorRealm': None, 'scopeReference': None},
        'expected': expected or 'Change is durable, correctly rendered and scoped; baseline data and unrelated settings remain intact.',
        'observed': None, 'evidence': [], 'priorEvidence': [], 'finding': finding,
        'review': {'status': 'PENDING', 'reviewer': None, 'evidence': []}, 'limitations': limitations or [],
        'nextAction': 'Await current allocator/controller/source admission; execute in owned sacrificial synthetic state and record per-operation evidence.'})

field_ops = ['edit', 'clear_and_recover', 'save', 'full_reload', 'signed_preview', 'publish', 'public_readback', 'restore']
section_ops = ['add', 'edit', 'reorder', 'hide', 'show', 'save', 'full_reload', 'signed_preview', 'publish', 'public_readback', 'delete', 're_add', 'undo_redo']
for t in templates:
    key=t['template']
    case('TM-TPL:'+key, 'Load the exact template with same-store context and preserve every declared section/block/setting.', category='template', template=key,
         operations=['load', 'save', 'full_reload', 'signed_preview', 'publish', 'public_readback', 'error_recovery'],
         limitations=['Header/footer are shared groups; do not create buyer routes for them.'] if t['sharedGroup'] else [])
    for s in t['sections']:
        sid=s['sectionId']; typ=s['type']
        case('TM-INSTANCE:'+key+':'+sid, 'Exercise this actual default section instance and retain identity/settings across persistence.', category='section-instance', template=key, st=typ, sid=sid,
             operations=['select', 'edit', 'hide', 'show', 'save', 'full_reload', 'signed_preview', 'publish', 'public_readback'],
             limitations=['Pinned header/footer groups have no move/delete affordance; preserve structure, test their editable fields and visibility.'] if t['sharedGroup'] else [])
        for f in B['sections'][typ]['schema']['settings']:
            case('TM-INSTANCE-FIELD:'+key+':'+sid+':'+f['id'], 'Verify the actual instance field, its type, clearing, and saved/rendered value.', category='instance-setting', template=key, st=typ, sid=sid, field=f['id'], operations=field_ops, finding='TM-G07' if typ=='customer-order-detail' and f['id']=='heading' else None)
for s in types:
    typ=s['sectionType']
    protected=s['protectedSeam']
    pinned=typ in ['header','footer']
    ops=['preserve_frozen_seam', 'reject_unapproved_activation'] if protected else ['select', 'edit', 'hide', 'show', 'save', 'full_reload', 'signed_preview', 'publish', 'public_readback'] if pinned else section_ops
    case('TM-SECTION:'+typ, 'Exercise the declared section type in an owned synthetic draft; preserve canonical business behavior.', category='section-type', st=typ, operations=ops,
         limitations=['Protected third-party app seam: preservation/denial only; no extension execution.'] if protected else ['Pinned group: no artificial reordering/removal requirement.'] if pinned else [])
    for f in s['settings']:
        case('TM-FIELD:'+typ+':'+f['id'], 'Verify each schema field at its canonical editor and actual Liquid output.', category='section-setting', st=typ, field=f['id'], operations=['preserve_frozen_seam'] if protected else field_ops, finding='TM-G07' if typ=='customer-order-detail' and f['id']=='heading' else None)
for b in blocks:
    typ=b['sectionType']; bt=b['blockType']
    protected=b['protectedSeam']
    case('TM-BLOCK:'+typ+':'+bt, 'Verify declared block lifecycle and stable identities; schema definitions remain unchanged.', category='block-type', st=typ, bt=bt,
         operations=['preserve_frozen_seam', 'reject_unapproved_activation'] if protected else section_ops,
         finding=None if protected else 'TM-G01', limitations=['No default instances; create only in allocated sacrificial draft.'])
    for field in b['resolvedEditorSchema']['fields']:
        case('TM-BLOCK-FIELD:'+typ+':'+bt+':'+field, 'Verify block setting including reusable-schema inheritance.', category='block-setting', st=typ, bt=bt, field=field,
             operations=['preserve_frozen_seam'] if protected else field_ops)
case('TM-NESTED-01', 'Reconcile declared child types against admitted installed schemas, preserve existing trees and enforce depth/ownership bounds.', category='nested-blocks',
     operations=['reconcile_actual_child_declarations', 'preserve_tree_roundtrip', 'reject_overdepth', 'reject_unknown_type', 'test_declared_child_lifecycle'], finding='TM-G01',
     limitations=['Source declares no child types/default nodes. Never invent child declarations or claim blanket N/A; allocator/Editor must resolve promised nested editing.'])
for g in globals_:
    case('TM-GLOBAL:'+g['group']+':'+g['field'], 'Verify global token/SEO setting through editor, actual document and rendered output.', category='global-setting', field=g['field'], operations=field_ops)
for preset in B['config']['settings_data']['presets']:
    case('TM-PRESET:'+preset, 'Apply the declared presentational preset in a sacrificial draft and restore approved Trailmark appearance.', category='preset', field=preset,
         operations=['review_values', 'apply', 'save', 'full_reload', 'signed_preview', 'publish', 'public_readback', 'restore'],
         limitations=['Factory Ride preset uses inherited orange values; current Trailmark is green. Record exact behavior; do not overwrite approved appearance or user draft.'])
for binding in bindings:
    cid='TM-BINDING:'+binding['sectionType']+':'+str(binding['blockType'] or 'section')+':'+binding['field']
    case(cid, 'Bind same-site resource/media, change/clear/restore and verify correct projection; deny foreign/private/removed resources.', category='binding', st=binding['sectionType'], bt=binding['blockType'], field=binding['field'],
         operations=['select_same_site', 'change', 'clear', 'recover_missing', 'deny_foreign_private', 'save', 'full_reload', 'signed_preview', 'publish', 'public_readback'])
for scope, fields in [('common',common_fields),('variant',measure_fields)]:
    for field in fields:
        case('TM-FACT:'+scope+':'+field, 'Normal catalogue editor creates/changes/clears this bounded fact; actual product readback, selected variant and history agree.', category='niche-fact', field=scope+'.'+field,
             operations=['edit', 'invalid_input_recovery', 'save_atomic', 'full_reload', 'public_projection', 'selected_variant_projection', 'immutable_order_after_edit'],
             expected='Use SportsFactsSchema/SportsVariantFactsSchema; preserve actual UUID, omit untouched inventory, whole-group inheritance, no invented unit or optional height.')
for i,promise in enumerate(promises,1):
    if promise.get('included') is False:
        continue
    case(f'TM-PROMISE:{i:02}', promise['name'], category='design-promise', operations=['normal_workflow', 'durable_readback', 'recovery', 'review'], expected=promise.get('requiredProof'), finding='TM-G02' if promise['name']=='Technical measurement presentation' else None,
         limitations=['Approved design target is not installed acceptance.'])

additional = {
    'TM-IDENTITY-01': ('identity', 'Normal new LetBuyy buyer email/password registration, configured bot check, validation, verification where supported and explicit Continue to Trailmark.'),
    'TM-IDENTITY-02': ('identity', 'Normal existing buyer signin, wrong credential/recovery, safe return, consent/callback binding, reload, logout and sign out everywhere.'),
    'TM-IDENTITY-03': ('identity', 'Store-bound customer entry uses canonical buyer issuer; unsupported retired login paths remain closed; merchant/operator realms do not become buyers.'),
    'TM-ACCOUNT-01': ('account', 'Own supported profile fields persist; readonly identity fields and scoped consent remain protected.'),
    'TM-ADDRESS-01': ('account', 'Normal add/edit/default/delete address, PIN validation and uncertain-save/reload recovery; preserve existing defaults.'),
    'TM-HISTORY-01': ('history', 'Buyer order pagination and direct-owned order load; cross-buyer/store/realm/signed-out denial with positive controls first.'),
    'TM-CART-01': ('cart', 'Native quantity add/change/remove, no duplicate logical lines, reload/drawer/page agree; stock limits and server price authority.'),
    'TM-CART-02': ('cart', 'Quote/address/shipping/tax/discount and eligibility recompute server-side; invalid/expired quote and uncertain response recover safely.'),
    'TM-COD-01': ('local-COD', 'Original O01/O02: one actual provider cod mode sandbox purchase through returned capability and exact confirm retry; one order/effect and unpaid COD status.'),
    'TM-PSP-01': ('Razorpay-Test', 'This theme actual normal buyer Razorpay Test Mode browser purchase; real test provider order/payment verification, raw-body webhook, local ledger/history and exact binding.'),
    'TM-PSP-02': ('Razorpay-Test', 'Shared adversarial provider cohort once on exact admitted inputs: invalid signatures/order binding/duplicate replay/out of order/uncertain response; per-theme link to acceptance.'),
    'TM-PSP-03': ('Razorpay-Test', 'Normal Test Mode decline/cancel/dismiss/retry preserves the original buyer intent and truthful pending/failed status; no false paid order or double stock/ledger effect.'),
    'TM-MONEY-01': ('money-recovery', 'Required cancellation/refund/payment reversal through existing canonical authorities on synthetic Test Mode state, exactly-once acknowledgement/reconciliation and balanced append-only ledger; preserve original order snapshots and stock history, no real fulfillment/disbursement.'),
    'TM-FORMS-01': ('native-form', 'Actual Liquid contact form native POST, validation/error/retry/reload and same-store durable acknowledgement; outbound delivery remains local/test and is not inferred from UI success.'),
    'TM-FORMS-02': ('native-form', 'Actual first-party newsletter declaration performs a legitimate canonical subscription/consent mutation with durable readback and failure/recovery; no simulated success, invented name or contact-only substitute.'),
    'TM-ENGAGEMENT-01': ('account', 'Native same-store wishlist add/remove, guest/authenticated continuity, reload and idempotent synchronization; foreign/private products and wrong buyer/site denied.'),
    'TM-ENGAGEMENT-02': ('reviews', 'Only real published moderated reviews render with actual totals; empty/unavailable states honest; supported normal owned submission and moderation permissions retain tenant/buyer constraints.'),
    'TM-CONTENT-01': ('content', 'Actual policy/blog/article/page/collection resources resolve their same-store context and content; missing/private/foreign resources fail safely with query/return recovery.'),
    'TM-I18N-02': ('quality', 'Supported translation editor/locales persist, reload and preview/publish; language fallback is explicit and long Hindi/Tamil text is usable, without claiming undeclared locale dictionaries exist.'),
    'TM-IMMUTABLE-01': ('history', 'Capture both actual COD/Test orders; edit same product/variant UUIDs and facts/prices while omitting stock; buyer/merchant snapshots stay byte-identical.'),
    'TM-STALE-01': ('cart', 'Original H03 pre-edit accepted cart attempts checkout before any reacceptance PATCH; reject stale facts with no order/reservation/stock side effect; then explicit review.'),
    'TM-PRIVATE-01': ('security', 'Positive private-field witness via sanctioned setup and private-preview resource transport; prove private facts absent publicly; absence-only fixture cannot pass.'),
    'TM-SECURITY-01': ('security', 'Positive-control-first buyer/merchant/tenant/RLS separation and denial, preview same-site token/no-store/fail closed, no public fallback.'),
    'TM-SECURITY-02': ('security', 'Stored text/URL/XSS/Liquid sandbox/unsafe field input and preview editor attributes isolation; no private payload or credentials in public/report.'),
    'TM-EDITOR-RECOVERY-01': ('editor-recovery', 'Version conflict, network timeout, lost acknowledgement, actor/store switch, autosave/discard/reload, undo/redo and reviewed rollback preserve intent/data.'),
    'TM-EDITOR-ALT-01': ('editor-template', 'Create/rename/delete admitted alternate template and resource assignment; safe return to default; no arbitrary protected-route creation.'),
    'TM-VISUAL-01': ('quality', 'Actual installed 1440/834/390/320 content reflow, menus/cart/facets/checkout/account/editor, decoded images/font axes and approved M1 identity.'),
    'TM-A11Y-01': ('quality', 'Native keyboard/focus/labels/headings/disclosures/contrast/touch targets and text 200%; assistive behavior measured, no screenshot-only pass.'),
    'TM-I18N-01': ('quality', 'Long/Hindi/Tamil labels and supported localization, units/currency, missing media/facts/empty results/loading/error; no clipping or false translation claim.'),
    'TM-PERF-01': ('quality', 'Relevant exact-source installed response/render/query/font/image budgets with actual timings and environment; source/static captures do not certify performance.'),
    'TM-CONSERVATION-01': ('preservation', 'Before/after protected table/order/snapshot/inventory/cart/draft/cookie/source manifests; expected scoped effects only; no cleanup/reseed/stock replenishment.'),
}
for cid,(category,requirement) in additional.items():
    case(cid, requirement, category=category, operations=['positive', 'negative', 'recovery', 'durable_readback', 'independent_review'], finding='TM-G08' if cid=='TM-FORMS-02' else None)

original=[]
for row in AUDIT['stageResults']:
    original.append({**row, 'evidenceRunId': AUDIT['runId'], 'classification': 'RETAINED_HISTORICAL_INDEPENDENT_RESULT',
        'evidence': [ref(OLD / 'non-order-independent-audit-2026-10-24.json')],
        'currentCandidateStatus': 'NOT_RUN', 'currentRuntimeLease': None,
        'nextAction': 'Do not rerun already-proved historical scope without dependent change; current candidate acceptance requires qualified reuse/admission or a newly allocated execution.'})
query_rows=[]
for recipe in PLAN['queries']:
    row={'id':recipe['id'], 'scopeCollectionKey':recipe['scopeCollectionKey'], 'queryFields':recipe['queryFields'], 'expected':recipe['expected'], 'routes':[]}
    for route in ['collection','search']:
        historical=next(x for x in AUDIT['P02']['rows'] if x['id']==recipe['id'] and x['route']==route)
        row['routes'].append({'route':route, 'parentStage':'P02',
            'public': {'retainedHistoricalStatus':historical['status'], 'runId':AUDIT['runId'], 'requestId':historical['requestId'], 'httpStatus':historical['httpStatus'], 'responseSha256':historical['responseSha256'],
                       'currentCandidateStatus':'NOT_RUN', 'evidence':ref(OLD / 'non-order-independent-audit-2026-10-24.json')},
            'private':{'status':'NOT_RUN','runId':None,'requestId':None,'evidence':[], 'nextAction':'Existing store-bound signed theme-preview resource transport, same token/no-store; exact 17 recipes, no public fallback.'}})
    query_rows.append(row)
coverage={
    'schemaVersion':1, 'theme':'Trailmark', 'recordedAt':NOW, 'classification':'PHASE0_COVERAGE_MAP_NOT_RUNTIME_ACCEPTANCE',
    'inventory':ref(OUT/'CAPABILITY_INVENTORY.json'), 'source':ref(OUT/'SOURCE_SNAPSHOT.json'),
    'originalLifecycleStages':original, 'originalStageCountsPreserved':AUDIT['stageCounts'],
    'discoveryRecipes':query_rows,
    'discoveryCounts':{'recipes':17,'routes':2,'historicalPublicPass':34,'historicalNativeRecoveryPass':12,'privateHttpNotRun':34,'currentCandidateHttpOrUiExecuted':0},
    'additionalCases':cases, 'additionalCaseCounts':dict(Counter(c['status'] for c in cases)),
    'additionalCategories':dict(Counter(c['category'] for c in cases)),
    'operationObservationsNotRun':sum(len(c['operations']) for c in cases),
    'countingRule':'The original denominator stays 12. The 34 public pairs and 12 recovery observations are P02 subcoverage, not 46 additional lifecycle stages. Additive schema cases are separate unexecuted requirements, never passes.',
    'currentExecution':{'phase':'COMPLETION_PHASE0_PREPARATION','activeBrowserLease':None,'activeSharedWriter':None,'fixture':None,'sourceEdits':[],'directRuntimeActions':[]},
    'certification':{'LOCAL_E2E_VERIFIED':'NOT_ISSUED','RAZORPAY_TEST_VERIFIED':'NOT_ISSUED','REVIEW_ACCEPTED':'NOT_ISSUED','FULL_THEME_CERTIFIED':'NOT_ISSUED','productionDeployment':'NOT_REQUESTED'},
    'historicalAuditLimits':AUDIT['auditLimits'],
}
save('COVERAGE.json',coverage)
save('CERTIFICATION.json',{'schemaVersion':1,'theme':'Trailmark','recordedAt':NOW,'classification':'OPEN_GATES_NOT_A_CERTIFICATE','coverage':ref(OUT/'COVERAGE.json'),**coverage['certification'],'allRequiredCasesPassed':False,'independentReviewer':None,'reasons':['No current fixture/runtime/release/identity binding or execution lease.','Original matrix remains 3 PASS / 2 BLOCKED / 7 NOT_RUN on historical run936.','34 private discovery transports, expanded editor/identity/payment/history/quality cases unexecuted.','Actual Trailmark COD and Razorpay Test Mode purchases and independent acceptance absent.']})
print(json.dumps({'root':str(ROOT),'inventory':inventory['counts'],'additionalCases':len(cases),'additionalStatusCounts':coverage['additionalCaseCounts'],'operationObservationsNotRun':coverage['operationObservationsNotRun'],'historicalLifecycle':coverage['originalStageCountsPreserved'],'newRuntimeActions':0}))
