from pathlib import Path
import datetime
import hashlib
import json
import plistlib
import subprocess
import zipfile
from qualify import E, snapshot, write

source = json.loads((E / 'merchant-recovery-source-v10.source.json').read_text())
assert snapshot()['files'] == source['files']
at = datetime.datetime.now(datetime.timezone.utc).isoformat()
android = json.loads((E / 'merchant-recovery-v10-android-compile-v1.terminal.json').read_text())
assert android['exit_code'] == 0 and android['source_unchanged']
apk = Path(android['artifact']['path'])
digest = hashlib.sha256(apk.read_bytes()).hexdigest()
assert digest == android['artifact']['sha256']
with zipfile.ZipFile(apk) as archive:
    assert 'lib/arm64-v8a/libflutter.so' in archive.namelist()
    assert 'assets/flutter_assets/kernel_blob.bin' in archive.namelist()
    material_icons = archive.read('assets/flutter_assets/fonts/MaterialIcons-Regular.otf')
    assert len(material_icons) > 1000
assert any('-Ptarget=lib/main.dart' in step['command'] for step in android['steps'])
android_readback = dict(at=at, status='INDEPENDENT_DEBUG_APK_READBACK_PASS',
    source_sha256=source['sha256'], artifact=android['artifact'], actual_sha256=digest,
    compiled_arm64_engine=True, debug_kernel_present=True, normal_main=True,
    installed=False, runtime_verified=False,
    scope='Normal debug compile/archive only. Native58 preserves its own prior StoreSwitcher/Staff artifact acceptance; current KYC changes have no new native acceptance.')
android_readback['material_icons_bytes'] = len(material_icons)
android_readback['material_icons_sha256'] = hashlib.sha256(material_icons).hexdigest()
write(E / 'merchant-recovery-v10-android-artifact-readback.json', android_readback)
ios = json.loads((E / 'merchant-recovery-v10-ios-compile-v1.terminal.json').read_text())
assert ios['exit_code'] == 0 and ios['source_unchanged']
app = Path(ios['artifact']['path'])
files = {str(p.relative_to(app)): hashlib.sha256(p.read_bytes()).hexdigest()
         for p in sorted(app.rglob('*')) if p.is_file()}
assert files == json.loads((E / 'merchant-recovery-v10-ios-compile-v1-artifact-files.json').read_text())['files']
assert hashlib.sha256(json.dumps(files, sort_keys=True, separators=(',', ':')).encode()).hexdigest() == ios['artifact']['manifest_sha256']
info = plistlib.loads((app / 'Info.plist').read_bytes())
arch = subprocess.check_output(['file', str(app / 'Runner')], text=True).strip()
assert 'arm64' in arch
devices = json.loads(subprocess.check_output(['xcrun', 'simctl', 'list', 'devices', '-j'], text=True))
owned = [d for group in devices['devices'].values() for d in group
         if d['udid'] == 'B907B390-5B08-490F-BC6A-8900667B2D94']
assert len(owned) == 1 and owned[0]['state'] == 'Shutdown'
ios_readback = dict(at=at, status='INDEPENDENT_IOS_DEBUG_ARTIFACT_READBACK_PASS',
    source_sha256=source['sha256'], artifact=ios['artifact'], all_retained_files_equal=len(files),
    bundle_id=info['CFBundleIdentifier'], executable_architecture=arch,
    owned_simulator_remains_shutdown=True,
    scope='Debug compile/archive only; no iOS launch, auth, backend, sync or release acceptance.')
icon_paths = [path for path in files if path.endswith('/fonts/MaterialIcons-Regular.otf')]
assert len(icon_paths) == 1 and files[icon_paths[0]] == android_readback['material_icons_sha256']
ios_readback['material_icons_sha256'] = files[icon_paths[0]]
write(E / 'merchant-recovery-v10-ios-artifact-readback.json', ios_readback)
assert snapshot()['files'] == source['files']
print(json.dumps({'source_unchanged': True, 'android_sha256': digest,
                  'ios_files': len(files), 'owned_simulator': owned[0]['state']}))
