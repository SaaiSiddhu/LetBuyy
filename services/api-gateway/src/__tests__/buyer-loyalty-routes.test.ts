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
const SUMMARY: LoyaltySummary = { site_id: SITE, balance: 120, is_active: true, earn_rate_bps: 500, redeem_cap_bps: 5000, point_value_minor: 100 };

function harness(o: { summary?: LoyaltySummary | null; error?: unknown } = {}) {
    const calls = { summary: [] as { buyer: string; site: string }[], entries: [] as { buyer: string; site: string; limit: number }[] };
    const router = new Hono<{ Bindings: Env }>();
    registerBuyerLoyaltyRoutes(router, {
        loadSummary: async (_c, buyer, site) => { calls.summary.push({ buyer, site }); return { data: o.summary === undefined ? SUMMARY : o.summary, error: o.error ?? null }; },
        listEntries: async (_c, buyer, site, limit) => { calls.entries.push({ buyer, site, limit }); return { data: [], error: o.error ?? null }; },
    });
    const app = new Hono<{ Bindings: Env }>();
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
    return wiring.slice(at, wiring.indexOf('registerBuyerSupportRoutes(router', at));
})();
const migrationRaw = readFileSync(join(SRC, '../../../database/supabase/migrations/231_merchant_funded_loyalty_ledger.sql'), 'utf8');
// SQL comments stripped before ANY absence assertion. 231 explains itself at length — including the
// sentence "the balance is derived from this" — and an absence check over documented code that reads
// its own prose is the use-versus-mention trap this session has now hit five times.
const migration = migrationRaw.replace(/--[^\n]*/g, ' ');

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
