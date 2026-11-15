"""Create only a new task-owned AVD. Never read or alter another AVD."""
from pathlib import Path
import datetime
import json
import os
import secrets
import subprocess

evidence = Path(__file__).resolve().parent
sdk = Path('/Volumes/Developer Tools/SDKs/android-sdk')
for port in (5580, 5581, 15038, 54350, 54351, 54352, 54353):
    check = subprocess.run(['lsof', '-nP', '-iTCP:' + str(port), '-sTCP:LISTEN'],
                           capture_output=True, text=True)
    assert check.returncode == 1, 'Required owned port occupied; inspect before proceeding: ' + str(port)
root = Path('/private/tmp/letbuyy-merchant-emulator-' + secrets.token_hex(5))
root.mkdir(mode=0o700)
avds = root / 'avds'
avds.mkdir(mode=0o700)
name = 'LetBuyy_Merchant_Parity_20261106_' + secrets.token_hex(3)
env = dict(os.environ, ANDROID_AVD_HOME=str(avds),
           ANDROID_ADB_SERVER_PORT='15038', ANDROID_HOME=str(sdk),
           ANDROID_SDK_ROOT=str(sdk))
created = subprocess.run([str(sdk / 'cmdline-tools/latest/bin/avdmanager'),
                          'create', 'avd', '--name', name, '--package',
                          'system-images;android-35;google_apis;arm64-v8a',
                          '--path', str(avds / (name + '.avd')), '--device', 'pixel_8'],
                         input='no\n', text=True, capture_output=True, env=env, timeout=45)
(root / 'create.log').write_text(created.stdout + created.stderr)
record = dict(owner='merchant-mobile-parity', root=str(root), name=name,
              avd_home=str(avds), create_exit_code=created.returncode,
              created_at=datetime.datetime.now(datetime.timezone.utc).isoformat())
(root / 'ownership.json').write_text(json.dumps(record, indent=2) + '\n')
assert created.returncode == 0, 'Owned AVD creation failed; retain create.log'
command = [str(sdk / 'emulator/emulator'), '-avd', name, '-port', '5580',
           '-memory', '3072', '-gpu', 'auto', '-no-window', '-no-audio',
           '-no-boot-anim', '-no-snapshot-load', '-no-snapshot-save']
with (root / 'boot.log').open('x') as log:
    child = subprocess.Popen(command, env=env, stdin=subprocess.DEVNULL,
                             stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
record.update(emulator_pid=child.pid, sdk_root=str(sdk), serial='emulator-5580',
              adb_port=15038, command=command, status='BOOT_REQUESTED_NOT_READY',
              scope='Fresh task AVD only; no app installed, credentials entered or other AVD touched.')
out = evidence / 'fresh-owned-emulator-20261106.json'
assert not out.exists(), 'Existing owned boot must be reconciled, never overwritten'
out.write_text(json.dumps(record, indent=2) + '\n')
print(json.dumps({k: record[k] for k in ('root', 'name', 'emulator_pid', 'status')}))
