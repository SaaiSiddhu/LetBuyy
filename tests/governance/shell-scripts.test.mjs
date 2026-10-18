// APPID-P2 — every tracked shell script parses, and the merge script's resurrection guard does what
// its comments say.
//
// WHY. APPID-P1 edited merge-develop.sh with JavaScript's String.replace, whose replacement text treats
// `$'` as "everything after the match". The new RESURRECT pattern ended in `$'`, so the closing quote
// vanished and the rest of the script was pasted back in. The result did not parse, and nothing in the
// gate executes the script, so it stayed broken until the next merge tried to run it. A parse check over
// every tracked script, and a behavioural check of the guard, would each have caught it.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
// Filtered here, not with a glob pathspec: GIT_LITERAL_PATHSPECS=1 (the setting for paths that contain [brackets], as the Next dynamic
// routes do) turns `-- '*.sh'` literal, matches nothing, and made this test fail with "no shell scripts found" for whoever had it set.
const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: repoRoot, encoding: 'utf8' }).split('\0').filter((file) => file.endsWith('.sh'));

test('every tracked shell script parses', () => {
  assert.ok(tracked.length > 0, 'no shell scripts found; the check would be inert');
  const broken = tracked.filter((file) => spawnSync('bash', ['-n', file], { cwd: repoRoot }).status !== 0);
  assert.deepEqual(broken, []);
});

const mergeScript = fs.readFileSync(join(repoRoot, '.claude/skills/letbuyy/scripts/merge-develop.sh'), 'utf8');
const assigned = (name) => {
  const line = mergeScript.split('\n').find((l) => l.startsWith(`${name}='`));
  assert.ok(line, `${name} is not assigned in merge-develop.sh`);
  assert.ok(line.endsWith("'"), `${name} must end with its closing quote`);
  return line.slice(name.length + 2, -1);
};
const RESURRECT = assigned('RESURRECT');
const CONTAINER_OK = assigned('CONTAINER_OK');

// The guard's two stages, run through grep -E exactly as the script runs them.
function flagged(paths) {
  const input = `${paths.join('\n')}\n`;
  const grep = (args, text) => spawnSync('grep', args, { input: text, encoding: 'utf8' }).stdout;
  const stageOne = grep(['-E', RESURRECT], input);
  const stageTwo = grep(['-vE', CONTAINER_OK], grep(['-E', '^apps/(merchant|internal)/'], input));
  return new Set(`${stageOne}${stageTwo}`.split('\n').filter(Boolean));
}

test('the merge script is one body, not a pasted copy', () => {
  assert.equal(mergeScript.split('git -C "$D" commit -q -m').length - 1, 1);
  assert.ok(mergeScript.indexOf("CONTAINER_OK='") < mergeScript.indexOf('RES="$('), 'CONTAINER_OK must be defined before the check uses it');
});

test('the resurrection guard flags retired roots, secrets and container escapes, and passes current roots', () => {
  const retired = [
    'apps/customer_app/lib/main.dart', 'apps/customer_web/src/app/page.tsx', 'apps/merchant_web/package.json',
    'apps/merchant_app/pubspec.yaml', 'apps/admin_web/src/x.ts', 'apps/admin_app/AGENTS.md',
    'apps/identity-platform/package.json', 'apps/marketing-site/package.json', 'apps/phase_2/rider_app/pubspec.yaml',
    'apps/mobile/shopper-app/AGENTS.md', 'apps/platform-operations-portal/package.json', 'apps/commerce/web/consumer-storefront/x.ts',
  ];
  const secrets = ['apps/marketplace/mobile/android/key.properties', 'apps/marketplace/mobile/android/app/upload.jks', 'apps/commerce/web/.env.local'];
  const escapes = ['apps/merchant/package.json', 'apps/merchant/tools/x.ts', 'apps/internal/scripts/y.ts'];
  const current = [
    'apps/commerce/web/src/app/page.tsx', 'apps/merchant/web/package.json', 'apps/merchant/mobile/pubspec.yaml',
    'apps/internal/console/src/x.ts', 'apps/platform/identity/package.json', 'apps/marketplace/mobile/lib/main.dart',
    'apps/frozen/operations-portal/package.json', 'apps/deferred/delivery/mobile/pubspec.yaml', 'reference/apps/store-operations/README.md',
  ];
  const hits = flagged([...retired, ...secrets, ...escapes, ...current]);
  for (const path of [...retired, ...secrets, ...escapes]) assert.ok(hits.has(path), `the guard missed ${path}`);
  for (const path of current) assert.ok(!hits.has(path), `the guard flagged the current path ${path}`);
});
