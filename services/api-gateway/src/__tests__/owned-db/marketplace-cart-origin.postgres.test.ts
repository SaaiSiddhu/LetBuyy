// Synthetic local test credentials only: owned disposable accounts, stub provider identifiers,
// and public challenge test fixtures. Never use these values for a real account or live provider.
// Exact value hashes are reviewed in config/governance/secret-scan-exceptions.json.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer, type IncomingMessage } from 'node:http';
import { once } from 'node:events';
import { join } from 'node:path';
import test, { after, afterEach, before } from 'node:test';
import {closePooledSqlClients} from '@letbuyy/infrastructure/pooled-sql-adapter';
import { LETBUYY_STOREFRONT_SESSION_HEADER } from '@letbuyy/auth-core';
import { Gateway, gatewayEnv, mintSession, newIdentityKeys, seedBuyerAccount, type IdentityKeys } from './gateway-harness';
import { requireOwnedDatabase, startOwnedPooledSqlProxy, type OwnedPooledSqlProxy, startOwnedClientRuntime, stopOwnedClientRuntime } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';
import worker from '../../index';

const owned = requireOwnedDatabase();
const { psql, psqlExpectError } = owned;
const seller = newSyntheticTenant('market-cart');
const otherSeller = newSyntheticTenant('market-cart-other');
const categoryId = crypto.randomUUID();
const reviewerId = crypto.randomUUID();
const shippingZoneId = crypto.randomUUID();
const shippingRateId = crypto.randomUUID();
const marketplaceCategoryMigration = readFileSync(new URL('../../../../../database/supabase/migrations/296_marketplace_order_category_snapshot.sql', import.meta.url), 'utf8');
const marketplaceCategoryRollback = readFileSync(new URL('../../../../../database/supabase/rollback/296_marketplace_order_category_snapshot.rollback.sql', import.meta.url), 'utf8');
let gateway: Gateway;
let sqlProxy:OwnedPooledSqlProxy;
let keys: IdentityKeys;
let approved: { listingId: string; productId: string };
let pending: { listingId: string; productId: string };
let revocable: { listingId: string; productId: string };
let otherSellerApproved: { listingId: string; productId: string };

before(async () => {
    keys = await newIdentityKeys();
    sqlProxy=await startOwnedPooledSqlProxy(owned);
    seedSyntheticTenant(psql, seller);
    seedSyntheticTenant(psql, otherSeller);
    psql(`INSERT INTO marketplace_categories (id, slug, name, is_active)
      VALUES ('${categoryId}', 'marketplace-cart-fixture', 'Marketplace cart fixture', true);`);
    gateway = new Gateway(gatewayEnv(owned, keys, {
        ...sqlProxy.env(),
        CHECKOUT_SIGNING_SECRET: 'synthetic-marketplace-cart-handoff-secret',
        RAZORPAY_KEY_ID: 'rzp_test_synthetic',
        RAZORPAY_KEY_SECRET: 'synthetic-marketplace-razorpay-secret',
    }));
    approved = createListing('Approved cart item');
    pending = createListing('Pending cart item');
    revocable = createListing('Revocable cart item');
    otherSellerApproved = createListing('Other seller cart item', otherSeller);
    publish(approved.listingId);
    submit(pending.listingId);
    publish(revocable.listingId);
    publish(otherSellerApproved.listingId, otherSeller);
    psql(`INSERT INTO shipping_zones
      (id,store_id,site_id,name,countries,states,zip_codes,cod_enabled)
      VALUES ('${shippingZoneId}','${seller.siteId}','${seller.siteId}','Bengaluru','{IN}','{Karnataka}','{560001}',true);
      INSERT INTO shipping_rates
      (id,zone_id,site_id,name,type,price,is_active,cod_enabled)
      VALUES ('${shippingRateId}','${shippingZoneId}','${seller.siteId}','Standard delivery','flat',60,true,true);`);
});
afterEach(async () => { await gateway.settle(); });
after(async()=>{await closePooledSqlClients();await sqlProxy?.stop();});

test('migration 296 safely rolls back before category evidence exists and reapplies cleanly', () => {
    assert.equal(psql(`SELECT count(*) FROM order_items WHERE marketplace_category_id IS NOT NULL;`), '0');
    psql(marketplaceCategoryRollback);
    assert.equal(psql(`SELECT count(*) FROM information_schema.columns
      WHERE table_schema='public' AND table_name='order_items' AND column_name='marketplace_category_id';`), '0');
    psql(marketplaceCategoryMigration);
    assert.equal(psql(`SELECT count(*) FROM information_schema.columns
      WHERE table_schema='public' AND table_name='order_items' AND column_name='marketplace_category_id';`), '1');
});

function createListing(name: string, tenant = seller): { listingId: string; productId: string } {
    const productId = crypto.randomUUID();
    const listingId = crypto.randomUUID();
    psql(`INSERT INTO products
      (id,site_id,store_id,name,slug,description,price,images,stock,is_active,status)
      VALUES ('${productId}','${tenant.siteId}','${tenant.siteId}','${name}','syn-${productId.slice(0, 12)}','fixture',129,ARRAY[]::text[],8,true,'active');
      INSERT INTO inventory_levels
        (id,store_id,product_id,variant_id,location_id,available,reserved,committed_quantity,available_quantity,reserved_quantity,on_hand_quantity,created_at,updated_at)
      VALUES (gen_random_uuid(),'${tenant.siteId}','${productId}',NULL,'${tenant.locationId}',8,0,0,8,0,8,now(),now());
      INSERT INTO channel_listings (id,site_id,product_id,channel,marketplace_category_id,visibility)
      VALUES ('${listingId}','${tenant.siteId}','${productId}','marketplace','${categoryId}','public');`);
    return { listingId, productId };
}

function submit(listingId: string, tenant = seller): void {
    psql(`BEGIN;
      SELECT set_config('app.site_id','${tenant.siteId}',true);
      SELECT * FROM transition_channel_listing(
        '${tenant.siteId}'::uuid,'${listingId}'::uuid,'pending_review','merchant',NULL,NULL,'marketplace-cart-submit:${listingId}'
      );
      COMMIT;`);
}

function publish(listingId: string, tenant = seller): void {
    submit(listingId, tenant);
    const version = Number(psql(`SELECT version FROM channel_listings WHERE id='${listingId}';`));
    psql(`SELECT * FROM claim_marketplace_listing_review(
      '${tenant.siteId}'::uuid,'${listingId}'::uuid,'${reviewerId}'::uuid,
      'Marketplace cart fixture review.','marketplace-cart-claim:${listingId}',${version}
    );
    SELECT * FROM transition_channel_listing(
      '${tenant.siteId}'::uuid,'${listingId}'::uuid,'approved','operator','${reviewerId}'::uuid,
      'Fixture approved.','marketplace-cart-approve:${listingId}'
    );`);
}

function cartBody(listingId: string, productId: string) {
    return {
        channel: 'web',
        lines: [{ product_id: productId, marketplace_listing_id: listingId, quantity: 2, properties: {} }],
        coupon_codes: [],
    };
}

async function deliveryRate(cartId: string, handoffQuery: string, pincode = '560001'): Promise<string> {
    const options = await gateway.request(`/v1/checkout/${cartId}/delivery-options?${handoffQuery}&country=IN&state=Karnataka&pincode=${pincode}`);
    assert.equal(options.status, 200, options.text);
    const rates = options.json?.data?.rates as Array<{ id: string }>;
    return rates[0]?.id || '';
}

// Mirror the normal buyer's review request before attempting a delivery mutation.
// Invalid-address controls still reach delivery with no invented fingerprint.
function checkoutStep(cartId: string, query: string) {
    return async (name: string, payload: Record<string, unknown>) => {
        if (name === 'delivery') {
            const shipping = payload.shipping_quote as { shipping_rate_id?: string };
            const address = payload.shipping_address as Record<string, unknown>;
            const reviewed = await gateway.request(`/v1/checkout/${cartId}/quote?${query}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ shipping_address: { country: address.country, state: address.state,
                    state_code: address.state_code, zip: address.zip }, shipping_rate_id: shipping.shipping_rate_id }),
            });
            if (reviewed.status === 200) payload = { ...payload, expected_quote_fingerprint: reviewed.json?.data?.quote?.fingerprint };
        }
        return gateway.request(`/v1/checkout/${cartId}/${name}?${query}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        });
    };
}

test('marketplace cart stores server-validated listing identity and distinct sales origin', async () => {
    const env=owned.restEnv();
    const listingRead=await fetch(env.SUPABASE_URL+'/rest/v1/rpc/marketplace_listing_detail',{method:'POST',headers:{'Content-Type':'application/json',apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY},body:JSON.stringify({p_listing_id:approved.listingId})});
    assert.equal(listingRead.status,200,await listingRead.text());
    const input = cartBody(approved.listingId, approved.productId);
    input.channel = 'whatsapp';
    const response = await gateway.request(`/v1/storefront/${seller.subdomain}/marketplace-cart`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
    });
    assert.equal(response.status, 201, response.text);
    const cart = response.json?.data as { id: string; cart_token: string; sales_origin: string; lines: Array<Record<string, unknown>> };
    assert.equal(cart.sales_origin, 'marketplace');
    assert.equal(cart.lines[0].product_id, approved.productId);
    assert.equal(cart.lines[0].marketplace_listing_id, approved.listingId);

    const readback = await gateway.request(`/v1/storefront/${seller.subdomain}/cart/${cart.cart_token}`);
    assert.equal(readback.status, 200, readback.text);
    assert.equal(readback.json?.data?.sales_origin, 'marketplace');
    assert.equal(readback.json?.data?.lines[0]?.marketplace_listing_id, approved.listingId);
    assert.equal(readback.json?.data?.channel, 'whatsapp');

    const identityUpdate = await gateway.request(`/v1/storefront/${seller.subdomain}/cart/${cart.cart_token}/buyer-identity`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyer_email: 'marketplace-buyer@example.invalid' }),
    });
    assert.equal(identityUpdate.status, 200, identityUpdate.text);
    assert.equal(identityUpdate.json?.data?.channel, 'whatsapp', 'an identity-only update preserves the original acquisition channel');
    assert.equal(identityUpdate.json?.data?.sales_origin, 'marketplace', 'an identity-only update preserves the marketplace sales origin');

    const abandonmentKey = `cart.abandonment_check:${seller.siteId}:${cart.id}`;
    const queuedCheck = psql(`SELECT count(*) || '|' ||
      (SELECT event_id::text FROM platform_queue_jobs WHERE idempotency_key='${abandonmentKey}')
      FROM platform_queue_jobs WHERE idempotency_key='${abandonmentKey}';`);
    const [queuedCount, eventId] = queuedCheck.split('|');
    assert.equal(queuedCount, '1');
    assert.match(eventId || '', /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});

test('marketplace cart rejects product substitution, pending listing, and seller substitution', async () => {
    const wrongProduct = await gateway.request(`/v1/storefront/${seller.subdomain}/marketplace-cart`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cartBody(approved.listingId, pending.productId)),
    });
    assert.equal(wrongProduct.status, 409, wrongProduct.text);
    assert.equal(wrongProduct.json?.error?.code, 'MARKETPLACE_LISTING_UNAVAILABLE');

    const notApproved = await gateway.request(`/v1/storefront/${seller.subdomain}/marketplace-cart`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cartBody(pending.listingId, pending.productId)),
    });
    assert.equal(notApproved.status, 409, notApproved.text);

    const wrongSeller = await gateway.request(`/v1/storefront/${otherSeller.subdomain}/marketplace-cart`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cartBody(approved.listingId, approved.productId)),
    });
    assert.equal(wrongSeller.status, 409, wrongSeller.text);
});

test('marketplace cart route rejects mixed-seller lines before persisting a cart', async () => {
    const cartsBefore = psql(`SELECT count(*) FROM carts WHERE store_id IN ('${seller.siteId}','${otherSeller.siteId}');`);
    const inventoryBefore = psql(`SELECT coalesce(string_agg(product_id::text || ':' || available::text || ':' || reserved::text, ',' ORDER BY product_id::text), '')
      FROM inventory_levels WHERE product_id IN ('${approved.productId}','${otherSellerApproved.productId}');`);
    const response = await gateway.request(`/v1/storefront/${seller.subdomain}/marketplace-cart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            channel: 'web',
            lines: [
                { product_id: approved.productId, marketplace_listing_id: approved.listingId, quantity: 1, properties: {} },
                { product_id: otherSellerApproved.productId, marketplace_listing_id: otherSellerApproved.listingId, quantity: 1, properties: {} },
            ],
            coupon_codes: [],
        }),
    });

    assert.equal(response.status, 409, response.text);
    assert.equal(response.json?.error?.code, 'MARKETPLACE_LISTING_UNAVAILABLE');
    assert.equal(psql(`SELECT count(*) FROM carts WHERE store_id IN ('${seller.siteId}','${otherSeller.siteId}');`), cartsBefore);
    assert.equal(psql(`SELECT coalesce(string_agg(product_id::text || ':' || available::text || ':' || reserved::text, ',' ORDER BY product_id::text), '')
      FROM inventory_levels WHERE product_id IN ('${approved.productId}','${otherSellerApproved.productId}');`), inventoryBefore);
});

test('canonical marketplace order writer rejects a mixed-seller item set without partial order or inventory effects', () => {
    const idempotencyKey = `market-cross-seller-${crypto.randomUUID()}`;
    const items = JSON.stringify([
        { product_id: approved.productId, marketplace_listing_id: approved.listingId, quantity: 1 },
        { product_id: otherSellerApproved.productId, marketplace_listing_id: otherSellerApproved.listingId, quantity: 1 },
    ]);
    const before = crossSellerWriteSnapshot(idempotencyKey);
    const failure = psqlExpectError(`
      SELECT public.create_marketplace_checkout_order(
        p_store_id => '${seller.siteId}'::uuid,
        p_customer_name => 'Synthetic cross-seller buyer',
        p_customer_email => 'cross-seller@example.invalid',
        p_customer_phone => '9000000000',
        p_shipping_address => '{}'::jsonb,
        p_items => '${items}'::jsonb,
        p_payment_method => 'cod',
        p_idempotency_key => '${idempotencyKey}'::text
      );
    `);

    assert.match(failure, /marketplace listing is unavailable for checkout/);
    assert.equal(crossSellerWriteSnapshot(idempotencyKey), before);
    assert.equal(psql(`SELECT available || '|' || reserved || '|' || available_quantity || '|' || reserved_quantity
      FROM inventory_levels WHERE product_id='${otherSellerApproved.productId}';`), '8|0|8|0');
});

function crossSellerWriteSnapshot(idempotencyKey: string): string {
    return psql(`SELECT
      (SELECT count(*) FROM purchases WHERE origin_site_id IN ('${seller.siteId}','${otherSeller.siteId}'))::text || '|' ||
      (SELECT count(*) FROM orders WHERE store_id IN ('${seller.siteId}','${otherSeller.siteId}'))::text || '|' ||
      (SELECT count(*) FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.store_id IN ('${seller.siteId}','${otherSeller.siteId}'))::text || '|' ||
      (SELECT count(*) FROM checkout_sessions WHERE site_id='${seller.siteId}' AND idempotency_key='${idempotencyKey}')::text || '|' ||
      (SELECT coalesce(string_agg(product_id::text || ':' || available::text || ':' || reserved::text || ':' ||
        available_quantity::text || ':' || reserved_quantity::text, ',' ORDER BY product_id::text), '')
         FROM inventory_levels WHERE product_id IN ('${approved.productId}','${otherSellerApproved.productId}'));`);
}

test('storefront cart cannot accept marketplace listing metadata or change an existing cart origin', async () => {
    const directStorefront = await gateway.request(`/v1/storefront/${seller.subdomain}/cart`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cartBody(approved.listingId, approved.productId)),
    });
    assert.equal(directStorefront.status, 400, directStorefront.text);
    assert.equal(directStorefront.json?.error?.code, 'SALES_ORIGIN_MISMATCH');

    const created = await gateway.request(`/v1/storefront/${seller.subdomain}/marketplace-cart`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cartBody(approved.listingId, approved.productId)),
    });
    assert.equal(created.status, 201, created.text);
    const token = created.json?.data?.cart_token as string;
    const conversion = await gateway.request(`/v1/storefront/${seller.subdomain}/cart/${token}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
            cart_token: token, channel: 'web',
            lines: [{ product_id: approved.productId, quantity: 1, properties: {} }],
            coupon_codes: [],
        }),
    });
    assert.equal(conversion.status, 409, conversion.text);
    assert.equal(conversion.json?.error?.code, 'SALES_ORIGIN_IMMUTABLE');
});

test('marketplace COD checkout creates a seller order with immutable approved-listing identity', async () => {
    const created = await gateway.request(`/v1/storefront/${seller.subdomain}/marketplace-cart`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cartBody(approved.listingId, approved.productId)),
    });
    assert.equal(created.status, 201, created.text);
    const cart = created.json?.data as { id: string; cart_token: string };
    const checkoutUrl = await gateway.request(`/v1/storefront/${seller.subdomain}/cart/${cart.cart_token}/checkout-url`, { method: 'POST' });
    assert.equal(checkoutUrl.status, 200, checkoutUrl.text);
    const signedUrl = new URL(checkoutUrl.json?.data?.checkout_url as string);
    const query = signedUrl.searchParams.toString();
    const step = checkoutStep(cart.id, query);

    const contact = await step('contact', { idempotency_key: `market-contact-${cart.id}`, email: 'market-cart@example.invalid', name: 'Marketplace Buyer' });
    assert.equal(contact.status, 200, contact.text);
    const rateId = await deliveryRate(cart.id, query);
    assert.equal(rateId, shippingRateId);
    const delivery = await step('delivery', {
        idempotency_key: `market-delivery-${cart.id}`, shipping_method: 'standard', cod_requested: false,
        shipping_address: { line1: 'Fixture Road', city: 'Bengaluru', state: 'Karnataka', state_code: '29', zip: '560001', country: 'IN' },
        shipping_quote: { shipping_rate_id: rateId, amount: 0, expected_shipping_amount: 60 },
    });
    assert.equal(delivery.status, 200, delivery.text);
    assert.equal(delivery.json?.data?.checkout?.delivery_quote?.amount, 60);
    assert.equal(delivery.json?.data?.checkout?.delivery_quote?.shipping_rate_id, shippingRateId);
    const intent = await step('payment-intent', {
        idempotency_key: `market-intent-${cart.id}`, provider: 'cod', mode: 'sandbox', tokenize: false, metadata: {},
    });
    assert.equal(intent.status, 201, intent.text);
    const confirmed = await step('confirm', { idempotency_key: `market-confirm-${cart.id}` });
    assert.equal(confirmed.status, 200, confirmed.text);
    const orderId = confirmed.json?.data?.order?.id as string;
    assert.ok(orderId);
    const recovered = await gateway.request(
        `/v1/storefront/${seller.subdomain}/cart/${cart.cart_token}/checkout-status`,
    );
    assert.equal(recovered.status, 200, recovered.text);
    assert.equal(recovered.json?.data?.checkout_state, 'completed');
    assert.equal(recovered.json?.data?.order?.id, orderId);
    assert.equal(recovered.json?.data?.order?.order_number, confirmed.json?.data?.order?.order_number);
    assert.equal('email' in (recovered.json?.data?.order ?? {}), false);
    const crossSellerRecovery = await gateway.request(
        `/v1/storefront/${otherSeller.subdomain}/cart/${cart.cart_token}/checkout-status`,
    );
    assert.equal(crossSellerRecovery.status, 404, crossSellerRecovery.text);
    assert.equal(psql(`SELECT p.channel FROM orders o JOIN purchases p ON p.id=o.purchase_id WHERE o.id='${orderId}';`), 'marketplace');
    assert.equal(psql(`SELECT marketplace_listing_id FROM order_items WHERE order_id='${orderId}';`), approved.listingId);
    assert.equal(psql(`SELECT marketplace_approved_fingerprint FROM order_items WHERE order_id='${orderId}';`), psql(`SELECT approved_product_fingerprint FROM channel_listings WHERE id='${approved.listingId}';`));
    assert.equal(psql(`SELECT marketplace_category_id FROM order_items WHERE order_id='${orderId}';`), categoryId);
    assert.equal(psql(`SELECT shipping_cost FROM orders WHERE id='${orderId}';`), '60.00');
    assert.throws(
        () => psql(`UPDATE order_items SET marketplace_listing_id='${pending.listingId}' WHERE order_id='${orderId}';`),
        /marketplace order listing identity is immutable/,
    );
    assert.throws(
        () => psql(`UPDATE order_items SET marketplace_category_id='${crypto.randomUUID()}' WHERE order_id='${orderId}';`),
        /marketplace category snapshot is immutable/,
    );
    assert.equal(psql(`SELECT sales_origin FROM checkout_sessions WHERE cart_id='${cart.id}';`), 'marketplace');
});

test('marketplace delivery fails closed outside the configured zone and ignores client shipping prices', async () => {
    const created = await gateway.request(`/v1/storefront/${seller.subdomain}/marketplace-cart`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cartBody(approved.listingId, approved.productId)),
    });
    assert.equal(created.status, 201, created.text);
    const cart = created.json?.data as { id: string; cart_token: string };
    const handoff = await gateway.request(`/v1/storefront/${seller.subdomain}/cart/${cart.cart_token}/checkout-url`, { method: 'POST' });
    assert.equal(handoff.status, 200, handoff.text);
    const query = new URL(handoff.json?.data?.checkout_url as string).searchParams.toString();
    const step = checkoutStep(cart.id, query);
    assert.equal((await step('contact', { idempotency_key: `market-shipping-contact-${cart.id}`, email: 'market-cart@example.invalid', name: 'Marketplace Buyer' })).status, 200);

    const outsideZone = await gateway.request(`/v1/checkout/${cart.id}/delivery-options?${query}&country=IN&state=Karnataka&pincode=560002`);
    assert.equal(outsideZone.status, 200, outsideZone.text);
    assert.equal(outsideZone.json?.data?.serviceable, false);
    assert.deepEqual(outsideZone.json?.data?.rates, []);

    const delivery = await step('delivery', {
        idempotency_key: `market-shipping-outside-${cart.id}`, shipping_method: 'standard', cod_requested: true,
        shipping_address: { line1: 'Fixture Road', city: 'Bengaluru', state: 'Karnataka', zip: '560002', country: 'IN' },
        shipping_quote: { shipping_rate_id: shippingRateId, amount: 0, expected_shipping_amount: 60 },
    });
    assert.equal(delivery.status, 409, delivery.text);
    assert.equal(delivery.json?.error?.code, 'CHECKOUT_SHIPPING_UNAVAILABLE');
    assert.equal(psql(`SELECT checkout_state FROM checkout_sessions WHERE cart_id='${cart.id}';`), 'contact');
});

test('marketplace COD confirmation refuses a rate changed after buyer review', async () => {
    const created = await gateway.request(`/v1/storefront/${seller.subdomain}/marketplace-cart`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cartBody(approved.listingId, approved.productId)),
    });
    assert.equal(created.status, 201, created.text);
    const cart = created.json?.data as { id: string; cart_token: string };
    const handoff = await gateway.request(`/v1/storefront/${seller.subdomain}/cart/${cart.cart_token}/checkout-url`, { method: 'POST' });
    assert.equal(handoff.status, 200, handoff.text);
    const query = new URL(handoff.json?.data?.checkout_url as string).searchParams.toString();
    const step = checkoutStep(cart.id, query);
    assert.equal((await step('contact', { idempotency_key: `market-rate-change-contact-${cart.id}`, email: 'market-cart@example.invalid', name: 'Marketplace Buyer' })).status, 200);
    const rateId = await deliveryRate(cart.id, query);
    assert.equal((await step('delivery', {
        idempotency_key: `market-rate-change-delivery-${cart.id}`, shipping_method: 'standard', cod_requested: true,
        shipping_address: { line1: 'Fixture Road', city: 'Bengaluru', state: 'Karnataka', zip: '560001', country: 'IN' },
        shipping_quote: { shipping_rate_id: rateId, expected_shipping_amount: 60 },
    })).status, 200);
    assert.equal((await step('payment-intent', {
        idempotency_key: `market-rate-change-intent-${cart.id}`, provider: 'cod', mode: 'sandbox', tokenize: false, metadata: {},
    })).status, 201);

    const ordersBefore = psql(`SELECT count(*) FROM orders WHERE store_id='${seller.siteId}';`);
    psql(`UPDATE shipping_rates SET price=70 WHERE id='${shippingRateId}';`);
    const confirmed = await step('confirm', { idempotency_key: `market-rate-change-confirm-${cart.id}` });
    psql(`UPDATE shipping_rates SET price=60 WHERE id='${shippingRateId}';`);
    assert.equal(confirmed.status, 409, confirmed.text);
    assert.equal(confirmed.json?.error?.code, 'CHECKOUT_SHIPPING_CHANGED');
    assert.equal(psql(`SELECT count(*) FROM orders WHERE store_id='${seller.siteId}';`), ordersBefore);
});

test('marketplace online payment is rejected before creating a pending order or payment intent', async () => {
    const created = await gateway.request(`/v1/storefront/${seller.subdomain}/marketplace-cart`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cartBody(approved.listingId, approved.productId)),
    });
    assert.equal(created.status, 201, created.text);
    const cart = created.json?.data as { id: string; cart_token: string };
    const checkoutUrl = await gateway.request(`/v1/storefront/${seller.subdomain}/cart/${cart.cart_token}/checkout-url`, { method: 'POST' });
    assert.equal(checkoutUrl.status, 200, checkoutUrl.text);
    const query = new URL(checkoutUrl.json?.data?.checkout_url as string).searchParams.toString();
    const step = checkoutStep(cart.id, query);
    assert.equal((await step('contact', { idempotency_key: `market-online-contact-${cart.id}`, email: 'market-cart@example.invalid', name: 'Marketplace Buyer' })).status, 200);
    const rateId = await deliveryRate(cart.id, query);
    assert.equal((await step('delivery', {
        idempotency_key: `market-online-delivery-${cart.id}`, shipping_method: 'standard', cod_requested: false,
        shipping_address: { line1: 'Fixture Road', city: 'Bengaluru', state: 'Karnataka', state_code: '29', zip: '560001', country: 'IN' },
        shipping_quote: { shipping_rate_id: rateId, expected_shipping_amount: 60 },
    })).status, 200);

    const orderCountBefore = psql(`SELECT count(*) FROM orders WHERE store_id='${seller.siteId}';`);
    const intent = await step('payment-intent', {
        idempotency_key: `market-online-intent-${cart.id}`, provider: 'razorpay', mode: 'sandbox', tokenize: false, metadata: {},
    });
    assert.equal(intent.status, 503, intent.text);
    assert.equal(intent.json?.error?.code, 'MARKETPLACE_PAYMENT_PROVIDER_UNAVAILABLE');
    assert.equal(psql(`SELECT count(*) FROM orders WHERE store_id='${seller.siteId}';`), orderCountBefore);
    assert.equal(psql(`SELECT checkout_state FROM checkout_sessions WHERE cart_id='${cart.id}';`), 'delivery');
    assert.equal(psql(`SELECT payment_intent = '{}'::jsonb FROM checkout_sessions WHERE cart_id='${cart.id}';`), 't');
});

test('marketplace order confirmation refuses a product revoked after the signed cart handoff', async () => {
    const created = await gateway.request(`/v1/storefront/${seller.subdomain}/marketplace-cart`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cartBody(revocable.listingId, revocable.productId)),
    });
    assert.equal(created.status, 201, created.text);
    const cart = created.json?.data as { id: string; cart_token: string };
    const checkoutUrl = await gateway.request(`/v1/storefront/${seller.subdomain}/cart/${cart.cart_token}/checkout-url`, { method: 'POST' });
    assert.equal(checkoutUrl.status, 200, checkoutUrl.text);
    const query = new URL(checkoutUrl.json?.data?.checkout_url as string).searchParams.toString();
    const step = checkoutStep(cart.id, query);
    assert.equal((await step('contact', { idempotency_key: `market-revoke-contact-${cart.id}`, email: 'market-cart@example.invalid', name: 'Marketplace Buyer' })).status, 200);
    const rateId = await deliveryRate(cart.id, query);
    assert.equal((await step('delivery', {
        idempotency_key: `market-revoke-delivery-${cart.id}`, shipping_method: 'standard', cod_requested: true,
        shipping_address: { line1: 'Fixture Road', city: 'Bengaluru', state: 'Karnataka', state_code: '29', zip: '560001', country: 'IN' }, shipping_quote: { shipping_rate_id: rateId, expected_shipping_amount: 60 },
    })).status, 200);
    const intent = await step('payment-intent', {
        idempotency_key: `market-revoke-intent-${cart.id}`, provider: 'cod', mode: 'sandbox', tokenize: false, metadata: {},
    });
    assert.equal(intent.status, 201, intent.text);
    psql(`UPDATE products SET is_active=false WHERE id='${revocable.productId}';`);
    const confirmed = await step('confirm', { idempotency_key: `market-revoke-confirm-${cart.id}` });
    assert.equal(confirmed.status, 409, confirmed.text);
    assert.equal(confirmed.json?.error?.code, 'MARKETPLACE_LISTING_UNAVAILABLE');
    assert.equal(psql(`SELECT count(*) FROM orders WHERE store_id='${seller.siteId}';`), '1');
});

test('marketplace order confirmation refuses a material product revision after review approval', async () => {
    const revisionBound = createListing('Revision-bound cart item');
    publish(revisionBound.listingId);
    const created = await gateway.request(`/v1/storefront/${seller.subdomain}/marketplace-cart`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cartBody(revisionBound.listingId, revisionBound.productId)),
    });
    assert.equal(created.status, 201, created.text);
    const cart = created.json?.data as { id: string; cart_token: string };
    const handoff = await gateway.request(`/v1/storefront/${seller.subdomain}/cart/${cart.cart_token}/checkout-url`, { method: 'POST' });
    assert.equal(handoff.status, 200, handoff.text);
    const query = new URL(handoff.json?.data?.checkout_url as string).searchParams.toString();
    const step = checkoutStep(cart.id, query);
    assert.equal((await step('contact', { idempotency_key: `market-revision-contact-${cart.id}`, email: 'market-cart@example.invalid', name: 'Marketplace Buyer' })).status, 200);
    const rateId = await deliveryRate(cart.id, query);
    assert.equal((await step('delivery', {
        idempotency_key: `market-revision-delivery-${cart.id}`, shipping_method: 'standard', cod_requested: true,
        shipping_address: { line1: 'Fixture Road', city: 'Bengaluru', state: 'Karnataka', zip: '560001', country: 'IN' },
        shipping_quote: { shipping_rate_id: rateId, expected_shipping_amount: 60 },
    })).status, 200);
    assert.equal((await step('payment-intent', {
        idempotency_key: `market-revision-intent-${cart.id}`, provider: 'cod', mode: 'sandbox', tokenize: false, metadata: {},
    })).status, 201);

    const ordersBefore = psql(`SELECT count(*) FROM orders WHERE store_id='${seller.siteId}';`);
    psql(`UPDATE products SET description='Material copy changed after review' WHERE id='${revisionBound.productId}';`);
    assert.equal(psql(`SELECT status FROM channel_listings WHERE id='${revisionBound.listingId}';`), 'draft');

    const confirmation = await step('confirm', { idempotency_key: `market-revision-confirm-${cart.id}` });
    assert.equal(confirmation.status, 409, confirmation.text);
    assert.equal(confirmation.json?.error?.code, 'MARKETPLACE_LISTING_UNAVAILABLE');
    assert.equal(psql(`SELECT count(*) FROM orders WHERE store_id='${seller.siteId}';`), ordersBefore);
    assert.equal(psql(`SELECT checkout_state FROM checkout_sessions WHERE cart_id='${cart.id}';`), 'payment_intent');
    assert.equal(psql(`SELECT available || '|' || reserved FROM inventory_levels WHERE product_id='${revisionBound.productId}';`), '8|0');
});

test('marketplace order uses the existing buyer ownership transaction for a signed buyer session', async () => {
    const buyer = seedBuyerAccount(psql, 'market-checkout-buyer');
    const sessionToken = await mintSession(keys, buyer.id, {
        audience: 'letbuyy:storefront-session', tokenUse: 'storefront_session', epoch: 1,
        extraClaims: { site_id: seller.siteId },
    });
    const buyerHeaders = { [LETBUYY_STOREFRONT_SESSION_HEADER]: sessionToken, 'Content-Type': 'application/json' };
    const created = await gateway.request(`/v1/storefront/${seller.subdomain}/marketplace-cart`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cartBody(approved.listingId, approved.productId)),
    });
    assert.equal(created.status, 201, created.text);
    const cart = created.json?.data as { id: string; cart_token: string };
    const handoff = await gateway.request(`/v1/storefront/${seller.subdomain}/cart/${cart.cart_token}/checkout-url`, {
        method: 'POST', headers: buyerHeaders,
    });
    assert.equal(handoff.status, 200, handoff.text);
    const query = new URL(handoff.json?.data?.checkout_url as string).searchParams.toString();
    const step = checkoutStep(cart.id, query);
    assert.equal((await step('contact', { idempotency_key: `market-buyer-contact-${cart.id}`, email: 'market-owner@example.invalid', name: 'Marketplace Buyer' })).status, 200);
    const rateId = await deliveryRate(cart.id, query);
    assert.equal((await step('delivery', {
        idempotency_key: `market-buyer-delivery-${cart.id}`, shipping_method: 'standard', cod_requested: true,
        shipping_address: { line1: 'Fixture Road', city: 'Bengaluru', state: 'Karnataka', state_code: '29', zip: '560001', country: 'IN' }, shipping_quote: { shipping_rate_id: rateId, expected_shipping_amount: 60 },
    })).status, 200);
    assert.equal((await step('payment-intent', {
        idempotency_key: `market-buyer-intent-${cart.id}`, provider: 'cod', mode: 'sandbox', tokenize: false, metadata: {},
    })).status, 201);
    const confirmed = await step('confirm', { idempotency_key: `market-buyer-confirm-${cart.id}` });
    assert.equal(confirmed.status, 200, confirmed.text);
    const orderId = confirmed.json?.data?.order?.id as string;
    assert.equal(psql(`SELECT buyer_account_id FROM buyer_order_links WHERE order_id='${orderId}';`), buyer.id);
    assert.equal(psql(`SELECT p.channel FROM purchases p JOIN orders o ON o.purchase_id=p.id WHERE o.id='${orderId}';`), 'marketplace');
});

test('storefront-only product completes ordinary storefront COD checkout without marketplace approval', async () => {
    const productId = crypto.randomUUID();
    psql(`INSERT INTO products
      (id,site_id,store_id,name,slug,description,price,images,stock,is_active,status)
      VALUES ('${productId}','${seller.siteId}','${seller.siteId}','Storefront-only item','syn-${productId.slice(0, 12)}','fixture',129,ARRAY[]::text[],8,true,'active');
      INSERT INTO inventory_levels
        (id,store_id,product_id,variant_id,location_id,available,reserved,committed_quantity,available_quantity,reserved_quantity,on_hand_quantity,created_at,updated_at)
      VALUES (gen_random_uuid(),'${seller.siteId}','${productId}',NULL,'${seller.locationId}',8,0,0,8,0,8,now(),now());`);

    const created = await gateway.request(`/v1/storefront/${seller.subdomain}/cart`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
            channel: 'web', lines: [{ product_id: productId, quantity: 1, properties: {} }], coupon_codes: [],
        }),
    });
    assert.equal(created.status, 201, created.text);
    const cart = created.json?.data as { id: string; cart_token: string; sales_origin: string };
    assert.equal(cart.sales_origin, 'storefront');
    const checkoutUrl = await gateway.request(`/v1/storefront/${seller.subdomain}/cart/${cart.cart_token}/checkout-url`, { method: 'POST' });
    assert.equal(checkoutUrl.status, 200, checkoutUrl.text);
    const query = new URL(checkoutUrl.json?.data?.checkout_url as string).searchParams.toString();
    const step = checkoutStep(cart.id, query);

    const contact = await step('contact', { idempotency_key: `storefront-contact-${cart.id}`, email: 'storefront-buyer@example.invalid', name: 'Storefront Buyer' });
    assert.equal(contact.status, 200, contact.text);
    const rateId = await deliveryRate(cart.id, query);
    assert.equal(rateId, shippingRateId);
    const delivery = await step('delivery', {
        idempotency_key: `storefront-delivery-${cart.id}`, shipping_method: 'standard', cod_requested: true,
        shipping_address: { line1: 'Fixture Road', city: 'Bengaluru', state: 'Karnataka', state_code: '29', zip: '560001', country: 'IN' },
        shipping_quote: { shipping_rate_id: rateId, expected_shipping_amount: 60 },
    });
    assert.equal(delivery.status, 200, delivery.text);
    const intent = await step('payment-intent', {
        idempotency_key: `storefront-intent-${cart.id}`, provider: 'cod', mode: 'sandbox', tokenize: false, metadata: {},
    });
    assert.equal(intent.status, 201, intent.text);
    const confirmed = await step('confirm', { idempotency_key: `storefront-confirm-${cart.id}` });
    assert.equal(confirmed.status, 200, confirmed.text);
    const orderId = confirmed.json?.data?.order?.id as string;
    assert.ok(orderId);
    assert.equal(psql(`SELECT sales_origin FROM checkout_sessions WHERE cart_id='${cart.id}';`), 'storefront');
    assert.equal(psql(`SELECT p.channel FROM purchases p JOIN orders o ON o.purchase_id=p.id WHERE o.id='${orderId}';`), 'storefront');
    assert.equal(psql(`SELECT count(*) FROM order_items WHERE order_id='${orderId}' AND marketplace_listing_id IS NOT NULL;`), '0');
    assert.equal(psql(`SELECT count(*) FROM order_items WHERE order_id='${orderId}' AND product_id='${productId}';`), '1');
});

if (process.env.LETBUYY_ENABLE_MARKETPLACE_MOBILE_OWNED_E2E === '1') {
    test('real Flutter checkout service completes COD, recovers a lost committed response, and refuses an edited listing through owned Gateway and Postgres', async () => {
        const mobile = newSyntheticTenant('market-mobile-e2e');
        seedSyntheticTenant(psql, mobile);
        const mobileCategoryId = crypto.randomUUID();
        const mobileZoneId = crypto.randomUUID();
        psql(`INSERT INTO marketplace_categories (id,slug,name,is_active)
          VALUES ('${mobileCategoryId}','market-mobile-e2e','Mobile integration fixture',true);
          INSERT INTO shipping_zones (id,store_id,site_id,name,countries,states,zip_codes,cod_enabled)
          VALUES ('${mobileZoneId}','${mobile.siteId}','${mobile.siteId}','Mobile zone','{IN}','{Karnataka}','{560001}',true);
          INSERT INTO shipping_rates (id,zone_id,site_id,name,type,price,is_active,cod_enabled)
          VALUES (gen_random_uuid(),'${mobileZoneId}','${mobile.siteId}','Mobile COD','flat',60,true,true);`);
        const mobileListing = createListing('Mobile checkout item', mobile);
        psql(`UPDATE channel_listings SET marketplace_category_id='${mobileCategoryId}' WHERE id='${mobileListing.listingId}';`);
        publish(mobileListing.listingId, mobile);

        const keys = await newIdentityKeys('market-mobile-e2e');
        const env = gatewayEnv(owned, keys, {
        ...sqlProxy.env(),
            CHECKOUT_SIGNING_SECRET: 'synthetic-marketplace-mobile-checkout-secret',
            CHECKOUT_ORIGIN: 'https://checkout.letbuyy.test',
        });
        const background: Promise<unknown>[] = [];
        let interceptedCartId: string | undefined;
        let interceptedProductEdit = false;
        let committedOrderIdWithLostResponse: string | undefined;
        let lostResponseCartId: string | undefined;
        let droppedCommittedResponse = false;
        let ordersBeforeLostResponse: string | undefined;
        let ordersBeforeStaleCheckout: string | undefined;
        let inventoryBeforeStaleCheckout: string | undefined;
        const staleCartToken = 'ct_market_mobile_stale_owned_e2e';
        const lostResponseCartToken = 'ct_market_mobile_lost_response_owned_e2e';
        const server = createServer(async (req, res) => {
            try {
                const body = await readRequestBody(req);
                const requestUrl = req.url || '/';
                if (req.method === 'POST' && requestUrl.split('?')[0]?.endsWith('/marketplace-cart')) {
                    const cartToken = (JSON.parse(body.toString('utf8')) as { cart_token?: string }).cart_token;
                    if (cartToken === lostResponseCartToken) {
                        committedOrderIdWithLostResponse = undefined;
                        ordersBeforeLostResponse = psql(`SELECT count(*) FROM orders WHERE store_id='${mobile.siteId}';`);
                    }
                    if (cartToken === staleCartToken) {
                        ordersBeforeStaleCheckout = psql(`SELECT count(*) FROM orders WHERE store_id='${mobile.siteId}';`);
                        inventoryBeforeStaleCheckout = psql(`SELECT available || '|' || reserved || '|' || available_quantity || '|' || reserved_quantity
                          FROM inventory_levels WHERE product_id='${mobileListing.productId}';`);
                    }
                }
                if (req.method === 'POST' && /\/confirm(?:\?|$)/.test(requestUrl)) {
                    const match = requestUrl.match(/\/checkout\/([0-9a-f-]+)\/confirm(?:\?|$)/i);
                    const confirmCartId = match?.[1];
                    if (!confirmCartId) throw new Error('confirm request did not include a checkout cart id');
                    if (psql(`SELECT session_id FROM carts WHERE id='${confirmCartId}';`) === staleCartToken) {
                        interceptedCartId = confirmCartId;
                        psql(`UPDATE products SET description='Edited after mobile final review' WHERE id='${mobileListing.productId}';`);
                        interceptedProductEdit = true;
                    }
                }
                const headers = new Headers();
                for (let index = 0; index < req.rawHeaders.length; index += 2) headers.append(req.rawHeaders[index], req.rawHeaders[index + 1]);
                headers.set('CF-Connecting-IP', '2001:db8:feed::fe');
                const request = new Request(`https://gateway.test${requestUrl}`, {
                    method: req.method,
                    headers,
                    ...(body.length && req.method !== 'GET' && req.method !== 'HEAD' ? { body, duplex: 'half' as const } : {}),
                });
                const context = {
                    waitUntil: (work: Promise<unknown>) => background.push(Promise.resolve(work).catch(() => undefined)),
                    passThroughOnException: () => undefined,
                };
                const response = await worker.fetch(request, env, context as never);
                if (req.method === 'POST' && requestUrl.split('?')[0]?.endsWith('/marketplace-cart')) {
                    const cartToken = (JSON.parse(body.toString('utf8')) as { cart_token?: string }).cart_token;
                    if (cartToken === lostResponseCartToken) {
                        lostResponseCartId = psql(`SELECT id FROM carts WHERE session_id='${lostResponseCartToken}' AND store_id='${mobile.siteId}' ORDER BY created_at DESC LIMIT 1;`);
                    }
                }
                if (req.method === 'POST' && /\/confirm(?:\?|$)/.test(requestUrl)) {
                    const match = requestUrl.match(/\/checkout\/([0-9a-f-]+)\/confirm(?:\?|$)/i);
                    const confirmCartId = match?.[1];
                    if (confirmCartId && psql(`SELECT session_id FROM carts WHERE id='${confirmCartId}';`) === lostResponseCartToken) {
                        assert.equal(response.status, 200, 'the simulated lost response must follow a committed COD confirmation');
                        const responseBody = Buffer.from(await response.arrayBuffer());
                        committedOrderIdWithLostResponse = JSON.parse(responseBody.toString('utf8'))?.data?.order?.id;
                        assert.ok(committedOrderIdWithLostResponse, 'the order must commit before its response is dropped');
                        if (background.length) await Promise.allSettled(background.splice(0));
                        droppedCommittedResponse = true;
                        res.destroy();
                        return;
                    }
                }
                res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
                res.end(Buffer.from(await response.arrayBuffer()));
                if (background.length) await Promise.allSettled(background.splice(0));
            } catch (error) {
                res.writeHead(500, { 'content-type': 'application/json' });
                res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'owned Gateway bridge failed' }));
            }
        });
        server.listen(0, '127.0.0.1');
        await once(server, 'listening');
        const port = (server.address() as { port: number }).port;
        let stdout = '';
        let stderr = '';
        let timedOut = false;
        const child = startOwnedClientRuntime(owned, 'marketplace-flutter', {
            env: {
                LETBUYY_MARKETPLACE_OWNED_GATEWAY_URL: `http://127.0.0.1:${port}/v1`,
                LETBUYY_MARKETPLACE_OWNED_LISTING_ID: mobileListing.listingId,
                LETBUYY_MARKETPLACE_OWNED_PRODUCT_ID: mobileListing.productId,
                LETBUYY_MARKETPLACE_OWNED_SITE_ID: mobile.siteId,
                LETBUYY_MARKETPLACE_OWNED_STALE_CART_TOKEN: staleCartToken,
                LETBUYY_MARKETPLACE_OWNED_LOST_RESPONSE_CART_TOKEN: lostResponseCartToken,
            },
        });
        child.stdout.setEncoding('utf8').on('data', chunk => { stdout = (stdout + chunk).slice(-20_000); });
        child.stderr.setEncoding('utf8').on('data', chunk => { stderr = (stderr + chunk).slice(-20_000); });
        const exit = new Promise<void>((resolve, reject) => {
            child.once('error', reject);
            child.once('close', (code, signal) => code === 0 ? resolve() : reject(new Error(`Flutter owned integration exited ${code ?? signal}\n${stdout}\n${stderr}`)));
        });
        let hardStop: NodeJS.Timeout | undefined;
        const timer = setTimeout(() => {
            timedOut = true;
            child.kill('SIGTERM');
            hardStop = setTimeout(() => child.kill('SIGKILL'), 5_000);
        }, 120_000);
        try {
            await exit;
        } finally {
            clearTimeout(timer);
            if (hardStop) clearTimeout(hardStop);
            await stopOwnedClientRuntime(child);
            if (server.listening) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
            await Promise.allSettled(background.splice(0));
        }

        assert.equal(timedOut, false, 'Flutter integration exceeded two minutes');
        assert.equal(droppedCommittedResponse, true, 'the real client must reach a committed order whose response is lost');
        assert.ok(committedOrderIdWithLostResponse);
        assert.ok(lostResponseCartId);
        assert.notEqual(ordersBeforeLostResponse, undefined);
        assert.equal(psql(`SELECT count(*) FROM orders WHERE store_id='${mobile.siteId}';`), String(Number(ordersBeforeLostResponse) + 1));
        assert.equal(psql(`SELECT count(*) FROM checkout_sessions WHERE order_id='${committedOrderIdWithLostResponse}' AND cart_id='${lostResponseCartId}';`), '1');
        assert.equal(psql(`SELECT status FROM orders WHERE id='${committedOrderIdWithLostResponse}';`), 'pending_cod');
        assert.equal(interceptedProductEdit, true, 'the real client never reached final order confirmation');
        assert.ok(interceptedCartId);
        assert.notEqual(ordersBeforeStaleCheckout, undefined, 'the stale-cart boundary was observed');
        assert.notEqual(inventoryBeforeStaleCheckout, undefined, 'the stale-cart stock boundary was observed');
        assert.equal(psql(`SELECT status FROM channel_listings WHERE id='${mobileListing.listingId}';`), 'draft');
        assert.equal(psql(`SELECT store_id FROM carts WHERE id='${interceptedCartId}';`), mobile.siteId);
        assert.equal(psql(`SELECT count(*) FROM orders WHERE store_id='${mobile.siteId}';`), ordersBeforeStaleCheckout);
        assert.equal(psql(`SELECT checkout_state FROM checkout_sessions WHERE cart_id='${interceptedCartId}';`), 'payment_intent');
        assert.equal(psql(`SELECT available || '|' || reserved || '|' || available_quantity || '|' || reserved_quantity
          FROM inventory_levels WHERE product_id='${mobileListing.productId}';`), inventoryBeforeStaleCheckout);
    });
}

function readRequestBody(req: IncomingMessage): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on('data', chunk => chunks.push(Buffer.from(chunk)));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
    });
}

test('approved marketplace carts retain independent authority while storefront password, preview and offline modes change',async()=>{
 const unapproved=createListing('Synthetic restricted-mode pending listing');submit(unapproved.listingId);
 try{
  for(const mode of ['password','preview_only','offline']){
   psql(`UPDATE sites SET access_mode='${mode}' WHERE id='${seller.siteId}';`);
   const created=await gateway.request(`/v1/storefront/${seller.subdomain}/marketplace-cart`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(cartBody(approved.listingId,approved.productId))});assert.equal(created.status,201,created.text);
   const token=created.json!.data.cart_token;assert.equal((await gateway.request(`/v1/storefront/${seller.subdomain}/cart/${token}`)).status,200);
   assert.equal((await gateway.request(`/v1/storefront/${seller.subdomain}/cart/${token}/checkout-url`)).status,200);
   const refused=await gateway.request(`/v1/storefront/${seller.subdomain}/marketplace-cart`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(cartBody(unapproved.listingId,unapproved.productId))});assert.equal(refused.status,409,refused.text);
  }
 }finally{psql(`UPDATE sites SET access_mode='public' WHERE id='${seller.siteId}';`);}
});

test('marketplace cart clearing keeps independent origin while storefront navigation is offline',async()=>{
 const created=await gateway.request(`/v1/storefront/${seller.subdomain}/marketplace-cart`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(cartBody(approved.listingId,approved.productId))});assert.equal(created.status,201);const cart=created.json!.data;
 try{psql(`UPDATE sites SET access_mode='offline' WHERE id='${seller.siteId}';`);const cleared=await gateway.request(`/v1/storefront/${seller.subdomain}/cart/${cart.cart_token}`,{method:'DELETE'});assert.equal(cleared.status,200,cleared.text);assert.equal(cleared.json!.data.sales_origin,'marketplace');assert.deepEqual(cleared.json!.data.lines,[]);assert.equal(cleared.json!.data.status,'active');}finally{psql(`UPDATE sites SET access_mode='public' WHERE id='${seller.siteId}';`);}
});
