"""Independent terminal/artifact/ownership readback; never prints login inputs."""
from pathlib import Path
import datetime
import hashlib
import json
import subprocess
import zipfile
from qualify import ROOT, snapshot, write

evidence = Path(__file__).resolve().parent
prepared = json.loads((evidence / 'native40-prepared.json').read_text())
controls = Path(prepared['root'])
run = controls / 'native-warehouse-v40'
read = lambda name: json.loads((run / name).read_text())
digest = lambda data: hashlib.sha256(data).hexdigest()
source = json.loads((evidence / prepared['source_manifest']).read_text())
assert snapshot()['files'] == source['files'], 'Current canonical source differs'
assert all(digest((controls / name).read_bytes()) == sha
           for name, sha in prepared['inputs'].items()), 'Controller inputs changed'
report = json.loads((controls / 'native-warehouse-v40.json').read_text())
assert report['failedSuites'] == 0 and report['tests'] == report['assertionsPassed'] == 1
assert all(report[k] == 0 for k in ('assertionsFailed', 'cancelled', 'skipped', 'todo'))
assert not report['cleanup']['failures']
assert all(not rows for rows in report['cleanup']['remaining'].values())
assert report['results'][0]['code'] == 0
cleanup = json.loads((controls / 'warehouse-v40-launcher-cleanup.json').read_text())
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
proofs = {name: read(name) for name in (
    'backend-verified.json', 'stock-backend-verified.json',
    'setter-backend-verified.json', 'stock-document-native-read.json',
    'native-auth-observed.json', 'staff-ui-observed.json')}
assert all(proof['run_id'] == report['runId'] for proof in proofs.values())
for name in ('backend-verified.json', 'stock-backend-verified.json', 'setter-backend-verified.json'):
    assert proofs[name]['source_sha256'] == native_digest
    assert proofs[name]['apk_sha256'] == artifact['sha256']
compiled = read('compiled-workers.json')
assert compiled['run_id'] == report['runId'] and compiled['hosted'] is False
assert proofs['setter-backend-verified.json']['compiled_workers'] is True
stock = proofs['stock-backend-verified.json']
assert stock['held']['reservations'][0]['status'] == 'active'
assert stock['native']['reservations'][0]['status'] == 'committed'
assert stock['final']['po']['status'] == stock['final']['transfer']['status'] == 'received'
assert len(stock['final']['receipts']) == 11
setter = proofs['setter-backend-verified.json']
assert setter['nativeAdjusted']['product_stock'] == 3
assert setter['webAdjusted']['product_stock'] == 4
assert setter['prerequisite']['reservations'] == setter['nativeAdjusted']['reservations'] == setter['webAdjusted']['reservations']
assert len(setter['receipts']['adjustments']) == len(setter['receipts']['edits']) == 1
retired = read('journey-ready.json')
assert retired['credentials_retired'] is True and 'password' not in retired and 'email' not in retired
receipt = json.loads((controls / 'android-device-receipt-warehouse-v40.json').read_text())
adb = [receipt['sdk_root'] + '/platform-tools/adb', '-P', '15038', '-s', 'emulator-5580']
def device(*args):
    return subprocess.check_output(adb + list(args), text=True, stderr=subprocess.PIPE, timeout=25).strip()
assert device('emu', 'avd', 'name').splitlines()[0] == receipt['avd_name']
installed = device('shell', 'pm', 'path', 'com.letbuyy.store').removeprefix('package:')
assert installed.startswith('/data/app/')
assert device('shell', 'sha256sum', installed).split()[0] == artifact['sha256']
reverse = sorted(tuple(row.split()) for row in device('reverse', '--list').splitlines() if row.strip())
assert [list(row) for row in reverse] == cleanup['baseline']
baseline = json.loads((controls / 'warehouse-v40-forward-baseline.json').read_text())
forward = [row.split() for row in device('forward', '--list').splitlines() if row.strip()]
assert sorted(forward) == sorted(baseline['rows'])
remaining = {}
for kind, args in (
        ('containers', ['ps', '-aq']), ('networks', ['network', 'ls', '-q']),
        ('volumes', ['volume', 'ls', '-q'])):
    rows = subprocess.check_output(['docker'] + args + [
        '--filter', 'label=com.letbuyy.executable-fixture=1',
        '--filter', 'label=com.letbuyy.executable-fixture.run-id=' + report['runId']], text=True).splitlines()
    assert not rows, 'Owned resources remain: ' + kind
    remaining[kind] = rows
markers = []
for app in ('apps/merchant/web', 'apps/platform/identity'):
    for path in (ROOT / app).glob('.next-session-runtime-*.owner.json'):
        value = json.loads(path.read_text())
        if value.get('runId', value.get('run_id')) == report['runId']:
            markers.append(str(path))
assert not markers, 'Current-run Next ownership markers remain'
assert snapshot()['files'] == source['files']
out = {
    'at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'status': 'BOUNDED_LOCAL_NATIVE_WEB_WAREHOUSE_AND_SETTERS_PASS',
    'run_id': report['runId'], 'source_sha256': source['sha256'],
    'source_inputs': source['entries'], 'native_dependency_sha256': native_digest,
    'native_dependency_entries': len(native_source), 'apk_sha256': artifact['sha256'],
    'apk': str(apk), 'installed_bytes_independently_equal': True,
    'compiled_workers': compiled, 'runner_pass': 1, 'runner_fail': 0, 'runner_skip': 0,
    'controller_exit': 0, 'source_and_controller_inputs_unchanged': True,
    'synthetic_login_inputs_retired': True, 'remaining': remaining,
    'next_markers_remaining': markers, 'forward_baseline_restored': True,
    'reverse_baseline_restored': True, 'staff_ui_status': proofs['staff-ui-observed.json']['status'],
    'limits': 'Normal local owner Android/browser/compiled-Worker/Postgres journey only. Synthetic customer hold prerequisite; no buyer-authenticated checkout, real staff effects, variants/allocation permutations, metadata edit/delete, iOS runtime, real provider, hosted, physical performance, signed release or full feature acceptance. Native38 remains unknown.'
}
write(evidence / 'native40-independent-readback.json', out)
print(json.dumps({key: out[key] for key in ('status', 'run_id', 'source_sha256', 'apk_sha256', 'staff_ui_status', 'remaining')}))
