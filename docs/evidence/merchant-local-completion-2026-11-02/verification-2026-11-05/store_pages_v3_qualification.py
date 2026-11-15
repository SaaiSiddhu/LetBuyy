from pathlib import Path
import datetime
import json
import os
import subprocess
import sys
from qualify import ROOT, E, snapshot, write

source_name = 'store-pages-source-v3'
source = json.loads((E / (source_name + '.source.json')).read_text())
assert snapshot()['files'] == source['files']
assert not (E / 'store-pages-v3-qualification.terminal.json').exists()
sdk = '/Users/saai_mithra/Library/Developer/flutter/bin/flutter'
steps = [
    ('app-analysis', [sys.executable, str(E / 'qualify.py'), 'run', source_name,
                      'store-pages-v3-app-analysis-v1', sdk, 'analyze', '--no-pub']),
    ('full-flutter', [sys.executable, str(E / 'qualify.py'), 'run', source_name,
                      'store-pages-v3-full-flutter-v1', sdk, 'test', '--no-pub']),
    ('governance', [sys.executable, str(E / 'store_pages_v3_governance_capsule.py')]),
    ('android-compile', [sys.executable, str(E / 'build_store_pages_v3_artifact.py'), 'android']),
    ('ios-compile', [sys.executable, str(E / 'build_store_pages_v3_artifact.py'), 'ios']),
    ('artifact-readback', [sys.executable, str(E / 'read_store_pages_v3_artifacts.py')]),
]
state = {'supervisor_pid': os.getpid(), 'source_sha256': source['sha256'],
         'started_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
         'steps': [], 'status': 'RUNNING',
         'ui_kit_analysis': 'Reused fresh confirmation zero-issue UI-kit result; every UI-kit input byte remains equal.'}
for name, command in steps:
    state['active_step'] = name
    write(E / 'store-pages-v3-qualification.active.json', state)
    with (E / ('store-pages-v3-step-' + name + '.log')).open('x') as log:
        result = subprocess.run(command, cwd=ROOT, stdout=log, stderr=subprocess.STDOUT)
    state['steps'].append({'step': name, 'exit_code': result.returncode})
    allowed = result.returncode == 0
    if not allowed:
        state['status'] = 'STOPPED_AT_FAILED_STEP'
        write(E / 'store-pages-v3-qualification.terminal.json', state)
        print(json.dumps(state))
        raise SystemExit(result.returncode or 99)
state['status'] = 'TERMINAL_ORDERED_LOCAL_GATES_PASSED_ZERO_FAILURE_ALLOWANCE'
state['active_step'] = None
state['finished_at'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
state['source_unchanged'] = snapshot()['files'] == source['files']
write(E / 'store-pages-v3-qualification.terminal.json', state)
write(E / 'store-pages-v3-qualification.active.json', state)
print(json.dumps(state))
raise SystemExit(0 if state['source_unchanged'] else 99)
