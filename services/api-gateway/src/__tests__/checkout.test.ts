import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const indexSource = readFileSync(new URL('../index.ts', import.meta.url), 'utf8');
const routeSource = readFileSync(new URL('../routes/checkout.ts', import.meta.url), 'utf8');
const checkoutCoreSource = readFileSync(new URL('../../../../packages/checkout-core/src/index.ts', import.meta.url), 'utf8');
const migrationSource = readFileSync(new URL('../../../../database/supabase/migrations/146_executable_checkout_state_machine.sql', import.meta.url), 'utf8');
const rollbackSource = readFileSync(new URL('../../../../database/supabase/rollback/146_executable_checkout_state_machine.rollback.sql', import.meta.url), 'utf8');
const humanRequiredSource = readFileSync(new URL('../../../../tests/executable/human-required-live-paths.test.mjs', import.meta.url), 'utf8');

test('Task 003 checkout routes mount public session steps and split branding auth', () => {
    assert.match(indexSource, /import checkoutRouter, \{ publicStoreBrandingRouter, storeBrandingManagementRouter \} from '\.\/routes\/checkout'/);
    assert.match(indexSource, /api\.route\('\/checkout', checkoutRouter\)/);
    assert.match(indexSource, /api\.route\('\/stores', publicStoreBrandingRouter\)/);
    assert.match(indexSource, /api\.route\('\/stores', storeBrandingManagementRouter\)[\s\S]*api\.route\('\/stores', storesRouter\)/);
    assert.match(routeSource, /checkoutRouter\.post\('\/:cartId\/contact'/);
    assert.match(routeSource, /checkoutRouter\.post\('\/:cartId\/delivery'/);
    assert.match(routeSource, /checkoutRouter\.post\('\/:cartId\/payment-intent'/);
    assert.match(routeSource, /checkoutRouter\.post\('\/:cartId\/confirm'/);
    assert.match(routeSource, /checkoutRouter\.get\('\/:id'/);
});

test('Task 003 checkout verifies signed handoff, uses idempotency, and compensates failed confirm', () => {
    assert.match(routeSource, /hmacSha256Hex\(secret, `\$\{siteId\}:\$\{cartId\}:\$\{cartToken\}:\$\{channel\}:\$\{expiresAt\}`\)/);
    assert.match(routeSource, /timingSafeEqualHex\(expected, signature\)/);
    assert.match(routeSource, /new IdempotencyExecutionAdapter\(getSupabaseAdmin\(c\)\)/);
    assert.match(routeSource, /runIdempotentStep\(c,\s*verified\.handoff,\s*`checkout\.confirm:\$\{cartId\}`/);
    assert.match(routeSource, /revalidateConfirmInputs/);
    assert.match(routeSource, /inventory_reservations/);
    assert.match(routeSource, /coupons/);
    assert.match(routeSource, /compensation_actions/);
    assert.match(routeSource, /action:\s*'refund_payment_intent'/);
    assert.match(routeSource, /eventType:\s*'checkout\.completed'/);
    assert.match(routeSource, /eventType:\s*'checkout\.failed'/);
});

test('Task 003 checkout core exposes lifecycle schemas and data-only branding', () => {
    assert.match(checkoutCoreSource, /export const CheckoutSessionStateSchema/);
    assert.match(checkoutCoreSource, /export const CheckoutContactSchema/);
    assert.match(checkoutCoreSource, /export const CheckoutDeliverySchema/);
    assert.match(checkoutCoreSource, /export const CheckoutPaymentIntentSchema/);
    assert.match(checkoutCoreSource, /export const CheckoutConfirmSchema/);
    assert.match(checkoutCoreSource, /export function planCheckoutStateTransition/);
    assert.match(checkoutCoreSource, /assertBrandingIsDataOnly/);
    assert.match(routeSource, /StoreBrandingSchema/);
    assert.match(routeSource, /assertBrandingIsDataOnly/);
});

test('Task 003 checkout migration extends sessions, adds branding, RLS, rollback, and no code execution', () => {
    assert.match(migrationSource, /ALTER TABLE public\.checkout_sessions[\s\S]*ADD COLUMN IF NOT EXISTS cart_id uuid/);
    assert.match(migrationSource, /ADD CONSTRAINT checkout_sessions_state_check/);
    assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS public\.store_branding/);
    assert.match(migrationSource, /store_branding_data_only_check/);
    assert.match(migrationSource, /ALTER TABLE public\.checkout_sessions FORCE ROW LEVEL SECURITY/);
    assert.match(migrationSource, /ALTER TABLE public\.store_branding FORCE ROW LEVEL SECURITY/);
    assert.match(migrationSource, /public\.current_site_id\(\)/);
    assert.match(migrationSource, /public\.update_updated_at\(\)/);
    assert.doesNotMatch(migrationSource, /update_updated_at_column/);
    assert.match(rollbackSource, /DROP TABLE IF EXISTS public\.store_branding/);
    assert.match(rollbackSource, /DROP COLUMN IF EXISTS checkout_state/);
    assert.match(rollbackSource, /'processing'::text,\s*'completed'::text/);
});

test('Task 003 hosted checkout live origin is human-required, not auto-cut over', () => {
    assert.match(routeSource, /HR-DNS-CHECKOUT/);
    assert.match(routeSource, /CHECKOUT_SETUP_REQUIRED/);
    assert.match(humanRequiredSource, /HR-DNS-CHECKOUT/);
});
