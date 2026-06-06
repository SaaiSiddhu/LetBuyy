import test from 'node:test';
import assert from 'node:assert/strict';
import { extractMobileSessionToken } from '../src/index';

test('extracts lb_session from bearer authorization first', () => {
  const request = new Request('https://bff.letbuyy.store/v1/products', {
    headers: {
      Authorization: 'Bearer bearer-session',
      Cookie: 'lb_session=cookie-session',
      'X-LetBuyy-Session-Token': 'header-session',
    },
  });

  assert.equal(extractMobileSessionToken(request), 'bearer-session');
});

test('extracts lb_session from explicit mobile header', () => {
  const request = new Request('https://bff.letbuyy.store/v1/products', {
    headers: {
      Cookie: 'lb_session=cookie-session',
      'X-LetBuyy-Session-Token': 'header-session',
    },
  });

  assert.equal(extractMobileSessionToken(request), 'header-session');
});

test('extracts lb_session from cookie fallback', () => {
  const request = new Request('https://bff.letbuyy.store/v1/products', {
    headers: {
      Cookie: 'other=value; lb_session=cookie-session',
    },
  });

  assert.equal(extractMobileSessionToken(request), 'cookie-session');
});
