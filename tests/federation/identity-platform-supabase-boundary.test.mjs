import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const appRoot = 'apps/identity-platform';

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

test('identity-platform no longer owns a Supabase browser or server client', () => {
  assert.equal(existsSync(`${appRoot}/src/lib/supabase/client.ts`), false);
  assert.equal(existsSync(`${appRoot}/src/lib/supabase/server.ts`), false);

  const sources = sourceFiles(join(appRoot, 'src')).map((path) => [path, read(path)]);
  for (const [path, source] of sources) {
    assert.doesNotMatch(source, /@supabase|createSupabase|signInWithOAuth|exchangeCodeForSession|@\/lib\/supabase/i, path);
  }
});

test('identity-platform still routes backend calls through the shared api client facade', () => {
  const client = read(`${appRoot}/src/lib/api/client.ts`);
  assert.match(client, /createLetbuyyApiClient/);
  assert.match(client, /createLetbuyyInternalSessionHeaders/);

  const callback = read(`${appRoot}/src/app/auth/callback/route.ts`);
  assert.match(callback, /oauth_unavailable/);
  assert.doesNotMatch(callback, /supabase|exchangeCodeForSession/i);
});

test('identity-platform has no runtime-composition provider adapter dependency', () => {
  const packageJson = JSON.parse(read(`${appRoot}/package.json`));
  assert.equal(packageJson.dependencies['@letbuyy/api-types'], undefined);
  assert.equal(packageJson.dependencies['@letbuyy/runtime-composition'], undefined);

  const manifest = read(`${appRoot}/runtime.manifest.json`);
  assert.doesNotMatch(manifest, /@letbuyy\/api-types|runtime-composition/);
  assert.doesNotMatch(read(`${appRoot}/AGENTS.md`), /@letbuyy\/api-types|runtime-composition/);

  const sources = sourceFiles(join(appRoot, 'src')).map((path) => [path, read(path)]);
  for (const [path, source] of sources) {
    assert.doesNotMatch(source, /@letbuyy\/runtime-composition|identity-runtime-adapter/i, path);
  }
});
