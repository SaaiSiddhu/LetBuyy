// CAP-FB-LOYALTY — the buyer's loyalty reads.
//
// The money properties this holds: the balance comes from the database's own projection and is never
// summed in TypeScript; nothing here writes to a loyalty table; "not enrolled" is a different answer
// from "zero points"; and a failure is a 500, never a zero, because zero is a real balance.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { Hono } from 'hono';
import type { Env } from '../index';
import { installBuyerSessionState } from './buyer-session-state-fake';
import { registerBuyerLoyaltyRoutes, type LoyaltySummary } from '../routes/storefront/buyer-loyalty-routes';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');
const ISSUER = 'https://accounts.letbuyy.test';
const BUYER = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const OTHER = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
const SITE = 'cccccccc-3333-4333-8333-cccccccccccc';

async function keys() {
    const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true });
    return { privateKey, jwks: JSON.stringify({ keys: [{ ...(await exportJWK(publicKey)), alg: 'ES256', kid: 'test' }] }) };
}
async function tok(privateKey: CryptoKey, sub: string) {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({ realm: 'buyer', token_use: 'buyer_session' })
        .setProtectedHeader({ alg: 'ES256', typ: 'JWT', kid: 'test' })
        .setIssuer(ISSUER).setAudience('letbuyy:buyer-session').setSubject(sub)
        .setIssuedAt(now).setExpirationTime(now + 3600).setJti('0123456789abcdef0123456789abcdef').sign(privateKey);
}
async function storefrontTok(privateKey: CryptoKey, sub: string, site = SITE) {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({ realm: 'buyer', token_use: 'storefront_session', site_id: site, sep: 1 })
        .setProtectedHeader({ alg: 'ES256', typ: 'JWT', kid: 'test' })
        .setIssuer(ISSUER).setAudience('letbuyy:storefront-session').setSubject(sub)
        .setIssuedAt(now).setExpirationTime(now + 3600).setJti(crypto.randomUUID().replace(/-/g, '')).sign(privateKey);
}
const SUMMARY: LoyaltySummary = { site_id: SITE, balance: 120, is_active: true, earn_rate_bps: 500, redeem_cap_bps: 5000, point_value_minor: 100 };

function harness(o: { summary?: LoyaltySummary | null; error?: unknown } = {}) {
    const calls = { summary: [] as { buyer: string; site: string }[], entries: [] as { buyer: string; site: string; limit: number }[] };
    const router = new Hono<{ Bindings: Env }>();
    registerBuyerLoyaltyRoutes(router, {
        loadSummary: async (_c, buyer, site) => { calls.summary.push({ buyer, site }); return { data: o.summary === undefined ? SUMMARY : o.summary, error: o.error ?? null }; },
        listEntries: async (_c, buyer, site, limit) => { calls.entries.push({ buyer, site, limit }); return { data: [], error: o.error ?? null }; },
    });
    const app = new Hono<{ Bindings: Env }>();
    installBuyerSessionState(app);
    app.route('/storefront', router);
    return { app, calls };
}
const env = (jwks: string) => ({ LETBUYY_IDENTITY_ISSUER: ISSUER, LETBUYY_IDENTITY_PUBLIC_JWKS: jwks } as unknown as Env);

test('the balance is read for the TOKEN subject, not a query parameter', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness();
    const res = await h.app.request(`/storefront/buyer/loyalty/${SITE}?buyer_account_id=${OTHER}`, { headers: { 'X-LetBuyy-Buyer-Session': await tok(privateKey, BUYER) } }, env(jwks));
    assert.equal(res.status, 200);
    assert.deepEqual(h.calls.summary, [{ buyer: BUYER, site: SITE }]);
});

test('NOT ENROLLED is a different answer from a zero balance', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness({ summary: null });
    const res = await h.app.request(`/storefront/buyer/loyalty/${SITE}`, { headers: { 'X-LetBuyy-Buyer-Session': await tok(privateKey, BUYER) } }, env(jwks));
    const body = await res.json() as { data: { enrolled: boolean; balance: number | null } };
    assert.equal(body.data.enrolled, false);
    assert.equal(body.data.balance, null, 'a merchant with no programme must not report 0 points');
});

test('a failure is a 500, never a zero balance', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness({ error: { message: 'connection refused' } });
    const res = await h.app.request(`/storefront/buyer/loyalty/${SITE}`, { headers: { 'X-LetBuyy-Buyer-Session': await tok(privateKey, BUYER) } }, env(jwks));
    assert.equal(res.status, 500, 'serving 0 for an outage would tell a buyer their points are gone');
});

test('loyalty reads require a buyer session', async () => {
    const { jwks } = await keys();
    const h = harness();
    const res = await h.app.request(`/storefront/buyer/loyalty/${SITE}`, undefined, env(jwks));
    assert.equal(res.status, 401);
    assert.deepEqual(h.calls.summary, []);
});

test('a non-UUID siteId is refused before any database call', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness();
    const res = await h.app.request('/storefront/buyer/loyalty/not-a-uuid', { headers: { 'X-LetBuyy-Buyer-Session': await tok(privateKey, BUYER) } }, env(jwks));
    assert.equal(res.status, 400);
    assert.deepEqual(h.calls.summary, []);
});

test('a storefront token reads only its signed store balance, and cannot substitute another store', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness();
    const token = await storefrontTok(privateKey, BUYER);
    const headers = { 'X-LetBuyy-Storefront-Session': token };
    const res = await h.app.request('/storefront/buyer/storefront-loyalty?store_id=' + SITE + '&buyer_account_id=' + OTHER, { headers }, env(jwks));
    assert.equal(res.status, 200);
    assert.deepEqual(h.calls.summary, [{ buyer: BUYER, site: SITE }]);
    assert.equal((await h.app.request('/storefront/buyer/storefront-loyalty?store_id=' + OTHER, { headers }, env(jwks))).status, 401);
    assert.equal(h.calls.summary.length, 1, 'the wrong-site request must stop before reading the ledger');
});

test('storefront loyalty history uses the signed buyer/store and caps the requested page size', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness();
    const token = await storefrontTok(privateKey, BUYER);
    const response = await h.app.request(`/storefront/buyer/storefront-loyalty/history?store_id=${SITE}&limit=9999`, {
        headers: { 'X-LetBuyy-Storefront-Session': token },
    }, env(jwks));
    assert.equal(response.status, 200);
    assert.deepEqual(h.calls.entries, [{ buyer: BUYER, site: SITE, limit: 100 }]);
});

test('the history limit is capped', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness();
    await h.app.request(`/storefront/buyer/loyalty/${SITE}/history?limit=9999`, { headers: { 'X-LetBuyy-Buyer-Session': await tok(privateKey, BUYER) } }, env(jwks));
    assert.deepEqual(h.calls.entries, [{ buyer: BUYER, site: SITE, limit: 100 }]);
});

// ── Source contracts ────────────────────────────────────────────────────────────
function code(s: string) { return s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ').replace(/`(?:[^`\\]|\\.)*`/g, '` `'); }
const wiring = code(readFileSync(join(SRC, 'routes/storefront/buyer-realm-wiring.ts'), 'utf8'));
const block = (() => {
    const at = wiring.indexOf('registerBuyerLoyaltyRoutes(router');
    assert.ok(at > 0);
    return wiring.slice(at, wiring.indexOf('registerBuyerWishlistRoutes(router', at));
})();
const migrationRaw = readFileSync(join(SRC, '../../../database/supabase/migrations/231_merchant_funded_loyalty_ledger.sql'), 'utf8');
// SQL comments stripped before ANY absence assertion. 231 explains itself at length — including the
// sentence "the balance is derived from this" — and an absence check over documented code that reads
// its own prose is the use-versus-mention trap this session has now hit five times.
const migration = migrationRaw.replace(/--[^\n]*/g, ' ');
const redeemMigration = readFileSync(
    join(SRC, '../../../database/supabase/migrations/233_loyalty_redeem_authoritative_amount.sql'), 'utf8',
).replace(/--[^\n]*/g, ' ');

test('SOURCE: the balance comes from the database projection, never summed in TypeScript', () => {
    assert.match(block, /\.rpc\('loyalty_balance'/, 'the one projection must be the database function');
    // A TS-side sum would be a second projection of a money balance, and the two would diverge.
    assert.doesNotMatch(block, /reduce\(|\.map\([^)]*points/, 'the balance must not be recomputed here');
});

test('SOURCE: nothing writes to a loyalty table from TypeScript', () => {
    // Money mutations go through the SECURITY DEFINER RPCs, which carry the idempotency key and the
    // advisory lock. canonical-ledger-only-validator enforces the same rule repository-wide.
    for (const table of ['loyalty_ledger_entries', 'loyalty_accounts', 'loyalty_programs']) {
        const uses = block.split(`'${table}'`).slice(1).join(' ');
        assert.doesNotMatch(uses, /\.insert\(|\.update\(|\.upsert\(|\.delete\(/, `${table} must not be written from TypeScript`);
    }
});

test('SOURCE: every loyalty read is scoped by BOTH the buyer and the site', () => {
    assert.match(block, /\.eq\('buyer_account_id', buyerAccountId\)/);
    assert.match(block, /\.eq\('site_id', siteId\)/);
});

test('SOURCE: the ledger has no mutable balance column to disagree with the projection', () => {
    const ddl = migration.slice(
        migration.indexOf('CREATE TABLE IF NOT EXISTS public.loyalty_accounts'),
        migration.indexOf('CREATE TABLE IF NOT EXISTS public.loyalty_ledger_entries'),
    );
    // balance_after is a per-entry record of what the writer believed, not an authority. An account
    // that carried its own balance column would be the mutable field this design replaces.
    assert.match(ddl, /CREATE TABLE IF NOT EXISTS public\.loyalty_accounts/, 'the extractor should hold the accounts DDL');
    assert.doesNotMatch(ddl, /\bbalance\b/, 'loyalty_accounts must hold no balance column');
});

test('SOURCE: both money RPCs are SECURITY DEFINER, idempotent and advisory-locked', () => {
    for (const fn of ['award_loyalty_points', 'redeem_loyalty_points']) {
        const at = migration.indexOf(`CREATE OR REPLACE FUNCTION public.${fn}`);
        assert.ok(at > 0, `${fn} should exist`);
        const body = migration.slice(at, migration.indexOf('$$;', at));
        assert.match(body, /SECURITY DEFINER/, `${fn} must be SECURITY DEFINER`);
        assert.match(body, /p_idempotency_key/, `${fn} must take an idempotency key`);
        assert.match(body, /pg_advisory_xact_lock\(hashtextextended\([^)]*, 2\)\)/, `${fn} must take the seed-2 advisory lock`);
        assert.match(body, /FOR UPDATE/, `${fn} must lock the account row`);
        assert.match(body, /public\.loyalty_balance\(/, `${fn} must use the one projection`);
    }
});

test('SOURCE: the earn path reads the order total from the ORDER and requires it paid', () => {
    const at = migration.indexOf('CREATE OR REPLACE FUNCTION public.award_loyalty_points');
    const body = migration.slice(at, migration.indexOf('$$;', at));
    // A caller-supplied total is a caller-chosen amount of the merchant's money.
    assert.doesNotMatch(body, /p_order_total/, 'the total must never be a parameter');
    assert.match(body, /FROM public\.orders o[\s\S]*payment_status = 'paid'/, 'points require a paid order');
    assert.match(body, /o\.site_id = p_site_id/, 'one merchant must not fund another');
    assert.match(body, /floor\(/, 'rounding up would issue a point the merchant did not fund');
});


// ── F-LOY-1 part 2: redemption takes the authoritative payable amount ──────────

test('SOURCE: the redeem RPC takes a payable amount, and it can only TIGHTEN the cap', () => {
    // Inside create_checkout_order, orders.total is mid-mutation: the order is created by
    // create_order_with_inventory_reservations before shipping, tax and discount are folded in, and
    // `total` is later overwritten with the post-gift-card payable. Capping against that row means
    // "50% of the order" silently denotes two different numbers depending on call position.
    assert.match(redeemMigration, /p_max_value_minor bigint DEFAULT NULL/, 'the caller must pass the authoritative amount');
    // LEAST of the caller's amount and the order's own basis: passing an amount can never RAISE the
    // cap, so the parameter cannot be used to redeem beyond the programme's limit.
    assert.match(redeemMigration, /v_basis_minor := LEAST\(/);
    assert.match(redeemMigration, /COALESCE\(p_max_value_minor,/);
    // The value applied can never exceed what the caller said is payable, independently of the cap
    // arithmetic above.
    assert.match(redeemMigration, /v_value_minor > p_max_value_minor/);
    assert.match(redeemMigration, /the payable amount cannot be negative/);
});

test('SOURCE: the old redeem signature is DROPPED, never left as an overload', () => {
    // Two callable versions of a money RPC is a second authority, resolved by argument count.
    assert.match(redeemMigration, /DROP FUNCTION IF EXISTS public\.redeem_loyalty_points\(uuid, uuid, uuid, bigint, text, text, uuid\)/);
});

test('SOURCE: points are clamped BEFORE the debit, never after', () => {
    // Debiting the requested points and then applying a smaller value would destroy the difference:
    // the buyer pays points for value they never received.
    const capAt = redeemMigration.indexOf('redemption exceeds the programme cap');
    const insertAt = redeemMigration.indexOf('INSERT INTO public.loyalty_ledger_entries');
    assert.ok(capAt > 0 && insertAt > capAt, 'the cap check must precede the ledger write');
});
