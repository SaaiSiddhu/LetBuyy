import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveLetbuyyPlatformCookieNames } from '../src/index.ts';

test('staging platform cookies cannot overwrite any production platform cookie', () => {
  const production = resolveLetbuyyPlatformCookieNames('production');
  const staging = resolveLetbuyyPlatformCookieNames('staging');
  assert.equal(production.session, 'lb_session');
  assert.equal(staging.session, 'lb_session_staging');
  for (const name of Object.values(staging)) {
    assert.ok(!Object.values(production).includes(name));
  }
  assert.deepEqual(resolveLetbuyyPlatformCookieNames(), production);
  assert.deepEqual(resolveLetbuyyPlatformCookieNames('local'), production);
  assert.deepEqual(resolveLetbuyyPlatformCookieNames(' STAGING '), staging);
});
