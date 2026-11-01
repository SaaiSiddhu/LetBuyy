// Synthetic local test credentials only: owned disposable accounts, stub provider identifiers,
// and public challenge test fixtures. Never use these values for a real account or live provider.
// Exact value hashes are reviewed in config/governance/secret-scan-exceptions.json.
// Initial consumer reproductions for N4.4. Root must review this literal root
// fixture and its runtime classification before execution. No renderer override,
// fabricated browser session/cart, provider adapter or external transaction.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { before, after, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createServer, request as forwardHttpRequest, type Server } from 'node:http';
import { createServer as createHttpsServer, type Server as HttpsServer } from 'node:https';
import { exportJWK } from 'jose';
import { chromium, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { closePooledSqlClients } from '@letbuyy/infrastructure/pooled-sql-adapter';
import { hashMerchantPassword } from '../../services/api-gateway/src/lib/merchant-password';
import { Gateway, gatewayEnv, newIdentityKeys, INTERNAL_SECRET, tapRest, type RestTap } from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import { requireOwnedDatabase, startOwnedPooledSqlProxy, type OwnedPooledSqlProxy, createOwnedCheckoutTlsCertificate, startOwnedClientRuntime, stopOwnedClientRuntime, type OwnedClientProcess } from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import { newSyntheticTenant, seedSyntheticOrder, seedSyntheticTenant, type SeedOptions } from '../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';

const owned = requireOwnedDatabase();
let proxy:OwnedPooledSqlProxy,gateway:Gateway,tap:RestTap;
const slug = 'letbuyy-core'; // Canonical Liquid starter; use the current sealed catalog fixture.
const password = 'Synthetic-published-storefront-pass-42';
let identityOrigin: string, merchantOrigin: string, commerceOrigin: string;
let bridge: Server | undefined, browser: Browser | undefined;
let checkoutTls: HttpsServer | undefined, checkoutTlsPort: number;
const clients: OwnedClientProcess[] = [];
const contexts: BrowserContext[] = [];
const privateKycObjects = new Map<string, Uint8Array>();

// Diagnostic observations only: no HTML, query, token, cookie or raw runtime log retained.
function previewDiagnostic(text: string) {
    const normalized = text.replace(/\\+/g, '');
    const known = ['Portable Liquid', 'Portable section has no section file', 'captured global Liquid section',
        'ZodError', 'StorefrontStoreError', 'Module not found', 'Internal Server Error', 'Invalid preview token'];
    return { sha256: createHash('sha256').update(text).digest('hex'),
        classifications: known.filter(value => normalized.includes(value)),
        blockedMappings: [...normalized.matchAll(/Block "([A-Za-z0-9_-]{1,120})" is not allowed in (?:liquid )?section "([A-Za-z0-9_-]{1,120})"/g)]
            .map(match => ({ block: match[1], section: match[2] })),
        previewMarker: normalized.includes('data-letbuyy-preview-route="true"'),
        unavailable: normalized.includes('Storefront preview is not available'),
        nextError: normalized.includes('__next_error__') || normalized.includes('nextjs-portal') };
}

async function freePort() {
    const server = createServer();
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as { port: number }).port;
    await new Promise<void>(resolve => server.close(() => resolve()));
    return port;
}
async function ready(url: string, child: OwnedClientProcess) {
    const deadline = Date.now() + 300_000;
    while (Date.now() < deadline) {
        assert.equal(child.exitCode, null, 'owned Next runtime remains running');
        try { if ((await fetch(url, { signal: AbortSignal.timeout(2000) })).status < 500) return; } catch { /* cold compile */ }
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    throw new Error('owned Next readiness timed out');
}
before(async () => {
    proxy=await startOwnedPooledSqlProxy(owned);
    tap=tapRest(owned.restUrl,async(call,forward)=>{const result=await forward();if(!result.ok)console.info('N4_DATABASE_READ_DIAGNOSTIC '+JSON.stringify({resource:call.resource,status:result.status,body:(await result.clone().text()).slice(0,600)}));return result;});
    assert.equal(owned.psql(`SELECT default_template->'liquidBundle'->'package'->>'slug' FROM themes WHERE slug='${slug}';`),'letbuyy-core-liquid');
    assert.equal(owned.psql(`SELECT default_template->'liquidBundle'->'renderer'->>'engine' FROM themes WHERE slug='${slug}';`), 'liquid');
    const keys = await newIdentityKeys();
    const identityPort = await freePort(), merchantPort = await freePort(), commercePort = await freePort();
    identityOrigin = `http://localhost:${identityPort}`;
    merchantOrigin = `http://localhost:${merchantPort}`;
    commerceOrigin = `http://localhost:${commercePort}`;
    // A real loopback TLS endpoint satisfies the unchanged production checkout
    // HTTPS guard. Chromium trusts only this fixture's temporary public key.
    assert.throws(() => createOwnedCheckoutTlsCertificate({ ...owned }), /requires the verified database handle/,
        'certificate provisioning refuses a copied database handle before running any tool');
    const checkoutCertificate = createOwnedCheckoutTlsCertificate(owned);
    const checkoutSpki = checkoutCertificate.spki;
    checkoutTls = createHttpsServer({ key: checkoutCertificate.key, cert: checkoutCertificate.cert }, (req, res) => {
        const checkoutHost = req.headers.host || '';
        if (!/^(?:[a-z0-9-]+\.localhost|shop\.merchant\.test):\d+$/.test(checkoutHost)
            || !checkoutHost.endsWith(':'+checkoutTlsPort)) {
            res.writeHead(421); res.end(); return;
        }
        const upstream = forwardHttpRequest({ hostname: '127.0.0.1', port: commercePort, path: req.url, method: req.method,
            headers: { ...req.headers, host: checkoutHost, 'x-forwarded-host': checkoutHost, 'x-forwarded-proto': 'https' } }, response => {
            response.on('error', () => res.destroy());
            res.writeHead(response.statusCode || 502, response.headers); response.pipe(res);
        });
        upstream.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end(); });
        upstream.setTimeout(10_000, () => upstream.destroy(new Error('Owned checkout upstream timed out')));
        req.on('aborted', () => upstream.destroy());
        res.on('close', () => upstream.destroy());
        req.pipe(upstream);
    });
    await new Promise<void>(resolve => checkoutTls!.listen(0, '127.0.0.1', resolve));
    checkoutTlsPort = (checkoutTls.address() as { port: number }).port;
    // The synthetic KYC bucket is test-only; local auth still needs the owned
    // email sink. No deployed environment uses this mixed fixture configuration.
    gateway = new Gateway(gatewayEnv(owned, keys, { ...proxy.env(), ENVIRONMENT: 'test', APP_ENV: 'local',
        LETBUYY_IDENTITY_ISSUER: identityOrigin, NEXT_PUBLIC_STORE_ROOT_DOMAIN: 'localhost', CHECKOUT_ORIGIN: `https://checkout.localhost:${checkoutTlsPort}`,
        CHECKOUT_SIGNING_SECRET: crypto.randomUUID() + crypto.randomUUID(),
        KYC_UPLOAD_ENABLED: 'true',
        KYC_PRIVATE_BUCKET: {
            put: async (key: string, bytes: Uint8Array) => { privateKycObjects.set(key, bytes); },
            delete: async (key: string) => { privateKycObjects.delete(key); },
        } }));
    bridge = createServer(async (req, res) => {
        try {
            const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk));
            const body = Buffer.concat(chunks).toString(), headers = new Headers();
            for (const [name, value] of Object.entries(req.headers)) {
                if (typeof value === 'string' && !['host','connection','content-length','transfer-encoding','accept-encoding'].includes(name)) headers.set(name, value);
            }
            const result = await gateway.request(req.url || '/', { method: req.method, headers, ...(body ? { body } : {}) });
            if (req.method === 'GET' && /^\/v1\/storefront\/[^/?]+(?:\?.*)?$/.test(req.url || '')) {
                try {
                    const payload = JSON.parse(result.text) as { data?: { id?: string; current_theme_release?: { id?: string; release_version?: number; template_snapshot?: unknown } } };
                    const release = payload.data?.current_theme_release;
                    console.info('N4_NORMAL_PUBLIC_RELEASE_READ', JSON.stringify({ status: result.status, store: payload.data?.id,
                        releaseId: release?.id, releaseVersion: release?.release_version,
                        documentHash: release?.template_snapshot ? createHash('sha256').update(JSON.stringify(release.template_snapshot)).digest('hex') : null }));
                } catch { console.info('N4_NORMAL_PUBLIC_RELEASE_READ', JSON.stringify({ status: result.status, bodyUnreadable: true })); }
            }
            res.writeHead(result.status, Object.fromEntries(result.headers.entries())); res.end(result.text);
        } catch { res.writeHead(500); res.end('{}'); }
    });
    await new Promise<void>(resolve => bridge!.listen(0, '127.0.0.1', resolve));
    const apiOrigin = `http://127.0.0.1:${(bridge.address() as { port: number }).port}`;
    const common = { INTERNAL_API_SECRET: INTERNAL_SECRET, LETBUYY_INTERNAL_API_SECRET: INTERNAL_SECRET,
        NEXT_PUBLIC_ACCOUNTS_URL: identityOrigin, NEXT_PUBLIC_ADMIN_URL: merchantOrigin,
        LETBUYY_ENABLE_DEV_AUTH_BYPASS: 'false', NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS: 'false' };
    clients.push(startOwnedClientRuntime(owned, 'identity-next-production', { port: identityPort, env: { ...common,
        LETBUYY_API_URL: apiOrigin + '/v1', LETBUYY_IDENTITY_ISSUER: identityOrigin,
        LETBUYY_IDENTITY_PRIVATE_JWK: JSON.stringify({ ...await exportJWK(keys.privateKey), alg: 'ES256', kid: keys.kid }),
        ACCOUNTS_COOKIE_SECRET: crypto.randomUUID() + crypto.randomUUID(), COOKIE_DOMAIN: '',
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: '1x00000000000000000000AA', TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
        RESEND_API_KEY: '', LETBUYY_EMAIL_API_KEY: '' } }));
    clients.push(startOwnedClientRuntime(owned, 'merchant-next-production', { port: merchantPort, env: { ...common,
        LETBUYY_API_BASE_URL: apiOrigin + '/v1', NEXT_PUBLIC_STOREFRONT_URL: commerceOrigin,
        KYC_INDIA_BUCKET: 'letbuyy-kyc-mumbai-synthetic' } }));
    clients.push(startOwnedClientRuntime(owned, 'commerce-next-production', { port: commercePort, env: { ...common,
        CHECKOUT_ORIGIN: `https://checkout.localhost:${checkoutTlsPort}`,
        LETBUYY_API_BASE_URL: apiOrigin + '/v1', LETBUYY_API_URL: apiOrigin + '/v1',
        NEXT_PUBLIC_API_BASE_URL: apiOrigin + '/v1', NEXT_PUBLIC_API_URL: apiOrigin + '/v1',
        NEXT_PUBLIC_STORE_ROOT_DOMAIN: 'localhost' } }));
    // Drain child output without exposing cookies, signing material or private URLs.
    for (const [index, child] of clients.entries()) {
        for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => {
            const observed = previewDiagnostic(String(chunk));
            if (observed.classifications.length || observed.blockedMappings.length) {
                console.info('N4_OWNED_RUNTIME_DIAGNOSTIC', JSON.stringify({ kind: ['identity-next', 'merchant-next', 'commerce-next'][index], ...observed }));
            }
        });
        child.stdout.resume(); child.stderr.resume();
    }
    // The unseeded platform directory can correctly report unavailable before
    // this suite creates any store. Probe the real anonymous session endpoint;
    // each public store document is still required to return 200 below.
    await Promise.all([ready(identityOrigin + '/login', clients[0]), ready(merchantOrigin, clients[1]),
        ready(commerceOrigin + '/api/buyer-auth/session', clients[2])]);
    browser = await chromium.launch({ headless: true, args: ['--no-proxy-server', '--host-resolver-rules=MAP *.localhost 127.0.0.1, MAP shop.merchant.test 127.0.0.1',
        `--ignore-certificate-errors-spki-list=${checkoutSpki}`] });
}, { timeout: 400_000 });
after(async () => {
    await Promise.allSettled(contexts.map(context => context.close()));
    await browser?.close();
    await gateway?.settle();tap?.restore();await closePooledSqlClients();await proxy?.stop();
    if (checkoutTls?.listening) await new Promise<void>(resolve => {
        checkoutTls!.close(() => resolve()); checkoutTls!.closeAllConnections();
    });
    await Promise.allSettled(clients.map(child => stopOwnedClientRuntime(child)));
    if (bridge?.listening) await new Promise<void>(resolve => bridge!.close(() => resolve()));
});

async function fixture(tag: string, options: SeedOptions = {}) {
    const tenant = newSyntheticTenant(tag); seedSyntheticTenant(owned.psql, tenant, options);
    const owner = crypto.randomUUID(), staff = crypto.randomUUID(), product = crypto.randomUUID();
    const email = `syn-published-owner-${owner}@example.invalid`, staffEmail = `syn-published-staff-${staff}@example.invalid`;
    const hash = await hashMerchantPassword(password);
    owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name,password_hash) VALUES
        ('${owner}','${email}',true,'Synthetic Published Owner','${hash}'),
        ('${staff}','${staffEmail}',true,'Synthetic Published Content Staff','${hash}');
        UPDATE sites SET custom_user_id='${owner}',theme_id='${slug}' WHERE id='${tenant.siteId}';
        INSERT INTO employees(store_id,user_id,email,role,status,is_active,permissions,created_by)
        VALUES('${tenant.siteId}','${staff}','${staffEmail}','editor','active',true,'{"granted":["content:write"]}','${owner}');
        INSERT INTO products(id,site_id,store_id,name,price,stock,sku,is_active,status,created_at,updated_at)
        VALUES('${product}','${tenant.siteId}','${tenant.siteId}','Synthetic published Liquid product',199,25,'SYN-PUBLISHED-${product}',true,'active',now(),now());
        INSERT INTO inventory_levels(id,store_id,product_id,variant_id,location_id,available,reserved,committed_quantity,available_quantity,reserved_quantity,on_hand_quantity,created_at,updated_at)
        VALUES(gen_random_uuid(),'${tenant.siteId}','${product}',NULL,'${tenant.locationId}',25,0,0,25,0,25,now(),now());`);
    assert.equal(owned.psql(`SELECT p.stock::text||'|'||(SELECT sum(i.available_quantity)::text FROM inventory_levels i
        WHERE i.store_id=p.store_id AND i.product_id=p.id) FROM products p WHERE p.id='${product}';`),'25|25',
        'the positive purchase fixture has matching public availability and canonical inventory');
    const context = await browser!.newContext({ viewport: { width: 1440, height: 1000 } }); contexts.push(context);
    context.setDefaultNavigationTimeout(90_000);
    const page = await context.newPage(); page.setDefaultTimeout(30_000); page.setDefaultNavigationTimeout(90_000);
    const previewDocuments: unknown[] = [];
    context.on('close', () => console.info('N4_PREVIEW_DOCUMENT_DIAGNOSTIC', JSON.stringify({ tag, documents: previewDocuments })));
    page.on('pageerror', error => previewDocuments.push({ event: 'pageerror', ...previewDiagnostic(error.message) }));
    page.on('requestfailed', request => {
        if (request.isNavigationRequest() && request.frame().parentFrame()) {
            previewDocuments.push({ event: 'frame-navigation-failed', path: new URL(request.url()).pathname });
        }
    });
    page.on('response', response => {
        const request = response.request();
        if (!request.isNavigationRequest() || !request.frame().parentFrame()) return;
        const path = new URL(response.url()).pathname;
        void response.text().then(text => previewDocuments.push({ event: 'frame-document', path,
            status: response.status(), ...previewDiagnostic(text) }))
            .catch(() => previewDocuments.push({ event: 'frame-body-unavailable', path, status: response.status() }));
    });
    const pendingEditorMutations = new Set<object>();
    const previewReads: Array<{ version: number; tokenHash: string }> = [];
    page.on('request', request => {
        const path = new URL(request.url()).pathname;
        if (request.method() === 'POST' && (path.endsWith('/editor/draft') || path.endsWith('/preview-session'))) pendingEditorMutations.add(request);
    });
    page.on('requestfinished', request => pendingEditorMutations.delete(request));
    page.on('requestfailed', request => pendingEditorMutations.delete(request));
    page.on('response', response => {
        if (response.status() === 200 && response.request().method() === 'POST' && new URL(response.url()).pathname.endsWith('/preview-session')) {
            void response.json().then(payload => {
                if (Number.isInteger(payload.data?.draft_version) && typeof payload.data?.preview_token === 'string') {
                    previewReads.push({ version: payload.data.draft_version, tokenHash: createHash('sha256').update(payload.data.preview_token).digest('hex') });
                }
            }).catch(() => undefined);
        }
    });
    const editorUrl = `${merchantOrigin}/${tenant.subdomain}/online-store/themes/${slug}/editor`;
    const bff = `/api/themes/${slug}/editor?store_name=${tenant.subdomain}`;
    const publicUrl = `https://${tenant.subdomain}.localhost:${checkoutTlsPort}`;
    const effects = () => owned.psql(`SELECT
        (SELECT coalesce(max(draft_revision),0) FROM theme_instances WHERE store_id='${tenant.siteId}'),
        (SELECT count(*) FROM theme_releases WHERE store_id='${tenant.siteId}'),
        (SELECT count(*) FROM audit_activity_events WHERE store_id='${tenant.siteId}'),
        (SELECT count(*) FROM outbox_events WHERE store_id='${tenant.siteId}'),
        (SELECT count(*) FROM idempotency_keys WHERE site_id='${tenant.siteId}');`);
    const currentRelease = () => owned.psql(`SELECT current_theme_release_id FROM sites WHERE id='${tenant.siteId}';`);
    return { tenant, owner, staff, email, staffEmail, product, context, page, editorUrl, bff, publicUrl, effects, currentRelease, pendingEditorMutations, previewReads };
}
async function signIn(page: Page, email: string) {
    await page.goto(identityOrigin + '/login');
    await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/, { timeout: 30_000 });
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByRole('button', { name: 'Continue with email', exact: true }).click();
    await page.getByLabel('Password', { exact: true }).fill(password);
    const [login] = await Promise.all([page.waitForResponse(response => new URL(response.url()).pathname === '/api/auth/login' && response.request().method() === 'POST'),
        page.getByRole('button', { name: 'Log in', exact: true }).click()]);
    assert.equal(login.status(), 200, 'normal Identity password authentication');
    await page.waitForURL(url => url.origin === merchantOrigin);
    await page.waitForLoadState('networkidle');
}
async function openEditor(f: Awaited<ReturnType<typeof fixture>>) {
    const compiled = await f.context.request.get(f.editorUrl); assert.equal(compiled.status(), 200);
    await f.page.goto(f.editorUrl, { waitUntil: 'load' });
    await expect(f.page.getByRole('tree', { name: 'Theme sections', exact: true })).toBeVisible();
    await expect(f.page.getByRole('button', { name: 'Save', exact: true }).first()).toBeDisabled();
    if (Number(f.effects().split('|')[0]) === 0) {
        const marker = `Synthetic initial saved draft ${crypto.randomUUID()}`;
        const [initialSave] = await Promise.all([f.page.waitForResponse(response =>
            new URL(response.url()).pathname.endsWith('/editor/draft') && response.request().method() === 'POST' &&
            Boolean(response.request().postData()?.includes(marker)), { timeout: 90_000 }), editHeading(f.page, marker)]);
        assert.equal(initialSave.status(), 200, 'a real initial edit is saved before the first publication');
        await expect(f.page.getByRole('button', { name: 'Save', exact: true }).first()).toBeDisabled();
    }
    await expect.poll(() => Number(f.effects().split('|')[0])).toBeGreaterThan(0);
    // Finish normal initial editor setup before the ORIGINAL before-logout
    // baseline. No counters are moved/ignored and no request is intercepted.
    const frame = f.page.locator('iframe.te-preview-iframe');
    await expect.poll(async () => {
        const source = await frame.getAttribute('src');
        if (!source) return false;
        const token = new URL(source).searchParams.get('theme_preview_token');
        if (!token) return false;
        const hash = createHash('sha256').update(token).digest('hex');
        return f.previewReads.some(read => read.version === Number(f.effects().split('|')[0]) && read.tokenHash === hash);
    }, { timeout: 90_000 }).toBe(true);
    await expect(f.page.locator('.te-preview-status[role="status"]')).toHaveCount(0);
    await expect(f.page.frameLocator('iframe.te-preview-iframe').locator('[data-letbuyy-preview-route="true"]')).toBeVisible({ timeout: 90_000 });
    await expect.poll(() => f.pendingEditorMutations.size, { timeout: 90_000 }).toBe(0);
}
async function editHeading(page: Page, heading: string) {
    await page.getByRole('tree', { name: 'Theme sections', exact: true }).getByRole('treeitem').filter({ hasText: /Hero/ }).first().click();
    await page.getByLabel('Heading', { exact: true }).fill(heading);
}
async function publish(page: Page) {
    const [response] = await Promise.all([page.waitForResponse(r => new URL(r.url()).pathname === `/api/themes/${slug}/editor` && r.request().method() === 'PUT'),
        page.getByRole('button', { name: 'Publish', exact: true }).click()]);
    assert.equal(response.status(), 200, 'normal mounted editor publication');
    return response.json();
}

test('normal Merchant publication renders the saved Liquid heading on the real public Commerce origin and buys through canonical cart/handoff', { timeout: 400_000 }, async t => {
    const f = await fixture('published-liquid'); t.after(() => f.context.close());
    await signIn(f.page, f.email);
    const profileName = `Synthetic merchant ${f.tenant.subdomain}`;
    const profileTitle = `Synthetic SEO ${f.tenant.subdomain}`;
    const profileDescription = `Public storefront description for ${f.tenant.subdomain}.`;
    const contactEmail = `contact-${f.tenant.subdomain}@example.invalid`;
    await f.page.goto(`${merchantOrigin}/${f.tenant.subdomain}/settings/general`);
    await expect(f.page.getByLabel('Store name', { exact: true })).toBeVisible();
    await f.page.getByLabel('Store name', { exact: true }).fill(profileName);
    await f.page.getByLabel('SEO title', { exact: true }).fill(profileTitle);
    await f.page.getByLabel('SEO description', { exact: true }).fill(profileDescription);
    await f.page.getByLabel('Contact email', { exact: true }).fill(contactEmail);
    await f.page.getByRole('switch', { name: 'Show these contact details on my storefront' }).click();
    const [profileSave] = await Promise.all([
        f.page.waitForResponse(response => new URL(response.url()).pathname === `/api/stores/${f.tenant.subdomain}/settings`
            && response.request().method() === 'PATCH'),
        f.page.getByRole('button', { name: 'Save', exact: true }).first().click(),
    ]);
    assert.equal(profileSave.status(), 200, 'normal General settings save reaches the canonical site API');
    assert.equal(owned.psql(`SELECT name||'|'||meta_title||'|'||meta_description||'|'||(business_profile->>'email')
        FROM sites WHERE id='${f.tenant.siteId}';`), `${profileName}|${profileTitle}|${profileDescription}|${contactEmail}`,
        'General settings save is visible in the owned canonical sites row');
    await openEditor(f);
    await expect(f.page.frameLocator('iframe.te-preview-iframe').locator('body')).toContainText(profileName);
    await publish(f.page);
    const firstRelease = f.currentRelease(); assert.ok(firstRelease);
    const buyer = await f.context.newPage();
    buyer.on('framenavigated', frame => {
        if (!frame.parentFrame()) console.info('N4_PUBLIC_NAVIGATION', JSON.stringify({ path: new URL(frame.url()).pathname }));
    });
    buyer.on('response', response => {
        const path = new URL(response.url()).pathname;
        if (path.startsWith('/api/storefront/') || path === '/api/checkout-handoff') {
            console.info('N4_PUBLIC_CART_RESPONSE', JSON.stringify({ path: path.replace(/(\/cart\/)[^/]+/, '$1[redacted]'), status: response.status() }));
        }
    });
    buyer.on('pageerror', error => console.info('N4_PUBLIC_CLIENT_ERROR', JSON.stringify(previewDiagnostic(error.message))));
    const initial = await buyer.goto(f.publicUrl); assert.equal(initial?.status(), 200);
    await expect(buyer.locator('[data-theme-renderer="liquid"][data-editor-mode="false"]').first()).toBeVisible();
    await buyer.waitForLoadState('networkidle');
    await expect(buyer).toHaveTitle(profileTitle);
    assert.equal(await buyer.locator('meta[name="description"]').getAttribute('content'), profileDescription);
    await expect(buyer.getByRole('link', { name: contactEmail }).first()).toBeVisible();
    assert.ok((await buyer.locator('link[rel="canonical"]').getAttribute('href'))?.includes(f.tenant.subdomain),
        'published metadata resolves to this tenant storefront');
    assert.doesNotMatch(await buyer.locator('body').innerText(), /Private Legal Name|pan_last4|never-public/);
    const initialHeading = await buyer.getByRole('heading', { level: 1 }).first().textContent();
    const marker = `Synthetic saved release ${crypto.randomUUID()}`;
    await editHeading(f.page, marker);
    await buyer.reload();
    await expect(buyer.getByRole('heading', { level: 1 }).first()).toHaveText(initialHeading || '');
    await expect(f.page.getByRole('button', { name: 'Save', exact: true }).first()).toBeDisabled();
    assert.equal(f.currentRelease(), firstRelease, 'an autosaved unpublished draft leaves the live pointer alone');
    await buyer.reload();
    await expect(buyer.getByRole('heading', { level: 1 }).first()).toHaveText(initialHeading || '');
    const published = await publish(f.page), secondRelease = f.currentRelease();
    assert.notEqual(secondRelease, firstRelease);
    assert.equal(published.release.release_id, secondRelease);
    assert.equal(owned.psql(`SELECT (template_snapshot::text LIKE '%${marker}%') FROM theme_releases WHERE id='${secondRelease}';`), 't');
    await buyer.reload(); // No cache-busting query, engine override or substituted HTML.
    await expect(buyer.getByRole('heading', { level: 1 }).first()).toHaveText(marker);
    // Browse the real data-bound catalog; captured home product-grid code is block-driven.
    await buyer.getByRole('link', { name: 'Catalog', exact: true }).click();
    await buyer.waitForURL(url => (url.pathname === '/products' || url.pathname === `/store/${f.tenant.subdomain}/products`), { waitUntil: 'domcontentloaded' });
    assert.ok(['/products',`/store/${f.tenant.subdomain}/products`].includes(new URL(buyer.url()).pathname));
    await expect(buyer.locator('[data-theme-renderer="liquid"][data-editor-mode="false"]').first()).toBeVisible();
    await buyer.waitForLoadState('networkidle');
    // The catalog menu can also contain the product label. Select the actual
    // data-bound product anchor, then require its normal browser navigation.
    await buyer.locator(`a[href$="/product/${f.product}"]`).filter({ hasText: 'Synthetic published Liquid product' }).first().click();
    await buyer.waitForURL(url => (url.pathname === `/product/${f.product}` || url.pathname === `/store/${f.tenant.subdomain}/product/${f.product}`), { waitUntil: 'domcontentloaded' });
    assert.ok([`/product/${f.product}`,`/store/${f.tenant.subdomain}/product/${f.product}`].includes(new URL(buyer.url()).pathname));
    await expect(buyer.locator('[data-theme-renderer="liquid"][data-editor-mode="false"]').first()).toBeVisible();
    await buyer.waitForFunction(() => Boolean(customElements.get('lb-add-to-cart')));
    const buyNow = buyer.getByRole('button', { name: 'Buy now', exact: true });
    console.info('N4_PUBLIC_PURCHASE_STATE', JSON.stringify(await buyNow.evaluate(button => {
        const island = button.closest<HTMLElement>('lb-add-to-cart');
        return { disabled: (button as HTMLButtonElement).disabled, buyNowMarker: button.hasAttribute('data-lb-buy-now'),
            islandPresent: Boolean(island), productPresent: Boolean(island?.dataset.productId),
            quantity: island?.querySelector<HTMLInputElement>('[name="quantity"]')?.value,
            status: island?.querySelector('[data-lb-add-to-cart-status]')?.textContent };
    })));
    await buyNow.click({ trial: true });
    const [handoff, checkoutDocument] = await Promise.all([buyer.waitForResponse(r => new URL(r.url()).pathname === '/api/checkout-handoff' && r.request().method() === 'POST'),
        buyer.waitForResponse(response => {
            const url = new URL(response.url());
            return url.protocol === 'https:' && url.hostname === 'checkout.localhost' && url.port === String(checkoutTlsPort)
                && url.pathname === '/checkout' && response.request().isNavigationRequest();
        }, { timeout: 90_000 }),
        buyNow.click()]);
    assert.equal(handoff.status(), 200, 'real product action creates a canonical server cart and checkout handoff');
    assert.equal(checkoutDocument.status(), 200, 'the scoped local TLS certificate reaches the real hosted checkout document');
    await buyer.waitForURL(url => url.hostname === 'checkout.localhost' && url.pathname === '/checkout', { waitUntil: 'domcontentloaded' });
    assert.equal(new URL(buyer.url()).protocol, 'https:');
    assert.equal(new URL(buyer.url()).port, String(checkoutTlsPort));
    assert.equal(owned.psql(`SELECT count(*) FROM carts WHERE store_id='${f.tenant.siteId}';`), '1');
    assert.equal(owned.psql(`SELECT count(*) FROM orders WHERE store_id='${f.tenant.siteId}';`), '0', 'handoff proof stops before any order or payment');

    // This owned fixture marks one local test hostname active to exercise the
    // Commerce host rewrite and metadata. Real DNS/TLS/provider verification is
    // a separate hosted acceptance gate and is not simulated by this DB row.
    owned.psql(`UPDATE sites SET custom_domain='shop.merchant.test', custom_domain_status='active'
        WHERE id='${f.tenant.siteId}';`);
    const customBuyer = await f.context.newPage();
    const customResponse = await customBuyer.goto(`https://shop.merchant.test:${checkoutTlsPort}`);
    if (customResponse?.status() !== 200) console.info('N4_CUSTOM_HOST_DIAGNOSTIC', JSON.stringify({
        status: customResponse?.status(), host: customResponse ? new URL(customResponse.url()).host : null,
        server: customResponse?.headers()['server'] || null,
        bodyHash: customResponse ? createHash('sha256').update(await customResponse.text()).digest('hex') : null,
    }));
    assert.equal(customResponse?.status(), 200, 'verified-host-shaped request reaches the same published store');
    await expect(customBuyer).toHaveTitle(profileTitle);
    assert.equal(await customBuyer.locator('meta[name="description"]').getAttribute('content'), profileDescription);
    assert.equal(new URL((await customBuyer.locator('link[rel="canonical"]').getAttribute('href')) || '').origin,
        'https://shop.merchant.test', 'custom-domain canonical metadata uses the store host');
    await expect(customBuyer.getByRole('link', { name: contactEmail }).first()).toBeVisible();
});

test('two Merchant settings tabs report stale saves and preserve a cleared contact field', { timeout: 180_000 }, async t => {
    const f = await fixture('profile-two-tabs'); t.after(() => f.context.close());
    owned.psql(`UPDATE sites SET business_profile='{"email":"before-clear@example.invalid"}'::jsonb
        WHERE id='${f.tenant.siteId}';`);
    await signIn(f.page, f.email);
    const address = `${merchantOrigin}/${f.tenant.subdomain}/settings/general`;
    const staleTab = await f.context.newPage();
    await Promise.all([f.page.goto(address), staleTab.goto(address)]);
    await Promise.all([
        expect(f.page.getByLabel('Contact email', { exact: true })).toHaveValue('before-clear@example.invalid'),
        expect(staleTab.getByLabel('Contact email', { exact: true })).toHaveValue('before-clear@example.invalid'),
    ]);
    await f.page.getByLabel('Contact email', { exact: true }).fill('');
    const [clearResponse] = await Promise.all([
        f.page.waitForResponse(response => new URL(response.url()).pathname === `/api/stores/${f.tenant.subdomain}/settings`
            && response.request().method() === 'PATCH'),
        f.page.getByRole('button', { name: 'Save', exact: true }).first().click(),
    ]);
    assert.equal(clearResponse.status(), 200);
    assert.equal(owned.psql(`SELECT business_profile ? 'email' FROM sites WHERE id='${f.tenant.siteId}';`), 'f');
    await staleTab.getByLabel('Store name', { exact: true }).fill('Stale tab attempted rename');
    const [staleResponse] = await Promise.all([
        staleTab.waitForResponse(response => new URL(response.url()).pathname === `/api/stores/${f.tenant.subdomain}/settings`
            && response.request().method() === 'PATCH'),
        staleTab.getByRole('button', { name: 'Save', exact: true }).first().click(),
    ]);
    assert.equal(staleResponse.status(), 409);
    await expect(staleTab.getByText('Store settings changed. Reload before saving.')).toBeVisible();
    assert.equal(owned.psql(`SELECT business_profile ? 'email' FROM sites WHERE id='${f.tenant.siteId}';`), 'f',
        'the stale tab never restores a cleared contact');
    assert.notEqual(owned.psql(`SELECT name FROM sites WHERE id='${f.tenant.siteId}';`), 'Stale tab attempted rename');
    await staleTab.reload();
    await expect(staleTab.getByLabel('Contact email', { exact: true })).toHaveValue('');
});

test('General and Business expose keyboard labels and recover an optional status read in light and dark themes', { timeout: 180_000 }, async t => {
    const f = await fixture('settings-a11y'); t.after(() => f.context.close());
    await signIn(f.page, f.email);
    await f.page.evaluate(() => localStorage.setItem('letbuyy-theme', 'light'));
    await f.page.goto(`${merchantOrigin}/${f.tenant.subdomain}/settings/general`);
    await expect.poll(() => f.page.locator('html').getAttribute('data-theme')).toBe('light');
    const storeName = f.page.getByRole('textbox', { name: 'Store name', exact: true });
    await expect(storeName).toBeVisible();
    const generalTree = await f.page.locator('form.settings-general-stack').ariaSnapshot();
    assert.match(generalTree, /textbox "Store name"/);
    assert.match(generalTree, /textbox "Tagline"/);
    await storeName.focus();
    await f.page.keyboard.press('Tab');
    await expect(f.page.getByRole('textbox', { name: 'Tagline', exact: true })).toBeFocused();

    let failOnce = true;
    await f.page.route(`**/api/stores/${f.tenant.subdomain}/kyc`, async route => {
        if (failOnce) {
            failOnce = false;
            await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Synthetic status outage' } }) });
            return;
        }
        await route.continue();
    });
    await f.page.goto(`${merchantOrigin}/${f.tenant.subdomain}/settings/business`);
    const warning = f.page.getByRole('status').filter({ hasText: 'Some business information is unavailable' });
    await expect(warning).toBeVisible();
    const retry = warning.getByRole('button', { name: 'Retry status' });
    await retry.focus();
    await f.page.keyboard.press('Enter');
    await expect(f.page.getByRole('status').filter({ hasText: 'Sandbox verification' })).toBeVisible();
    await expect(warning).toHaveCount(0);

    await f.page.evaluate(() => localStorage.setItem('letbuyy-theme', 'dark'));
    await f.page.reload();
    await expect.poll(() => f.page.locator('html').getAttribute('data-theme')).toBe('dark');
    const pan = f.page.locator('.settings-business-kyc-item').filter({ hasText: 'Business PAN' }).first();
    const businessTree = await pan.ariaSnapshot();
    assert.match(businessTree, /textbox "Last 4 of PAN"/);
    assert.match(businessTree, /button "Upload document"/);
    await pan.getByRole('textbox', { name: 'Last 4 of PAN' }).focus();
    await f.page.keyboard.press('Tab');
    await expect(pan.getByLabel('Upload Business PAN')).toBeFocused();

    await f.page.goto(`${merchantOrigin}/${f.tenant.subdomain}/products`);
    for (const [label, path] of [
        ['Inventory history', 'products/inventory-history'],
        ['Reservations', 'products/reservations'],
        ['Locations', 'products/locations'],
        ['Operations dashboard', 'products/operations-dashboard'],
    ]) {
        await expect(f.page.getByRole('link', { name: label, exact: true })).toHaveAttribute('href',
            `/${f.tenant.subdomain}/${path}`);
    }
});

test('Business disables private uploads on an unavailable KYC binding and recovers after status reload', { timeout: 180_000 }, async t => {
    const f = await fixture('kyc-binding-recovery'); t.after(() => f.context.close());
    await signIn(f.page, f.email);
    const statusPath = `**/api/stores/${f.tenant.subdomain}/kyc`;
    await f.page.route(statusPath, async route => {
        const upstream = await route.fetch();
        const payload = await upstream.json() as { data: { private_upload_available: boolean; next_action: string } };
        payload.data.private_upload_available = false;
        payload.data.next_action = 'Private document upload is unavailable. Your saved status remains visible; retry later.';
        await route.fulfill({ response: upstream, json: payload });
    });
    await f.page.goto(`${merchantOrigin}/${f.tenant.subdomain}/settings/business`);
    await expect(f.page.getByRole('status').filter({ hasText: 'Private uploads unavailable' })).toBeVisible();
    const pan = f.page.locator('.settings-business-kyc-item').filter({ hasText: 'Business PAN' }).first();
    await expect(pan.getByLabel('Upload Business PAN')).toBeDisabled();
    await expect(pan.getByRole('button', { name: 'Upload document' })).toBeDisabled();
    await f.page.unroute(statusPath);
    await f.page.reload();
    await expect(f.page.getByRole('status').filter({ hasText: 'Sandbox verification' })).toBeVisible();
    await expect(pan.getByLabel('Upload Business PAN')).toBeEnabled();
    await expect(pan.getByRole('button', { name: 'Upload document' })).toBeEnabled();
});

test('Merchant KYC proxy denies closed intake, then sends India file bytes directly to Mumbai storage', { timeout: 240_000 }, async t => {
    const f = await fixture('kyc-proxy-closed'); t.after(() => f.context.close());
    await signIn(f.page, f.email);
    gateway.env.KYC_UPLOAD_ENABLED = 'false';
    t.after(() => { gateway.env.KYC_UPLOAD_ENABLED = 'true'; });
    const before = privateKycObjects.size;
    const response = await f.page.request.post(
        `${merchantOrigin}/api/stores/${f.tenant.subdomain}/kyc/upload`,
        { data: 'not-a-valid-multipart-document', headers: {
            'content-type': 'multipart/form-data; boundary=missing',
            'x-idempotency-key': crypto.randomUUID(),
        } },
    );
    assert.equal(response.status(), 503, await response.text());
    assert.equal((await response.json() as { error?: { code?: string } }).error?.code, 'KYC_UPLOAD_UNAVAILABLE');
    assert.equal(privateKycObjects.size, before, 'closed intake cannot write a fixture object');

    const pdf = Buffer.from('%PDF-1.7\nSynthetic Mumbai browser upload proof\n');
    const digest = createHash('sha256').update(pdf).digest();
    const replacementPdf = Buffer.from('%PDF-1.7\nSynthetic Mumbai replacement proof\n');
    const replacementDigest = createHash('sha256').update(replacementPdf).digest();
    const bucket = 'letbuyy-kyc-mumbai-synthetic';
    const versionId = 'synthetic-version-1';
    const replacementVersionId = 'synthetic-version-2';
    const indiaConfig = {
        KYC_INDIA_UPLOAD_ENABLED: 'true', KYC_INDIA_BUCKET: bucket,
        KYC_INDIA_ACCOUNT_ID: '123456789012',
        KYC_INDIA_UPLOAD_ROLE_ARN: 'arn:aws:iam::123456789012:role/letbuyy-kyc-upload',
        KYC_INDIA_STS_ACCESS_KEY_ID: 'SYNTHETICKEY12345678',
        KYC_INDIA_STS_SECRET_ACCESS_KEY: 'synthetic-sts-source-secret-for-tests',
        KYC_INDIA_HEAD_ACCESS_KEY_ID: 'SYNTHETICHEAD12345678',
        KYC_INDIA_HEAD_SECRET_ACCESS_KEY: 'synthetic-head-secret-for-tests',
    } as const;
    const mutableEnv = gateway.env as unknown as Record<string, unknown>;
    const priorConfig = Object.fromEntries(Object.keys(indiaConfig).map(key => [key, mutableEnv[key]]));
    Object.assign(mutableEnv, indiaConfig);
    t.after(() => { for (const key of Object.keys(indiaConfig)) mutableEnv[key] = priorConfig[key]; });

    const originalFetch = globalThis.fetch;
    let stsCalls = 0, headCalls = 0, browserPosts = 0;
    let rejectNextPost = false;
    let browserPostHasFile = false, browserPostHasScopedKey = false;
    const browserUploadFailures: string[] = [];
    f.page.on('requestfailed', request => {
        if (request.url().includes(`${bucket}.s3.ap-south-1.amazonaws.com`)) {
            browserUploadFailures.push(request.failure()?.errorText || 'unknown browser request failure');
        }
    });
    f.page.on('console', message => {
        if (message.type() === 'error' && /amazonaws|CORS|Content Security Policy|Failed to fetch/.test(message.text())) {
            browserUploadFailures.push(`console:${['CORS', 'Content Security Policy', 'Failed to fetch', 'net::']
                .filter(marker => message.text().includes(marker)).join('|') || 'browser error'}`);
        }
    });
    globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
        const target = String(url);
        if (target === 'https://sts.ap-south-1.amazonaws.com/') {
            stsCalls++;
            assert.equal(init?.method, 'POST');
            const policy = JSON.parse(new URLSearchParams(String(init?.body)).get('Policy')!) as {
                Statement: Array<{ Resource: string }>;
            };
            assert.match(policy.Statement[0].Resource,
                new RegExp(`^arn:aws:s3:::${bucket}/kyc/${f.tenant.siteId}/business_pan/[a-f0-9-]{36}$`));
            return new Response(`<AssumeRoleResponse><AssumeRoleResult><Credentials>
                <AccessKeyId>ASIATEMPORARY12345678</AccessKeyId>
                <SecretAccessKey>synthetic-temporary-secret-123456</SecretAccessKey>
                <SessionToken>syntheticTempSession1234567890==</SessionToken>
                <Expiration>${new Date(Date.now() + 15 * 60_000).toISOString()}</Expiration>
                </Credentials></AssumeRoleResult></AssumeRoleResponse>`,
                { status: 200, headers: { 'content-type': 'text/xml' } });
        }
        if (target.startsWith(`https://${bucket}.s3.ap-south-1.amazonaws.com/kyc/`)) {
            headCalls++;
            assert.equal(init?.method, 'HEAD');
            const requestedVersion = new URL(target).searchParams.get('versionId');
            assert.ok(requestedVersion === versionId || requestedVersion === replacementVersionId);
            const expectedBytes = requestedVersion === versionId ? pdf : replacementPdf;
            const expectedDigest = requestedVersion === versionId ? digest : replacementDigest;
            const headers = new Headers(init?.headers);
            assert.equal(headers.get('x-amz-expected-bucket-owner'), '123456789012');
            assert.equal(headers.get('x-amz-checksum-mode'), 'ENABLED');
            return new Response(null, { status: 200, headers: {
                'x-amz-version-id': requestedVersion, 'content-length': String(expectedBytes.length),
                'content-type': 'application/pdf', 'x-amz-checksum-sha256': expectedDigest.toString('base64'),
                'x-amz-server-side-encryption': 'AES256',
            } });
        }
        if (/^https:\/\/[^/]*amazonaws\.com\//.test(target)) throw new Error('Unexpected synthetic AWS request');
        return originalFetch(url, init);
    }) as typeof fetch;
    t.after(() => { globalThis.fetch = originalFetch; });

    await f.page.route(`https://${bucket}.s3.ap-south-1.amazonaws.com/**`, async route => {
        if (route.request().method() === 'OPTIONS') {
            await route.fulfill({ status: 204, headers: {
                'access-control-allow-origin': merchantOrigin,
                'access-control-allow-methods': 'POST',
                'access-control-allow-headers': '*',
            } });
            return;
        }
        assert.equal(route.request().method(), 'POST');
        browserPosts++;
        const body = route.request().postDataBuffer();
        browserPostHasFile = Boolean(body?.includes(browserPosts === 1 ? pdf : replacementPdf));
        browserPostHasScopedKey = Boolean(body?.includes(Buffer.from(`kyc/${f.tenant.siteId}/business_pan/`)));
        if (rejectNextPost) {
            rejectNextPost = false;
            await route.fulfill({ status: 503, headers: { 'access-control-allow-origin': merchantOrigin },
                body: 'Synthetic S3 outage' });
            return;
        }
        await route.fulfill({ status: 201, headers: {
            'access-control-allow-origin': merchantOrigin,
            'access-control-expose-headers': 'x-amz-version-id',
            'x-amz-version-id': browserPosts === 1 ? versionId : replacementVersionId,
        } });
    });

    await f.page.goto(`${merchantOrigin}/${f.tenant.subdomain}/settings/business`);
    await expect(f.page.getByRole('status').filter({ hasText: 'India upload test' })).toBeVisible();
    const pan = f.page.locator('.settings-business-kyc-item').filter({ hasText: 'Business PAN' }).first();
    await pan.getByRole('textbox', { name: 'Last 4 of PAN' }).fill('1234');
    await pan.getByLabel('Upload Business PAN').setInputFiles({ name: 'synthetic-pan.pdf', mimeType: 'application/pdf', buffer: pdf });
    const completionPromise = f.page.waitForResponse(response =>
        new URL(response.url()).pathname === `/api/stores/${f.tenant.subdomain}/kyc/upload-complete`
            && response.request().method() === 'POST', { timeout: 30_000 })
        .then(response => ({ response }), error => ({ error }));
    const [intent] = await Promise.all([
        f.page.waitForResponse(response => new URL(response.url()).pathname === `/api/stores/${f.tenant.subdomain}/kyc/upload-intent`
            && response.request().method() === 'POST'),
        pan.getByRole('button', { name: 'Upload document' }).click(),
    ]);
    assert.equal(intent.status(), 201, await intent.text());
    const state = await completionPromise;
    if ('error' in state) throw new Error(`Mumbai browser completion missing: posts=${browserPosts}, file=${browserPostHasFile}, scopedKey=${browserPostHasScopedKey}, failures=${browserUploadFailures.join(',')}, page=${(await f.page.locator('body').innerText()).slice(-500)}`, { cause: state.error });
    const complete = state.response;
    assert.equal(complete.status(), 201, await complete.text());
    assert.equal(browserPostHasFile, true, 'the browser sends the selected file bytes to Mumbai S3');
    assert.equal(browserPostHasScopedKey, true, 'the signed form contains this site and document key');
    for (const response of [intent, complete]) {
        assert.equal(response.request().headers()['content-type'], 'application/json');
        assert.equal(response.request().postData()?.includes('Synthetic Mumbai browser upload proof'), false,
            'file bytes cannot transit the Merchant proxy');
    }
    await expect(pan.getByRole('status')).toHaveText(/No scan result yet/);
    assert.equal(stsCalls, 1);
    assert.equal(browserPosts, 1);
    assert.equal(headCalls, 1);
    assert.equal(owned.psql(`SELECT status||'|'||provider_mode||'|'||(metadata->>'private_storage_provider')||'|'||
        (metadata->>'private_object_version_id')||'|'||(metadata->>'malware_scan_status')||'|'||
        (metadata->>'provider_verified') FROM merchant_kyc_documents
        WHERE site_id='${f.tenant.siteId}' AND document_type='business_pan';`),
        `submitted|sandbox|aws_s3_mumbai|${versionId}|pending|false`);
    assert.equal(owned.psql(`SELECT status||'|'||outcome FROM kyc_private_object_cleanup_jobs
        WHERE site_id='${f.tenant.siteId}' AND storage_provider='aws_s3_mumbai';`), 'completed|retained');
    assert.doesNotMatch(await f.page.locator('body').innerText(), /kyc\/[^\s]+\/business_pan\/|synthetic-temporary|sha256_hex/);

    // The storage outage must leave the first evidence row intact. A new
    // browser attempt must get a fresh ticket and replace it only on completion.
    const firstObjectKey = owned.psql(`SELECT metadata->>'private_object_key' FROM merchant_kyc_documents
        WHERE site_id='${f.tenant.siteId}' AND document_type='business_pan';`);
    await pan.getByRole('textbox', { name: 'Last 4 of PAN' }).fill('5678');
    await pan.getByLabel('Upload Business PAN').setInputFiles({ name: 'replacement-pan.pdf',
        mimeType: 'application/pdf', buffer: replacementPdf });
    rejectNextPost = true;
    const [outageIntent] = await Promise.all([
        f.page.waitForResponse(item => new URL(item.url()).pathname === `/api/stores/${f.tenant.subdomain}/kyc/upload-intent`
            && item.request().method() === 'POST'),
        pan.getByRole('button', { name: 'Resubmit document' }).click(),
    ]);
    assert.equal(outageIntent.status(), 201, await outageIntent.text());
    await expect(f.page.getByText('Submission failed')).toBeVisible();
    await expect(f.page.getByText('Private storage did not accept the document. Retry upload.')).toBeVisible();
    assert.equal(browserPosts, 2);
    assert.equal(headCalls, 1, 'a rejected S3 POST cannot trigger upload completion');
    assert.equal(owned.psql(`SELECT document_number_last4||'|'||(metadata->>'private_object_key')||'|'||
        (metadata->>'private_object_version_id')||'|'||(metadata->>'provider_verified')
        FROM merchant_kyc_documents WHERE site_id='${f.tenant.siteId}' AND document_type='business_pan';`),
        `1234|${firstObjectKey}|${versionId}|false`, 'storage outage leaves existing private evidence unchanged');
    await expect(pan.getByRole('status')).toHaveText(/No scan result yet/);

    const replacementCompletionPromise = f.page.waitForResponse(item =>
        new URL(item.url()).pathname === `/api/stores/${f.tenant.subdomain}/kyc/upload-complete`
            && item.request().method() === 'POST', { timeout: 30_000 });
    const [retryIntent, retryCompletion] = await Promise.all([
        f.page.waitForResponse(item => new URL(item.url()).pathname === `/api/stores/${f.tenant.subdomain}/kyc/upload-intent`
            && item.request().method() === 'POST'),
        replacementCompletionPromise,
        pan.getByRole('button', { name: 'Resubmit document' }).click(),
    ]);
    assert.equal(retryIntent.status(), 201, await retryIntent.text());
    assert.equal(retryCompletion.status(), 201, await retryCompletion.text());
    await expect(pan.getByRole('status')).toHaveText(/No scan result yet/);
    assert.equal(browserPosts, 3);
    assert.equal(headCalls, 2);
    const replacementObjectKey = owned.psql(`SELECT metadata->>'private_object_key' FROM merchant_kyc_documents
        WHERE site_id='${f.tenant.siteId}' AND document_type='business_pan';`);
    assert.notEqual(replacementObjectKey, firstObjectKey);
    assert.equal(owned.psql(`SELECT document_number_last4||'|'||(metadata->>'private_object_version_id')||'|'||
        (metadata->>'malware_scan_status')||'|'||(metadata->>'provider_verified')
        FROM merchant_kyc_documents WHERE site_id='${f.tenant.siteId}' AND document_type='business_pan';`),
        `5678|${replacementVersionId}|pending|false`);
});

test('Merchant order detail renders generated order and immutable GST invoice numbers after a Business edit', { timeout: 180_000 }, async t => {
    const f = await fixture('merchant-invoice', { gst: true, taxRates: true }); t.after(() => f.context.close());
    const { orderId } = seedSyntheticOrder(owned.psql, f.tenant);
    const [orderNumber, invoiceNumber] = owned.psql(`SELECT o.order_number||'|'||coalesce(o.gst_invoice_number,'')
        FROM orders o WHERE o.id='${orderId}' AND o.store_id='${f.tenant.siteId}';`).split('|');
    assert.match(orderNumber, /^ORD-[0-9]{8}-[0-9]+$/);
    assert.equal(invoiceNumber, owned.psql(`SELECT invoice_number FROM gst_invoices
        WHERE site_id='${f.tenant.siteId}' AND order_id='${orderId}';`));
    assert.ok(invoiceNumber, 'the registered canonical order issued a GST invoice');
    await signIn(f.page, f.email);
    const detailUrl = `${merchantOrigin}/${f.tenant.subdomain}/orders/${orderId}`;
    await f.page.goto(detailUrl);
    await expect(f.page.getByRole('heading', { name: `Order #${orderNumber}`, exact: true })).toBeVisible();
    await expect(f.page.getByText(invoiceNumber, { exact: true })).toBeVisible();

    await f.page.goto(`${merchantOrigin}/${f.tenant.subdomain}/settings/business`);
    await f.page.getByLabel('Invoice number prefix', { exact: true }).fill('NEW');
    const [save] = await Promise.all([
        f.page.waitForResponse(item => new URL(item.url()).pathname === `/api/stores/${f.tenant.subdomain}/settings`
            && item.request().method() === 'PATCH'),
        f.page.getByRole('button', { name: 'Save', exact: true }).first().click(),
    ]);
    assert.equal(save.status(), 200);
    assert.equal(owned.psql(`SELECT invoice_number FROM gst_invoices WHERE site_id='${f.tenant.siteId}'
        AND order_id='${orderId}';`), invoiceNumber, 'editing the current prefix cannot rewrite a historical invoice');
    await f.page.goto(detailUrl);
    await expect(f.page.getByRole('heading', { name: `Order #${orderNumber}`, exact: true })).toBeVisible();
    await expect(f.page.getByText(invoiceNumber, { exact: true })).toBeVisible();
});

test('Merchant Business ignores legacy nested legal and GST copies after canonical fields are cleared', { timeout: 180_000 }, async t => {
    const f = await fixture('business-clear'); t.after(() => f.context.close());
    owned.psql(`UPDATE sites SET legal_name=NULL, gstin=NULL, gst_state_code=NULL,
        business_profile='{"legal_name":"Stale legal copy","gstin":"27ABCDE1234F1Z5","gst_state_code":"27","trade_name":"Existing trade"}'::jsonb
        WHERE id='${f.tenant.siteId}';`);
    await signIn(f.page, f.email);
    await f.page.goto(`${merchantOrigin}/${f.tenant.subdomain}/settings/business`);
    await expect(f.page.getByLabel('Legal business name', { exact: true })).toHaveValue('');
    await expect(f.page.getByLabel('GSTIN', { exact: true })).toHaveValue('');
    await expect(f.page.getByLabel('GST state', { exact: true })).toHaveValue('');
    await f.page.getByLabel('Trade name', { exact: true }).fill('Updated trade');
    const [response] = await Promise.all([
        f.page.waitForResponse(item => new URL(item.url()).pathname === `/api/stores/${f.tenant.subdomain}/settings`
            && item.request().method() === 'PATCH'),
        f.page.getByRole('button', { name: 'Save', exact: true }).first().click(),
    ]);
    assert.equal(response.status(), 200, 'normal Business save accepts the canonical cleared fields');
    assert.equal(owned.psql(`SELECT coalesce(legal_name,'')||'|'||coalesce(gstin,'')||'|'||coalesce(gst_state_code,'')||'|'
        ||coalesce(business_profile->>'trade_name','')||'|'||coalesce(business_profile->>'legal_name','')||'|'
        ||coalesce(business_profile->>'gstin','')||'|'||coalesce(business_profile->>'gst_state_code','')
        FROM sites WHERE id='${f.tenant.siteId}';`), '|||Updated trade|||');
    await f.page.reload();
    await expect(f.page.getByLabel('Legal business name', { exact: true })).toHaveValue('');
    await expect(f.page.getByLabel('GSTIN', { exact: true })).toHaveValue('');
    await expect(f.page.getByLabel('GST state', { exact: true })).toHaveValue('');
});

test('mobile-width dark Merchant Business shows private KYC scan rejection and resubmission', { timeout: 180_000 }, async t => {
    const f = await fixture('business-mobile'); t.after(() => f.context.close());
    await f.page.setViewportSize({ width: 390, height: 844 });
    await f.page.emulateMedia({ colorScheme: 'dark' });
    await signIn(f.page, f.email);
    await f.page.evaluate(() => localStorage.setItem('letbuyy-theme', 'dark'));
    await f.page.goto(`${merchantOrigin}/${f.tenant.subdomain}/settings/business`);
    assert.equal(await f.page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches), true);
    await expect.poll(() => f.page.locator('html').getAttribute('data-theme')).toBe('dark');
    await expect(f.page.getByLabel('Legal business name', { exact: true })).toBeVisible();
    const nextInvoiceExample = owned.psql(`SELECT coalesce(invoice_prefix,'LBY')||'-'||lpad(invoice_number_next::text,6,'0')
        FROM sites WHERE id='${f.tenant.siteId}';`);
    await expect(f.page.getByText(`Current next format: ${nextInvoiceExample}`, { exact: false })).toBeVisible();
    const pan = f.page.locator('.settings-business-kyc-item').filter({ hasText: 'Business PAN' }).first();
    await expect(pan).toBeVisible();
    await pan.getByLabel('Last 4 of PAN', { exact: true }).fill('1234');
    await f.page.keyboard.press('Tab');
    await expect(pan.getByLabel('Upload Business PAN')).toBeFocused();
    await pan.getByLabel('Upload Business PAN').setInputFiles({ name: 'synthetic-pan.pdf', mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.7\nsynthetic private KYC proof') });
    const [response] = await Promise.all([
        f.page.waitForResponse(item => new URL(item.url()).pathname === `/api/stores/${f.tenant.subdomain}/kyc/upload`
            && item.request().method() === 'POST'),
        pan.getByRole('button', { name: 'Upload document' }).click(),
    ]);
    assert.equal(response.status(), 201, 'normal mobile-width Merchant upload reaches private Gateway evidence route');
    await expect(pan.getByText('No scan result yet')).toBeVisible();
    const key = owned.psql(`SELECT metadata->>'private_object_key' FROM merchant_kyc_documents
        WHERE site_id='${f.tenant.siteId}' AND document_type='business_pan';`);
    assert.ok(key.startsWith(`kyc/${f.tenant.siteId}/`) && privateKycObjects.has(key));
    assert.equal(owned.psql(`SELECT status||'|'||provider_mode FROM merchant_kyc_documents
        WHERE site_id='${f.tenant.siteId}' AND document_type='business_pan';`), 'submitted|sandbox');
    assert.doesNotMatch(await f.page.locator('body').innerText(), /private_object_key|kyc\/.*business_pan/);

    // A synthetic trusted scanner verdict exercises the merchant recovery UI;
    // this fixture does not represent a production malware scan.
    owned.psql(`UPDATE merchant_kyc_documents SET metadata=jsonb_set(metadata,'{malware_scan_status}','"rejected"'::jsonb)
        WHERE site_id='${f.tenant.siteId}' AND document_type='business_pan';`);
    await f.page.reload();
    await expect(pan.getByRole('status')).toHaveText(/Security scan failed/);
    await expect(f.page.getByText('A document failed its security scan. Replace that file to continue verification.')).toBeVisible();
    await pan.getByLabel('Last 4 of PAN', { exact: true }).fill('1234');
    await pan.getByLabel('Upload Business PAN').setInputFiles({ name: 'replacement-pan.pdf', mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.7\nsynthetic replacement proof') });
    const [replacement] = await Promise.all([
        f.page.waitForResponse(item => new URL(item.url()).pathname === `/api/stores/${f.tenant.subdomain}/kyc/upload`
            && item.request().method() === 'POST'),
        pan.getByRole('button', { name: 'Resubmit document' }).click(),
    ]);
    assert.equal(replacement.status(), 201);
    await expect(pan.getByRole('status')).toHaveText(/No scan result yet/);
    const newKey = owned.psql(`SELECT metadata->>'private_object_key' FROM merchant_kyc_documents
        WHERE site_id='${f.tenant.siteId}' AND document_type='business_pan';`);
    assert.notEqual(newKey, key);
    assert.equal(privateKycObjects.has(key), false, 'replaced evidence is removed from the private fixture');
    assert.equal(privateKycObjects.has(newKey), true);

    // A historical reference-only row cannot be presented as provider review.
    privateKycObjects.delete(newKey);
    owned.psql(`UPDATE merchant_kyc_documents SET metadata=metadata-'private_object_key'
        WHERE site_id='${f.tenant.siteId}' AND document_type='business_pan';`);
    await f.page.reload();
    await expect(pan.getByText('Upload required')).toBeVisible();
    await expect(f.page.getByText('Upload the remaining required documents privately.', { exact: false })).toBeVisible();

    // The production KYC provider is not connected. This projection checks only
    // that a merchant can start replacing bank proof after a provider approval.
    await f.page.route(`**/api/stores/${f.tenant.subdomain}/kyc`, async route => {
        const upstream = await route.fetch();
        const payload = await upstream.json() as { data: { provider_mode: string; documents: Array<Record<string, unknown>> } };
        payload.data.provider_mode = 'live';
        payload.data.documents.push({ id: crypto.randomUUID(), document_type: 'bank_proof', status: 'verified',
            document_number_last4: '4321', has_private_upload: true, evidence_scan_status: 'clean',
            rejection_reason: null, submitted_at: new Date().toISOString(), verified_at: new Date().toISOString(), updated_at: new Date().toISOString() });
        await route.fulfill({ response: upstream, json: payload });
    });
    await f.page.reload();
    const bank = f.page.locator('.settings-business-kyc-item').filter({ hasText: 'Settlement bank account' }).first();
    await expect(bank.getByRole('button', { name: 'Replace verified document' })).toBeVisible();
    await expect(bank.getByText('bank changes must also be approved by your payment provider.', { exact: false })).toBeVisible();
});

for (const operation of ['save', 'publish'] as const) {
    test(`an A editor cannot ${operation} after normal account switch to independently authorized content staff B`, { timeout: 240_000 }, async t => {
        const f = await fixture('actor-' + operation);
        const trace = traceActorConsumer(f);
        t.after(async () => { try { await trace.finish(operation); } finally { await f.context.close(); } });
        // Compile the normal logout route while this fresh context has no session or editor document.
        // No reload is blocked; the original same-document guard and effect baseline remain strict.
        const warmLogout = await f.context.request.post(merchantOrigin + '/api/auth/logout'); assert.equal(warmLogout.status(), 200);
        // Complete normal staff dashboard setup before capturing the original A
        // document; no navigation is blocked or ignored after that baseline.
        const warmStaff = await f.context.newPage();
        await signIn(warmStaff, f.staffEmail);
        const endWarmup = await f.context.request.post(merchantOrigin + '/api/auth/logout'); assert.equal(endWarmup.status(), 200);
        await warmStaff.close();
        await signIn(f.page, f.email); await openEditor(f);
        const originalDocumentTimeOrigin = await f.page.evaluate(() => performance.timeOrigin);
        trace.phase('loaded-A-before-logout');
        const before = f.effects();
        trace.phase('normal-logout-start');
        const logout = await f.context.request.post(merchantOrigin + '/api/auth/logout'); assert.equal(logout.status(), 200);
        trace.phase('after-normal-logout');
        const switcher = await f.context.newPage(); trace.phase('normal-B-signin-in-progress'); await signIn(switcher, f.staffEmail);
        trace.phase('after-normal-B-signin');
        const staffRead = await f.context.request.get(merchantOrigin + f.bff); assert.equal(staffRead.status(), 200, 'B is independently authorized on the same store');
        assert.equal((await staffRead.json()).actorId, f.staff, 'normal session is actually B');
        trace.phase('B-confirmed-before-original-A-action');
        assert.equal(await f.page.evaluate(() => performance.timeOrigin), originalDocumentTimeOrigin,
            'setup requires the original A editor document; a newly navigated B document cannot prove stale-A refusal');
        if (operation === 'save') {
            const marker = 'Synthetic old actor form ' + crypto.randomUUID(); trace.marker(marker); trace.phase('original-A-save-action');
            const [save] = await Promise.all([f.page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/editor/draft') &&
                r.request().method() === 'POST' && Boolean(r.request().postData()?.includes(marker))),
                (async () => { await editHeading(f.page, marker); await f.page.getByRole('button', { name: 'Save', exact: true }).first().click(); })()]);
            trace.phase('after-matched-original-A-save');
            assert.equal(save.status(), 403, 'old actor save is denied before canonical effects');
        } else {
            trace.phase('original-A-publish-action');
            const [publication] = await Promise.all([f.page.waitForResponse(r => new URL(r.url()).pathname === `/api/themes/${slug}/editor` && r.request().method() === 'PUT'),
                f.page.getByRole('button', { name: 'Publish', exact: true }).click()]);
            trace.phase('after-original-A-publication-response');
            assert.equal(publication.status(), 403, 'old actor publication is denied before canonical effects');
        }
        assert.equal(f.effects(), before);
    });
}

test('normal rollback BFF preserves a newer saved draft and exact retry creates one release and one set of effects', { timeout: 300_000 }, async t => {
    const f = await fixture('rollback-retry'); t.after(() => f.context.close());
    await signIn(f.page, f.email); await openEditor(f); await publish(f.page);
    const target = f.currentRelease();
    await editHeading(f.page, `Synthetic second published release ${crypto.randomUUID()}`);
    await expect(f.page.getByRole('button', { name: 'Save', exact: true }).first()).toBeDisabled();
    await publish(f.page);
    const reviewedCurrent = f.currentRelease(); assert.notEqual(reviewedCurrent, target);
    const newerDraft = `Synthetic unpublished draft retained ${crypto.randomUUID()}`;
    await editHeading(f.page, newerDraft);
    await expect(f.page.getByRole('button', { name: 'Save', exact: true }).first()).toBeDisabled();
    const draft = async () => {
        const read = await f.context.request.get(merchantOrigin + f.bff); assert.equal(read.status(), 200);
        const data = await read.json(); return { version: data.version, config: data.draftConfig };
    };
    const before = await draft(); assert.ok(JSON.stringify(before.config).includes(newerDraft));
    const rollbackUrl = `${merchantOrigin}/api/themes/${slug}/releases/${target}/rollback?store_name=${f.tenant.subdomain}`;
    const actorRead = await f.context.request.get(merchantOrigin + f.bff); assert.equal(actorRead.status(), 200);
    const actorId = (await actorRead.json()).actorId; assert.equal(actorId, f.owner);
    const body = { actorId, store_name: f.tenant.subdomain, expected_current_release_id: reviewedCurrent,
        idempotency_key: crypto.randomUUID(), make_store_live: true, rollback_message: 'Synthetic reviewed prior release' };
    const first = await f.context.request.post(rollbackUrl, { data: body }); assert.equal(first.status(), 200);
    const result = (await first.json()).data;
    assert.equal(result.restored_release.id, target);
    assert.equal(result.rollback.release_id, f.currentRelease());
    assert.notEqual(f.currentRelease(), reviewedCurrent);
    assert.deepEqual(await draft(), before, 'rollback preserves the exact newer saved document and monotonic revision');
    const once = f.effects();
    const retry = await f.context.request.post(rollbackUrl, { data: body }); assert.equal(retry.status(), 200);
    assert.equal((await retry.json()).data.rollback.release_id, result.rollback.release_id, 'same intent recovers the same committed rollback');
    assert.equal(f.effects(), once, 'exact retry creates no duplicate release, receipt, audit or outbox');
    assert.deepEqual(await draft(), before);
    const stale = await f.context.request.post(rollbackUrl, { data: { ...body, idempotency_key: crypto.randomUUID() } });
    assert.equal(stale.status(), 409, 'a fresh intent cannot restore using a stale reviewed current pointer');
    assert.equal(f.effects(), once);
});

// Read-only synthetic-context tracing. No browser/session mutation or responses
// substituted. Every actual draft/publication request is tracked before A login.
function traceActorConsumer(f: Awaited<ReturnType<typeof fixture>>) {
    let phase = 'before-A-signin', sequence = 0, marker = '';
    const exchanges: Array<Record<string, unknown>> = [], snapshots: Array<Record<string, unknown>> = [];
    const requests = new Map<object, Record<string, unknown>>(), reads: Promise<unknown>[] = [];
    const actor = (id: unknown) => id === f.owner ? 'A' : id === f.staff ? 'B' : 'other';
    const snapshot = (label: string) => {
        const store = f.tenant.siteId;
        const data = owned.psql("SELECT jsonb_build_object(" +
            "'pointer',(SELECT current_theme_release_id FROM sites WHERE id='" + store + "')," +
            "'instances',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'revision',draft_revision,'draft',current_draft_id,'row_hash',md5(row_to_json(t)::text)) ORDER BY id) FROM theme_instances t WHERE store_id='" + store + "'),'[]'::jsonb)," +
            "'working',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'version',draft_version,'status',draft_status,'document_hash',md5(working_manifest::text),'row_hash',md5(row_to_json(t)::text)) ORDER BY id) FROM theme_instance_drafts t WHERE store_id='" + store + "'),'[]'::jsonb)," +
            "'legacy',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'version',version,'document_hash',md5(draft_config::text),'row_hash',md5(row_to_json(t)::text)) ORDER BY id) FROM theme_editor_drafts t WHERE store_id='" + store + "'),'[]'::jsonb)," +
            "'patches',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'revision',server_revision,'actor',actor_id,'request',request_id,'row_hash',md5(row_to_json(t)::text)) ORDER BY id) FROM theme_draft_patches t WHERE store_id='" + store + "'),'[]'::jsonb)," +
            "'releases',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'version',release_version,'document_hash',md5(template_snapshot::text),'row_hash',md5(row_to_json(t)::text)) ORDER BY id) FROM theme_releases t WHERE store_id='" + store + "'),'[]'::jsonb)," +
            "'audit',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'action',action,'resource',resource_type,'actor',actor_id,'request',request_id) ORDER BY created_at,id) FROM audit_activity_events WHERE store_id='" + store + "'),'[]'::jsonb)," +
            "'outbox',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'event',event_type,'actor',actor_id,'request',request_id,'key',idempotency_key) ORDER BY created_at,id) FROM outbox_events WHERE store_id='" + store + "'),'[]'::jsonb)," +
            "'receipts',coalesce((SELECT jsonb_agg(jsonb_build_object('key',key,'scope',scope,'request_hash',request_hash,'response_hash',response_hash,'status',status,'code',status_code,'resource',resource_type,'resource_id',resource_id,'request',request_id) ORDER BY scope,key) FROM idempotency_keys WHERE site_id='" + store + "'),'[]'::jsonb));");
        snapshots.push({ sequence: ++sequence, phase, label, counters: f.effects(), state: JSON.parse(data) });
    };
    const page = (request: { frame(): { page(): Page } }) => {
        try { return request.frame().page() === f.page ? 'original-A-document' : 'other-normal-tab'; }
        catch { return 'browser-request-without-frame'; }
    };
    // Observe development reload/navigation metadata only; never block a transport or log its payload.
    const observeNavigation = (observedPage: Page) => {
        const label = () => observedPage === f.page ? 'original-A-tab' : 'other-normal-tab';
        observedPage.on('console', message => {
            const text = message.text();
            const signal = text.includes('Fast Refresh had to perform a full reload') ? 'fast-refresh-full-reload'
                : text.startsWith('[Fast Refresh] rebuilding') ? 'fast-refresh-rebuilding'
                    : text.startsWith('[Fast Refresh] done') ? 'fast-refresh-done' : null;
            if (signal) exchanges.push({ sequence: ++sequence, phase, page: label(), developmentConsoleSignal: signal });
        });
        observedPage.on('websocket', socket => {
            if (new URL(socket.url()).pathname !== '/_next/webpack-hmr') return;
            socket.on('framereceived', frame => {
                try {
                    const payload = JSON.parse(frame.payload.toString()) as { action?: unknown; type?: unknown };
                    const action = typeof payload.action === 'string' ? payload.action : payload.type;
                    if (typeof action === 'string' && ['reloadPage', 'serverComponentChanges', 'building', 'built', 'sync', 'serverError', 'addedPage', 'removedPage'].includes(action)) {
                        exchanges.push({ sequence: ++sequence, phase, page: label(), developmentSocketSignal: action });
                    }
                } catch { /* unknown frames have no authority and are not retained */ }
            });
        });
        observedPage.on('framenavigated', frame => {
            if (frame.parentFrame()) return;
            const path = new URL(frame.url()).pathname;
            reads.push(frame.evaluate(() => {
                const timeline = performance as typeof performance & { getEntriesByType?: (type: string) => { type?: string }[] };
                const navigation = timeline.getEntriesByType?.('navigation')?.[0];
                return { timeOrigin: performance.timeOrigin, navigationType: navigation?.type || 'unknown' };
            }).then(value => exchanges.push({ sequence: ++sequence, phase, page: label(), documentNavigation: { path, ...value } }))
                .catch(() => exchanges.push({ sequence: ++sequence, phase, page: label(), documentMetadataUnavailable: path })));
        });
    };
    observeNavigation(f.page); f.context.on('page', observeNavigation);
    f.context.on('request', request => {
        const path = new URL(request.url()).pathname;
        if (request.isNavigationRequest() && !request.frame().parentFrame()) {
            exchanges.push({ sequence: ++sequence, phase, page: page(request), mainDocumentNavigation: true, path });
        }
        if (!(path.endsWith('/editor/draft') && request.method() === 'POST') &&
            !(path.endsWith('/preview-session') && request.method() === 'POST') &&
            !(path.endsWith('/editor') && request.method() === 'PUT')) return;
        const body = request.postDataJSON() as Record<string, unknown>;
        const entry: Record<string, unknown> = { sequence: ++sequence, phase, page: page(request), path,
            method: request.method(), actor: actor(body.actorId), canonicalStore: body.storeId === f.tenant.siteId,
            key: body.idempotencyKey, baseVersion: body.baseVersion, template: body.templateKey,
            document_sha256: body.draftConfig ? createHash('sha256').update(JSON.stringify(body.draftConfig)).digest('hex') : null,
            hasExplicitMarker: Boolean(marker && request.postData()?.includes(marker)) };
        exchanges.push(entry); requests.set(request, entry);
    });
    f.context.on('response', response => {
        const request = response.request(), entry = requests.get(request), path = new URL(response.url()).pathname;
        if (entry) {
            entry.responseSequence = ++sequence; entry.responsePhase = phase; entry.status = response.status();
            reads.push(response.json().then(payload => {
                entry.result = { version: payload.version, currentVersion: payload.currentVersion, replayed: payload.replayed,
                    releaseId: payload.release?.release_id, previewSessionId: payload.data?.preview_session_id, previewDraftVersion: payload.data?.draft_version, errorCode: payload.error?.code };
                snapshot('after mutation response ' + entry.sequence);
            }).catch(() => { entry.bodyUnreadable = true; }));
        } else if (path.endsWith('/editor') && request.method() === 'GET') {
            reads.push(response.json().then(payload => exchanges.push({ sequence: ++sequence, phase, page: page(request),
                method: 'GET', status: response.status(), loadedActor: actor(payload.actorId), loadedVersion: payload.version }))
                .catch(() => undefined));
        }
    });
    f.context.on('requestfailed', request => {
        const entry = requests.get(request);
        if (entry) { entry.failureSequence = ++sequence; entry.failurePhase = phase; entry.networkFailed = true; }
    });
    return {
        phase(label: string) { phase = label; snapshot(label); },
        marker(value: string) { marker = value; },
        async finish(operation: string) {
            await Promise.allSettled(reads); snapshot('final');
            console.info('N4_ACTOR_ALL_INTENTS_AND_EFFECTS', JSON.stringify({ operation, exchanges, snapshots }));
        },
    };
}
