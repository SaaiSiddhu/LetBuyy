import assert from 'node:assert/strict';
import test from 'node:test';
import module from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { extractSpecifiers, sourceExtensions } from '../../scripts/validators/governance-common.mjs';

// Run the actual validator against a tiny in-memory workspace. Its decision
// code stays intact; only imports and filesystem/reporting inputs are replaced.
const filename = 'scripts/validators/dependency-manifest-validator.mjs';
const source = fs.readFileSync(filename, 'utf8');
const parsed = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
let body = source;
for (const statement of [...parsed.statements].reverse()) {
  if (ts.isImportDeclaration(statement)) body = body.slice(0, statement.getFullStart()) + body.slice(statement.end);
}
const names = ['module', 'fs', 'path', 'createReporter', 'extractSpecifiers', 'getTrackedFiles',
  'listWorkspaceFiles', 'packageRootForManifest', 'readFile', 'readJson', 'rootForFile', 'root', 'sourceExtensions'];
const evaluate = new Function(...names, body);

function failures(file, { dev = true, dependency = 'typescript', aliases = {} } = {}) {
  const owner = 'apps/commerce/web';
  const manifestPath = `${owner}/package.json`;
  const importer = `${owner}/${file}`;
  const errors = [];
  const manifest = { name: '@letbuyy/fixture', dependencies: { react: '^19' },
    ...(dev ? { devDependencies: { typescript: '^5' } } : {}), imports: aliases };
  evaluate(module, fs, path, () => ({
    assert: (condition, message) => { if (!condition) errors.push(message); },
    finish: () => {},
  }), extractSpecifiers, () => [], () => [manifestPath, importer], path.posix.dirname,
  (file) => { assert.equal(file, importer); return `import value from '${dependency}';`; },
  (file) => { assert.equal(file, manifestPath); return manifest; },
  (file) => file.startsWith(`${owner}/`) ? owner : null, process.cwd(), sourceExtensions);
  return errors;
}

test('co-located test and spec files can use their own declared development dependency', () => {
  for (const suffix of ['test.ts', 'test.tsx', 'spec.ts', 'spec.jsx', 'test.mjs', 'test.cjs', 'test.mts', 'spec.cts']) {
    assert.deepEqual(failures(`src/components/example.${suffix}`), [], suffix);
  }
});

test('production files and test-like names still cannot import development-only packages', () => {
  for (const file of ['src/page.tsx', 'src/test-helper.ts', 'src/example.test.tsx.ts', 'src/specification.ts']) {
    assert.equal(failures(file).length, 1, file);
  }
});

test('test classification never permits an undeclared package', () => {
  assert.equal(failures('src/example.test.tsx', { dev: false }).length, 1);
  assert.equal(failures('src/example.test.tsx', { dependency: 'unlisted-package' }).length, 1);
});

test('existing test directories and configuration classification remain supported', () => {
  for (const file of ['src/__tests__/example.ts', 'test/example.ts', 'tests/example.tsx', 'next.config.ts']) {
    assert.deepEqual(failures(file), [], file);
  }
});

test('ordinary runtime dependency declarations still work for both source classes', () => {
  assert.deepEqual(failures('src/page.tsx', { dependency: 'react', dev: false }), []);
  assert.deepEqual(failures('src/example.test.tsx', { dependency: 'react', dev: false }), []);
});

test('conditional package import aliases retain dependency checks in the correct source class', () => {
  const options = { dependency: '#compiler', aliases: { '#compiler': { default: 'typescript' } } };
  assert.deepEqual(failures('src/example.test.ts', options), []);
  assert.equal(failures('src/page.ts', options).length, 1);
  assert.equal(failures('src/example.test.ts', { ...options, dev: false }).length, 1);
});
