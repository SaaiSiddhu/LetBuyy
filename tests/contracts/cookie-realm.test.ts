import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, '../..');
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const ignoredDirectories = new Set(['node_modules', '.next', '.turbo', '.wrangler', 'dist', 'build']);

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
    } else if (sourceExtensions.has(extname(entry))) {
      files.push(absolutePath);
    }
  }
  return files;
}

test('customer-web cookie writes are host-only', () => {
  const offenders: string[] = [];
  for (const absolutePath of collectSourceFiles(join(repoRoot, 'apps/customer_web/src'))) {
    const source = readFileSync(absolutePath, 'utf8');
    const writesCookie = /cookies(?:\(\))?\.set|response\.cookies\.set|Set-Cookie/i.test(source);
    if ((writesCookie && /\bdomain\s*:/.test(source)) || /Domain=\.letbuyy\.(?:store|com)/i.test(source)) {
      offenders.push(absolutePath.replace(`${repoRoot}/`, ''));
    }
  }

  assert.deepEqual(offenders, []);
});

test('platform cookie domain is env-driven and storefront gate cookie uses __Host prefix', () => {
  const identityCookies = read('apps/identity-platform/src/lib/auth/cookies.ts');
  const merchantLogout = read('apps/merchant_web/src/app/api/auth/logout/route.ts');
  const authCore = read('packages/auth-core/src/storefront-access.ts');

  assert.match(identityCookies, /process\.env\.COOKIE_DOMAIN/);
  assert.doesNotMatch(identityCookies, /\.letbuyy\.com/);
  assert.match(merchantLogout, /process\.env\.COOKIE_DOMAIN/);
  assert.match(authCore, /LETBUYY_STOREFRONT_GATE_COOKIE\s*=\s*['"]__Host-/);
});

test('cookie realm validator is wired into governance', () => {
  const validator = read('scripts/validators/cookie-realm-validator.mjs');
  const governanceRunner = read('scripts/validate-governance.mjs');

  assert.match(validator, /Cookie realm validator/);
  assert.match(governanceRunner, /cookie-realm-validator\.mjs/);
});
