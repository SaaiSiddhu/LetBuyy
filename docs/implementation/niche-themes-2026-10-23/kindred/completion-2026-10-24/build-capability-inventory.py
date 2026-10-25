"""Read saved package/source/evidence; write only this owned completion folder.

This is a declaration/evidence indexer, not a seeder, build or runtime test.
"""
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path('/Volumes/Projects/LetBuyy')
OUT = Path(__file__).resolve().parent
OWN = ROOT / 'docs/implementation/niche-themes-2026-10-23/kindred'
EVIDENCE = ROOT / 'docs/implementation/theme-editor-2026-10-23/evidence'
ARTIFACT = ROOT / 'docs/implementation/niche-theme-programme/release-v2/proposals/81e91859ebc8c497a49da337d064e1885a76964839d14e39f4a0a3de2283f47f/letbuyy-summit-2.0.0.json'
NOW = datetime.now(timezone.utc).isoformat()


def read(path):
    return json.loads(path.read_text())


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save(name, value):
    path = OUT / name
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def source(path):
    p = ROOT / path
    return {'path': path, 'sha256': digest(p), 'bytes': p.stat().st_size}


artifact = read(ARTIFACT)
bundle = artifact['document']['liquidBundle']
pointer_base = '/document/liquidBundle'
operations = ['add_apply', 'edit', 'reorder', 'hide', 'show', 'save', 'full_reload',
              'private_preview', 'publish', 'public_readback', 'delete',
              'absence_after_reload_publish', 're_add_rebind', 'undo_redo', 'recovery']
field_ops = ['valid_value', 'invalid_or_limit_value', 'clear_unknown',
             'false_zero_where_typed', 'conditional_visibility', 'save_full_reload',
             'preview_publish_public_readback', 'unavailable_resource_recovery']
cases = []


def case(cid, requirement, refs, ops, lane='editor', constraints=None):
    cases.append({'id': cid, 'requirement': requirement, 'inventoryRefs': refs,
                  'lane': lane, 'required': True, 'status': 'NOT_RUN',
                  'operations': [{'operation': op, 'status': 'NOT_RUN', 'evidence': []} for op in ops],
                  'constraints': constraints or [], 'currentCandidate': None,
                  'sourceIndex': 'SOURCE_INDEX.json', 'artifactRef': 'CAPABILITY_INVENTORY.json#/artifact',
                  'expectedEffectContract': 'OPERATION_CONTRACTS.json',
                  'actorScope': 'Merchant owner on sacrificial draft/store' if lane == 'editor' else 'Fresh specifically allocated synthetic actor/record scope',
                  'controller': None, 'independentReview': 'PENDING'})
    return cid


def field(scope, descriptor, pointer, consumer=None):
    fid = descriptor['id']
    cid = case('KSET-' + scope + '-' + fid,
               'Exercise declared setting ' + scope + '.' + fid,
               [pointer], field_ops)
    return {'id': fid, 'descriptor': descriptor, 'sourcePointer': pointer,
            'declaredConsumerTokenFound': (('section.settings.' + fid in consumer) if consumer else None),
            'consumerTokenCheckIsNotBehaviorProof': True,
            'editorAvailability': 'UNVERIFIED_ON_CURRENT_ADMITTED_RUNTIME', 'caseId': cid}


sections = []
block_types = []
for stype, value in sorted(bundle['sections'].items()):
    schema = value['schema']
    pointer = pointer_base + '/sections/' + stype
    restricted = stype == 'app-block-slot'
    cid = case('KSEC-' + stype, 'Every section lifecycle: ' + schema['name'], [pointer],
               ['frozen_seam_guard', 'reject_unadmitted_third_party_block'] if restricted else operations,
               constraints=['ART-16/NEVER-R3: app extension seam remains dormant; do not activate it.'] if restricted else [])
    item = {'type': stype, 'name': schema['name'], 'bundlePath': value['path'],
            'sourcePointer': pointer, 'fullSchema': schema, 'caseId': cid,
            'declarationClass': 'PROTECTED_EXTENSION_SEAM' if restricted else 'DECLARED_SECTION',
            'settings': [field(stype, f, pointer + '/schema/settings/' + str(i), value['source'])
                         for i, f in enumerate(schema.get('settings', []))], 'blocks': []}
    for index, block in enumerate(schema.get('blocks', [])):
        bt = block['type']
        bp = pointer + '/schema/blocks/' + str(index)
        dormant = bt == '@app'
        bid = case('KBLK-' + stype + '-' + bt.replace('@', ''),
                   'Section block lifecycle: ' + stype + '/' + bt, [bp],
                   ['frozen_seam_guard', 'reject_unadmitted_third_party_block'] if dormant else operations,
                   constraints=['Do not create an app extension implementation.'] if dormant else [])
        rec = {'type': bt, 'name': block.get('name'), 'sourcePointer': bp,
               'fullSchema': block, 'caseId': bid,
               'declarationClass': 'PROTECTED_EXTENSION_SEAM' if dormant else 'DECLARED_INLINE_BLOCK',
               'settings': [field(stype + '-block-' + bt.replace('@', ''), f,
                                  bp + '/settings/' + str(i)) for i, f in enumerate(block.get('settings', []))]}
        item['blocks'].append(rec)
        block_types.append(rec)
    sections.append(item)

global_blocks = []
for btype, value in sorted(bundle['blocks'].items()):
    pointer = pointer_base + '/blocks/' + btype
    cid = case('KGLOBALBLOCK-' + btype, 'Global block schema and actual consumer: ' + btype,
               [pointer], operations,
               constraints=['Verify inline/global schema resolution and actual allowed child types; do not invent nesting.'])
    global_blocks.append({'type': btype, 'sourcePointer': pointer, 'schema': value['schema'],
                          'caseId': cid, 'settings': [field('global-block-' + btype, f,
                          pointer + '/schema/settings/' + str(i)) for i, f in enumerate(value['schema'].get('settings', []))]})

templates = []
compatibility = []
for name, template in sorted(bundle['templates'].items()):
    tp = pointer_base + '/templates/' + name.replace('~', '~0').replace('/', '~1')
    tid = case('KTM-' + name.replace('/', '-'), 'Actual template routing/context: ' + name,
               [tp], ['open_correct_resource_context', 'select_exact_section_and_block',
                      'save_full_reload', 'private_preview', 'publish_public_readback',
                      'missing_denied_empty_recovery'], constraints=['Use sacrificial draft/store and existing canonical route/identity authority.'])
    instances = []
    for instance_id in template['order']:
        inst = template['sections'][instance_id]
        ip = tp + '/sections/' + instance_id
        icid = case('KINST-' + name.replace('/', '-') + '-' + instance_id,
                    'Declared instance/binding lifecycle: ' + name + '/' + instance_id,
                    [ip, pointer_base + '/sections/' + inst['type']], operations)
        instances.append({'id': instance_id, 'type': inst['type'], 'settings': inst.get('settings', {}),
                          'disabled': inst.get('disabled'), 'blocks': inst.get('blocks', {}),
                          'blockOrder': inst.get('block_order', []), 'caseId': icid, 'sourcePointer': ip})
    templates.append({'key': name, 'name': template.get('name'), 'layout': template.get('layout'),
                      'caseId': tid, 'sourcePointer': tp, 'order': template['order'], 'instances': instances})
    for s in sections:
        sc = s['fullSchema']
        enabled = sc.get('enabled_on', {}).get('templates', ['*'])
        disabled = sc.get('disabled_on', {}).get('templates', [])
        declared = ('*' in enabled or name in enabled) and name not in disabled and '*' not in disabled
        compatibility.append({'template': name, 'sectionType': s['type'], 'declaredEnabled': declared,
                              'actualUiAdmission': 'NOT_RUN', 'securityBoundary': s['declarationClass'],
                              'coverage': [s['caseId'], tid],
                              'rule': 'Declaration does not authorize security/platform mutations or prove picker availability.'})

global_settings = []
for group, spec in sorted(bundle['config']['settings_schema']['settings'].items()):
    for key, descriptor in sorted(spec['fields'].items()):
        pointer = pointer_base + '/config/settings_schema/settings/' + group + '/fields/' + key
        cid = case('KTHEME-' + key, 'Global theme control: ' + key, [pointer], field_ops)
        global_settings.append({'group': group, 'id': key, 'descriptor': descriptor,
                                'currentAcceptedValue': bundle['config']['settings_data']['current'].get(key),
                                'sourcePointer': pointer, 'caseId': cid})

gift_fields = [
    ('schemaVersion', 'Platform-owned literal1/default1; do not make merchant-editable', ['default_one', 'reject_other_version', 'preserve_platform_control']),
    ('occasions', 'Array of <=12 unique lowercase/hyphen keys, <=40 characters each', ['add', 'edit', 'remove', 'clear', 'duplicate_invalid', 'limit_invalid']),
    ('recipients', 'Same bounded keys, no sensitive recipient profiling', ['add', 'edit', 'remove', 'clear', 'duplicate_invalid', 'limit_invalid']),
    ('suitabilityNote', 'Optional merchant note <=500 characters; not buyer gift message', ['valid', 'clear', 'limit_invalid', 'hostile_text']),
    ('contents', 'Optional1..30 unique NFKC/case-normalized labels', ['add', 'edit', 'remove', 'clear', 'duplicate_invalid', 'restore']),
    ('contents[].label', 'Required label1..160 characters', ['valid', 'empty_invalid', 'limit_invalid', 'unicode', 'hostile_text']),
    ('contents[].quantity', 'Integer1..100', ['valid', 'zero_invalid', 'fraction_invalid', 'limit_invalid']),
    ('contents[].detail', 'Optional1..1000 characters', ['valid', 'clear', 'limit_invalid', 'unicode']),
    ('contents[].care', 'Optional1..1000 characters', ['valid', 'clear', 'limit_invalid', 'unicode']),
    ('mediaRoles.openBox', 'Supplied image index0..19; distinct from closedBox', ['assign', 'clear', 'duplicate_invalid', 'removed_image_recovery', 'exact_identity_reorder']),
    ('mediaRoles.closedBox', 'Supplied image index0..19; distinct from openBox', ['assign', 'clear', 'duplicate_invalid', 'removed_image_recovery', 'exact_identity_reorder']),
    ('clearAllGiftFacts', 'Normal parent Save omits gifts namespace; original facts recoverable', ['clear', 'save_reload', 'unknown_public_readback', 'restore']),
    ('objectPolicy', 'Strict namespace, no unknown/private/price/stock/message keys; <=16000 JSON characters', ['reject_unknown_keys', 'reject_private_fields', 'aggregate_limit_invalid', 'malformed_history_unknown']),
]
catalogue = []
for name, constraint, ops in gift_fields:
    cid = case('KFACT-' + name.replace('[]', '').replace('.', '-'), 'Canonical gift field: ' + name,
               ['packages/commerce-core/src/kindred-facts.ts', 'apps/merchant/web/src/components/products/niche-facts/kindred-facts-editor.tsx'],
               ops + ['parent_save_full_reload', 'canonical_public_projection', 'immutable_saved_order'], lane='catalogue',
               constraints=['No second price/stock authority; preserve UUID/options/consumed stock; unsupported UI branch is a gap, not injected metadata.'])
    catalogue.append({'path': name, 'constraint': constraint, 'caseId': cid})

journeys = [
    ('KID-01', 'Normal new LetBuyy buyer signup, email/code verification, signin, consent and bound callback', 'identity'),
    ('KID-02', 'Canonical storefront customer entry, full reload, profile, addresses, logout and recovery', 'identity'),
    ('KID-03', 'Wrong-site callback, PKCE/state/code replay, expired/missing session and realm/buyer/store denial', 'security'),
    ('KBUY-01', 'Home/collection/search/PDP plus server cart add/edit/quantity/remove/re-add/fullreload', 'buyer'),
    ('KBUY-02', 'Unknown/empty/missing-image/unavailable/overstock/price-change/facts-change recovery', 'buyer'),
    ('KBUY-03', 'Server quote, owned address, shipping, tax and discount combined behavior', 'checkout'),
    ('KCOD-01', 'Normal hosted COD gift order and buyer/merchant immutable readbacks', 'checkout'),
    ('KRP-01', 'ACTUAL Kindred Razorpay Test Mode browser purchase and provider/local linkage', 'provider'),
    ('KRP-02', 'Actual owned HTTPS Test Mode webhook delivery plus signature/order/amount/tenant binding', 'provider'),
    ('KRP-03', 'Shared exact-input provider decline/cancel/retry/duplicate/race/spoof/reconciliation cohort', 'provider'),
    ('KHIST-01', 'After actual orders edit same UUID facts/options/title/price/media without replenishment; old views unchanged', 'history'),
    ('KHIST-02', 'Stale cart, lost acknowledgement and original intent/key recovery, exactly one business effect', 'history'),
    ('KREV-01', 'Canonical synthetic cancellation/refund/payment reversal and balanced exactly-once ledger', 'provider'),
    ('KQUAL-01', 'Measured content widths320/390/768/834/1440,200% text, English/Hindi/Tamil, fonts/images', 'quality'),
    ('KQUAL-02', 'Keyboard/focus/semantics/announcements/reduced motion and declared light/dark states', 'quality'),
    ('KQUAL-03', 'Representative readiness/interaction measurements against existing budget or explicit budget gap', 'quality'),
    ('KSEC-01', 'Actual Liquid sandbox/SSTI/stored-XSS/escaping/private snapshot/preview message denial', 'security'),
    ('KLINE-01', 'Exact source/build/catalog/installed config/draft/release/public byte lineage', 'lineage'),
    ('KREC-01', 'Duplicate/stale Save, reauth, lost response, unsaved navigation, undo/redo and draft preservation', 'editor'),
    ('KBRAND-01', 'Reobserve and repair KQA-01 exact768px long-brand header under future exact writer lease', 'quality'),
    ('KPREVIEW-01', 'Diagnose observed820px Tablet preview error without presuming CSS cause; retest actual widths', 'editor'),
    ('KPRES-01', 'Protected apps/tabs/accounts/drafts/cart/orders/stock and owner-only resource release', 'preservation'),
    ('KREVIEW-01', 'Independent reviewer accepts all required evidence with no unresolved required gate', 'review'),
]
for cid, requirement, lane in journeys:
    case(cid, requirement, ['EXECUTION_RUNBOOK.md', 'original G01-G19 and Kindred design blueprint'],
         ['positive_path', 'negative_recovery', 'effect_readback', 'independent_review'], lane)

design = [
    ('occasion_recipient_budget_finder', ['hero-banner', 'collection-filter'], 'Server-supplied choices only; clearing budget retains occasion/recipient.'),
    ('occasion_collection_tiles', ['category-grid'], 'Actual collection1..4 resource IDs, empty/missing collection recovery.'),
    ('curated_gallery', ['product-grid', 'featured-products'], 'Actual product/collection selection; known item count/suitability; real INR/availability.'),
    ('packaging_editorial', ['about-section'], 'Image/alt/text/link controls with safe blank behavior.'),
    ('help_and_policy', ['trust-badges', 'page-content', 'policy-content'], 'Merchant policy/resource truth; no arrival guarantees.'),
    ('header_navigation', ['header', 'announcement-bar'], 'Promised category links/menu, search/cart utilities, mobile Escape/focus return.'),
    ('gift_contents_and_role_images', ['product-detail'], 'Canonical common gift facts, explicit photographs, unknown facts stay unknown.'),
    ('packaging_variants_and_gift_notes', ['product-detail', 'cart-summary'], 'Only real supported SKU/contract; no invented note/message field or fulfillment promise.'),
]
promises = []
for key, types, rule in design:
    cid = case('KDESIGN-' + key, 'Approved Kindred capability: ' + key, types,
               ['declared_control_trace', 'merchant_configuration', 'runtime_output', 'empty_recovery', 'independent_review'],
               constraints=[rule, 'Preserve approved design; no redesign or unsupported commercial promise.'])
    promises.append({'id': key, 'sections': types, 'acceptance': rule, 'caseId': cid})

ledger = read(EVIDENCE / 'stable936-kindred-finite-nonorder-boundary.json')
plan = read(OWN / 'responsive-shopping-2026-10-23/installed-gifts-lifecycle.plan.json')
original = []
for expected, row in zip(plan['cases'], ledger['rows']):
    assert expected['id'] == row['id']
    strict = row['status'] if row['status'] in ['PASS', 'FAIL'] else 'NOT_RUN'
    original.append({'id': row['id'], 'title': expected['title'], 'originalExpectation': expected['expectation'],
                     'latestHistoricalOutcome': strict, 'controllerDiagnostic': row['status'],
                     'remainingScope': row['scope'], 'historicalRun': '936e5f577646',
                     'evidence': str(EVIDENCE.relative_to(ROOT) / 'stable936-kindred-finite-nonorder-boundary.json'),
                     'currentTargetStatus': 'NOT_RUN', 'currentAdmittedCandidate': None,
                     'reuseRule': 'Historical proof retained. Reuse only when relevant source/artifact/contracts and environment lineage match; do not replay unchanged completed work.'})

source_paths = [
    'packages/theme-engine/src/kindred-theme.ts', 'packages/theme-engine/src/kindred-discovery.ts',
    'packages/theme-engine/src/kindred-styles.ts', 'packages/theme-engine/src/theme-bundle.ts',
    'packages/commerce-core/src/kindred-facts.ts',
    'apps/merchant/web/src/components/products/niche-facts/kindred-facts-editor.tsx',
    'apps/merchant/web/src/components/theme-editor/SchemaFormRenderer.tsx',
    'apps/merchant/web/src/components/theme-editor/SectionTreePanel.tsx',
    'apps/merchant/web/src/components/theme-editor/BlockChildRow.tsx',
    'apps/merchant/web/src/components/theme-editor/CenterPanel.tsx',
    'apps/merchant/web/src/components/theme-editor/preview-viewport.ts',
    'apps/merchant/web/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx',
    'apps/commerce/web/src/app/store/[subdomain]/liquid-theme.css',
    'services/api-gateway/src/routes/storefront/checkout-payment-routes.ts',
    'packages/infrastructure/razorpay-adapter/index.ts',
    'apps/platform/identity/src/lib/auth/buyer-email-code.ts',
    'apps/platform/identity/src/lib/auth/buyer-authorization.ts',
    'docs/research/shopify-product-intelligence/free-themes-niche-study-2026-10-22/letbuyy-design-blueprints/06-summit-kindred.md',
]
sources = [source(p) for p in source_paths]
summary = {'templates': len(templates), 'sectionTypes': len(sections),
           'defaultSectionInstances': sum(len(t['instances']) for t in templates),
           'sectionSettings': sum(len(s['settings']) for s in sections),
           'inlineBlockDeclarations': len(block_types),
           'inlineBlockSettings': sum(len(b['settings']) for b in block_types),
           'globalBlockTypes': len(global_blocks), 'globalBlockSettings': sum(len(b['settings']) for b in global_blocks),
           'globalSettings': len(global_settings), 'sourceDeclaredCompatibilityPairs': len(compatibility),
           'catalogueFieldGroups': len(catalogue), 'expandedCaseCohorts': len(cases),
           'requiredOperationRows': sum(len(c['operations']) for c in cases)}
inventory = {'schemaVersion': 1, 'recordedAt': NOW, 'theme': 'Kindred', 'preset': 'summit',
             'classification': 'STATIC_DECLARATION_INVENTORY_NOT_RUNTIME_PROOF',
             'humanMandateVerified': {'chatId': '01a16ce5-e5ba-7191-ab2c-a1b76947d2b5',
                                     'userTurnId': '01a16cf8-99f0-7f51-852c-d0fd6ea08262',
                                     'goalExplicitlyRequested': True},
             'artifact': {**source(str(ARTIFACT.relative_to(ROOT))), 'slug': artifact['slug'],
                          'version': artifact['version'], 'bundleSha256': artifact['bundleSha256']},
             'counts': summary, 'templates': templates, 'sectionTypes': sections,
             'globalBlocks': global_blocks, 'globalSettings': global_settings,
             'templateSectionDeclarations': compatibility, 'canonicalCatalogueFields': catalogue,
             'designPromises': promises, 'layoutFiles': list(bundle['layout']),
             'localeFiles': list(bundle['locales']), 'sources': sources,
             'ownership': {'sharedAllocator': '01a164a4-a342-76d3-ab33-65e021ed57db',
                           'intendedUiController': '01a166eb-66bb-7042-bb47-2aaafef26f53',
                           'helperActivation': 'Not yet recorded at initial read; no resumption inferred.',
                           'sourceWriterLease': None, 'runtimeLease': None,
                           'writeBoundary': str(OUT.relative_to(ROOT))},
             'limitations': ['Accepted schema and current source declarations do not prove mounted controls.',
                             'All45 inherited section types are retained in inventory; not only five home sections.',
                             'App-extension declarations are protected dormant seams, tested as guards, not activated.',
                             'Global/inline badge resolution and deeper child types require actual current adapter/controller verification.',
                             'No old936 runtime, source writer or browser lease is reactivated.',
                             'No secrets, provider credentials or user app state inspected.']}
save('CAPABILITY_INVENTORY.json', inventory)
save('COVERAGE.json', {'schemaVersion': 1, 'recordedAt': NOW, 'theme': 'Kindred',
                      'originalCaseCount': 19, 'originalCases': original,
                      'historicalFullCaseTotals': {'PASS': 3, 'FAIL': 1, 'NOT_RUN': 15},
                      'historicalControllerDiagnostics': ledger['counts'],
                      'expandedCounts': summary, 'expandedCases': cases,
                      'allNewCasesInitially': 'NOT_RUN', 'currentCandidate': None,
                      'independentReview': 'PENDING', 'FULL_THEME_CERTIFIED': False,
                      'countingRule': 'A cohort/setting/operation is not a unique completed lifecycle; no sum of overlapping prior suites or screenshots.'})
save('SOURCE_INDEX.json', {'recordedAt': NOW, 'branch': 'letbuyy/theme-release-performance-resume',
                          'head': '85aac99043d8dc10469e12cbb810609a3b6f1b0d',
                          'relevantDirtyPaths': 'Theme/facts leaf files are existing untracked work; app CSS is existing modified work. Preserve without staging/resetting.',
                          'artifact': inventory['artifact'], 'sources': sources})
save('CERTIFICATION.json', {'recordedAt': NOW, 'status': 'NOT_ISSUED', 'goalStatus': 'active',
                          'LOCAL_E2E_VERIFIED': False, 'RAZORPAY_TEST_VERIFIED': False,
                          'REVIEW_ACCEPTED': False, 'FULL_THEME_CERTIFIED': False,
                          'PRODUCTION_DEPLOYED': 'NOT_REQUESTED',
                          'reason': 'Phase0 preparation only; required editor/identity/payment/history/security/quality execution and independent review remain.'})
assert len(original) == 19 and len({c['id'] for c in cases}) == len(cases)
assert summary['templates'] == 23 and summary['sectionTypes'] == 45
assert summary['sectionSettings'] == 103 and summary['inlineBlockSettings'] == 23
assert summary['globalSettings'] == 12 and all(c['status'] == 'NOT_RUN' for c in cases)
save('PHASE0_RECEIPT.json', {'recordedAt': NOW, 'status': 'STATIC_INVENTORY_BUILT_NOT_CERTIFIED',
                           'counts': summary, 'originalCasesConserved': 19,
                           'sourceWrites': 0, 'artifactWrites': 0, 'runtimeCalls': 0,
                           'browserActions': 0, 'databaseCalls': 0, 'builds': 0,
                           'newTimers': 0, 'crossChatMessages': 0,
                           'ownedResourcesStarted': [], 'goalStatus': 'active'})
print(json.dumps(summary))
