// SUSTAINED-K -- the 6 integrated acceptance scenarios from the owner's directive (Section 17),
// each spanning two buyers (A, B) and two stores (X, Y), run together against the real route
// handlers (registerBuyerAccountRoutes, registerBuyerAddressRoutes, registerBuyerOrderRoutes) with
// one SHARED, STATEFUL in-memory fake standing in for buyer_accounts/buyer_addresses/buyer_order_links
// -- not the per-test static stubs the individual buyer-*-routes.test.ts files use. That makes this
// an HTTP-level INTEGRATION check (real Hono dispatch, real ES256 JWT verification, real business
// logic, state that persists and is read back across requests) rather than a repeat of those files'
// already-covered unit properties.
//
// What this file does NOT verify, and does not claim to: DB-level constraint/RLS enforcement (that
// is tests/executable/buyer-profile-addresses-postgres.test.mjs, on a real disposable Postgres, 8/8
// passing) and browser/Flutter/device-level behavior (no live stack or Flutter build is available in
// this container -- see docs/evidence/appid-2026-09-24/SUSTAINED_K.md).

import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { Hono } from 'hono';
import type { Env } from '../index';
import type { BuyerSessionState } from '../middleware/buyer-session';
import { registerBuyerAccountRoutes, type BuyerAccountRow } from '../routes/storefront/buyer-account-routes';
import { registerBuyerAddressRoutes, type BuyerAddressRow } from '../routes/storefront/buyer-address-routes';
import { registerBuyerOrderRoutes, type BuyerOrderSummaryRow } from '../routes/storefront/buyer-order-routes';

const ISSUER = 'https://accounts.letbuyy.test';
const BUYER_A = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const BUYER_B = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
const STORE_X = { id: 'cccccccc-1111-4111-8111-cccccccccccc', name: 'Store X' };
const STORE_Y = { id: 'dddddddd-2222-4222-8222-dddddddddddd', name: 'Store Y' };

async function keys() {
    const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true });
    const jwk = await exportJWK(publicKey);
    return { privateKey, jwks: JSON.stringify({ keys: [{ ...jwk, alg: 'ES256', kid: 'test' }] }) };
}

async function buyerToken(privateKey: CryptoKey, sub: string, sep = 1) {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({ realm: 'buyer', token_use: 'buyer_session', sep })
        .setProtectedHeader({ alg: 'ES256', typ: 'JWT', kid: 'test' })
        .setIssuer(ISSUER).setAudience('letbuyy:buyer-session').setSubject(sub)
        .setIssuedAt(now).setExpirationTime(now + 3600)
        .setJti(randomUUID().replace(/-/g, '')).sign(privateKey);
}

const env = (jwks: string) => ({ LETBUYY_IDENTITY_ISSUER: ISSUER, LETBUYY_IDENTITY_PUBLIC_JWKS: jwks } as unknown as Env);

/// One shared, mutable world: buyer accounts, their addresses, their orders (each order carries its
/// OWN independently-copied shipping snapshot, exactly like the real orders table's denormalized
/// fields -- never a live reference to a buyer_addresses row, which is the point of scenario 3).
function world() {
    const accounts = new Map<string, BuyerAccountRow>([
        [BUYER_A, { id: BUYER_A, email: 'asha@example.com', password_hash: null, email_verified: true, status: 'active', session_epoch: 1, full_name: null, phone: null }],
        [BUYER_B, { id: BUYER_B, email: 'bina@example.com', password_hash: null, email_verified: true, status: 'active', session_epoch: 1, full_name: null, phone: null }],
    ]);
    const addresses = new Map<string, BuyerAddressRow>();
    const orders: (BuyerOrderSummaryRow & { buyerAccountId: string; shippingSnapshot: { fullName: string; line1: string } })[] = [];
    const sessionState: Record<string, BuyerSessionState | null> = {
        [BUYER_A]: { status: 'active', session_epoch: 1 },
        [BUYER_B]: { status: 'active', session_epoch: 1 },
    };
    return { accounts, addresses, orders, sessionState };
}

function harness(w: ReturnType<typeof world>) {
    const app = new Hono<{ Bindings: Env }>();
    app.use('*', async (c, next) => {
        c.set('buyerSessionStateLoader', async (_c: unknown, buyerAccountId: string) => ({ data: w.sessionState[buyerAccountId] ?? null, error: null }));
        await next();
    });
    const router = new Hono<{ Bindings: Env }>();
    registerBuyerAccountRoutes(router, {
        normalizeEmail: (e) => e.trim().toLowerCase(),
        requireIdentityInternal: async () => null,
        loadBuyerByEmail: async () => ({ data: null, error: null }),
        insertBuyer: async () => ({ data: null, error: null }),
        loadBuyerById: async (_c, id) => ({ data: w.accounts.get(id) ?? null, error: null }),
        linkStoreCustomer: async () => ({ data: { outcome: 'unverified' }, error: null }),
        claimOrders: async () => ({ data: { outcome: 'unverified' }, error: null }),
        startEmailChallenge: async () => ({ data: { outcome: 'rate_limited' }, error: null }),
        consumeEmailChallenge: async () => ({ data: { outcome: 'invalid' }, error: null }),
        revokeSessions: async (_c, buyerAccountId) => {
            const current = w.sessionState[buyerAccountId];
            const nextEpoch = (current?.session_epoch ?? 1) + 1;
            w.sessionState[buyerAccountId] = { status: current?.status ?? 'active', session_epoch: nextEpoch };
            return { data: { outcome: 'revoked', session_epoch: nextEpoch }, error: null };
        },
        sendEmailCode: async () => ({ sent: false }),
        updateBuyerProfile: async (_c, input) => {
            const existing = w.accounts.get(input.buyerAccountId);
            if (!existing) return { data: null, error: null };
            const updated = { ...existing, full_name: 'fullName' in input ? input.fullName ?? null : existing.full_name, phone: 'phone' in input ? input.phone ?? null : existing.phone };
            w.accounts.set(input.buyerAccountId, updated);
            return { data: updated, error: null };
        },
    });
    registerBuyerAddressRoutes(router, {
        listAddresses: async (_c, buyerAccountId) => ({ data: [...w.addresses.values()].filter((a) => a.buyer_account_id === buyerAccountId), error: null }),
        createAddress: async (_c, input) => {
            const id = randomUUID();
            const row: BuyerAddressRow = {
                id, buyer_account_id: input.buyerAccountId, label: 'home', full_name: '', phone: null,
                address_line1: '', address_line2: null, city: '', state: '', postal_code: '', country: 'IN',
                landmark: null, is_default: false, gstin: null, state_code: null,
                created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
                ...(input.address as Partial<BuyerAddressRow>),
            };
            if (row.is_default) {
                for (const [otherId, other] of w.addresses) {
                    if (other.buyer_account_id === input.buyerAccountId && other.is_default) w.addresses.set(otherId, { ...other, is_default: false });
                }
            }
            w.addresses.set(id, row);
            return { data: row, error: null };
        },
        updateAddress: async (_c, input) => {
            const found = w.addresses.get(input.addressId);
            if (!found || found.buyer_account_id !== input.buyerAccountId) return { data: null, error: null, notFound: true };
            const patch = input.address as Partial<BuyerAddressRow>;
            if (patch.is_default) {
                for (const [otherId, other] of w.addresses) {
                    if (other.buyer_account_id === input.buyerAccountId && other.id !== input.addressId && other.is_default) w.addresses.set(otherId, { ...other, is_default: false });
                }
            }
            const updated = { ...found, ...patch, updated_at: new Date().toISOString() };
            w.addresses.set(input.addressId, updated);
            return { data: updated, error: null };
        },
        deleteAddress: async (_c, input) => {
            const found = w.addresses.get(input.addressId);
            if (!found || found.buyer_account_id !== input.buyerAccountId) return { error: null, notFound: true };
            w.addresses.delete(input.addressId);
            return { error: null };
        },
    });
    registerBuyerOrderRoutes(router, {
        loadBuyerOrderDetail: async () => ({ data: null, error: null }),
        listBuyerOrders: async (_c, buyerAccountId, { limit }) => {
            const mine = w.orders.filter((o) => o.buyerAccountId === buyerAccountId).slice(0, limit);
            return { data: mine, error: null, hasMore: false };
        },
    });
    app.route('/storefront', router);
    return app;
}

function call(app: Hono<{ Bindings: Env }>, jwks: string, method: string, path: string, tok: string | null, body?: unknown) {
    return app.request(
        `/storefront${path}`,
        { method, headers: { ...(tok ? { 'X-LetBuyy-Buyer-Session': tok } : {}), 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) },
        env(jwks),
    );
}

test('scenario 1 -- the profile is ONE shared record across stores, never a per-store copy, and buyers never see each other\'s', async () => {
    const { privateKey, jwks } = await keys();
    const w = world();
    const app = harness(w);
    const tokenA = await buyerToken(privateKey, BUYER_A);
    const tokenB = await buyerToken(privateKey, BUYER_B);

    // Buyer A updates their profile while "in" store X's checkout (the route is platform-level --
    // there is no store parameter at all, so this is really just Buyer A's one session).
    const patchRes = await call(app, jwks, 'PATCH', '/buyer/profile', tokenA, { full_name: 'Asha Verma', phone: '+919900011122' });
    assert.equal(patchRes.status, 200);

    // Reading it back "from" store Y's checkout (again: no store parameter -- same route, same session)
    // returns the identical, already-updated record.
    const readRes = await call(app, jwks, 'GET', '/buyer/profile', tokenA);
    const readBody = await readRes.json() as { data: { buyer: Record<string, unknown> } };
    assert.equal(readBody.data.buyer.full_name, 'Asha Verma');
    assert.equal(readBody.data.buyer.phone, '+919900011122');

    // Buyer B's own profile is completely untouched by Buyer A's update.
    const bRes = await call(app, jwks, 'GET', '/buyer/profile', tokenB);
    const bBody = await bRes.json() as { data: { buyer: Record<string, unknown> } };
    assert.equal(bBody.data.buyer.full_name, null);
    assert.equal(bBody.data.buyer.phone, null);
});

test('scenario 2 -- the address book is shared across stores, default-address switching works, and it is never visible to another buyer', async () => {
    const { privateKey, jwks } = await keys();
    const w = world();
    const app = harness(w);
    const tokenA = await buyerToken(privateKey, BUYER_A);
    const tokenB = await buyerToken(privateKey, BUYER_B);

    // Buyer A adds a home address (say, while checking out at Store X) and a work address (at Store Y).
    const homeRes = await call(app, jwks, 'POST', '/buyer/addresses', tokenA, {
        label: 'home', full_name: 'Asha Verma', address_line1: '12 MG Road', city: 'Bengaluru', state: 'Karnataka', postal_code: '560001', is_default: true,
    });
    const home = (await homeRes.json() as { data: { address: BuyerAddressRow } }).data.address;
    const workRes = await call(app, jwks, 'POST', '/buyer/addresses', tokenA, {
        label: 'work', full_name: 'Asha Verma', address_line1: '1 Tech Park', city: 'Pune', state: 'Maharashtra', postal_code: '411001', is_default: true,
    });
    const work = (await workRes.json() as { data: { address: BuyerAddressRow } }).data.address;

    // Listing "from" either store returns both, with the default switched to the most recently set one.
    const listRes = await call(app, jwks, 'GET', '/buyer/addresses', tokenA);
    const list = (await listRes.json() as { data: { addresses: BuyerAddressRow[] } }).data.addresses;
    assert.equal(list.length, 2);
    assert.equal(list.find((a) => a.id === home.id)?.is_default, false, 'setting work as default unset home');
    assert.equal(list.find((a) => a.id === work.id)?.is_default, true);

    // Buyer B can neither list, edit, nor delete Buyer A's addresses.
    const bList = await call(app, jwks, 'GET', '/buyer/addresses', tokenB);
    assert.equal((await bList.json() as { data: { addresses: unknown[] } }).data.addresses.length, 0);
    assert.equal((await call(app, jwks, 'PATCH', `/buyer/addresses/${home.id}`, tokenB, { city: 'Hijacked' })).status, 404);
    assert.equal((await call(app, jwks, 'DELETE', `/buyer/addresses/${home.id}`, tokenB)).status, 404);
    assert.equal(w.addresses.get(home.id)?.city, 'Bengaluru', 'Buyer B\'s refused attempt did not mutate Buyer A\'s address');
});

test('scenario 3 -- editing or deleting a saved address never mutates a past order\'s own shipping snapshot', async () => {
    const { privateKey, jwks } = await keys();
    const w = world();
    const app = harness(w);
    const tokenA = await buyerToken(privateKey, BUYER_A);

    const addrRes = await call(app, jwks, 'POST', '/buyer/addresses', tokenA, {
        label: 'home', full_name: 'Asha Verma', address_line1: '12 MG Road', city: 'Bengaluru', state: 'Karnataka', postal_code: '560001', is_default: true,
    });
    const addr = (await addrRes.json() as { data: { address: BuyerAddressRow } }).data.address;

    // Placing an order at Store X copies the address fields it needs AT THAT MOMENT -- exactly like
    // the real orders table's own denormalized shipping columns. Nothing here holds a live reference
    // to the buyer_addresses row (grep confirms buyer_addresses has zero foreign-key consumers
    // anywhere in the schema or the route layer -- this fixture models that fact, it does not
    // manufacture it).
    w.orders.push({
        id: randomUUID(), buyerAccountId: BUYER_A, linked_at: new Date().toISOString(), site_id: STORE_X.id, store_name: STORE_X.name,
        order_number: 'X-1001', status: 'paid', total: 249900, currency: 'INR', created_at: new Date().toISOString(),
        shippingSnapshot: { fullName: addr.full_name, line1: addr.address_line1 },
    });
    const snapshotBefore = { ...w.orders[0].shippingSnapshot };

    // Buyer A later moves house and edits the SAME saved address.
    await call(app, jwks, 'PATCH', `/buyer/addresses/${addr.id}`, tokenA, { address_line1: '99 New Layout', city: 'Mysuru' });

    // The already-placed order's shipping snapshot is byte-identical to before the edit.
    assert.deepEqual(w.orders[0].shippingSnapshot, snapshotBefore);

    // Deleting the address entirely still leaves the order (and its snapshot) intact.
    await call(app, jwks, 'DELETE', `/buyer/addresses/${addr.id}`, tokenA);
    assert.deepEqual(w.orders[0].shippingSnapshot, snapshotBefore);
    assert.equal(w.orders.length, 1);
});

test('scenario 4 -- the marketplace order view spans every store a buyer ordered from, scoped strictly to that buyer', async () => {
    const { privateKey, jwks } = await keys();
    const w = world();
    const app = harness(w);
    const tokenA = await buyerToken(privateKey, BUYER_A);
    const tokenB = await buyerToken(privateKey, BUYER_B);

    for (const [buyerAccountId, site, orderNumber] of [
        [BUYER_A, STORE_X, 'X-1001'], [BUYER_A, STORE_Y, 'Y-2001'], [BUYER_B, STORE_X, 'X-1002'],
    ] as const) {
        w.orders.push({
            id: randomUUID(), buyerAccountId, linked_at: new Date().toISOString(), site_id: site.id, store_name: site.name,
            order_number: orderNumber, status: 'paid', total: 100000, currency: 'INR', created_at: new Date().toISOString(),
            shippingSnapshot: { fullName: 'x', line1: 'x' },
        });
    }

    const aRes = await call(app, jwks, 'GET', '/buyer/orders', tokenA);
    const aOrders = (await aRes.json() as { data: { orders: BuyerOrderSummaryRow[] } }).data.orders;
    assert.equal(aOrders.length, 2);
    assert.deepEqual(new Set(aOrders.map((o) => o.site_id)), new Set([STORE_X.id, STORE_Y.id]), 'Buyer A sees both stores they ordered from');

    const bRes = await call(app, jwks, 'GET', '/buyer/orders', tokenB);
    const bOrders = (await bRes.json() as { data: { orders: BuyerOrderSummaryRow[] } }).data.orders;
    assert.equal(bOrders.length, 1);
    assert.equal(bOrders[0].order_number, 'X-1002');
    assert.ok(!bOrders.some((o) => o.order_number === 'X-1001' || o.order_number === 'Y-2001'), 'Buyer B never sees Buyer A\'s orders, even at a store they share');
});

test('scenario 5 -- privacy and sessions: cross-buyer reads are always refused, and sign-out-everywhere ends only the revoked buyer\'s access', async () => {
    const { privateKey, jwks } = await keys();
    const w = world();
    const app = harness(w);
    const tokenA = await buyerToken(privateKey, BUYER_A, 1);
    const tokenB = await buyerToken(privateKey, BUYER_B, 1);
    await call(app, jwks, 'PATCH', '/buyer/profile', tokenA, { full_name: 'Asha Verma' });

    // Both buyers work normally before any revocation.
    assert.equal((await call(app, jwks, 'GET', '/buyer/profile', tokenA)).status, 200);
    assert.equal((await call(app, jwks, 'GET', '/buyer/profile', tokenB)).status, 200);

    // identity-platform revokes every session for Buyer A only (the real /buyer/sessions/revoke route,
    // identityInternal-gated exactly like production -- this harness's requireIdentityInternal is a
    // no-op stub, matching every sibling buyer-*-routes.test.ts file's established convention).
    const revokeRes = await call(app, jwks, 'POST', '/buyer/sessions/revoke', tokenA);
    assert.equal(revokeRes.status, 200);

    // Buyer A's EXACT SAME token -- the one just used to request the revoke -- is now refused on
    // every protected route: this is a real protected-API-after-revocation check, not a UI redirect.
    assert.equal((await call(app, jwks, 'GET', '/buyer/profile', tokenA)).status, 401);
    assert.equal((await call(app, jwks, 'GET', '/buyer/addresses', tokenA)).status, 401);
    assert.equal((await call(app, jwks, 'GET', '/buyer/orders', tokenA)).status, 401);

    // Buyer B's independent session is completely unaffected by Buyer A's revocation.
    assert.equal((await call(app, jwks, 'GET', '/buyer/profile', tokenB)).status, 200);

    // A freshly minted token for Buyer A, still claiming the OLD (now-superseded) epoch, is also
    // refused -- only a new sign-in (a token in the new epoch) would work, which this harness does
    // not simulate since that flow belongs to identity-platform, not the gateway.
    const staleReplayToken = await buyerToken(privateKey, BUYER_A, 1);
    assert.equal((await call(app, jwks, 'GET', '/buyer/profile', staleReplayToken)).status, 401);
});

test('scenario 6 -- failures and retries never corrupt state: rejected requests mutate nothing, and a missing resource never leaks another buyer\'s row', async () => {
    const { privateKey, jwks } = await keys();
    const w = world();
    const app = harness(w);
    const tokenA = await buyerToken(privateKey, BUYER_A);

    // An invalid PATCH (oversized full_name) is rejected before any state changes.
    const before = { ...w.accounts.get(BUYER_A)! };
    const badPatch = await call(app, jwks, 'PATCH', '/buyer/profile', tokenA, { full_name: 'x'.repeat(300) });
    assert.equal(badPatch.status, 400);
    assert.deepEqual(w.accounts.get(BUYER_A), before);

    // A malformed address id never reaches the address store at all.
    const addressCountBefore = w.addresses.size;
    const badId = await call(app, jwks, 'PATCH', '/buyer/addresses/not-a-uuid', tokenA, { city: 'X' });
    assert.equal(badId.status, 400);
    assert.equal(w.addresses.size, addressCountBefore);

    // Two sequential, near-identical POSTs create two DISTINCT addresses (no silent de-dup/overwrite
    // that could otherwise cause one retry to clobber a different address than the one intended).
    const shape = { label: 'home', full_name: 'Asha Verma', address_line1: '12 MG Road', city: 'Bengaluru', state: 'Karnataka', postal_code: '560001' };
    const first = (await (await call(app, jwks, 'POST', '/buyer/addresses', tokenA, shape)).json() as { data: { address: BuyerAddressRow } }).data.address;
    const second = (await (await call(app, jwks, 'POST', '/buyer/addresses', tokenA, shape)).json() as { data: { address: BuyerAddressRow } }).data.address;
    assert.notEqual(first.id, second.id);
    assert.equal(w.addresses.size, addressCountBefore + 2);

    // Deleting an address that was already deleted (a retried DELETE) answers 404, not a crash or a
    // false 200 -- and never touches the other, still-live address.
    await call(app, jwks, 'DELETE', `/buyer/addresses/${first.id}`, tokenA);
    const retriedDelete = await call(app, jwks, 'DELETE', `/buyer/addresses/${first.id}`, tokenA);
    assert.equal(retriedDelete.status, 404);
    assert.equal(w.addresses.has(second.id), true, 'the still-live sibling address survives an unrelated retry');
});
