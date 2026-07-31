import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const testDir = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(testDir, '..');
const repositoryRoot = join(testDir, '../../../..');

function source(path: string): string {
    return readFileSync(join(srcRoot, path), 'utf8');
}
function repositorySource(path: string): string {
    return readFileSync(join(repositoryRoot, path), 'utf8');
}

test('founding allocation is hooked at the single activation chokepoint, non-fatal + idempotent', () => {
    const adapter = source('execution/subscription-execution.adapter.ts');
    assert.match(adapter, /allocate_founding_merchant/);
    assert.match(adapter, /if \(input\.amountPaid > 0\)/);     // gated on a real payment
    assert.match(adapter, /try \{[\s\S]*allocate_founding_merchant[\s\S]*\} catch/); // non-fatal
    assert.match(adapter, /founding,/);                          // returned to callers
});

test('public founding routes mount BEFORE the auth middleware', () => {
    const index = source('index.ts');
    assert.match(index, /import foundingPublicRouter from '\.\/routes\/founding-public'/);
    assert.match(index, /api\.route\('\/', foundingPublicRouter\)/);
    assert.match(index, /api\.route\('\/founding', foundingRouter\)/);
    assert.match(index, /api\.route\('\/internal\/founding', internalFoundingRouter\)/);
    const pubPos = index.indexOf("api.route('/', foundingPublicRouter)");
    const authPos = index.indexOf("api.use('/*', authMiddleware)");
    assert.ok(pubPos > 0 && authPos > 0 && pubPos < authPos, 'public founding router must be mounted before authMiddleware');
});

test('public founding router exposes the spec endpoints', () => {
    const r = source('routes/founding-public.ts');
    assert.match(r, /router\.get\('\/founding-program'/);
    assert.match(r, /router\.get\('\/founding-program\/stats'/);
    assert.match(r, /router\.get\('\/founding-program\/remaining'/);
    assert.match(r, /router\.get\('\/pricing'/);
    assert.match(r, /router\.get\('\/plans'/);
    assert.match(r, /get_founding_program_public/); // non-PII counts only
});

test('merchant + internal founding routes exist', () => {
    assert.match(source('routes/founding.ts'), /router\.get\('\/me'/);
    const adminRoute = source('routes/internal-founding.ts');
    for (const op of ['/overview', '/allocations', '/export', '/state', '/allocate', '/reclaim', '/repair-lock', '/reconcile']) {
        assert.ok(adminRoute.includes(`'${op}'`), `internal-founding missing ${op}`);
    }
});

test('PLAN_NOT_PURCHASABLE guard + founding price lock applied at every charge site', () => {
    const checkout = source('lib/subscription-checkout.ts');
    const payments = source('routes/payments.ts');
    const billing = source('routes/billing.ts');
    for (const f of [checkout, payments, billing]) {
        assert.match(f, /PLAN_NOT_PURCHASABLE/);
        assert.match(f, /resolveFoundingCheckoutLock/);
    }
    assert.match(checkout, /applyFoundingLockToPlan/);
    assert.match(payments, /resolveMerchantPricing/);
    assert.match(billing, /applyFoundingLockToPlan/);
});

test('automated refund reclaim is wired into the Razorpay refund webhook', () => {
    const webhook = repositorySource('services/webhook-service/src/index.ts');
    assert.match(webhook, /reclaim_founding_merchant/);
    assert.match(webhook, /reclaimFoundingOnRefund/);
    assert.match(webhook, /case "refund\.created"/);
});

test('billing-core exposes the price-lock engine and forces order mode for founders', () => {
    const core = repositorySource('packages/billing-core/src/index.ts');
    assert.match(core, /export function resolveMerchantPricing/);
    assert.match(core, /export function applyFoundingLockToPlan/);
    assert.match(core, /export function resolvePlanPublicPricing/);
    // founders are never bound to a catalog-priced native subscription
    assert.match(core, /razorpay_plan_id_monthly: null/);
    assert.match(core, /'launch' \| 'growth' \| 'scale' \| 'commerce_os'/);
});

test('api-client exposes typed foundingProgram + foundingAdmin groups', () => {
    const client = repositorySource('packages/typescript/api-client/src/index.ts');
    assert.match(client, /readonly foundingProgram = \{/);
    assert.match(client, /readonly foundingAdmin = \{/);
    assert.match(client, /'\/founding-program\/remaining'/);
    assert.match(client, /'\/internal\/founding\/reconcile'/);
});

test('migration 176 creates the founding schema with forced RLS + expanded plan CHECK', () => {
    const m = repositorySource('database/supabase/migrations/176_v1_founding_program_schema.sql');
    assert.match(m, /CREATE TABLE IF NOT EXISTS public\.founding_merchant_program/);
    assert.match(m, /CREATE TABLE IF NOT EXISTS public\.founding_merchant_allocations/);
    assert.match(m, /CREATE TABLE IF NOT EXISTS public\.pricing_snapshots/);
    assert.match(m, /remaining_slots integer GENERATED ALWAYS AS \(total_slots - used_slots\) STORED/);
    assert.match(m, /FORCE ROW LEVEL SECURITY/);
    assert.match(m, /CHECK \(used_slots <= total_slots\)/);
    assert.match(m, /plan IN \('free','starter','business','enterprise','launch','growth','scale','commerce_os'\)/);
});

test('migration 177 RPCs are race-safe (FOR UPDATE), idempotent, and enforce the 14-day reclaim', () => {
    const m = repositorySource('database/supabase/migrations/177_v1_founding_program_rpcs.sql');
    assert.match(m, /CREATE OR REPLACE FUNCTION public\.allocate_founding_merchant/);
    assert.match(m, /FOR UPDATE/);
    assert.match(m, /SECURITY DEFINER/);
    assert.match(m, /SET search_path TO 'public'/);
    assert.match(m, /CREATE OR REPLACE FUNCTION public\.reclaim_founding_merchant/);
    assert.match(m, /INTERVAL '14 days'/);
    assert.match(m, /CREATE OR REPLACE FUNCTION public\.get_founding_program_public/);
    assert.match(m, /CREATE OR REPLACE FUNCTION public\.reconcile_founding_program/);
    assert.match(m, /CREATE OR REPLACE FUNCTION public\.resolve_merchant_locked_price/);
});

test('migration 178 seeds V1 plans in paise + the program singleton without resetting counters', () => {
    const m = repositorySource('database/supabase/migrations/178_v1_pricing_plans_seed.sql');
    assert.match(m, /'launch'[\s\S]*29900[\s\S]*19900/); // ₹299 / ₹199 in paise
    assert.match(m, /'growth'[\s\S]*99900[\s\S]*69900/); // ₹999 / ₹699 in paise
    assert.match(m, /'coming_soon'/);
    assert.match(m, /ON CONFLICT \(program_key\) DO NOTHING/); // never reset live counters
});
