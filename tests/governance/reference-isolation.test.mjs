// APPID-P2 — the REFERENCE class holds: nothing outside reference/ depends on, installs, builds or
// deploys a donor, and each donor keeps its provenance and transfer record.
//
// Each case runs the real reference-isolation-validator in a throwaway repository that is clean except
// for one injected violation, so a pass on the real tree is not the only evidence the checks work.
// Import statements and machine paths are assembled at runtime: written literally, they would make this
// test file an offender of the validator it tests.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SELLER = 'reference/apps/marketplace-seller';
const STORE_OPS = 'reference/apps/store-operations';
const donorReadme = ['# donor', '## Provenance', 'x', '## Intended recipient', 'x', '## Unique capabilities', 'x', '## Transfer gates', 'x'].join('\n');
const IMPORT = ['im', 'port'].join('');

function cleanTree() {
  return {
    'reference/README.md': `# reference\n\n${SELLER}\n${STORE_OPS}\n`,
    [`${SELLER}/README.md`]: donorReadme,
    [`${SELLER}/pubspec.yaml`]: 'name: letbuyy_seller\n',
    [`${SELLER}/lib/main.dart`]: 'void main() {}\n',
    [`${STORE_OPS}/README.md`]: donorReadme,
    [`${STORE_OPS}/pubspec.yaml`]: 'name: store_ops_app\ndependencies:\n  shared:\n    path: ../../../packages/dart/shared\n',
    'pnpm-workspace.yaml': 'packages:\n  - "apps/commerce/web"\n  - "packages/*"\n',
    'pubspec.yaml': 'name: root\nworkspace:\n  - apps/merchant/mobile\n  - packages/dart/shared\n',
    'packages/dart/shared/pubspec.yaml': 'name: shared\n',
    'apps/merchant/mobile/pubspec.yaml': 'name: letbuyy_store\ndependencies:\n  shared:\n    path: ../../../packages/dart/shared\n',
    'apps/merchant/mobile/lib/main.dart': `${IMPORT} 'package:shared/shared.dart';\n`,
    'apps/commerce/web/package.json': JSON.stringify({ name: '@letbuyy/customer-web', dependencies: { '@letbuyy/ui': 'workspace:*' } }),
    'apps/commerce/web/src/page.ts': `${IMPORT} { x } from '../lib/x';\n`,
    '.github/workflows/ci.yml': 'jobs:\n  build:\n    steps:\n      - run: pnpm build\n',
  };
}

function runWith(mutate) {
  const dir = fs.mkdtempSync(join(os.tmpdir(), 'letbuyy-reference-isolation-'));
  try {
    const files = cleanTree();
    mutate(files);
    for (const module of ['reference-isolation-validator.mjs', 'governance-common.mjs']) {
      files[`scripts/validators/${module}`] = fs.readFileSync(join(repoRoot, 'scripts/validators', module), 'utf8');
    }
    for (const [rel, text] of Object.entries(files)) {
      if (text === null) continue;
      fs.mkdirSync(dirname(join(dir, rel)), { recursive: true });
      fs.writeFileSync(join(dir, rel), text);
    }
    execFileSync('git', ['init', '-q'], { cwd: dir });
    execFileSync('git', ['add', '-A'], { cwd: dir });
    const result = spawnSync(process.execPath, ['scripts/validators/reference-isolation-validator.mjs'], { cwd: dir, encoding: 'utf8' });
    return { passed: result.status === 0, output: `${result.stdout}${result.stderr}` };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('a clean tree passes, including a donor that names an active shared package', () => {
  const { passed, output } = runWith(() => {});
  assert.ok(passed, output);
});

const violations = [
  ['a relative TypeScript import into a donor', (f) => { f['apps/commerce/web/src/page.ts'] = `${IMPORT} { x } from '../../../../${SELLER}/lib/x';\n`; }, /depends on reference\/ donor source[^\n]*apps\/commerce\/web\/src\/page\.ts/],
  ['a Dart package import of a donor', (f) => { f['apps/merchant/mobile/lib/main.dart'] = `${IMPORT} 'package:store_ops_app/src/app.dart';\n`; }, /depends on reference\/ donor source[^\n]*package:store_ops_app/],
  ['a pubspec path dependency on a donor', (f) => { f['apps/merchant/mobile/pubspec.yaml'] += `  seller:\n    path: ../../../${SELLER}\n`; }, /depends on reference\/ donor source[^\n]*path dependency/],
  ['a package.json link: dependency on a donor', (f) => { f['apps/commerce/web/package.json'] = JSON.stringify({ name: 'x', dependencies: { s: `link:../../../${SELLER}` } }); }, /depends on reference\/ donor source[^\n]*dependencies\.s/],
  ['a pnpm workspace glob that reaches a donor', (f) => { f['pnpm-workspace.yaml'] += '  - "*/apps/*"\n'; }, /pnpm-workspace\.yaml patterns reach reference/],
  ['a Dart workspace member under reference/', (f) => { f['pubspec.yaml'] += `  - ${STORE_OPS}\n`; }, /pub workspace[^\n]*includes reference/],
  ['a workflow that builds a donor', (f) => { f['.github/workflows/ci.yml'] += `      - run: cd ${SELLER} && flutter build apk\n`; }, /Build, CI or deploy configuration names reference/],
  ['deployment configuration inside a donor', (f) => { f[`${SELLER}/firebase.json`] = '{}'; }, /donors must carry no deployment configuration[^\n]*firebase\.json/],
  ['a donor README without its transfer gates', (f) => { f[`${STORE_OPS}/README.md`] = donorReadme.replace('## Transfer gates', '## Notes'); }, /store-operations\/README\.md must have a "## Transfer gates" section/],
  ['an index that omits a donor', (f) => { f['reference/README.md'] = `# reference\n\n${SELLER}\n`; }, /reference\/README\.md must list reference\/apps\/store-operations/],
  ['a generated file carrying a donor machine path', (f) => { f[`${STORE_OPS}/ios/Flutter/Generated.xcconfig`] = `FLUTTER_APPLICATION_PATH=${['', 'Users', 'someone', 'Git', 'Agrimore', 'apps', 'store_ops_app'].join('/')}\n`; }, /depend on a donor system's machine path[^\n]*Generated\.xcconfig/],
];

for (const [name, mutate, expected] of violations) {
  test(`fails on ${name}`, () => {
    const { passed, output } = runWith(mutate);
    assert.equal(passed, false, `the validator passed despite ${name}:\n${output}`);
    assert.match(output, expected);
  });
}

test('documentation may cite a donor machine path as provenance', () => {
  const { passed, output } = runWith((f) => { f['docs/journal.md'] = `history bundle: ${['~', 'LetBuyy-history-preservation-2026-08-29', 'a.bundle'].join('/')}\n`; });
  assert.ok(passed, output);
});
