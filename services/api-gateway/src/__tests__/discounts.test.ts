import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const testDir = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(testDir, '..');
const repositoryRoot = join(testDir, '../../../..');

function source(path: string): string {
    return readFileSync(join(srcRoot, path), 'utf8');
}

function repositorySource(path: string): string {
    return readFileSync(join(repositoryRoot, path), 'utf8');
}

test('Task 007 discount migration adds class stacking metadata, allocation table, tenant RLS, and rollback', () => {
    const migration = repositorySource('database/supabase/migrations/143_executable_discount_stack.sql');
    const rollback = repositorySource('database/supabase/rollback/143_executable_discount_stack.rollback.sql');

    assert.match(migration, /ADD COLUMN IF NOT EXISTS discount_class text NOT NULL DEFAULT 'order'/);
    assert.match(migration, /ADD COLUMN IF NOT EXISTS combines_with jsonb NOT NULL/);
    assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.discount_allocations/);
    assert.match(migration, /allocation_class text NOT NULL CHECK \(allocation_class IN \('product', 'order', 'shipping'\)\)/);
    assert.match(migration, /ALTER TABLE public\.coupons FORCE ROW LEVEL SECURITY/);
    assert.match(migration, /ALTER TABLE public\.discount_allocations FORCE ROW LEVEL SECURITY/);
    assert.match(migration, /coupons_tenant_site_guc/);
    assert.match(migration, /discount_allocations_tenant_site_guc/);
    assert.match(rollback, /DROP TABLE IF EXISTS public\.discount_allocations/);
    assert.match(rollback, /DROP COLUMN IF EXISTS discount_class/);
});

test('Task 007 discount APIs reuse the coupons route under the V1 /discounts alias', () => {
    const indexSource = source('index.ts');
    const couponsSource = source('routes/coupons.ts');
    const checkoutCore = repositorySource('packages/checkout-core/src/index.ts');

    assert.match(indexSource, /api\.route\('\/discounts', couponsRouter\)/);
    assert.match(couponsSource, /discount_class:\s*plan\.coupon\.discountClass/);
    assert.match(couponsSource, /combines_with:\s*plan\.coupon\.combinesWith/);
    assert.match(checkoutCore, /export function planDiscountStack/);
    assert.match(checkoutCore, /DiscountClass = 'product' \| 'order' \| 'shipping'/);
    assert.match(checkoutCore, /reason:\s*'combine_blocked'/);
    assert.match(checkoutCore, /DISCOUNT_CLASS_RANK/);
});
