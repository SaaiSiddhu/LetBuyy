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

test('letbuyy.com DNS zone is additive and reuses the existing Cloudflare provider', () => {
  const comZone = read('infrastructure/dns/letbuyy_com.tf');
  const storeZone = read('infrastructure/dns/dns.tf');

  assert.match(comZone, /variable\s+"cloudflare_zone_id_com"/);
  assert.doesNotMatch(comZone, /provider\s+"cloudflare"/);
  assert.match(storeZone, /provider\s+"cloudflare"/);
  assert.match(comZone, /cloudflare_api_token/);

  assert.match(comZone, /resource\s+"cloudflare_record"\s+"com_root_a"/);
  assert.match(comZone, /resource\s+"cloudflare_record"\s+"com_www"/);
  assert.match(comZone, /content\s+=\s+"cname\.vercel-dns\.com"/);
  assert.match(comZone, /name\s+=\s+"@"/);
  assert.match(comZone, /name\s+=\s+"www"/);

  for (const host of ['accounts', 'admin', 'apps', 'themes', 'developer', 'console', 'team']) {
    assert.match(comZone, new RegExp(`${host}\\s+=`), `${host} must be in the platform Vercel host map`);
  }

  assert.match(comZone, /name\s+=\s+"api"/);
  assert.match(comZone, /name\s+=\s+"webhooks"/);
  assert.match(comZone, /Storefronts stay on letbuyy\.store/);
});
