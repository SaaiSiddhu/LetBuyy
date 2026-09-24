import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const webApps = [
  'merchant-web',
  'customer-web',
  'identity-platform',
  'app-marketplace',
  'theme-marketplace',
  'admin-web',
  'platform-operations-portal',
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
  for (const app of webApps) {
    const packageJson = readJson(`apps/${app}/package.json`);
    const manifest = readJson(`apps/${app}/runtime.manifest.json`);
    const layout = read(`apps/${app}/src/app/layout.tsx`);

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
    'apps/platform/identity/package.json',
    'apps/commerce/web/package.json',
    'apps/frozen/theme-store/package.json',
    'apps/frozen/app-store/package.json',
    'apps/merchant/web/package.json',
    'apps/internal/console/package.json',
    'apps/frozen/operations-portal/package.json',
    'packages/typescript/ui/src/index.ts',
  ];

  for (const path of checkedFiles) {
    const contents = read(path);
    assert.doesNotMatch(contents, /@letbuyy\/ui-system|packages\/ui-system|packages\/ui/);
  }
});
