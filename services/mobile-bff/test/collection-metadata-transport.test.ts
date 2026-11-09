// Actual BFF transport; current actor/store/rules and atomic effects remain
// authoritative in Gateway/SQL, exercised independently by the owned APK lane.
import assert from 'node:assert/strict';
import test from 'node:test';
import app from '../src/index';

const token = 's'.repeat(32), id = '7137d783-5824-443a-b1e1-681eec94c32e';
const root = '/v1/smart-collections';
const routes = [['GET', root], ['POST', root], ['GET', `${root}/${id}`],
  ['GET', `${root}/${id}/preview`], ['PATCH', `${root}/${id}`], ['DELETE', `${root}/${id}`]] as const;
test('finite smart collection reads and commands retain scope, original intent/key and signed session transport', async () => {
  const seen: string[] = [];
  const body = JSON.stringify({ store_id: id, version: 7, name: 'Synthetic retained draft', conditions: [{ field: 'title', op: 'contains', value: 'cotton' }] });
  const env = { INTERNAL_API_SECRET: 'synthetic-collection-transport-key', API_GATEWAY_SERVICE: { fetch: async (request: Request) => {
    const url = new URL(request.url); seen.push(`${request.method} ${url.pathname}`);
    assert.equal(url.search, '?store_id=' + id + '&page=2&limit=20');
    assert.equal(request.headers.get('X-Store-ID'), id);
    assert.equal(request.headers.get('X-Idempotency-Key'), id);
    assert.equal(request.headers.get('Authorization'), null); assert.equal(request.headers.get('Cookie'), null);
    assert.equal(request.headers.get('X-LetBuyy-Session-Token'), null);
    assert.equal(request.headers.get('X-LetBuyy-Internal-Session-Token'), token);
    assert.ok(request.headers.get('X-LetBuyy-Internal-Signature'));
    if (request.method !== 'GET') assert.equal(await request.text(), body);
    return Response.json({ data: { forwarded: true } }, { status: request.method === 'POST' ? 201 : 200 });
  } } };
  for (const [method, path] of routes) {
    const response = await app.fetch(new Request('https://bff.example.invalid' + path + '?store_id=' + id + '&page=2&limit=20', {
      method, headers: { Authorization: `Bearer ${token}`, Cookie: `lb_session=${token}`, 'X-Store-ID': id, 'X-Idempotency-Key': id, 'Content-Type': 'application/json' },
      ...(method !== 'GET' ? { body } : {}),
    }), env as never);
    assert.equal(response.status, method === 'POST' ? 201 : 200);
    assert.deepEqual(await response.json(), { data: { forwarded: true } });
  }
  assert.deepEqual(seen, routes.map(([method, path]) => `${method} ${path}`));
});
test('smart transport refuses missing sessions, adjacent paths and unsupported method/path pairs before the binding', async () => {
  let calls = 0;
  const env = { INTERNAL_API_SECRET: 'synthetic-collection-transport-key', API_GATEWAY_SERVICE: { fetch: async () => { calls++; return Response.json({}); } } };
  for (const [method, path] of routes) assert.equal((await app.fetch(new Request('https://bff.example.invalid' + path, { method }), env as never)).status, 401);
  for (const [method, path] of [
    ['PUT', root], ['DELETE', root], ['PATCH', root], ['POST', `${root}/${id}`], ['PUT', `${root}/${id}`],
    ['POST', `${root}/${id}/preview`], ['HEAD', `${root}/${id}`], ['GET', root + '-export'],
    ['GET', root + '/private'], ['GET', `${root}/${id}/private`], ['GET', `${root}/${id}/preview/private`],
  ]) assert.equal((await app.fetch(new Request('https://bff.example.invalid' + path, { method, headers: { Authorization: `Bearer ${token}` } }), env as never)).status, 404);
  assert.equal(calls, 0);
});
test('smart transport preserves current Gateway denial, stale version and unavailability without false acknowledgement', async () => {
  for (const status of [401, 403, 409, 503]) {
    const body = { error: { code: 'SYNTHETIC_CURRENT_BOUNDARY', message: 'Synthetic current Gateway response' } };
    const env = { INTERNAL_API_SECRET: 'synthetic-collection-transport-key', API_GATEWAY_SERVICE: { fetch: async () => Response.json(body, { status }) } };
    const response = await app.fetch(new Request(`https://bff.example.invalid${root}/${id}`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: '{}' }), env as never);
    assert.equal(response.status, status); assert.deepEqual(await response.json(), body);
  }
});
