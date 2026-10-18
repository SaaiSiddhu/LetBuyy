// Synthetic local test credentials only: owned disposable accounts, stub provider identifiers,
// and public challenge test fixtures. Never use these values for a real account or live provider.
// Exact value hashes are reviewed in config/governance/secret-scan-exceptions.json.
// Real Commerce + Gateway + owned Postgres checkout journey in Chromium.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createServer, type IncomingMessage } from 'node:http';
import { once } from 'node:events';
import { join } from 'node:path';
import test, { after, before } from 'node:test';
import { chromium, type Browser } from '@playwright/test';
import worker from '../../index';
import { INTERNAL_SECRET, gatewayEnv, newIdentityKeys } from './gateway-harness';
import { requireOwnedDatabase, startOwnedClientRuntime, stopOwnedClientRuntime, type OwnedClientProcess } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';
import type { PaymentCreateIntentInput, PaymentIntentResult } from '@letbuyy/payments';

const owned = requireOwnedDatabase();
const site = newSyntheticTenant('browser-checkout');
const signingSecret = 'synthetic-browser-checkout-signing-secret';
const razorpayKeySecret = 'synthetic-browser-razorpay-secret';
const razorpayOrderId = `order_${crypto.randomUUID().replace(/-/g, '')}`;
const razorpayPaymentId = `pay_${crypto.randomUUID().replace(/-/g, '')}`;
let razorpayAmountMinor = 0;
const razorpaySignature = createHmac('sha256', razorpayKeySecret).update(`${razorpayOrderId}|${razorpayPaymentId}`).digest('hex');
const hostedRazorpayTestAdapter = {
    async createIntent(input: PaymentCreateIntentInput): Promise<PaymentIntentResult> {
        razorpayAmountMinor = input.amount.amountMinor;
        return {
            provider: 'razorpay',
            status: 'requires_action',
            amount: input.amount,
            idempotencyKey: input.idempotencyKey as PaymentIntentResult['idempotencyKey'],
            references: { providerOrderId: razorpayOrderId },
            metadata: input.metadata,
        };
    },
    async fetchOrdersByReceipt() {
        return { items: [], count: 0 };
    },
    async fetchPayment(paymentId: string) {
        return {
            id: paymentId,
            order_id: razorpayOrderId,
            amount: razorpayAmountMinor,
            currency: 'INR',
            status: 'captured',
            captured: true,
        };
    },
};
const zoneId = crypto.randomUUID();
const codRateId = crypto.randomUUID();
const onlineRateId = crypto.randomUUID();
const productId = crypto.randomUUID();
const cartId = crypto.randomUUID();
const cartToken = `ct_${crypto.randomUUID().replace(/-/g, '')}`;
const appEnv = {
    NODE_ENV: 'development',
    CI: '1',
    NEXT_TELEMETRY_DISABLED: '1',
};
let server: ReturnType<typeof createServer>;
let app: OwnedClientProcess | undefined;
let browser: Browser | undefined;
let appPort = 0;
let background: Promise<unknown>[] = [];
const notificationJobs: Array<Record<string, unknown>> = [];

function readBody(req: IncomingMessage): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on('data', chunk => chunks.push(Buffer.from(chunk)));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
    });
}

async function waitForApp(origin: string): Promise<void> {
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
        if (app?.exitCode !== null && app?.exitCode !== undefined) throw new Error(`Commerce Next exited with ${app.exitCode}`);
        try {
            const response = await fetch(`${origin}/api/checkout-handoff`, { method: 'GET' });
            if (response.status === 405) return;
        } catch { /* wait for Next to bind */ }
        await new Promise(resolve => setTimeout(resolve, 400));
    }
    throw new Error('Commerce Next did not become ready within 120 seconds');
}

before(async () => {
    seedSyntheticTenant(owned.psql, site, { gst: true, taxRates: true });
    owned.psql(`
      INSERT INTO products (id,store_id,name,price,sku,is_active,created_at,updated_at)
      VALUES ('${productId}','${site.siteId}','Synthetic browser checkout product',199.00,'SYN-BROWSER-${productId}',true,now(),now());
      INSERT INTO inventory_levels (id,store_id,product_id,variant_id,location_id,available,reserved,committed_quantity,available_quantity,reserved_quantity,on_hand_quantity,created_at,updated_at)
      VALUES (gen_random_uuid(),'${site.siteId}','${productId}',NULL,'${site.locationId}',25,0,0,25,0,25,now(),now());
      INSERT INTO shipping_zones (id,store_id,site_id,name,countries,states,zip_codes,cod_enabled)
      VALUES ('${zoneId}','${site.siteId}','${site.siteId}','Synthetic Bengaluru zone',ARRAY['IN'],ARRAY['Karnataka','29'],ARRAY['560001'],true);
      INSERT INTO shipping_rates (id,zone_id,site_id,name,type,price,is_active,cod_enabled)
      VALUES ('${codRateId}','${zoneId}','${site.siteId}','COD delivery','flat',20.00,true,true),
             ('${onlineRateId}','${zoneId}','${site.siteId}','Online delivery','flat',12.00,true,false);
      INSERT INTO carts (id,store_id,session_id,items,status,channel,expires_at)
      VALUES ('${cartId}','${site.siteId}','${cartToken}',
        '[{"id":"${productId}","product_id":"${productId}","variant_id":null,"title":"Synthetic browser checkout product","sku":"SYN-BROWSER-${productId}","image_url":null,"quantity":1,"unit_price":199,"currency":"INR","properties":{},"line_total":199}]'::jsonb,
        'active','web',now()+interval '1 day');
    `);

    const keys = await newIdentityKeys();
    const env = gatewayEnv(owned, keys, {
        CHECKOUT_SIGNING_SECRET: signingSecret,
        CHECKOUT_ORIGIN: 'http://checkout.localhost',
        NEXT_PUBLIC_STORE_ROOT_DOMAIN: 'localhost',
        CUSTOMER_SESSION_SECRET: 'synthetic-browser-customer-session-secret-at-least-32-bytes',
        LETBUYY_RAZORPAY_MODE: 'sandbox',
        RAZORPAY_KEY_ID: 'rzp_test_browser_synthetic',
        RAZORPAY_KEY_SECRET: razorpayKeySecret,
        QUEUE_TENANT_ENVELOPE_SECRET: 'synthetic-browser-checkout-notification-secret',
        NOTIFICATION_QUEUE: {
            send: async (body: Record<string, unknown>) => { notificationJobs.push(body); },
        },
        HOSTED_RAZORPAY_TEST_ADAPTER: hostedRazorpayTestAdapter,
    });
    server = createServer(async (req, res) => {
        try {
            const body = await readBody(req);
            const headers = new Headers();
            for (let i = 0; i < req.rawHeaders.length; i += 2) headers.append(req.rawHeaders[i], req.rawHeaders[i + 1]);
            headers.set('CF-Connecting-IP', '2001:db8:feed::1');
            const context = {
                waitUntil: (work: Promise<unknown>) => background.push(Promise.resolve(work).catch(() => undefined)),
                passThroughOnException: () => undefined,
            };
            const request = new Request(`https://gateway.test${req.url || '/'}`, {
                method: req.method,
                headers,
                ...(body.length && req.method !== 'GET' && req.method !== 'HEAD' ? { body, duplex: 'half' as const } : {}),
            });
            const response = await worker.fetch(request, env, context as never);
            res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
            res.end(Buffer.from(await response.arrayBuffer()));
            if (background.length) await Promise.allSettled(background.splice(0));
        } catch (error) {
            res.writeHead(500, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'gateway bridge failed' }));
        }
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const gatewayPort = (server.address() as { port: number }).port;
    const portProbe = createServer();
    portProbe.listen(0, '127.0.0.1');
    await once(portProbe, 'listening');
    appPort = (portProbe.address() as { port: number }).port;
    await new Promise<void>((resolve, reject) => portProbe.close(error => error ? reject(error) : resolve()));
    (env as unknown as Record<string, unknown>).CHECKOUT_ORIGIN = `http://checkout.localhost:${appPort}`;

    app = startOwnedClientRuntime(owned, 'commerce-next', {
        port: appPort,
        env: {
            ...appEnv,
            LETBUYY_API_BASE_URL: `http://127.0.0.1:${gatewayPort}/v1`,
            LETBUYY_API_URL: `http://127.0.0.1:${gatewayPort}/v1`,
            NEXT_PUBLIC_API_BASE_URL: `http://127.0.0.1:${gatewayPort}/v1`,
            NEXT_PUBLIC_API_URL: `http://127.0.0.1:${gatewayPort}/v1`,
            INTERNAL_API_SECRET: INTERNAL_SECRET,
            LETBUYY_INTERNAL_API_SECRET: INTERNAL_SECRET,
            NEXT_PUBLIC_STORE_ROOT_DOMAIN: 'localhost',
            CHECKOUT_ORIGIN: `http://checkout.localhost:${appPort}`,
        },
    });
    await waitForApp(`http://127.0.0.1:${appPort}`);
    browser = await chromium.launch({ headless: true });
});

after(async () => {
    await browser?.close();
    await stopOwnedClientRuntime(app);
    if (server?.listening) await new Promise<void>(resolve => server.close(() => resolve()));
    await Promise.allSettled(background.splice(0));
});

test('buyer selects actual saved storefront rate and completes normal hosted COD checkout', async () => {
    assert.ok(browser);
    const context = await browser.newContext();
    await context.addInitScript(({ token, items }) => {
        (globalThis as any).localStorage.setItem('lb_cart_token', token);
        (globalThis as any).localStorage.setItem('lb_cart', JSON.stringify(items));
    }, {
        token: cartToken,
        items: [{ id: productId, name: 'Synthetic browser checkout product', price: 199, currency: 'INR', images: [], stock: 25, quantity: 1 }],
    });
    const page = await context.newPage();
    const pageErrors: string[] = [];
    const handoffTrace: string[] = [];
    const checkoutApiTrace: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('request', request => { if (request.url().includes('/api/checkout-handoff')) handoffTrace.push(`request ${request.method()} ${request.url()}`); });
    page.on('response', async response => { if (response.url().includes('/api/checkout-handoff')) handoffTrace.push(`response ${response.status()} ${response.url()} ${(await response.text().catch(() => '')).slice(0, 300)}`); });
    page.on('requestfailed', request => { if (request.url().includes('/api/checkout-handoff')) handoffTrace.push(`failed ${request.url()} ${request.failure()?.errorText}`); });
    page.on('request', request => { if (request.url().includes('/api/checkout/')) checkoutApiTrace.push(`request ${request.method()} ${request.url()} headers=${JSON.stringify(request.headers())}`); });
    page.on('response', async response => { if (response.url().includes('/api/checkout/')) checkoutApiTrace.push(`response ${response.status()} ${response.url()} ${(await response.text().catch(() => '')).slice(0, 400)}`); });
    await page.goto(`http://${site.subdomain}.localhost:${appPort}/checkout`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => (globalThis as any).location.hostname.startsWith('checkout.localhost')
        || (globalThis as any).document.body.innerText.includes('temporarily unavailable'), { timeout: 15_000 }).catch(() => undefined);
    assert.ok(page.url().includes('checkout.localhost'), `storefront did not hand off to hosted checkout (url=${page.url()}, cart=${await page.evaluate(() => (globalThis as any).localStorage.getItem('lb_cart_token'))}, body=${(await page.locator('body').innerText()).slice(0, 500)}, errors=${pageErrors.join(' | ')}, handoff=${handoffTrace.join(' | ')})`);
    await page.waitForLoadState('networkidle');
    await page.getByPlaceholder('John Doe').fill('Synthetic Browser Buyer');
    await page.getByPlaceholder('9876543210').fill('9000000099');
    await page.getByPlaceholder('john@example.com').fill('browser-buyer@example.invalid');
    await page.getByPlaceholder('House/Flat No, Street, Landmark...').fill('Synthetic Fixture Road');
    await page.getByPlaceholder('Bengaluru').fill('Bengaluru');
    await page.locator('select').first().selectOption('29');
    await page.getByPlaceholder('560001').fill('560001');
    const addressState = await page.evaluate(() => ({
        selectedState: (globalThis as any).document.querySelector('select')?.value,
        pincode: (globalThis as any).document.querySelector('input[placeholder="560001"]')?.value,
    }));
    const codDelivery = page.getByRole('button', { name: /COD delivery/ });
    await codDelivery.waitFor({ state: 'visible', timeout: 20_000 }).catch(async error => {
        throw new Error(`shipping quote did not render: ${error instanceof Error ? error.message : error}; address=${JSON.stringify(addressState)}; body=${(await page.locator('body').innerText()).slice(0, 1200)}; checkoutApi=${checkoutApiTrace.join(' | ')}; errors=${pageErrors.join(' | ')}`);
    });
    await page.getByRole('button', { name: /Online delivery/ }).click();
    await page.getByRole('button', { name: 'Continue to Payment' }).click();
    const codRadio = page.getByRole('radio', { name: /Cash on Delivery \(COD\)/ });
    await codRadio.waitFor({ state: 'visible' });
    assert.equal(await codRadio.isDisabled(), true, 'online-only saved rate must disable COD in the real checkout UI');
    await page.getByRole('button', { name: 'Change' }).click();
    await codDelivery.click();
    await page.getByRole('button', { name: 'Continue to Payment' }).click();
    const enabledCodRadio = page.getByRole('radio', { name: /Cash on Delivery \(COD\)/ });
    await enabledCodRadio.waitFor({ state: 'visible' });
    assert.equal(await enabledCodRadio.isDisabled(), false, 'COD must be available for the COD-enabled saved rate');
    await enabledCodRadio.check();
    assert.equal(await enabledCodRadio.isChecked(), true, 'the buyer explicitly selects COD after changing delivery rates');
    await page.getByRole('button', { name: 'Confirm COD order' }).click();
    await page.getByRole('heading', { name: 'Order Confirmed!' }).waitFor({ timeout: 30_000 });

    const rows = JSON.parse(owned.psql(`
      SELECT COALESCE(json_agg(json_build_object('order_id',o.id,'rate_id',osl.metadata->>'shipping_rate_id','amount',osl.amount::numeric,'payment_method',o.payment_method)), '[]'::json)
      FROM orders o JOIN order_shipping_lines osl ON osl.order_id=o.id
      WHERE o.site_id='${site.siteId}' AND o.customer_email='browser-buyer@example.invalid';
    `)) as Array<{ order_id: string; rate_id: string; amount: number; payment_method: string }>;
    assert.equal(rows.length, 1, 'the browser journey creates exactly one order');
    assert.equal(rows[0].rate_id, codRateId, 'persisted order is bound to the reviewed COD rate');
    assert.equal(Number(rows[0].amount), 20);
    assert.equal(rows[0].payment_method, 'cod');
    assert.equal(owned.psql(`SELECT count(*) FROM outbox_events WHERE store_id='${site.siteId}' AND aggregate_id='${rows[0].order_id}' AND event_type='order.paid';`), '0', 'an unpaid COD order is not announced as paid');
    assert.equal(notificationJobs.length, 0, 'an unpaid COD order does not queue a paid-order email');
    assert.deepEqual(pageErrors, []);
    await context.close();
});

test('buyer reviews a refreshed storefront quote before recovering from a changed delivery price', async () => {
    assert.ok(browser);
    const browserCartId = crypto.randomUUID();
    const browserCartToken = `ct_${crypto.randomUUID().replace(/-/g, '')}`;
    const email = `browser-stale-quote-${crypto.randomUUID()}@example.invalid`;
    owned.psql(`
      INSERT INTO carts (id,store_id,session_id,items,status,channel,expires_at)
      VALUES ('${browserCartId}','${site.siteId}','${browserCartToken}',
        '[{"id":"${productId}","product_id":"${productId}","variant_id":null,"title":"Synthetic browser checkout product","sku":"SYN-BROWSER-${productId}","image_url":null,"quantity":1,"unit_price":199,"currency":"INR","properties":{},"line_total":199}]'::jsonb,
        'active','web',now()+interval '1 day');
    `);
    const context = await browser.newContext();
    await context.addInitScript(({ token, items }) => {
        (globalThis as any).localStorage.setItem('lb_cart_token', token);
        (globalThis as any).localStorage.setItem('lb_cart', JSON.stringify(items));
    }, {
        token: browserCartToken,
        items: [{ id: productId, name: 'Synthetic browser checkout product', price: 199, currency: 'INR', images: [], stock: 25, quantity: 1 }],
    });
    const page = await context.newPage();
    let changedRate = false;
    let reviewedAmount: unknown;
    let paymentIntentRequests = 0;
    page.on('request', request => {
        const url = new URL(request.url());
        if (url.pathname.endsWith(`/${browserCartId}/payment-intent`)) paymentIntentRequests += 1;
    });
    await page.route('**/api/checkout/**', async route => {
        const request = route.request();
        const url = new URL(request.url());
        if (!changedRate && request.method() === 'POST' && url.pathname.endsWith(`/${browserCartId}/delivery`)) {
            const body = request.postDataJSON() as { shipping_quote?: { expected_shipping_amount?: unknown } };
            reviewedAmount = body.shipping_quote?.expected_shipping_amount;
            owned.psql(`UPDATE shipping_rates SET price=25.00 WHERE id='${codRateId}';`);
            changedRate = true;
        }
        await route.continue();
    });

    await page.goto(`http://${site.subdomain}.localhost:${appPort}/checkout`, { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/checkout\.localhost/);
    await page.waitForLoadState('networkidle');
    await page.getByPlaceholder('John Doe').fill('Synthetic Stale Quote Buyer');
    await page.getByPlaceholder('9876543210').fill('9000000077');
    await page.getByPlaceholder('john@example.com').fill(email);
    await page.getByPlaceholder('House/Flat No, Street, Landmark...').fill('Synthetic Quote Fixture Road');
    await page.getByPlaceholder('Bengaluru').fill('Bengaluru');
    await page.locator('select').first().selectOption('29');
    await page.getByPlaceholder('560001').fill('560001');
    const codDelivery = page.getByRole('button', { name: /COD delivery/ });
    await codDelivery.waitFor({ state: 'visible', timeout: 20_000 });
    assert.match(await codDelivery.innerText(), /₹20/);
    await codDelivery.click();
    await page.getByRole('button', { name: 'Continue to Payment' }).click();
    await page.getByRole('radio', { name: /Cash on Delivery \(COD\)/ }).check();

    const staleDeliveryResponse = page.waitForResponse(response => {
        const url = new URL(response.url());
        return response.request().method() === 'POST'
            && url.pathname.endsWith(`/${browserCartId}/delivery`)
            && response.status() === 409;
    });
    await page.getByRole('button', { name: 'Confirm COD order' }).click();
    await staleDeliveryResponse;
    assert.equal(changedRate, true, 'the saved delivery rate changes after the buyer reviews the original quote');
    assert.equal(reviewedAmount, 20, 'the checkout sends the buyer-reviewed amount, not a client-invented total');
    assert.equal(paymentIntentRequests, 0, 'checkout stops before payment-intent creation when the reviewed delivery quote is stale');
    await page.getByRole('alert').getByText('The delivery price changed. Review the updated delivery option and try again.').waitFor({ timeout: 10_000 });
    assert.equal(owned.psql(`SELECT count(*) FROM orders WHERE site_id='${site.siteId}' AND customer_email='${email}';`), '0',
        'a stale delivery quote cannot create an order');

    await page.getByRole('button', { name: 'Change' }).click();
    const refreshedCodDelivery = page.getByRole('button').filter({ hasText: 'COD delivery' });
    await refreshedCodDelivery.waitFor({ state: 'visible', timeout: 10_000 });
    assert.match(await refreshedCodDelivery.innerText(), /₹25/,
        'recovery shows the new server-backed price before the buyer can continue');
    assert.equal(await refreshedCodDelivery.getAttribute('aria-pressed'), 'false',
        'the buyer must explicitly reselect the refreshed quote');
    await refreshedCodDelivery.click();
    await page.getByRole('button', { name: 'Continue to Payment' }).click();
    const recoveredCodRadio = page.getByRole('radio', { name: /Cash on Delivery \(COD\)/ });
    await recoveredCodRadio.waitFor({ state: 'visible' });
    await recoveredCodRadio.check();
    await page.getByRole('button', { name: 'Confirm COD order' }).click();
    await page.getByRole('heading', { name: 'Order Confirmed!' }).waitFor({ timeout: 30_000 });

    const orders = JSON.parse(owned.psql(`
      SELECT COALESCE(json_agg(json_build_object('order_id',o.id,'rate_id',osl.metadata->>'shipping_rate_id','amount',osl.amount::numeric,'payment_method',o.payment_method)), '[]'::json)
      FROM orders o JOIN order_shipping_lines osl ON osl.order_id=o.id
      WHERE o.site_id='${site.siteId}' AND o.customer_email='${email}';
    `)) as Array<{ order_id: string; rate_id: string; amount: number; payment_method: string }>;
    assert.equal(orders.length, 1, 'retrying with the new quote creates exactly one order');
    assert.equal(orders[0].rate_id, codRateId);
    assert.equal(Number(orders[0].amount), 25);
    assert.equal(orders[0].payment_method, 'cod');
    assert.equal(owned.psql(`SELECT count(*) FROM outbox_events WHERE store_id='${site.siteId}' AND aggregate_id='${orders[0].order_id}' AND event_type='order.paid';`), '0');
    await context.close();
});

test('buyer completes hosted Razorpay through the signed checkout API and canonical capture path', async () => {
    assert.ok(browser);
    const browserCartId = crypto.randomUUID();
    const browserCartToken = `ct_${crypto.randomUUID().replace(/-/g, '')}`;
    owned.psql(`
      INSERT INTO carts (id,store_id,session_id,items,status,channel,expires_at)
      VALUES ('${browserCartId}','${site.siteId}','${browserCartToken}',
        '[{"id":"${productId}","product_id":"${productId}","variant_id":null,"title":"Synthetic browser checkout product","sku":"SYN-BROWSER-${productId}","image_url":null,"quantity":1,"unit_price":199,"currency":"INR","properties":{},"line_total":199}]'::jsonb,
        'active','web',now()+interval '1 day');
    `);
    const context = await browser.newContext();
    await context.addInitScript(({ token, items }) => {
        (globalThis as any).localStorage.setItem('lb_cart_token', token);
        (globalThis as any).localStorage.setItem('lb_cart', JSON.stringify(items));
    }, {
        token: browserCartToken,
        items: [{ id: productId, name: 'Synthetic browser checkout product', price: 199, currency: 'INR', images: [], stock: 25, quantity: 1 }],
    });
    const page = await context.newPage();
    const pageErrors: string[] = [];
    await page.route('https://checkout.razorpay.com/v1/checkout.js**', route => route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: `window.Razorpay = class { constructor(options) { this.options = options; } on() {} open() { void this.options.handler({ razorpay_order_id: '${razorpayOrderId}', razorpay_payment_id: '${razorpayPaymentId}', razorpay_signature: '${razorpaySignature}' }); } };`,
    }));
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto(`http://${site.subdomain}.localhost:${appPort}/checkout`, { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/checkout\.localhost/);
    await page.waitForLoadState('networkidle');
    await page.getByPlaceholder('John Doe').fill('Synthetic Online Buyer');
    await page.getByPlaceholder('9876543210').fill('9000000088');
    await page.getByPlaceholder('john@example.com').fill('browser-online@example.invalid');
    await page.getByPlaceholder('House/Flat No, Street, Landmark...').fill('Synthetic Online Fixture Road');
    await page.getByPlaceholder('Bengaluru').fill('Bengaluru');
    await page.locator('select').first().selectOption('29');
    await page.getByPlaceholder('560001').fill('560001');
    const onlineDelivery = page.getByRole('button', { name: /Online delivery/ });
    await onlineDelivery.waitFor({ state: 'visible', timeout: 20_000 });
    await onlineDelivery.click();
    await page.getByRole('button', { name: 'Continue to Payment' }).click();
    const onlineRadio = page.getByRole('radio', { name: /Pay Online \(Razorpay\)/ });
    await onlineRadio.waitFor({ state: 'visible' });
    assert.equal(await onlineRadio.isChecked(), true, 'hosted online payment is available when the store enables it');
    assert.equal(await page.getByRole('radio', { name: /Cash on Delivery \(COD\)/ }).isDisabled(), true,
        'the online-only saved rate must deny COD');
    const payButton = page.getByRole('button', { name: /Pay ₹/ });
    await payButton.waitFor({ state: 'visible' });
    assert.equal(await payButton.isEnabled(), true, 'the online checkout action is enabled after loading the provider script');
    await payButton.click();
    await page.getByRole('heading', { name: 'Order Confirmed!' }).waitFor({ timeout: 30_000 });

    const rows = JSON.parse(owned.psql(`
      SELECT COALESCE(json_agg(json_build_object('id',o.id,'status',o.status,'payment_status',o.payment_status,'payment_method',o.payment_method,'email',o.customer_email,
        'total_minor',(o.total*100)::bigint,'shipping_rate_id',osl.metadata->>'shipping_rate_id','shipping_minor',(osl.amount*100)::bigint)), '[]'::json)
      FROM orders o JOIN order_shipping_lines osl ON osl.order_id=o.id
      WHERE o.site_id='${site.siteId}' AND o.customer_email='browser-online@example.invalid';
    `)) as Array<{ id: string; status: string; payment_status: string; payment_method: string; email: string; total_minor: string; shipping_rate_id: string; shipping_minor: string }>;
    assert.equal(rows.length, 1, 'a provider callback retry must not create a second order');
    assert.equal(rows[0].status, 'confirmed', 'a normally captured order is confirmed and remains fulfillable');
    assert.equal(rows[0].payment_status, 'paid', 'the separate payment state records the verified capture');
    assert.equal(rows[0].payment_method, 'razorpay');
    assert.equal(rows[0].shipping_rate_id, onlineRateId);
    assert.equal(Number(rows[0].shipping_minor), 1200, 'the order uses the buyer-selected online delivery rate');
    assert.equal(razorpayAmountMinor, Number(rows[0].total_minor), 'provider amount matches the full Gateway-priced total');
    assert.equal(owned.psql(`SELECT count(*) FROM payment_transactions WHERE order_id='${rows[0].id}' AND provider_payment_id='${razorpayPaymentId}' AND status='captured';`), '1');
    assert.equal(owned.psql(`SELECT count(*) FROM ledger_transactions WHERE site_id='${site.siteId}' AND source_type='payment_capture' AND source_id='razorpay:${razorpayPaymentId}';`), '1');
    assert.equal(owned.psql(`SELECT count(*) FROM outbox_events WHERE store_id='${site.siteId}' AND aggregate_id='${rows[0].id}' AND event_type='order.paid';`), '1');
    assert.equal(notificationJobs.length, 1, 'a captured order queues exactly one confirmation email');
    assert.equal(notificationJobs[0].jobType, 'email.order_confirmation');
    assert.equal(notificationJobs[0].siteId, site.siteId);
    assert.equal(notificationJobs[0].idempotencyKey, `email.order_confirmation:${site.siteId}:${rows[0].id}`);
    assert.equal((notificationJobs[0].tenantEnvelope as { siteId?: string } | undefined)?.siteId, site.siteId);
    assert.match(JSON.stringify(notificationJobs[0].payload), /Synthetic browser checkout product/);
    assert.deepEqual(pageErrors, []);
    await context.close();
});

test('buyer sees a safe recoverable message when inventory changes before COD confirmation', async () => {
    assert.ok(browser);
    const browserCartId = crypto.randomUUID();
    const browserCartToken = `ct_${crypto.randomUUID().replace(/-/g, '')}`;
    const email = `browser-stale-inventory-${crypto.randomUUID()}@example.invalid`;
    owned.psql(`
      INSERT INTO carts (id,store_id,session_id,items,status,channel,expires_at)
      VALUES ('${browserCartId}','${site.siteId}','${browserCartToken}',
        '[{"id":"${productId}","product_id":"${productId}","variant_id":null,"title":"Synthetic browser checkout product","sku":"SYN-BROWSER-${productId}","image_url":null,"quantity":1,"unit_price":199,"currency":"INR","properties":{},"line_total":199}]'::jsonb,
        'active','web',now()+interval '1 day');
    `);
    const context = await browser.newContext();
    await context.addInitScript(({ token, items }) => {
        (globalThis as any).localStorage.setItem('lb_cart_token', token);
        (globalThis as any).localStorage.setItem('lb_cart', JSON.stringify(items));
    }, {
        token: browserCartToken,
        items: [{ id: productId, name: 'Synthetic browser checkout product', price: 199, currency: 'INR', images: [], stock: 25, quantity: 1 }],
    });
    const page = await context.newPage();
    const pageErrors: string[] = [];
    const confirmIdempotencyKeys: string[] = [];
    let inventoryChangedBeforeConfirm = false;
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.route('**/api/checkout/**', async route => {
        const request = route.request();
        const url = new URL(request.url());
        if (request.method() === 'POST' && url.pathname.endsWith(`/${browserCartId}/confirm`)) {
            confirmIdempotencyKeys.push(String(request.postDataJSON()?.idempotency_key ?? ''));
        }
        if (!inventoryChangedBeforeConfirm && request.method() === 'POST'
            && url.pathname.endsWith(`/${browserCartId}/confirm`)) {
            // Simulate another checkout committing the last unit after this buyer reviewed delivery.
            owned.psql(`
              UPDATE inventory_levels
                 SET available=0, reserved=0, committed_quantity=0,
                     available_quantity=0, reserved_quantity=0, on_hand_quantity=0, updated_at=now()
               WHERE store_id='${site.siteId}' AND product_id='${productId}' AND variant_id IS NULL;
            `);
            inventoryChangedBeforeConfirm = true;
        }
        await route.continue();
    });

    await page.goto(`http://${site.subdomain}.localhost:${appPort}/checkout`, { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/checkout\.localhost/);
    await page.waitForLoadState('networkidle');
    await page.getByPlaceholder('John Doe').fill('Synthetic Stale Inventory Buyer');
    await page.getByPlaceholder('9876543210').fill('9000000066');
    await page.getByPlaceholder('john@example.com').fill(email);
    await page.getByPlaceholder('House/Flat No, Street, Landmark...').fill('Synthetic Inventory Fixture Road');
    await page.getByPlaceholder('Bengaluru').fill('Bengaluru');
    await page.locator('select').first().selectOption('29');
    await page.getByPlaceholder('560001').fill('560001');
    const codDelivery = page.getByRole('button', { name: /COD delivery/ });
    await codDelivery.waitFor({ state: 'visible', timeout: 20_000 });
    await codDelivery.click();
    await page.getByRole('button', { name: 'Continue to Payment' }).click();
    await page.getByRole('radio', { name: /Cash on Delivery \(COD\)/ }).check();

    const conflictResponse = page.waitForResponse(response => {
        const url = new URL(response.url());
        return response.request().method() === 'POST'
            && url.pathname.endsWith(`/${browserCartId}/confirm`)
            && response.status() === 409;
    });
    await page.getByRole('button', { name: 'Confirm COD order' }).click();
    const response = await conflictResponse;
    assert.equal(inventoryChangedBeforeConfirm, true, 'stock changes after the buyer selects delivery and before order creation');
    assert.deepEqual(await response.json(), {
        success: false,
        error: {
            code: 'INSUFFICIENT_INVENTORY',
            message: 'Some items are no longer available in that quantity. Review your cart and try again.',
        },
    });
    await page.getByRole('alert').getByText('Some items are no longer available in that quantity. Review your cart and try again.').waitFor({ timeout: 10_000 });
    assert.equal(await page.evaluate(() => (globalThis as any).localStorage.getItem('lb_cart_token')), browserCartToken,
        'a rejected order keeps the buyer cart available for review');
    assert.equal(owned.psql(`SELECT count(*) FROM orders WHERE store_id='${site.siteId}' AND customer_email='${email}';`), '0',
        'stale inventory cannot create an order');
    assert.equal(owned.psql(`SELECT count(*) FROM checkout_sessions WHERE site_id='${site.siteId}' AND cart_id='${browserCartId}' AND checkout_state='completed';`), '0',
        'a failed inventory confirmation does not complete checkout');
    assert.deepEqual(pageErrors, []);

    owned.psql(`
      UPDATE inventory_levels
         SET available=1, reserved=0, committed_quantity=0,
             available_quantity=1, reserved_quantity=0, on_hand_quantity=1, updated_at=now()
       WHERE store_id='${site.siteId}' AND product_id='${productId}' AND variant_id IS NULL;
    `);
    await page.getByRole('button', { name: 'Confirm COD order' }).click();
    await page.getByRole('heading', { name: 'Order Confirmed!' }).waitFor({ timeout: 30_000 });
    assert.equal(owned.psql(`SELECT count(*) FROM orders WHERE store_id='${site.siteId}' AND customer_email='${email}';`), '1',
        'the same checkout can safely retry after inventory becomes available');
    assert.equal(owned.psql(`SELECT count(*) FROM checkout_sessions WHERE site_id='${site.siteId}' AND cart_id='${browserCartId}' AND checkout_state='completed';`), '1',
        'the successful same-key retry completes one checkout');
    assert.equal(confirmIdempotencyKeys.length, 2, 'both confirmation attempts reached the real checkout route');
    assert.ok(confirmIdempotencyKeys[0].length > 0, 'confirmation sends an idempotency key');
    assert.equal(confirmIdempotencyKeys[1], confirmIdempotencyKeys[0],
        'retry of the same confirmed payload reuses its original idempotency key');
    await context.close();
});
