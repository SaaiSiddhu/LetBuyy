// Synthetic local test credentials only: owned disposable accounts, stub provider identifiers,
// and public challenge test fixtures. Never use these values for a real account or live provider.
// Exact value hashes are reviewed in config/governance/secret-scan-exceptions.json.
// The legacy storefront account profile read is bound to the signed customer and store.
// Exercise the real worker, session middleware, PostgREST and owned Postgres.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test, { afterEach, before } from 'node:test';
import { createHmac } from 'node:crypto';
import { resolve } from 'node:path';
import * as bcrypt from 'bcryptjs';
import { exportJWK } from 'jose';
import { createCustomerSessionToken, createHostOnlyShopperIdentityProvider, issueCustomerSession, LETBUYY_CUSTOMER_SESSION_COOKIE } from '@letbuyy/auth-core';
import { Gateway, gatewayEnv, INTERNAL_SECRET, mintSession, buyerHeaders, newIdentityKeys, seedBuyerAccount, tapRest, type IdentityKeys } from './gateway-harness';
import { requireOwnedDatabase, startOwnedClientRuntime, stopOwnedClientRuntime } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticOrder, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase();
const { psql } = owned;
const site = newSyntheticTenant('customer-profile');
const otherSite = newSyntheticTenant('customer-profile-alt');
const sessionSecret = 'synthetic-customer-profile-session-secret';
let keys: IdentityKeys;
let gateway: Gateway;

before(async () => {
    keys = await newIdentityKeys();
    seedSyntheticTenant(psql, site);
    seedSyntheticTenant(psql, otherSite);
    gateway = new Gateway(gatewayEnv(owned, keys, { CUSTOMER_SESSION_SECRET: sessionSecret, FEATURE_GRAPHQL: 'true' }));
});
afterEach(async () => { await gateway.settle(); });

async function customerCookie(storeId: string, customerId: string): Promise<string> {
    const session = await issueCustomerSession({ storeId, customerId }, sessionSecret);
    return `${LETBUYY_CUSTOMER_SESSION_COOKIE}=${session.token}`;
}

async function reserveLocalPort(): Promise<number> {
    const server = createServer();
    await new Promise<void>((resolveListen, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => resolveListen());
    });
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    await new Promise<void>((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose()));
    return address.port;
}

test('profile GET returns only the active customer bound to the signed store', async () => {
    const customerId = crypto.randomUUID();
    const email = `profile-${crypto.randomUUID()}@example.invalid`;
    psql(`INSERT INTO store_customers (id,store_id,email,full_name,phone,accepts_marketing,status) VALUES ('${customerId}','${site.siteId}','${email}','Synthetic Profile Buyer','+919000000111',true,'active');`);

    const response = await gateway.request('/v1/storefront/customer/profile', {
        headers: { Cookie: await customerCookie(site.siteId, customerId) },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(response.json?.data?.customer, {
        id: customerId,
        email,
        full_name: 'Synthetic Profile Buyer',
        phone: '+919000000111',
        accepts_marketing: true,
    });
    assert.doesNotMatch(response.text, /password|credential|secret/i);
});

test('profile GET fails closed for unknown, disabled and cross-store customer ids', async () => {
    const customerId = crypto.randomUUID();
    const email = `profile-disabled-${crypto.randomUUID()}@example.invalid`;
    psql(`INSERT INTO store_customers (id,store_id,email,full_name,status) VALUES ('${customerId}','${site.siteId}','${email}','Synthetic Disabled Buyer','disabled');`);

    const disabled = await gateway.request('/v1/storefront/customer/profile', {
        headers: { Cookie: await customerCookie(site.siteId, customerId) },
    });
    assert.equal(disabled.status, 404);

    const unknown = await gateway.request('/v1/storefront/customer/profile', {
        headers: { Cookie: await customerCookie(site.siteId, crypto.randomUUID()) },
    });
    assert.equal(unknown.status, 404);

    const crossStore = await gateway.request('/v1/storefront/customer/profile', {
        headers: { Cookie: await customerCookie(otherSite.siteId, customerId) },
    });
    assert.equal(crossStore.status, 404);

    const unsigned = await gateway.request('/v1/storefront/customer/profile');
    assert.equal(unsigned.status, 401);
});

test('a signed session stops authorizing legacy customer routes after the account is disabled', async () => {
    const customerId = crypto.randomUUID();
    const email = `profile-revoked-${crypto.randomUUID()}@example.invalid`;
    psql(`INSERT INTO store_customers (id,store_id,email,full_name,status) VALUES ('${customerId}','${site.siteId}','${email}','Synthetic Revoked Buyer','active');`);
    const cookie = await customerCookie(site.siteId, customerId);
    const headers = { Cookie: cookie };
    const routes = [
        `/v1/storefront/customer/wishlist?store_id=${site.siteId}&customer_id=${customerId}`,
        `/v1/storefront/customer/addresses?store_id=${site.siteId}`,
        `/v1/storefront/customer/orders?store_id=${site.siteId}`,
    ];
    const customerGraphQL = () => gateway.request('/v1/storefront/graphql', {
        method: 'POST',
        headers: { Cookie: cookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: '{ customer { id store_id } }' }),
    });

    for (const route of routes) {
        const active = await gateway.request(route, { headers });
        assert.equal(active.status, 200, `an active signed customer can read their account data at ${route}`);
    }
    const activeGraphQL = await customerGraphQL();
    assert.equal(activeGraphQL.status, 200);
    assert.deepEqual(activeGraphQL.json?.data?.customer, { id: customerId, store_id: site.siteId });

    psql(`UPDATE store_customers SET status='disabled' WHERE id='${customerId}' AND store_id='${site.siteId}';`);
    for (const route of routes) {
        const disabled = await gateway.request(route, { headers });
        assert.equal(disabled.status, 403, `a still-valid signature must not authorize disabled account data at ${route}`);
    }
    const disabledGraphQL = await customerGraphQL();
    assert.equal(disabledGraphQL.status, 200, 'GraphQL reports field authorization as a sanitized execution error');
    assert.equal(disabledGraphQL.json?.errors?.[0]?.extensions?.code, 'CUSTOMER_SESSION_REQUIRED');
});

test('a signed session cannot read a soft-deleted customer profile or account route', async () => {
    const customerId = crypto.randomUUID();
    const email = `profile-deleted-${crypto.randomUUID()}@example.invalid`;
    psql(`INSERT INTO store_customers (id,store_id,email,full_name,status,deleted_at) VALUES ('${customerId}','${site.siteId}','${email}','Synthetic Deleted Buyer','active',now());`);
    const cookie = await customerCookie(site.siteId, customerId);

    const profile = await gateway.request('/v1/storefront/customer/profile', { headers: { Cookie: cookie } });
    assert.equal(profile.status, 404);
    const wishlist = await gateway.request(`/v1/storefront/customer/wishlist?store_id=${site.siteId}&customer_id=${customerId}`, {
        headers: { Cookie: cookie },
    });
    assert.equal(wishlist.status, 403);
    const graphQL = await gateway.request('/v1/storefront/graphql', {
        method: 'POST',
        headers: { Cookie: cookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: '{ customer { id store_id } }' }),
    });
    assert.equal(graphQL.json?.errors?.[0]?.extensions?.code, 'CUSTOMER_SESSION_REQUIRED');
});

test('GraphQL fails closed and sanitizes customer-state lookup failures', async () => {
    const customerId = crypto.randomUUID();
    const email = `profile-error-${crypto.randomUUID()}@example.invalid`;
    psql(`INSERT INTO store_customers (id,store_id,email,full_name,status) VALUES ('${customerId}','${site.siteId}','${email}','Synthetic Error Buyer','active');`);
    const cookie = await customerCookie(site.siteId, customerId);
    const tap = tapRest(owned.restUrl, async (call) => {
        if (call.resource === 'store_customers' && call.search.get('id') === `eq.${customerId}`) {
            return Response.json({ code: 'XX000', message: 'synthetic private database diagnostic' }, { status: 500 });
        }
        throw new Error(`unexpected REST call during customer GraphQL state check: ${call.resource}`);
    });

    try {
        const response = await gateway.request('/v1/storefront/graphql', {
            method: 'POST',
            headers: { Cookie: cookie, 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: '{ customer { id store_id } }' }),
        });
        assert.equal(response.status, 200);
        assert.equal(response.json?.errors?.[0]?.extensions?.code, 'CUSTOMER_ACCOUNT_UNAVAILABLE');
        assert.doesNotMatch(response.text, /synthetic private database diagnostic|XX000/);
    } finally {
        tap.restore();
    }
});

test('malformed customer session cookie fails closed and does not shadow a valid session header', async () => {
    const customerId = crypto.randomUUID();
    const email = `profile-cookie-${crypto.randomUUID()}@example.invalid`;
    psql(`INSERT INTO store_customers (id,store_id,email,full_name,status) VALUES ('${customerId}','${site.siteId}','${email}','Synthetic Cookie Buyer','active');`);

    const malformedOnly = await gateway.request('/v1/storefront/customer/profile', {
        headers: { Cookie: `${LETBUYY_CUSTOMER_SESSION_COOKIE}=%` },
    });
    assert.equal(malformedOnly.status, 401);

    const session = await issueCustomerSession({ storeId: site.siteId, customerId }, sessionSecret);
    const malformedWithValidHeader = await gateway.request('/v1/storefront/customer/profile', {
        headers: {
            Cookie: `${LETBUYY_CUSTOMER_SESSION_COOKIE}=%`,
            'X-LetBuyy-Customer-Session': session.token,
        },
    });
    assert.equal(malformedWithValidHeader.status, 200);
    assert.equal(malformedWithValidHeader.json?.data?.customer?.id, customerId);
});

test('real Gateway enforces each configured customer-session compatibility mode', async () => {
    const customerId = crypto.randomUUID();
    const email = `profile-format-${crypto.randomUUID()}@example.invalid`;
    psql(`INSERT INTO store_customers (id,store_id,email,full_name,status) VALUES ('${customerId}','${site.siteId}','${email}','Synthetic Format Buyer','active');`);

    const gatewayToken = (await issueCustomerSession({ storeId: site.siteId, customerId }, sessionSecret)).token;
    const legacyToken = await createCustomerSessionToken({
        id: customerId,
        storeId: site.siteId,
        email,
        fullName: 'Synthetic Format Buyer',
    }, sessionSecret);
    const legacyConsumers = [
        { name: 'profile', path: '/v1/storefront/customer/profile' },
        {
            name: 'wishlist',
            path: `/v1/storefront/customer/wishlist?store_id=${site.siteId}&customer_id=${customerId}`,
        },
        { name: 'addresses', path: `/v1/storefront/customer/addresses?store_id=${site.siteId}` },
        { name: 'orders', path: `/v1/storefront/customer/orders?store_id=${site.siteId}` },
    ] as const;
    const formats = [
        { name: 'gateway_hs256_v1', token: gatewayToken },
        { name: 'shopper_hs256_legacy', token: legacyToken },
    ] as const;
    const policies: Array<{ name: string; value: string | undefined; accepted: string | null }> = [
        { name: 'default dual-format bridge', value: undefined, accepted: 'both' },
        { name: 'explicit dual-format bridge', value: 'both', accepted: 'both' },
        { name: 'gateway-only', value: 'gateway_hs256_v1', accepted: 'gateway_hs256_v1' },
        { name: 'legacy-only', value: 'shopper_hs256_legacy', accepted: 'shopper_hs256_legacy' },
        { name: 'disabled', value: 'disabled', accepted: null },
        { name: 'invalid fails closed', value: 'invalid', accepted: null },
    ];

    for (const policy of policies) {
        const env = gatewayEnv(owned, keys, {
            CUSTOMER_SESSION_SECRET: sessionSecret,
            FEATURE_GRAPHQL: 'true',
            ...(policy.value === undefined ? {} : { CUSTOMER_SESSION_COMPATIBILITY: policy.value }),
        });
        if (policy.value === undefined) env.CUSTOMER_SESSION_COMPATIBILITY = undefined;

        for (const format of formats) {
            const accepted = policy.accepted === 'both' || policy.accepted === format.name;
            for (const consumer of legacyConsumers) {
                const response = await gateway.request(consumer.path, {
                    headers: { Cookie: `${LETBUYY_CUSTOMER_SESSION_COOKIE}=${format.token}` },
                }, env);
                assert.equal(
                    response.status,
                    accepted ? 200 : 401,
                    `${policy.name} / ${format.name} / ${consumer.name}`,
                );
                if (accepted && consumer.name === 'profile') {
                    assert.equal(response.json?.data?.customer?.id, customerId);
                } else if (!accepted) {
                    assert.equal(response.json?.error?.code, 'CUSTOMER_SESSION_REQUIRED');
                }
            }
        }
    }
});

test('customer-session verifier transition can be rolled back to the dual-format bridge', async () => {
    const customerId = crypto.randomUUID();
    const email = `profile-format-rollback-${crypto.randomUUID()}@example.invalid`;
    psql(`INSERT INTO store_customers (id,store_id,email,full_name,status) VALUES ('${customerId}','${site.siteId}','${email}','Synthetic Rollback Buyer','active');`);

    const gatewayToken = (await issueCustomerSession({ storeId: site.siteId, customerId }, sessionSecret)).token;
    const legacyToken = await createCustomerSessionToken({
        id: customerId,
        storeId: site.siteId,
        email,
        fullName: 'Synthetic Rollback Buyer',
    }, sessionSecret);
    const requestProfile = (token: string, policy: string) => gateway.request('/v1/storefront/customer/profile', {
        headers: { Cookie: `${LETBUYY_CUSTOMER_SESSION_COOKIE}=${token}` },
    }, gatewayEnv(owned, keys, {
        CUSTOMER_SESSION_SECRET: sessionSecret,
        CUSTOMER_SESSION_COMPATIBILITY: policy,
    }));

    // Baseline: both outstanding formats work before the hypothetical transition.
    for (const [name, token] of [['Gateway', gatewayToken], ['legacy shopper', legacyToken]] as const) {
        const response = await requestProfile(token, 'both');
        assert.equal(response.status, 200, `${name} session should work before transition`);
    }

    // Strict-mode rehearsal: only the current Gateway format is accepted.
    const strictGateway = await requestProfile(gatewayToken, 'gateway_hs256_v1');
    assert.equal(strictGateway.status, 200);
    const strictLegacy = await requestProfile(legacyToken, 'gateway_hs256_v1');
    assert.equal(strictLegacy.status, 401, 'legacy session must be denied during strict-mode rehearsal');

    // Rollback: restoring the recorded dual-format setting revives still-valid legacy sessions.
    for (const [name, token] of [['Gateway', gatewayToken], ['legacy shopper', legacyToken]] as const) {
        const response = await requestProfile(token, 'both');
        assert.equal(response.status, 200, `${name} session should recover after verifier rollback`);
        assert.equal(response.json?.data?.customer?.id, customerId);
    }
});

test('the active Gateway password-login issuer creates a store-scoped session accepted by the normal profile route', async () => {
    const customerId = crypto.randomUUID();
    const email = `profile-login-${crypto.randomUUID()}@example.invalid`;
    const password = 'Synthetic-Password-42';
    const passwordHash = await bcrypt.hash(password, 4);
    psql(`INSERT INTO store_customers (id,store_id,email,full_name,phone,status,password_hash)
        VALUES ('${customerId}','${site.siteId}','${email}','Synthetic Login Buyer','+919000000222','active','${passwordHash}');
        INSERT INTO customer_credentials (store_id,email_or_phone,password_hash)
        VALUES ('${site.siteId}','${email}','${passwordHash}');`);

    const login = await gateway.request('/v1/storefront/customer/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: site.siteId, email, password, turnstile_token: 'dev-bypass-token' }),
    }, gatewayEnv(owned, keys, { CUSTOMER_SESSION_SECRET: sessionSecret, ENVIRONMENT: 'local' }));
    assert.equal(login.status, 200, login.text);
    assert.equal(login.json?.data?.customer?.id, customerId);
    assert.doesNotMatch(login.text, /password_hash|password|credential/i);

    const cookieHeader = login.headers.get('set-cookie') ?? '';
    const sessionToken = cookieHeader.match(new RegExp(`${LETBUYY_CUSTOMER_SESSION_COOKIE}=([^;,]+)`))?.[1];
    assert.ok(sessionToken, 'a successful legacy login must issue the scoped compatibility cookie');
    const profile = await gateway.request('/v1/storefront/customer/profile', {
        headers: { Cookie: `${LETBUYY_CUSTOMER_SESSION_COOKIE}=${sessionToken}` },
    });
    assert.equal(profile.status, 200);
    assert.equal(profile.json?.data?.customer?.id, customerId);
    assert.equal(profile.json?.data?.customer?.email, email);

    const crossStoreWishlist = await gateway.request(
        `/v1/storefront/customer/wishlist?store_id=${otherSite.siteId}&customer_id=${customerId}`,
        { headers: { Cookie: `${LETBUYY_CUSTOMER_SESSION_COOKIE}=${sessionToken}` } },
    );
    assert.equal(crossStoreWishlist.status, 403,
        'the real login-issued session must not authorize a caller-selected different storefront');
});

test('Commerce host-only shopper sessions are accepted by the real Gateway profile route and stay store-scoped', async () => {
    const customerId = crypto.randomUUID();
    const email = `profile-shopper-session-${crypto.randomUUID()}@example.invalid`;
    psql(`INSERT INTO store_customers (id,store_id,email,full_name,status)
        VALUES ('${customerId}','${site.siteId}','${email}','Synthetic Shopper Session Buyer','active');`);

    const shopperProvider = createHostOnlyShopperIdentityProvider(sessionSecret);
    const token = await shopperProvider.issueSessionToken({
        id: customerId,
        storeId: site.siteId,
        email,
        fullName: 'Synthetic Shopper Session Buyer',
    });
    const cookie = `${shopperProvider.cookie.name}=${token}`;

    const profile = await gateway.request('/v1/storefront/customer/profile', {
        headers: { Cookie: cookie },
    });
    assert.equal(profile.status, 200, profile.text);
    assert.equal(profile.json?.data?.customer?.id, customerId);
    assert.equal(profile.json?.data?.customer?.email, email);

    const crossStoreWishlist = await gateway.request(
        `/v1/storefront/customer/wishlist?store_id=${otherSite.siteId}&customer_id=${customerId}`,
        { headers: { Cookie: cookie } },
    );
    assert.equal(crossStoreWishlist.status, 403,
        'a Commerce shopper-format session must not authorize another storefront');
});

test('real Next Commerce login cookie completes a session and profile read through the real Gateway worker', async () => {
    const identityOrigin = `http://localhost:${await reserveLocalPort()}`;
    const customerId = crypto.randomUUID();
    const priceHistoryProductId = crypto.randomUUID();
    const staleWishlistProductId = crypto.randomUUID();
    const originControlProductId = crypto.randomUUID();
    const supportSubject = `owned support ${crypto.randomUUID()}`;
    const supportBody = `Owned complaint copy ${crypto.randomUUID()}`;
    const addressName = 'Synthetic Browser Address Buyer';
    const addressLine1 = `789 E2E Market ${crypto.randomUUID().slice(0, 8)}`;
    const addressUpdatedLine1 = `${addressLine1}, Updated Unit`;
    const tabSwitchAddressLine1 = `Synthetic stale buyer address ${crypto.randomUUID().slice(0, 10)}`;
    const smallVariantId = crypto.randomUUID();
    const largeVariantId = crypto.randomUUID();
    const email = `profile-next-runtime-${crypto.randomUUID()}@example.invalid`;
    const tabSwitchEmail = `profile-tab-switch-${crypto.randomUUID()}@example.invalid`;
    const buyer = seedBuyerAccount(psql, 'profile-pkce-link');
    const tabSwitchBuyer = seedBuyerAccount(psql, 'profile-pkce-tab-switch');
    const { orderId: buyerOrderId } = seedSyntheticOrder(psql, site);
    psql(`INSERT INTO buyer_order_links (order_id,buyer_account_id,site_id,link_basis,linked_at)
      VALUES ('${buyerOrderId}','${buyer.id}','${site.siteId}','authenticated_checkout',now());`);
    const buyerOrderNumber = psql(`SELECT order_number FROM orders WHERE id='${buyerOrderId}';`);
    assert.ok(buyerOrderNumber, 'the browser order fixture has a rendered order number');
    const password = 'Synthetic-Password-42';
    const resetToken = `synthetic-reset-${crypto.randomUUID()}-${crypto.randomUUID()}`;
    const resetTokenHash = createHmac('sha256', sessionSecret)
        .update(`customer-password-reset.${site.siteId}.${email}.${resetToken}`)
        .digest('hex');
    const passwordHash = await bcrypt.hash(password, 4);
    psql(`UPDATE buyer_accounts
             SET email='${email}', email_verified=true, email_verified_at=now(), password_hash='${passwordHash}'
           WHERE id='${buyer.id}';`);
    psql(`UPDATE buyer_accounts
             SET email='${tabSwitchEmail}', email_verified=true, email_verified_at=now(), password_hash='${passwordHash}'
           WHERE id='${tabSwitchBuyer.id}';`);
    psql(`INSERT INTO store_customers (id,store_id,email,full_name,status,password_hash)
        VALUES ('${customerId}','${site.siteId}','${email}','Synthetic Next Runtime Buyer','active','${passwordHash}');
        INSERT INTO customer_credentials (store_id,email_or_phone,password_hash,reset_token_hash,reset_expires_at,reset_used_at)
        VALUES ('${site.siteId}','${email}','${passwordHash}','${resetTokenHash}',now() + interval '5 minutes',NULL);`);
    psql(`INSERT INTO products (id,site_id,store_id,name,slug,description,price,compare_price,images,stock,is_active,status,country_of_origin,importer_details)
        VALUES ('${priceHistoryProductId}','${site.siteId}','${site.siteId}','Synthetic Price History Product',
          'synthetic-price-history-${priceHistoryProductId.slice(0, 8)}','Owned Gateway and Chromium price fixture',150,999,
          ARRAY[]::text[],20,true,'active','Japan','Example Imports Pvt Ltd, Mumbai, Maharashtra'),
               ('${staleWishlistProductId}','${site.siteId}','${site.siteId}','Synthetic Stale Wishlist Product',
          'synthetic-stale-wishlist-${staleWishlistProductId.slice(0, 8)}','Owned stale wishlist race fixture',99,NULL,
          ARRAY[]::text[],10,true,'active','India',NULL),
               ('${originControlProductId}','${site.siteId}','${site.siteId}','Synthetic Origin Control Product',
        'synthetic-origin-control-${originControlProductId.slice(0, 8)}','Owned origin-filter negative control',99,NULL,
          ARRAY[]::text[],10,true,'active','India',NULL);
        INSERT INTO product_variants (id,product_id,title,price,compare_price,inventory_qty,option1,position)
        VALUES ('${smallVariantId}','${priceHistoryProductId}','Small',150,999,8,'Small',1),
               ('${largeVariantId}','${priceHistoryProductId}','Large',200,999,3,'Large',2);`);
    psql(`UPDATE product_price_observations SET observed_at=now()-interval '31 days'
        WHERE product_id='${priceHistoryProductId}' AND offer_channel='storefront';`);
    psql(`UPDATE products SET price=120 WHERE id='${priceHistoryProductId}';`);
    psql(`UPDATE product_variants SET price=110 WHERE id='${smallVariantId}';`);
    psql(`UPDATE product_variants SET price=160 WHERE id='${largeVariantId}';`);

    const runtimeGateway = new Gateway(gatewayEnv(owned, keys, {
        CUSTOMER_SESSION_SECRET: sessionSecret,
        ENVIRONMENT: 'local',
        LETBUYY_IDENTITY_ISSUER: identityOrigin,
        NEXT_PUBLIC_STORE_ROOT_DOMAIN: 'localhost',
    }));
    const resolvedBeforeProxy = await runtimeGateway.request(
        `/v1/internal/store-access/resolve?host=${encodeURIComponent(`${site.subdomain}.localhost`)}`,
        { headers: { 'X-Internal-API-Secret': INTERNAL_SECRET } },
    );
    assert.equal(resolvedBeforeProxy.status, 200, resolvedBeforeProxy.text);
    const productListAdapterTrace: Array<{ url: string; status: number }> = [];
    const wishlistAdapterTrace: Array<{ method: string; url: string; status: number }> = [];
    const productListRestErrorTrace: Array<{ resource: string; query: string; status: number; body: string }> = [];
    const productListRestTap = tapRest(owned.restUrl, async (call, forward) => {
        const result = await forward();
        if (call.resource === 'products' && result.status >= 400) {
            productListRestErrorTrace.push({
                resource: call.resource,
                query: call.search.toString(),
                status: result.status,
                body: (await result.clone().text()).slice(0, 1000),
            });
        }
        return result;
    });
    const adapter = createServer(async (request, response) => {
        const chunks: Buffer[] = [];
        for await (const chunk of request) chunks.push(Buffer.from(chunk));
        const body = Buffer.concat(chunks).toString('utf8');
        const headers = new Headers();
        for (const [name, value] of Object.entries(request.headers)) {
            if (typeof value === 'string' && !['host', 'connection', 'content-length', 'transfer-encoding', 'accept-encoding'].includes(name)) {
                headers.set(name, value);
            }
        }
        try {
            const result = await runtimeGateway.request(request.url || '/', {
                method: request.method || 'GET',
                headers,
                ...(['GET', 'HEAD'].includes(request.method || 'GET') || !body ? {} : { body }),
            });
            if ((request.url || '').includes('/storefront/') && (request.url || '').includes('/products')) {
                productListAdapterTrace.push({ url: request.url || '/', status: result.status });
            }
            if ((request.url || '').includes('/storefront/buyer/wishlist')) {
                wishlistAdapterTrace.push({ method: request.method || 'GET', url: request.url || '/', status: result.status });
            }
            const cacheControl = result.headers.get('cache-control');
            response.writeHead(result.status, {
                'content-type': result.headers.get('content-type') || 'application/json',
                ...(cacheControl ? { 'cache-control': cacheControl } : {}),
            });
            response.end(result.text);
        } catch {
            response.writeHead(502, { 'content-type': 'application/json' });
            response.end(JSON.stringify({ error: 'owned Gateway adapter failed' }));
        }
    });
    await new Promise<void>((resolveListen, reject) => {
        adapter.once('error', reject);
        adapter.listen(0, '127.0.0.1', () => resolveListen());
    });
    const adapterAddress = adapter.address();
    assert.ok(adapterAddress && typeof adapterAddress === 'object');
    const baseUrl = `http://127.0.0.1:${adapterAddress.port}/v1`;
    const buyerSessionToken = await mintSession(keys, buyer.id, { issuer: identityOrigin });
    const identityPrivateJwk = JSON.stringify({ ...(await exportJWK(keys.privateKey)), alg: 'ES256', kid: keys.kid });
    const runtime = startOwnedClientRuntime(owned, 'commerce-session-smoke', {
        env: {
            LETBUYY_SESSION_RUNTIME_GATEWAY_URL: baseUrl,
            LETBUYY_SESSION_RUNTIME_STORE_A_ID: site.siteId,
            LETBUYY_SESSION_RUNTIME_STORE_B_ID: otherSite.siteId,
            LETBUYY_SESSION_RUNTIME_STORE_A_HOSTNAME: site.subdomain,
            LETBUYY_SESSION_RUNTIME_STORE_B_HOSTNAME: otherSite.subdomain,
            LETBUYY_SESSION_RUNTIME_STORE_A_NAME: `Synthetic ${site.tag}`,
            LETBUYY_SESSION_RUNTIME_STORE_ROOT_DOMAIN: 'localhost',
            LETBUYY_SESSION_RUNTIME_CUSTOMER_ID: customerId,
            LETBUYY_SESSION_RUNTIME_EMAIL: email,
            LETBUYY_SESSION_RUNTIME_PASSWORD: password,
            LETBUYY_SESSION_RUNTIME_RESET_TOKEN: resetToken,
            LETBUYY_SESSION_RUNTIME_SESSION_SECRET: sessionSecret,
            LETBUYY_SESSION_RUNTIME_INTERNAL_SECRET: INTERNAL_SECRET,
            LETBUYY_SESSION_RUNTIME_BUYER_ID: buyer.id,
            LETBUYY_SESSION_RUNTIME_TAB_SWITCH_BUYER_ID: tabSwitchBuyer.id,
            LETBUYY_SESSION_RUNTIME_TAB_SWITCH_EMAIL: tabSwitchEmail,
            LETBUYY_SESSION_RUNTIME_TAB_SWITCH_PASSWORD: password,
            LETBUYY_SESSION_RUNTIME_BUYER_ORDER_ID: buyerOrderId,
            LETBUYY_SESSION_RUNTIME_BUYER_ORDER_NUMBER: buyerOrderNumber,
            LETBUYY_SESSION_RUNTIME_TAB_SWITCH_ADDRESS_LINE1: tabSwitchAddressLine1,
            LETBUYY_SESSION_RUNTIME_BUYER_SESSION_TOKEN: buyerSessionToken,
            LETBUYY_SESSION_RUNTIME_IDENTITY_PRIVATE_JWK: identityPrivateJwk,
            LETBUYY_SESSION_RUNTIME_IDENTITY_KID: keys.kid,
            LETBUYY_SESSION_RUNTIME_IDENTITY_PORT: new URL(identityOrigin).port,
            LETBUYY_SESSION_RUNTIME_PRICE_HISTORY_PRODUCT_ID: priceHistoryProductId,
            LETBUYY_SESSION_RUNTIME_STALE_WISHLIST_PRODUCT_ID: staleWishlistProductId,
            LETBUYY_SESSION_RUNTIME_ORIGIN_CONTROL_PRODUCT_ID: originControlProductId,
            LETBUYY_SESSION_RUNTIME_PRICE_HISTORY_SMALL_VARIANT_ID: smallVariantId,
            LETBUYY_SESSION_RUNTIME_PRICE_HISTORY_LARGE_VARIANT_ID: largeVariantId,
            LETBUYY_SESSION_RUNTIME_SUPPORT_SUBJECT: supportSubject,
            LETBUYY_SESSION_RUNTIME_SUPPORT_BODY: supportBody,
            LETBUYY_SESSION_RUNTIME_ADDRESS_NAME: addressName,
            LETBUYY_SESSION_RUNTIME_ADDRESS_LINE1: addressLine1,
            LETBUYY_SESSION_RUNTIME_ADDRESS_UPDATED_LINE1: addressUpdatedLine1,
            LETBUYY_SESSION_RUNTIME_TURNSTILE_TOKEN: 'dev-bypass-token',
            LETBUYY_SESSION_RUNTIME_BROWSER: '1',
            LETBUYY_SESSION_RUNTIME_BUYER_CREDENTIAL_BROWSER: '1',
            INTERNAL_API_SECRET: INTERNAL_SECRET,
            CUSTOMER_SESSION_SECRET: sessionSecret,
            NEXT_PUBLIC_STORE_ROOT_DOMAIN: 'localhost',
        },
    });
    let output = '';
    const stages = new Set<string>();
    const capture = (chunk: Buffer) => {
        const combined = output + chunk.toString();
        for (const match of combined.matchAll(/(?:RUNTIME_STEP|RESET_FLOW|BROWSER_STEP):([a-z0-9-]+)/g)) stages.add(match[1]);
        output = combined.slice(-16000);
    };
    runtime.stdout.on('data', capture);
    runtime.stderr.on('data', capture);
    try {
        const exitCode = await new Promise<number>((resolveExit, reject) => {
            const timeout = setTimeout(() => {
                const resetSteps = [...output.matchAll(/RESET_FLOW:([a-z0-9-]+)/g)].map(match => match[1]).join(' → ') || 'none';
                const browserSteps = [...output.matchAll(/BROWSER_STEP:([a-z0-9-]+)/g)].map(match => match[1]).join(' → ') || 'none';
                reject(new Error(`Commerce + Identity session runtime exceeded 330 seconds; stages: ${[...stages].join(' → ')}; reset steps: ${resetSteps}; browser steps: ${browserSteps}`));
            }, 330_000);
            runtime.once('error', error => { clearTimeout(timeout); reject(error); });
            runtime.once('exit', code => { clearTimeout(timeout); resolveExit(code ?? 1); });
        });
        assert.equal(exitCode, 0, `${output}\nProduct-list adapter trace: ${JSON.stringify(productListAdapterTrace)}\nPostgREST error trace: ${JSON.stringify(productListRestErrorTrace)}`);
        assert.match(output, /actual owned Gateway worker reached through the local test adapter/);
        assert.match(output, /local Identity Next\.js dev server/);
        assert.match(output, /Chromium Identity email\/password login, consent/);
        assert.match(output, /PKCE callback, host-only buyer cookie and sibling-store refusal/);
        assert.match(output, /legacy Account Settings link, verified-email callback, legacy-cookie retirement and sibling-store denial/);
        assert.match(output, /Chromium password-reset redemption scrubs the one-time token, issues a store-customer session, reads the real Gateway profile and rejects replay/);
        assert.match(output, /Chromium storefront country-origin filter and clear use the actual Gateway response/);
        assert.match(output, /storefront list, product detail and selected-variant prices match the actual owned Gateway payload/);
        assert.match(output, /Importer disclosure renders on the real storefront product detail from the owned Gateway response/);
        assert.match(output, /Chromium product-detail wishlist mutation appears in the account wishlist through the actual owned Gateway and Postgres/);
        assert.match(output, /Chromium cross-tab buyer address write rejects a stale buyer-A draft under buyer-B cookie before revalidation; owned Postgres confirms no address row is written/);
        assert.match(output, /Chromium buyer-switch order list and detail hide buyer-A order data while revalidating and reload as buyer B/);
        assert.match(output, /Chromium signed-buyer support form records a complaint, displays its persisted copy and reference, loads the public conversation and sends a reply/);
        assert.match(output, /Chromium buyer-switch support hides buyer-A tickets, messages and drafts during revalidation and ignores a delayed private response/);
        assert.match(output, /Chromium same-origin legacy customer address form rejects cross-site writes and creates\/edits a default address through the real Gateway/);
        const supportRow = psql(`SELECT json_build_object('requester_user_id',requester_user_id,'requester_type',requester_type,'channel',channel,'body',(SELECT body FROM ticket_messages WHERE ticket_id=support_tickets.id AND visibility='public' AND deleted_at IS NULL ORDER BY created_at LIMIT 1)) FROM support_tickets WHERE site_id='${site.siteId}' AND subject='${supportSubject}' AND deleted_at IS NULL;`);
        assert.notEqual(supportRow, '', 'the buyer submission should create exactly one support ticket');
        const persistedSupport = JSON.parse(supportRow);
        assert.equal(persistedSupport.requester_user_id, buyer.id);
        assert.equal(persistedSupport.requester_type, 'customer');
        assert.equal(persistedSupport.channel, 'chat');
        assert.equal(persistedSupport.body, supportBody, 'the receipt copy and canonical support message agree in owned Postgres');
        const supportOwnership = JSON.parse(psql(`SELECT json_build_object(
          'buyerA',(SELECT count(*) FROM support_tickets WHERE site_id='${site.siteId}' AND requester_user_id='${buyer.id}' AND subject='${supportSubject}' AND deleted_at IS NULL),
          'buyerB',(SELECT count(*) FROM support_tickets WHERE site_id='${site.siteId}' AND requester_user_id='${tabSwitchBuyer.id}' AND subject='${supportSubject}' AND deleted_at IS NULL)
        );`));
        assert.deepEqual(supportOwnership, { buyerA: 1, buyerB: 0 }, 'the real support ticket remains owned by buyer A and is never attributed to buyer B');
        const addressRow = psql(`SELECT json_build_object('full_name',full_name,'address_line1',address_line1,'city',city,'state',state,'postal_code',postal_code,'is_default',is_default) FROM customer_addresses WHERE store_id='${site.siteId}' AND lower(customer_email)='${email.toLowerCase()}' AND address_line1='${addressUpdatedLine1}';`);
        assert.notEqual(addressRow, '', 'the normal account address form should create and update through the real Gateway');
        const persistedAddress = JSON.parse(addressRow);
        assert.equal(persistedAddress.full_name, addressName);
        assert.equal(persistedAddress.city, 'Pune');
        assert.equal(persistedAddress.state, 'Maharashtra');
        assert.equal(persistedAddress.postal_code, '411001');
        assert.equal(persistedAddress.is_default, true, 'the explicitly selected default survives address editing');
        const orderOwnership = JSON.parse(psql(`SELECT json_build_object(
          'buyerA',(SELECT count(*) FROM buyer_order_links WHERE order_id='${buyerOrderId}' AND buyer_account_id='${buyer.id}' AND site_id='${site.siteId}'),
          'buyerB',(SELECT count(*) FROM buyer_order_links WHERE order_id='${buyerOrderId}' AND buyer_account_id='${tabSwitchBuyer.id}' AND site_id='${site.siteId}')
        );`));
        assert.deepEqual(orderOwnership, { buyerA: 1, buyerB: 0 }, 'the cross-tab read journey cannot move or duplicate the explicit order owner');
        assert.match(output, /Chromium cross-tab buyer review write refuses a stale buyer-A draft under buyer-B cookie before revalidation; owned Postgres confirms no review is persisted/);
        assert.match(output, /Chromium cross-tab buyer wishlist mutation refuses a stale buyer-A action under buyer-B cookie before revalidation; owned Postgres confirms the buyer-A row remains unchanged/);
        if (tabSwitchEmail) {
            const staleReviewCount = psql(`SELECT count(*) FROM product_reviews WHERE product_id='${priceHistoryProductId}' AND lower(customer_email) IN ('${email.toLowerCase()}','${tabSwitchEmail.toLowerCase()}');`);
            assert.equal(staleReviewCount, '0', 'a buyer-A draft submitted under buyer B must not create a review for either account');
        }
        assert.match(output, /Chromium cross-tab buyer profile write rejects a stale buyer-A draft under buyer-B cookie before revalidation; owned Postgres confirms neither buyer profile changes/);
        const staleProfileState = JSON.parse(psql(`SELECT json_build_object(
            'buyerA',(SELECT full_name FROM buyer_accounts WHERE id='${buyer.id}'),
            'buyerB',(SELECT full_name FROM buyer_accounts WHERE id='${tabSwitchBuyer.id}')
        );`));
        assert.deepEqual(staleProfileState, { buyerA: null, buyerB: null },
            'the stale buyer-A profile draft must not mutate either buyer in owned Postgres');
        assert.equal(psql(`SELECT count(*) FROM buyer_addresses WHERE buyer_account_id IN ('${buyer.id}','${tabSwitchBuyer.id}') AND address_line1='${tabSwitchAddressLine1}';`), '0',
            'the rejected buyer-A draft must not be inserted into either buyer account in owned Postgres');
        const staleWishlistState = JSON.parse(psql(`SELECT json_build_object(
            'buyerA',(SELECT count(*) FROM customer_wishlists cw JOIN store_customers sc ON sc.id=cw.customer_id WHERE cw.store_id='${site.siteId}' AND cw.product_id='${staleWishlistProductId}' AND lower(sc.email)='${email.toLowerCase()}'),
            'buyerB',(SELECT count(*) FROM customer_wishlists cw JOIN store_customers sc ON sc.id=cw.customer_id WHERE cw.store_id='${site.siteId}' AND cw.product_id='${staleWishlistProductId}' AND lower(sc.email)='${tabSwitchEmail.toLowerCase()}')
        );`));
        assert.deepEqual(staleWishlistState, { buyerA: 1, buyerB: 0 },
            'the stale buyer-A removal must be rejected without removing A\'s row or writing under B');
        assert.equal(wishlistAdapterTrace.filter((entry) => entry.method === 'DELETE').length, 0,
            'the stale wishlist DELETE is rejected by the Commerce BFF before reaching the Gateway');
        assert.ok(productListAdapterTrace.some((entry) => entry.url.includes(priceHistoryProductId) && entry.status === 200),
            'the product detail page must read the synthetic product through the production Gateway worker');
        assert.ok(wishlistAdapterTrace.some((entry) => entry.method === 'GET' && entry.status === 200),
            'the browser must read the canonical buyer wishlist through the production Gateway worker');
        assert.ok(wishlistAdapterTrace.some((entry) => entry.method === 'POST' && entry.status === 200),
            'the product-detail mutation must reach the production Gateway worker successfully');
        assert.equal(psql(`SELECT count(*) FROM customer_wishlists WHERE customer_id=(SELECT store_customer_id FROM buyer_store_customers WHERE buyer_account_id='${buyer.id}' AND site_id='${site.siteId}' AND link_basis='verified_email') AND store_id='${site.siteId}' AND product_id='${priceHistoryProductId}';`), '1',
            'the browser-confirmed saved product must exist under the verified buyer/store-customer link in owned Postgres');
    } finally {
        await stopOwnedClientRuntime(runtime);
        productListRestTap.restore();
        await new Promise<void>(resolveClose => adapter.close(() => resolveClose()));
        await runtimeGateway.settle();
    }
});

test('atomic buyer intake rolls back its ticket when the first complaint insert fails', async () => {
    const buyer = seedBuyerAccount(psql, 'support-atomic-rollback');
    const subject = `Synthetic atomic rollback ${crypto.randomUUID()}`;
    const body = `Synthetic forced failure ${crypto.randomUUID()}`;
    const triggerSuffix = crypto.randomUUID().replace(/-/g, '');
    const functionName = `reject_buyer_support_${triggerSuffix}`;
    const triggerName = `reject_buyer_support_${triggerSuffix}`;

    psql(`CREATE FUNCTION public.${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.body = '${body}' THEN RAISE EXCEPTION 'synthetic complaint insert failure' USING ERRCODE = '23514'; END IF; RETURN NEW; END; $$; CREATE TRIGGER ${triggerName} BEFORE INSERT ON public.ticket_messages FOR EACH ROW EXECUTE FUNCTION public.${functionName}();`);
    try {
        const response = await gateway.request('/v1/storefront/buyer/support/tickets', {
            method: 'POST',
            headers: await buyerHeaders(keys, buyer.id),
            body: JSON.stringify({ subject, body, site_id: site.siteId }),
        });
        assert.equal(response.status, 500);
        assert.doesNotMatch(response.text, /synthetic complaint insert failure|23514/,
            'database fault details must not escape the public support API');
        const tickets = psql(`SELECT count(*) FROM support_tickets WHERE requester_user_id='${buyer.id}' AND subject='${subject}';`);
        const messages = psql(`SELECT count(*) FROM ticket_messages WHERE body='${body}';`);
        assert.equal(tickets, '0', 'the failed first message must roll back its newly created ticket');
        assert.equal(messages, '0', 'the failed complaint must leave no message row');
    } finally {
        psql(`DROP TRIGGER IF EXISTS ${triggerName} ON public.ticket_messages; DROP FUNCTION IF EXISTS public.${functionName}();`);
    }
});
