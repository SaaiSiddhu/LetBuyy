import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const indexSource = readFileSync(new URL('../index.ts', import.meta.url), 'utf8');
const routeSource = readFileSync(new URL('../routes/checkout.ts', import.meta.url), 'utf8');
const commandSource = readFileSync(new URL('../lib/hosted-checkout-order-command.ts', import.meta.url), 'utf8');
const checkoutCoreSource = readFileSync(new URL('../../../../packages/checkout-core/src/index.ts', import.meta.url), 'utf8');
const migrationSource = readFileSync(new URL('../../../../database/supabase/migrations/146_executable_checkout_state_machine.sql', import.meta.url), 'utf8');
const rollbackSource = readFileSync(new URL('../../../../database/supabase/rollback/146_executable_checkout_state_machine.rollback.sql', import.meta.url), 'utf8');
const buyerBindingMigration = readFileSync(new URL('../../../../database/supabase/migrations/268_hosted_checkout_buyer_binding.sql', import.meta.url), 'utf8');
const buyerBindingRollback = readFileSync(new URL('../../../../database/supabase/rollback/268_hosted_checkout_buyer_binding.rollback.sql', import.meta.url), 'utf8');
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

test('Task 003 checkout verifies signed handoff, uses idempotency, and queues review for a captured mismatch', () => {
    assert.match(routeSource, /canonicalCheckoutCartBinding/);
    assert.match(routeSource, /canonicalCheckoutHandoffPayload/);
    assert.match(routeSource, /cartDigest = c\.req\.query\('cart_digest'\)/);
    assert.match(routeSource, /timingSafeEqualHex\(expected, signature\)/);
    assert.match(routeSource, /new IdempotencyExecutionAdapter\(getSupabaseAdmin\(c\)\)/);
    assert.match(routeSource, /runIdempotentStep\(c,\s*verified\.handoff,\s*`checkout\.confirm:\$\{cartId\}`/);
    assert.match(routeSource, /revalidateConfirmInputs/);
    assert.match(routeSource, /inventory_reservations/);
    assert.match(routeSource, /coupons/);
    assert.match(routeSource, /compensation_actions/);
    assert.match(routeSource, /action:\s*'refund_captured_payment'/);
    assert.match(routeSource, /eventType:\s*'checkout\.completed'/);
    assert.match(routeSource, /eventType:\s*'checkout\.failed'/);
});

test('Wave 7 checkout confirm creates server order and posts provider capture to ledger', () => {
    assert.match(routeSource, /import \{ OrderExecutionAdapter \} from '\.\.\/execution\/order-execution\.adapter'/);
    assert.match(routeSource, /import \{ PaymentExecutionAdapter(?:, readCaptureResult)? \} from '\.\.\/execution\/payment-execution\.adapter'/);
    assert.match(routeSource, /createPublicStorefrontTenantContext/);
    assert.match(commandSource, /export function buildHostedCheckoutOrderCommand/);
    assert.match(routeSource, /const orderPlan = buildHostedCheckoutOrderCommand\(/);
    assert.match(routeSource, /new OrderExecutionAdapter\(db\)\.createOrder\(orderPlan\.command,\s*tenant\)/);
    assert.match(routeSource, /CHECKOUT_PROVIDER_PAYMENT_REQUIRED/);
    assert.match(routeSource, /verifyRazorpayPayment\(razorpayCredentials\.keySecret/);
    assert.match(routeSource, /storedProviderOrderId:\s*boundProviderOrderId/);
    assert.match(routeSource, /assertProviderPaymentNotReplayed\(c/);
    assert.match(routeSource, /razorpay_payment_id/);
    assert.doesNotMatch(routeSource, /body\.provider_payment_id/);
    assert.match(routeSource, /new PaymentExecutionAdapter\(db\)\.confirmPayment\(\{/);
    assert.match(routeSource, /const captureIdempotencyKey = `checkout\.confirm\.capture:\$\{orderId\}:\$\{body\.idempotency_key\}`/);
    assert.match(routeSource, /idempotencyKey:\s*captureIdempotencyKey/);
    assert.match(routeSource, /\.eq\('idempotency_key', captureIdempotencyKey\)/);
    assert.match(routeSource, /\.from\('ledger_transactions'\)[\s\S]*\.eq\('source_type', 'payment_capture'\)/);
    assert.match(routeSource, /capture_posted_to_ledger:\s*capturePostedToLedger/);
    assert.match(routeSource, /payload:\s*\{ channel: session\.channel \|\| 'web', order_id: orderId \}/);
});

test('hosted Razorpay intent creates and persists a server order before returning a public checkout binding', () => {
    const intentRoute = routeSource.slice(routeSource.indexOf("checkoutRouter.post('/:cartId/payment-intent'"), routeSource.indexOf("checkoutRouter.post('/:cartId/confirm'"));
    assert.match(intentRoute, /createRazorpayPaymentProvider/);
    assert.match(intentRoute, /loadStorefrontPayableOrder/);
    assert.match(intentRoute, /attachPaymentReference/);
    assert.match(intentRoute, /provider_order_id: providerOrderId/);
    assert.match(intentRoute, /mode !== 'sandbox'/);
    assert.match(intentRoute, /ENVIRONMENT === 'test' && c\.env\.HOSTED_RAZORPAY_TEST_ADAPTER/);
    assert.match(intentRoute, /PAYMENT_SETUP_REQUIRED/);
    assert.doesNotMatch(intentRoute, /payment_intent_id: `\$\{body\.provider\}_\$\{body\.mode\}/);
});

test('hosted Razorpay confirmation checks provider capture status and exact bound amount before ledger posting', () => {
    const confirmRoute = routeSource.slice(routeSource.indexOf("checkoutRouter.post('/:cartId/confirm'"), routeSource.indexOf("checkoutRouter.get('/:id'"));
    assert.match(confirmRoute, /fetchRazorpayPayment/);
    assert.match(confirmRoute, /providerPayment\.status !== 'captured' \|\| providerPayment\.captured !== true/);
    assert.match(confirmRoute, /providerPayment\.amount !== expectedAmountMinor/);
    assert.match(confirmRoute, /CHECKOUT_PROVIDER_CAPTURE_MISMATCH/);
    assert.match(confirmRoute, /retryable: true/);
    assert.match(confirmRoute, /readCaptureResult\(paidOrder\)/);
    assert.match(confirmRoute, /PAYMENT_CAPTURED_ORDER_UNFULFILLABLE/);
    assert.match(confirmRoute, /Failed to persist captured payment review action/);
});

test('hosted checkout binds only a verified buyer before origin transfer and confirms through the buyer-owned order RPC', () => {
    assert.match(buyerBindingMigration, /buyer_account_id uuid REFERENCES public\.buyer_accounts/);
    assert.match(buyerBindingMigration, /buyer_session_epoch integer/);
    assert.match(buyerBindingMigration, /CREATE FUNCTION public\.bind_hosted_checkout_buyer/);
    assert.match(buyerBindingMigration, /FOR SHARE/);
    assert.match(buyerBindingMigration, /already bound to another buyer/);
    assert.match(buyerBindingMigration, /GRANT EXECUTE[\s\S]*TO service_role/);
    assert.match(buyerBindingRollback, /DROP FUNCTION IF EXISTS public\.bind_hosted_checkout_buyer/);
    assert.match(routeSource, /session\.buyer_account_id/);
    assert.match(commandSource, /session\.buyer_session_epoch/);
    assert.match(routeSource, /new OrderExecutionAdapter\(db\)\.createOrder\(orderPlan\.command,\s*tenant\)/);
    assert.match(commandSource, /CHECKOUT_BUYER_BINDING_INVALID/);
});

test('Wave 7 checkout confirm fails closed for unsupported hosted payment methods', () => {
    assert.match(commandSource, /CHECKOUT_PAYMENT_METHOD_UNSUPPORTED/);
    assert.match(commandSource, /normalizeHostedCheckoutPaymentProvider/);
    assert.doesNotMatch(routeSource, /upi['"]\s*:\s*['"]razorpay/);
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

test('signed hosted delivery options use storefront quotes for storefront carts and preserve per-rate COD eligibility', () => {
    const deliveryOptionsRoute = routeSource.slice(routeSource.indexOf("checkoutRouter.get('/:cartId/delivery-options'"), routeSource.indexOf("checkoutRouter.post('/:cartId/contact'"));
    assert.match(deliveryOptionsRoute, /sales_origin === 'marketplace'[\s\S]*checkoutDeliveryOptions/);
    assert.match(deliveryOptionsRoute, /listStorefrontShippingRates\(db, verified\.handoff\.siteId, address, subtotalMinor\)/);
    assert.match(deliveryOptionsRoute, /cod_available: rate\.cod_available/);
});
