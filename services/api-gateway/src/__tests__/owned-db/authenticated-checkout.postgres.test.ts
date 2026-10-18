// Signed storefront checkout creates explicit order ownership atomically; guests remain unlinked.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { afterEach, before } from 'node:test';
import { LETBUYY_STOREFRONT_SESSION_HEADER } from '@letbuyy/auth-core';
import { Gateway, gatewayEnv, mintSession, newBarrier, newIdentityKeys, seedBuyerAccount, tapRest, type IdentityKeys } from './gateway-harness';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase();
const { psql } = owned;
const site = newSyntheticTenant('auth-checkout');
const otherSite = newSyntheticTenant('auth-checkout-alt');
let keys: IdentityKeys;
let gateway: Gateway;
let productId: string;
const shippingZoneId = crypto.randomUUID();
const shippingRateId = crypto.randomUUID();

before(async () => {
    keys = await newIdentityKeys();
    seedSyntheticTenant(psql, site);
    seedSyntheticTenant(psql, otherSite);
    productId = crypto.randomUUID();
    psql(`
      INSERT INTO products (id,store_id,name,price,sku,is_active,created_at,updated_at)
      VALUES ('${productId}','${site.siteId}','Synthetic checkout product',199.00,'SYN-CHECKOUT-${productId}',true,now(),now());
      INSERT INTO shipping_zones (id,store_id,site_id,name,countries,states,zip_codes,cod_enabled)
      VALUES ('${shippingZoneId}','${site.siteId}','${site.siteId}','Fixture coverage',ARRAY['IN'],ARRAY['Karnataka','29'],ARRAY['560001'],true);
      INSERT INTO shipping_rates (id,zone_id,site_id,name,type,price,is_active,cod_enabled)
      VALUES ('${shippingRateId}','${shippingZoneId}','${site.siteId}','Fixture delivery','flat',20.00,true,true);
      INSERT INTO inventory_levels (id,store_id,product_id,variant_id,location_id,available,reserved,committed_quantity,available_quantity,reserved_quantity,on_hand_quantity,created_at,updated_at)
      VALUES (gen_random_uuid(),'${site.siteId}','${productId}',NULL,'${site.locationId}',25,0,0,25,0,25,now(),now());
    `);
    gateway = new Gateway(gatewayEnv(owned, keys));
});
afterEach(async () => { await gateway.settle(); });

function orderBody(idempotencyKey: string, email = 'syn-checkout@example.invalid') {
    return {
        customer: {
            name: 'Synthetic buyer', email, phone: '9000000088',
            address: { address: 'Fixture Road', city: 'Bengaluru', state: 'Karnataka', stateCode: '29', pincode: '560001' },
        },
        items: [{ productId, variantId: null, quantity: 1 }],
        shippingRateId,
        shippingAmountMinor: 2000,
        paymentMethod: 'cod', deliveryOption: 'standard', idempotencyKey,
    };
}

async function storefrontHeaders(buyerId: string, siteId = site.siteId, epoch = 1) {
    return {
        [LETBUYY_STOREFRONT_SESSION_HEADER]: await mintSession(keys, buyerId, {
            audience: 'letbuyy:storefront-session', tokenUse: 'storefront_session', epoch,
            extraClaims: { site_id: siteId },
        }),
        'Content-Type': 'application/json',
    };
}

function createOrder(body: Record<string, unknown>, headers: Record<string, string> = {}) {
    return gateway.request(`/v1/storefront/${site.subdomain}/orders`, {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
}

function ownership(orderId: string) {
    return JSON.parse(psql(`SELECT COALESCE(json_agg(json_build_object('buyer_account_id',buyer_account_id,'site_id',site_id,'link_basis',link_basis)),'[]'::json) FROM buyer_order_links WHERE order_id='${orderId}';`)) as Array<{ buyer_account_id: string; site_id: string; link_basis: string }>;
}

test('guest orders remain unlinked and signed site-bound checkout links only its own buyer', async () => {
    const buyer = seedBuyerAccount(psql, 'checkout-owner');
    const guestResponse = await createOrder(orderBody(`syn-guest-${crypto.randomUUID()}`), { 'X-Request-ID': crypto.randomUUID() });
    assert.equal(guestResponse.status, 201, guestResponse.text);
    const guestId = guestResponse.json?.data?.order?.id as string;
    assert.ok(guestId);
    assert.deepEqual(ownership(guestId), []);

    const idempotencyKey = `syn-buyer-${crypto.randomUUID()}`;
    const headers = await storefrontHeaders(buyer.id);
    const ownedResponse = await createOrder(orderBody(idempotencyKey), headers);
    assert.equal(ownedResponse.status, 201, ownedResponse.text);
    const orderId = ownedResponse.json?.data?.order?.id as string;
    assert.ok(orderId);
    assert.deepEqual(ownership(orderId), [{ buyer_account_id: buyer.id, site_id: site.siteId, link_basis: 'authenticated_checkout' }]);

    const replay = await createOrder(orderBody(idempotencyKey), headers);
    assert.equal(replay.status, 201, replay.text);
    assert.equal(replay.json?.data?.order?.id, orderId);
    assert.equal(ownership(orderId).length, 1);
});

test('public buyer shipping quotes are destination-bound and identify seller estimates', async () => {
    const supported = await gateway.request(`/v1/storefront/${site.subdomain}/shipping-rates?pincode=560001&state=Karnataka&state_code=29&subtotal_minor=19900`);
    assert.equal(supported.status, 200, supported.text);
    assert.equal(supported.json?.data?.serviceability?.serviceable, true);
    assert.equal(supported.json?.data?.serviceability?.carrier_confirmed, false);
    assert.equal(supported.json?.data?.rates?.[0]?.id, shippingRateId);
    assert.equal(supported.json?.data?.rates?.[0]?.amount_minor, 2000);

    const unsupported = await gateway.request(`/v1/storefront/${site.subdomain}/shipping-rates?pincode=600001&state=Karnataka&state_code=29&subtotal_minor=19900`);
    assert.equal(unsupported.status, 200, unsupported.text);
    assert.equal(unsupported.json?.data?.serviceability?.serviceable, false);
    assert.deepEqual(unsupported.json?.data?.rates, []);
});

test('missing, out-of-zone, and stale buyer-reviewed shipping quotes create no order', async () => {
    const noRateKey = `syn-no-rate-${crypto.randomUUID()}`;
    const noRateBody = { ...orderBody(noRateKey), shippingRateId: null, shippingAmountMinor: null };
    const missing = await createOrder(noRateBody);
    assert.equal(missing.status, 409, missing.text);
    assert.equal(psql(`SELECT count(*) FROM checkout_sessions WHERE site_id='${site.siteId}' AND idempotency_key='${noRateKey}';`), '0');

    const outOfZoneKey = `syn-out-of-zone-${crypto.randomUUID()}`;
    const outOfZoneBody = orderBody(outOfZoneKey);
    outOfZoneBody.customer.address.pincode = '600001';
    const outOfZone = await createOrder(outOfZoneBody);
    assert.equal(outOfZone.status, 409, outOfZone.text);

    const staleQuoteKey = `syn-stale-shipping-${crypto.randomUUID()}`;
    const staleQuote = await createOrder({ ...orderBody(staleQuoteKey), shippingAmountMinor: 1999 });
    assert.equal(staleQuote.status, 409, staleQuote.text);
    assert.equal(psql(`SELECT count(*) FROM checkout_sessions WHERE site_id='${site.siteId}' AND idempotency_key IN ('${outOfZoneKey}','${staleQuoteKey}');`), '0');
});

test('a rate change between buyer quote verification and the order transaction is refused atomically', async () => {
    const key = `syn-rate-race-${crypto.randomUUID()}`;
    const email = `${key}@example.invalid`;
    let changed = false;
    const tap = tapRest(owned.restUrl, async (call, forward) => {
        if (call.resource === 'rpc/create_storefront_checkout_order_with_delivery_rate') {
            psql(`UPDATE shipping_rates SET price=30.00 WHERE id='${shippingRateId}';`);
            changed = true;
        }
        return forward();
    });
    try {
        const response = await createOrder(orderBody(key, email));
        assert.equal(changed, true);
        assert.equal(response.status, 409, response.text);
        assert.equal(response.json?.error?.code, 'CHECKOUT_SHIPPING_CHANGED');
        assert.equal(psql(`SELECT count(*) FROM orders WHERE customer_email='${email}';`), '0');
        assert.equal(psql(`SELECT count(*) FROM checkout_sessions WHERE site_id='${site.siteId}' AND idempotency_key='${key}';`), '0');
    } finally {
        tap.restore();
        psql(`UPDATE shipping_rates SET price=20.00 WHERE id='${shippingRateId}';`);
    }
});

test('wrong-site, revoked and disabled buyer sessions cannot create or claim an order', async () => {
    const buyer = seedBuyerAccount(psql, 'checkout-denied');
    const key = `syn-denied-${crypto.randomUUID()}`;
    assert.equal((await createOrder(orderBody(key), await storefrontHeaders(buyer.id, otherSite.siteId))).status, 401);
    assert.deepEqual(JSON.parse(psql(`SELECT count(*) FROM checkout_sessions WHERE site_id='${site.siteId}' AND idempotency_key='${key}';`)), 0);

    psql(`UPDATE buyer_accounts SET session_epoch=2 WHERE id='${buyer.id}';`);
    assert.equal((await createOrder(orderBody(key), await storefrontHeaders(buyer.id, site.siteId, 1))).status, 401);
    assert.deepEqual(JSON.parse(psql(`SELECT count(*) FROM checkout_sessions WHERE site_id='${site.siteId}' AND idempotency_key='${key}';`)), 0);

    psql(`UPDATE buyer_accounts SET status='disabled' WHERE id='${buyer.id}';`);
    assert.equal((await createOrder(orderBody(key), await storefrontHeaders(buyer.id, site.siteId, 2))).status, 403);
    assert.deepEqual(JSON.parse(psql(`SELECT count(*) FROM checkout_sessions WHERE site_id='${site.siteId}' AND idempotency_key='${key}';`)), 0);
});

test('a request-body buyer selector cannot claim a guest order on retry', async () => {
    const buyer = seedBuyerAccount(psql, 'checkout-body-forgery');
    const key = `syn-scope-${crypto.randomUUID()}`;
    const guest = await createOrder({ ...orderBody(key), buyer_account_id: buyer.id });
    assert.equal(guest.status, 201, guest.text);
    const orderId = guest.json?.data?.order?.id as string;
    assert.deepEqual(ownership(orderId), []);

    // The idempotency owner fingerprint changes with the verified principal; this request cannot
    // replay the guest response or attach its old order to the newly authenticated account.
    const authRetry = await createOrder(orderBody(key), await storefrontHeaders(buyer.id));
    assert.equal(authRetry.status, 409, authRetry.text);
    assert.deepEqual(ownership(orderId), []);
});

test('the database epoch recheck closes revocation between middleware and order commit', async () => {
    const buyer = seedBuyerAccount(psql, 'checkout-race');
    const key = `syn-epoch-race-${crypto.randomUUID()}`;
    const email = `${key}@example.invalid`;
    let revokedAfterRead = false;
    const tap = tapRest(owned.restUrl, async (call, forward) => {
        if (call.resource === 'buyer_accounts' && call.method === 'GET' && call.search.get('id') === `eq.${buyer.id}`) {
            const response = await forward();
            psql(`UPDATE buyer_accounts SET session_epoch=2 WHERE id='${buyer.id}';`);
            revokedAfterRead = true;
            return response;
        }
        return forward();
    });
    try {
        const result = await createOrder(orderBody(key, email), await storefrontHeaders(buyer.id));
        assert.equal(revokedAfterRead, true);
        assert.equal(result.status, 401, result.text);
        assert.equal(psql(`SELECT count(*) FROM checkout_sessions WHERE site_id='${site.siteId}' AND idempotency_key='${key}';`), '0');
        assert.equal(psql(`SELECT count(*) FROM orders WHERE customer_email='${email}';`), '0');
        assert.equal(psql(`SELECT count(*) FROM buyer_order_links bol JOIN orders o ON o.id=bol.order_id WHERE o.store_id='${site.siteId}' AND bol.buyer_account_id='${buyer.id}' AND bol.link_basis='authenticated_checkout';`), '0');
    } finally {
        tap.restore();
    }
});

test('simultaneous buyers competing for the last variant unit create one order and receive a safe sold-out conflict', async () => {
    const variantId = crypto.randomUUID();
    const productSku = `SYN-CHECKOUT-${crypto.randomUUID()}`;
    psql(`
      INSERT INTO product_variants (id,product_id,title,price,sku,inventory_qty,created_at,updated_at)
      VALUES ('${variantId}','${productId}','Final-unit variant',199.00,'${productSku}',1,now(),now());
      INSERT INTO inventory_levels (id,store_id,product_id,variant_id,location_id,available,reserved,committed_quantity,available_quantity,reserved_quantity,on_hand_quantity,created_at,updated_at)
      VALUES (gen_random_uuid(),'${site.siteId}','${productId}','${variantId}','${site.locationId}',1,0,0,1,0,1,now(),now());
    `);

    const buyers = [seedBuyerAccount(psql, 'last-unit-a'), seedBuyerAccount(psql, 'last-unit-b')];
    const barrier = newBarrier(2);
    const tap = tapRest(owned.restUrl, async (call, forward) => {
        if (call.resource === 'rpc/create_storefront_checkout_order_with_delivery_rate') await barrier.arrive();
        return forward();
    });
    let outcomes;
    try {
        const requests = buyers.map(async (buyer, index) => {
            const key = `syn-last-unit-${index}-${crypto.randomUUID()}`;
            const email = `syn-last-unit-${index}-${crypto.randomUUID()}@example.invalid`;
            const body = {
                ...orderBody(key, email),
                items: [{ productId, variantId, quantity: 1 }],
            };
            return createOrder(body, await storefrontHeaders(buyer.id));
        });
        outcomes = await Promise.all(requests);
    } finally {
        tap.restore();
    }

    assert.equal(barrier.arrived, 2, 'both authenticated buyers must reach the canonical checkout RPC before either proceeds');
    assert.deepEqual(outcomes.map((outcome) => outcome.status).sort(), [201, 409]);
    const winner = outcomes.find((outcome) => outcome.status === 201);
    const loser = outcomes.find((outcome) => outcome.status === 409);
    assert.ok(winner?.json?.data?.order?.id, winner?.text);
    assert.equal(loser?.json?.error?.code, 'INSUFFICIENT_INVENTORY');
    assert.match(loser?.json?.error?.message ?? '', /no longer available/i);
    assert.doesNotMatch(loser?.text ?? '', /postgres|inventory_levels/i);

    assert.equal(psql(`SELECT count(*) FROM orders o JOIN order_items oi ON oi.order_id=o.id WHERE oi.product_id='${productId}' AND oi.variant_id='${variantId}';`), '1');
    assert.equal(psql(`SELECT count(*) FROM buyer_order_links bol JOIN order_items oi ON oi.order_id=bol.order_id WHERE oi.product_id='${productId}' AND oi.variant_id='${variantId}' AND bol.link_basis='authenticated_checkout';`), '1');
    assert.equal(psql(`SELECT available||'|'||reserved||'|'||committed_quantity||'|'||available_quantity||'|'||reserved_quantity||'|'||on_hand_quantity FROM inventory_levels WHERE product_id='${productId}' AND variant_id='${variantId}';`), '0|0|1|0|0|1');
    assert.equal(psql(`SELECT status||'|'||count(*) FROM inventory_reservations WHERE product_id='${productId}' AND variant_id='${variantId}' GROUP BY status;`), 'committed|1');
    assert.equal(psql(`SELECT count(*) FROM inventory_adjustments WHERE product_id='${productId}' AND variant_id='${variantId}' AND reason='sale' AND quantity_change=-1;`), '1');
    assert.equal(psql(`SELECT inventory_qty FROM product_variants WHERE id='${variantId}';`), '0');
});

test('the authenticated checkout RPC is backend-only and its rollback preserves existing ownership rows', async () => {
    const signature = 'public.create_checkout_order_for_buyer(uuid,integer,uuid,text,text,text,jsonb,jsonb,text,text,text,text,text,text,uuid,text,uuid,numeric,text,jsonb,bigint)';
    for (const role of ['anon', 'authenticated', 'app_tenant']) {
        assert.equal(psql(`SELECT has_function_privilege('${role}','${signature}','EXECUTE');`), 'f');
        const denied = owned.psqlExpectError(`SET ROLE ${role}; SELECT public.create_checkout_order_for_buyer(NULL::uuid,NULL::integer,NULL::uuid,NULL::text,NULL::text,NULL::text,NULL::jsonb,NULL::jsonb,NULL::text,NULL::text,NULL::text,NULL::text,NULL::text,NULL::text,NULL::uuid,NULL::text,NULL::uuid,NULL::numeric,NULL::text,NULL::jsonb,NULL::bigint);`);
        assert.match(denied, /permission denied/);
    }
    assert.equal(psql(`SELECT has_function_privilege('service_role','${signature}','EXECUTE');`), 't');

    const buyer = seedBuyerAccount(psql, 'checkout-rollback');
    const response = await createOrder(orderBody(`syn-rollback-${crypto.randomUUID()}`), await storefrontHeaders(buyer.id));
    assert.equal(response.status, 201, response.text);
    const orderId = response.json?.data?.order?.id as string;
    const before = ownership(orderId);
    assert.equal(before.length, 1);

    const rollback = readFileSync(new URL('../../../../../database/supabase/rollback/267_authenticated_checkout_order_ownership.rollback.sql', import.meta.url), 'utf8');
    const migration = readFileSync(new URL('../../../../../database/supabase/migrations/267_authenticated_checkout_order_ownership.sql', import.meta.url), 'utf8');
    owned.script(rollback);
    assert.equal(psql(`SELECT to_regprocedure('${signature}') IS NULL;`), 't');
    assert.deepEqual(ownership(orderId), before);
    owned.script(migration);
    assert.equal(psql(`SELECT to_regprocedure('${signature}') IS NOT NULL;`), 't');
    assert.deepEqual(ownership(orderId), before);
});
