import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, '../..');

const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.dart']);
const sourceRoots = ['apps', 'packages', 'services'];
const ignoredDirectories = new Set([
  'node_modules',
  '.next',
  '.turbo',
  '.wrangler',
  '.dart_tool',
  'dist',
  'build',
  'coverage',
]);

function read(relativePath: string): string {
  const absolutePath = join(repoRoot, relativePath);
  assert.equal(existsSync(absolutePath), true, `${relativePath} must exist`);
  return readFileSync(absolutePath, 'utf8');
}

function collectSourceFiles(directory: string, files: string[] = []): string[] {
  for (const entry of readdirSync(directory)) {
    if (ignoredDirectories.has(entry)) continue;
    const absolutePath = join(directory, entry);
    const stat = statSync(absolutePath);
    if (stat.isDirectory()) {
      collectSourceFiles(absolutePath, files);
      continue;
    }
    const extension = entry.slice(entry.lastIndexOf('.'));
    if (sourceExtensions.has(extension)) files.push(absolutePath);
  }
  return files;
}

test('Next app env contract declares storefront root and cutover-only platform .com targets', () => {
  const schema = JSON.parse(read('config/env/schemas/next-app.schema.json')) as {
    properties: Record<string, unknown>;
  };
  const nextTemplate = read('config/env/templates/next-app.env.example');
  const productionTemplate = read('config/env/production.env.template');
  const productionExample = read('config/env/production.env.example');
  const stagingTemplate = read('config/env/staging.env.template');
  const stagingExample = read('config/env/staging.env.example');
  const matrix = read('config/env/staging-production-secret-matrix.json');

  for (const key of [
    'NEXT_PUBLIC_STORE_ROOT_DOMAIN',
    'NEXT_PUBLIC_APP_MARKETPLACE_URL',
    'NEXT_PUBLIC_DEVELOPER_PORTAL_URL',
    'NEXT_PUBLIC_SUPPORT_EMAIL',
  ]) {
    assert.ok(schema.properties[key], `${key} must be present in next-app schema`);
    assert.match(nextTemplate, new RegExp(`^${key}=`, 'm'), `${key} must be present in the next app template`);
    assert.match(matrix, new RegExp(`"${key}"`), `${key} must be listed in the secret matrix`);
  }

  for (const envFile of [productionTemplate, productionExample, stagingTemplate, stagingExample]) {
    assert.match(envFile, /^NEXT_PUBLIC_STORE_ROOT_DOMAIN=letbuyy\.store$/m);
    assert.match(envFile, /^COOKIE_DOMAIN=\.(?:staging\.)?letbuyy\.store$/m);
    assert.match(envFile, /CUTOVER \(with DNS\/Vercel move\): COOKIE_DOMAIN=\.(?:staging\.)?letbuyy\.com/);
    assert.match(envFile, /CUTOVER: NEXT_PUBLIC_ACCOUNTS_URL=https:\/\/accounts(?:[-.]staging)?\.letbuyy\.com/);
    assert.match(envFile, /CUTOVER: NEXT_PUBLIC_API_URL=https:\/\/api(?:\.staging)?\.letbuyy\.com/);
    assert.match(envFile, /STOREFRONT runtime: leave COOKIE_DOMAIN unset/);
  }

  assert.match(nextTemplate, /Storefront runtime must leave COOKIE_DOMAIN unset/);
});

test('canonical platform .com target appears only in approved cutover/default surfaces', () => {
  const blocked = [
    /https:\/\/[a-z0-9.-]*letbuyy\.com/i,
    /[A-Z0-9._%+-]+@letbuyy\.com/i,
    /\bletbuyy\.com\b/i,
  ];
  const allowedCanonicalFiles = new Set([
    'apps/app-marketplace/src/lib/site-url.ts',
    'apps/identity-platform/src/app/layout.tsx',
    'apps/marketing-site/src/lib/public-urls.ts',
    'apps/mobile/merchant-app/lib/config/app_config.dart',
    'apps/platform-console/src/proxy.ts',
    'apps/platform-operations-portal/src/proxy.ts',
    'apps/theme-marketplace/src/app/auth/callback/route.ts',
    'apps/theme-marketplace/src/app/contact/page.tsx',
    'apps/theme-marketplace/src/app/support/page.tsx',
    'apps/theme-marketplace/src/components/info-placeholder.tsx',
    'apps/theme-marketplace/src/components/layout/footer.tsx',
    'apps/theme-marketplace/src/components/policy-draft-page.tsx',
    'apps/theme-marketplace/src/lib/public-urls.ts',
    'apps/theme-marketplace/src/proxy.ts',
    'packages/dart/core/lib/src/constants/api_constants.dart',
    'packages/shared-types/src/brand.ts',
    'packages/typescript/api-client/src/index.ts',
    'services/api-gateway/src/lib/cors.ts',
    'services/api-gateway/src/lib/order-confirmation-email.ts',
    'services/api-gateway/src/middleware/permission.ts',
    'services/api-gateway/src/middleware/store-context.ts',
    'services/api-gateway/src/routes/auth.ts',
    'services/api-gateway/src/routes/onboarding.ts',
    'services/api-gateway/src/routes/payments.ts',
    'services/api-gateway/src/routes/storefront/customer-engagement-routes.ts',
    'services/queue-workers/src/index.ts',
  ]);

  const offenders: string[] = [];
  for (const root of sourceRoots) {
    for (const file of collectSourceFiles(join(repoRoot, root))) {
      const relativePath = file.replace(`${repoRoot}/`, '');
      const source = readFileSync(file, 'utf8');
      if (!allowedCanonicalFiles.has(relativePath) && blocked.some((pattern) => pattern.test(source))) {
        offenders.push(relativePath);
      }
    }
  }

  assert.deepEqual(offenders, []);

  const governanceRunner = read('scripts/validate-governance.mjs');
  assert.match(governanceRunner, /platform-domain-literal-validator\.mjs/);
});
