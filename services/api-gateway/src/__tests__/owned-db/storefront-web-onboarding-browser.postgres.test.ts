// Actual Identity onboarding UI, authenticated merchant session, Gateway worker and owned Postgres in Chromium.
import assert from 'node:assert/strict';
import {closePooledSqlClients} from '@letbuyy/infrastructure/pooled-sql-adapter';
import { existsSync, lstatSync, symlinkSync, unlinkSync } from 'node:fs';
import { createServer, type IncomingMessage } from 'node:http';
import { once } from 'node:events';
import { join } from 'node:path';
import test, { after, before } from 'node:test';
import { chromium, type Browser } from '@playwright/test';
import { exportJWK, SignJWT } from 'jose';
import { createLetbuyyInternalAppHeaders, LETBUYY_MERCHANT_SESSION_COOKIE } from '@letbuyy/auth-core';
import worker from '../../index';
import { gatewayEnv, IDENTITY_ISSUER, INTERNAL_SECRET, MERCHANT_SESSION_AUDIENCE, newIdentityKeys } from './gateway-harness';
import { requireOwnedDatabase, startOwnedPooledSqlProxy, type OwnedPooledSqlProxy, startOwnedClientRuntime, stopOwnedClientRuntime, type OwnedClientProcess } from './owned-db-support';

const owned = requireOwnedDatabase();
let pooled:OwnedPooledSqlProxy;
const ownerId = crypto.randomUUID();
const email = `browser-onboarding-${ownerId}@example.invalid`;
const subdomain = `browser-onboard-${ownerId.slice(0, 8)}`;
const csrfToken = `csrf-${crypto.randomUUID()}`;
const csrfCookie = 'letbuyy_csrf';
const sessionCookie = LETBUYY_MERCHANT_SESSION_COOKIE;
const identityRoot = join(process.cwd(), 'apps/platform/identity');
const merchantRoot = join(process.cwd(), 'apps/merchant/web');
const commerceModules = join(process.cwd(), 'apps/commerce/web/node_modules');
const merchantModules = join(merchantRoot, 'node_modules');
const appEnv = { NODE_ENV: 'development', CI: '1', NEXT_TELEMETRY_DISABLED: '1' };
let server: ReturnType<typeof createServer>;
let app: OwnedClientProcess | undefined;
let merchantApp: OwnedClientProcess | undefined;
let browser: Browser | undefined;
let gatewayPort = 0;
let appPort = 0;
let merchantPort = 0;
let sessionToken = '';
let temporaryDependencyLink = false;
let temporaryMerchantDependencyLink = false;
const background: Promise<unknown>[] = [];

function readBody(req: IncomingMessage): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on('data', chunk => chunks.push(Buffer.from(chunk)));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
    });
}

async function waitForIdentity(origin: string): Promise<void> {
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
        if (app?.exitCode !== null && app?.exitCode !== undefined) throw new Error(`Identity Next exited with ${app.exitCode}`);
        try {
            const response = await fetch(`${origin}/onboarding`);
            if (response.status < 500) return;
        } catch { /* wait for Next to bind */ }
        await new Promise(resolve => setTimeout(resolve, 400));
    }
    throw new Error('Identity Next did not become ready within 120 seconds');
}

async function waitForMerchant(origin: string): Promise<void> {
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
        if (merchantApp?.exitCode !== null && merchantApp?.exitCode !== undefined) {
            throw new Error(`Merchant Next exited with ${merchantApp.exitCode}`);
        }
        try {
            const response = await fetch(`${origin}/${subdomain}/dashboard`);
            if (response.status < 500) return;
        } catch { /* wait for Next to bind */ }
        await new Promise(resolve => setTimeout(resolve, 400));
    }
    throw new Error('Merchant Next did not become ready within 120 seconds');
}

before(async () => {
    pooled=await startOwnedPooledSqlProxy(owned);
    owned.psql(`INSERT INTO users_custom (id,email,email_verified,full_name) VALUES ('${ownerId}','${email}',true,'Synthetic Browser Merchant');`);
    const keys = await newIdentityKeys('owned-db-onboarding-browser');
    const privateJwk = { ...(await exportJWK(keys.privateKey)), alg: 'ES256', kid: 'owned-db-onboarding-browser' };
    const issuedToken = await new SignJWT({ realm: 'merchant', token_use: 'merchant_session', device_id: null })
        .setProtectedHeader({ alg: 'ES256', typ: 'JWT', kid: 'owned-db-onboarding-browser' })
        .setIssuer(IDENTITY_ISSUER)
        .setAudience(MERCHANT_SESSION_AUDIENCE)
        .setSubject(ownerId)
        .setIssuedAt()
        .setExpirationTime('30d')
        .setJti(crypto.randomUUID())
        .sign(keys.privateKey);
    const accountsHeaders = await createLetbuyyInternalAppHeaders({ app: 'accounts', secret: INTERNAL_SECRET });
    assert.equal(accountsHeaders.ok, true);
    const session = await (async () => {
        const response = await worker.fetch(new Request('https://gateway.test/v1/auth/custom/sessions/create', {
            method: 'POST',
            headers: { ...accountsHeaders.headers, 'Content-Type': 'application/json', 'CF-Connecting-IP': '2001:db8:beef::1' },
            body: JSON.stringify({ user_id: ownerId, token: issuedToken }),
        }), gatewayEnv(owned, keys, pooled.env()), {
            waitUntil: (work: Promise<unknown>) => { background.push(Promise.resolve(work).catch(() => undefined)); },
            passThroughOnException: () => undefined,
        } as never);
        if (response.status !== 201) {
            throw new Error(`merchant session creation returned ${response.status}: ${await response.text()}`);
        }
        return response.json() as Promise<{ data: { token: string } }>;
    })();
    sessionToken = session.data.token;

    server = createServer(async (req, res) => {
        try {
            const body = await readBody(req);
            const headers = new Headers();
            for (let i = 0; i < req.rawHeaders.length; i += 2) headers.append(req.rawHeaders[i], req.rawHeaders[i + 1]);
            headers.set('CF-Connecting-IP', '2001:db8:feed::2');
            const response = await worker.fetch(new Request(`https://gateway.test${req.url || '/'}`, {
                method: req.method,
                headers,
                ...(body.length && req.method !== 'GET' && req.method !== 'HEAD' ? { body, duplex: 'half' as const } : {}),
            }), gatewayEnv(owned, keys, pooled.env()), {
                waitUntil: (work: Promise<unknown>) => background.push(Promise.resolve(work).catch(() => undefined)),
                passThroughOnException: () => undefined,
            } as never);
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
    gatewayPort = (server.address() as { port: number }).port;
    const portProbe = createServer();
    portProbe.listen(0, '127.0.0.1');
    await once(portProbe, 'listening');
    appPort = (portProbe.address() as { port: number }).port;
    await new Promise<void>((resolve, reject) => portProbe.close(error => error ? reject(error) : resolve()));
    const merchantPortProbe = createServer();
    merchantPortProbe.listen(0, '127.0.0.1');
    await once(merchantPortProbe, 'listening');
    merchantPort = (merchantPortProbe.address() as { port: number }).port;
    await new Promise<void>((resolve, reject) => merchantPortProbe.close(error => error ? reject(error) : resolve()));

    const identityModules = join(identityRoot, 'node_modules');
    if (!existsSync(identityModules)) {
        assert.ok(existsSync(commerceModules), 'the workspace-installed Next dependencies are required to launch Identity');
        symlinkSync(commerceModules, identityModules, 'dir');
        temporaryDependencyLink = true;
    } else {
        assert.ok(lstatSync(identityModules).isDirectory(), 'Identity node_modules must be a real installed dependency directory');
    }

    app = startOwnedClientRuntime(owned, 'identity-next', {
        port: appPort,
        env: {
            ...appEnv,
            LETBUYY_API_URL: `http://127.0.0.1:${gatewayPort}/v1`,
            NEXT_PUBLIC_API_URL: `http://127.0.0.1:${gatewayPort}/v1`,
            INTERNAL_API_SECRET: INTERNAL_SECRET,
            LETBUYY_IDENTITY_PRIVATE_JWK: JSON.stringify(privateJwk),
            LETBUYY_IDENTITY_ISSUER: IDENTITY_ISSUER,
            NEXT_PUBLIC_ACCOUNTS_URL: `http://localhost:${appPort}`,
            NEXT_PUBLIC_ADMIN_URL: `http://localhost:${merchantPort}`,
            LETBUYY_ENABLE_DEV_AUTH_BYPASS: 'true',
            NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS: 'true',
            NEXT_PUBLIC_TURNSTILE_SITE_KEY: '',
            RESEND_API_KEY: '',
            LETBUYY_EMAIL_API_KEY: '',
            COOKIE_DOMAIN: '',
        },
    });
    await waitForIdentity(`http://localhost:${appPort}`);

    if (!existsSync(merchantModules)) {
        assert.ok(existsSync(commerceModules), 'the workspace-installed Next dependencies are required to launch Merchant');
        symlinkSync(commerceModules, merchantModules, 'dir');
        temporaryMerchantDependencyLink = true;
    } else {
        assert.ok(lstatSync(merchantModules).isDirectory(), 'Merchant node_modules must be a real installed dependency directory');
    }
    merchantApp = startOwnedClientRuntime(owned, 'merchant-next', {
        port: merchantPort,
        env: {
            ...appEnv,
            LETBUYY_API_BASE_URL: `http://127.0.0.1:${gatewayPort}/v1`,
            LETBUYY_API_URL: `http://127.0.0.1:${gatewayPort}/v1`,
            NEXT_PUBLIC_API_URL: `http://127.0.0.1:${gatewayPort}/v1`,
            INTERNAL_API_SECRET: INTERNAL_SECRET,
            NEXT_PUBLIC_ACCOUNTS_URL: `http://localhost:${appPort}`,
            NEXT_PUBLIC_ADMIN_URL: `http://localhost:${merchantPort}`,
            COOKIE_DOMAIN: '',
        },
    });
    const merchantOrigin = `http://localhost:${merchantPort}`;
    await waitForMerchant(merchantOrigin);
    browser = await chromium.launch({ headless: true });
});

after(async () => {
    await browser?.close();
    await stopOwnedClientRuntime(app);
    await stopOwnedClientRuntime(merchantApp);
    if (server?.listening) await new Promise<void>(resolve => server.close(() => resolve()));
    await Promise.allSettled(background.splice(0));
    await closePooledSqlClients();await pooled?.stop();
    if (temporaryDependencyLink) unlinkSync(join(identityRoot, 'node_modules'));
    if (temporaryMerchantDependencyLink) unlinkSync(join(merchantRoot, 'node_modules'));
});

test('merchant resumes the real onboarding form and creates one completed store', async () => {
    assert.ok(browser);
    const merchantOrigin = `http://localhost:${merchantPort}`;
    const context = await browser.newContext();
    // The first authenticated route compiles on a cold owned Next runtime.
    context.setDefaultNavigationTimeout(90_000);
    await context.addCookies([
        { name: sessionCookie, value: sessionToken, url: `http://localhost:${appPort}`, httpOnly: true, sameSite: 'Lax' },
        { name: csrfCookie, value: csrfToken, url: `http://localhost:${appPort}`, sameSite: 'Strict' },
    ]);
    const planWarmup = await context.newPage();
    const warmupResponse = await planWarmup.goto(`${merchantOrigin}/${subdomain}/access_account/checkout/select-plan`, { waitUntil: 'domcontentloaded' });
    assert.equal(warmupResponse?.status(), 404, 'the authenticated plan route denies a store that does not exist yet');
    await planWarmup.close();
    const firstPage = await context.newPage();
    const firstErrors: string[] = [];
    firstPage.on('pageerror', error => firstErrors.push(error.message));
    await firstPage.route('**/api/auth/create-store', async route => {
        if (route.request().method() === 'GET') await new Promise(resolve => setTimeout(resolve, 350));
        await route.continue();
    });
    await firstPage.goto(`http://localhost:${appPort}/onboarding`, { waitUntil: 'domcontentloaded' });
    await firstPage.getByText('Loading…', { exact: true }).waitFor({ state: 'visible' });
    assert.equal(await firstPage.getByRole('heading', { name: 'What do you want to build?' }).count(), 0,
        'the wizard must not accept input before the account-bound draft response resolves');
    const typeHeading = firstPage.getByRole('heading', { name: 'What do you want to build?' });
    await typeHeading.waitFor({ timeout: 30_000 });
    assert.equal(await firstPage.locator('h1:focus').innerText(), 'What do you want to build?', 'the initial task context receives keyboard focus');
    const storeTypeButton = firstPage.getByRole('button', { name: /Online Store/ });
    await firstPage.keyboard.press('Tab');
    assert.equal(await storeTypeButton.evaluate(element => element === element.ownerDocument.activeElement), true,
        'Tab from the initial task heading reaches the available storefront choice');
    await firstPage.keyboard.press('Enter');
    await firstPage.getByRole('heading', { name: 'Name your site' }).waitFor();
    assert.equal(await firstPage.locator('h1:focus').innerText(), 'Name your site', 'changing steps moves focus to the new step heading');
    await firstPage.keyboard.press('Tab');
    const displayName = firstPage.getByLabel('Display Name');
    assert.equal(await displayName.evaluate(element => element === element.ownerDocument.activeElement), true,
        'Tab from the step heading reaches the store name field');
    await firstPage.keyboard.type('Synthetic Browser Coffee');
    await firstPage.keyboard.press('Tab');
    const subdomainInput = firstPage.getByLabel('Subdomain');
    assert.equal(await subdomainInput.evaluate(element => element === element.ownerDocument.activeElement), true,
        'the next Tab reaches the visibly labeled subdomain field');
    const subdomainDescriptions = (await subdomainInput.getAttribute('aria-describedby') || '').split(/\s+/);
    assert.ok(subdomainDescriptions.includes('subdomain-host-suffix'),
        'the platform host suffix is announced as part of the subdomain field');
    assert.ok(subdomainDescriptions.includes('subdomain-validation'),
        'subdomain validation is associated with its input');
    const validationStatus = firstPage.locator('#subdomain-validation');
    assert.equal(await validationStatus.getAttribute('role'), 'status');
    assert.equal(await validationStatus.getAttribute('aria-live'), 'polite',
        'availability changes are announced without moving keyboard focus');
    const rejectedSubdomainResponse = firstPage.waitForResponse(response => new URL(response.url()).pathname === '/api/auth/validate-subdomain');
    await firstPage.keyboard.type('dashboard');
    const rejectedSubdomain = await (await rejectedSubdomainResponse).json() as { valid?: boolean; reason?: string };
    assert.equal(rejectedSubdomain.valid, false, 'the live validator rejects the reserved dashboard subdomain');
    const invalidDeadline = Date.now() + 5_000;
    while (Date.now() < invalidDeadline && await subdomainInput.getAttribute('aria-invalid') !== 'true') {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.equal(await subdomainInput.getAttribute('aria-invalid'), 'true',
        'invalid subdomain state is programmatically exposed');
    assert.notEqual((await validationStatus.innerText()).trim(), '',
        'the rejected subdomain has a textual live status, not just an icon/color');
    await firstPage.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
    const subdomainResponse = firstPage.waitForResponse(response => new URL(response.url()).pathname === '/api/auth/validate-subdomain');
    await firstPage.keyboard.type(subdomain);
    const subdomainResult = await (await subdomainResponse).json() as { valid?: boolean; reason?: string; message?: string };
    assert.equal(subdomainResult.valid, true, `the actual Identity BFF must accept the unused synthetic subdomain: ${JSON.stringify(subdomainResult)}`);
    const retailChannel = firstPage.getByRole('checkbox', { name: 'In-person retail', exact: true });
    const onlineChannel = firstPage.getByRole('checkbox', { name: 'Online store', exact: true });
    assert.equal(await retailChannel.count(), 1, `the retail choice must remain accessible after availability validation; visible form: ${(await firstPage.locator('body').innerText()).slice(0, 1000)}`);
    await firstPage.keyboard.press('Tab');
    assert.equal(await onlineChannel.evaluate(element => element === element.ownerDocument.activeElement), true,
        'Tab from the subdomain reaches the already-selected online channel checkbox');
    await firstPage.keyboard.press('Tab');
    assert.equal(await retailChannel.evaluate(element => element === element.ownerDocument.activeElement), true,
        `Tab from the subdomain reaches the retail channel checkbox; focused: ${await firstPage.locator('body').evaluate(element => element.ownerDocument.activeElement?.outerHTML ?? 'none')}`);
    await firstPage.keyboard.press('Space');
    const socialChannel = firstPage.getByRole('checkbox', { name: 'Social media', exact: true });
    await firstPage.keyboard.press('Tab');
    assert.equal(await socialChannel.evaluate(element => element === element.ownerDocument.activeElement), true,
        'Tab advances to the social channel checkbox');
    await firstPage.keyboard.press('Space');
    const marketplaceChannel = firstPage.getByRole('checkbox', { name: 'Online marketplaces', exact: true });
    await firstPage.keyboard.press('Tab');
    assert.equal(await marketplaceChannel.evaluate(element => element === element.ownerDocument.activeElement), true,
        'Tab advances through the remaining optional sales channels');
    await firstPage.keyboard.press('Tab');
    const eventsChannel = firstPage.getByRole('checkbox', { name: 'Events and pop-ups', exact: true });
    assert.equal(await eventsChannel.evaluate(element => element === element.ownerDocument.activeElement), true,
        'Tab reaches the final optional sales channel');
    await firstPage.keyboard.press('Tab');
    const nextButton = firstPage.getByRole('button', { name: 'Next', exact: true });
    const validationDeadline = Date.now() + 15_000;
    while (Date.now() < validationDeadline && !(await nextButton.isEnabled())) {
        await new Promise(resolve => setTimeout(resolve, 150));
    }
    assert.equal(await nextButton.isEnabled(), true, 'the real subdomain validator enables the next step');
    await firstPage.keyboard.press('Tab');
    assert.equal(await nextButton.evaluate(element => element === element.ownerDocument.activeElement), true,
        'the next Tab reaches the enabled step transition');
    await firstPage.keyboard.press('Enter');
    await firstPage.getByRole('heading', { name: 'Review & Create' }).waitFor();
    assert.equal(await firstPage.locator('h1:focus').innerText(), 'Review & Create', 'keyboard activation moves focus to the review heading');
    const draftDeadline = Date.now() + 20_000;
    const completeDraft = `SELECT count(*) FROM onboarding_attempts WHERE user_id='${ownerId}' AND status='in_progress' AND survey_data->'web_draft'->>'subdomain'='${subdomain}' AND survey_data->'channels'='["online","retail","social"]'::jsonb;`;
    while (Date.now() < draftDeadline && owned.psql(completeDraft) !== '1') {
        await new Promise(resolve => setTimeout(resolve, 250));
    }
    assert.equal(owned.psql(completeDraft), '1', `the real page must persist the latest form selections before reload; persisted draft: ${owned.psql(`SELECT jsonb_build_object('status', status, 'channels', survey_data->'channels', 'web_draft', survey_data->'web_draft')::text FROM onboarding_attempts WHERE user_id='${ownerId}' AND status='in_progress' ORDER BY updated_at DESC LIMIT 1;`)}`);
    await firstPage.close();

    const page = await context.newPage();
    const pageErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto(`http://localhost:${appPort}/onboarding`, { waitUntil: 'domcontentloaded' });
    await page.getByText('Your saved progress has been restored.').waitFor({ timeout: 20_000 });
    await page.getByRole('heading', { name: 'Review & Create' }).waitFor();
    const restoredReview = await page.locator('.onboard-review-rows').innerText();
    assert.match(restoredReview, /In-person retail, Social media/);
    assert.match(restoredReview, /Synthetic Browser Coffee/);
    assert.match(restoredReview, new RegExp(subdomain));
    assert.equal(await page.locator('h1:focus').innerText(), 'Review & Create', 'resuming a saved review restores its page context and keyboard focus');
    const industry = page.getByLabel('Industry');
    await page.keyboard.press('Tab');
    assert.equal(await industry.evaluate(element => element === element.ownerDocument.activeElement), true,
        'Tab from the restored review heading reaches the industry selector');
    await page.keyboard.type('fo');
    assert.equal(await industry.inputValue(), 'food', 'the industry selector accepts native keyboard type-ahead');
    await page.keyboard.press('Tab');
    assert.equal(await page.getByRole('button', { name: 'Back' }).evaluate(element => element === element.ownerDocument.activeElement), true,
        'Tab moves through review to the back action');
    await page.keyboard.press('Tab');
    const createButton = page.getByRole('button', { name: 'Create My Site', exact: true });
    assert.equal(await createButton.evaluate(element => element === element.ownerDocument.activeElement), true,
        'Tab reaches the create action after the industry selector');
    const createResponse = page.waitForResponse(response => response.url().endsWith('/api/auth/create-store') && response.request().method() === 'POST');
    const planNavigation = page.waitForURL(url => url.port === String(merchantPort)
        && url.pathname === `/${subdomain}/access_account/checkout/select-plan`, { timeout: 30_000 });
    await page.keyboard.press('Enter');
    const response = await createResponse;
    assert.equal(response.status(), 200, await response.text());
    await page.getByRole('heading', { name: 'Workspace created!' }).waitFor({ timeout: 10_000 });
    assert.equal(await page.locator('h1:focus').innerText(), 'Workspace created!', 'successful creation announces its new page context to keyboard users');
    await planNavigation;
    const planHeading = page.getByRole('heading', { level: 1 });
    await planHeading.waitFor({ timeout: 30_000 });
    assert.match(await planHeading.innerText(), /(?:\d+ days? left in your trial - choose a plan|Everything you need to run your business)/,
        'the new store sees its real trial state or the standard plan selection heading');
    const availablePlans = page.getByRole('region', { name: 'Available plans' }).locator('article');
    assert.ok(await availablePlans.count() > 0, 'the canonical plan catalog renders for the new store without opening checkout');
    const billingPeriod = page.getByRole('group', { name: 'Billing period' });
    const annualButton = billingPeriod.getByRole('button', { name: 'Annual' });
    await annualButton.click();
    assert.equal(await annualButton.getAttribute('aria-pressed'), 'true',
        'billing period selection is exposed to assistive technology');
    const anonymousContext = await browser.newContext();
    const anonymousPage = await anonymousContext.newPage();
    await anonymousPage.goto(`${merchantOrigin}/${subdomain}/access_account/checkout/select-plan`, { waitUntil: 'domcontentloaded' });
    const anonymousBody = await anonymousPage.locator('body').innerText();
    const anonymousDestination = new URL(anonymousPage.url());
    assert.equal(anonymousDestination.port, String(appPort),
        `the existing owner-only plan route sends a signed-out visitor to Identity; destination=${anonymousPage.url()}`);
    assert.match(anonymousDestination.pathname, /^\/(?:lookup|login)$/,
        `the signed-out visitor must land on the Identity sign-in screen; destination=${anonymousPage.url()}`);
    assert.equal(await anonymousPage.getByRole('region', { name: 'Available plans' }).count(), 0,
        `the signed-out response does not disclose catalog content; body: ${anonymousBody.slice(0, 800)}`);
    await anonymousContext.close();

    assert.equal(owned.psql(`SELECT count(*) FROM sites WHERE custom_user_id='${ownerId}' AND subdomain='${subdomain}' AND site_type='store' AND status='draft';`), '1');
    assert.equal(owned.psql(`SELECT count(*) FROM onboarding_attempts WHERE user_id='${ownerId}' AND status='completed' AND survey_data->'channels'='["online","retail","social"]'::jsonb AND survey_data->'web_draft'->>'industry'='food';`), '1');
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(firstErrors, []);

    const dashboardPage = await context.newPage();
    const dashboardErrors: string[] = [];
    const dashboardConsoleErrors: string[] = [];
    dashboardPage.on('pageerror', error => dashboardErrors.push(error.message));
    dashboardPage.on('console', message => { if (message.type() === 'error') dashboardConsoleErrors.push(message.text()); });
    const dashboardResponse = await dashboardPage.goto(`${merchantOrigin}/${subdomain}/dashboard`, { waitUntil: 'domcontentloaded' });
    try {
        await dashboardPage.getByRole('heading', { name: 'Where do you want to start?', level: 1 }).waitFor({ timeout: 20_000 });
    } catch {
        throw new Error(`Merchant dashboard did not reach its activation page; status=${dashboardResponse?.status()} url=${dashboardPage.url()} body=${(await dashboardPage.locator('body').innerText()).slice(0, 1200)} pageErrors=${dashboardErrors.join(' | ')} consoleErrors=${dashboardConsoleErrors.join(' | ')}`);
    }
    assert.equal(await dashboardPage.getByRole('heading', { level: 1 }).count(), 1,
        'the first-store dashboard exposes its activation title as the sole page heading');
    assert.equal(await dashboardPage.locator('article.activation-card').count(), 5,
        'the new store opens its five-step storefront setup checklist');
    await dashboardPage.getByRole('heading', { name: 'Add product', level: 2 }).waitFor();
    assert.match(await dashboardPage.locator('body').innerText(), /Your site is in draft mode/,
        'the new owner sees the honest draft-publication state with the setup steps');
    assert.deepEqual(dashboardErrors, []);
    assert.deepEqual(dashboardConsoleErrors, []);

    // F5.5: exercise stock adjustment through the merchant inventory screen,
    // its same-origin BFF, the real Gateway worker and the owned Postgres ledger.
    const storeId = owned.psql(`SELECT id::text FROM sites WHERE custom_user_id='${ownerId}' AND subdomain='${subdomain}';`);
    assert.match(storeId, /^[0-9a-f-]{36}$/i, 'the authenticated onboarding journey created its owned store');
    const inventoryProductId = crypto.randomUUID();
    const inventoryLocationId = crypto.randomUUID();
    owned.psql(`
        INSERT INTO inventory_locations (id, store_id, name, is_default, status, created_at)
        VALUES ('${inventoryLocationId}', '${storeId}', 'Browser stock room', false, 'active', now());
        INSERT INTO products (id, site_id, store_id, name, slug, description, price, stock, is_active, status)
        VALUES ('${inventoryProductId}', '${storeId}', '${storeId}', 'Browser inventory product',
            'browser-inventory-${inventoryProductId.slice(0, 8)}', 'Synthetic inventory browser fixture', 120, 4, true, 'active');
        INSERT INTO inventory_levels (id, store_id, product_id, variant_id, location_id, available, reserved,
            committed_quantity, available_quantity, reserved_quantity, on_hand_quantity, created_at, updated_at)
        VALUES (gen_random_uuid(), '${storeId}', '${inventoryProductId}', NULL, '${inventoryLocationId}',
            4, 0, 0, 4, 0, 4, now(), now());
    `);
    const inventoryPage = await context.newPage();
    const inventoryErrors: string[] = [];
    inventoryPage.on('pageerror', error => inventoryErrors.push(error.message));
    await inventoryPage.goto(`${merchantOrigin}/${subdomain}/products/inventory`, { waitUntil: 'domcontentloaded' });
    await inventoryPage.getByRole('heading', { name: 'Inventory', level: 1 }).waitFor({ timeout: 30_000 });
    try {await inventoryPage.getByRole('table').getByText('Browser inventory product', { exact: true }).waitFor({ timeout: 20_000 });}
    catch(error){console.info('OWNED_ONBOARDING_INVENTORY_FAILURE '+JSON.stringify({body:await inventoryPage.locator('body').innerText(),response:await inventoryPage.evaluate(async({slug,actor})=>{const r=await fetch('/api/stores/'+slug+'/inventory/levels?limit=100',{headers:{'X-LetBuyy-Merchant-Context':actor}});return{status:r.status,body:await r.text()};},{slug:subdomain,actor:ownerId})}));throw error;}
    await inventoryPage.getByRole('button', { name: 'Adjust', exact: true }).click();
    await inventoryPage.locator('input[aria-label="Available quantity"]:visible').first().fill('9');
    const inventoryResponse = inventoryPage.waitForResponse(response => response.url().endsWith(`/api/stores/${subdomain}/inventory/adjust`)
        && response.request().method() === 'POST');
    await inventoryPage.getByRole('button', { name: 'Save', exact: true }).click();
    const inventoryResult = await inventoryResponse;
    assert.equal(inventoryResult.status(), 200, await inventoryResult.text());
    await inventoryPage.getByText('Browser inventory product: stock change +5 confirmed.', { exact: true }).waitFor({ timeout: 20_000 });
    assert.equal(owned.psql(`SELECT available FROM inventory_levels WHERE product_id='${inventoryProductId}';`), '9');
    assert.equal(owned.psql(`SELECT count(*)||'|'||sum(quantity_change)||'|'||min(created_by::text) FROM inventory_adjustments WHERE product_id='${inventoryProductId}';`), `1|5|${ownerId}`);
    assert.equal(owned.psql(`SELECT count(*) FROM outbox_events WHERE store_id='${storeId}' AND aggregate_id='${inventoryProductId}' AND event_type='inventory.level.adjusted';`), '1');
    await inventoryPage.reload({ waitUntil: 'domcontentloaded' });
    try {await inventoryPage.getByRole('table').getByText('Browser inventory product', { exact: true }).waitFor({ timeout: 20_000 });}
    catch(error){console.info('OWNED_ONBOARDING_INVENTORY_FAILURE '+JSON.stringify({body:await inventoryPage.locator('body').innerText(),response:await inventoryPage.evaluate(async({slug,actor})=>{const r=await fetch('/api/stores/'+slug+'/inventory/levels?limit=100',{headers:{'X-LetBuyy-Merchant-Context':actor}});return{status:r.status,body:await r.text()};},{slug:subdomain,actor:ownerId})}));throw error;}
    assert.ok(await inventoryPage.getByText('9', { exact: true }).count() >= 1,
        'the refreshed inventory screen displays the persisted available quantity');
    assert.deepEqual(inventoryErrors, []);
    await inventoryPage.close();

    await context.close();
});
