import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

test('theme marketplace no longer owns a Supabase client or bespoke worker client', () => {
  assert.equal(existsSync('apps/theme-marketplace/src/lib/supabase/client.ts'), false);
  assert.equal(existsSync('apps/theme-marketplace/src/lib/api/worker-client.ts'), false);

  const packageJson = JSON.parse(readFileSync('apps/theme-marketplace/package.json', 'utf8'));
  assert.equal(packageJson.dependencies['@letbuyy/api-client'], 'workspace:*');
  assert.equal(packageJson.dependencies['@letbuyy/api-types'], undefined);
  assert.equal(packageJson.dependencies['@letbuyy/shared-types'], 'workspace:*');
  assert.equal(packageJson.dependencies['@letbuyy/runtime-composition'], undefined);

  const manifest = readFileSync('apps/theme-marketplace/runtime.manifest.json', 'utf8');
  assert.match(manifest, /"@letbuyy\/api-client"/);
  assert.match(manifest, /"@letbuyy\/shared-types"/);
  assert.doesNotMatch(manifest, /@letbuyy\/api-types|runtime-composition/);
  assert.doesNotMatch(readFileSync('apps/theme-marketplace/AGENTS.md', 'utf8'), /@letbuyy\/api-types|runtime-composition/);
});

test('theme marketplace data and auth surfaces use shared API/auth contracts', () => {
  const themeService = readFileSync('apps/theme-marketplace/src/lib/theme-service.ts', 'utf8');
  const apiClient = readFileSync('apps/theme-marketplace/src/lib/api/client.ts', 'utf8');
  const authHook = readFileSync('apps/theme-marketplace/src/hooks/useAuth.ts', 'utf8');
  const callbackRoute = readFileSync('apps/theme-marketplace/src/app/auth/callback/route.ts', 'utf8');

  assert.match(themeService, /createThemeMarketplaceApiClient/);
  assert.doesNotMatch(themeService, /themeWorkerFetch|worker-client/);
  assert.match(apiClient, /createLetbuyyApiClient/);
  assert.match(apiClient, /createLetbuyyInternalSessionHeaders/);
  assert.match(authHook, /@letbuyy\/shared-types/);
  assert.doesNotMatch(authHook, /supabase|identity-runtime-adapter/i);
  assert.match(callbackRoute, /new URL\('\/lookup'/);
  assert.doesNotMatch(callbackRoute, /supabase|exchangeCodeForSession|identity-runtime-adapter/i);
});
