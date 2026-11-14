// Normal browser sign-in over real local Next/Gateway/owned PostgreSQL. No
// session injection, API doubles, real merchant records or external messages.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer, type Server } from 'node:http';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { exportJWK } from 'jose';
import { chromium, expect } from '@playwright/test';
import { hashMerchantPassword } from '../../lib/merchant-password';
import {
    Gateway,
    gatewayEnv,
    newIdentityKeys,
    INTERNAL_SECRET,
} from './gateway-harness';
import { withConsoleBrowser } from './console-browser-fixture';
import {
    requireOwnedDatabase,
    startOwnedClientRuntime,
    stopOwnedClientRuntime,
    type OwnedClientProcess,
} from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';
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
    'merchant raises a ticket, real MFA Console replies privately/publicly and resolves; merchant sees only public evidence',
    { timeout: 900000 },
    async () => {
        const site = newSyntheticTenant('support-browser');
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
            await page.goto(`${merchantOrigin}/${site.subdomain}/settings/store-health`);
            await expect(page.getByRole('heading', { name: 'Setup checklist and store health', exact: true })).toBeVisible();
            await expect(page.getByRole('heading', { name: 'Business details · Needs attention', exact: true })).toBeVisible();
            await page.getByRole('link', { name: 'Review and resolve: Business details', exact: true }).click();
            await page.getByLabel('Contact email', { exact: true }).fill('synthetic-business@example.invalid');
            await page.getByLabel('Address line 1', { exact: true }).fill('Synthetic readiness address');
            await page.getByLabel('City', { exact: true }).fill('Bengaluru');
            await page.getByLabel('State', { exact: true }).selectOption('Karnataka');
            await page.getByLabel('PIN code', { exact: true }).fill('560001');
            await page.getByRole('button', { name: 'Save', exact: true }).click();
            await expect(page.getByText('Settings saved', { exact: true })).toBeVisible();
            await page.goto(`${merchantOrigin}/${site.subdomain}/settings/store-health`);
            await expect(page.getByRole('heading', { name: 'Business details · Complete', exact: true })).toBeVisible();
            const readinessArtifacts = process.env.LETBUYY_READINESS_ARTIFACT_DIR;
            if (readinessArtifacts) {
                await mkdir(readinessArtifacts, { recursive: true });
                await page.screenshot({ path: join(readinessArtifacts, 'merchant-readiness-desktop.png'), fullPage: true });
            }
            await page.setViewportSize({ width: 390, height: 844 });
            assert.equal(await page.evaluate('document.documentElement.scrollWidth>innerWidth'), false);
            if (readinessArtifacts) await page.screenshot({ path: join(readinessArtifacts, 'merchant-readiness-390px.png'), fullPage: true });
            await page.setViewportSize({ width: 1280, height: 900 });
            await page.goto(
                `${merchantOrigin}/${site.subdomain}/settings/support`,
            );
            await page
                .getByLabel('Subject', { exact: true })
                .fill('Synthetic browser support');
            await page
                .getByLabel('Message', { exact: true })
                .fill('Synthetic merchant asks for help');
            const [created] = await Promise.all([
                page.waitForResponse(
                    (r) =>
                        r.url().includes('/api/v1/stores/') &&
                        r.url().endsWith('/support/tickets') &&
                        r.request().method() === 'POST',
                ),
                page
                    .getByRole('button', { name: 'Create ticket', exact: true })
                    .click(),
            ]);
            assert.equal(created.status(), 201);
            await expect(
                page.getByRole('heading', {
                    name: 'Synthetic browser support',
                    exact: true,
                }),
            ).toBeVisible();
            const ticket = owned.psql(
                `SELECT id FROM support_tickets WHERE site_id='${site.siteId}';`,
            );
            assert.ok(ticket);
            // A real browser network outage must not become an empty queue.
            await context.setOffline(true);
            await page
                .getByRole('button', { name: 'Refresh tickets', exact: true })
                .click();
            await expect(
                page.getByText(
                    'Ticket data is unavailable. Refresh to try again.',
                    { exact: true },
                ),
            ).toBeVisible();
            await expect(
                page.getByText('No tickets for this store.', { exact: true }),
            ).toHaveCount(0);
            await context.setOffline(false);
            await page
                .getByRole('button', { name: 'Refresh tickets', exact: true })
                .click();
            await expect(
                page.getByRole('heading', {
                    name: 'Synthetic browser support',
                    exact: true,
                }),
            ).toBeVisible();
            await withConsoleBrowser(
                owned,
                async (f) => {
                    const { context: operatorContext, page: desk } =
                        await f.login(f.actors[1]);
                    await desk.goto(`${f.origin}/merchants/${site.siteId}/operations`);
                    await expect(desk.getByRole('heading', { name: 'Setup checklist and store health', exact: true })).toBeVisible();
                    await desk.getByText(/^Completed checks \(/).click();
                    const businessCheck = desk.getByRole('list', { name: 'Completed setup checks' }).getByRole('listitem').filter({ has: desk.getByRole('heading', { name: 'Business details', exact: true }) });
                    await expect(businessCheck.getByText('Complete', { exact: true })).toBeVisible();
                    if (readinessArtifacts) await desk.screenshot({ path: join(readinessArtifacts, 'console-readiness-desktop.png'), fullPage: true });
                    await expect(desk.getByText('synthetic-business@example.invalid', { exact: true })).toHaveCount(0);
                    await desk.goto(
                        f.origin +
                            '/support?site_id=' +
                            site.siteId +
                            '&ticket=' +
                            ticket,
                    );
                    await expect(
                        desk.getByRole('heading', {
                            name: 'Synthetic browser support',
                            exact: true,
                        }),
                    ).toBeVisible();
                    await operatorContext.setOffline(true);
                    await desk
                        .getByRole('button', { name: 'Refresh', exact: true })
                        .click();
                    await expect(
                        desk.getByText(
                            'Ticket data is unavailable. Refresh to try again.',
                            { exact: true },
                        ),
                    ).toBeVisible();
                    await expect(
                        desk.getByText('No matching tickets.', { exact: true }),
                    ).toHaveCount(0);
                    await operatorContext.setOffline(false);
                    await desk
                        .getByRole('button', { name: 'Refresh', exact: true })
                        .click();
                    await expect(
                        desk.getByRole('heading', {
                            name: 'Synthetic browser support',
                            exact: true,
                        }),
                    ).toBeVisible();
                    await desk
                        .getByLabel('Audience', { exact: true })
                        .selectOption('internal');
                    await desk
                        .getByLabel('Internal note', { exact: true })
                        .fill('SYNTHETIC PRIVATE NOTE');
                    await desk
                        .getByLabel('Reason / resolution explanation', {
                            exact: true,
                        })
                        .fill('Synthetic investigation note');
                    await desk
                        .getByRole('button', {
                            name: 'Save internal note',
                            exact: true,
                        })
                        .click();
                    await expect(desk.getByRole('status')).toContainText(
                        'Saved',
                    );
                    await desk
                        .getByLabel('Audience', { exact: true })
                        .selectOption('public');
                    await desk
                        .getByLabel('Public reply', { exact: true })
                        .fill('Synthetic public answer');
                    await desk
                        .getByLabel('Reason / resolution explanation', {
                            exact: true,
                        })
                        .fill('Synthetic public response');
                    await desk
                        .getByRole('button', {
                            name: 'Send public reply',
                            exact: true,
                        })
                        .click();
                    await expect(
                        desk.getByText('Synthetic public answer', {
                            exact: true,
                        }),
                    ).toBeVisible();
                    await page
                        .getByRole('button', {
                            name: 'Refresh tickets',
                            exact: true,
                        })
                        .click();
                    await expect(
                        page.getByText('Synthetic public answer', {
                            exact: true,
                        }),
                    ).toBeVisible();
                    await expect(
                        page.getByText('SYNTHETIC PRIVATE NOTE', {
                            exact: true,
                        }),
                    ).toHaveCount(0);
                    await desk
                        .getByLabel('Reason / resolution explanation', {
                            exact: true,
                        })
                        .fill('Synthetic issue completed');
                    desk.once('dialog', (dialog) => dialog.accept());
                    await desk
                        .getByRole('button', {
                            name: 'Resolve ticket',
                            exact: true,
                        })
                        .click();
                    await expect(
                        desk.getByRole('button', {
                            name: 'Resolve ticket',
                            exact: true,
                        }),
                    ).toHaveCount(0);
                    await page
                        .getByRole('button', {
                            name: 'Refresh tickets',
                            exact: true,
                        })
                        .click();
                    await expect(
                        page.getByText(
                            'This ticket is resolved. Start a new request if you need more help.',
                            { exact: true },
                        ),
                    ).toBeVisible();
                    const artifactDirectory =
                        process.env.LETBUYY_SUPPORT_BROWSER_ARTIFACT_DIR || process.env.LETBUYY_CONSOLE_UI_ARTIFACT_DIR;
                    if (artifactDirectory) {
                        await mkdir(artifactDirectory, { recursive: true });
                        await desk.screenshot({
                            path: join(
                                artifactDirectory,
                                'console-desktop.png',
                            ),
                            fullPage: false,
                        });
                        await page.screenshot({
                            path: join(
                                artifactDirectory,
                                'merchant-desktop.png',
                            ),
                            fullPage: true,
                        });
                    }
                    for (const [name, p] of [
                        ['console', desk],
                        ['merchant', page],
                    ] as const) {
                        await p.setViewportSize({ width: 390, height: 844 });
                        assert.equal(
                            await p.evaluate(
                                'document.documentElement.scrollWidth>window.innerWidth',
                            ),
                            false,
                        );
                        if (artifactDirectory)
                            await p.screenshot({
                                path: join(
                                    artifactDirectory,
                                    name + '-390px.png',
                                ),
                                fullPage: true,
                            });
                    }
                    await operatorContext.close();
                },
                { makerRole: 'super' },
            );
            await context.close();
        } finally {
            await browser?.close();
            await stopOwnedClientRuntime(merchant);
            await stopOwnedClientRuntime(identity);
            if (bridge)
                await new Promise<void>((r) => bridge!.close(() => r()));
        }
    },
);
