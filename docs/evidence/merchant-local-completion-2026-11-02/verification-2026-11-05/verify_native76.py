"""Independent current source, installed bytes, real calls and owned cleanup."""
from pathlib import Path
import datetime
import hashlib
import json
import subprocess
import zipfile
from qualify import ROOT, E, snapshot, write

digest = lambda b: hashlib.sha256(b).hexdigest()
admission = json.loads((E / 'native76-control-admission.json').read_text())
prepared={'root':'/private/tmp/letbuyy-merchant-local-20261106-dzfklhx4','source_manifest':admission['source_manifest']+'.source.json','inputs':admission['inputs'],'protected_fixture_sha256':'12917f372dee1ecf6610c8888af1caa9a5a80b545388ba0b58570c6b9c6f8510'}
controls = Path(prepared['root'])
run = controls / 'native-warehouse-v76'
read = lambda name: json.loads((run / name).read_text())
source = json.loads((E / prepared['source_manifest']).read_text())
assert snapshot()['files'] == source['files']
assert all(digest(Path(item['path']).read_bytes()) == item['sha256']
           for item in prepared['inputs'])
report = json.loads((controls / 'native-switcher-v76.json').read_text())
assert report['failedSuites'] == 0
assert report['tests'] == report['assertionsPassed'] == 1
assert all(report[k] == 0 for k in ('assertionsFailed', 'cancelled', 'skipped', 'todo'))
assert report['results'][0]['code'] == 0
assert not report['cleanup']['failures']
assert all(not rows for rows in report['cleanup']['remaining'].values())
cleanup = json.loads((controls / 'switcher-v76-launcher-cleanup.json').read_text())
assert cleanup['runner_exit'] == cleanup['controller_exit'] == 0
assert not cleanup['refused'] and cleanup['after'] == cleanup['baseline']

artifact = read('artifact.json')
assert artifact['run_id'] == report['runId'] and artifact['installed_readback']
apk = Path(artifact['apk'])
assert apk.is_relative_to(run) and digest(apk.read_bytes()) == artifact['sha256']
with zipfile.ZipFile(apk) as archive:
    assert 'lib/arm64-v8a/libflutter.so' in archive.namelist()
    assert 'assets/flutter_assets/kernel_blob.bin' in archive.namelist()
native_source = read('source-snapshot.json')
native_digest = digest(json.dumps(native_source, separators=(',', ':'), ensure_ascii=False).encode())
assert native_digest == artifact['source_sha256']
expected = dict(source['files'], **source['diagnostic_custody'])
assert all(expected.get(row['path']) == row['sha256'] for row in native_source)
assert digest((ROOT / 'tests/owned-device/merchant-catalog-local-android.postgres.test.ts').read_bytes()) == prepared['protected_fixture_sha256']

proof = read('switcher-staff-backend-verified.json')
assert proof['run_id'] == report['runId']
assert proof['source_sha256'] == native_digest
assert proof['apk_sha256'] == artifact['sha256']
book = proof['final_database_state']
assert book['alpha_name'] == 'Synthetic Alpha web'
product = book['beta_product']
assert product['name'] == 'Synthetic Beta mobile product' and product['price'] == 100 and product['stock'] == 3
assert product['description'] is None and product['images'] == ['http://127.0.0.1:54352/__owned__/product.png']
assert product['category'] is None and product['metadata']=={'specifications':{'Numeric':42,'Boolean':True,'Empty':'','Null':None},'retained':'Synthetic unmanaged metadata'}
assert book['alpha_roster_count']==53 and book['alpha_roster_byte_equal'] is True
assert book['alpha_roster_before_sha256']==book['alpha_roster_after_sha256'] and len(book['alpha_roster_before_sha256'])==64
media=read('web-product-media-verified.json');assert media['decoded'] is True and media['width']==media['height']==4
assert media['public_api_origin_configured'] is True and media['security_source_unchanged'] is True
assert media['exact_owned_image_origin'] in media['image_csp'].split()
assert isinstance(product['version'], int) and product['version'] > 0
assert book['inventory_before'] == book['inventory_after']
assert len(book['inventory_before']) == 1
assert all(book['inventory_before'][0][key] == value for key, value in {'available': 3, 'reserved': 0, 'committed': 0, 'on_hand': 3}.items())
assert book['product_receipts'] == book['product_audits'] == book['product_outbox'] == 1
assert book['staff'] == {'status': 'removed', 'role': 'viewer', 'active': False}
assert all(book['staff_audits'][action] == 1 for action in ('employee.created', 'employee.updated', 'employee.removed'))
viewport_proof = read('web-switcher-viewport-verified.json')
assert all(viewport_proof[key] is True for key in ('normal_choice_visible','alternate_appearance_choice_visible','focus_reachable','appearance_restored'))
assert viewport_proof['geometry']['scrollHeight'] > viewport_proof['geometry']['clientHeight']
assert viewport_proof['bounds']['y'] >= 0 and viewport_proof['bounds']['y'] + viewport_proof['bounds']['height'] <= viewport_proof['viewport']['height'] + 1
web_switch = read('web-beta-switcher-selected.json')
assert web_switch['normal_header_switcher'] is True and web_switch['staff_store_beyond_page50'] is True
fixture = next(item for item in prepared['inputs'] if item['path'].endswith('.test.ts'))
assert proof['fixture_sha256'] == fixture['sha256']
observed = read('observed-calls.json')
assert observed['run_id'] == report['runId'] and observed['calls'] == proof['calls']
native = [call for call in proof['calls'] if call['source'] == 'actual-mobile-bff']
assert any(call['method'] == 'PATCH' and call['status'] == 200 and
           call['path'].startswith('/v1/stores/') for call in native)
edited = {call['path'] for call in native if call['method'] == 'PATCH'
          and call['status'] == 200 and call['path'].startswith('/v1/products/')}
assert len(edited) == 1
assert any(call['path'] in edited and call['method'] == 'PATCH'
           and call['status'] == 403 for call in native)
memberships = [call for call in native if call['path'] == '/v1/stores'
               and call['method'] == 'GET' and call['status'] == 200]
assert len(memberships) >= 4 and all(not call.get('scope_hint') for call in memberships)
assert any(call.get('store_page') == 2 and call.get('store_total') == 53
           and call.get('data_count') == 3 and call.get('beta_store_present') is True
           for call in memberships)
assert any(call.get('store_page') == 2 and call.get('store_total') == 52
           and call.get('data_count') == 2 and call.get('beta_store_present') is False
           for call in memberships)
staff_reads=[call for call in native if call['path']=='/v1/employees' and call['method']=='GET' and call['status']==200]
assert any(call.get('staff_page')==1 and call.get('staff_total')==53 and call.get('data_count')==50 for call in staff_reads)
assert any(call.get('staff_page')==2 and call.get('staff_total')==53 and call.get('data_count')==3 for call in staff_reads)
restart=read('native-process-restart-verified.json');assert restart['run_id']==report['runId']
assert restart['before_pid']>0 and restart['after_pid']>0 and restart['before_pid']!=restart['after_pid']
assert restart['force_stop_absence']is True and restart['products_tab_visible']is True and restart['saved_beta_visible']is True
compiled = read('compiled-workers.json')
assert compiled['run_id'] == report['runId'] and compiled['hosted'] is False
assert compiled['runtime'] == 'workerd'
assert digest((run / 'compiled-gateway.mjs').read_bytes()) == compiled['gateway_sha256']
assert digest((run / 'compiled-mobile-bff.mjs').read_bytes()) == compiled['bff_sha256']

screenshots = {}
for name in ('native-initial-picker-observed.json', 'native-two-stores.json', 'native-staff-roster-verified.json', 'web-alpha-updated.json',
             'native-beta-web-restart.json', 'web-staff-downgraded.json',
             'native-downgrade-denied.json', 'web-staff-removed.json', 'web-beta-switcher-selected.json', 'web-switcher-viewport-verified.json',
             'native-revoked-store-retired.json', 'native-auth-observed.json'):
    marker = read(name)
    assert marker['run_id'] == report['runId']
    for raw in marker.get('evidence', []):
        p = Path(raw)
        assert p.is_relative_to(run) and p.suffix == '.png'
        assert p.read_bytes().startswith(b'\x89PNG\r\n\x1a\n')
        screenshots[p.name] = digest(p.read_bytes())
for name in ('web-alpha-read-native-and-save.png', 'web-staff-product-mobile-read.png'):
    p = run / name
    assert p.read_bytes().startswith(b'\x89PNG\r\n\x1a\n')
    screenshots[name] = digest(p.read_bytes())
auth = read('native-auth-observed.json')
assert all(auth[k] is True for k in ('normal_browser_form', 'automatic_return', 'no_session_injection'))
retired = read('journey-ready.json')
assert retired['credentials_retired'] is True and 'password' not in retired and 'email' not in retired

receipt = json.loads((controls / 'android-device-receipt-switcher-v76.json').read_text())
adb = [receipt['sdk_root'] + '/platform-tools/adb', '-P', str(receipt['adb_port']), '-s', receipt['serial']]
def device(*args):
    return subprocess.check_output(adb + list(args), text=True, stderr=subprocess.PIPE, timeout=25).strip()
assert device('emu', 'avd', 'name').splitlines()[0] == receipt['avd_name']
installed = device('shell', 'pm', 'path', 'com.letbuyy.store').removeprefix('package:')
assert installed.startswith('/data/app/')
assert device('shell', 'sha256sum', installed).split()[0] == artifact['sha256']
reverse = sorted(row.split() for row in device('reverse', '--list').splitlines() if row.strip())
assert reverse == cleanup['baseline']
baseline = json.loads((controls / 'switcher-v76-forward-baseline.json').read_text())
forward = [row.split() for row in device('forward', '--list').splitlines() if row.strip()]
assert sorted(forward) == sorted(baseline['rows'])
remaining = {}
for kind, args in (('containers', ['ps', '-aq']), ('networks', ['network', 'ls', '-q']),
                   ('volumes', ['volume', 'ls', '-q'])):
    rows = subprocess.check_output(['docker'] + args + [
        '--filter', 'label=com.letbuyy.executable-fixture=1',
        '--filter', 'label=com.letbuyy.executable-fixture.run-id=' + report['runId']], text=True).splitlines()
    assert not rows, 'Current-run owned resources remain: ' + kind
    remaining[kind] = rows
markers = []
for app in ('apps/merchant/web', 'apps/platform/identity'):
    for p in (ROOT / app).glob('.next-session-runtime-*.owner.json'):
        value = json.loads(p.read_text())
        if value.get('runId', value.get('run_id')) == report['runId']:
            markers.append(str(p))
assert not markers
assert snapshot()['files'] == source['files']
upload = read('native-upload-backend-verified.json')
assert upload['run_id']==report['runId']
assert all(upload[k] is True for k in ('receipt_same_id_key_hash','one_original_byte_post','one_public_object','one_library_row','private_public_read_denied'))
assert upload['private_objects']==1 and len(upload['public_sha256'])==64
projection=upload['kyc_projection'];assert len(projection['documents'])==1
kyc_doc=projection['documents'][0]
assert kyc_doc['site_id']==projection['site_id'] and kyc_doc['document_type']=='business_pan'
assert kyc_doc['status']=='submitted' and kyc_doc['has_private_upload']is True and kyc_doc['evidence_scan_status']=='pending'
assert not any(key in kyc_doc for key in ('metadata','private_object_key','object_key','file_name','file_url','download_url','url'))
recovery=read('native-media-recovered.json');assert recovery['run_id']==report['runId']
assert recovery['before_pid']>0 and recovery['after_pid']>0 and recovery['before_pid']!=recovery['after_pid']
assert recovery['recovered_without_original_file']is True and recovery['metadata_saved']is True
assert len(recovery['original_picker_cache_removed'])>=1
for key in ('normal_gallery_image_decoded','normal_gallery_delete','object_retained'):assert read('web-media-deleted.json')[key]is True
assert read('native-web-media-deletion-read.json')['web_removal_visible_after_native_refresh']is True
assert read('native-alpha-details-resumed.json')['native_current_original_name_observed_before_web_rename']is True
kyc_web=read('web-native-kyc-verified.json')
assert all(kyc_web[k]is True for k in ('canonical_api_projection_equal','native_document_visible','last4_visible','private_upload_received','scan_pending_not_provider_verified'))
assert len([c for c in native if c['path']=='/v1/upload'and c['method']=='POST'])==1
assert len([c for c in native if c['path']=='/v1/upload/recover'and c['method']=='POST'and c['status']==200])==1
assert len([c for c in native if c['path']=='/v1/kyc/documents/upload'and c['method']=='POST'and c['status']==201])==1
assert any(c['method']=='DELETE'and c['path'].startswith('/v1/media/')and c['status']==200 for c in proof['calls'])
for name in ('native-media-pending.json','native-media-recovered.json','native-kyc-uploaded.json','native-web-media-deletion-read.json'):
 marker=read(name);assert marker['run_id']==report['runId']
 for raw in marker.get('evidence',[]):
  p=Path(raw);assert p.is_relative_to(run)and p.suffix=='.png';assert p.read_bytes().startswith(b'\x89PNG\r\n\x1a\n');screenshots[p.name]=digest(p.read_bytes())
for name in ('native-media-editor-open.png','web-native-kyc-readback.png','web-native-upload-readback.png'):
 p=run/name;assert p.read_bytes().startswith(b'\x89PNG\r\n\x1a\n');screenshots[name]=digest(p.read_bytes())

out = {
    'at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'status': 'BOUNDED_LOCAL_NATIVE_UPLOAD_RECOVERY_PRIVATE_KYC_WEB_SYNC_53_MEMBERSHIP_STAFF_PASS',
    'run_id': report['runId'], 'source_sha256': source['sha256'],
    'source_inputs': source['entries'], 'native_dependency_sha256': native_digest,
    'native_dependency_entries': len(native_source), 'apk_sha256': artifact['sha256'],
    'apk': str(apk), 'installed_bytes_independently_equal': True,
    'compiled_workers': compiled, 'runner_pass': 1, 'runner_fail': 0, 'runner_skip': 0,
    'source_and_controller_inputs_unchanged': True, 'synthetic_login_inputs_retired': True,
    'remaining': remaining, 'next_markers_remaining': markers,
    'forward_baseline_restored': True, 'reverse_baseline_restored': True,
    'web_viewport': viewport_proof, 'database_state': book, 'normal_web_header_staff_selection': True,
    'native_membership_page_reads': len(memberships), 'screenshots': screenshots,
    'native_upload':upload, 'no_file_recovery':recovery, 'web_kyc':kyc_web, 'normal_web_media_delete_native_refresh':True,
    'limits': 'Synthetic local Android/web/compiled-Worker/Postgres journey only. Test-only local private R2, not India/AWS/provider/KYC approval. No native invitation delivery/consent, all roles/combinations, iOS runtime, real challenge/provider, hosted, physical performance, signed release or full122 acceptance.'
}
assert not (E / 'native76-independent-readback.json').exists()
write(E / 'native76-independent-readback.json', out)
print(json.dumps({k: out[k] for k in ('status', 'run_id', 'source_sha256', 'apk_sha256', 'remaining')}))
