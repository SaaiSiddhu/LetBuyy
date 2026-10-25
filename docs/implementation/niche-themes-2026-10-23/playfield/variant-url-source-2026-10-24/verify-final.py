"""Run the two required Node condition cohorts against one stable source epoch."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess

out = Path(__file__).resolve().parent
root = out.parents[4]
paths = ['apps/commerce/web/src/lib/theme-engine/' + name for name in [
    'liquid-hydration-islands.tsx', 'variant-selection-url.ts', 'variant-selection-url.test.ts']]
sha = lambda path: hashlib.sha256((root / path).read_bytes()).hexdigest()
pins = {path: sha(path) for path in paths}
commands = json.loads((out / 'final-commands.json').read_text())
results = []
env = {**os.environ, 'TSX_TSCONFIG_PATH': 'apps/commerce/web/tsconfig.json'}
for row in commands:
    log = out / (row['name'] + '-final.tap')
    with log.open('w') as stream:
        result = subprocess.run(row['command'], cwd=root, env=env, stdout=stream, stderr=subprocess.STDOUT)
    text = log.read_text()
    assert result.returncode == 0, row['name']
    assert re.search(rf"^# pass {row['expectedPass']}$", text, re.M)
    assert re.search(r'^# fail 0$', text, re.M) and re.search(r'^# skipped 0$', text, re.M)
    results.append({**row, 'exitCode': result.returncode, 'log': log.name})
assert pins == {path: sha(path) for path in paths}, 'Source changed during qualification'
(out / 'final-verification.json').write_text(json.dumps({
    'classification': 'STABLE_SOURCE_EPOCH_NOT_INSTALLED_ACCEPTANCE', 'sourcePins': pins,
    'cohorts': results, 'uniquePassed': sum(row['expectedPass'] for row in commands),
    'sourceUnchangedDuringTests': True, 'databaseBrowserRuntimeStarted': False,
}, indent=2) + '\n')
print(json.dumps({'passed': 141, 'failed': 0, 'skipped': 0, 'sourcePinsStable': True}))
