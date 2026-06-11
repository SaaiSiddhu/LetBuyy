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

test('letbuyy.com DNS zone is consolidated and only publishes active hosts', () => {
  const zone = read('infrastructure/dns/dns.tf');

  assert.match(zone, /variable\s+"cloudflare_zone_id"/);
  assert.match(zone, /provider\s+"cloudflare"/);
  assert.match(zone, /cloudflare_api_token/);

  assert.match(zone, /resource\s+"cloudflare_record"\s+"root_a"/);
  assert.match(zone, /resource\s+"cloudflare_record"\s+"www"/);
  assert.match(zone, /content\s+=\s+"cname\.vercel-dns\.com"/);
  assert.match(zone, /name\s+=\s+"@"/);
  assert.match(zone, /name\s+=\s+"www"/);

  for (const host of ['accounts', 'admin', 'console', 'checkout']) {
    assert.match(zone, new RegExp(`resource\\s+"cloudflare_record"\\s+"${host}"`), `${host} must be an active DNS record`);
    assert.match(zone, new RegExp(`comment\\s+=\\s+"[^"]*${host}\\.letbuyy\\.com`), `${host} must point at its letbuyy.com hostname`);
  }

  for (const frozenHost of ['apps', 'themes', 'developer', 'team']) {
    assert.doesNotMatch(zone, new RegExp(`resource\\s+"cloudflare_record"\\s+"${frozenHost}"`));
    assert.doesNotMatch(zone, new RegExp(`name\\s+=\\s+"${frozenHost}"`));
  }

  assert.match(zone, /name\s+=\s+"api"/);
  assert.match(zone, /name\s+=\s+"webhooks"/);
  assert.match(zone, /name\s+=\s+"\*"/);
  assert.match(zone, /checkout\.letbuyy\.com \(hosted checkout origin\)/);
});
