import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const WEB_APPS = [
  'apps/identity-platform',
  'apps/app-marketplace',
  'apps/theme-marketplace',
  'apps/admin_web',
  'apps/platform-operations-portal',
  'apps/merchant_web',
  'apps/customer_web',
];

const SKIPPED_DIRS = new Set(['node_modules', '.next', '.turbo', 'coverage', 'dist']);

function read(path) {
  return readFileSync(path, 'utf8');
}

function walkFiles(root) {
  const files = [];
  const entries = existsSync(root) ? readdirSync(root) : [];

  for (const entry of entries) {
    if (SKIPPED_DIRS.has(entry)) continue;

    const path = join(root, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      files.push(...walkFiles(path));
    } else {
      files.push(path);
    }
  }

  return files;
}

test('all web apps are free of direct Supabase SDK imports', () => {
  const offenders = [];

  for (const app of WEB_APPS) {
    for (const file of walkFiles(join(app, 'src'))) {
      if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(file)) continue;
      if (/@supabase\/|createSupabase|signInWithOAuth|exchangeCodeForSession/.test(read(file))) {
        offenders.push(file);
      }
    }
  }

  assert.deepEqual(offenders, []);
});

test('merchant and storefront apps no longer depend on the api-types aggregate', () => {
  for (const app of ['apps/merchant_web', 'apps/customer_web']) {
    const packageJson = JSON.parse(read(join(app, 'package.json')));
    const tsconfig = read(join(app, 'tsconfig.json'));
    const manifest = read(join(app, 'runtime.manifest.json'));
    const agents = read(join(app, 'AGENTS.md'));

    assert.equal(packageJson.dependencies['@letbuyy/api-types'], undefined, `${app} package.json`);
    assert.doesNotMatch(tsconfig, /@letbuyy\/api-types/, `${app} tsconfig`);
    assert.doesNotMatch(manifest, /"@letbuyy\/api-types"/, `${app} runtime manifest`);
    assert.doesNotMatch(agents, /@letbuyy\/api-types/, `${app} AGENTS`);
  }
});

test('merchant control plane has no unused handwritten gateway fetch helper', () => {
  assert.equal(existsSync('apps/merchant_web/src/lib/api.ts'), false);
  assert.equal(existsSync('apps/merchant_web/src/lib/api/worker-client.ts'), false);

  const merchantApiClient = read('apps/merchant_web/src/lib/api/client.ts');
  assert.match(merchantApiClient, /createLetbuyyApiClient/);
  assert.match(merchantApiClient, /createMerchantApiClient/);
  assert.doesNotMatch(merchantApiClient, /createWorkerApiClient|worker-client/);
});

test('storefront runtime gateway transport uses storefront API naming', () => {
  assert.equal(existsSync('apps/customer_web/src/lib/worker-client.ts'), false);
  assert.equal(existsSync('apps/customer_web/src/lib/browser-worker-client.ts'), false);

  const serverClient = read('apps/customer_web/src/lib/api/client.ts');
  const browserClient = read('apps/customer_web/src/lib/api/browser-client.ts');
  assert.match(serverClient, /createLetbuyyApiClient/);
  assert.match(serverClient, /createStorefrontApiClient/);
  assert.match(browserClient, /storefrontBrowserApiFetch/);
  assert.doesNotMatch(`${serverClient}\n${browserClient}`, /worker-client|WorkerRequestError|workerFetch|readWorkerJson|workerErrorMessage/);
});

test('theme contracts resolve from theme-engine or shared-types in app source', () => {
  const merchantThemeSchemas = read('apps/merchant_web/src/lib/theme-schemas.ts');
  const storefrontDemo = read('apps/customer_web/src/lib/demo/urban-kicks-demo.ts');
  const storefrontStoreService = read('apps/customer_web/src/lib/store-service.ts');

  assert.equal(existsSync('apps/customer_web/src/types/store.ts'), false);
  assert.match(merchantThemeSchemas, /from '@letbuyy\/theme-engine'/);
  assert.match(storefrontDemo, /from '@letbuyy\/theme-engine'/);
  assert.match(storefrontDemo, /from '@letbuyy\/commerce-core'/);
  assert.match(storefrontStoreService, /from '@letbuyy\/tenant-core'/);
  assert.doesNotMatch(merchantThemeSchemas, /@letbuyy\/api-types/);
  assert.doesNotMatch(storefrontDemo, /@letbuyy\/api-types/);
  assert.doesNotMatch(storefrontStoreService, /@\/types\/store/);
});
