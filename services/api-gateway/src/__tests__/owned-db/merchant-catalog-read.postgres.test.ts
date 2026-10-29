import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import { requireOwnedDatabase } from './owned-db-support';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders, tapRest } from './gateway-harness';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase(), site = newSyntheticTenant('native-catalog'), foreign = newSyntheticTenant('foreign-catalog');
const actor = crypto.randomUUID(), email = `syn-catalog-${actor}@example.invalid`;
const ids = Array.from({ length: 4 }, () => crypto.randomUUID()).sort();
let gateway: Gateway;
before(async () => {
    seedSyntheticTenant(owned.psql, site); seedSyntheticTenant(owned.psql, foreign);
    owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${actor}','${email}',true);
        UPDATE sites SET custom_user_id='${actor}' WHERE id='${site.siteId}';
        INSERT INTO products(id,store_id,name,price,stock,status,is_active,display_order,created_at) VALUES
        ${ids.map((id, i) => `('${id}','${site.siteId}','Synthetic repeated',129.75,${[0, 1, 5, 7][i]},'${['active', 'active', 'draft', 'archived'][i]}',${i < 2},0,'2026-10-01T00:00:00Z')`).join(',')};
        INSERT INTO products(id,store_id,name,price,stock,deleted_at) VALUES
        (gen_random_uuid(),'${site.siteId}','Synthetic removed',129.75,0,now()),
        (gen_random_uuid(),'${foreign.siteId}','Synthetic foreign private',129.75,0,null);`);
    gateway = new Gateway(gatewayEnv(owned, await newIdentityKeys()));
});
after(async () => { await gateway?.settle(); });
async function list(query: Record<string, string> = {}, siteId = site.siteId) {
    return gateway.request(`/v1/products?${new URLSearchParams({ store_id: siteId, limit: '2', ...query })}`, {
        headers: { ...await signedIdentityHeaders(actor, email, site.siteId), 'X-Store-ID': siteId },
    });
}

test('cursor traversal retains every equal-value product in both directions for every advertised sort', async () => {
    for (const sort of ['name', 'price', 'created_at', 'display_order', 'stock']) {
        for (const order of ['asc', 'desc']) {
            const seen: string[] = [];
            let cursor = '';
            for (let page = 1; page <= 4; page += 1) {
                const response = await list({ sort, order, ...(cursor ? { cursor } : {}) });
                assert.equal(response.status, 200, `${sort}/${order}: ${response.text}`);
                const rows = response.json?.data as Array<{ id: string; store_id: string }>;
                assert.ok(rows.every(row => row.store_id === site.siteId));
                seen.push(...rows.map(row => row.id));
                cursor = response.json?.meta.next_cursor || '';
                if (!cursor) break;
            }
            assert.equal(new Set(seen).size, 4, `${sort}/${order} dropped or repeated records`);
            assert.deepEqual([...seen].sort(), ids);
        }
    }
});

test('offset pages, server filters and successful empty search cover the entire matching catalog', async () => {
    const first = await list({ sort: 'price', order: 'asc' });
    const second = await list({ sort: 'price', order: 'asc', page: '2' });
    assert.equal(first.status, 200, first.text); assert.equal(second.status, 200, second.text);
    assert.deepEqual([...first.json?.data, ...second.json?.data].map((row: { id: string }) => row.id), ids);
    for (const [query, expected] of [
        [{ stock_filter: 'out_of_stock' }, [ids[0]]],
        [{ stock_filter: 'low_stock' }, ids.slice(1, 3)],
        [{ status: 'active' }, ids.slice(0, 2)],
        [{ status: 'draft' }, [ids[2]]],
        [{ status: 'archived' }, [ids[3]]],
        [{ search: 'zz-parity-no-match' }, []],
    ] as Array<[Record<string, string>, string[]]>) {
        const response = await list({ ...query, sort: 'price', order: 'asc', limit: '20' });
        assert.equal(response.status, 200, response.text);
        assert.deepEqual(response.json?.data.map((row: { id: string }) => row.id), expected);
        assert.equal(response.json?.meta.stock_filter, query.stock_filter ?? null);
    }
});

test('unauthorized store scope and malformed cursors are refused', async () => {
    const positive = await list(); assert.equal(positive.status, 200, positive.text); assert.equal(positive.json?.data.length, 2);
    const denied = await list({}, foreign.siteId); assert.ok([403, 404].includes(denied.status), denied.text);
    assert.doesNotMatch(denied.text, /foreign private/);
    for (const cursor of ['invalid-base64', btoa(JSON.stringify({ id: 'forged),store_id.eq.any', value: 0 }))]) {
        const response = await list({ cursor }); assert.equal(response.status, 400, response.text);
        assert.equal(response.json?.data, undefined);
    }
});

test('an injected read failure returns a sanitized unavailable outcome, never a zero catalog', async () => {
    const tap = tapRest(owned.restUrl, async (call, forward) => call.resource === 'products' && call.method === 'GET'
        ? Response.json({ code: 'XX000', message: 'synthetic private catalog fault' }, { status: 500 }) : forward());
    try {
        const response = await list();
        assert.equal(response.status, 503, response.text); assert.equal(response.json?.error.code, 'PRODUCTS_UNAVAILABLE');
        assert.equal(response.json?.data, undefined); assert.doesNotMatch(response.text, /XX000|private catalog fault/);
    } finally { tap.restore(); }
});


test('cursor quoting preserves literal commas, quotes and parentheses in product names', async () => {
    const quotes = newSyntheticTenant('catalog-quoted'); seedSyntheticTenant(owned.psql, quotes);
    owned.psql(`UPDATE sites SET custom_user_id='${actor}' WHERE id='${quotes.siteId}';
      INSERT INTO products(id,store_id,name,price,stock) VALUES
      (gen_random_uuid(),'${quotes.siteId}','Synthetic "quoted", (name)',10,1),
      (gen_random_uuid(),'${quotes.siteId}','Synthetic "quoted", (name)',10,1);`);
    const headers = { ...await signedIdentityHeaders(actor,email,quotes.siteId), 'X-Store-ID':quotes.siteId };
    const first = await gateway.request(`/v1/products?store_id=${quotes.siteId}&limit=1&sort=name`,{headers});
    assert.equal(first.status,200,first.text);assert.ok(first.json?.meta.next_cursor);
    const second = await gateway.request(`/v1/products?store_id=${quotes.siteId}&limit=1&sort=name&cursor=${encodeURIComponent(first.json?.meta.next_cursor)}`,
      {headers:{...await signedIdentityHeaders(actor,email,quotes.siteId),'X-Store-ID':quotes.siteId}});
    assert.equal(second.status,200,second.text);assert.equal(second.json?.data.length,1);
    assert.notEqual(first.json?.data[0].id,second.json?.data[0].id);
    assert.equal(first.json?.data[0].name,second.json?.data[0].name);
});
