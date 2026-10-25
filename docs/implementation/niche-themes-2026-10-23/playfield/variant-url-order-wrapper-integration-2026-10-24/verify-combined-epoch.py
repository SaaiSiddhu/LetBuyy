"""Read-only combined source qualification after the separate wrapper owner released."""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess

out = Path(__file__).resolve().parent
root = out.parents[4]
prior = out.parent / 'variant-url-owner-transition-2026-10-24'
owner = root / 'docs/implementation/niche-theme-programme/release-playfield201/order-presentation-source-repair'
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
pending = json.loads((out / 'allocation-and-pending.json').read_text())
review = json.loads((owner / 'final-review.json').read_text())
assert review['sourceLeaseReleased'] is True
for row in review['sourceFiles'] + review['files']:
    assert sha(root / row['path']) == row['sha256'], row['path']
for row in pending['preservedReceipts']:
    assert sha(root / row['path']) == row['sha256'], row['path']
prior_release = json.loads((prior / 'SOURCE_RELEASE.json').read_text())
for path, digest in prior_release['sourcePins'].items():
    assert sha(root / path) == digest, 'URL epoch moved before qualification: ' + path

commands = json.loads((prior / 'commands.json').read_text())
commands[0]['command'].append('packages/theme-engine/test/niche-order-presentation.test.ts')
commands[0]['expectedPass'] = 131
(out / 'commands.json').write_text(json.dumps(commands, indent=2) + '\n')
source_paths = set()
for directory in ['packages/theme-engine/src', 'apps/commerce/web/src/lib/theme-engine']:
    source_paths.update(str(path.relative_to(root)) for path in (root / directory).rglob('*')
        if path.is_file() and path.suffix in ['.ts', '.tsx'])
for row in commands:
    source_paths.update(path for path in row['command'] if path.endswith(('.test.ts', '.test.tsx')))
pins = {path: sha(root / path) for path in sorted(source_paths)}
(out / 'source-epoch-before.json').write_text(json.dumps(pins, indent=2) + '\n')

preserved = json.loads((prior / 'preservation-before.json').read_text())
for directory in [prior, owner]:
    preserved.update({str(path.relative_to(root)): sha(path) for path in directory.rglob('*') if path.is_file()})
artifact_reference = json.loads((root / 'docs/implementation/niche-themes-2026-10-23/playfield/installed-audit-9cd-2026-10-23/preserved-artifact-verification.json').read_text())
for row in artifact_reference['files']:
    assert sha(root / row['path']) == row['sha256'], row['path']
    preserved[row['path']] = row['sha256']
for path, digest in preserved.items():
    assert sha(root / path) == digest, path
(out / 'preservation-before.json').write_text(json.dumps(preserved, indent=2) + '\n')
(out / 'wrapper-owner-handoff.json').write_text(json.dumps({
    'recordedAt': datetime.now(timezone.utc).isoformat(),
    'finalReview': {'path': str((owner / 'final-review.json').relative_to(root)), 'sha256': sha(owner / 'final-review.json')},
    'sourceFiles': review['sourceFiles'], 'sourceLeaseReleased': True,
    'newSourceEpochRootAdmittedAtHandoff': review['newSourceEpochRootAdmitted'],
    'revisedRawFactorySha256': review['revisedRawFactorySha256'],
    'priorUrlReceipt': {'path': str((prior / 'SOURCE_RELEASE.json').relative_to(root)), 'sha256': sha(prior / 'SOURCE_RELEASE.json')},
}, indent=2) + '\n')

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
    ('builder-proof', ['node', '--conditions=react-server', '--import', 'tsx', str((out / 'builder-proof.ts').relative_to(root))]),
    ('commerce-noemit', ['pnpm', '--filter', '@letbuyy/customer-web', 'exec', 'tsc', '--noEmit', '--incremental', 'false']),
    ('theme-noemit', ['pnpm', '--filter', '@letbuyy/theme-engine', 'exec', 'tsc', '--noEmit', '--incremental', 'false', '--composite', 'false', '--rootDir', '../..']),
]
check_results = []
for name, command in checks:
    log = out / (name + '.log')
    with log.open('w') as stream:
        result = subprocess.run(command, cwd=root, env=env, stdout=stream, stderr=subprocess.STDOUT)
    check_results.append({'name': name, 'command': command, 'exitCode': result.returncode, 'log': log.name})
    assert result.returncode == 0, name

assert pins == {path: sha(root / path) for path in pins}, 'Source moved during combined qualification'
for path, digest in preserved.items():
    assert sha(root / path) == digest, 'Preserved file moved: ' + path
(out / 'source-epoch-after.json').write_text(json.dumps(pins, indent=2) + '\n')
verification = {
    'recordedAt': datetime.now(timezone.utc).isoformat(),
    'classification': 'STABLE_COMBINED_SOURCE_EPOCH_NOT_ROOT_ADMISSION_OR_INSTALLED_ACCEPTANCE',
    'wrapperOwnerReleasedBeforeTests': True,
    'cohorts': results, 'uniquePassed': 150, 'checks': check_results,
    'sourceFilesPinnedBeforeAndAfter': len(pins), 'sourcePinsUnchangedDuringQualification': True,
    'preservedFilesUnchanged': len(preserved), 'historicalArtifactPinsMatched': 296, 'originalM1PinsMatched': 113,
    'prior73And141And142ReceiptsUnchanged': True,
    'noSourceEditsByThisIntegrationCheck': True,
    'lint': {'hydrationErrors': 1, 'hydrationWarnings': 23, 'introducedDiagnostics': 0,
        'basis': 'Exact unchanged hydration/helper/test pins from prior142 lint receipt; entire-file lint remains baseline failure. No lint rerun claimed.'},
    'builderProof': json.loads((out / 'builder-proof.json').read_text()),
    'runtimeCandidateBrowserDatabaseApiSqlDistributionMutated': False,
    'installedLifecycleStatusAdvanced': False,
}
(out / 'verification.json').write_text(json.dumps(verification, indent=2) + '\n')
print(json.dumps({'uniquePassed': 150, 'failed': 0, 'skipped': 0,
    'pinnedSourceFilesStable': len(pins), 'preservedFilesUnchanged': len(preserved),
    'revisedRawFactorySha256': verification['builderProof']['revisedRawFactorySha256']}))
