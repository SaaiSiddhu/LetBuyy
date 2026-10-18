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
import { createServer, type Server } from 'node:http';
import { exportJWK } from 'jose';
import { chromium, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { hashMerchantPassword } from '../../services/api-gateway/src/lib/merchant-password';
import { Gateway, gatewayEnv, newIdentityKeys, INTERNAL_SECRET } from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import { requireOwnedDatabase, startOwnedClientRuntime, stopOwnedClientRuntime, type OwnedClientProcess } from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from '../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';

const owned = requireOwnedDatabase();
const slug = 'urban-kicks'; // Existing ratified Liquid canary; never flip a flag.
const password = 'Synthetic-published-storefront-pass-42';
let identityOrigin: string, merchantOrigin: string, commerceOrigin: string;
let bridge: Server | undefined, browser: Browser | undefined;
const clients: OwnedClientProcess[] = [];
const contexts: BrowserContext[] = [];

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
    owned.script(readFileSync(new URL('../../database/supabase/seeds/urban-kicks-theme.sql', import.meta.url), 'utf8'));
    assert.equal(owned.psql(`SELECT default_template->>'rendererEngine' FROM themes WHERE slug='${slug}';`), 'liquid');
    const keys = await newIdentityKeys();
    const identityPort = await freePort(), merchantPort = await freePort(), commercePort = await freePort();
    identityOrigin = `http://localhost:${identityPort}`;
    merchantOrigin = `http://localhost:${merchantPort}`;
    commerceOrigin = `http://localhost:${commercePort}`;
    const gateway = new Gateway(gatewayEnv(owned, keys, { ENVIRONMENT: 'local',
        LETBUYY_IDENTITY_ISSUER: identityOrigin, NEXT_PUBLIC_STORE_ROOT_DOMAIN: 'localhost', CHECKOUT_ORIGIN: `http://checkout.localhost:${commercePort}`,
        CHECKOUT_SIGNING_SECRET: crypto.randomUUID() + crypto.randomUUID() }));
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
    clients.push(startOwnedClientRuntime(owned, 'identity-next', { port: identityPort, env: { ...common,
        LETBUYY_API_URL: apiOrigin + '/v1', LETBUYY_IDENTITY_ISSUER: identityOrigin,
        LETBUYY_IDENTITY_PRIVATE_JWK: JSON.stringify({ ...await exportJWK(keys.privateKey), alg: 'ES256', kid: keys.kid }),
        ACCOUNTS_COOKIE_SECRET: crypto.randomUUID() + crypto.randomUUID(), COOKIE_DOMAIN: '',
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: '1x00000000000000000000AA', TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
        RESEND_API_KEY: '', LETBUYY_EMAIL_API_KEY: '' } }));
    clients.push(startOwnedClientRuntime(owned, 'merchant-next', { port: merchantPort, env: { ...common,
        LETBUYY_API_BASE_URL: apiOrigin + '/v1', NEXT_PUBLIC_STOREFRONT_URL: commerceOrigin } }));
    clients.push(startOwnedClientRuntime(owned, 'commerce-next', { port: commercePort, env: { ...common,
        LETBUYY_API_BASE_URL: apiOrigin + '/v1', LETBUYY_API_URL: apiOrigin + '/v1',
        NEXT_PUBLIC_API_BASE_URL: apiOrigin + '/v1', NEXT_PUBLIC_API_URL: apiOrigin + '/v1',
        CHECKOUT_ORIGIN: `http://checkout.localhost:${commercePort}`, NEXT_PUBLIC_STORE_ROOT_DOMAIN: 'localhost' } }));
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
    await Promise.all([ready(identityOrigin + '/login', clients[0]), ready(merchantOrigin, clients[1]), ready(commerceOrigin, clients[2])]);
    browser = await chromium.launch({ headless: true, args: ['--host-resolver-rules=MAP *.localhost 127.0.0.1'] });
}, { timeout: 400_000 });
after(async () => {
    await Promise.allSettled(contexts.map(context => context.close()));
    await browser?.close();
    await Promise.allSettled(clients.map(child => stopOwnedClientRuntime(child)));
    if (bridge?.listening) await new Promise<void>(resolve => bridge!.close(() => resolve()));
});

async function fixture(tag: string) {
    const tenant = newSyntheticTenant(tag); seedSyntheticTenant(owned.psql, tenant);
    const owner = crypto.randomUUID(), staff = crypto.randomUUID(), product = crypto.randomUUID();
    const email = `syn-published-owner-${owner}@example.invalid`, staffEmail = `syn-published-staff-${staff}@example.invalid`;
    const hash = await hashMerchantPassword(password);
    owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name,password_hash) VALUES
        ('${owner}','${email}',true,'Synthetic Published Owner','${hash}'),
        ('${staff}','${staffEmail}',true,'Synthetic Published Content Staff','${hash}');
        UPDATE sites SET custom_user_id='${owner}',theme_id='${slug}' WHERE id='${tenant.siteId}';
        INSERT INTO employees(store_id,user_id,email,role,status,is_active,permissions,created_by)
        VALUES('${tenant.siteId}','${staff}','${staffEmail}','editor','active',true,'{"granted":["content:write"]}','${owner}');
        INSERT INTO products(id,store_id,name,price,sku,is_active,created_at,updated_at)
        VALUES('${product}','${tenant.siteId}','Synthetic published Liquid product',199,'SYN-PUBLISHED-${product}',true,now(),now());
        INSERT INTO inventory_levels(id,store_id,product_id,variant_id,location_id,available,reserved,committed_quantity,available_quantity,reserved_quantity,on_hand_quantity,created_at,updated_at)
        VALUES(gen_random_uuid(),'${tenant.siteId}','${product}',NULL,'${tenant.locationId}',25,0,0,25,0,25,now(),now());`);
    const context = await browser!.newContext({ viewport: { width: 1440, height: 1000 } }); contexts.push(context);
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
    const publicUrl = `http://${tenant.subdomain}.localhost:${new URL(commerceOrigin).port}`;
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
    await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/);
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
    await expect(f.page.getByRole('tree', { name: 'Template sections', exact: true })).toBeVisible();
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
    await page.getByRole('tree', { name: 'Template sections', exact: true }).getByRole('treeitem').filter({ hasText: /Hero/ }).first().click();
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
    await signIn(f.page, f.email); await openEditor(f);
    await publish(f.page);
    const firstRelease = f.currentRelease(); assert.ok(firstRelease);
    const buyer = await f.context.newPage();
    const initial = await buyer.goto(f.publicUrl); assert.equal(initial?.status(), 200);
    await expect(buyer.locator('[data-theme-renderer="liquid"][data-editor-mode="false"]')).toBeVisible();
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
    await buyer.waitForURL(url => url.pathname === '/products');
    assert.equal(new URL(buyer.url()).pathname, '/products');
    await expect(buyer.locator('[data-theme-renderer="liquid"][data-editor-mode="false"]')).toBeVisible();
    await buyer.getByRole('link').filter({ hasText: 'Synthetic published Liquid product' }).first().click();
    await buyer.waitForURL(url => url.pathname === `/product/${f.product}`);
    assert.equal(new URL(buyer.url()).pathname, `/product/${f.product}`);
    await expect(buyer.locator('[data-theme-renderer="liquid"][data-editor-mode="false"]')).toBeVisible();
    const [handoff] = await Promise.all([buyer.waitForResponse(r => new URL(r.url()).pathname === '/api/checkout-handoff' && r.request().method() === 'POST'),
        buyer.getByRole('button', { name: 'Buy now', exact: true }).click()]);
    assert.equal(handoff.status(), 200, 'real product action creates a canonical server cart and checkout handoff');
    await buyer.waitForURL(url => url.hostname === 'checkout.localhost' && url.pathname === '/checkout');
    assert.equal(new URL(buyer.url()).port, new URL(commerceOrigin).port);
    assert.equal(owned.psql(`SELECT count(*) FROM carts WHERE store_id='${f.tenant.siteId}';`), '1');
    assert.equal(owned.psql(`SELECT count(*) FROM orders WHERE store_id='${f.tenant.siteId}';`), '0', 'handoff proof stops before any order or payment');
});

for (const operation of ['save', 'publish'] as const) {
    test(`an A editor cannot ${operation} after normal account switch to independently authorized content staff B`, { timeout: 240_000 }, async t => {
        const f = await fixture('actor-' + operation);
        const trace = traceActorConsumer(f);
        t.after(async () => { try { await trace.finish(operation); } finally { await f.context.close(); } });
        // Compile the normal logout route while this fresh context has no session or editor document.
        // No reload is blocked; the original same-document guard and effect baseline remain strict.
        const warmLogout = await f.context.request.post(merchantOrigin + '/api/auth/logout'); assert.equal(warmLogout.status(), 200);
        // Compile the normal staff dashboard before capturing the original A
        // document. Cold Next development compilation can otherwise reload it
        // during B's later sign-in; no navigation is blocked or ignored below.
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
