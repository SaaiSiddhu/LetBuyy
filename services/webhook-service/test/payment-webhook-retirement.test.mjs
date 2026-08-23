import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

// Phase M1 (LetBuyy DOC 03 row 11 "Payments": single capture adapter,
// MoR-on-own-Razorpay). Retires the Stripe/PayPal/Cashfree webhook ingress:
// after W1/W2 removed every live route that could create a Stripe/PayPal/
// Cashfree checkout session, nothing in the repository can ever generate a
// legitimate event for these endpoints to receive, so the ingress itself is
// pure attack surface with zero remaining functional value. Razorpay's
// webhook (money-affecting, real signature verification) is untouched.
//
// Uses source-text assertions rather than mounting the Hono app (the
// convention this package's own existing tests already use, e.g.
// gateway-order-transitions.test.mjs) -- mounting services/webhook-service's
// `app` under `node --test` resolved to a plain Object rather than a Hono
// instance in this workspace (a real, reproduced module-loading quirk, not
// a workaround chosen for convenience); text-source assertions do not
// depend on that and are what this package's test suite already relies on.

const testDir = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(join(testDir, "../src/index.ts"), "utf8");

test("no retired webhook route registration remains", () => {
    for (const pattern of [/app\.post\(\s*"\/stripe"/, /app\.post\(\s*"\/paypal"/, /app\.post\(\s*"\/cashfree"/]) {
        assert.doesNotMatch(indexSource, pattern);
    }
});

test("no retired provider wrapper function or adapter import remains", () => {
    for (const needle of [
        "stripeWebhookProvider",
        "paypalWebhookProvider",
        "cashfreeWebhookProvider",
        "syncStripeSubscription",
        "@letbuyy/infrastructure/stripe-adapter",
        "@letbuyy/infrastructure/paypal-adapter",
        "@letbuyy/infrastructure/cashfree-adapter",
    ]) {
        assert.ok(!indexSource.includes(needle), `must not contain "${needle}"`);
    }
});

test("the razorpay webhook handler is untouched: real signature verification, unchanged route", () => {
    assert.match(indexSource, /app\.post\(\s*"\/razorpay",\s*async \(c\) => \{/);
    assert.match(indexSource, /x-razorpay-signature/);
    assert.match(indexSource, /razorpayWebhookProvider\(c\.env\)\.webhookVerify/);
    assert.match(indexSource, /!timingSafeSignatureValid \|\| !verification\.verified/);
});

test("only one payment-provider webhook route remains registered", () => {
    const routeRegistrations = [...indexSource.matchAll(/^app\.post\("\/(\w+)",/gm)].map((m) => m[1]);
    const paymentProviderPaths = routeRegistrations.filter((path) =>
        ["razorpay", "stripe", "paypal", "cashfree"].includes(path));
    assert.deepEqual(paymentProviderPaths, ["razorpay"]);
});
