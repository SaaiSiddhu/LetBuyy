"""Independent current source, installed bytes, real calls and owned cleanup."""
from pathlib import Path
import datetime
import hashlib
import json
import subprocess
import zipfile
from qualify import ROOT, E, snapshot, write

digest = lambda b: hashlib.sha256(b).hexdigest()
prepared = json.loads((E / 'native57-prepared-final.json').read_text())
controls = Path(prepared['root'])
run = controls / 'native-warehouse-v57'
read = lambda name: json.loads((run / name).read_text())
source = json.loads((E / prepared['source_manifest']).read_text())
assert snapshot()['files'] == source['files']
assert all(digest(Path(item['path']).read_bytes()) == item['sha256']
           for item in prepared['inputs'])
report = json.loads((controls / 'native-switcher-v57.json').read_text())
assert report['failedSuites'] == 0
assert report['tests'] == report['assertionsPassed'] == 1
assert all(report[k] == 0 for k in ('assertionsFailed', 'cancelled', 'skipped', 'todo'))
assert report['results'][0]['code'] == 0
assert not report['cleanup']['failures']
assert all(not rows for rows in report['cleanup']['remaining'].values())
cleanup = json.loads((controls / 'switcher-v57-launcher-cleanup.json').read_text())
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
compiled = read('compiled-workers.json')
assert compiled['run_id'] == report['runId'] and compiled['hosted'] is False
assert compiled['runtime'] == 'workerd'
assert digest((run / 'compiled-gateway.mjs').read_bytes()) == compiled['gateway_sha256']
assert digest((run / 'compiled-mobile-bff.mjs').read_bytes()) == compiled['bff_sha256']

screenshots = {}
for name in ('native-initial-picker-observed.json', 'native-two-stores.json', 'web-alpha-updated.json',
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

receipt = json.loads((controls / 'android-device-receipt-switcher-v57.json').read_text())
adb = [receipt['sdk_root'] + '/platform-tools/adb', '-P', str(receipt['adb_port']), '-s', receipt['serial']]
def device(*args):
    return subprocess.check_output(adb + list(args), text=True, stderr=subprocess.PIPE, timeout=25).strip()
assert device('emu', 'avd', 'name').splitlines()[0] == receipt['avd_name']
installed = device('shell', 'pm', 'path', 'com.letbuyy.store').removeprefix('package:')
assert installed.startswith('/data/app/')
assert device('shell', 'sha256sum', installed).split()[0] == artifact['sha256']
reverse = sorted(row.split() for row in device('reverse', '--list').splitlines() if row.strip())
assert reverse == cleanup['baseline']
baseline = json.loads((controls / 'switcher-v57-forward-baseline.json').read_text())
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
out = {
    'at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'status': 'BOUNDED_LOCAL_53_MEMBERSHIP_NATIVE_WEB_STAFF_PASS',
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
    'limits': 'Synthetic local Android/web/compiled-Worker/Postgres journey only. No native invitation delivery/consent, all roles or combinations, iOS runtime, real challenge/provider, hosted, physical performance, signed release or full122 acceptance.'
}
assert not (E / 'native57-independent-readback.json').exists()
write(E / 'native57-independent-readback.json', out)
print(json.dumps({k: out[k] for k in ('status', 'run_id', 'source_sha256', 'apk_sha256', 'remaining')}))
