import assert from 'node:assert/strict';
import test from 'node:test';
import { createSupabaseServiceClient } from '@letbuyy/infrastructure/supabase-adapter';
import { normalizeOrderItemRecord } from '@letbuyy/checkout-core';
import { createTenantGuardedSupabaseClient } from '../tenant/tenant-scoped';
import { loadBuyerOrderDetailFromDatabase } from '../routes/storefront/buyer-order-routes';
import { toBuyerOrderItemView } from '../lib/buyer-order-item-view';
const buyer = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', site = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb', order = 'cccccccc-3333-4333-8333-cccccccccccc';
const niche = { version: 1, facts: { beauty: { format: 'Lip tint', shadeOptionName: 'Shade', shades: [{ value: 'Rosewater', code: 'RW01' }, { value: 'Pink Clay', code: 'PC02' }] }, books: { kind: 'book', edition: 'Saved edition 2' } }, selected_options: [{ name: 'Shade', value: 'Pink Clay' }] };
const item = () => ({ product_id: 'dddddddd-4444-4444-8444-dddddddddddd', name: 'Saved tint', quantity: 2, unit_price: 520, total: 1040, product_snapshot: { niche: structuredClone(niche), private_supplier: 'PRIVATE-SUPPLIER', cost_price: 12345 } });

test('real canonical normalizer and buyer projection retain approved frozen facts and omit raw/private snapshot data', () => {
    const source = item(); const before = structuredClone(source); const normalized = normalizeOrderItemRecord(source);
    assert.ok(normalized.niche_snapshot); const projected = toBuyerOrderItemView(source);
    assert.deepEqual(projected.niche_snapshot, normalized.niche_snapshot); assert.equal(projected.unit_price, 520); assert.equal(projected.total, 1040);
    assert.equal(Object.hasOwn(projected, 'product_snapshot'), false); assert.doesNotMatch(JSON.stringify(projected), /PRIVATE-SUPPLIER|cost_price/); assert.deepEqual(source, before);
});
test('string legacy snapshots are parsed by the real normalizer; malformed/forged approved fields fail closed', () => {
    const source = item(); assert.ok(toBuyerOrderItemView({ ...source, product_snapshot: JSON.stringify(source.product_snapshot) }).niche_snapshot);
    for (const product_snapshot of [null, '{broken', { niche: { ...niche, version: 99 }, private: 'PRIVATE' }]) {
        const projected = toBuyerOrderItemView({ ...source, product_snapshot, niche_snapshot: niche });
        assert.equal(Object.hasOwn(projected, 'niche_snapshot'), false); assert.equal(Object.hasOwn(projected, 'product_snapshot'), false);
    }
});
test('buyer-link and signed-site query positively authorize the row and deny foreign buyer/site before fact projection', async () => {
    const originalFetch = globalThis.fetch; const reads: URL[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input : input.url); reads.push(url);
        assert.equal(url.origin, 'https://order-facts.fake.test');
        if (url.pathname.endsWith('/buyer_order_links')) {
            const allowed = url.searchParams.get('buyer_account_id') === `eq.${buyer}` && url.searchParams.get('order_id') === `eq.${order}` && url.searchParams.get('site_id') === `eq.${site}`;
            return Response.json(allowed ? [{ order_id: order, site_id: site }] : []);
        }
        assert.ok(url.pathname.endsWith('/orders')); assert.equal(url.searchParams.get('site_id'), `eq.${site}`); assert.equal(url.searchParams.get('id'), `eq.${order}`);
        return Response.json([{ id: order, site_id: site, items: [item()] }]);
    }) as typeof fetch;
    try {
        const raw = createSupabaseServiceClient({ SUPABASE_URL: 'https://order-facts.fake.test', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-test' } as never);
        const db = createTenantGuardedSupabaseClient(raw as never);
        const own = await loadBuyerOrderDetailFromDatabase(db, buyer, site, order, false);
        assert.equal(own.error, null); assert.ok(own.data); const items = own.data.items as unknown[];
        assert.ok(toBuyerOrderItemView(items[0]).niche_snapshot);
        const priorOrderReads = reads.filter(url => url.pathname.endsWith('/orders')).length;
        for (const [account, signedSite] of [['eeeeeeee-5555-4555-8555-eeeeeeeeeeee', site], [buyer, 'ffffffff-6666-4666-8666-ffffffffffff']]) {
            const denied = await loadBuyerOrderDetailFromDatabase(db, account, signedSite, order, false); assert.equal(denied.data, null);
        }
        assert.equal(reads.filter(url => url.pathname.endsWith('/orders')).length, priorOrderReads);
    } finally { globalThis.fetch = originalFetch; }
});
