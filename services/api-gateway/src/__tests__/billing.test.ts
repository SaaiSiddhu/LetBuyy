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

test('Task 014 billing APIs are mounted in the monolith and use billing-core contracts', () => {
    const indexSource = source('index.ts');
    const billingRoute = source('routes/billing.ts');
    const billingCore = repositorySource('packages/billing-core/src/index.ts');

    assert.match(indexSource, /import billingRouter from '\.\/routes\/billing'/);
    assert.match(indexSource, /api\.route\('\/billing', billingRouter\)/);
    assert.match(indexSource, /LETBUYY_AUTOPAY_MODE\?: 'sandbox' \| 'live'/);

    assert.match(billingRoute, /router\.post\('\/mandate'/);
    assert.match(billingRoute, /router\.post\('\/subscribe'/);
    assert.match(billingRoute, /router\.get\('\/invoices'/);
    assert.match(billingRoute, /BillingMandateSchema/);
    assert.match(billingRoute, /BillingSubscribeSchema/);
    assert.match(billingRoute, /planSandboxUpiAutopayMandate/);
    assert.match(billingRoute, /planBillingDunning/);
    assert.match(billingRoute, /billing\.charged/);
    assert.match(billingRoute, /billing\.failed/);
    assert.match(billingRoute, /billing\.plan_changed/);

    assert.match(billingCore, /export const BillingMandateSchema/);
    assert.match(billingCore, /export const BillingSubscribeSchema/);
    assert.match(billingCore, /export function planSandboxUpiAutopayMandate/);
    assert.match(billingCore, /export function planBillingDunning/);
});

test('Task 014 removes the 2.5% GMV rake from data defaults, checkout payloads, and merchant UI copy', () => {
    const billingCore = repositorySource('packages/billing-core/src/index.ts');
    const planUi = repositorySource('apps/merchant-control-plane/src/lib/billing/plan-ui.ts');
    const selectPlan = repositorySource('apps/merchant-control-plane/src/app/[store]/access_account/checkout/select-plan/SelectPlanClient.tsx');
    // Checkout moved from settings/subscribe/checkout/SubscribeCheckoutClient.tsx to the
    // full-screen access_account/checkout/checkout/CheckoutClient.tsx (the old file is now a redirect).
    const subscribeCheckout = repositorySource('apps/merchant-control-plane/src/app/[store]/access_account/checkout/checkout/CheckoutClient.tsx');
    const migration = repositorySource('database/supabase/migrations/152_executable_billing_autopay.sql');

    assert.doesNotMatch(billingCore, /gmv_percentage:\s*2\.5/);
    assert.match(billingCore, /gmv_percentage:\s*0/);
    assert.match(planUi, /gmv_percentage:\s*0/);
    assert.doesNotMatch(selectPlan, /transaction fee/i);
    assert.doesNotMatch(subscribeCheckout, /Transaction fee/i);
    assert.match(migration, /plans_store_zero_gmv_rake_check/);
    assert.match(migration, /COALESCE\(gmv_percentage, 0\) = 0/);
});

test('Task 014 migration and rollback define tenant-scoped AutoPay billing tables', () => {
    const migration = repositorySource('database/supabase/migrations/152_executable_billing_autopay.sql');
    const rollback = repositorySource('database/supabase/rollback/152_executable_billing_autopay.rollback.sql');

    assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.billing_mandates/);
    assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.merchant_billing_invoices/);
    assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.billing_dunning_events/);
    assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.billing_usage_events/);
    assert.match(migration, /ALTER TABLE public\.subscriptions[\s\S]*ADD COLUMN IF NOT EXISTS site_id uuid/);
    assert.match(migration, /ALTER TABLE public\.billing_history[\s\S]*ADD COLUMN IF NOT EXISTS site_id uuid/);
    assert.match(migration, /FORCE ROW LEVEL SECURITY/);
    assert.match(migration, /site_id = public\.current_site_id\(\)/);
    assert.match(migration, /EXECUTE FUNCTION public\.update_updated_at\(\)/);
    assert.doesNotMatch(migration, /PARTITION BY/i);

    assert.match(rollback, /DROP TABLE IF EXISTS public\.billing_usage_events/);
    assert.match(rollback, /DROP TABLE IF EXISTS public\.billing_dunning_events/);
    assert.match(rollback, /DROP TABLE IF EXISTS public\.merchant_billing_invoices/);
    assert.match(rollback, /DROP TABLE IF EXISTS public\.billing_mandates/);
    assert.match(rollback, /DROP CONSTRAINT IF EXISTS plans_store_zero_gmv_rake_check/);
});

test('Task 014 live AutoPay is human-gated and logged', () => {
    const billingRoute = source('routes/billing.ts');
    const humanRequired = repositorySource('EXECUTABLE_HUMAN_REQUIRED.md');
    const livePathSkips = repositorySource('tests/executable/human-required-live-paths.test.mjs');

    assert.match(billingRoute, /HR-AUTOPAY-LIVE/);
    assert.match(billingRoute, /HumanRequiredError/);
    assert.match(billingRoute, /AUTOPAY_PROVIDER_SETUP_REQUIRED/);
    assert.match(humanRequired, /HR-AUTOPAY-LIVE/);
    assert.match(humanRequired, /services\/api-gateway\/src\/routes\/billing\.ts/);
    assert.match(livePathSkips, /\[HUMAN-REQUIRED] HR-AUTOPAY-LIVE/);
});
