"""Offline declaration inventory. No application imports, network or runtime actions."""
import collections
import datetime
import hashlib
import json
import pathlib
import re

ROOT = pathlib.Path('/Volumes/Projects/LetBuyy')
OWN = ROOT / 'docs/implementation/niche-themes-2026-10-23/marginalia'
OUT = pathlib.Path(__file__).parent
PROGRAMME = ROOT / 'docs/implementation/niche-theme-programme/completion-2026-10-24'
ARTIFACT = ROOT / 'docs/implementation/niche-theme-programme/release-v2/proposals/81e91859ebc8c497a49da337d064e1885a76964839d14e39f4a0a3de2283f47f/letbuyy-dawn-2.0.0.json'
NOW = datetime.datetime.now(datetime.timezone.utc).isoformat()
HEAD = '85aac99043d8dc10469e12cbb810609a3b6f1b0d'
EDITOR = 'apps/merchant/web/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx'
FORM = 'apps/merchant/web/src/components/theme-editor/SchemaFormRenderer.tsx'
TREE = 'apps/merchant/web/src/components/theme-editor/SectionTreePanel.tsx'
FACTS = 'packages/commerce-core/src/marginalia-facts.ts'


def load(path):
    return json.loads(path.read_text())


def write(name, value):
    path = OUT / name
    if path.exists():
        raise RuntimeError(f'Refusing to overwrite prior preparation artifact: {path}')
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def identity(value):
    return re.sub(r'[^A-Za-z0-9]+', '-', value).strip('-').upper()


artifact = load(ARTIFACT)
bundle = artifact['document']['liquidBundle']
baseline = load(OWN / 'stable936-installed-lifecycle.results.json')
matrix = load(OWN / 'installed-book-stationery-lifecycle.matrix.json')
dispatch = load(PROGRAMME / 'EXECUTION_STATE.json')
form_source = (ROOT / FORM).read_text()
control_types = sorted(set(re.findall(r"case '([^']+)':", form_source)))
editor_source = (ROOT / EDITOR).read_text()
tree_call = editor_source.split('<SectionTreePanel', 1)[1].split('/>', 1)[0]
assert all(name not in tree_call for name in ('onAddChildBlock', 'onRemoveChildBlock', 'onMoveChildBlock'))

OPERATIONS = ['apply', 'edit', 'reorder', 'hide', 'show', 'save', 'full_reload', 'private_preview', 'publish', 'public_readback', 'delete', 'save_reload_absence', 're_add_rebind', 'undo_redo', 'recovery']
FIELD_OPERATIONS = ['valid_edit', 'required_invalid_limit', 'clear_false_zero_unknown', 'conditional_visibility', 'save_full_reload', 'private_preview', 'publish_public_readback', 'unavailable_resource_recovery']
cases = []


def case(case_id, requirement, category, refs, operations, **scope):
    row = {
        'caseId': case_id, 'requirement': requirement, 'category': category,
        'required': True, 'status': 'NOT_RUN',
        'applicability': {'value': 'APPLICABLE', 'reason': 'Owner-required coverage; actual control constraints remain explicit.', 'reviewer': None},
        'scope': scope, 'capabilityRefs': refs,
        'operations': [{'operation': op, 'status': 'NOT_RUN', 'observed': None, 'evidence': []} for op in operations],
        'source': {'headLocator': HEAD, 'closureManifest': 'SOURCE_MANIFEST.json', 'artifactHash': None, 'buildId': None},
        'runtime': {'runId': None, 'siteId': None, 'actorRealm': None, 'scopeReference': None},
        'expected': {'ui': requirement, 'businessEffects': 'Only explicitly allocated synthetic scope; canonical authority and unrelated state preserved.'},
        'observed': None, 'evidence': [], 'commands': [],
        'review': {'status': 'PENDING', 'reviewer': None, 'evidence': []},
        'limitations': ['Declaration/source inspection is not installed, browser, provider or security acceptance.'],
        'nextAction': 'Acquire a current admitted candidate and named writer/controller slice; execute and independently review actual effects.',
    }
    cases.append(row)
    return case_id


templates = []
for key, template in sorted(bundle['templates'].items()):
    ref = f'template:{key}'
    case_id = case('MG-C-TEMPLATE-' + identity(key), 'Open the exact template/resource context and preserve every declared instance through the editor lifecycle.', 'template', [ref], OPERATIONS, template=key)
    templates.append({'id': ref, 'templateKey': key, 'name': template.get('name'), 'layout': template.get('layout'), 'group': key if key in ('header', 'footer') else 'template', 'order': template.get('order', []), 'instances': [{'instanceId': k, **v} for k, v in template.get('sections', {}).items()], 'caseId': case_id, 'status': 'DECLARED_NOT_EXECUTED'})

sections, fields, blocks = [], [], []
for key, section in sorted(bundle['sections'].items()):
    schema = section['schema']
    ref = f'section:{key}'
    section_case = case('MG-C-SECTION-' + identity(key), 'Exercise this declared section in a sacrificial draft, including delete/re-add and preserved identity/settings.', 'section', [ref], ['add'] + OPERATIONS, sectionType=key)
    section_row = {'id': ref, 'sectionType': key, 'name': schema['name'], 'sourcePathInBundle': section['path'], 'schema': schema, 'caseId': section_case, 'status': 'DECLARED_NOT_EXECUTED', 'currentEditorAvailability': 'Requires admitted package schema/browser acknowledgement; declaration is not an addability guarantee.'}
    if key == 'app-block-slot':
        section_row['restriction'] = 'Frozen third-party execution seam: prove guard/advertisement behavior with allocator; never activate an extension runtime.'
    sections.append(section_row)
    for field in schema.get('settings', []):
        field_ref = f'{ref}/field:{field["id"]}'
        field_case = case('MG-C-FIELD-' + identity(key + '-' + field['id']), f'Exercise {key}.{field["id"]} with its exact descriptor and meaningful valid/invalid/clear/recovery outputs.', 'section_setting', [field_ref], FIELD_OPERATIONS, sectionType=key, field=field['id'])
        fields.append({'id': field_ref, 'owner': ref, 'descriptor': field, 'controlTypeDeclaredInCurrentRenderer': field['type'] in control_types, 'controlSource': FORM, 'caseId': field_case, 'browserStatus': 'NOT_RUN'})
    for block in schema.get('blocks', []):
        block_ref = f'{ref}/block:{block["type"]}'
        block_case = case('MG-C-BLOCK-' + identity(key + '-' + block['type']), 'Exercise this section-scoped block and supported nested identities without editing definitions; missing required operations stay open.', 'section_block', [block_ref], ['add'] + OPERATIONS, sectionType=key, blockType=block['type'])
        row = {'id': block_ref, 'sectionType': key, 'blockType': block['type'], 'descriptor': block, 'caseId': block_case, 'currentStatus': 'NOT_RUN', 'operationGap': 'Current main editor omits nested-child callbacks; top-level block reorder/hide controls require canonical-owner reconciliation.'}
        if block['type'] == '@app':
            row['restriction'] = 'Frozen extension seam. No third-party execution. Required guard/advertisement review is open, not silently N/A.'
        blocks.append(row)
        for field in block.get('settings', []):
            field_ref = f'{block_ref}/field:{field["id"]}'
            field_case = case('MG-C-BLOCK-FIELD-' + identity(key + '-' + block['type'] + '-' + field['id']), 'Persist and render this exact block setting while preserving its enclosing section/block identities.', 'block_setting', [field_ref], FIELD_OPERATIONS, sectionType=key, blockType=block['type'], field=field['id'])
            fields.append({'id': field_ref, 'owner': block_ref, 'descriptor': field, 'controlTypeDeclaredInCurrentRenderer': field['type'] in control_types, 'controlSource': FORM, 'caseId': field_case, 'browserStatus': 'NOT_RUN'})

global_blocks = []
for key, block in sorted(bundle.get('blocks', {}).items()):
    ref = f'global_block:{key}'
    global_blocks.append({'id': ref, 'blockType': key, 'path': block['path'], 'schema': block['schema'], 'caseId': case('MG-C-GLOBAL-BLOCK-' + identity(key), 'Verify global block resolution, section-local overrides and actual nested selection/lifecycle.', 'global_block', [ref], ['add'] + OPERATIONS, blockType=key), 'status': 'NOT_RUN'})
    for field in block['schema'].get('settings', []):
        field_ref = f'{ref}/field:{field["id"]}'
        fields.append({'id': field_ref, 'owner': ref, 'descriptor': field, 'controlSource': FORM, 'controlTypeDeclaredInCurrentRenderer': field['type'] in control_types, 'caseId': case('MG-C-GLOBAL-BLOCK-FIELD-' + identity(key + '-' + field['id']), 'Verify the effective global-block setting control and rendered output, not only its definition.', 'global_block_setting', [field_ref], FIELD_OPERATIONS, blockType=key, field=field['id']), 'browserStatus': 'NOT_RUN'})

global_settings = []
for group_key, group in sorted(bundle['config']['settings_schema']['settings'].items()):
    for key, field in sorted(group['fields'].items()):
        ref = f'theme_setting:{group_key}/{key}'
        global_settings.append({'id': ref, 'group': group_key, 'groupLabel': group['label'], 'field': key, 'descriptor': field, 'actualDeclaredInitialValue': bundle['config']['settings_data'].get('current', {}).get(key), 'controlSource': FORM, 'controlTypeDeclaredInCurrentRenderer': field['type'] in control_types, 'caseId': case('MG-C-THEME-SETTING-' + identity(group_key + '-' + key), 'Verify this actual theme setting, its valid/invalid/empty behavior and persisted/rendered effect without redesigning approved identity.', 'theme_setting', [ref], FIELD_OPERATIONS, field=key), 'status': 'NOT_RUN'})

facts = []
book = ['authors', 'subjects', 'language', 'format', 'edition', 'publisher', 'publication_year', 'pages', 'dimensions_mm.width', 'dimensions_mm.height', 'isbn']
paper = ['paper_gsm', 'dimensions_mm.width', 'dimensions_mm.height', 'page_count', 'sheet_count', 'ruling', 'binding', 'included', 'materials']
for owner, source in [('common_product', 'apps/merchant/web/src/components/products/niche-facts/marginalia-facts-editor.tsx'), ('canonical_variant_uuid', 'apps/merchant/web/src/components/products/niche-facts/marginalia-variant-facts-editor.tsx')]:
    for kind, names in [('book', book + (['excerpt.text', 'excerpt.permission', 'excerpt.attribution'] if owner == 'common_product' else [])), ('stationery', paper)]:
        for key in names:
            ref = f'catalogue:{owner}/{kind}/{key}'
            facts.append({'id': ref, 'kind': kind, 'field': key, 'owner': owner, 'schemaSource': FACTS, 'controlSource': source, 'themeSetting': False, 'caseId': case('MG-C-FACT-' + identity(owner + '-' + kind + '-' + key), 'Use the canonical catalogue control; retain incomplete raw drafts, validate on normal Save, preserve unrelated metadata/UUIDs and omit untouched inventory.', 'catalogue_fact', [ref], ['edit_valid', 'invalid_draft_retained', 'clear_override_or_optional', 'save_full_reload', 'PDP_readback', 'historical_snapshot_after_later_edit'], factsOwner=owner, kind=kind, field=key), 'status': 'NOT_RUN'})

cross = {
    'EDITOR-RECOVERY': ('editor_recovery', 'Exact A/B CAS/re-auth/lost-ack, section AND block selection, stale/forged preview message, unsaved navigation and private/public isolation.', ['a_b_cycle', 'stale_version', 'lost_ack_original_intent', 'reauth_recovery', 'unsaved_navigation', 'preview_message_denial', 'context_selection']),
    'CHROME': ('editor_shared_groups', 'Header/footer groups keep canonical constraints; edit settings/links/visibility and supported lifecycle without inventing group deletion.', OPERATIONS),
    'MEDIA': ('media', 'Declared image/media and resource controls cover upload/library/select/replace/alt/crop when supported, missing/deleted/foreign resources and public privacy.', ['upload', 'library_binding', 'replacement', 'alt', 'crop_applicability', 'missing_deleted_foreign', 'save_reload_publish']),
    'NICHE': ('niche', 'Subject-led discovery, bibliography, synopsis and permission/attribution-gated excerpt; separate paper facts and exact same-UUID edition selection.', ['subject_links', 'synopsis', 'excerpt_permission_positive_negative', 'edition_switch', 'stationery_units', 'unknown_facts']),
    'IDENTITY': ('identity', 'Normal new LetBuyy buyer signup/verification/signin/consent/callback and store-bound customer entry using the sole identity authority.', ['normal_signup', 'verification', 'signin', 'consent_callback', 'store_customer_entry', 'reload', 'profile', 'addresses', 'logout', 'recovery']),
    'IDENTITY-DENIAL': ('identity_security', 'Positive-control-first cross-buyer/store/realm denial; state/PKCE/code replay and missing/expired sessions.', ['positive_own_record', 'wrong_store', 'wrong_buyer', 'wrong_realm', 'state_pkce_code_replay', 'expired_session']),
    'CART-CHECKOUT': ('commerce', 'Canonical theme-specific cart edit/remove/re-add/reload, actual shipping/tax/discount quote, COD and server authority.', ['add_exact_variant', 'quantity', 'remove_readd', 'reload', 'address', 'shipping', 'tax', 'discount', 'quote', 'COD', 'server_total_tamper_refusal']),
    'UNCERTAINTY': ('commerce_recovery', 'OOS/overstock, changed product/price/facts, stale cart/checkout, cancel/network and original-intent uncertain commit recovery with exact effects.', ['OOS', 'overstock', 'held_cart_catalogue_change', 'stale_checkout', 'cancel_dismiss', 'network_loss', 'duplicate', 'original_key_reconciliation']),
    'RAZORPAY': ('actual_provider', 'Actual Marginalia browser Razorpay Test Mode purchase, provider/local order/payment linkage and delivered verified webhook; mocks/COD cannot substitute.', ['test_mode_admission', 'browser_purchase', 'provider_verification', 'actual_HTTPS_webhook_delivery', 'ledger_stock_order_readback', 'buyer_merchant_views']),
    'PROVIDER-ADVERSARIAL': ('shared_provider_security', 'Reuse one admitted shared provider cohort with exact dependency lineage: invalid/wrong/duplicate/out-of-order/race/reconciliation controls.', ['decline_cancel_retry', 'invalid_signature', 'wrong_amount_currency_order_tenant', 'duplicate_out_of_order', 'verify_webhook_race', 'PSP_success_local_failure_reconciliation']),
    'HISTORY': ('history', 'After actual COD and Razorpay orders, same-UUID edits never rewrite accepted facts/options/prices or refill consumed stock.', ['both_views_before', 'persisted_snapshots', 'same_UUID_later_edit_stock_omitted', 'both_views_after', 'exact_old_snapshot_comparison']),
    'REVERSAL': ('reversal', 'Canonical synthetic cancellation/refund/payment reversal with exactly-once inventory/ledger and reconciliation effects; no real fulfillment.', ['cancellation', 'refund_applicability', 'reversal', 'duplicate_refusal', 'ledger_balance', 'reconciliation']),
    'RESPONSIVE': ('quality', 'Measure actual content viewport320/390/768/834/1440, text200%, long English/Tamil/Hindi, loaded approved fonts/images and no overflow.', ['content_viewport_measurement', 'text_scale', 'long_multilingual_labels', 'fonts', 'images', 'overflow', 'preview_desktop_tablet_mobile']),
    'ACCESSIBILITY': ('quality', 'Keyboard/focus/return, composed semantics, validation announcements, contrast, reduced motion and supported theme modes.', ['keyboard', 'focus_return', 'semantics', 'validation_announcements', 'contrast', 'reduced_motion', 'light_dark_applicability']),
    'SECURITY': ('security', 'Current actual Liquid sandbox/SSTI/XSS/privacy and tenant denial on canonical mounted API/ownedPG; never weaken existing gates.', ['sandbox_escape', 'stored_xss', 'url_attribute_escape', 'private_data_absence', 'tenant_positive_then_denial', 'draft_public_isolation', 'frozen_extension_guard']),
    'PERFORMANCE': ('quality', 'Useful readiness and interaction latency under declared conditions, existing budgets, real request/row/byte cost and sample/percentile evidence.', ['budget_admission', 'device_network_data_scope', 'useful_ready', 'interaction', 'requests_bytes_work', 'samples_percentiles']),
    'LINEAGE-CLEANUP-REVIEW': ('release', 'Exact candidate/source/schema/build/artifact lineage, independent reviewer acceptance, protected-state conservation and owned cleanup.', ['lineage', 'preservation', 'owned_cleanup', 'independent_review']),
}
for key, (category, requirement, ops) in cross.items():
    case('MG-C-' + key, requirement, category, ['shared_contract:' + key.lower()], ops)

inventory = {
    'schemaVersion': 1, 'generatedAt': NOW, 'classification': 'SOURCE_DERIVED_DECLARATION_EVIDENCE_NOT_GOVERNANCE_OR_RUNTIME_ACCEPTANCE',
    'theme': 'Marginalia', 'preset': 'dawn', 'version': '2.0.0',
    'authority': 'Verified latest human turn01a16cf8-99f0-7f51-852c-d0fd6ea08262/userMessage01a16cf8-9a07-7cc3-ada1-739b7457b14f in requesting chat01a16ce5-e5ba-7191-ab2c-a1b76947d2b5; current execution runbook and repository authority apply.',
    'inventoryBasis': {'artifact': str(ARTIFACT.relative_to(ROOT)), 'knownAdmittedFileSha256': 'a4e23c63a700f87294a291a1760b94a93d2ee594f9bfea55038c0ff7ab335f3c', 'knownBundleSha256': '5cbe36168853833fda0cf0a81dd5373d5cae013259bdbd330d3ee547f4d3726b', 'lineageReview': '../installed-lifecycle-readiness/48-MG-INSTALL-lineage-actual-review.json', 'notAReaudit': True, 'currentFactoryChain': ['first-party-theme-catalog.ts createFirstPartyCatalogBundle', 'createLetbuyyCoreLiquidThemeBundleFixture', 'createMarginaliaTheme', 'withNicheOrderPresentation'], 'limitation': 'Complete declarations of the admitted2.0.0 distribution artifact plus inspected current owner/control sources. No newly rebuilt current-source bundle or installed current completion candidate is claimed. Reconcile exact schema delta when allocator admits the next candidate.'},
    'templates': templates, 'sectionTypes': sections, 'sectionScopedBlocks': blocks, 'globalBlocks': global_blocks, 'settingDescriptors': fields, 'themeSettings': global_settings, 'catalogueFacts': facts,
    'controlTypesInCurrentRenderer': control_types,
    'mediaAndResourceFields': [r['id'] for r in fields + global_settings if r['descriptor']['type'] in ('image', 'video', 'video_url', 'url', 'product', 'collection', 'blog', 'page', 'menu')],
    'restrictions': ['No product price/stock truth in theme settings.', 'Third-party @app execution remains frozen; advertised seam/guard coverage stays explicit.', 'Header/footer are pinned groups; supported visibility/settings/blocks must be tested without inventing group delete rights.', 'No definition edits, oldruntime adoption, credentials or user-data mutation.'],
    'counts': {'templates': len(templates), 'sectionTypes': len(sections), 'sectionInstances': sum(len(t['instances']) for t in templates), 'sectionScopedBlockTypes': len(blocks), 'globalBlockDefinitions': len(global_blocks), 'sectionAndBlockSettingDescriptors': len(fields), 'themeSettingDescriptors': len(global_settings), 'catalogueFactPathsByOwnerAndKind': len(facts)},
}

originals = []
expected_by_id = {row['id']: row for row in matrix['cases']}
for row in baseline['cases']:
    originals.append({'id': row['id'], 'status': row['status'], 'scope': 'HISTORICAL_RUN936_ACCEPTANCE_ONLY', 'currentCompletionCandidateStatus': 'NOT_RUN', 'evidence': '../' + row['evidence'] if row.get('evidence') else None, 'note': row['note'], 'expected': expected_by_id[row['id']]['expected'], 'runtime': {'runId': baseline['runId'], 'liveLease': False}, 'reuseDecision': 'Preserve exact prior outcome. Reuse on a later candidate requires relevant-source/artifact/dependency review; do not erase nine passes or assume they certify changed inputs.'})

coverage = {'schemaVersion': 1, 'preparedAt': NOW, 'classification': 'EXPANDED_REQUIRED_COVERAGE_NOT_RUNTIME_CERTIFICATION', 'theme': 'Marginalia', 'originalMatrix': {'path': '../installed-book-stationery-lifecycle.matrix.json', 'knownFrozenSha256': 'f65557129858ac0906fd6f7dfd78fc00c6124e30fbd2a52187cb82b8913bed82', 'changed': False}, 'originalResults': {'path': '../stable936-installed-lifecycle.results.json', 'countsPreserved': baseline['counts'], 'runId': baseline['runId'], 'modified': False}, 'originalCases': originals, 'additiveCases': cases, 'countingConvention': 'Composite requirements are cases; per-operation subchecks are not extra cases. Original16 historical outcomes and new required rows have separate denominators. No new PASS from declarations or source tests.', 'newCasesByCategory': dict(collections.Counter(r['category'] for r in cases)), 'additiveCounts': {'PASS': 0, 'FAIL': 0, 'NOT_RUN': len(cases)}, 'currentCompletionCandidate': None, 'allRequiredExecuted': False, 'fullThemeCertified': False}
assert baseline['counts'] == {'PASS': 9, 'FAIL': 0, 'NOT_RUN': 7}
assert len(originals) == 16 and len({r['caseId'] for r in cases}) == len(cases)
assert all(r['status'] == 'NOT_RUN' for r in cases)

source_paths = [
    'packages/theme-engine/src/marginalia-theme.ts', 'packages/theme-engine/src/marginalia-styles.ts', 'packages/theme-engine/src/marginalia-discovery.ts',
    'packages/theme-engine/src/first-party-theme-catalog.ts', 'packages/theme-engine/src/theme-bundle.ts', 'packages/theme-engine/src/theme-bundle-core.ts',
    'packages/theme-engine/src/theme-document.ts', 'packages/theme-engine/src/niche-order-presentation.ts', FACTS, EDITOR, FORM, TREE,
    'apps/merchant/web/src/lib/theme-schemas.ts',
    'apps/merchant/web/src/components/products/niche-facts/marginalia-facts-editor.tsx', 'apps/merchant/web/src/components/products/niche-facts/marginalia-variant-facts-editor.tsx',
    'apps/commerce/web/src/lib/buyer-auth/flow.ts', 'apps/commerce/web/src/app/checkout-origin/checkout/page.tsx',
    'packages/infrastructure/razorpay-adapter/index.ts',
]
manifest = {'recordedAt': NOW, 'headLocator': HEAD, 'branch': 'letbuyy/theme-release-performance-resume', 'headIsNotWorkingTreeAuthority': True, 'scope': 'One bounded static inventory checkpoint. No source lease, build, module execution, database or browser action.', 'sources': []}
for path in source_paths:
    raw = (ROOT / path).read_bytes()
    manifest['sources'].append({'path': path, 'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw), 'sourceModifiedHere': False})

write('CAPABILITY_INVENTORY.json', inventory)
write('COVERAGE.json', coverage)
write('SOURCE_MANIFEST.json', manifest)
write('ACKNOWLEDGEMENT.json', {'recordedAt': NOW, 'humanMandateVerified': True, 'requestingThreadId': '01a16ce5-e5ba-7191-ab2c-a1b76947d2b5', 'humanTurnId': '01a16cf8-99f0-7f51-852c-d0fd6ea08262', 'humanMessageId': '01a16cf8-9a07-7cc3-ada1-739b7457b14f', 'themeGoal': 'ACTIVE', 'phase': 'PHASE0_PREPARATION', 'helperActivationObserved': dispatch['helperActivation'], 'sharedWriter': dispatch.get('activeSharedWriter'), 'browserLease': dispatch.get('activeBrowserLease'), 'proposedQueuePosition': 7, 'queueIsGrant': False, 'oldMarginaliaHeartbeat': 'REMAINS_PAUSED; no new per-theme timer requested', 'communication': 'File-based handoff only. No new recipient reply or helper messaging authorization inferred.', 'sourceOrRuntimeActions': 0, 'priorMatrixAndResultsModified': False, 'counts': inventory['counts'], 'additiveCases': len(cases), 'certification': 'NOT_ISSUED'})
write('CERTIFICATION.json', {'recordedAt': NOW, 'theme': 'Marginalia', 'classification': 'INCOMPLETE_CERTIFICATION_TRACKER_NOT_A_CERTIFICATE', 'LOCAL_E2E_VERIFIED': 'NOT_RUN_ON_COMPLETION_CANDIDATE', 'RAZORPAY_TEST_VERIFIED': 'NOT_RUN', 'REVIEW_ACCEPTED': 'PENDING', 'FULL_THEME_CERTIFIED': False, 'PRODUCTION_DEPLOYED': 'NOT_REQUESTED', 'historicalOriginalCaseCounts': baseline['counts'], 'additiveRequiredCaseCounts': coverage['additiveCounts'], 'candidate': None, 'providerPrerequisite': 'UNVERIFIED: no dedicated Test Mode credential/account/webhook ingress admission has been allocated to this theme. Do not infer that the owner lacks an account or request secrets in chat.', 'requiredOpen': ['OriginalOOS purchase/no-effect plus6cart/COD/history/edit cases', 'All expanded schema/control lifecycle rows', 'Normal buyer/store-customer identity and denial', 'Actual per-theme Razorpay Test Mode purchase/webhooks', 'Current candidate quality/security/recovery', 'Independent review and preservation/cleanup'], 'evidence': ['CAPABILITY_INVENTORY.json', 'COVERAGE.json', 'SOURCE_MANIFEST.json'], 'issuer': None, 'independentReviewer': None})
print(json.dumps({'inventory': inventory['counts'], 'newRequiredCases': len(cases), 'historicalCasesPreserved': baseline['counts'], 'liveActions': 0}, ensure_ascii=False))
