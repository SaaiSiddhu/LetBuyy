// Normal browser sign-in over real local Next/Gateway/owned PostgreSQL. No
// session injection, API doubles, real merchant records or external messages.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer, type Server } from 'node:http';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { exportJWK } from 'jose';
import { chromium, expect } from '@playwright/test';
import { hashMerchantPassword } from '../../services/api-gateway/src/lib/merchant-password';
import {
    Gateway,
    gatewayEnv,
    newIdentityKeys,
    INTERNAL_SECRET,
} from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import { withConsoleBrowser } from '../../services/api-gateway/src/__tests__/owned-db/console-browser-fixture';
import {
    requireOwnedDatabase,
    startOwnedClientRuntime,
    stopOwnedClientRuntime,
    type OwnedClientProcess,
} from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from '../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';
const owned = requireOwnedDatabase();
async function port() {
    const s = createServer();
    await new Promise<void>((r) => s.listen(0, '127.0.0.1', r));
    const p = (s.address() as { port: number }).port;
    await new Promise<void>((r) => s.close(() => r()));
    return p;
}
async function ready(url: string, app: OwnedClientProcess) {
    const until = Date.now() + 360000;
    while (Date.now() < until) {
        if (app.exitCode !== null || app.signalCode !== null)
            throw new Error('Owned app stopped');
        try {
            if (
                (await fetch(url, { signal: AbortSignal.timeout(2000) }))
                    .status < 500
            )
                return;
        } catch {
            /* bounded startup */
        }
        await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error('Owned app startup timed out');
}

test(
    'Console admin publishes a reviewed account message; merchant web sees the full message and persistent read state',
    { timeout: 900000 },
    async () => {
        const site = newSyntheticTenant('inbox-browser');
        seedSyntheticTenant(owned.psql, site);
        const owner = crypto.randomUUID(),
            email = `syn-support-browser-${owner}@example.invalid`,
            password = 'Synthetic-support-browser-pass-42';
        const hash = await hashMerchantPassword(password);
        owned.psql(
            `INSERT INTO users_custom(id,email,email_verified,password_hash)VALUES('${owner}','${email}',true,'${hash}');UPDATE sites SET custom_user_id='${owner}'WHERE id='${site.siteId}';`,
        );
        const identityPort = await port(),
            merchantPort = await port(),
            identityOrigin = `http://localhost:${identityPort}`,
            merchantOrigin = `http://localhost:${merchantPort}`;
        const keys = await newIdentityKeys(),
            gateway = new Gateway(
                gatewayEnv(owned, keys, {
                    ENVIRONMENT: 'local',
                    LETBUYY_IDENTITY_ISSUER: identityOrigin,
                    NEXT_PUBLIC_ADMIN_URL: merchantOrigin,
                }),
            );
        let bridge: Server | undefined,
            identity: OwnedClientProcess | undefined,
            merchant: OwnedClientProcess | undefined,
            browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
        try {
            bridge = createServer(async (req, res) => {
                const chunks: Buffer[] = [];
                for await (const chunk of req) chunks.push(Buffer.from(chunk));
                const body = Buffer.concat(chunks).toString();
                const headers = new Headers();
                for (const [k, v] of Object.entries(req.headers))
                    if (
                        typeof v === 'string' &&
                        ![
                            'host',
                            'connection',
                            'content-length',
                            'transfer-encoding',
                            'accept-encoding',
                        ].includes(k)
                    )
                        headers.set(k, v);
                try {
                    const r = await gateway.request(req.url || '/', {
                        method: req.method,
                        headers,
                        ...(body ? { body } : {}),
                    });
                    res.writeHead(
                        r.status,
                        Object.fromEntries(r.headers.entries()),
                    );
                    res.end(r.text);
                } catch {
                    res.writeHead(500);
                    res.end('{}');
                }
            });
            await new Promise<void>((r) => bridge!.listen(0, '127.0.0.1', r));
            const apiOrigin = `http://127.0.0.1:${(bridge.address() as { port: number }).port}/v1`;
            const shared = {
                INTERNAL_API_SECRET: INTERNAL_SECRET,
                NEXT_PUBLIC_ACCOUNTS_URL: identityOrigin,
                NEXT_PUBLIC_ADMIN_URL: merchantOrigin,
            };
            identity = startOwnedClientRuntime(
                owned,
                'identity-next-production',
                {
                    port: identityPort,
                    env: {
                        ...shared,
                        LETBUYY_API_URL: apiOrigin,
                        LETBUYY_IDENTITY_ISSUER: identityOrigin,
                        LETBUYY_IDENTITY_PRIVATE_JWK: JSON.stringify({
                            ...(await exportJWK(keys.privateKey)),
                            alg: 'ES256',
                            kid: keys.kid,
                        }),
                        ACCOUNTS_COOKIE_SECRET:
                            crypto.randomUUID() + crypto.randomUUID(),
                        COOKIE_DOMAIN: '',
                        NEXT_PUBLIC_TURNSTILE_SITE_KEY:
                            '1x00000000000000000000AA',
                        TURNSTILE_SECRET_KEY:
                            '1x0000000000000000000000000000000AA',
                        LETBUYY_ENABLE_DEV_AUTH_BYPASS: 'false',
                        NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS: 'false',
                        RESEND_API_KEY: '',
                        LETBUYY_EMAIL_API_KEY: '',
                    },
                },
            );
            merchant = startOwnedClientRuntime(
                owned,
                'merchant-next-production',
                {
                    port: merchantPort,
                    env: { ...shared, LETBUYY_API_BASE_URL: apiOrigin },
                },
            );
            const diagnostics: string[] = [];
            for (const app of [identity, merchant]) {
                app.stderr.on('data', (d) =>
                    diagnostics.push(
                        String(d)
                            .replace(/\?[^\s]+/g, '?redacted')
                            .slice(-1800),
                    ),
                );
                app.stdout.on('data', (d) =>
                    diagnostics.push(
                        String(d)
                            .replace(/\?[^\s]+/g, '?redacted')
                            .slice(-1800),
                    ),
                );
            }
            try {
                await Promise.all([
                    ready(identityOrigin + '/login', identity),
                    ready(merchantOrigin, merchant),
                ]);
            } catch {
                throw new Error(
                    'Owned support browser startup failed: ' +
                        diagnostics.slice(-8).join('\n'),
                );
            }
            browser = await chromium.launch({ headless: true });
            const context = await browser.newContext(),
                page = await context.newPage();
            page.setDefaultTimeout(30000);
            page.setDefaultNavigationTimeout(60000);
            await page.goto(identityOrigin + '/login');
            await expect(
                page.locator('input[name="cf-turnstile-response"]'),
            ).toHaveValue(/.+/, { timeout: 45000 });
            await page.getByLabel('Email', { exact: true }).fill(email);
            await page
                .getByRole('button', {
                    name: 'Continue with email',
                    exact: true,
                })
                .click();
            await page.getByLabel('Password', { exact: true }).fill(password);
            const [login] = await Promise.all([
                page.waitForResponse(
                    (r) =>
                        r.url().endsWith('/api/auth/login') &&
                        r.request().method() === 'POST',
                ),
                page
                    .getByRole('button', { name: 'Log in', exact: true })
                    .click(),
            ]);
            assert.equal(login.status(), 200);
            await page.waitForURL((u) => u.origin === merchantOrigin);
            const artifacts=process.env.LETBUYY_MERCHANT_INBOX_ARTIFACT_DIR;
            if(artifacts)await mkdir(artifacts,{recursive:true});
            const messageBody='A complete synthetic campaign message.\nOffer details remain available after reload. <script>window.syntheticInboxAttack=true</script>';
            await withConsoleBrowser(owned,async f=>{
                const {context:adminContext,page:admin}=await f.login(f.actors[1]);
                await admin.setViewportSize({width:1440,height:1000});
                await admin.goto(f.origin+'/merchant-messages');
                await admin.getByLabel('Message title',{exact:true}).fill('Synthetic account inbox offer');
                await admin.getByLabel('Message body',{exact:true}).fill(messageBody);
                await admin.getByLabel('Message category',{exact:true}).selectOption('offers');
                await admin.getByLabel('Optional HTTPS details link',{exact:true}).fill('https://letbuyy.com/offers');
                await admin.getByLabel('Recipient audience',{exact:true}).selectOption('selected');
                await admin.getByLabel('Find merchant accounts',{exact:true}).fill(email);
                await admin.getByRole('button',{name:'Search accounts',exact:true}).click();
                await expect(admin.getByRole('checkbox')).toHaveCount(1);await admin.getByRole('checkbox').check();
                await admin.getByLabel('Reason for this message',{exact:true}).fill('Notify the selected synthetic merchant about this offer');
                await admin.getByRole('button',{name:'Save draft',exact:true}).click();
                await expect(admin.getByText('Draft saved. Nothing has been published.',{exact:true})).toBeVisible();
                await expect(admin).toHaveURL(/message=[0-9a-f-]{36}/);
                const messageId=new URL(admin.url()).searchParams.get('message');assert.ok(messageId);
                assert.equal(owned.psql(`SELECT count(*) FROM notifications WHERE data->>'merchant_announcement_id'='${messageId}';`),'0');
                await admin.getByRole('button',{name:'Review saved draft and audience',exact:true}).click();
                await expect(admin.getByRole('region',{name:'Publication review'})).toBeVisible();
                await expect(admin.getByText('1 account inboxes · 0 marked read',{exact:true})).toBeVisible();
                if(artifacts)await admin.screenshot({path:join(artifacts,'console-message-review.png'),fullPage:true});
                const hostile=await adminContext.request.post(f.origin+'/api/v1/merchant-messages/commands',{headers:{Origin:'https://hostile.example.invalid'},data:{}});assert.equal(hostile.status(),403);
                await admin.route('**/api/v1/merchant-messages/commands',async route=>{await route.fetch();await route.abort('failed');},{times:1});
                await admin.getByRole('button',{name:'Publish to 1 account inboxes',exact:true}).click();
                await expect(admin.getByText('Outcome unconfirmed. Check the original request before retrying.',{exact:true})).toBeVisible();
                await admin.getByRole('button',{name:'Check original message action',exact:true}).click();
                await expect(admin.getByText('Original action recovered.',{exact:true})).toBeVisible();
                assert.equal(owned.psql(`SELECT count(*)FROM notifications WHERE data->>'merchant_announcement_id'='${messageId}';`),'1');
                await page.setViewportSize({width:1440,height:1000});
                await page.goto(merchantOrigin+'/'+site.subdomain+'/inbox');
                await expect(page.getByRole('heading',{name:'Account inbox',exact:true})).toBeVisible();
                await expect(page.getByText('1 unread · 1 matching messages',{exact:true})).toBeVisible();
                await page.getByRole('button',{name:/Synthetic account inbox offer/}).click();
                await expect(page.getByRole('heading',{name:'Synthetic account inbox offer',exact:true})).toBeVisible();
                await expect(page.getByRole('article',{name:'Account message'}).getByText(messageBody,{exact:true})).toBeVisible();
                assert.equal(await page.evaluate('typeof window.syntheticInboxAttack'),'undefined');
                const hostileRead=await context.request.patch(merchantOrigin+'/api/v1/inbox/'+crypto.randomUUID()+'/read',{headers:{Origin:'https://hostile.example.invalid'},data:{}});assert.equal(hostileRead.status(),403);
                await page.getByRole('button',{name:'Mark as read',exact:true}).click();
                await expect(page.getByText('0 unread · 1 matching messages',{exact:true})).toBeVisible();
                await page.reload();await expect(page.getByRole('button',{name:'Mark as read',exact:true})).toHaveCount(0);
                await expect(page.getByText('0 unread · 1 matching messages',{exact:true})).toBeVisible();
                if(artifacts)await page.screenshot({path:join(artifacts,'merchant-account-inbox.png'),fullPage:true});
                await context.setOffline(true);await page.getByRole('button',{name:'Refresh inbox',exact:true}).click();
                await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByText('No messages match this view.',{exact:true})).toHaveCount(0);
                await context.setOffline(false);await page.getByRole('button',{name:'Refresh inbox',exact:true}).click();
                await expect(page.getByRole('heading',{name:'Synthetic account inbox offer',exact:true})).toBeVisible();
                await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate('document.documentElement.scrollWidth>innerWidth'),false);
                if(artifacts)await page.screenshot({path:join(artifacts,'merchant-account-inbox-390px.png'),fullPage:true});
                await page.goto(merchantOrigin+'/inbox');await expect(page.getByText('0 unread · 1 matching messages',{exact:true})).toBeVisible();
                await page.getByLabel('Category',{exact:true}).selectOption('regulations');await expect(page.getByText('No messages match this view.',{exact:true})).toBeVisible();
                await admin.reload();await admin.getByRole('button',{name:'Inspect publication',exact:true}).click();
                await expect(admin.getByText('1 account inboxes · 1 marked read',{exact:true})).toBeVisible();
                await admin.setViewportSize({width:390,height:844});assert.equal(await admin.evaluate('document.documentElement.scrollWidth>innerWidth'),false);
                if(artifacts)await admin.screenshot({path:join(artifacts,'console-message-publication-390px.png'),fullPage:true});
                await adminContext.close();
            });
            await context.close();
        } finally {
            await browser?.close();
            await stopOwnedClientRuntime(merchant);
            await stopOwnedClientRuntime(identity);
            if (bridge) await new Promise<void>((r) => bridge!.close(() => r()));
        }
    },
);
