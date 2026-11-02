import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import { requireOwnedDatabase } from './owned-db-support';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders, tapRest } from './gateway-harness';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';
import { InventoryHistoryEntrySchema } from '@letbuyy/shared-types';
import { createLetbuyyApiClient, LetbuyyApiError } from '@letbuyy/api-client';

const owned = requireOwnedDatabase();
const site = newSyntheticTenant('history-a'), other = newSyntheticTenant('history-b'), foreign = newSyntheticTenant('history-foreign');
const actor = crypto.randomUUID(), email = `syn-history-${actor}@example.invalid`;
const staff = crypto.randomUUID(), staffEmail = `syn-history-staff-${staff}@example.invalid`;
const product = crypto.randomUUID(), otherProduct = crypto.randomUUID(), foreignProduct = crypto.randomUUID();
const ids = Array.from({ length: 3 }, () => crypto.randomUUID()).sort().reverse();
let gateway: Gateway;
before(async () => {
    for (const tenant of [site, other, foreign]) seedSyntheticTenant(owned.psql, tenant);
    owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${actor}','${email}',true),('${staff}','${staffEmail}',true);
      UPDATE sites SET custom_user_id='${actor}' WHERE id IN ('${site.siteId}','${other.siteId}');
      INSERT INTO employees(user_id,email,store_id,role,status,is_active,permissions) VALUES('${staff}','${staffEmail}','${site.siteId}','editor','active',true,'{"granted":["products:read"]}');
      INSERT INTO products(id,store_id,name,price,stock) VALUES
        ('${product}','${site.siteId}','Synthetic history A',1.25,7),
        ('${otherProduct}','${other.siteId}','Synthetic history B',1.25,7),
        ('${foreignProduct}','${foreign.siteId}','Synthetic foreign history',1.25,7);
      INSERT INTO inventory_adjustments(id,store_id,product_id,location_id,quantity_change,reason,created_by,created_at) VALUES
        ${ids.map((id,i) => `('${id}','${site.siteId}','${product}','${site.locationId}',1,'${['recount','reserved','unreserved'][i]}','${actor}','2026-10-01T00:00:00Z')`).join(',')},
        (gen_random_uuid(),'${other.siteId}','${otherProduct}','${other.locationId}',1,'recount','${actor}','2026-10-01T00:00:00Z'),
        (gen_random_uuid(),'${foreign.siteId}','${foreignProduct}','${foreign.locationId}',1,'recount',null,'2026-10-01T00:00:00Z');`);
    gateway = new Gateway(gatewayEnv(owned, await newIdentityKeys()));
});
after(async () => { await gateway?.settle(); });
async function history(query: Record<string, string> = {}, options: { selected?: string; bound?: string; staff?: boolean } = {}) {
    const selected = options.selected ?? site.siteId;
    return gateway.request(`/v1/inventory/history?${new URLSearchParams({ store_id: selected, limit: '2', ...query })}`, {
        headers: { ...await signedIdentityHeaders(options.staff ? staff : actor, options.staff ? staffEmail : email, options.bound), 'X-Store-ID': selected },
    });
}

test('a selected-store history query observes its own nonzero population and acknowledgement, never another owned store', async () => {
    const response = await history();
    assert.equal(response.status, 200, response.text);
    assert.equal(response.json?.data.length, 2);
    for (const row of response.json?.data ?? []) InventoryHistoryEntrySchema.parse(row);
    assert.equal(response.json?.meta.total, 3);
    assert.equal(response.json?.meta.store_id, site.siteId);
    assert.ok(response.json?.data.every((row: { store_id: string; product_id: string }) => row.store_id === site.siteId && row.product_id === product));
    const second = await history({}, { selected: other.siteId });
    assert.equal(second.status, 200, second.text);
    assert.equal(second.json?.data.length, 1);
    assert.equal(second.json?.data[0].product_id, otherProduct);
});
test('the real typed SDK reads the actual scoped worker pages and preserves authorization refusals', async () => {
    const api = createLetbuyyApiClient({
        baseUrl: 'https://owned-gateway.example.invalid/v1',
        getHeaders: () => signedIdentityHeaders(actor, email),
        fetch: async (input, init) => {
            const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
            assert.equal(url.hostname, 'owned-gateway.example.invalid');
            const response = await gateway.request(url.pathname + url.search, init);
            return new Response(response.text, { status: response.status, headers: response.headers });
        },
    });
    const first = await api.inventory.history({ store_id: site.siteId, limit: 2 });
    const second = await api.inventory.history({ store_id: site.siteId, limit: 2, page: 2 });
    assert.deepEqual([...first.data, ...second.data].map(row => row.id), ids);
    assert.equal(first.total, 3); assert.equal(second.total, 3);
    const alternate = await api.inventory.history({ store_id: other.siteId, limit: 2 });
    assert.equal(alternate.data.length, 1); assert.equal(alternate.data[0].store_id, other.siteId);
    await assert.rejects(() => api.inventory.history({ store_id: foreign.siteId, limit: 2 }), error => error instanceof LetbuyyApiError && [403,404].includes(error.status));
});
test('a store-bound identity cannot replace its explicit query with another owned or foreign store', async () => {
    const positive = await history({}, { bound: site.siteId });
    assert.equal(positive.status, 200, positive.text); assert.equal(positive.json?.data.length, 2);
    for (const selected of [other.siteId, foreign.siteId]) {
        const denied = await history({}, { selected, bound: site.siteId });
        assert.ok([403, 404].includes(denied.status), denied.text);
        assert.equal(denied.json?.data, undefined);
        assert.doesNotMatch(denied.text, /Synthetic history|Synthetic foreign/);
    }
});
test('history has deterministic equal-time pages and preserves the matching total after an empty far page', async () => {
    const pages = await Promise.all([history(), history({ page: '2' })]);
    for (const page of pages) assert.equal(page.status, 200, page.text);
    assert.deepEqual(pages.flatMap(page => page.json?.data.map((row: { id: string }) => row.id)), ids);
    for (const page of pages) for (const row of page.json?.data ?? []) InventoryHistoryEntrySchema.parse(row);
    const empty = await history({ page: '99' });
    assert.equal(empty.status, 200, empty.text); assert.deepEqual(empty.json?.data, []); assert.equal(empty.json?.meta.total, 3);
});
test('invalid history scope and page shapes are refused before query execution', async () => {
    const queries: Record<string, string>[] = [{ page: '0' }, { page: '-1' }, { page: '1.5' }, { limit: '0' }, { product_id: 'forged),store_id.eq.any' }, { store_id: 'not-a-store-id' }];
    for (const query of queries) {
        const response = await history(query); assert.equal(response.status, 400, response.text); assert.equal(response.json?.data, undefined);
    }
});
test('history follows the existing current products-read permission, including revocation', async () => {
    const positive = await history({}, { staff: true, bound: site.siteId });
    assert.equal(positive.status, 200, positive.text); assert.equal(positive.json?.data.length, 2);
    owned.psql(`UPDATE employees SET permissions='{"granted":[]}' WHERE user_id='${staff}' AND store_id='${site.siteId}';`);
    const denied = await history({}, { staff: true, bound: site.siteId });
    assert.equal(denied.status, 403, denied.text); assert.equal(denied.json?.data, undefined);
});
test('unavailable history and failed count recovery are sanitized failures rather than observed empty activity', async () => {
    for (const missing of [false, true]) {
        const tap = tapRest(owned.restUrl, async (call, forward) => call.resource === 'inventory_adjustments'
            ? Response.json({ code: missing ? '42P01' : 'XX000', message: missing ? 'relation inventory_adjustments does not exist' : 'synthetic private history fault' }, { status: 500 }) : forward());
        try {
            const response = await history(); assert.equal(response.status, 503, response.text);
            assert.equal(response.json?.error.code, 'INVENTORY_HISTORY_UNAVAILABLE'); assert.equal(response.json?.data, undefined);
            assert.doesNotMatch(response.text, /XX000|42P01|synthetic private|does not exist/);
        } finally { tap.restore(); }
    }
    const tap = tapRest(owned.restUrl, async (call, forward) => call.resource === 'inventory_adjustments' && call.method === 'HEAD'
        ? Response.json({ code: 'XX000', message: 'synthetic private count fault' }, { status: 500 }) : forward());
    try {
        const response = await history({ page: '99' }); assert.equal(response.status, 503, response.text);
        assert.equal(response.json?.error.code, 'INVENTORY_HISTORY_UNAVAILABLE'); assert.equal(response.json?.data, undefined);
        assert.doesNotMatch(response.text, /XX000|private count fault/);
    } finally { tap.restore(); }
});
