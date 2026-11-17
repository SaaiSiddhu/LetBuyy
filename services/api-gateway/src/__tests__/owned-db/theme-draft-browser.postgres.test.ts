// Synthetic local test credentials only: owned disposable accounts, stub provider identifiers,
// and public challenge test fixtures. Never use these values for a real account or live provider.
// Exact value hashes are reviewed in config/governance/secret-scan-exceptions.json.
// Normal password sign-in and mounted Merchant editor against the real Gateway
// and owned Postgres/PostgREST. Reply loss and one invalid request are injected. The iframe
// is blocked in this editor-mutation suite; storefront rendering remains its own gate.
import assert from 'node:assert/strict';
import test from 'node:test';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { createServer, type Server } from 'node:http';
import { exportJWK } from 'jose';
import { chromium, expect, type Page } from '@playwright/test';
import { hashMerchantPassword } from '../../lib/merchant-password';
import { Gateway, gatewayEnv, newIdentityKeys, INTERNAL_SECRET, tapRest } from './gateway-harness';
import { requireOwnedDatabase, startOwnedClientRuntime, stopOwnedClientRuntime, type OwnedClientProcess } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase();
async function freePort() {
    const server = createServer(); await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
    const port = (server.address() as { port: number }).port;
    await new Promise<void>(r => server.close(() => r())); return port;
}
async function ready(url: string, process: OwnedClientProcess) {
    const deadline = Date.now() + 300_000;
    while (Date.now() < deadline) {
        if (process.exitCode !== null || process.signalCode !== null) throw new Error('Owned dev runtime stopped before readiness');
        try { if ((await fetch(url, { signal: AbortSignal.timeout(2000) })).status < 500) return; } catch { /* compile/start */ }
        await new Promise(r => setTimeout(r, 200));
    }
    throw new Error('Owned dev runtime readiness timed out');
}
const savePath = (url: string) => new URL(url).pathname.endsWith('/editor/draft');
async function toggle(page: Page, row = 0) {
    const section = page.getByRole('tree', { name: 'Theme sections', exact: true }).getByRole('group',{name:'Template sections',exact:true}).locator(':scope > [role="treeitem"]').nth(row);
    const hidden = (await section.getAttribute('class') || '').includes('theme-os-tree-section--hidden');
    await section.hover();
    const button = section.getByRole('button', { name: /^Toggle .+ visibility$/ });
    await expect(button).toBeVisible({ timeout: 5000 });
    await button.click({ timeout: 5000 });
    if (hidden) await expect(section).not.toHaveClass(/theme-os-tree-section--hidden/, { timeout: 5000 });
    else await expect(section).toHaveClass(/theme-os-tree-section--hidden/, { timeout: 5000 });
}
async function saved(page: Page) { await expect(page.getByRole('button', { name: 'Save', exact: true }).first()).toBeDisabled(); }

test('normal editor recovers lost replies, serializes saves and reviews exact conflict replacement without losing newer edits',
    { timeout: 780_000 }, async () => {
    const tenant = newSyntheticTenant('theme-browser'); seedSyntheticTenant(owned.psql, tenant);
    const actor = crypto.randomUUID(), email = `syn-theme-browser-${actor}@example.invalid`, password = 'Synthetic-theme-browser-pass-42';
    const hash = await hashMerchantPassword(password);
    owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name,password_hash) VALUES
        ('${actor}','${email}',true,'Synthetic Theme Owner','${hash}');
        UPDATE sites SET custom_user_id='${actor}',theme_id='letbuyy-core' WHERE id='${tenant.siteId}';`);
    const keys = await newIdentityKeys(), identityPort = await freePort(), merchantPort = await freePort();
    const identityOrigin = `http://localhost:${identityPort}`, merchantOrigin = `http://localhost:${merchantPort}`;
    const gateway = new Gateway(gatewayEnv(owned, keys, { ENVIRONMENT: 'local', LETBUYY_IDENTITY_ISSUER: identityOrigin }));
    let bridge: Server | undefined, identity: OwnedClientProcess | undefined, merchant: OwnedClientProcess | undefined;
    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined, page: Page | undefined;
    let loseSave = false, losePublish = false, holdSave = false;
    let previewCreates = 0;
    let releaseHeld: (() => void) | undefined, reachedHeld: (() => void) | undefined;
    let releaseChallengeScript: (() => void) | undefined;
    let challengeDelayTimer: ReturnType<typeof setTimeout> | undefined;
    const challengeScriptDelay = Number(process.env.LETBUYY_EXECUTABLE_TEST_WIDGET_DELAY_MS || '0');
    assert.ok([0, 6500].includes(challengeScriptDelay), 'only the named bounded widget-startup fault is supported');
    const writes: Array<{ operation: string; base: number; key: string }> = [];
    const errors: string[] = [];
    const gatewayFailures: unknown[] = [];
    let firstInvalidDraftArtifact: string | null = null;
    let stage = 'initialization';
    const draftHttp: Array<{ status: number; method: string }> = [];
    const browserFaults: Array<{ kind: string; message: string }> = [];
    const parseFailures: unknown[] = [];
    const diagnosticTasks: Promise<void>[] = [];
    const redact = (value: string) => value.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)?/g, '[redacted-jwt]').replace(/(token|secret|password)=([^&\s]+)/gi, '$1=[redacted]').slice(0, 700);
    const revision = () => Number(owned.psql(`SELECT coalesce(max(draft_revision),0) FROM theme_instances WHERE store_id='${tenant.siteId}';`));
    const tap = tapRest(owned.restUrl, async (call, forward) => {
        if (call.resource === 'theme_preview_sessions' && call.method === 'POST') previewCreates += 1;
        const intent = call.json as Record<string, any>;
        if (call.resource === 'rpc/mutate_owned_theme_draft_v1') {
            writes.push({ operation: intent.p_operation, base: intent.p_base_version, key: intent.p_key });
            if (holdSave && intent.p_operation === 'save') {
                holdSave = false;
                const held = new Promise<void>(r => { releaseHeld = r; }); reachedHeld?.(); await held;
            }
        }
        const response = await forward();
        if (call.resource === 'rpc/mutate_owned_theme_draft_v1' && response.ok &&
            ((loseSave && intent.p_operation === 'save') || (losePublish && intent.p_operation === 'publish'))) {
            if (intent.p_operation === 'save') loseSave = false; else losePublish = false;
            await response.arrayBuffer();
            return new Response(JSON.stringify({ code: 'SYNTHETIC_COMMITTED_REPLY_LOSS', message: 'Synthetic committed reply loss' }),
                { status: 503, headers: { 'content-type': 'application/json' } });
        }
        return response;
    });
    try {
        bridge = createServer(async (req, res) => {
            const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk));
            const body = Buffer.concat(chunks).toString(), headers = new Headers();
            for (const [name, value] of Object.entries(req.headers)) if (typeof value === 'string' &&
                !['host', 'connection', 'content-length', 'transfer-encoding', 'accept-encoding'].includes(name)) headers.set(name, value);
            try {
                const result = await gateway.request(req.url || '/', { method: req.method, headers, ...(body ? { body } : {}) });
                if (result.status >= 400) {
                    gatewayFailures.push({ path: (req.url || '/').split('?')[0], status: result.status, error: result.json?.error });
                    if (!firstInvalidDraftArtifact && (req.url || '').includes('/editor/draft') && req.method === 'PUT') {
                        firstInvalidDraftArtifact = join(tmpdir(), `letbuyy-n4-invalid-theme-${owned.runId}.json`);
                        writeFileSync(firstInvalidDraftArtifact, body, { mode: 0o600 });
                    }
                }
                res.writeHead(result.status, Object.fromEntries(result.headers.entries())); res.end(result.text);
            } catch { res.writeHead(500); res.end('{}'); }
        });
        await new Promise<void>(r => bridge!.listen(0, '127.0.0.1', r));
        const apiOrigin = `http://127.0.0.1:${(bridge.address() as { port: number }).port}`;
        const common = { INTERNAL_API_SECRET: INTERNAL_SECRET, NEXT_PUBLIC_ACCOUNTS_URL: identityOrigin, NEXT_PUBLIC_ADMIN_URL: merchantOrigin,
            LETBUYY_ENABLE_DEV_AUTH_BYPASS: 'false', NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS: 'false' };
        identity = startOwnedClientRuntime(owned, 'identity-next', { port: identityPort, env: { ...common,
            LETBUYY_API_URL: apiOrigin + '/v1', LETBUYY_IDENTITY_ISSUER: identityOrigin,
            LETBUYY_IDENTITY_PRIVATE_JWK: JSON.stringify({ ...await exportJWK(keys.privateKey), alg: 'ES256', kid: keys.kid }),
            ACCOUNTS_COOKIE_SECRET: crypto.randomUUID() + crypto.randomUUID(), COOKIE_DOMAIN: '',
            NEXT_PUBLIC_TURNSTILE_SITE_KEY: '1x00000000000000000000AA', TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
            RESEND_API_KEY: '', LETBUYY_EMAIL_API_KEY: '' } });
        merchant = startOwnedClientRuntime(owned, 'merchant-next', { port: merchantPort, env: { ...common,
            LETBUYY_API_BASE_URL: apiOrigin + '/v1', NEXT_PUBLIC_STOREFRONT_URL: merchantOrigin } });
        for (const child of [identity, merchant]) child.stderr.on('data', d => errors.push(d.toString().slice(0, 500)));
        await Promise.all([ready(identityOrigin + '/login', identity), ready(merchantOrigin, merchant)]);
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
        await context.route(merchantOrigin + '/preview**', route => route.abort());
        let challengeScriptHeld = false;
        if (challengeScriptDelay) {
            const gate = new Promise<void>(resolve => { releaseChallengeScript = resolve; });
            await context.route('https://challenges.cloudflare.com/turnstile/v0/api.js*', async route => {
                challengeScriptHeld = true;
                await gate;
                // Retain the actual provider SDK, widget and Siteverify after the delay.
                await route.continue();
            });
        }
        page = await context.newPage(); page.setDefaultTimeout(30_000); page.setDefaultNavigationTimeout(60_000);
        const cdp = await context.newCDPSession(page);
        await cdp.send('Runtime.enable'); await cdp.send('Debugger.enable');
        cdp.on('Runtime.exceptionThrown', event => {
            const detail = event.exceptionDetails;
            parseFailures.push({ text: detail.text, description: redact(detail.exception?.description || ''),
                url: detail.url ? new URL(detail.url).pathname : null, line: detail.lineNumber, column: detail.columnNumber,
                frames: detail.stackTrace?.callFrames.map(frame => ({ function: frame.functionName,
                    url: frame.url ? frame.url.split('?')[0] : '', line: frame.lineNumber, column: frame.columnNumber })) });
        });
        cdp.on('Debugger.scriptFailedToParse', event => {
            parseFailures.push({ failedScript: event.url ? event.url.split('?')[0] : '', startLine: event.startLine, endLine: event.endLine, hash: event.hash });
            if (event.url.startsWith(merchantOrigin + '/_next/static/')) diagnosticTasks.push((async () => {
                try {
                    const { scriptSource } = await cdp.send('Debugger.getScriptSource', { scriptId: event.scriptId });
                    parseFailures.push({ staticSourceCharacters: scriptSource.length, lines: scriptSource.split('\n').length,
                        sourceSha256: createHash('sha256').update(scriptSource).digest('hex'), tail: scriptSource.slice(-160) });
                } catch { /* protocol target may already have closed */ }
            })());
        });
        page.on('response', response => { if (savePath(response.url())) draftHttp.push({ status: response.status(), method: response.request().method() }); });
        page.on('pageerror', error => browserFaults.push({ kind: 'pageerror', message: redact(error.stack || error.message) }));
        page.on('console', message => { if (message.type() === 'error') browserFaults.push({ kind: 'console', message: redact(message.text()) }); });
        page.on('requestfailed', request => browserFaults.push({ kind: 'requestfailed', message: new URL(request.url()).pathname + ':' + redact(request.failure()?.errorText || 'failed') }));
        await page.goto(identityOrigin + '/login', { waitUntil: 'domcontentloaded' });
        const securityStartedAt = Date.now();
        if (challengeScriptDelay) challengeDelayTimer = setTimeout(() => releaseChallengeScript?.(), challengeScriptDelay);
        // Locator matchers default to5s independently of this page's30s action budget.
        // Readiness must await the real widget; never substitute a token or bypass verification.
        await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/, { timeout: 30_000 });
        if (challengeScriptDelay) {
            assert.ok(challengeScriptHeld, 'the named fault must delay the actual provider SDK request');
            assert.ok(Date.now() - securityStartedAt >= challengeScriptDelay, 'readiness must outlive the controlled startup delay');
        }
        console.info(JSON.stringify({ diagnostic: 'theme_browser_security_ready', elapsedMs: Date.now() - securityStartedAt, controlledScriptDelayMs: challengeScriptDelay }));
        await page.getByLabel('Email', { exact: true }).fill(email);
        await page.getByRole('button', { name: 'Continue with email', exact: true }).click();
        await page.getByLabel('Password', { exact: true }).fill(password);
        const [login] = await Promise.all([page.waitForResponse(r => new URL(r.url()).pathname === '/api/auth/login' && r.request().method() === 'POST'),
            page.getByRole('button', { name: 'Log in', exact: true }).click()]);
        assert.equal(login.status(), 200, 'normal password login precedes editor navigation');
        await page.waitForURL(url => url.origin === merchantOrigin && url.pathname === `/${tenant.subdomain}/dashboard`);
        await expect(page.getByRole('main').getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 60_000 });
        const editor = `${merchantOrigin}/${tenant.subdomain}/online-store/themes/letbuyy-core/editor`;
        await page.waitForLoadState('networkidle');
        // Compile this authenticated dev route before Chromium requests its shared
        // layout chunks. Navigation during a webpack rewrite can serve a partial
        // generated chunk; no application response or browser script is replaced.
        const compiledEditor = await context.request.get(editor);
        assert.equal(compiledEditor.status(), 200, 'normal authenticated editor route compiles before browser navigation');
        const firstDraftResponse = page.waitForResponse(r => savePath(r.url()) && r.request().method() === 'POST', { timeout: 90_000 });
        const initialEditorResponse = page.waitForResponse(r => new URL(r.url()).pathname === '/api/themes/letbuyy-core/editor' && r.request().method() === 'GET', { timeout: 90_000 });
        const editorClientFailure = new Promise<never>((_resolve, reject) => page!.once('pageerror', error => reject(new Error('Editor client failed: ' + redact(error.message)))));
        const [initialEditor, firstDraft] = await Promise.all([Promise.race([initialEditorResponse, editorClientFailure]), firstDraftResponse, page.goto(editor, { waitUntil: 'load' })]);
        assert.equal(initialEditor.status(), 200, await initialEditor.text());
        await expect(page.locator('details[aria-label="Smart defaults"]')).toBeVisible({ timeout: 30_000 });
        assert.equal(firstDraft.status(), 200, await firstDraft.text());
        await page.waitForLoadState('networkidle');
        await expect.poll(revision).toBeGreaterThan(0); await saved(page);
        await expect.poll(() => previewCreates).toBeGreaterThan(0);
        await page.waitForTimeout(1000);
        const idlePreviewCreates = previewCreates;
        await page.waitForTimeout(1000);
        assert.equal(previewCreates, idlePreviewCreates, 'an unchanged draft must not loop through preview creation');

        stage = 'definite-validation-rejection';
        let corruptNextDraft = true;
        await page.route('**/api/themes/letbuyy-core/editor/draft?**', async route => {
            if (!corruptNextDraft || route.request().method() !== 'POST') return route.continue();
            corruptNextDraft = false;
            const body = route.request().postDataJSON();
            const newsletter = body.draftConfig.sections.template.find((section: any) => section.type === 'newsletter');
            newsletter.settings.backgroundColor = 'invalid-color';
            body.draftConfig.templates.index.sections[newsletter.id].settings.backgroundColor = 'invalid-color';
            await route.continue({ postData: JSON.stringify(body) });
        });
        const rejectionStart = revision();
        const [rejected] = await Promise.all([page.waitForResponse(r => savePath(r.url()) && r.request().method() === 'POST' && r.status() === 400), (async () => {
            await toggle(page!);
            await expect(page!.getByRole('button', { name: 'Save', exact: true }).first()).toBeEnabled({ timeout: 5000 });
        })()]);
        assert.equal(revision(), rejectionStart, 'definite validation rejection creates no draft mutation');
        await expect(page.getByRole('button', { name: 'Save', exact: true }).first()).toBeEnabled();
        await toggle(page, 1);
        const [corrected] = await Promise.all([page.waitForResponse(r => savePath(r.url()) && r.request().method() === 'POST' && r.status() === 200),
            page.getByRole('button', { name: 'Save', exact: true }).first().click()]);
        assert.notEqual(corrected.request().postDataJSON().idempotencyKey, rejected.request().postDataJSON().idempotencyKey,
            'a definite400 releases the rejected intent so corrected edits get a fresh key');
        assert.equal(revision(), rejectionStart + 1); await saved(page);

        stage = 'lost-save';
        const lostStart = revision(), lostWrites = writes.length; loseSave = true;
        const [lost] = await Promise.all([page.waitForResponse(r => savePath(r.url()) && r.request().method() === 'POST' && r.status() === 503), toggle(page)]);
        assert.equal(revision(), lostStart + 1, 'draft committed before the synthetic response loss');
        const firstBody = lost.request().postDataJSON();
        const [recovered] = await Promise.all([page.waitForResponse(r => savePath(r.url()) && r.request().method() === 'POST' && r.status() === 200),
            page.getByRole('button', { name: 'Save', exact: true }).first().click()]);
        assert.deepEqual(recovered.request().postDataJSON(), firstBody);
        assert.equal(revision(), lostStart + 1, 'same-key recovery produces no duplicate mutation');
        assert.equal(writes[lostWrites].key, writes[lostWrites + 1].key); await saved(page);

        stage = 'overlap';
        const overlapStart = revision(); holdSave = true;
        const held = new Promise<void>(r => { reachedHeld = r; });
        await toggle(page); await Promise.race([held, new Promise<never>((_resolve, reject) => {
            setTimeout(() => reject(new Error('Edited draft did not reach the held save RPC')), 15_000).unref();
        })]);
        await page.getByRole('button', { name: 'Save', exact: true }).first().click();
        await toggle(page, 1); await page.waitForTimeout(1000); releaseHeld?.();
        await expect.poll(revision).toBe(overlapStart + 2); await saved(page);
        const serial = writes.filter(w => w.operation === 'save' && w.base >= overlapStart);
        assert.deepEqual(serial.map(w => w.base), [overlapStart, overlapStart + 1]);

        stage = 'conflict';
        const other = await context.newPage(); other.setDefaultTimeout(30_000);
        await other.goto(editor); await expect(other.locator('details[aria-label="Smart defaults"]')).toBeVisible(); await saved(other);
        const beforeConflict = revision(); await toggle(page); await expect.poll(revision).toBe(beforeConflict + 1); await saved(page);
        await toggle(other, 1); await expect(other.getByRole('dialog', { name: 'Draft conflict', exact: true })).toBeVisible();
        await other.getByRole('button', { name: 'Keep editing locally', exact: true }).click();
        await expect(other.getByRole('button', { name: 'Save', exact: true }).first()).toBeEnabled();
        await other.getByRole('button', { name: 'Save', exact: true }).first().click();
        await other.getByRole('button', { name: 'Review latest version', exact: true }).click();
        const reviewed = revision(); await expect(other.getByRole('button', { name: `Replace version ${reviewed}`, exact: true })).toBeVisible();
        await toggle(page); await expect.poll(revision).toBe(reviewed + 1); await saved(page);
        await other.getByRole('button', { name: `Replace version ${reviewed}`, exact: true }).click();
        await expect(other.getByRole('button', { name: 'Review latest version', exact: true })).toBeVisible();
        assert.equal(revision(), reviewed + 1, 'changed-again replacement cannot overwrite the intervening save');
        await other.getByRole('button', { name: 'Review latest version', exact: true }).click();
        await other.getByRole('button', { name: `Replace version ${reviewed + 1}`, exact: true }).click();
        await expect(other.getByRole('dialog', { name: 'Draft conflict', exact: true })).toBeHidden();
        await expect.poll(revision).toBe(reviewed + 2); await saved(other);

        stage = 'publication';
        const publicationStart = revision();
        const publishedConfig = owned.psql(`SELECT working_manifest::text FROM theme_instance_drafts WHERE store_id='${tenant.siteId}' AND draft_status='active' AND deleted_at IS NULL;`);
        losePublish = true;
        await other.getByRole('button', { name: 'Publish', exact: true }).click();
        await expect(other.getByRole('button', { name: 'Recover publish', exact: true })).toBeVisible();
        await toggle(other); // newer local edits must survive recovery of the saved release
        await other.getByRole('button', { name: 'Recover publish', exact: true }).click();
        await expect.poll(revision).toBe(publicationStart + 1);
        await expect(other.getByRole('button', { name: 'Save', exact: true }).first()).toBeEnabled();
        await expect.poll(revision).toBe(publicationStart + 2); await saved(other);
        assert.equal(owned.psql(`SELECT count(*) FROM theme_releases WHERE store_id='${tenant.siteId}';`), '1');
        assert.equal(owned.psql(`SELECT release_config::text FROM theme_releases WHERE store_id='${tenant.siteId}';`), publishedConfig);
        assert.notEqual(owned.psql(`SELECT working_manifest::text FROM theme_instance_drafts WHERE store_id='${tenant.siteId}' AND draft_status='active' AND deleted_at IS NULL;`), publishedConfig);
        await other.setViewportSize({ width: 768, height: 1000 });
        await expect(other.getByRole('button', { name: 'Save', exact: true }).first()).toBeVisible();
        await context.close();
    } catch (error) {
        await Promise.allSettled(diagnosticTasks);
        console.info(JSON.stringify({ diagnostic: 'theme_browser_failure', stage, revision: revision(), writes, draftHttp, parseFailures, path: page ? new URL(page.url()).pathname : null,
            visible: await page?.locator('body').innerText().catch(() => ''), gatewayFailures: gatewayFailures.slice(-8), firstInvalidDraftArtifact, browserFaults: browserFaults.slice(-20),
            appErrors: errors.filter(line => !line.includes("isn't a valid image")).slice(-12), imageErrors: errors.filter(line => line.includes("isn't a valid image")).length }));
        throw error;
    } finally {
        if (challengeDelayTimer) clearTimeout(challengeDelayTimer);
        releaseChallengeScript?.();
        releaseHeld?.(); tap.restore(); await browser?.close();
        await stopOwnedClientRuntime(merchant); await stopOwnedClientRuntime(identity); await gateway.settle();
        if (bridge) { bridge.closeAllConnections(); await new Promise<void>(r => bridge!.close(() => r())); }
    }
});
