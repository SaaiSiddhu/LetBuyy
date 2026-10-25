import assert from 'node:assert/strict';
import test from 'node:test';
import { ThemeEditorFixtureObservation, EDITOR_CONFIRM_REPLAY_PATH } from './owned-db/theme-editor-fixture-observation';
import type { GatewayResponse } from './owned-db/gateway-harness';

const site = '11111111-1111-4111-8111-111111111111', nonce = '22222222-2222-4222-8222-222222222222';
const cart = '33333333-3333-4333-8333-333333333333', order = '44444444-4444-4444-8444-444444444444';
const product = '55555555-5555-4555-8555-555555555555';
const hash = 'a'.repeat(64);
const proof = { siteOrderCount: 1, orderLineCount: 1, snapshotSha256: hash, productOrderLineCount: 1,
  inventoryRows: 1, inventorySha256: hash, inventoryEventCount: 1, inventoryAdjustmentCount: 1 };
const path = `/v1/checkout/${cart}/confirm?site_id=${site}&signature=PRIVATE-HANDOFF`;
const body = JSON.stringify({ idempotency_key: 'PRIVATE-ORIGINAL-UI-KEY' });
const response = (status = 200): GatewayResponse => ({ status, text: JSON.stringify({ data: { order: { id: order }, customer: 'PRIVATE-CUSTOMER' } }),
  json: { data: { order: { id: order } } }, headers: new Headers({ 'X-Request-ID': '66666666-6666-4666-8666-666666666666' }) });

function fixture(options: { own?: boolean; proof?: Record<string, unknown>; afterProof?: Record<string, unknown>; count?: number; fail?: boolean; blocked?: Promise<void>; replayStatus?: number; replayCode?: string } = {}) {
  const calls: Array<{ path: string; init: RequestInit | undefined }> = [], queries: string[] = [];
  const instance = new ThemeEditorFixtureObservation({ profile: 'editor', siteId: site, nonce,
    owned: { psql(sql: string) {
      queries.push(sql);
      if (options.fail) throw new Error('PRIVATE-DATABASE-DETAIL');
      if (sql.startsWith('SELECT c.id::text FROM public.carts')) return options.own === false ? '' : cart;
      if (sql.startsWith('SELECT EXISTS')) return options.own === false ? 'f' : 't';
      if (sql.startsWith('SELECT count')) return String(options.count ?? 1);
      return JSON.stringify(calls.length && options.afterProof ? options.afterProof : options.proof ?? proof);
    } },
    gateway: { async request(selectedPath: string, init?: RequestInit) {
      calls.push({ path: selectedPath, init }); if (options.blocked) await options.blocked;
      if (options.replayCode) {
        const json = { error: { code: options.replayCode, message: 'PRIVATE-DATABASE-DETAIL', details: { command: 'PRIVATE-ORIGINAL-UI-KEY' } } };
        return { status: options.replayStatus ?? 409, text: JSON.stringify(json), json, headers: new Headers() };
      }
      return response(options.replayStatus);
    } },
  });
  const capture = (changes: Partial<Parameters<ThemeEditorFixtureObservation['capture']>[0]> = {}) => instance.capture({ method: 'POST', path, body,
    headers: new Headers({ Authorization: 'PRIVATE-AUTH', Cookie: 'PRIVATE-COOKIE' }), response: response(), ...changes });
  const control = (selectedBody = '{"index":0}', changes: Partial<Parameters<ThemeEditorFixtureObservation['control']>[0]> = {}) => instance.control({
    method: 'POST', path: EDITOR_CONFIRM_REPLAY_PATH, nonce, body: selectedBody, ...changes,
  });
  return { instance, capture, control, calls, queries };
}

test('actual recorded successful command replays byte-for-byte without exposing body, path capabilities or auth', async () => {
  const f = fixture(); const headers = new Headers({ Authorization: 'PRIVATE-AUTH', Cookie: 'PRIVATE-COOKIE' });
  f.capture({ headers }); headers.set('Authorization', 'CHANGED');
  const replay = await f.control(); assert.equal(replay?.status, 200);
  assert.equal(f.calls.length, 1); assert.equal(f.calls[0].path, path); assert.equal(f.calls[0].init?.body, body);
  assert.equal(new Headers(f.calls[0].init?.headers).get('Authorization'), 'PRIVATE-AUTH');
  assert.deepEqual((replay?.body as {before: unknown; after: unknown}).before, (replay?.body as {after: unknown}).after);
  assert.equal((replay?.body as {sameOrder: boolean}).sameOrder, true);
  assert.equal((replay?.body as {effectsUnchanged: boolean}).effectsUnchanged, true);
  const exposed = JSON.stringify({ replay, summary: f.instance.summary(), instance: f.instance });
  assert.doesNotMatch(exposed, /PRIVATE|signature|idempotency_key|Cookie|Authorization|customer/);
  assert.equal(JSON.stringify(f.instance), '{}');
  assert.ok(f.queries.every(sql => /^SELECT /.test(sql) && sql.includes(site)));
});

test('only exact successful confirm POSTs are captured; malformed, foreign, unsuccessful and oversized traffic stays out', () => {
  const f = fixture(); f.capture(); assert.equal(f.instance.summary().records.length, 1, 'positive control first');
  for (const changes of [{ method: 'GET' }, { path: `/v1/checkout/${cart}/contact` }, { path: `https://foreign.invalid/v1/checkout/${cart}/confirm` },
    { path: `/v1/checkout/x/../${cart}/confirm` }, { path: `/v1/checkout/not-a-uuid/confirm` }, { response: response(409) }, { response: response(500) },
    { body: '{broken' }, { body: JSON.stringify({ idempotency_key: 'valid-key', arbitrary: true }) }, { body: 'x'.repeat(4097) },
    { headers: new Headers({Authorization: 'x'.repeat(16385)}) }]) f.capture(changes);
  assert.equal(f.instance.summary().records.length, 1);
  const foreign = fixture({ own: false }); foreign.capture(); assert.equal(foreign.instance.summary().records.length, 0);
  const unavailable = fixture({ fail: true }); assert.doesNotThrow(() => unavailable.capture());
  assert.equal(unavailable.instance.summary().records.length, 0); assert.equal(unavailable.instance.summary().captureFailures, 1);
  assert.doesNotMatch(JSON.stringify(unavailable.instance.summary()), /PRIVATE/);
});

test('finite controls reject wrong nonce/method and all caller-supplied paths, headers, bodies, indices and duplicate selectors', async () => {
  const f = fixture(); f.capture(); assert.equal((await f.control())?.status, 200);
  for (const invalid of ['{}','null','[]','{broken','{"index":-1}','{"index":0.5}','{"index":"0"}','{"index":32}',
    '{"index":0,"path":"/other"}','{"index":0,"headers":{}}','{"index":0,"body":"forged"}']) assert.equal((await f.control(invalid))?.status, 400);
  assert.equal((await f.control('{"index":1}'))?.status, 404);
  assert.equal((await f.control('{"index":0}', { nonce: 'wrong' }))?.status, 403);
  assert.equal((await f.control('{"index":0}', { method: 'GET' }))?.status, 405);
  assert.equal((await f.control('{"index":0}', { path: EDITOR_CONFIRM_REPLAY_PATH + '?path=/other' }))?.status, 400);
  assert.equal(f.calls.length, 1);
  for (const query of [`order_id=${order}&order_id=${order}`,'order_id=not-a-uuid','sql=SELECT+1',`product_id=${product}&headers=x`]) {
    assert.equal((await f.control('', { method: 'GET', path: '/__threadline_proof?' + query }))?.status, 400);
  }
});

test('owned proof returns only hashes/counts, denies foreign selectors and checks bounded inventory before aggregation', async () => {
  const f = fixture();
  const result = await f.control('', { method: 'GET', path: `/__threadline_proof?order_id=${order}&product_id=${product}` });
  assert.equal(result?.status, 200); assert.equal((result?.body as {snapshotSha256: string}).snapshotSha256, hash);
  assert.doesNotMatch(JSON.stringify(result?.body), /product_snapshot|customer|PRIVATE/);
  const foreign = fixture({ own: false }); assert.equal((await foreign.control('', { method: 'GET', path: `/__threadline_proof?order_id=${order}` }))?.status, 404);
  const huge = fixture({ count: 1001 }); assert.equal((await huge.control('', { method: 'GET', path: `/__threadline_proof?product_id=${product}` }))?.status, 413);
  assert.equal(huge.queries.some(sql => sql.includes('jsonb_agg')), false);
  const bad = fixture({ proof: { ...proof, snapshotSha256: 'not-a-hash', customer: 'PRIVATE' } });
  assert.equal((await bad.control('', { method: 'GET', path: `/__threadline_proof?product_id=${product}` }))?.status, 503);
});

test('replays are bounded, reject concurrent work, and disposal retires private records', async () => {
  const f = fixture(); f.capture(); f.capture(); assert.equal(f.instance.summary().records.length, 1, 'deduplicate exact observed retries');
  for (let index = 0; index < 3; index++) assert.equal((await f.control())?.status, 200);
  assert.equal((await f.control())?.status, 429); assert.equal(f.calls.length, 3);
  f.instance.dispose(); assert.equal((await f.control())?.status, 404);
  let release!: () => void; const blocked = new Promise<void>(done => { release = done; });
  const concurrent = fixture({ blocked }); concurrent.capture(); const pending = concurrent.control();
  assert.equal((await concurrent.control())?.status, 409); release(); assert.equal((await pending)?.status, 200);
});

test('non-Editor/unbound construction fails, and the capture count is finite', () => {
  assert.throws(() => new ThemeEditorFixtureObservation({ profile: 'threadline', siteId: site, nonce, owned: {psql: () => ''}, gateway: {request: async () => response()} }));
  assert.throws(() => new ThemeEditorFixtureObservation({ profile: 'editor', siteId: 'foreign', nonce, owned: {psql: () => ''}, gateway: {request: async () => response()} }));
  assert.throws(() => new ThemeEditorFixtureObservation({ profile: 'editor', siteId: site, nonce: 'unbound', owned: {psql: () => ''}, gateway: {request: async () => response()} }));
  const f = fixture();
  for (let index = 0; index < 33; index++) f.capture({ body: JSON.stringify({ idempotency_key: 'observed-key-' + index }) });
  assert.equal(f.instance.summary().records.length, 32); assert.equal(f.instance.summary().captureFailures, 1);
});

test('a failed normal Gateway replay stays failed and cannot be credited from a control acknowledgement', async () => {
  const f = fixture({replayStatus: 401}); f.capture(); const result = await f.control();
  assert.equal(result?.status, 401);
  assert.equal((result?.body as {responseStatus: number}).responseStatus, 401);
  assert.equal((result?.body as {sameOrder: boolean}).sameOrder, false);
  assert.equal((result?.body as {orderId: unknown}).orderId, null);
});

test('same-key conflict copies only a captured owned COD command, changes one nonkey field and reports the Gateway result', async () => {
  const f = fixture({ replayStatus: 409, replayCode: 'CONFLICT' });
  const command = { idempotency_key: 'PRIVATE-ORIGINAL-UI-KEY', payment_intent_id: 'cod_PRIVATE-original', razorpay_signature: 'PRIVATE-EXISTING-FIELD' };
  const capturedBody = JSON.stringify(command);
  f.capture({ body: capturedBody });
  const result = await f.control('{"index":0,"mode":"same-key-conflict"}');
  assert.equal(result?.status, 409); assert.equal(f.calls.length, 1);
  const call = f.calls[0], altered = JSON.parse(String(call.init?.body));
  assert.equal(call.path, path); assert.equal(call.init?.method, 'POST');
  assert.deepEqual(altered, { ...command, payment_intent_id: 'cod_fixture_same_key_conflict_1' });
  assert.equal(new Headers(call.init?.headers).get('Authorization'), 'PRIVATE-AUTH');
  assert.equal(new Headers(call.init?.headers).get('Cookie'), 'PRIVATE-COOKIE');
  const report = result?.body as {mode: string; responseStatus: number; responseCode: string; commandSha256: string; replayCommandSha256: string; effectsUnchanged: boolean; sameOrder: boolean; orderId: unknown};
  assert.equal(report.mode, 'same-key-conflict'); assert.equal(report.responseStatus, 409); assert.equal(report.responseCode, 'CONFLICT');
  assert.notEqual(report.replayCommandSha256, report.commandSha256);
  assert.equal(report.effectsUnchanged, true); assert.equal(report.sameOrder, false); assert.equal(report.orderId, null);
  assert.doesNotMatch(JSON.stringify({ result, summary: f.instance.summary() }), /PRIVATE|signature|idempotency_key|Cookie|Authorization|customer/);
  assert.equal(f.instance.summary().records.length, 1);
  // A conflict probe never rewrites the captured command used by the default exact replay.
  await f.control(); assert.equal(f.calls[1].init?.body, capturedBody);
});

test('fixed conflict mutation remains different when the captured intent already equals the first sentinel', async () => {
  for (const payment_intent_id of [undefined, 'cod_fixture_same_key_conflict_1', 'cod_fixture_same_key_conflict_2']) {
    const f = fixture({ replayStatus: 409, replayCode: 'CONFLICT' });
    const command = { idempotency_key: 'PRIVATE-ORIGINAL-UI-KEY', ...(payment_intent_id ? { payment_intent_id } : {}) };
    f.capture({ body: JSON.stringify(command) });
    assert.equal((await f.control('{"index":0,"mode":"same-key-conflict"}'))?.status, 409);
    const altered = JSON.parse(String(f.calls[0].init?.body));
    assert.equal(altered.idempotency_key, command.idempotency_key);
    assert.notEqual(altered.payment_intent_id, payment_intent_id);
    assert.equal(altered.payment_intent_id, payment_intent_id === 'cod_fixture_same_key_conflict_1' ? 'cod_fixture_same_key_conflict_2' : 'cod_fixture_same_key_conflict_1');
  }
});

test('conflict mode is a strict selector and never accepts caller-controlled commands or capabilities', async () => {
  const f = fixture(); f.capture();
  for (const invalid of ['{"mode":"same-key-conflict"}', '{"index":0,"mode":"exact"}', '{"index":0,"mode":null}', '{"index":0,"mode":true}',
    '{"index":0,"mode":{}}', '{"index":0,"mode":"same-key-conflict","body":{}}', '{"index":0,"mode":"same-key-conflict","path":"/other"}',
    '{"index":0,"mode":"same-key-conflict","headers":{}}', '{"index":0,"mode":"same-key-conflict","idempotency_key":"forged"}',
    '{"index":0,"mode":"same-key-conflict","payment_intent_id":"caller"}', ' '.repeat(129)]) {
    assert.equal((await f.control(invalid))?.status, 400);
  }
  assert.equal((await f.control('{"index":0,"mode":"same-key-conflict"}', { nonce: 'wrong' }))?.status, 403);
  assert.equal((await f.control('{"index":0,"mode":"same-key-conflict"}', { method: 'GET' }))?.status, 405);
  assert.equal((await f.control('{"index":0,"mode":"same-key-conflict"}', { path: EDITOR_CONFIRM_REPLAY_PATH + '?mode=same-key-conflict' }))?.status, 400);
  assert.equal((await f.control('{"index":1,"mode":"same-key-conflict"}'))?.status, 404);
  assert.equal(f.calls.length, 0);
});

test('conflict and exact replay share the same finite budget and busy guard', async () => {
  const f = fixture(); f.capture();
  await f.control(); await f.control('{"index":0,"mode":"same-key-conflict"}'); await f.control();
  assert.equal((await f.control('{"index":0,"mode":"same-key-conflict"}'))?.status, 429);
  assert.equal(f.calls.length, 3); assert.equal(f.instance.summary().records[0].replays, 3);
  let release!: () => void; const blocked = new Promise<void>(done => { release = done; });
  const concurrent = fixture({ blocked }); concurrent.capture();
  const pending = concurrent.control('{"index":0,"mode":"same-key-conflict"}');
  assert.equal((await concurrent.control())?.status, 409);
  assert.equal((await concurrent.control('{"index":0,"mode":"same-key-conflict"}'))?.status, 409);
  release(); assert.equal((await pending)?.status, 200);
  assert.equal(concurrent.calls.length, 1);
});

test('conflict replay rechecks current ownership and cannot use a retired capture', async () => {
  const options = { own: true }; const f = fixture(options); f.capture();
  options.own = false;
  assert.equal((await f.control('{"index":0,"mode":"same-key-conflict"}'))?.status, 404);
  assert.equal(f.calls.length, 0);
  f.instance.dispose();
  assert.equal((await f.control('{"index":0,"mode":"same-key-conflict"}'))?.status, 404);
});

test('conflict report preserves real failure codes/status and effect differences without leaking arbitrary errors', async () => {
  const mismatch = fixture({ replayStatus: 409, replayCode: 'CHECKOUT_PAYMENT_INTENT_MISMATCH', afterProof: { ...proof, inventoryEventCount: 2 } });
  mismatch.capture();
  const result = await mismatch.control('{"index":0,"mode":"same-key-conflict"}');
  assert.equal(result?.status, 409);
  assert.equal((result?.body as {responseCode: string}).responseCode, 'CHECKOUT_PAYMENT_INTENT_MISMATCH');
  assert.equal((result?.body as {effectsUnchanged: boolean}).effectsUnchanged, false);
  const privateError = fixture({ replayStatus: 503, replayCode: 'PRIVATE_CUSTOMER_COMMAND' }); privateError.capture();
  const refused = await privateError.control('{"index":0,"mode":"same-key-conflict"}');
  assert.equal(refused?.status, 503); assert.equal((refused?.body as {responseCode: unknown}).responseCode, null);
  assert.doesNotMatch(JSON.stringify(refused), /PRIVATE|message|details|command:/);
  const unexpectedSuccess = fixture(); unexpectedSuccess.capture();
  const success = await unexpectedSuccess.control('{"index":0,"mode":"same-key-conflict"}');
  assert.equal(success?.status, 200); assert.equal((success?.body as {responseStatus: number}).responseStatus, 200);
  assert.equal((success?.body as {responseCode: unknown}).responseCode, null);
});

type FailedRequest = { operation: 'cart-replace' | 'checkout-contact' | 'checkout-delivery' | 'checkout-payment-intent' | 'checkout-confirm'; cartId: string; status: number;
  responseCode: string | null; requestId: string | null; commandSha256: string; responseSha256: string };
const failedRequests = (instance: ThemeEditorFixtureObservation): FailedRequest[] =>
  (instance.summary() as unknown as { failedRequests?: FailedRequest[] }).failedRequests ?? [];
const failureCount = (instance: ThemeEditorFixtureObservation): number =>
  (instance.summary() as unknown as { failedCaptureFailures?: number }).failedCaptureFailures ?? 0;
const cartToken = 'ct_' + 'a'.repeat(32);
const cartPath = `/v1/storefront/syn-editor-diagnostics/cart/${cartToken}`;
function rejected(status = 409, code: unknown = 'CHECKOUT_PRODUCT_CHANGED'): GatewayResponse {
  const json = { error: { code, message: 'PRIVATE-DATABASE-DETAIL', details: { signature: 'PRIVATE-HANDOFF', contact: 'PRIVATE-CUSTOMER' } } };
  return { status, text: JSON.stringify(json), json,
    headers: new Headers({ 'X-Request-ID': '77777777-7777-4777-8777-777777777777', 'Set-Cookie': 'PRIVATE-COOKIE' }) };
}

test('failed owned confirmation retains actual status/code/hashes without becoming a successful replay candidate', async () => {
  const f = fixture();
  f.capture({ response: rejected() });
  assert.equal(failedRequests(f.instance).length, 1, 'previously dropped non-2xx confirmation');
  assert.deepEqual(failedRequests(f.instance)[0], {
    operation: 'checkout-confirm', cartId: cart, status: 409, responseCode: 'CHECKOUT_PRODUCT_CHANGED',
    requestId: '77777777-7777-4777-8777-777777777777', commandSha256: failedRequests(f.instance)[0].commandSha256,
    responseSha256: failedRequests(f.instance)[0].responseSha256,
  });
  assert.match(failedRequests(f.instance)[0].commandSha256, /^[a-f0-9]{64}$/);
  assert.match(failedRequests(f.instance)[0].responseSha256, /^[a-f0-9]{64}$/);
  assert.equal(f.instance.summary().records.length, 0);
  assert.equal((await f.control())?.status, 404);
  assert.equal(f.calls.length, 0, 'failed commands have no replay control');
  f.capture();
  assert.equal(f.instance.summary().records[0].index, 0, 'successful indices remain independent');
  assert.equal((await f.control())?.status, 200);
  assert.equal(f.calls[0].path, path); assert.equal(f.calls[0].init?.body, body);
});

test('failed canonical cart replace binds the actual owned cart and leaves the Gateway response intact', () => {
  const f = fixture(), result = rejected(409, 'INSUFFICIENT_INVENTORY');
  const before = JSON.stringify({ ...result, headers: [...result.headers] });
  f.capture({ method: 'PATCH', path: cartPath, body: '{"lines":[]}', response: result });
  assert.equal(failedRequests(f.instance).length, 1, 'previously dropped non-2xx cart update');
  assert.equal(failedRequests(f.instance)[0].operation, 'cart-replace');
  assert.equal(failedRequests(f.instance)[0].cartId, cart);
  assert.equal(failedRequests(f.instance)[0].status, 409);
  assert.equal(failedRequests(f.instance)[0].responseCode, 'INSUFFICIENT_INVENTORY');
  failedRequests(f.instance)[0].status = 200;
  assert.equal(failedRequests(f.instance)[0].status, 409, 'summary consumers cannot rewrite the retained diagnostic');
  assert.ok(f.queries.some(sql => sql.startsWith('SELECT c.id::text FROM public.carts')
    && sql.includes(site) && sql.includes('s.subdomain=') && sql.includes('syn-editor-diagnostics') && sql.includes('c.session_id=')));
  assert.equal(JSON.stringify({ ...result, headers: [...result.headers] }), before);
  assert.equal(f.calls.length, 0);
});

test('POST replacement diagnostics require an existing owned token, and never infer a cart from an unsuccessful create', () => {
  const f = fixture();
  const replace = `/v1/storefront/syn-editor-diagnostics/cart`;
  f.capture({ path: replace, body: JSON.stringify({ cart_token: cartToken, lines: [] }), response: rejected(409, 'INSUFFICIENT_INVENTORY') });
  assert.equal(failedRequests(f.instance).length, 1);
  const before = f.queries.length;
  for (const command of [{ lines: [] }, { cart_token: null, lines: [] }, { cart_token: "x' OR true--", lines: [] }]) {
    f.capture({ path: replace, body: JSON.stringify(command), response: rejected() });
  }
  assert.equal(failedRequests(f.instance).length, 1);
  assert.equal(f.queries.length, before, 'unbound or unsafe creates do not reach ownership SQL');
});

test('failed diagnostics recheck fixture-site cart ownership before either operation', () => {
  const options = { own: true }, f = fixture(options);
  f.capture({ response: rejected() }); assert.equal(failedRequests(f.instance).length, 1, 'positive first');
  options.own = false;
  f.capture({ response: rejected() });
  f.capture({ method: 'PATCH', path: cartPath, response: rejected() });
  assert.equal(failedRequests(f.instance).length, 1);
  assert.ok(f.queries.every(sql => /^SELECT /.test(sql) && sql.includes(site)));
});

test('noncanonical paths, SQL-shaped tokens and conflicting signed sites cannot create failed diagnostics', () => {
  const f = fixture();
  f.capture({ response: rejected() }); assert.equal(failedRequests(f.instance).length, 1, 'positive first');
  const before = f.queries.length;
  for (const [method, selectedPath] of [
    ['GET', cartPath], ['PATCH', cartPath + '/discount-codes'], ['PATCH', cartPath + '?token=PRIVATE'],
    ['PATCH', '/v1/storefront/syn-editor-diagnostics/cart/x%27OR%20true--'],
    ['PATCH', '/v1/storefront/x%27OR%20true--/cart/' + cartToken],
    ['PATCH', '//foreign.invalid/v1/storefront/syn-editor-diagnostics/cart/' + cartToken],
    ['PATCH', 'https://foreign.invalid' + cartPath], ['PATCH', cartPath + '#PRIVATE'],
    ['POST', `/v1/checkout/${cart}/confirm?site_id=${product}`],
    ['POST', path + `&site_id=${site}`], ['POST', `/v1/checkout/${cart}/contact?site_id=${site}`],
  ]) f.capture({ method, path: selectedPath, response: rejected() });
  assert.equal(failedRequests(f.instance).length, 1);
  assert.equal(f.queries.length, before, 'invalid inputs rejected before ownership SQL');
});

test('unknown or malformed error codes and request IDs stay redacted while real response status is retained', () => {
  const f = fixture();
  for (const code of ['PRIVATE_DATABASE_COMMAND', { private: 'PRIVATE' }, null]) {
    const result = rejected(503, code); result.headers.set('X-Request-ID', 'PRIVATE-REQUEST-ID');
    f.capture({ response: result });
  }
  assert.equal(failedRequests(f.instance).length, 3);
  assert.ok(failedRequests(f.instance).every(item => item.responseCode === null && item.requestId === null && item.status === 503));
  assert.doesNotMatch(JSON.stringify(f.instance.summary()), /PRIVATE|signature|cart_token|ct_|Set-Cookie|Authorization|contact|message|details/);
});

test('failed request/response size bounds never alter acknowledgements or expose private contents', () => {
  const f = fixture(); f.capture({ response: rejected() });
  assert.equal(failedRequests(f.instance).length, 1, 'positive first');
  for (const changes of [{ body: 'x'.repeat(4097) },
    { response: { ...rejected(), text: 'PRIVATE' + 'x'.repeat(4097) } }]) {
    assert.doesNotThrow(() => f.capture({ response: rejected(), ...changes }));
  }
  assert.equal(failedRequests(f.instance).length, 1);
  assert.equal(failureCount(f.instance), 2);
  assert.doesNotMatch(JSON.stringify(f.instance.summary()), /PRIVATE/);
});

test('failed diagnostics never inspect request authentication or cookie headers', () => {
  const f = fixture();
  const unreadableHeaders = new Proxy(new Headers(), { get() { throw new Error('PRIVATE-HEADER-READ'); } });
  f.capture({ headers: unreadableHeaders, response: rejected() });
  assert.equal(failedRequests(f.instance).length, 1);
  assert.equal(failureCount(f.instance), 0);
  assert.doesNotMatch(JSON.stringify(f.instance.summary()), /PRIVATE|Cookie|Authorization/);
});

test('failed diagnostic storage is separately bounded and cannot consume or address successful replay indices', async () => {
  const f = fixture();
  for (let index = 0; index < 129; index++) f.capture({ response: rejected() });
  assert.equal(failedRequests(f.instance).length, 128);
  assert.equal(failureCount(f.instance), 1);
  assert.equal(f.queries.length, 128, 'full diagnostics stop before further ownership reads');
  assert.equal(f.instance.summary().records.length, 0);
  assert.equal((await f.control())?.status, 404);
  f.capture();
  assert.equal(f.instance.summary().records.length, 1); assert.equal(f.instance.summary().records[0].index, 0);
  assert.equal((await f.control())?.status, 200); assert.equal(f.calls.length, 1);
});

test('failed diagnostics remain behind the existing nonce/profile gate and disposal retires them', async () => {
  const f = fixture(); f.capture({ response: rejected() }); assert.equal(failedRequests(f.instance).length, 1);
  const denied = await f.control('', { method: 'GET', path: '/__threadline_proof', nonce: 'wrong' });
  assert.equal(denied?.status, 403); assert.doesNotMatch(JSON.stringify(denied), /cartId|responseSha256|PRIVATE/);
  const summary = await f.control('', { method: 'GET', path: '/__threadline_proof' });
  assert.equal((summary?.body as {editorObservations: {failedRequests: FailedRequest[]}}).editorObservations.failedRequests.length, 1);
  f.instance.dispose(); assert.equal(failedRequests(f.instance).length, 0);
  assert.equal((await f.control())?.status, 404); assert.equal(f.calls.length, 0);
});

test('a failed diagnostic ownership read fails closed without throwing or changing the actual response', () => {
  const f = fixture({ fail: true }), result = rejected(); const before = JSON.stringify(result);
  assert.doesNotThrow(() => f.capture({ response: result }));
  assert.equal(failedRequests(f.instance).length, 0); assert.equal(failureCount(f.instance), 1);
  assert.equal(JSON.stringify(result), before); assert.equal(f.instance.summary().captureFailures, 0);
  assert.doesNotMatch(JSON.stringify(f.instance.summary()), /PRIVATE/);
});

const checkoutStepCommands = {
  contact: { idempotency_key: 'PRIVATE-CONTACT-KEY', email: 'diagnostic@example.invalid', name: 'Synthetic Buyer' },
  delivery: { idempotency_key: 'PRIVATE-DELIVERY-KEY', shipping_method: 'standard', shipping_address: { line1: 'PRIVATE-ADDRESS', city: 'Synthetic City' }, cod_requested: true },
  'payment-intent': { idempotency_key: 'PRIVATE-PAYMENT-KEY', provider: 'cod', mode: 'sandbox' },
};

test('actual owned contact/delivery/payment-intent failures retain only status/code/correlation/hashes after canonical schema binding', async () => {
  const f = fixture(), unreadableHeaders = new Proxy(new Headers(), { get() { throw new Error('PRIVATE-HEADER-READ'); } });
  for (const [step, command] of Object.entries(checkoutStepCommands)) {
    const result = rejected(409, 'CHECKOUT_STATE_CONFLICT'), before = JSON.stringify(result);
    f.capture({ path: `/v1/checkout/${cart}/${step}?site_id=${site}&signature=PRIVATE-HANDOFF`, body: JSON.stringify(command), headers: unreadableHeaders, response: result });
    const observed = failedRequests(f.instance).at(-1)!;
    assert.equal(observed.operation, `checkout-${step}`);
    assert.equal(observed.cartId, cart); assert.equal(observed.status, 409);
    assert.equal(observed.responseCode, 'CHECKOUT_STATE_CONFLICT');
    assert.equal(observed.requestId, '77777777-7777-4777-8777-777777777777');
    assert.match(observed.commandSha256, /^[a-f0-9]{64}$/); assert.match(observed.responseSha256, /^[a-f0-9]{64}$/);
    assert.equal(JSON.stringify(result), before, 'observation cannot change the acknowledgement');
  }
  assert.equal(failedRequests(f.instance).length, 3); assert.equal(failureCount(f.instance), 0);
  assert.equal(f.instance.summary().records.length, 0); assert.equal((await f.control())?.status, 404);
  assert.equal(f.calls.length, 0, 'no gateway mutation/replay');
  assert.ok(f.queries.every(sql => /^SELECT /.test(sql) && sql.includes(site) && sql.includes(cart)));
  assert.doesNotMatch(JSON.stringify(f.instance.summary()), /PRIVATE|diagnostic@example|Synthetic Buyer|ADDRESS|shipping_address|idempotency_key|Cookie|Authorization|signature|cart_token/);
});

test('new failed steps reject malformed body, unknown/duplicate queries, wrong methods/steps/sites before ownership reads', () => {
  const f = fixture();
  for (const [step, command] of Object.entries(checkoutStepCommands)) {
    const selectedPath = `/v1/checkout/${cart}/${step}?site_id=${site}`, serialized = JSON.stringify(command);
    f.capture({ path: selectedPath, body: serialized, response: rejected() });
    assert.equal(failedRequests(f.instance).at(-1)?.operation, `checkout-${step}`, 'positive first');
    const count = failedRequests(f.instance).length, queries = f.queries.length;
    for (const change of [
      { method: 'GET' }, { path: selectedPath + '&unexpected=PRIVATE' },
      { path: selectedPath + `&site_id=${site}` }, { path: selectedPath + '&signature=a&signature=b' },
      { path: `/v1/checkout/${cart}/${step}?site_id=${product}` },
      { path: `/v1/checkout/${cart}/unallocated-step?site_id=${site}` },
      { path: 'https://foreign.invalid' + selectedPath }, { path: selectedPath + '#PRIVATE' },
      { body: '{broken' }, { body: JSON.stringify({ idempotency_key: 'PRIVATE-KEY', arbitrary: true }) },
      { body: 'x'.repeat(4097) }, { response: { ...rejected(), text: 'PRIVATE' + 'x'.repeat(4097) } },
    ]) f.capture({ path: selectedPath, body: serialized, response: rejected(), ...change });
    assert.equal(failedRequests(f.instance).length, count);
    assert.equal(f.queries.length, queries);
  }
  assert.doesNotMatch(JSON.stringify(f.instance.summary()), /PRIVATE|signature|cart_token|shipping_address/);
});

test('additional step diagnostics recheck same-site cart ownership and fail closed on read failure', () => {
  const options = { own: true, fail: false }, f = fixture(options);
  for (const [step, command] of Object.entries(checkoutStepCommands)) {
    const input = { path: `/v1/checkout/${cart}/${step}?site_id=${site}`, body: JSON.stringify(command), response: rejected() };
    options.own = true; f.capture(input); const count = failedRequests(f.instance).length;
    options.own = false; f.capture(input); assert.equal(failedRequests(f.instance).length, count);
    options.fail = true; assert.doesNotThrow(() => f.capture(input)); options.fail = false;
    assert.equal(failedRequests(f.instance).length, count);
  }
  assert.equal(failureCount(f.instance), 3); assert.equal(f.calls.length, 0);
  assert.doesNotMatch(JSON.stringify(f.instance.summary()), /PRIVATE/);
});

test('successful new steps and unknown codes cannot acquire a confirm replay or expose provider/private details', () => {
  const f = fixture();
  for (const [step, command] of Object.entries(checkoutStepCommands)) {
    const input = { path: `/v1/checkout/${cart}/${step}?site_id=${site}`, body: JSON.stringify(command) };
    f.capture({ ...input, response: response() }); assert.equal(failedRequests(f.instance).length, 0);
  }
  for (const [step, command] of Object.entries(checkoutStepCommands)) {
    f.capture({ path: `/v1/checkout/${cart}/${step}?site_id=${site}`, body: JSON.stringify(command), response: rejected(503, 'PRIVATE-PROVIDER-DETAIL') });
    assert.equal(failedRequests(f.instance).at(-1)?.responseCode, null);
    assert.equal(failedRequests(f.instance).at(-1)?.status, 503);
  }
  assert.equal(f.instance.summary().records.length, 0); assert.equal(f.calls.length, 0);
  assert.doesNotMatch(JSON.stringify(f.instance.summary()), /PRIVATE|provider|signature|idempotency_key/);
});
