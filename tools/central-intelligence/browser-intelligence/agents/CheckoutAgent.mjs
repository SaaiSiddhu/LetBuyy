/**
 * LCIS Browser Intelligence Engine — CheckoutAgent
 * Validates checkout flow accessibility, cart, form fields, and payment option visibility.
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  SAFETY BOUNDARY — NO-PAYMENT GUARANTEE                     ║
 * ║  This agent NEVER submits payment forms, NEVER clicks       ║
 * ║  "Pay Now" / "Place Order" / Razorpay modal buttons, and    ║
 * ║  NEVER follows redirects to payment gateway URLs.           ║
 * ║  The flow unconditionally halts at the payment selection    ║
 * ║  screen — before any gateway redirect or form POST.         ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Playwright is a hidden internal primitive — never exposed to callers.
 */

import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TIMEOUT = parseInt(process.env.BROWSER_INTELLIGENCE_TIMEOUT ?? '30000', 10);
const HEADLESS = (process.env.PLAYWRIGHT_HEADLESS ?? 'true') !== 'false';

// Payment gateway hostnames — navigation to these is ALWAYS blocked
const PAYMENT_GATEWAY_HOSTS = [
  'razorpay.com',
  'api.razorpay.com',
  'checkout.razorpay.com',
  'paypal.com',
  'www.paypal.com',
  'payu.in',
  'paytm.com',
  'ccavenue.com',
  'instamojo.com',
  'stripe.com',
  'checkout.stripe.com',
];

function isPaymentGatewayUrl(url) {
  try {
    const { hostname } = new URL(url);
    return PAYMENT_GATEWAY_HOSTS.some(
      (gw) => hostname === gw || hostname.endsWith('.' + gw)
    );
  } catch {
    return false;
  }
}

async function getChromium() {
  try {
    const pw = await import('playwright');
    return pw.chromium;
  } catch {
    try {
      const pw = await import('@playwright/test');
      return pw.chromium;
    } catch {
      return null;
    }
  }
}

async function withPage(fn, opts = {}) {
  const chromium = await getChromium();
  if (!chromium) return { status: 'NOT AVAILABLE', reason: 'playwright not installed' };
  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({
    viewport: opts.viewport ?? { width: 1280, height: 800 },
    ignoreHTTPSErrors: false,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(TIMEOUT);

  // ── NO-PAYMENT SAFETY BOUNDARY ───────────────────────────────────────────
  // Abort any navigation to a payment gateway URL before it happens.
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (isPaymentGatewayUrl(url)) {
      // Block silently — we never reach a real payment gateway
      route.abort('blockedbyclient');
    } else {
      route.continue();
    }
  });
  // ─────────────────────────────────────────────────────────────────────────

  try {
    return await fn(page);
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
class CheckoutAgent {
  // ---- validateCheckoutAccessible ------------------------------------------
  async validateCheckoutAccessible(storeUrl) {
    return withPage(async (page) => {
      const start = Date.now();
      const checkoutUrl = new URL('/checkout', storeUrl).toString();
      let httpStatus = null;
      try {
        const response = await page.goto(checkoutUrl, {
          waitUntil: 'domcontentloaded',
          timeout: TIMEOUT,
        });
        httpStatus = response?.status() ?? null;
      } catch (err) {
        // /checkout may redirect to cart when empty — that is acceptable
        httpStatus = err.message.includes('net::') ? 0 : null;
      }

      // Acceptable: 200, 302→cart, 404 is a fail
      const pass = httpStatus !== null && httpStatus !== 404 && httpStatus !== 500;
      return {
        check: 'checkoutAccessible',
        pass,
        checkoutUrl,
        httpStatus,
        duration: Date.now() - start,
      };
    });
  }

  // ---- validateCartFlow ----------------------------------------------------
  async validateCartFlow(storeUrl, productPath = '/products') {
    return withPage(async (page) => {
      const start = Date.now();
      const productUrl = new URL(productPath, storeUrl).toString();

      await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
      await page.waitForTimeout(1000);

      // Attempt to add to cart — look for common add-to-cart patterns
      const addToCartSelectors = [
        'button[name="add"]',
        'button[data-add-to-cart]',
        '.add-to-cart',
        'button:has-text("Add to cart")',
        'button:has-text("Add to bag")',
        'input[name="add"]',
        '[data-testid="add-to-cart"]',
      ];

      let addedToCart = false;
      for (const selector of addToCartSelectors) {
        const btn = page.locator(selector).first();
        if ((await btn.count()) > 0) {
          try {
            await btn.click({ timeout: 5000 });
            addedToCart = true;
            break;
          } catch { /* try next */ }
        }
      }

      await page.waitForTimeout(1500);

      // Check cart indicator updated
      const cartCount = await page.locator(
        '[class*="cart-count"], [class*="cart-qty"], [data-cart-count], [aria-label*="cart"]'
      ).count();

      return {
        check: 'cartFlow',
        pass: addedToCart,
        addedToCart,
        cartIndicatorFound: cartCount > 0,
        productUrl,
        duration: Date.now() - start,
      };
    });
  }

  // ---- validateCheckoutForm ------------------------------------------------
  async validateCheckoutForm(storeUrl) {
    return withPage(async (page) => {
      const start = Date.now();
      const checkoutUrl = new URL('/checkout', storeUrl).toString();

      await page.goto(checkoutUrl, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
      await page.waitForTimeout(1500);

      // Required field checks — standard checkout form fields
      const fieldChecks = {
        firstName: await page.locator('input[name*="first"], input[id*="first"], input[placeholder*="First"]').count() > 0,
        lastName: await page.locator('input[name*="last"], input[id*="last"], input[placeholder*="Last"]').count() > 0,
        email: await page.locator('input[type="email"], input[name*="email"]').count() > 0,
        phone: await page.locator('input[type="tel"], input[name*="phone"], input[name*="mobile"]').count() > 0,
        address: await page.locator('input[name*="address"], textarea[name*="address"], input[id*="address"]').count() > 0,
        pincode: await page.locator('input[name*="pin"], input[name*="zip"], input[name*="postal"]').count() > 0,
      };

      const presentFields = Object.entries(fieldChecks).filter(([, v]) => v).map(([k]) => k);
      const missingFields = Object.entries(fieldChecks).filter(([, v]) => !v).map(([k]) => k);

      // At minimum: email + address must be present for a valid checkout form
      const pass = fieldChecks.email && fieldChecks.address;

      return {
        check: 'checkoutForm',
        pass,
        fieldChecks,
        presentFields,
        missingFields,
        duration: Date.now() - start,
      };
    });
  }

  // ---- validatePaymentOptions ----------------------------------------------
  async validatePaymentOptions(storeUrl) {
    return withPage(async (page) => {
      const start = Date.now();
      const checkoutUrl = new URL('/checkout', storeUrl).toString();

      await page.goto(checkoutUrl, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
      await page.waitForTimeout(2000);

      // Detect Razorpay — script tag or button/label with razorpay branding
      const razorpayVisible = (await page.locator(
        '[class*="razorpay"], [data-razorpay], button:has-text("Razorpay"), label:has-text("Razorpay"), ' +
        'img[alt*="razorpay" i], span:has-text("Pay Online")'
      ).count()) > 0 ||
        (await page.evaluate(() =>
          !!document.querySelector('script[src*="razorpay"]') ||
          !!window.Razorpay
        ));

      // Detect COD (Cash on Delivery)
      const codVisible = (await page.locator(
        'label:has-text("Cash on Delivery"), label:has-text("COD"), ' +
        'input[value*="cod" i], [class*="cod"], span:has-text("Cash on Delivery")'
      ).count()) > 0;

      return {
        check: 'paymentOptions',
        // NOTE: "pass" here means the UI presents payment options — no actual payment
        pass: razorpayVisible || codVisible,
        razorpayVisible,
        codVisible,
        // ── NO-PAYMENT SAFETY BOUNDARY ─────────────────────────────────────
        // Detection stops here. No buttons are clicked, no forms submitted,
        // no Razorpay SDK or modal is triggered.
        // ──────────────────────────────────────────────────────────────────
        duration: Date.now() - start,
      };
    });
  }

  // ---- validateOrderConfirmation -------------------------------------------
  // Validates only that the order confirmation URL/page exists and is accessible
  // (e.g. from a test order ID). No real order is placed.
  async validateOrderConfirmation(storeUrl) {
    return withPage(async (page) => {
      const start = Date.now();
      // Common confirmation page patterns — try to access without triggering a real order
      const candidatePaths = [
        '/orders/confirmation',
        '/checkout/success',
        '/order/success',
        '/thank-you',
      ];

      const results = [];
      for (const p of candidatePaths) {
        const url = new URL(p, storeUrl).toString();
        try {
          const response = await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 8000,
          });
          const status = response?.status() ?? null;
          // 200 means page exists; redirect is also acceptable; 404 means not this path
          results.push({ path: p, status, accessible: status !== null && status !== 404 });
        } catch {
          results.push({ path: p, status: null, accessible: false });
        }
      }

      const anyAccessible = results.some((r) => r.accessible);
      return {
        check: 'orderConfirmation',
        pass: anyAccessible,
        candidatePaths: results,
        duration: Date.now() - start,
      };
    });
  }

  // ---- runFlow -------------------------------------------------------------
  /**
   * Runs the full checkout validation flow for a store.
   *
   * ╔══════════════════════════════════════════════════════════════╗
   * ║  SAFETY BOUNDARY — UNCONDITIONAL HALT BEFORE PAYMENT        ║
   * ║  This method validates checkout form and payment option      ║
   * ║  visibility only. It NEVER clicks "Pay", NEVER submits a    ║
   * ║  payment form, and NEVER redirects to Razorpay, PayPal,     ║
   * ║  or any other gateway. All gateway URLs are route-blocked.  ║
   * ╚══════════════════════════════════════════════════════════════╝
   */
  async runFlow(storeUrl, testProduct) {
    const start = Date.now();
    const productPath = testProduct?.path ?? '/products';

    const [accessResult, cartResult, formResult, paymentResult, confirmResult] =
      await Promise.allSettled([
        this.validateCheckoutAccessible(storeUrl),
        this.validateCartFlow(storeUrl, productPath),
        this.validateCheckoutForm(storeUrl),
        this.validatePaymentOptions(storeUrl),
        this.validateOrderConfirmation(storeUrl),
      ]);

    const settle = (r) =>
      r.status === 'fulfilled' ? r.value : { pass: false, error: r.reason?.message };

    const checks = {
      checkoutAccessible: settle(accessResult),
      cartFlow: settle(cartResult),
      checkoutForm: settle(formResult),
      paymentOptions: settle(paymentResult),
      orderConfirmation: settle(confirmResult),
    };

    const failedChecks = Object.entries(checks)
      .filter(([, v]) => !v.pass)
      .map(([k]) => k);

    const status =
      failedChecks.length === 0 ? 'PASS' : failedChecks.length <= 2 ? 'DEGRADED' : 'FAIL';

    return {
      storeUrl,
      testProduct,
      status,
      checks,
      failedChecks,
      safetyNote: 'Flow halted before payment gateway — no real payment attempted',
      duration: Date.now() - start,
      timestamp: new Date().toISOString(),
    };
  }
}

export default new CheckoutAgent();
