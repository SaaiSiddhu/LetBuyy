// LB-2: V1 ships Razorpay+COD only — Stripe and PayPal removed from buyer UI.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function read(relPath) {
  return readFileSync(join(repoRoot, relPath), 'utf8');
}

const checkoutClient = read(
  'apps/commerce/web/src/app/store/[subdomain]/checkout/checkout-client.tsx',
);
const successPage = read(
  'apps/commerce/web/src/app/store/[subdomain]/checkout/success/page.tsx',
);
const paypalReturnPage = read(
  'apps/commerce/web/src/app/store/[subdomain]/checkout/paypal-return/page.tsx',
);

test('LB-2(a): no Stripe handler or button label in checkout-client', () => {
  assert.doesNotMatch(checkoutClient, /handleStripeCheckout/i,
    'handleStripeCheckout handler must be removed');
  assert.doesNotMatch(checkoutClient, /Pay with Stripe/i,
    '"Pay with Stripe" button label must be removed');
  assert.doesNotMatch(checkoutClient, /payments\/stripe/i,
    'Stripe API call must be removed from checkout client');
});

test('LB-2(b): no PayPal handler or button label in checkout-client', () => {
  assert.doesNotMatch(checkoutClient, /handlePayPalCheckout/i,
    'handlePayPalCheckout handler must be removed');
  assert.doesNotMatch(checkoutClient, /Pay with PayPal/i,
    '"Pay with PayPal" button label must be removed');
  assert.doesNotMatch(checkoutClient, /payments\/paypal/i,
    'PayPal API call must be removed from checkout client');
});

test('LB-2(c): Razorpay and COD flows still present in checkout-client', () => {
  assert.match(checkoutClient, /razorpay/i,
    'Razorpay flow must remain in checkout client');
  assert.match(checkoutClient, /handleCODOrder/,
    'COD handler must remain in checkout client');
  assert.match(checkoutClient, /cod/i,
    'COD payment method must remain selectable');
});

test('LB-2(d): success/page.tsx no longer contains the hardcoded Stripe error string', () => {
  assert.doesNotMatch(successPage, /We could not verify this Stripe payment/,
    'Hardcoded Stripe error message must be removed from success page');
  // Functional Stripe constructs (imports, API calls, state machines) must be gone;
  // inline code-comments referencing Stripe for historical traceability are permitted.
  assert.doesNotMatch(successPage, /useSearchParams/,
    'Stripe session_id param logic must be removed from success page');
  assert.doesNotMatch(successPage, /session_id/,
    'Stripe session_id query param must be removed from success page');
  assert.doesNotMatch(successPage, /setStatus.*error/,
    'Hardcoded error status must be removed from success page');
});

test('LB-2(e): paypal-return/page.tsx no longer executes PayPal capture', () => {
  assert.doesNotMatch(paypalReturnPage, /payments\/paypal\/capture/,
    'PayPal capture API call must be removed from paypal-return page');
  assert.doesNotMatch(paypalReturnPage, /storefrontBrowserApiFetch/,
    'Active PayPal fetch logic must be removed from paypal-return page');
});

test('LB-2(f): both stub pages link to orders page (neutral fallback)', () => {
  assert.match(successPage, /\/orders/,
    'success page must link to /orders');
  assert.match(paypalReturnPage, /\/orders/,
    'paypal-return page must link to /orders');
});
