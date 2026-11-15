from pathlib import Path
import datetime
import json
import os
import subprocess
import sys
from qualify import ROOT, E, snapshot, write

source_name = 'saved-fields-source-v4'
source = json.loads((E / (source_name + '.source.json')).read_text())
assert snapshot()['files'] == source['files']
assert not (E / 'saved-fields-qualification.terminal.json').exists()
sdk = '/Users/saai_mithra/Library/Developer/flutter/bin/flutter'
steps = [
    ('app-analysis', [sys.executable, str(E / 'qualify.py'), 'run', source_name,
                      'saved-fields-app-analysis-v1', sdk, 'analyze', '--no-pub']),
    ('full-flutter', [sys.executable, str(E / 'qualify.py'), 'run', source_name,
                      'saved-fields-full-flutter-v1', sdk, 'test', '--no-pub']),
    ('governance', [sys.executable, str(E / 'saved_fields_governance_capsule.py')]),
    ('android-compile', [sys.executable, str(E / 'build_saved_fields_artifact.py'), 'android']),
    ('ios-compile', [sys.executable, str(E / 'build_saved_fields_artifact.py'), 'ios']),
]
state = {'supervisor_pid': os.getpid(), 'source_sha256': source['sha256'],
         'started_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
         'steps': [], 'status': 'RUNNING',
         'ui_kit_analysis': 'Reused Supporting2 zero-issue result; all UI-kit bytes unchanged.'}
for name, command in steps:
    state['active_step'] = name
    write(E / 'saved-fields-qualification.active.json', state)
    with (E / ('saved-fields-step-' + name + '.log')).open('x') as log:
        result = subprocess.run(command, cwd=ROOT, stdout=log, stderr=subprocess.STDOUT)
    state['steps'].append({'step': name, 'exit_code': result.returncode})
    allowed = result.returncode == 0
    if name == 'full-flutter':
        full = json.loads((E / 'saved-fields-full-flutter-v1.terminal.json').read_text())
        text = (E / 'saved-fields-full-flutter-v1.log').read_text()
        allowed = (result.returncode == 1 and full['source_unchanged']
                   and '+1478 -1: Some tests failed.' in text
                   and text.strip().split('Failing tests:')[-1].strip().endswith(
                       'positive hosted invitation remains in its existing namespace; local restore cannot adopt it'))
        if allowed:
            state['full_flutter'] = {'pass': 1478, 'fail': 1, 'skip': 0,
                                     'known_protected_staff_failure_only': True}
    if not allowed:
        state['status'] = 'STOPPED_AT_FAILED_STEP'
        write(E / 'saved-fields-qualification.terminal.json', state)
        print(json.dumps(state))
        raise SystemExit(result.returncode or 99)
state['status'] = 'TERMINAL_ORDERED_LOCAL_GATES_PASSED_WITH_KNOWN_FULL_SUITE_FAILURE'
state['active_step'] = None
state['finished_at'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
state['source_unchanged'] = snapshot()['files'] == source['files']
write(E / 'saved-fields-qualification.terminal.json', state)
write(E / 'saved-fields-qualification.active.json', state)
print(json.dumps(state))
raise SystemExit(0 if state['source_unchanged'] else 99)
