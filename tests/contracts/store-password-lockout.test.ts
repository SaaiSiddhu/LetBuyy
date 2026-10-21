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

test('store password verify records attempts and locks out after repeated failures', () => {
  const route = read('services/api-gateway/src/routes/internal-store-access.ts');
  const password = read('services/api-gateway/src/lib/store-access-password.ts');

  assert.match(route, /site_gate_attempts/);
  assert.match(route, /if \(failures >= 5\) return denied/);
  assert.match(route, /\.eq\('site_id', siteId\)\.eq\('host', host\)\.eq\('ip', ip\)/);
  assert.ok(route.indexOf('if (failures >= 5)') < route.indexOf('await verifyStoreAccessPassword'), 'lockout must precede expensive password work');
  assert.match(route, /checkRateLimitKey/);
  assert.match(route, /STORE_ACCESS_THROTTLED/);
  assert.match(route, /await verifyStoreAccessPassword/);
  assert.match(password, /DUMMY_ARGON2ID_HASH/);
  assert.match(password, /argon2Verify\(\{ password, hash: DUMMY_ARGON2ID_HASH \}/);
});
