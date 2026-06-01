import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = new URL('../..', import.meta.url).pathname;
const appRoot = join(root, 'apps/app-marketplace');

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('app-marketplace has no bespoke gateway worker client or local app domain contract', () => {
  assert.equal(existsSync(join(appRoot, 'src/lib/api/worker-client.ts')), false);
  assert.equal(existsSync(join(appRoot, 'src/lib/types/apps.ts')), false);

  const packageJson = JSON.parse(read('apps/app-marketplace/package.json'));
  assert.equal(packageJson.dependencies['@letbuyy/api-client'], 'workspace:*');
  assert.equal(packageJson.dependencies['@letbuyy/api-types'], undefined);
  assert.equal(packageJson.dependencies['@letbuyy/shared-types'], 'workspace:*');

  const manifest = JSON.parse(read('apps/app-marketplace/runtime.manifest.json'));
  assert.ok(manifest.allowedDependencies.workspacePackages.includes('@letbuyy/api-client'));
  assert.equal(manifest.allowedDependencies.workspacePackages.includes('@letbuyy/api-types'), false);
  assert.ok(manifest.allowedDependencies.workspacePackages.includes('@letbuyy/shared-types'));
  assert.doesNotMatch(read('apps/app-marketplace/AGENTS.md'), /@letbuyy\/api-types|runtime-composition/);
});

test('app-marketplace data surfaces use the shared api client and shared types', () => {
  const apiClient = read('apps/app-marketplace/src/lib/api/client.ts');
  assert.match(apiClient, /createLetbuyyApiClient/);
  assert.match(apiClient, /createLetbuyyInternalSessionHeaders/);

  const service = read('apps/app-marketplace/src/lib/app-service.ts');
  assert.match(service, /createAppMarketplaceApiClient/);
  assert.match(service, /@letbuyy\/shared-types/);
  assert.doesNotMatch(service, /worker-client|appStoreWorkerFetch|proxyWorkerJson/);

  const dashboard = read('apps/app-marketplace/src/app/(auth)/developers/dashboard/page.tsx');
  assert.match(dashboard, /api\.appStore\.developerApps/);
  assert.doesNotMatch(dashboard, /worker-client|appStoreWorkerFetch/);

  const myApps = read('apps/app-marketplace/src/app/(auth)/my-apps/page.tsx');
  assert.match(myApps, /api\.appStore\.installations/);
  assert.doesNotMatch(myApps, /worker-client|appStoreWorkerFetch/);
});
