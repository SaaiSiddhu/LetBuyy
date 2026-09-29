import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
// The seven React web apps, at their D-APP-LAYOUT paths (Constitution Amendment 3). The names this list
// carried before that move map one to one: merchant-web -> apps/merchant/web, customer-web ->
// apps/commerce/web, identity-platform -> apps/platform/identity, app-marketplace -> apps/frozen/app-store,
// theme-marketplace -> apps/frozen/theme-store, admin-web -> apps/internal/console,
// platform-operations-portal -> apps/frozen/operations-portal. apps/marketing/web is deliberately not in
// the seven: its design-system adoption is on HOLD (D-UIUX). One list serves both tests below.
const webAppRoots = [
  'apps/merchant/web',
  'apps/commerce/web',
  'apps/platform/identity',
  'apps/frozen/app-store',
  'apps/frozen/theme-store',
  'apps/internal/console',
  'apps/frozen/operations-portal',
];

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

function readJson(path) {
  return JSON.parse(read(path));
}

test('only one active LetBuyy React design-system package remains', () => {
  assert.equal(existsSync(join(root, 'packages/typescript/ui/package.json')), true);
  assert.equal(existsSync(join(root, 'packages/ui/package.json')), false);
  assert.equal(existsSync(join(root, 'packages/ui-system/package.json')), false);
  assert.equal(existsSync(join(root, 'docs/archive/legacy-packages/ui')), true);
  assert.equal(existsSync(join(root, 'docs/archive/legacy-packages/ui-system')), true);

  const uiPackage = readJson('packages/typescript/ui/package.json');
  assert.equal(uiPackage.name, '@letbuyy/ui');
  assert.match(read('packages/typescript/ui/src/index.ts'), /DesignSystemRoot/);
});

test('all seven web apps consume the shared design-system package', () => {
  for (const app of webAppRoots) {
    const packageJson = readJson(`${app}/package.json`);
    const manifest = readJson(`${app}/runtime.manifest.json`);
    const layout = read(`${app}/src/app/layout.tsx`);

    assert.equal(packageJson.dependencies['@letbuyy/ui'], 'workspace:*', `${app} package.json`);
    assert.ok(
      manifest.allowedDependencies.workspacePackages.includes('@letbuyy/ui'),
      `${app} runtime manifest`,
    );
    assert.match(layout, /from ['"]@letbuyy\/ui['"]/, `${app} layout import`);
    assert.match(layout, /<LetbuyyThemeProvider\b/, `${app} layout root`);
  }
});

test('no app or package imports dead UI package names', () => {
  const checkedFiles = [
    ...webAppRoots.map((app) => `${app}/package.json`),
    'packages/typescript/ui/src/index.ts',
  ];

  for (const path of checkedFiles) {
    const contents = read(path);
    assert.doesNotMatch(contents, /@letbuyy\/ui-system|packages\/ui-system|packages\/ui/);
  }
});
