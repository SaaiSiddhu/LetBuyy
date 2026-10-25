// Read-only source discovery plus one qualification-document write. This never starts a suite.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative, extname, join } from 'node:path';
const require = createRequire(import.meta.url), ts = require('typescript');
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const folder = 'docs/implementation/niche-theme-programme/publisher-acl393/';
const suite = 'services/api-gateway/src/__tests__/owned-db/theme-publisher-acl.postgres.test.ts';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const read = path => readFileSync(resolve(root, path));
const json = path => JSON.parse(read(path));
const manifest = json(folder + 'case-operand-repair/v2/manifest.json');
const configPath = resolve(root, 'services/api-gateway/tsconfig.json');
const config = ts.readConfigFile(configPath, ts.sys.readFile);
assert.equal(config.error, undefined);
const options = ts.parseJsonConfigFileContent(config.config, ts.sys, dirname(configPath)).options;
const files = new Set(), edges = [], external = new Set(), dynamic = [];
const queue = [], visited = new Set();
function add(path, traverse = true) {
  assert(!path.includes('..') && !path.startsWith('/'), path);
  assert(!/liquid-hydration-islands|variant-selection-url/.test(path), 'Moving browser cart/URL source must not be frozen');
  assert(existsSync(resolve(root, path)), path);
  files.add(path);
  if (traverse && /\.(?:[cm]?[jt]sx?)$/.test(path) && !path.endsWith('.d.ts')) queue.push(path);
}
for (const path of [suite, 'scripts/governance/run-executable-suites.mjs', 'services/api-gateway/tsconfig.json', 'tsconfig.base.json', 'package.json', 'pnpm-lock.yaml', 'services/api-gateway/package.json', 'services/api-gateway/runtime.manifest.json', folder + 'case-operand-repair/v2/manifest.json', folder + 'case-operand-repair/if-then-boundary.mjs', folder + 'capture-source-inputs.mjs', folder + 'check-native-types.mjs', folder + 'native-runs/01/admission.json.before.snapshot', folder + 'source-contracts.test.mjs', 'tests/executable/tenant-redteam-postgres.test.mjs', 'database/supabase/deploy/provider-admin-catalog-fence.sql', 'database/supabase/deploy/provider-admin-catalog-fence.rollback.sql', 'database/supabase/deploy/provider-admin-catalog-fence-profile.json']) add(path);
// Manifest-pinned historical evidence and source hashes are data inputs, never re-executed.
function pinnedPaths(value) {
  if (Array.isArray(value)) { for (const v of value) pinnedPaths(v); return; }
  if (!value || typeof value !== 'object') return;
  for (const [key, v] of Object.entries(value)) {
    if (typeof v === 'string' && /(?:file|path)$/i.test(key) && /^(?:docs|packages|services|scripts|database)\//.test(v) && existsSync(resolve(root, v))) add(v, false);
    else pinnedPaths(v);
  }
}
pinnedPaths(manifest);
// The pure regression reads the original immutable pair as data, not executable candidates.
for(const file of json(manifest.supersedesManifest.path).candidates)add(file.path,false);
// Pure regression compares the exact conserved native03 stage bodies as read-only data.
add(folder+'http-attribution-repair/theme-publisher-acl.postgres.test.ts.before.snapshot',false);
for (const directory of ['database/supabase/migrations', 'database/supabase/rollback', 'database/supabase/bootstrap']) {
  if (!existsSync(resolve(root, directory))) continue;
  for (const path of readdirSync(resolve(root, directory), { recursive: true })) if (path.endsWith('.sql')) add(join(directory, path), false);
}
while (queue.length) {
  const path = queue.shift(); if (visited.has(path)) continue; visited.add(path);
  const source = ts.createSourceFile(path, read(path).toString(), ts.ScriptTarget.Latest, true);
  function inspect(node) {
    let specifier;
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) specifier = node.moduleSpecifier.text;
    else if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === 'require')) {
      if (node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) specifier = node.arguments[0].text;
      else dynamic.push({ path, line: source.getLineAndCharacterOfPosition(node.pos).line + 1, expression: node.getText(source).slice(0, 180) });
    }
    if (specifier && !specifier.startsWith('node:')) {
      let resolved;
      if (specifier.startsWith('.')) {
        const base = resolve(root, dirname(path), specifier);
        resolved = ['', '.ts', '.tsx', '.mjs', '.js', '.json', '/index.ts', '/index.mjs', '/index.js'].map(s => base + s).find(p => existsSync(p) && extname(p));
      }
      resolved ||= ts.resolveModuleName(specifier, resolve(root, path), options, ts.sys).resolvedModule?.resolvedFileName;
      if (resolved && !resolved.includes('/node_modules/') && resolved.startsWith(root)) {
        const target = relative(root, resolved); assert(!target.startsWith('apps/'), 'Native execution closure cannot import applications');
        edges.push({ from: path, specifier, to: target }); add(target);
      } else {
        assert(!specifier.startsWith('.') && !specifier.startsWith('@letbuyy/'), `Unresolved internal source: ${path} -> ${specifier}`);
        external.add(specifier);
      }
    }
    ts.forEachChild(node, inspect);
  }
  inspect(source);
  // Bind the public package manifest for the source entry actually resolved.
  const parts = path.split('/');
  if (parts[0] === 'packages') {
    let directory = dirname(path);
    while (directory.startsWith('packages/')) {
      const packagePath = join(directory, 'package.json');
      if (existsSync(resolve(root, packagePath))) { add(packagePath, false); break; }
      directory = dirname(directory);
    }
  }
}
const migrations = [...files].filter(p => p.startsWith('database/supabase/migrations/') && p.endsWith('.sql'));
assert.equal(migrations.length, 321);
assert.equal(Math.max(...migrations.map(p => Number(p.split('/').at(-1).match(/^\d+/)?.[0]))), 392);
assert(![...files].some(p => /^database\/supabase\/(?:migrations|rollback)\/39[34]_/.test(p)));
const output = { status: 'ACL393_SOURCE_INPUT_CLOSURE_NOT_NATIVE_ADMISSION', suitePath: suite,
  sourceMigrationMaximum: 392, sourceMigrationCount:321, migrationCeiling: null, candidateOutsideMigrationScan: true,
  discovery: 'TypeScript AST of literal import/export/require edges; exact manifest inputs; all UP/DOWN/bootstrap SQL; runner and owned support. Third-party dependencies bound by package manifests and pnpm lock. Nonliteral imports listed explicitly.',
  files: [...files].sort().map(path => ({ path, sha256: hash(read(path)) })),
  edges, thirdPartyModuleSpecifiers: [...external].sort(), nonliteralImports: dynamic,
  excludedMovingBrowserSources: ['liquid-hydration-islands.tsx', 'variant-selection-url source'],
  nativeTestRun: false,
};
const bytes = JSON.stringify(output, null, 2) + '\n';
writeFileSync(resolve(root, folder + 'source-input-closure.json'), bytes);
console.log(JSON.stringify({ status: output.status, inputCount: output.files.length, importEdges: edges.length, migrationCount: migrations.length, nonliteralImports: dynamic.length, sha256: hash(bytes) }));
