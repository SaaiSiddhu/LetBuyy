import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const appRoot = 'apps/platform-operations-portal';

function read(path) {
  return readFileSync(path, 'utf8');
}

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry) ? [path] : [];
  });
}

test('platform-operations-portal remains a presentation runtime with shared auth only', () => {
  const sources = sourceFiles(join(appRoot, 'src')).map((path) => [path, read(path)]);

  for (const [path, source] of sources) {
    assert.doesNotMatch(source, /@supabase|supabase|worker-client|runtime-composition|identity-runtime-adapter/i, path);
  }

  assert.match(read(`${appRoot}/src/proxy.ts`), /@letbuyy\/auth-core/);
});

test('platform-operations-portal does not carry unused legacy api-types dependency', () => {
  const packageJson = JSON.parse(read(`${appRoot}/package.json`));
  assert.equal(packageJson.dependencies['@letbuyy/api-types'], undefined);
  assert.equal(packageJson.dependencies['@letbuyy/auth-core'], 'workspace:*');

  const manifest = read(`${appRoot}/runtime.manifest.json`);
  assert.doesNotMatch(manifest, /"@letbuyy\/api-types"/);
  assert.doesNotMatch(manifest, /runtime-composition/);
  assert.match(manifest, /"@letbuyy\/auth-core"/);
  assert.doesNotMatch(read(`${appRoot}/AGENTS.md`), /@letbuyy\/api-types|runtime-composition/);
});
