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
