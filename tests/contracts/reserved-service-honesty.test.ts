import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const reservedServiceRoots = [
  'services/analytics-pipeline',
  'services/checkout-runtime',
  'services/event-bus',
  'services/media-service',
  'services/notification-service',
  'services/search-service',
];

function read(path: string): string {
  return readFileSync(resolve(repoRoot, path), 'utf8');
}

function readJson(path: string) {
  return JSON.parse(read(path));
}

function listFiles(root: string): string[] {
  const absoluteRoot = resolve(repoRoot, root);
  const result: string[] = [];
  const visit = (absolutePath: string) => {
    for (const entry of readdirSync(absolutePath)) {
      if (entry === '.DS_Store') continue;
      const child = join(absolutePath, entry);
      if (statSync(child).isDirectory()) {
        visit(child);
      } else {
        result.push(relative(repoRoot, child));
      }
    }
  };
  visit(absoluteRoot);
  return result.sort();
}

test('reserved service roots are manifest-and-AGENTS only with no deployable source', () => {
  for (const root of reservedServiceRoots) {
    assert.deepEqual(listFiles(root), [
      `${root}/AGENTS.md`,
      `${root}/runtime.manifest.json`,
    ]);
    assert.equal(existsSync(resolve(repoRoot, `${root}/package.json`)), false, `${root} must not declare a package`);
    assert.equal(existsSync(resolve(repoRoot, `${root}/src`)), false, `${root} must not contain source`);
    assert.equal(existsSync(resolve(repoRoot, `${root}/wrangler.toml`)), false, `${root} must not contain worker config`);

    const manifest = readJson(`${root}/runtime.manifest.json`);
    assert.equal(manifest.runtimeCategory, 'reserved-service');
    assert.equal(manifest.implementationStatus.status, 'reserved-not-implemented');
    assert.equal(manifest.implementationStatus.sourceState, 'manifest-and-agents-only');
    assert.match(manifest.deploymentAuthority.platform, /Reserved only - no deployable runtime artifact/);
    assert.match(manifest.ownership.businessAuthority, /Reserved\/not-implemented|does not own active/);
    assert.match(manifest.implementationStatus.currentActiveOwner, /services\/api-gateway|services\/queue-workers/);
  }
});

test('mobile notification and push needs are covered by implemented runtimes, not notification-service', () => {
  const notificationManifest = readJson('services/notification-service/runtime.manifest.json');
  const gatewayNotifications = read('services/api-gateway/src/routes/notifications.ts');
  const bff = read('services/mobile-bff/src/index.ts');
  const queueConsumer = read('services/queue-workers/src/platform-queue-consumer.ts');
  const pushDispatcher = read('services/queue-workers/src/push-dispatcher.ts');
  const pushTests = read('services/queue-workers/test/push-dispatcher.test.mjs');

  assert.match(
    notificationManifest.implementationStatus.currentActiveOwner,
    /services\/api-gateway owns active notification APIs and services\/queue-workers owns configured async queue consumers/,
  );
  assert.match(gatewayNotifications, /router\.post\('\/device-tokens'/);
  assert.match(gatewayNotifications, /router\.delete\('\/device-tokens'/);
  assert.match(gatewayNotifications, /router\.post\('\/send'/);
  assert.match(gatewayNotifications, /\.from\('notifications'\)\.insert/);
  assert.match(bff, /'\/v1\/notifications'/);
  assert.match(queueConsumer, /dispatchPushNotificationToDevices/);
  assert.match(queueConsumer, /\.from\('notifications'\)\.insert/);
  assert.match(pushDispatcher, /PUSH_DISPATCH_MODE\?: 'dry-run' \| 'live'/);
  assert.match(pushDispatcher, /env\.PUSH_DISPATCH_MODE === 'dry-run'/);
  assert.match(pushTests, /push dispatcher dry-run exercises eligible device tokens without provider credentials/);
});

test('runtime manifest validator enforces reserved service honesty', () => {
  const validator = read('scripts/validators/runtime-manifest-validator.mjs');
  const governanceCommon = read('scripts/validators/governance-common.mjs');

  assert.match(validator, /reservedServiceRoots/);
  for (const root of reservedServiceRoots) {
    assert.match(governanceCommon, new RegExp(root.replaceAll('/', '\\/')));
  }
  assert.match(validator, /Reserved runtime root must remain manifest-only/);
  assert.match(validator, /reserved-not-implemented/);
});
