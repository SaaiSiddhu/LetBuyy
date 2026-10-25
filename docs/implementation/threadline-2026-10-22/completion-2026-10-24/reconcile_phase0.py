"""Source-derived evidence only. Reads JSON/UTF-8; never imports application code.

This is not a theme schema, runtime, test harness or governance authority. Write
once into this owned folder. Future observations belong in new dated records.
"""
from pathlib import Path
from collections import Counter
from datetime import datetime, timezone
import difflib
import hashlib
import json
import re
import subprocess

ROOT = Path(__file__).resolve().parents[4]
OUT = Path(__file__).resolve().parent
assert ROOT == Path('/Volumes/Projects/LetBuyy')
assert OUT == ROOT / 'docs/implementation/threadline-2026-10-22/completion-2026-10-24'
NOW = datetime.now(timezone.utc).isoformat()
BASE = 'docs/implementation/threadline-2026-10-22'
PROGRAMME = 'docs/implementation/niche-theme-programme/completion-2026-10-24'
MIGRATION = 'database/supabase/migrations/382_threadline_catalog_v2.sql'
FACTORY = 'packages/theme-engine/src/threadline-theme.ts'
EDITOR = 'apps/merchant/web/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx'
PIN = '61082be647eadae9b6e42002be241a82ba6c3627427568f6e64e2cf961c3742e'

def sha(data):
    return hashlib.sha256(data).hexdigest()

def read(path):
    return (ROOT / path).read_text()

def load(path):
    return json.loads(read(path))

def pointer(*parts):
    return '/' + '/'.join(str(p).replace('~', '~0').replace('/', '~1') for p in parts)

def ref(path, token=None):
    source = read(path)
    return {'path': path, 'line': source[:source.index(token)].count('\n') + 1 if token and token in source else 1}

def write(name, value):
    with (OUT / name).open('x') as f:
        f.write(json.dumps(value, indent=2, ensure_ascii=False) + '\n' if not isinstance(value, str) else value)

sql = read(MIGRATION)
artifact_text = sql.split('$liquidbundle$')[1]
artifact = json.loads(artifact_text)
bundle = artifact['document']['liquidBundle']
bundle_sha = sha(json.dumps(bundle, ensure_ascii=False, separators=(',', ':')).encode())
assert bundle_sha == PIN
original = load(f'{BASE}/installed-lifecycle-index/installed-threadline-lifecycle.index.json')
assert len(original['pendingObligations']) == 26
assert all(row['freshCorrectedRunStatus'] == 'NOT_RUN' for row in original['pendingObligations'])
page = read(EDITOR)
branch = subprocess.check_output(['git', 'branch', '--show-current'], cwd=ROOT, text=True).strip()
head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()

structural_ops = ['select_exact_identity', 'add', 'apply', 'edit', 'reorder', 'hide', 'show',
                  'save', 'full_reload', 'private_preview', 'publish', 'public_readback',
                  'delete', 'save_reload_absence', 'publish_public_absence', 're_add',
                  'rebind', 'undo', 'redo', 'recover']
field_ops = ['set_valid', 'clear', 'invalid_boundary', 'save', 'full_reload',
             'private_preview', 'publish', 'public_readback', 'undo', 'redo', 'recover']
resource_ops = ['search', 'page_two', 'choose_real_uuid', 'replace', 'clear',
                'missing_resource', 'foreign_resource_denied', 'unavailable_recovery']
media_ops = ['upload', 'browse_library', 'replace', 'remove', 're_add',
             'invalid_type_or_size', 'upload_failure_recovery', 'public_asset_load',
             'alternative_text_semantics', 'crop_or_focal_binding']

def states(operations):
    return {operation: 'NOT_RUN' for operation in operations}

def field_record(scope, key, descriptor, source_pointer, section=None, block=None):
    kind = descriptor.get('type')
    operations = list(field_ops)
    if kind in ['range', 'number']: operations += ['zero', 'min_max_step']
    if kind in ['toggle', 'checkbox']: operations += ['false', 'true']
    if kind in ['select', 'radio']: operations += ['each_declared_option', 'unknown_option_preserved_or_rejected']
    if kind in ['product', 'collection', 'page', 'blog', 'menu']: operations += resource_ops
    if kind == 'image': operations += media_ops
    if kind in ['text', 'textarea', 'richtext']: operations += ['long_english', 'hindi', 'tamil', 'escaping']
    return {'id': f'{scope}/{key}', 'field': key, 'sectionType': section, 'blockType': block,
            'descriptor': descriptor, 'sourcePointer': source_pointer,
            'controlSource': 'apps/merchant/web/src/components/theme-editor/SchemaFormRenderer.tsx',
            'merchantControlObservedInBrowser': False, 'operations': list(dict.fromkeys(operations)),
            'applicability': 'PROTECTED_SEAM_DENIAL' if block == '@app' or section == 'app-block-slot' else 'REQUIRED',
            'renderBinding': 'UNVERIFIED', 'currentStatus': 'NOT_RUN'}

templates = []
instances = []
sections = []
fields = []
blocks = []
for template_key, template in bundle['templates'].items():
    group = template_key in ['header', 'footer']
    templates.append({'key': template_key, 'name': template['name'], 'kind': 'shared_group' if group else 'page',
                      'sourcePointer': pointer('document', 'liquidBundle', 'templates', template_key),
                      'order': template['order'], 'layout': template.get('layout'),
                      'alternateSuffix': template_key.split('.', 1)[1] if '.' in template_key else None,
                      'operations': ['open', 'select_correct_resource', 'edit', 'save', 'full_reload',
                                     'preview_desktop_tablet_mobile', 'publish', 'public_readback',
                                     'preserve_unselected_templates', 'recover'], 'status': 'NOT_RUN'})
    for key, instance in template['sections'].items():
        instances.append({'template': template_key, 'sectionId': key, **instance,
                          'sourcePointer': pointer('document', 'liquidBundle', 'templates', template_key, 'sections', key),
                          'blockInstances': list(instance.get('blocks', {})), 'status': 'NOT_RUN'})

binding_fields = {'featured-products': ['requireSelection', 'product1', 'product2', 'product3'],
                  'product-grid': ['collectionId']}
direct_gaps = {'category-grid': ['subtitle'], 'collection-product-list': ['title'],
               'customer-order-detail': ['heading']}
for section_type, section_file in bundle['sections'].items():
    schema = section_file['schema']
    rendered_source = section_file['source'].split('{% schema %}')[0]
    record = {'type': section_type, 'name': schema['name'], 'sourcePath': section_file['path'],
              'sourcePointer': pointer('document', 'liquidBundle', 'sections', section_type),
              'liquidSourceSha256': sha(section_file['source'].encode()), 'schema': schema,
              'instantiatedAt': [{'template': i['template'], 'sectionId': i['sectionId']} for i in instances if i['type'] == section_type],
              'pinnedChrome': section_type in ['header', 'footer'],
              'declaredAddPolicy': {'enabledOn': schema.get('enabled_on'), 'disabledOn': schema.get('disabled_on'),
                                    'editorExcludesPinned': section_type in ['header', 'footer']},
              'operations': structural_ops, 'status': 'NOT_RUN'}
    if section_type == 'app-block-slot': record['applicability'] = 'FROZEN_SEAM_SAFETY_ONLY_NO_ACTIVATION'
    sections.append(record)
    for index, descriptor in enumerate(schema['settings']):
        key = descriptor['id']
        f = field_record(f'section/{section_type}', key, descriptor,
                         pointer('document', 'liquidBundle', 'sections', section_type, 'schema', 'settings', index), section_type)
        f['directLiquidReference'] = bool(re.search(r'section\.settings\.' + re.escape(key) + r'\b', rendered_source))
        if key in binding_fields.get(section_type, []):
            f['renderBinding'] = 'EXTERNAL_CANONICAL_DATA_BINDING_NOT_A_MISSING_LIQUID_REFERENCE'
            f['bindingSource'] = 'apps/commerce/web/src/lib/theme-engine/data-binding-engine.ts'
        elif key in direct_gaps.get(section_type, []): f['renderBinding'] = 'OPEN_DECLARED_CONTROL_OUTPUT_GAP'
        elif section_type == 'app-block-slot': f['renderBinding'] = 'PROTECTED_FROZEN_SEAM'
        else: f['renderBinding'] = 'DIRECT_LIQUID_REFERENCE_BROWSER_UNVERIFIED'
        fields.append(f)
    runtime_blocks = artifact['sectionSchemas'][section_type].get('blocks_schema', {})
    for index, block in enumerate(schema['blocks']):
        block_type = block['type']
        effective = runtime_blocks.get(block_type, {}).get('fields', {})
        blocks.append({'id': f'{section_type}/{block_type}', 'sectionType': section_type, 'type': block_type,
                       'inlineDeclaration': block, 'effectiveFields': effective,
                       'sourcePointer': pointer('document', 'liquidBundle', 'sections', section_type, 'schema', 'blocks', index),
                       'effectiveSchemaPointer': pointer('sectionSchemas', section_type, 'blocks_schema', block_type),
                       'nestedChildDeclarations': block.get('blocks', []), 'operations': structural_ops,
                       'applicability': 'PROTECTED_SEAM_DENIAL' if block_type == '@app' else 'REQUIRED',
                       'status': 'NOT_RUN'})
        for key, descriptor in effective.items():
            fields.append(field_record(f'block/{section_type}/{block_type}', key, descriptor,
                                      pointer('sectionSchemas', section_type, 'blocks_schema', block_type, 'fields', key), section_type, block_type))
for group, config in bundle['config']['settings_schema']['settings'].items():
    for key, descriptor in config['fields'].items():
        fields.append(field_record(f'global/{group}', key, descriptor,
                                  pointer('document', 'liquidBundle', 'config', 'settings_schema', 'settings', group, 'fields', key)))

editor_modules = [
    ('template_selection', ['select_each_declared_template', 'slash_key_preservation', 'unsaved_switch_protection']),
    ('section_tree', ['exact_duplicate_selection', 'keyboard_navigation', 'add', 'remove', 'reorder', 'hide_show']),
    ('block_properties', ['add_each_declared_type', 'select_nested_identity', 'edit', 'remove', 're_add', 'reorder', 'hide_show']),
    ('theme_settings', ['all_12_declared_fields', 'false_zero_clear', 'font_load', 'semantic_palette_readback']),
    ('theme_styles', ['style_only', 'review_additive_layout', 'review_complete_design', 'content_risk_diff', 'cancel', 'apply', 'undo']),
    ('draft_save', ['ack_revision', 'full_reload', 'duplicate_action', 'lost_response_original_intent', 'stale_conflict', 'account_change']),
    ('preview', ['desktop', 'tablet', 'mobile', 'exact_section_and_block_inspector', 'forged_message_denial', 'stale_message_denial', 'error_retry', 'no_draft_leak']),
    ('preview_resources', ['product_uuid', 'collection_uuid', 'page_uuid', 'article_via_blog_picker', 'blog_page', 'foreign_missing_denial']),
    ('publication_history', ['publish_A', 'anonymous_A', 'publish_B', 'restore_A', 'draft_B_preserved', 'reapply_B', 'uncertain_publish_recovery']),
    ('document_history', ['text_undo_redo', 'section_undo_redo', 'block_undo_redo', 'safe_reload_recovery']),
    ('mobile_panels', ['sections', 'preview', 'properties', 'focus_return', 'narrow_viewport']),
    ('smart_defaults', ['honest_deterministic_label', 'copy', 'blocks', 'layout', 'undo', 'unknown_field_preservation']),
    ('media_resources', ['upload', 'browse_library', 'replace', 'clear', 'missing_resource', 'network_error_recovery']),
    ('alternate_templates', ['create_owned_alternate', 'switch', 'edit', 'save_reload', 'bind_resource', 'preview_publish', 'delete_re_add']),
]
inventory = {'schemaVersion': 1, 'classification': 'SOURCE_DERIVED_EVIDENCE_NOT_GOVERNANCE_OR_RUNTIME_ACCEPTANCE',
             'recordedAt': NOW, 'theme': 'Threadline', 'preset': 'sense', 'slug': 'letbuyy-sense',
             'version': '2.0.0', 'source': {'head': head, 'branch': branch, 'capture': MIGRATION,
                 'embeddedArtifactSha256': sha(artifact_text.encode()), 'bundleSha256': bundle_sha,
                 'factory': FACTORY, 'manifest': 'SOURCE_SNAPSHOT.json',
                 'scope': 'Exact immutable 382 package and captured editor manifests; current factory/editor source inspected. No current generated candidate or live install has been executed here.'},
             'counts': {'pageTemplates': sum(t['kind'] == 'page' for t in templates),
                        'sharedGroupTemplates': sum(t['kind'] == 'shared_group' for t in templates),
                        'sectionTypes': len(sections), 'sectionInstances': len(instances),
                        'sectionSettingDescriptors': sum(len(s['schema']['settings']) for s in sections),
                        'sectionBlockDeclarations': len(blocks), 'effectiveBlockFields': sum(len(b['effectiveFields']) for b in blocks),
                        'globalThemeFields': sum(f['id'].startswith('global/') for f in fields),
                        'globalBlockDefinitions': len(bundle['blocks']), 'declaredAlternateTemplates': 0,
                        'initialBlockInstances': sum(len(i['blockInstances']) for i in instances)},
             'templates': templates, 'sectionInstances': instances, 'sections': sections, 'blocks': blocks,
             'globalBlockDefinitions': bundle['blocks'], 'fields': fields,
             'editorModules': [{'id': key, 'source': EDITOR, 'operations': ops, 'status': 'NOT_RUN'} for key, ops in editor_modules],
             'settingsData': bundle['config']['settings_data'], 'locales': list(bundle['locales']),
             'mediaAndResourceFields': [f['id'] for f in fields if f['descriptor'].get('type') in ['image', 'url', 'product', 'collection', 'blog', 'page', 'menu']],
             'catalogueAuthority': {'schema': 'packages/commerce-core/src/apparel.ts',
                 'control': 'apps/merchant/web/src/components/products/ApparelFactsEditor.tsx',
                 'fields': ['metadata.apparel.fit', 'metadata.apparel.fabric', 'metadata.apparel.care', 'metadata.apparel.unit',
                            'metadata.apparel.measurements[].size', 'metadata.apparel.measurements[].chest',
                            'metadata.apparel.measurements[].shoulder', 'metadata.apparel.measurements[].length',
                            'variant.id', 'variant.options', 'variant.price', 'inventory'],
                 'constraints': {'fitMax': 1000, 'fabricCareMax': 2000, 'units': ['cm', 'in'], 'maxRows': 30,
                     'sizeMax': 40, 'measurements': 'finite >0 and <=1000; optional', 'uniqueSizeCaseInsensitive': True},
                 'rule': 'Product/variant facts, prices and stock stay in canonical catalogue workflow, never theme settings.'},
             'protected': ['identity/realm/site authority', 'price/tax/shipping/inventory', 'payment provider/signatures',
                           'checkout state', 'published release snapshots', 'frozen 2.0.0 bytes', '@app execution seam'],
             'limits': ['Descriptor inventory is not runtime proof.', 'Header/footer are pinned; verify denied remove/reorder while exercising their editable fields and links.',
                 'No nested children are declared inside these 13 block declarations; all 11 non-@app block declarations still require full lifecycle.',
                 'Inherited non-home sections remain in scope when declared addable; uninstantiated does not mean N/A.',
                 'TemplateSwitcherPanel exists separately but is not mounted by the current page; alternate creation remains an open control gap.',
                 'Promised but absent type-scale/media-alt/crop controls remain explicit gaps; no unrequested new design or merchant control of security fields.']}

cases = []
def case(case_id, requirement, family, operations, source, related=None, section=None, block=None, field=None, template=None):
    return {'caseId': case_id, 'requirement': requirement, 'theme': 'Threadline', 'family': family,
            'template': template, 'sectionType': section, 'blockType': block, 'field': field,
            'required': True, 'status': 'NOT_RUN', 'operations': states(operations),
            'applicability': {'value': 'APPLICABLE', 'reviewer': None},
            'source': {'head': head, 'bundleSha256': bundle_sha, 'references': source},
            'runtime': {'runId': None, 'buildId': None, 'siteId': None, 'actorRealm': None},
            'observed': None, 'evidence': [], 'priorEvidence': [],
            'relatedOriginalIds': related or [], 'review': {'status': 'PENDING', 'reviewer': None},
            'nextAction': 'Execute under recorded source/runtime/browser grant, with exact owned identities and evidence.'}

for row in original['pendingObligations']:
    c = case(row['id'], row['required'], 'RETAINED_ORIGINAL', ['complete_original_obligation'], [], [])
    c['title'] = row['title']
    c['originalStatus'] = row['freshCorrectedRunStatus']
    c['originalIndexReference'] = f'{BASE}/installed-lifecycle-index/installed-threadline-lifecycle.index.json'
    c['priorEvidence'] = [{'key': k, **original['sourceEvidence'][k], 'reuse': 'HISTORICAL_ONLY_PENDING_EXACT_APPLICABILITY_REVIEW'} for k in row['sourceEvidenceKeys']]
    cases.append(c)
for t in templates:
    cases.append(case(f'TL-ED-TEMPLATE-{t["key"]}', f'Entire {t["key"]} template/group lifecycle and correct resource context',
                      'TEMPLATE', t['operations'], [MIGRATION + '#' + t['sourcePointer']], ['TL-NEXT-03','TL-NEXT-05','TL-NEXT-06','TL-NEXT-07','TL-NEXT-08'], template=t['key']))
for s in sections:
    c = case(f'TL-ED-SECTION-{s["type"]}', f'Every declared operation for {s["type"]}', 'SECTION', s['operations'],
             [MIGRATION + '#' + s['sourcePointer'], EDITOR], ['TL-NEXT-03'], section=s['type'])
    if s['pinnedChrome']:
        for operation in ['add','reorder','delete','re_add']: c['operations'].pop(operation)
        c['operations']['reject_illegal_pinned_remove_reorder'] = 'NOT_RUN'
        c['applicability']['reason'] = 'Pinned chrome contract; field/link edits, visibility and persistence still required.'
    if s['type'] == 'app-block-slot':
        c['applicability'] = {'value': 'PROTECTED_SEAM_DENIAL', 'reason': 'ARCH-R9/NEVER-R3: preserve dormant schema and deny live third-party execution.', 'reviewer': None}
        c['operations'] = states(['dormant_seam_preserved', 'untrusted_execution_denied', 'no_capability_activation'])
    cases.append(c)
for instance in instances:
    c = case(f'TL-ED-INSTANCE-{instance["template"]}/{instance["sectionId"]}',
             'Exact instantiated section and every local field, preserving other template/group identities',
             'SECTION_INSTANCE', ['select_exact_identity', 'edit_each_field', 'save', 'full_reload',
                 'preview_correct_resource', 'publish', 'public_readback', 'undo_redo', 'recover'],
             [MIGRATION + '#' + instance['sourcePointer'], EDITOR], ['TL-NEXT-03','TL-NEXT-05'],
             section=instance['type'], template=instance['template'])
    c['sectionId'] = instance['sectionId']
    c['fieldOperationSlots'] = {
        f['field']: states(f['operations']) for f in fields
        if f['sectionType'] == instance['type'] and f['blockType'] is None
    }
    cases.append(c)
for b in blocks:
    c = case(f'TL-ED-BLOCK-{b["id"]}', f'Exact {b["id"]} block identity, values and lifecycle', 'BLOCK', b['operations'],
             [MIGRATION + '#' + b['effectiveSchemaPointer'], EDITOR], ['TL-NEXT-03'], section=b['sectionType'], block=b['type'])
    if b['type'] == '@app':
        c['applicability'] = {'value': 'PROTECTED_SEAM_DENIAL', 'reason': 'Frozen app extension seam; no live app runtime authorized.', 'reviewer': None}
        c['operations'] = states(['saved_seam_preserved', 'unknown_handle_denied', 'no_third_party_execution'])
    else:
        c['sourceGap'] = 'No block reorder/hide control connected in current editor page; shared Editor request TL-DEP-02.'
    cases.append(c)
for f in fields:
    c = case(f'TL-ED-FIELD-{f["id"]}', f'{f["id"]} descriptor → control → persisted value → rendered output',
             'FIELD', f['operations'], [MIGRATION + '#' + f['sourcePointer'], f['controlSource']],
             ['TL-NEXT-03','TL-NEXT-04'], section=f['sectionType'], block=f['blockType'], field=f['field'])
    c['descriptor'] = f['descriptor']
    c['renderBinding'] = f['renderBinding']
    if f['applicability'] == 'PROTECTED_SEAM_DENIAL':
        c['applicability'] = {'value': 'PROTECTED_SEAM_DENIAL', 'reason': 'Only dormant preservation/denial; no third-party execution.', 'reviewer': None}
        c['operations'] = states(['preserve_saved_data', 'reject_untrusted_execution'])
    cases.append(c)
for key, ops in editor_modules:
    cases.append(case(f'TL-ED-MODULE-{key}', f'Connected editor module {key}', 'EDITOR_MODULE', ops, [EDITOR], ['TL-NEXT-03','TL-NEXT-06','TL-NEXT-08']))

additions = [
 ('IDENTITY-01', 'Normal new buyer signup, verification and explicit consent/callback', ['browser_signup','email_capture','verify','signin','consent','store_callback','reload'], [16,17]),
 ('IDENTITY-02', 'Store-bound customer entry uses canonical buyer identity; legacy account form cannot mint parallel authority', ['normal_entry','realm_denial','site_denial','retired_path_denial'], [17,23]),
 ('IDENTITY-03', 'Profile/address create edit delete reload and reauthentication recovery', ['profile','address_add','address_edit','address_delete','reload','reauth_recovery'], [18]),
 ('IDENTITY-04', 'Immediate logout UI, issuer versus store logout and merchant session independence', ['immediate_signed_out','reload_denial','merchant_retained','buyer_reentry'], [19]),
 ('IDENTITY-05', 'State/PKCE/callback/authorization-code/JTI replay and ownership denial', ['positive_control','wrong_state','wrong_pkce','wrong_callback','code_replay','expired_session','cross_buyer','cross_store','cross_realm'], [17,23]),
 ('CATALOGUE-01', 'All apparel fields and measurement rows through normal canonical edit/save/reload', ['valid_values','cm','in','duplicate_size_denied','zero_negative_denied','row_limit','remove_re_add','malformed_legacy','unrelated_metadata_retained'], [4,12]),
 ('CART-01', 'Variant UUID and full size/colour tuple through cart mutation/reload', ['distinct_variants','missing_variant','oos_denied','overstock_denied','quantity','remove_re_add','reload','canonical_amounts'], [12,14,15]),
 ('CART-02', 'Stale catalogue, price/facts/options and inventory while cart held', ['same_uuid_edit','stock_not_replenished','stale_cart','requote','inline_error','selection_retained','retry_original_intent'], [12,14,15]),
 ('CHECKOUT-01', 'Normal trusted hosted checkout address/shipping/tax/discount/COD quote', ['normal_https','no_interstitial','address','shipping','cod_serviceability','discount_valid','discount_invalid','gst_place_of_supply','server_total','tenant_binding'], [20]),
 ('CHECKOUT-02', 'Normal browser COD and original-key duplicate/uncertain-commit recovery', ['cod_submit','one_order','one_stock_effect','canonical_ledger','original_key_replay','altered_command_conflict','same_claim_committed_order_reentry','merchant_and_buyer_readback'], [21,24]),
 ('RAZORPAY-01', 'This theme actual Test Mode buyer purchase through existing adapter', ['secure_test_readiness','browser_pay','provider_order_binding','verify','signed_webhook_delivery','one_local_order','balanced_ledger','buyer_readback','merchant_readback'], [20,21,22]),
 ('RAZORPAY-02', 'Per-theme cancellation/decline/retry with honest provider mode', ['cancel_dismiss','decline','retry_original_intent','no_duplicate_charge','sandbox_badge'], [20,21]),
 ('RAZORPAY-03', 'Exact shared adversarial provider cohort reference, never substituted by mock', ['duplicate_out_of_order','verify_webhook_race','invalid_signature','wrong_order_amount_currency_tenant','raw_body','expired_intent','pa_success_local_failure_suspense','reconciliation'], [21,23,24]),
 ('HISTORY-01', 'After COD and Test Mode orders, edit same UUID catalogue/configuration and prove old snapshots unchanged', ['capture_before','same_uuid_edit','options_price_media_facts_edit','consumed_stock_preserved','archive_if_supported','buyer_after','merchant_after','persisted_snapshot_equality'], [22]),
 ('HISTORY-02', 'Missing/malformed historical facts remain honest and private', ['valid_positive_control','missing_facts','malformed_facts','cross_buyer_denied','cross_store_denied','reload'], [22,23]),
 ('REVERSAL-01', 'Supported cancel/refund/reversal through canonical test-mode authorities', ['authorize_current_actor','once_only','reversal_entries','provider_reconciliation','order_history'], [22,24]),
 ('QUALITY-01', 'Actual content dimensions at 320/390/768/834/1440 and 200% text/zoom', ['measure_content','all_templates','modal_edges','sticky_focus','long_english','tamil','hindi','zoom_200','text_200'], [25]),
 ('QUALITY-02', 'Composed keyboard, accessible names, semantics, announcements and focus', ['menu_escape_return','search_arrows_enter','cart_escape_return','logical_order','visible_focus','error_live_region','screen_reader','reduced_motion','light_dark'], [13,25]),
 ('QUALITY-03', 'Approved fonts, merchant media, missing/unavailable resource recovery', ['font_network_family','script_fallback','image_load','alt_semantics','focal_crop','broken_media','public_host_urls'], [9,25]),
 ('SECURITY-01', 'Liquid sandbox, SSTI/XSS/resource/privacy and preview message denial', ['positive_content','ssti','stored_xss','own_property_only','drop_scrub','parse_render_memory_limits','upload_render_forbidden','stale_forged_preview','draft_private','tenant_negative'], [6,23,25]),
 ('PERF-01', 'Relevant actual navigation/media/mutation readiness and latency budgets', ['define_existing_budget','device_network_scope','request_byte_scope','cold_warm_samples','errors_retained','percentiles','interaction_latency'], [26]),
 ('LINEAGE-01', 'Exact source → installed private version → draft revision → release → runtime → evidence', ['source_closure','schema','package_hash','private_install','build_id','runtime_inputs','release_pointer','evidence_hashes','independent_review'], [1,2,26]),
 ('PRESERVE-01', 'Owned synthetic scope, protected snapshots and official cleanup', ['record_scope_before','no_user_draft_mutation','no_user_session_change','no_replenishment','protected_rows_after','owned_cleanup','independent_review'], [26]),
 ('PROMISE-01', 'Advertised image alt/crop/focal, card-fact, layout and type-scale customization gaps', ['schema_vs_promise','control_presence','binding','valid_bounds','save_reload','preview_publish','review_minimal_compatible_fix'], [3,4,9,25]),
]
for key, requirement, ops, related in additions:
    c = case('TL-ADD-' + key, requirement, 'ADDITIVE_JOURNEY', ops, [PROGRAMME + '/EXECUTION_RUNBOOK.md'], [f'TL-NEXT-{n:02d}' for n in related])
    if key.startswith('RAZORPAY'): c['providerRequirement'] = 'ACTUAL_TEST_MODE; credentials/accepted HTTPS webhook readiness unverified, not assumed missing or available'
    cases.append(c)

snapshot_paths = [MIGRATION, 'database/supabase/rollback/382_threadline_catalog_v2.rollback.sql', FACTORY,
 'packages/theme-engine/src/threadline-styles.ts', 'packages/theme-engine/src/threadline-discovery.ts',
 'packages/theme-engine/src/theme-bundle.ts', 'packages/theme-engine/src/theme-bundle-core.ts',
 'packages/theme-engine/src/experience-apply.ts', 'packages/theme-engine/src/theme-document.ts',
 'packages/theme-engine/src/first-party-theme-catalog.ts', 'packages/theme-engine/test/threadline.test.ts',
 'packages/commerce-core/src/apparel.ts', 'apps/merchant/web/src/components/products/ApparelFactsEditor.tsx',
 'apps/merchant/web/src/app/[store]/products/new/page.tsx', 'apps/merchant/web/src/lib/product-form-state.ts', EDITOR,
 'apps/merchant/web/src/components/theme-editor/SectionTreePanel.tsx',
 'apps/merchant/web/src/components/theme-editor/BlockChildRow.tsx',
 'apps/merchant/web/src/components/theme-editor/SchemaFormRenderer.tsx',
 'apps/merchant/web/src/components/theme-editor/TemplateSwitcherPanel.tsx',
 'apps/merchant/web/src/components/theme-editor/controls/ImagePickerControl.tsx',
 'apps/merchant/web/src/components/theme-editor/controls/ResourcePickerControl.tsx',
 'apps/commerce/web/src/lib/theme-engine/data-binding-engine.ts',
 'apps/commerce/web/src/lib/theme-engine/liquid-hydration-islands.tsx',
 'apps/commerce/web/src/app/store/[subdomain]/liquid-theme.css',
 'docs/implementation/niche-theme-programme/OWNERSHIP.md',
 'docs/implementation/niche-theme-programme/capture-schedule.json',
 PROGRAMME + '/EXECUTION_STATE.json', PROGRAMME + '/EXECUTION_RUNBOOK.md',
 f'{BASE}/installed-lifecycle-index/installed-threadline-lifecycle.index.json',
 'docs/implementation/niche-theme-programme/release-playfield201/catalog394-qualification/native-runs/01/root-interruption-review.json',
 'docs/implementation/niche-theme-programme/collection-count-native/native-runs/02/root-qualification.json',
 'docs/research/shopify-product-intelligence/free-themes-niche-study-2026-10-22/letbuyy-design-blueprints/01-sense-threadline.md']
snapshot_paths += [v['path'] for v in original['sourceEvidence'].values()]
snapshot_paths = sorted(set(snapshot_paths))
snapshot = []
for p in snapshot_paths:
    path = ROOT / p
    snapshot.append({'path': p, 'sha256': sha(path.read_bytes()), 'bytes': path.stat().st_size} if path.is_file() else {'path': p, 'exists': False})
historical = []
for k, v in original['sourceEvidence'].items():
    p = ROOT / v['path']
    actual = sha(p.read_bytes()) if p.exists() else None
    historical.append({'key': k, **v, 'actualSha256': actual, 'matchesOriginalPin': actual == v['sha256'],
                       'reuse': 'Historical claim only; current candidate requires applicability and independent review.'})
coverage = {'schemaVersion': 1, 'classification': 'REQUIRED_COVERAGE_PLAN_NO_RUNTIME_CREDIT', 'recordedAt': NOW,
 'theme': 'Threadline', 'retainedOriginalIds': [r['id'] for r in original['pendingObligations']],
 'originalIndex': f'{BASE}/installed-lifecycle-index/installed-threadline-lifecycle.index.json',
 'inventory': 'CAPABILITY_INVENTORY.json', 'caseCountMeaning': 'Requirement records with operation slots, not executed tests or additive unique browser pass totals.',
 'countsByFamily': dict(Counter(c['family'] for c in cases)), 'currentCounts': dict(Counter(c['status'] for c in cases)),
 'runtimeExecutionPerformed': False, 'cases': cases,
 'historicalEvidenceIntegrity': historical,
 'review': {'status': 'PENDING', 'reviewer': None, 'independentAcceptance': False},
 'certification': {'LOCAL_E2E_VERIFIED': 'NOT_RUN','RAZORPAY_TEST_VERIFIED': 'NOT_RUN',
                   'REVIEW_ACCEPTED': 'PENDING','FULL_THEME_CERTIFIED': False,'PRODUCTION_DEPLOYED': 'NOT_REQUESTED'}}
snapshot_doc = {'schemaVersion': 1, 'recordedAt': NOW, 'branch': branch, 'head': head,
 'classification': 'BOUNDED_READ_SNAPSHOT_NOT_SOURCE_FREEZE_OR_EXECUTION_LEASE', 'files': snapshot,
 'threadContext': {'requestingThreadId':'01a16ce5-e5ba-7191-ab2c-a1b76947d2b5',
                  'humanTurnId':'01a16cf8-99f0-7f51-852c-d0fd6ea08262',
                  'originalOwnerThreadId':'01a161c9-36d1-7802-af70-d346f524bff3',
                  'originalOwnerLatestPauseTurnId':'01a16ce2-9157-7f72-91fa-18380bf34e3f',
                  'readThroughTool':True,'outgoingMessagesSent':False},
 'statusOfRelevantPaths': subprocess.check_output(['git','status','--short','--', *[p for p in snapshot_paths if (ROOT/p).is_file()]],cwd=ROOT,text=True).splitlines(),
 'protectedState': 'No browser/app/database/provider action; no user data or session access; no shared source edited.',
 'executionMode': 'SINGLE AGENT; no subagents, chats, automations or cross-chat dispatch created.'}
write('CAPABILITY_INVENTORY.json', inventory)
write('COVERAGE.json', coverage)
write('SOURCE_SNAPSHOT.json', snapshot_doc)
write('HISTORICAL_EVIDENCE.json', {'recordedAt': NOW,'scope':'INTEGRITY_AND_LINEAGE_ONLY_NO_NEW_ACCEPTANCE','evidence':historical,
 'preservedBoundaries':original['historicalBoundaries']})

source = read(FACTORY)
old1 = '<div class="tl-heading"><h2>{{ section.settings.title }}</h2></div>{% if collections.size > 0 %}'
new1 = '<div class="tl-heading"><div><h2>{{ section.settings.title }}</h2>{% if section.settings.subtitle != blank %}<p>{{ section.settings.subtitle }}</p>{% endif %}</div></div>{% if collections.size > 0 %}'
old2 = "<h1>{{ collection.title | default: 'Clothing' }}</h1>"
new2 = "<h1>{{ collection.title | default: section.settings.title | default: 'Clothing' }}</h1>"
assert source.count(old1) == 1 and source.count(old2) == 1
proposal = source.replace(old1,new1).replace(old2,new2)
diff = ''.join(difflib.unified_diff(source.splitlines(True),proposal.splitlines(True),
    fromfile=FACTORY, tofile=FACTORY + '.UNAPPLIED_SUCCESSOR_VERSION_PROPOSAL'))
write('declared-copy-output.UNAPPLIED.diff', diff)
write('PROPOSAL.json', {'recordedAt': NOW,'status':'PRIVATE_EVIDENCE_ONLY_NOT_SOURCE_ADMITTED_OR_APPLIED',
 'target':FACTORY,'baseSha256':sha(source.encode()),'proposedTextSha256':sha(proposal.encode()),
 'diff':'declared-copy-output.UNAPPLIED.diff', 'findings':['TL-F01','TL-F02'],
 'exactChange':'Render category-grid.subtitle only when nonblank; use collection-product-list.title as fallback after actual collection.title, preserving real collection authority.',
 'gates':['Original owner handoff and allocator lease with exact base hash.',
         'Frozen 2.0.0 source/package/M1 bytes must not be overwritten: allocator must choose an approved versioned successor/dispatch before translating this proposed diff into source.',
         'Render valid/blank/escaped subtitle; real collection title retains precedence; search heading uses configured fallback; all default screenshots preserve visual target.',
         'Save/full reload/private preview/publish/public readback in owned sacrificial draft, exact version/install/release evidence and independent review.'],
 'executed':False,'currentSourceModified':False,'migrationNumberAllocated':False})
print(json.dumps({'status':'PHASE0_EVIDENCE_WRITTEN_NO_RUNTIME_CREDIT','inventory':inventory['counts'],
                  'requirementsByFamily':coverage['countsByFamily'],'allCurrentStatus':coverage['currentCounts'],
                  'historicalPinsMatching':sum(h['matchesOriginalPin'] for h in historical),
                  'historicalPinsTotal':len(historical),'boundedSourceFiles':len(snapshot)}, indent=2))
