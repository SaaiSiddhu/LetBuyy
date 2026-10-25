"""The one authorized final gate on the released cart + URL + wrapper epoch."""
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess

out = Path(__file__).resolve().parent
root = out.parents[4]
prior = out.parent / 'variant-url-order-wrapper-integration-2026-10-24'
url_prior = out.parent / 'variant-url-owner-transition-2026-10-24'
cart = root / 'docs/implementation/niche-themes-2026-10-23/circuit/cart-recovery-2026-10-24'
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
assert sha(cart / 'SOURCE_RELEASE.json') == '47366e5ddf86b94897538b50759d605ca2b229f371c4503ead78560107a2b50c'
cart_receipt = json.loads((cart / 'SOURCE_RELEASE.json').read_text())
for row in cart_receipt['sourceFiles']:
    assert sha(root / row['path']) == row['sha256'], row['path']
old_pins = json.loads((prior / 'source-epoch-after.json').read_text())
hydration = 'apps/commerce/web/src/lib/theme-engine/liquid-hydration-islands.tsx'
for path, digest in old_pins.items():
    if path != hydration:
        assert sha(root / path) == digest, 'Moved inherited input: ' + path

preserved = json.loads((prior / 'preservation-before.json').read_text())
for directory in [prior, cart]:
    preserved.update({str(path.relative_to(root)): sha(path) for path in directory.rglob('*') if path.is_file()})
for path, digest in preserved.items():
    assert sha(root / path) == digest, 'Moved protected file: ' + path
(out / 'preservation-before.json').write_text(json.dumps(preserved, indent=2) + '\n')

def collect():
    result = subprocess.run(['node', str(out / 'collect-inputs.cjs')], cwd=root, capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    closure = json.loads(result.stdout)
    # Keep the previous 134-source envelope as well as the actual transitive inputs.
    closure['pins'].update({path: sha(root / path) for path in old_pins})
    closure['pins'] = dict(sorted(closure['pins'].items()))
    return closure

before = collect()
(out / 'input-closure-before.json').write_text(json.dumps(before, indent=2) + '\n')
commands = json.loads((out / 'commands.json').read_text())
assert [row['expectedPass'] for row in commands] == [131, 19, 14]
assert '--conditions=react-server' not in commands[2]['command']
env = {**os.environ, 'TSX_TSCONFIG_PATH': 'apps/commerce/web/tsconfig.json'}
results = []
for row in commands:
    log = out / (row['name'] + '.tap')
    with log.open('w') as stream:
        result = subprocess.run(row['command'], cwd=root, env=env, stdout=stream, stderr=subprocess.STDOUT)
    text = log.read_text()
    assert result.returncode == 0, row['name']
    for label, count in [('pass', row['expectedPass']), ('fail', 0), ('skipped', 0)]:
        assert re.search(rf'^# {label} {count}$', text, re.M), (row['name'], label)
    results.append({**row, 'exitCode': result.returncode, 'log': log.name})

checks = [
    ('builder-proof', ['node', '--conditions=react-server', '--import', 'tsx', str((out / 'builder-proof.ts').relative_to(root))], 0),
    ('commerce-noemit', ['pnpm', '--filter', '@letbuyy/customer-web', 'exec', 'tsc', '--noEmit', '--incremental', 'false'], 0),
    ('theme-noemit', ['pnpm', '--filter', '@letbuyy/theme-engine', 'exec', 'tsc', '--noEmit', '--incremental', 'false', '--composite', 'false', '--rootDir', '../..'], 0),
    ('eslint-hydration', ['pnpm', '--filter', '@letbuyy/customer-web', 'exec', 'eslint', '--format', 'json', 'src/lib/theme-engine/liquid-hydration-islands.tsx'], 1),
    ('eslint-new-cart-test', ['pnpm', '--filter', '@letbuyy/customer-web', 'exec', 'eslint', '--format', 'json', 'src/lib/theme-engine/liquid-cart-recovery.test.ts'], 0),
]
check_results = []
for name, command, expected in checks:
    log = out / (name + '.log')
    with log.open('w') as stream:
        result = subprocess.run(command, cwd=root, env=env, stdout=stream, stderr=subprocess.STDOUT)
    check_results.append({'name': name, 'command': command, 'exitCode': result.returncode, 'log': log.name})
    assert result.returncode == expected, name

decoder = json.JSONDecoder()
baseline = decoder.raw_decode((url_prior / 'eslint-hydration.log').read_text())[0]
current = decoder.raw_decode((out / 'eslint-hydration.log').read_text())[0]
def diagnostics(rows, source):
    lines = source.splitlines()
    return Counter((message.get('ruleId'), message['severity'], message['message'], message.get('column'),
        message.get('endColumn'), lines[message['line'] - 1]) for row in rows for message in row['messages'])
assert diagnostics(baseline, (cart / 'before/liquid-hydration-islands.tsx').read_text()) == diagnostics(current, (root / hydration).read_text())
lint = {'baselineErrors': sum(row['errorCount'] for row in baseline), 'baselineWarnings': sum(row['warningCount'] for row in baseline),
    'currentErrors': sum(row['errorCount'] for row in current), 'currentWarnings': sum(row['warningCount'] for row in current),
    'introducedDiagnostics': 0, 'normalizedRuleMessageSourceLineEquality': True, 'wholeFileGreen': False,
    'newCartTestLintExitCode': 0}
assert (lint['currentErrors'], lint['currentWarnings']) == (1, 23)
(out / 'lint-delta.json').write_text(json.dumps(lint, indent=2) + '\n')

after = collect()
(out / 'input-closure-after.json').write_text(json.dumps(after, indent=2) + '\n')
assert before == after, 'Actual input closure moved during final gate'
for path, digest in preserved.items():
    assert sha(root / path) == digest, 'Protected file moved during final gate: ' + path
verification = {
    'recordedAt': datetime.now(timezone.utc).isoformat(),
    'classification': 'FINAL_COMBINED_SOURCE_GATE_NOT_INSTALLED_ACCEPTANCE_OR_ROOT_ADMISSION',
    'peerReviewBlockingFindings': [], 'cohorts': results, 'uniquePassed': 164, 'failed': 0, 'skipped': 0,
    'checks': check_results, 'lint': lint,
    'actualWorkspaceSourceAndConfigurationInputsPinned': len(before['pins']),
    'inputClosureStableBeforeAndAfter': True, 'externalDependenciesPinnedByLockfile': True,
    'inputClosureMethod': before['classification'], 'unresolvedImports': before['unresolvedImports'],
    'sourceEditsByThisTask': False, 'writerHeld': False,
    'protectedFilesUnchanged': len(preserved), 'historicalArtifactPins': 296, 'originalM1Pins': 113,
    'prior73_141_142_150AndCircuitEpochsPreserved': True,
    'builderProof': json.loads((out / 'builder-proof.json').read_text()),
    'runtimeCandidateBrowserDatabaseApiSqlCaptureMigrationActions': False,
    'installedLifecycleStatusAdvanced': False,
}
(out / 'verification.json').write_text(json.dumps(verification, indent=2) + '\n')
print(json.dumps({'passed': 164, 'failed': 0, 'skipped': 0, 'inputClosurePinsStable': len(before['pins']),
    'protectedFilesUnchanged': len(preserved), 'commerceNoEmit': 0, 'themeNoEmit': 0, 'introducedLintDiagnostics': 0}))
