import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import { createBoundStorefrontRequestHeaders, createLetbuyyInternalAppHeaders } from '@letbuyy/auth-core';
import { requireOwnedDatabase } from './owned-db-support';
import { Gateway, gatewayEnv, newIdentityKeys, tapRest, restJson, INTERNAL_SECRET, type RestTap } from './gateway-harness';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';
import { hashStoreAccessPassword } from '../../lib/store-access-password';

const owned = requireOwnedDatabase();
const key = 'synthetic-dedicated-commerce-key-0123456789';
const tenant = newSyntheticTenant('bound-request');
const host = tenant.subdomain + '.letbuyy.store';
const path = '/v1/internal/store-access/resolve?host=' + encodeURIComponent(host);
const verificationPath = '/v1/internal/store-access/verify';
const password = crypto.randomUUID() + crypto.randomUUID();
const q = (value: string) => "'" + value.replaceAll("'", "''") + "'";
let gateway: Gateway, tap: RestTap, fault = false;
before(async () => {
  seedSyntheticTenant(owned.psql, tenant);
  const hash = await hashStoreAccessPassword(password);
  owned.psql(`UPDATE sites SET access_mode='password',access_password_hash=${q(hash)} WHERE id=${q(tenant.siteId)};`);
  gateway = new Gateway(gatewayEnv(owned, await newIdentityKeys(), {
    NODE_ENV: 'production', NEXT_PUBLIC_STORE_ROOT_DOMAIN: 'letbuyy.store',
    STOREFRONT_INTERNAL_PERIMETER: 'bound-request-v1',
    STOREFRONT_INTERNAL_REQUEST_KEYRING: JSON.stringify({ 'commerce-storefront': key }),
    STORE_ACCESS_SIGNING_KEY: 'synthetic-owned-store-access-signing-key-0123456789',
  }));
  tap = tapRest(owned.restUrl, (call, forward) => fault && call.resource === 'rpc/consume_internal_auth_replay_jti'
    ? Promise.resolve(restJson(503, { message: 'synthetic-private-replay-storage-failure' })) : forward());
});
after(async () => { tap?.restore(); await gateway?.settle(); });
const headers = (target = path, method = 'GET', body?: string, nowMs?: number) => createBoundStorefrontRequestHeaders({
  secret: key, method, url: 'https://gateway.test' + target, body, nowMs,
});

test('mounted store-access accepts its dedicated capability with no IP allowlist and reveals only routing metadata', async () => {
  const result = await gateway.request(path, { headers: await headers() });
  assert.equal(result.status, 200, result.text);
  assert.equal(result.json?.data.site_id, tenant.siteId);
  assert.doesNotMatch(result.text, /access_password_hash|\$argon2id|template_config/);
});

test('durable replay rejects repeated requests across new Gateway instances and concurrent invocations', async () => {
  const signed = await headers();
  const results = await Promise.all(Array.from({ length: 12 }, () => new Gateway(gateway.env).request(path, { headers: signed })));
  assert.equal(results.filter(result => result.status === 200).length, 1);
  assert.equal(results.filter(result => result.status === 401).length, 11);
  assert.equal((await gateway.request(path, { headers: signed })).status, 401);
});

test('tampered request scope is refused before consuming a valid original nonce', async () => {
  const signed = await headers(), start = tap.calls.length;
  const forged = await gateway.request(path + '&extra=1', { headers: signed });
  assert.equal(forged.status, 401);
  assert.equal(tap.calls.slice(start).some(call => call.resource === 'rpc/consume_internal_auth_replay_jti'), false);
  assert.equal((await gateway.request(path, { headers: signed })).status, 200);
  for (const extra of [
    {}, { 'X-Internal-API-Secret': INTERNAL_SECRET }, { Authorization: 'Bearer ' + INTERNAL_SECRET },
    { ...await headers(), 'X-LetBuyy-Internal-Caller': 'identity' },
    await headers(path, 'GET', undefined, Date.now() - 61_000),
  ]) assert.equal((await gateway.request(path, { headers: extra })).status, 401);
});

test('unknown policy, absent key and wrong-environment key fail closed', async () => {
  const signed = await headers();
  assert.equal((await gateway.request(path, { headers: signed }, { ...gateway.env, STOREFRONT_INTERNAL_PERIMETER: 'unknown' })).status, 503);
  assert.equal((await gateway.request(path, { headers: signed }, { ...gateway.env, STOREFRONT_INTERNAL_REQUEST_KEYRING: undefined })).status, 503);
  assert.equal((await gateway.request(path, { headers: signed }, { ...gateway.env, STOREFRONT_INTERNAL_REQUEST_KEYRING: JSON.stringify({ 'commerce-storefront': key + '-foreign' }) })).status, 401);
});

test('all other internal paths retain the existing network perimeter', async () => {
  for (const other of ['/v1/internal/console/anything', '/v1/internal/billing/subscriptions/activate', '/v1/internal/events/anything', '/v1/internal/store-access/resolve/extra']) {
    const result = await gateway.request(other, { headers: await headers() });
    assert.equal(result.status, 503);
    assert.equal(result.json?.error.code, 'INTERNAL_PERIMETER_UNCONFIGURED');
  }
});

test('password verification binds the exact body, preserves normal denial and leaves the original request usable', async () => {
  const body = JSON.stringify({ site_id: tenant.siteId, host, password, ip: '2001:db8::52' });
  const signed = await headers(verificationPath, 'POST', body);
  const altered = await gateway.request(verificationPath, { method: 'POST', headers: signed, body: body.replace(password, 'synthetic-tamper') });
  assert.equal(altered.status, 401);
  const result = await gateway.request(verificationPath, { method: 'POST', headers: signed, body });
  assert.equal(result.status, 200, result.text);
  assert.equal(result.json?.data.site_id, tenant.siteId);
  assert.equal((await gateway.request(verificationPath, { method: 'POST', headers: signed, body })).status, 401);
  const wrong = JSON.stringify({ site_id: tenant.siteId, host, password: 'synthetic-wrong-password', ip: '2001:db8::53' });
  const denied = await gateway.request(verificationPath, { method: 'POST', headers: await headers(verificationPath, 'POST', wrong), body: wrong });
  assert.equal(denied.status, 401);
  assert.equal(denied.json?.error.code, 'INVALID_PASSWORD');
});

test('replay storage outage stops before host reads and recovers without leaking dependency details', async () => {
  const signed = await headers(), start = tap.calls.length;
  try {
    fault = true;
    const result = await gateway.request(path, { headers: signed });
    assert.equal(result.status, 503);
    assert.equal(result.json?.error.code, 'STOREFRONT_INTERNAL_UNAVAILABLE');
    assert.doesNotMatch(result.text, /synthetic-private|SQLSTATE|PostgREST/);
    assert.equal(tap.calls.slice(start).some(call => call.resource === 'sites'), false);
  } finally { fault = false; }
  assert.equal((await gateway.request(path, { headers: signed })).status, 200);
});


test('the dedicated Commerce key cannot authenticate as Accounts through the general internal app keyring', async () => {
  const plan = await createLetbuyyInternalAppHeaders({ app: 'accounts', secret: key });
  assert.equal(plan.ok, true);
  if (!plan.ok) throw new Error('Synthetic signing setup failed');
  const result = await gateway.request('/v1/auth/custom/users/by-email', {
    method: 'POST', headers: { ...plan.headers, 'X-LetBuyy-Internal-Caller': 'commerce-storefront', 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'synthetic-unrelated@example.invalid' }),
  });
  assert.equal(result.status, 401);
});
