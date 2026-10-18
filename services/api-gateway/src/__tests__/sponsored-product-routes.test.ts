// CAP-FB-ADS — the public sponsored strip, and the D-5 invariants behind it.
//
// Two properties. A paid placement must be DISCLOSED: undisclosed advertising is a regulatory
// problem, not a styling choice, so every row carries sponsored: true. And a paid placement must not
// become a way to read catalogue an ordinary storefront read would refuse — the fences live in the
// SECURITY DEFINER function, not in TypeScript where a later caller could omit one.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { Hono } from 'hono';
import type { Env } from '../index';
import { registerSponsoredProductRoutes, type SponsoredPlacementRow } from '../routes/storefront/sponsored-product-routes';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROW: SponsoredPlacementRow = {
    campaign_id: 'ca11a000-1111-4111-8111-000000000001', product_id: '9d0d0000-1111-4111-8111-000000000001',
    site_id: '5111e000-1111-4111-8111-000000000001', position: 0, name: 'Shoe', slug: 'shoe', price: 100, image_url: null,
};

function harness(o: { data?: SponsoredPlacementRow[]; error?: unknown } = {}) {
    const calls: number[] = [];
    const router = new Hono<{ Bindings: Env }>();
    registerSponsoredProductRoutes(router, {
        loadSponsored: async (_c, limit) => { calls.push(limit); return { data: o.data ?? [ROW], error: o.error ?? null }; },
    });
    const app = new Hono<{ Bindings: Env }>();
    app.route('/storefront', router);
    return { app, calls };
}
const env = () => ({ ENVIRONMENT: 'test', STOREFRONT_CACHE: 'off' } as unknown as Env);

test('every sponsored row is DISCLOSED as sponsored', async () => {
    const res = await harness().app.request('/storefront/marketplace/sponsored-products', undefined, env());
    assert.equal(res.status, 200);
    const body = await res.json() as { data: Array<{ sponsored: boolean }> };
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].sponsored, true, 'a paid placement must never be indistinguishable from an organic result');
});

test('eligibility-sensitive sponsored reads bypass stale cache and return no-store', async () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'caches');
    let cacheLookups = 0;
    const fakeCache = {
        match: async () => {
            cacheLookups += 1;
            return new Response(JSON.stringify({ success: true, data: [{ ...ROW, product_id: 'stale-approved-product' }] }));
        },
        put: async () => { throw new Error('eligibility-sensitive reads must not populate cache'); },
        delete: async () => true,
    };
    Object.defineProperty(globalThis, 'caches', {
        configurable: true,
        value: { default: fakeCache },
    });
    try {
        const res = await harness().app.request('/storefront/marketplace/sponsored-products', undefined,
            { ENVIRONMENT: 'test', STOREFRONT_CACHE: 'on', AD_PLACEMENT_SIGNING_SECRET: 'local-test-signing-secret' } as unknown as Env);
        assert.equal(res.status, 200);
        assert.equal(res.headers.get('Cache-Control'), 'no-store');
        assert.equal(res.headers.get('X-Storefront-Cache'), 'BYPASS');
        assert.equal(cacheLookups, 0, 'the previous approved response must not be consulted');
        const approved = await res.json() as { data: Array<{ product_id: string; sponsored: boolean; placement_token?: string }> };
        assert.deepEqual(approved.data.map((row) => row.sponsored), [true]);
        assert.equal(approved.data[0].product_id, ROW.product_id, 'the canonical producer, not the stale listing, supplies the row');
        assert.ok(approved.data[0].placement_token, 'per-response placement tokens remain present');

        // The canonical query now reflects a takedown. The cache still offers its old approved
        // response, but the next request must observe the empty eligible set instead.
        const revoked = await harness({ data: [] }).app.request(
            '/storefront/marketplace/sponsored-products', undefined,
            { ENVIRONMENT: 'test', STOREFRONT_CACHE: 'on', AD_PLACEMENT_SIGNING_SECRET: 'local-test-signing-secret' } as unknown as Env,
        );
        assert.equal(revoked.headers.get('Cache-Control'), 'no-store');
        assert.deepEqual((await revoked.json() as { data: unknown[] }).data, []);
        assert.equal(cacheLookups, 0, 'revoked listings cannot be restored from a stale cache entry');
    } finally {
        if (original) Object.defineProperty(globalThis, 'caches', original);
        else Reflect.deleteProperty(globalThis, 'caches');
    }
});

test('no advertisers is an empty strip, not an error', async () => {
    const res = await harness({ data: [] }).app.request('/storefront/marketplace/sponsored-products', undefined, env());
    assert.equal(res.status, 200);
    assert.deepEqual((await res.json() as { data: unknown[] }).data, []);
});

test('a database failure is a 500, not an empty strip', async () => {
    // An empty strip is a real answer, so serving it for an outage would cache the outage as
    // "nobody is advertising" for the whole TTL.
    const res = await harness({ error: { message: 'down' } }).app.request('/storefront/marketplace/sponsored-products', undefined, env());
    assert.equal(res.status, 500);
});

test('the strip is public and its limit is capped', async () => {
    const h = harness();
    await h.app.request('/storefront/marketplace/sponsored-products?limit=9999', undefined, env());
    assert.deepEqual(h.calls, [20]);
});

test('the response carries no catalogue fields beyond the public projection', async () => {
    const res = await harness().app.request('/storefront/marketplace/sponsored-products', undefined, env());
    const raw = await res.text();
    for (const forbidden of ['cost_price', 'cost_per_item', 'sku', 'barcode', 'inventory']) {
        assert.doesNotMatch(raw, new RegExp(forbidden), `a paid placement must not expose ${forbidden}`);
    }
});

// ── Source contracts ────────────────────────────────────────────────────────────
function code(s: string) { return s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ').replace(/`(?:[^`\\]|\\.)*`/g, '` `'); }
const wiring = code(readFileSync(join(SRC, 'routes/storefront/buyer-realm-wiring.ts'), 'utf8'));
const migrationRaw = readFileSync(join(SRC, '../../../database/supabase/migrations/232_prepaid_ad_credits.sql'), 'utf8');
// Comments stripped before every absence assertion: 232 documents D-5 at length and names the very
// words some of these assertions look for.
const migration = migrationRaw.replace(/--[^\n]*/g, ' ');
const approvalMigrationRaw = readFileSync(join(SRC, '../../../database/supabase/migrations/274_sponsored_marketplace_approval_fence.sql'), 'utf8');
const approvalMigration = approvalMigrationRaw.replace(/--[^\n]*/g, ' ');
const approvalRollback = readFileSync(join(SRC, '../../../database/supabase/rollback/274_sponsored_marketplace_approval_fence.rollback.sql'), 'utf8');

test('SOURCE: the cross-tenant read goes through the SECURITY DEFINER function', () => {
    const at = wiring.indexOf('registerSponsoredProductRoutes(router');
    const block = wiring.slice(at, wiring.indexOf('registerBuyerLoyaltyRoutes(router', at));
    assert.match(block, /\.rpc\('marketplace_sponsored_products'/);
    // A direct read of the tenant table would put the fences in TypeScript, where a later caller
    // could omit one; marketplace_feed (217) sets the precedent for a designed cross-tenant read.
    assert.doesNotMatch(block, /\.from\('ad_campaign_placements'\)/);
});

test('SOURCE: the function fences campaign, product AND seller visibility', () => {
    const at = migration.indexOf('CREATE OR REPLACE FUNCTION public.marketplace_sponsored_products');
    const body = migration.slice(at, migration.indexOf('$$;', at));
    assert.match(body, /SECURITY DEFINER/);
    assert.match(body, /c\.status = 'active'/, 'a paused campaign must not show');
    assert.match(body, /c\.ends_at IS NULL OR c\.ends_at >= now\(\)/, 'an ended campaign must not show');
    assert.match(body, /c\.starts_at IS NULL OR c\.starts_at <= now\(\)/, 'a future campaign must not show');
    assert.match(body, /p\.is_active/, 'a hidden product must not show');
    assert.match(body, /p\.deleted_at IS NULL/);
    assert.match(body, /s\.status = 'published'/, "an unpublished seller's ad must not show");
    // No cost or stock columns: the allowlist is a subset of the public storefront projection.
    assert.doesNotMatch(body, /cost_price|cost_per_item|\bsku\b|barcode|inventory_qty/);
});

test('SOURCE: sponsored marketplace discovery requires an approved, public marketplace listing', () => {
    const at = approvalMigration.indexOf('CREATE OR REPLACE FUNCTION public.marketplace_sponsored_products');
    const body = approvalMigration.slice(at, approvalMigration.indexOf('$$;', at));
    assert.match(body, /JOIN public\.channel_listings cl/);
    assert.match(body, /cl\.channel = 'marketplace'/);
    assert.match(body, /cl\.status = 'approved'/);
    assert.match(body, /cl\.visibility = 'public'/);
    assert.match(body, /public\.ad_campaign_remaining_minor\(c\.id\) > 0/);
    assert.match(body, /public\.ad_campaign_spent_today_minor\(c\.id, NULL\) < c\.daily_budget_minor/);
    assert.match(body, /ORDER BY c\.bid_minor DESC, pl\.position ASC, pl\.created_at ASC/);
    assert.match(approvalRollback, /DROP FUNCTION IF EXISTS public\.marketplace_sponsored_products\(integer\)/,
        'rollback disables the paid feed instead of restoring its unapproved-product behavior');
});

test('SOURCE: D-5 is enforced by constraints, not by comments', () => {
    // Non-withdrawable: no entry type converts credits back to money.
    const types = migration.slice(migration.indexOf('ad_credit_ledger_type_check'), migration.indexOf('ad_credit_ledger_payment_reference_check'));
    assert.doesNotMatch(types, /withdraw|payout|transferred|refunded_to/i, 'D-5: credits are non-withdrawable');
    // Prepaid: a purchase must name what funded it.
    assert.match(migration, /entry_type = 'purchased' AND payment_reference IS NOT NULL/);
    // Non-transferable: the entry's site must be its account's site, by composite FK.
    assert.match(migration, /FOREIGN KEY \(ad_credit_account_id, site_id\)[\s\S]{0,120}REFERENCES public\.ad_credit_accounts \(id, site_id\)/);
    // Never from sales payable: nothing here reads orders, payouts or settlements.
    assert.doesNotMatch(migration, /\borders\b|payouts|settlements/, 'D-5: never funded from sales payable');
    // No overdraft: a prepaid balance cannot go negative.
    assert.match(migration, /balance_after_minor >= 0/);
});

test('SOURCE: campaigns carry no mutable spend counter', () => {
    const ddl = migration.slice(
        migration.indexOf('CREATE TABLE IF NOT EXISTS public.ad_campaigns'),
        migration.indexOf('CREATE INDEX IF NOT EXISTS ad_campaigns_active_idx'),
    );
    // System A's spentToday/spentTotal were mutable counters; spend is a projection here.
    assert.doesNotMatch(ddl, /spent/i, 'spend must be projected from the ledger, never stored on the campaign');
    assert.match(migration, /CREATE OR REPLACE FUNCTION public\.ad_campaign_spent_minor/);
});

test('SOURCE: both credit RPCs are SECURITY DEFINER, idempotent and advisory-locked on seed 3', () => {
    for (const fn of ['record_ad_credit_purchase', 'allocate_ad_campaign_budget']) {
        const at = migration.indexOf(`CREATE OR REPLACE FUNCTION public.${fn}`);
        assert.ok(at > 0, `${fn} should exist`);
        const body = migration.slice(at, migration.indexOf('$$;', at));
        assert.match(body, /SECURITY DEFINER/);
        assert.match(body, /p_idempotency_key/);
        // Seed 3: 0, 1 and 2 belong to checkout, gift cards and loyalty. A shared seed would make
        // unrelated money paths block each other.
        assert.match(body, /pg_advisory_xact_lock\(hashtextextended\([^)]*, 3\)\)/);
        assert.match(body, /FOR UPDATE/);
    }
});
