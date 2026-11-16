import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// Synthetic local test credentials only: owned disposable accounts, stub provider identifiers,
// and public challenge test fixtures. Never use these values for a real account or live provider.
// Exact value hashes are reviewed in config/governance/secret-scan-exceptions.json.
// Initial consumer reproductions for N4.4. Root must review this literal root
// fixture and its runtime classification before execution. No renderer override,
// fabricated browser session/cart, provider adapter or external transaction.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { before, after, test } from 'node:test';
import { readFileSync, mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { createServer, request as forwardHttpRequest, type Server } from 'node:http';
import { createServer as createHttpsServer, type Server as HttpsServer } from 'node:https';
import { exportJWK } from 'jose';
import { chromium, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { closePooledSqlClients } from '@letbuyy/infrastructure/pooled-sql-adapter';
import { hashMerchantPassword } from '../../services/api-gateway/src/lib/merchant-password';
import { Gateway, gatewayEnv, newIdentityKeys, INTERNAL_SECRET } from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import { requireOwnedDatabase, ownedClientDiagnostic, startOwnedPooledSqlProxy, type OwnedPooledSqlProxy, createOwnedCheckoutTlsCertificate, startOwnedClientRuntime, stopOwnedClientRuntime, type OwnedClientProcess } from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from '../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';

const owned = requireOwnedDatabase();
let proxy:OwnedPooledSqlProxy,gateway:Gateway;
const slug = 'letbuyy-core'; // The actual first-party Core catalog from the complete migration template.
const password = 'Synthetic-published-storefront-pass-42';
let identityOrigin: string, merchantOrigin: string, commerceOrigin: string;
let bridge: Server | undefined, browser: Browser | undefined;
let checkoutTls: HttpsServer | undefined, checkoutTlsPort: number;
const clients: OwnedClientProcess[] = [];
const contexts: BrowserContext[] = [];

// Diagnostic observations only: no HTML, query, token, cookie or raw runtime log retained.
function previewDiagnostic(text: string) {
    const normalized = text.replace(/\\+/g, '');
    const known = ['Portable Liquid', 'Portable section has no section file', 'captured global Liquid section',
        'ZodError', 'StorefrontStoreError', 'Error fetching store through worker', 'Module not found', 'Internal Server Error', 'Invalid preview token'];
    return { errorMessages: [...normalized.matchAll(/(?:Error|error): ([^\n]{1,500})/g)].map(match => match[1].replace(/https?:[^\s]+/g, '[URL]').replace(/[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[TOKEN]')),
        sha256: createHash('sha256').update(text).digest('hex'),
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
        assert.equal(child.exitCode, null, ownedClientDiagnostic(child));
        try { if ((await fetch(url, { signal: AbortSignal.timeout(2000) })).status < 500) return; } catch { /* cold compile */ }
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    throw new Error('owned Next readiness timed out');
}
before(async () => {
    proxy=await startOwnedPooledSqlProxy(owned);

    assert.equal(owned.psql(`SELECT default_template->'liquidBundle'->'package'->>'slug' FROM themes WHERE slug='${slug}';`), 'letbuyy-core-liquid');
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
        if (!/^[a-z0-9-]+\.localhost:\d+$/.test(checkoutHost) || !checkoutHost.endsWith(':'+checkoutTlsPort)) { res.writeHead(421); res.end(); return; }
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
    gateway = new Gateway(gatewayEnv(owned, keys, { ...proxy.env(), ENVIRONMENT: 'local',
        LETBUYY_IDENTITY_ISSUER: identityOrigin, NEXT_PUBLIC_STORE_ROOT_DOMAIN: 'localhost', CHECKOUT_ORIGIN: `https://checkout.localhost:${checkoutTlsPort}`,
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
    clients.push(startOwnedClientRuntime(owned, 'identity-next-production', { port: identityPort, env: { ...common,
        LETBUYY_API_URL: apiOrigin + '/v1', LETBUYY_IDENTITY_ISSUER: identityOrigin,
        LETBUYY_IDENTITY_PRIVATE_JWK: JSON.stringify({ ...await exportJWK(keys.privateKey), alg: 'ES256', kid: keys.kid }),
        ACCOUNTS_COOKIE_SECRET: crypto.randomUUID() + crypto.randomUUID(), COOKIE_DOMAIN: '',
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: '1x00000000000000000000AA', TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
        RESEND_API_KEY: '', LETBUYY_EMAIL_API_KEY: '' } }));
    clients.push(startOwnedClientRuntime(owned, 'merchant-next-production', { port: merchantPort, env: { ...common,
        LETBUYY_API_BASE_URL: apiOrigin + '/v1', NEXT_PUBLIC_STOREFRONT_URL: commerceOrigin } }));
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
    browser = await chromium.launch({ headless: true, args: ['--host-resolver-rules=MAP *.localhost 127.0.0.1',
        `--ignore-certificate-errors-spki-list=${checkoutSpki}`] });
}, { timeout: 400_000 });
after(async () => {
    await Promise.allSettled(contexts.map(context => context.close()));
    await browser?.close();
    await gateway?.settle();await closePooledSqlClients();await proxy?.stop();
    if (checkoutTls?.listening) await new Promise<void>(resolve => {
        checkoutTls!.close(() => resolve()); checkoutTls!.closeAllConnections();
    });
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
async function publish(page: Page, themeSlug=slug) {
    const [response] = await Promise.all([page.waitForResponse(r => new URL(r.url()).pathname === `/api/themes/${themeSlug}/editor` && r.request().method() === 'PUT'),
        page.getByRole('button', { name: 'Publish', exact: true }).click()]);
    assert.equal(response.status(), 200, 'normal mounted editor publication');
    return response.json();
}


test('all ten persisted Core presets apply, save, reload, publish and render on the normal buyer origin',{timeout:600000},async t=>{
 const f=await fixture('core-week1');t.after(()=>f.context.close());await signIn(f.page,f.email);await openEditor(f);
 const expected=['Forge','Sense','Aura','Craft','Refresh','Ride','Dawn','Bloom','Nova','Summit'];
 const captureRoot=mkdtempSync(join(tmpdir(),'letbuyy-core-preset-captures-'));
 const screenshots=pathToFileURL(join(captureRoot,'screenshots')+'/');mkdirSync(screenshots,{recursive:true});
 const buyer=await f.context.newPage();const receipts=[];
 for(const name of expected){
  await f.page.getByRole('button',{name:'Theme styles',exact:true}).click();
  const button=f.page.getByRole('button',{name:'Apply '+name+' style',exact:true});
  if(await button.count()){
   const prior=Number(f.effects().split('|')[0]);const [saved]=await Promise.all([f.page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/editor/draft')&&r.request().method()==='POST',{timeout:30000}),button.click()]);const saveBody=await saved.json();assert.equal(saved.status(),200,JSON.stringify(saveBody.error||saveBody));await expect(f.page.getByRole('button',{name:'Save',exact:true}).first()).toBeDisabled({timeout:30000});
   await expect.poll(()=>Number(f.effects().split('|')[0])).toBeGreaterThan(prior);
  }
  await f.page.reload({waitUntil:'domcontentloaded'});await f.page.getByRole('button',{name:'Theme styles',exact:true}).click();
  await expect(f.page.getByRole('button',{name:'Applied style',exact:true})).toHaveCount(1);
  const published=await publish(f.page);assert.ok(published.release.release_id);
  const stored=JSON.parse(owned.psql(`SELECT template_snapshot->'themeSettings' FROM theme_releases WHERE id='${f.currentRelease()}';`));
  const reference=JSON.parse(owned.psql(`SELECT default_template->'liquidBundle'->'config'->'settings_data'->'presets'->'${name}' FROM themes WHERE slug='${slug}';`));
  for(const [key,value]of Object.entries(reference))assert.deepEqual(stored[key],value,'published preset value '+name+'/'+key);
  for(const width of [1280,360]){
   await buyer.setViewportSize({width,height:900});const response=await buyer.goto(f.publicUrl,{waitUntil:'networkidle'});assert.equal(response?.status(),200);
   assert.match(response!.headers()['cache-control']||'',/no-store/,'mutable storefront HTML must not remain in browser/shared caches');
   console.info('WEEK1_CORE_DOCUMENT_CACHE',JSON.stringify({preset:name,width,cacheControl:response!.headers()['cache-control']}));
   await expect(buyer.locator('[data-theme-renderer="liquid"][data-editor-mode="false"]')).toBeVisible();
   assert.equal(await buyer.locator('[data-theme-renderer="liquid"][data-editor-mode="false"]').evaluate(el=>getComputedStyle(el).getPropertyValue('--primary').trim()),reference.primaryColor,'rendered primary token '+name+'/'+width);
   assert.equal(await buyer.locator('body').evaluate(el=>el.scrollWidth<=window.innerWidth+1),true,'no horizontal overflow '+name+'/'+width);
   await expect(buyer.locator('.lb-featured-products > a')).toHaveText('View collection');
   assert.equal(await buyer.locator('.lb-featured-products > a').evaluate(el=>{const style=getComputedStyle(el);return style.color!==style.backgroundColor;}),true,'collection CTA text is not the same colour as its background '+name+'/'+width);
   await expect(buyer.locator('.lb-featured-products > a')).toHaveAttribute('href',/\/products$/);
   await buyer.screenshot({path:fileURLToPath(new URL(name.toLowerCase()+'-'+width+'.png',screenshots)),fullPage:true});
  }
  receipts.push({preset:name,apply:true,reloaded:true,published:true,exactStoredValues:true,renderedPrimary:true,nonCachedHtml:true,labeledReadableCollectionLink:true,desktop:true,mobile:true});
 }
 // Four viewport sizes in both system schemes, on the changed editor and storefront.
 for(const width of [360,414,768,1280])for(const colorScheme of ['light','dark'] as const){
  await buyer.setViewportSize({width,height:900});await buyer.emulateMedia({colorScheme});await buyer.goto(f.publicUrl,{waitUntil:'networkidle'});await expect(buyer.locator('[data-theme-renderer="liquid"][data-editor-mode="false"]')).toBeVisible();
  await buyer.screenshot({path:fileURLToPath(new URL('viewport-'+width+'-'+colorScheme+'.png',screenshots)),fullPage:true});
  await f.page.setViewportSize({width,height:900});await f.page.emulateMedia({colorScheme});await f.page.screenshot({path:fileURLToPath(new URL('editor-'+width+'-'+colorScheme+'.png',screenshots)),fullPage:true});
 }
 await f.page.setViewportSize({width:1280,height:900});await f.page.goto(`${merchantOrigin}/${f.tenant.subdomain}/online-store/themes`,{waitUntil:'networkidle'});
 owned.psql(`INSERT INTO subscriptions(user_id,store_id,plan,status) VALUES('${f.owner}','${f.tenant.siteId}','enterprise','active');`);
 const sourceBundle=fileURLToPath(new URL('../../database/supabase/seeds/generated/letbuyy-core-liquid-bundle.json',import.meta.url));
 const [imported]=await Promise.all([f.page.waitForResponse(r=>new URL(r.url()).pathname==='/api/themes/install'&&r.request().method()==='POST',{timeout:60000}),f.page.locator('input[type="file"][accept*="json"]').setInputFiles(sourceBundle)]);
 const importBody=await imported.json();assert.equal(imported.status(),200,JSON.stringify(importBody.error||importBody));
 const importedSlug=importBody.uploaded.theme.slug as string;assert.ok(importedSlug.startsWith('private-'+f.tenant.siteId+'-'));
 assert.equal(owned.psql(`SELECT theme_id FROM sites WHERE id='${f.tenant.siteId}';`),slug,'Add keeps the published theme unchanged');
 await f.page.goto(`${merchantOrigin}/${f.tenant.subdomain}/online-store/themes/${importedSlug}/editor`,{waitUntil:'networkidle'});
 await expect(f.page.getByRole('tree',{name:'Theme sections',exact:true})).toBeVisible();
 const [privateDraft]=await Promise.all([f.page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/editor/draft')&&r.request().method()==='POST'),editHeading(f.page,'Synthetic private Core import')]);assert.equal(privateDraft.status(),200);
 await expect(f.page.getByRole('button',{name:'Save',exact:true}).first()).toBeDisabled();
 await publish(f.page,importedSlug);assert.equal(owned.psql(`SELECT theme_id FROM sites WHERE id='${f.tenant.siteId}';`),importedSlug);
 assert.equal(owned.psql(`SELECT is_site_private AND owned_by_site_id='${f.tenant.siteId}' FROM themes WHERE slug='${importedSlug}';`),'t');
 await buyer.goto(f.publicUrl,{waitUntil:'networkidle'});await expect(buyer.locator('[data-theme-renderer="liquid"][data-editor-mode="false"]')).toBeVisible();
 // This synthetic store has no configured navigation menu; use Core's real primary shopping CTA.
 await buyer.locator('.lb-hero-banner a[href$="/products"]').first().click();await buyer.waitForURL(url=>url.pathname==='/products'||url.pathname===`/store/${f.tenant.subdomain}/products`,{waitUntil:'domcontentloaded'});
 await buyer.screenshot({path:fileURLToPath(new URL('catalog-after-import.png',screenshots)),fullPage:true});
 console.log('WEEK1_CORE_CATALOG_DIAGNOSTIC',JSON.stringify(await buyer.evaluate(()=>({path:location.pathname,title:document.title,headings:Array.from(document.querySelectorAll('h1,h2')).map(n=>n.textContent),liquid:Boolean(document.querySelector('[data-theme-renderer="liquid"]')),productText:document.body.textContent?.includes('Synthetic published Liquid product'),anchorPaths:Array.from(document.querySelectorAll('a[href]')).slice(0,30).map(a=>new URL((a as HTMLAnchorElement).href).pathname)}))));
 await buyer.locator('a.lb-product-card__link').filter({hasText:'Synthetic published Liquid product'}).first().click();await buyer.waitForURL(url=>url.pathname===`/product/${f.product}`||url.pathname===`/store/${f.tenant.subdomain}/product/${f.product}`,{waitUntil:'domcontentloaded'});
 await buyer.waitForFunction(()=>Boolean(customElements.get('lb-add-to-cart')));
 const [handoff,checkoutDocument]=await Promise.all([
  buyer.waitForResponse(r=>new URL(r.url()).pathname==='/api/checkout-handoff'&&r.request().method()==='POST'),
  buyer.waitForResponse(r=>{const url=new URL(r.url());return url.protocol==='https:'&&url.hostname==='checkout.localhost'&&url.port===String(checkoutTlsPort)&&url.pathname==='/checkout'&&r.request().isNavigationRequest();},{timeout:90000}),
  buyer.getByRole('button',{name:'Buy now',exact:true}).click()]);
 assert.equal(handoff.status(),200);assert.equal(checkoutDocument.status(),200);
 assert.equal(owned.psql(`SELECT count(*) FROM carts WHERE store_id='${f.tenant.siteId}';`),'1');
 assert.equal(owned.psql(`SELECT count(*) FROM orders WHERE store_id='${f.tenant.siteId}';`),'0','Core smoke stops before payment/order acceptance');
 console.log('WEEK1_CORE_BUYER_HANDOFF_PASS',JSON.stringify({catalog:true,product:true,normalBuyNow:true,canonicalCartCount:1,localHostedCheckout200:true,ordersCreated:0,providerPayment:false}));
 console.log('WEEK1_CORE_IMPORT_BROWSER_PASS',JSON.stringify({normalFileInput:true,scopedPrivateCopy:true,installed:true,buyerRendered:true,firstPartyNotOverwritten:true}));
 writeFileSync(join(captureRoot,'core-preset-browser-results.json'),JSON.stringify({scope:'Production-built local Merchant/Identity/Commerce with owned PostgreSQL and normal password login. No hosted/provider proof.',presets:receipts},null,2)+'\n');
 console.log('WEEK1_CORE_PRESETS_PASS',JSON.stringify(receipts));
 console.log('Owned core preset capture directory:',captureRoot);
});
