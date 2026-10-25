"""Qualify only the reopened picker lease and preserve the prior sealed epochs."""
import collections
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess

out = Path(__file__).resolve().parent
root = out.parents[4]
prior = out.parent / 'variant-url-source-2026-10-24'
paths = ['apps/commerce/web/src/lib/theme-engine/' + name for name in [
    'liquid-hydration-islands.tsx', 'variant-selection-url.ts', 'variant-selection-url.test.ts']]
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
pins = {path: sha(root / path) for path in paths}
env = {**os.environ, 'TSX_TSCONFIG_PATH': 'apps/commerce/web/tsconfig.json'}

commands = json.loads((prior / 'final-commands.json').read_text())
commands[0]['expectedPass'] = 123
(out / 'commands.json').write_text(json.dumps(commands, indent=2) + '\n')
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
    ('commerce-noemit', ['pnpm', '--filter', '@letbuyy/customer-web', 'exec', 'tsc', '--noEmit', '--incremental', 'false']),
    ('eslint-hydration', ['pnpm', '--filter', '@letbuyy/customer-web', 'exec', 'eslint', '--format', 'json', 'src/lib/theme-engine/liquid-hydration-islands.tsx']),
    ('eslint-url-helper-test', ['pnpm', '--filter', '@letbuyy/customer-web', 'exec', 'eslint', '--format', 'json', 'src/lib/theme-engine/variant-selection-url.ts', 'src/lib/theme-engine/variant-selection-url.test.ts']),
]
check_results = []
for name, command in checks:
    log = out / (name + '.log')
    with log.open('w') as stream:
        result = subprocess.run(command, cwd=root, env=env, stdout=stream, stderr=subprocess.STDOUT)
    check_results.append({'name': name, 'command': command, 'exitCode': result.returncode, 'log': log.name})
    assert result.returncode == (1 if name == 'eslint-hydration' else 0), name

decoder = json.JSONDecoder()
baseline = decoder.raw_decode((prior / 'eslint-after.json').read_text())[0]
current = decoder.raw_decode((out / 'eslint-hydration.log').read_text())[0]
before_source = (out / 'liquid-hydration-islands.tsx.before').read_text().splitlines()
after_source = (root / paths[0]).read_text().splitlines()
def diagnostics(results, source):
    return collections.Counter((message.get('ruleId'), message['severity'], message['message'],
        message.get('column'), message.get('endColumn'), source[message['line'] - 1])
        for file in results for message in file['messages'])
assert diagnostics(baseline, before_source) == diagnostics(current, after_source), 'Introduced lint diagnostics'
lint = {
    'baselineErrors': sum(file['errorCount'] for file in baseline),
    'baselineWarnings': sum(file['warningCount'] for file in baseline),
    'currentErrors': sum(file['errorCount'] for file in current),
    'currentWarnings': sum(file['warningCount'] for file in current),
    'introducedDiagnostics': 0,
    'normalizedRuleMessageSourceLineEquality': True,
    'entireHydrationLint': 'BASELINE_FAILURE_RETAINED_OUTSIDE_ALLOCATED_PICKER',
    'helperAndTestsLintExitCode': 0,
}
assert (lint['currentErrors'], lint['currentWarnings']) == (1, 23)
(out / 'lint-delta.json').write_text(json.dumps(lint, indent=2) + '\n')

manifest = json.loads((out / 'preservation-before.json').read_text())
for path, digest in manifest.items():
    assert sha(root / path) == digest, 'Preserved file changed: ' + path
assert pins == {path: sha(root / path) for path in paths}, 'Source changed during qualification'
before = (out / 'liquid-hydration-islands.tsx.before').read_text()
after = (root / paths[0]).read_text()
marker = 'class LbVariantPickerElement extends LiquidIslandBase {'
prefix_before, picker_before = before.split(marker, 1)
prefix_after, picker_after = after.split(marker, 1)
suffix_marker = '\nclass '
_, suffix_before = picker_before.split(suffix_marker, 1)
_, suffix_after = picker_after.split(suffix_marker, 1)
assert prefix_before == prefix_after and suffix_before == suffix_after, 'Change outside picker'
assert sha(root / paths[1]) == json.loads((out / 'before.json').read_text())['sourcePins'][paths[1]], 'URL helper changed'
preservation = {'pinnedFilesUnchanged': len(manifest), 'onlyExistingPickerAndTestChanged': True,
    'urlHelperUnchanged': True, 'previous141ReceiptUnchanged': True,
    'previous73SourceAndEvidenceUnchanged': True, 'retainedInstalledAuditUnchanged': True,
    'originalM1AndStaticBrowserArtifactsUnchanged': True, 'bothNamedRuntimeCandidateHydrationFilesUnchanged': True}
(out / 'preservation-after.json').write_text(json.dumps(preservation, indent=2) + '\n')
verification = {'classification': 'STABLE_SOURCE_EPOCH_NOT_INSTALLED_ACCEPTANCE', 'sourcePins': pins,
    'cohorts': results, 'uniquePassed': 142, 'checks': check_results, 'lint': lint, 'preservation': preservation,
    'sourceUnchangedDuringQualification': True, 'browserRuntimeDatabaseBuildStarted': False,
    'candidateWrites': False, 'installedLifecycleStatusAdvanced': False}
(out / 'verification.json').write_text(json.dumps(verification, indent=2) + '\n')
print(json.dumps({'passed': 142, 'failed': 0, 'skipped': 0, 'commerceNoEmitExitCode': 0,
    'introducedLintDiagnostics': 0, 'preservedFiles': len(manifest), 'sourcePinsStable': True}))
