import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
// @ts-expect-error -- governance-common.mjs is plain ESM with no type declarations
import { compatibilityBridgeRoots, startsWithPrefix } from '../../scripts/validators/governance-common.mjs';

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
    assert.match(envFile, /^NEXT_PUBLIC_STORE_ROOT_DOMAIN=letbuyy\.com$/m);
    assert.match(envFile, /^COOKIE_DOMAIN=\.(?:staging\.)?letbuyy\.com$/m);
    assert.match(envFile, /CUTOVER \(with DNS\/Vercel move\): COOKIE_DOMAIN=\.(?:staging\.)?letbuyy\.com/);
    assert.match(envFile, /CUTOVER: NEXT_PUBLIC_ACCOUNTS_URL=https:\/\/accounts(?:[-.]staging)?\.letbuyy\.com/);
    assert.match(envFile, /CUTOVER: NEXT_PUBLIC_API_URL=https:\/\/api(?:\.staging)?\.letbuyy\.com/);
    assert.match(envFile, /STOREFRONT runtime: leave COOKIE_DOMAIN unset/);
  }

  assert.match(nextTemplate, /Storefront runtime must leave COOKIE_DOMAIN unset/);
});

test('legacy platform .store target does not appear in active functional source', () => {
  const blocked = [
    /https?:\/\/[a-z0-9.-]*letbuyy\.store/i,
    /[A-Z0-9._%+-]+@letbuyy\.store/i,
    /(?<!com\.)(?<!group\.)(?<!letbuyy\.)\bletbuyy\.store\b/i,
  ];

  const offenders: string[] = [];
  for (const root of sourceRoots) {
    for (const file of collectSourceFiles(join(repoRoot, root))) {
      const relativePath = file.replace(`${repoRoot}/`, '');
      // F-CONTRACTSCOPE-1. This sweep and platform-domain-literal-validator.mjs police the SAME rule
      // and disagreed: the validator skips the compatibility bridges at :56 and passed, while this
      // test had no exemption and flagged cloudflare_bridge's retired-platform-domain proxy. The
      // bridges are inert and unwired, which is why that exemption exists. (The domain is spelled
      // out nowhere in this comment on purpose: platform-domain-literal-validator forbids the bare
      // literal in functional source, and an earlier draft of this very comment failed it.)
      // The list is imported from
      // governance-common rather than copied, so the two guards cannot drift apart again — a second
      // hand-maintained scope is how they diverged in the first place.
      if (compatibilityBridgeRoots.some((prefix: string) => startsWithPrefix(relativePath, prefix))) {
        continue;
      }
      const source = readFileSync(file, 'utf8');
      if (blocked.some((pattern) => pattern.test(source))) {
        offenders.push(relativePath);
      }
    }
  }

  assert.deepEqual(offenders, []);

  const governanceRunner = read('scripts/validate-governance.mjs');
  assert.match(governanceRunner, /platform-domain-literal-validator\.mjs/);
});
