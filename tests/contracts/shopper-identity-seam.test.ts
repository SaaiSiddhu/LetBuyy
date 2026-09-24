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

test('shopper identity is behind auth-core provider seam and remains host-only', () => {
  const auth = read('packages/auth-core/src/index.ts');
  const session = read('apps/commerce/web/src/lib/session.ts');
  const cookieValidator = read('scripts/validators/cookie-realm-validator.mjs');

  assert.match(auth, /interface ShopperIdentityProvider/);
  assert.match(auth, /createHostOnlyShopperIdentityProvider/);
  assert.match(auth, /platformSessionReachable: false/);
  assert.match(auth, /hostOnly: true/);
  assert.match(session, /ShopperIdentityProvider/);
  assert.match(session, /provider\.issueSessionToken/);
  assert.match(session, /provider\.verifySessionToken/);
  assert.match(cookieValidator, /host-only/);
  assert.doesNotMatch(session, /domain\s*:/);
});
