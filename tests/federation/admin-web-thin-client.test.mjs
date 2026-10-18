import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

function read(path) {
  return readFileSync(path, 'utf8');
}

test('admin-web auth routes do not own a Supabase auth client', () => {
  const authServer = read('apps/internal/console/src/lib/console-auth-server.ts');
  const loginRoute = read('apps/internal/console/src/app/api/console-auth/login/route.ts');
  const callbackRoute = read('apps/internal/console/src/app/api/console-auth/callback/route.ts');
  const logoutRoute = read('apps/internal/console/src/app/api/console-auth/logout/route.ts');

  for (const source of [authServer, loginRoute, callbackRoute, logoutRoute]) {
    assert.doesNotMatch(source, /supabase|createSupabaseServerClient|identity-runtime-adapter|runtime-composition/i);
  }

  assert.match(authServer, /readConsoleSession/);
  assert.match(loginRoute, /requestConsoleIdentity/);
  assert.match(callbackRoute, /requestConsoleIdentity/);
});

test('admin-web depends on auth-core without runtime-composition', () => {
  const packageJson = JSON.parse(read('apps/internal/console/package.json'));
  assert.equal(packageJson.dependencies['@letbuyy/api-client'], 'workspace:*');
  assert.equal(packageJson.dependencies['@letbuyy/api-types'], undefined);
  assert.equal(packageJson.dependencies['@letbuyy/auth-core'], 'workspace:*');
  assert.equal(packageJson.dependencies['@letbuyy/runtime-composition'], undefined);

  const manifest = read('apps/internal/console/runtime.manifest.json');
  assert.match(manifest, /"@letbuyy\/api-client"/);
  assert.doesNotMatch(manifest, /"@letbuyy\/api-types"/);
  assert.match(manifest, /"@letbuyy\/auth-core"/);
  assert.doesNotMatch(manifest, /runtime-composition/);

  const consoleApi = read('apps/internal/console/src/lib/console-api.ts');
  assert.match(consoleApi, /createLetbuyyApiClient/);
  assert.doesNotMatch(consoleApi, /await fetch\(/);

  const session = read('apps/internal/console/src/lib/console-session.ts');
  assert.match(session, /@letbuyy\/auth-core/);
  assert.match(session, /verifyIdentityPlatformSession/);
  assert.doesNotMatch(session, /createLetbuyyPlatform|PLATFORM_CONSOLE_SESSION_SECRET/);
});
