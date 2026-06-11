import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, '../..');

function read(relativePath: string): string {
  const absolutePath = join(repoRoot, relativePath);
  assert.equal(existsSync(absolutePath), true, `${relativePath} must exist`);
  return readFileSync(absolutePath, 'utf8');
}

test('custom-domain CNAME target is env-driven and documented as the LetBuyy connect host', () => {
  const workerTemplate = read('config/env/templates/worker.env.example');
  const nextTemplate = read('config/env/templates/next-app.env.example');
  const route = read('services/api-gateway/src/routes/custom-domains.ts');
  const targetHelper = read('services/api-gateway/src/lib/custom-domain-config.ts');

  assert.match(workerTemplate, /CUSTOM_DOMAIN_CNAME_TARGET=connect\.letbuyy\.com/);
  assert.match(workerTemplate, /NEXT_PUBLIC_CUSTOM_DOMAIN_CNAME_TARGET=connect\.letbuyy\.com/);
  assert.match(nextTemplate, /NEXT_PUBLIC_CUSTOM_DOMAIN_CNAME_TARGET=connect\.letbuyy\.com/);
  assert.match(route, /getCustomDomainCnameTarget/);
  assert.match(targetHelper, /CUSTOM_DOMAIN_CNAME_TARGET/);
  assert.doesNotMatch(route, /cname\.vercel-dns\.com/);
});

test('DNS owns connect target and reserves shopper identity host', () => {
  const dns = read('infrastructure/dns/dns.tf');
  assert.match(dns, /resource "cloudflare_record" "connect"[\s\S]*name\s*=\s*"connect"[\s\S]*content\s*=\s*"cname\.vercel-dns\.com"/);
  assert.match(dns, /shopper_identity_id/);
});
