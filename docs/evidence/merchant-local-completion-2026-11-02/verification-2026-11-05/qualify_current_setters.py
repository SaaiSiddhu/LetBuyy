"""Sequential current-source local managed-role regression; no hosted execution."""
from pathlib import Path
import datetime
import json
import os
import subprocess
from qualify import ROOT, E, snapshot, write

source = json.loads((E / 'document-source-v1.source.json').read_text())
native = json.loads((E / 'native40-independent-readback.json').read_text())
assert native['status'] == 'BOUNDED_LOCAL_NATIVE_WEB_WAREHOUSE_AND_SETTERS_PASS'
assert native['source_sha256'] == source['sha256']
assert snapshot()['files'] == source['files']
terminal = E / 'current-setters-managed-v1.terminal.json'
assert not terminal.exists()
suite = 'tests/owned-db/merchant-transfer-managed-admission.postgres.test.ts'
report_path = E / 'current-setters-managed-v1-runner.json'
logs = E / 'current-setters-managed-v1-logs'
command = ['node', 'scripts/governance/run-executable-suites.mjs', '--jobs', '1',
           '--no-reap', '--kind', 'gateway-db', '--timeout', '600', '--suite', suite,
           '--log-dir', str(logs), '--json-out', str(report_path)]
state = dict(status='RUNNING', supervisor_pid=os.getpid(), source_sha256=source['sha256'],
             started_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
             command=command, scope='Existing unchanged local owned provider-image tests only; no hosted migration/deploy.')
write(E / 'current-setters-managed-v1.active.json', state)
with (E / 'current-setters-managed-v1.log').open('x') as output:
    child = subprocess.Popen(command, cwd=ROOT, stdout=output, stderr=subprocess.STDOUT)
    state['child_pid'] = child.pid
    write(E / 'current-setters-managed-v1.active.json', state)
    state['exit_code'] = child.wait()
state['status'] = 'TERMINAL'
state['source_unchanged'] = snapshot()['files'] == source['files']
state['finished_at'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
if report_path.exists():
    report = json.loads(report_path.read_text())
    state['run_id'] = report['runId']
    state['tests'] = report['tests']
    state['pass'] = report['assertionsPassed']
    state['fail'] = report['assertionsFailed']
    state['skip'] = report['skipped']
    state['cancelled'] = report['cancelled']
    state['cleanup'] = report['cleanup']
    if state['exit_code'] == 0:
        assert report['tests'] > 12 and report['tests'] == report['assertionsPassed']
        assert not any(report[key] for key in ('assertionsFailed', 'cancelled', 'skipped', 'todo', 'failedSuites'))
        assert not report['cleanup']['failures'] and all(not rows for rows in report['cleanup']['remaining'].values())
        text = (logs / 'merchant-transfer-managed-admission.postgres.log').read_text()
        cases = [f'{role} {operation} refuses {context} context with no inventory or audit effect'
                 for role in ('app_tenant', 'service_role', 'postgres')
                 for operation in ('set', 'adjust') for context in ('foreign', 'unset')]
        assert all(case in text for case in cases)
        state['managed_role_setter_denial_cases'] = len(cases)
        remaining = {}
        for kind, args in (('containers', ['ps', '-aq']), ('networks', ['network', 'ls', '-q']), ('volumes', ['volume', 'ls', '-q'])):
            rows = subprocess.check_output(['docker'] + args + [
                '--filter', 'label=com.letbuyy.executable-fixture=1',
                '--filter', 'label=com.letbuyy.executable-fixture.run-id=' + report['runId']], text=True).splitlines()
            assert not rows
            remaining[kind] = rows
        state['independent_remaining'] = remaining
        state['status'] = 'TERMINAL_CURRENT_SOURCE_MANAGED_SETTER_GUARDS_PASS'
write(terminal, state)
write(E / 'current-setters-managed-v1.active.json', state)
print(json.dumps({key: state.get(key) for key in ('status', 'exit_code', 'source_unchanged', 'run_id', 'tests', 'pass', 'fail', 'skip', 'managed_role_setter_denial_cases', 'independent_remaining')}))
raise SystemExit(state['exit_code'] if state['source_unchanged'] else 99)
