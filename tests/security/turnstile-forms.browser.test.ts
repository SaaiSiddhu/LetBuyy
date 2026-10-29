// Owned browser/form acceptance. SDK and HTTP are explicit synthetic fixtures, not provider proof.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
import { resolve } from 'node:path';

test('actual Accounts forms keep fresh single-use tokens and avoid challenges on navigation-only steps', { timeout: 120_000 }, async () => {
    const app = resolve('apps/platform/identity');
    const bundle = await build({
        stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
            import Forgot from './src/app/forgot-password/page'; import Signup from './src/app/signup/page';
            import Lookup from './src/app/lookup/page'; import CheckEmail from './src/app/check-email/page';
            const path=window.location.pathname; const Page=path==='/signup'?Signup:path==='/lookup'?Lookup:path==='/forgot-password'?Forgot:CheckEmail;
            createRoot(document.getElementById('root')).render(<Page/>);`, resolveDir: app, loader: 'tsx' },
        bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', tsconfig: resolve(app, 'tsconfig.json'),
        define: { 'process.env': '{}', 'process.env.NODE_ENV': '"test"', 'process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY': '"owned-widget-fixture"', 'process.env.NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS': '"false"' },
        plugins: [{ name: 'owned-next-routing', setup(builder) {
            builder.onResolve({ filter: /^next\/(navigation|image|link)$/ }, ({ path }) => ({ path, namespace: 'owned-next' }));
            builder.onLoad({ filter: /.*/, namespace: 'owned-next' }, ({ path }) => ({ loader: 'tsx', resolveDir: app, contents: path === 'next/navigation'
                ? `const params=new URLSearchParams(location.search); export const useSearchParams=()=>params; export const useRouter=()=>({refresh(){},push(url){location.href=url},replace(url){location.replace(url)}}); export const usePathname=()=>location.pathname;`
                : `import React from 'react'; export default function Adapter({unoptimized,priority,prefetch,fill,...props}){return React.createElement('${path==='next/image'?'img':'a'}',props)}` }));
        } }],
    });
    const script = bundle.outputFiles[0].text;
    const server = createServer((req, res) => {
        res.setHeader('Content-Type', req.url === '/fixture.js' ? 'application/javascript' : 'text/html');
        res.end(req.url === '/fixture.js' ? script : '<!doctype html><html><body><div id="root"></div><script src="/fixture.js"></script></body></html>');
    });
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    const browser = await chromium.launch({ headless: true });
    try {
        const context = await browser.newContext();
        const page = await context.newPage();
        const errors: string[] = [];
        page.on('pageerror', (error) => { errors.push(error.message); console.info('OWNED_FORM_PAGE_ERROR', error.message); });
        // The fixture SDK calls the same real wrapper/controller callbacks, with distinct tokens.
        await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js*', (route) => route.fulfill({ contentType: 'application/javascript', body: `
            window.__ownedRenders=0; window.turnstile={render(container,options){
                const id='widget-'+(++window.__ownedRenders); const input=document.createElement('input');
                input.type='hidden'; input.name='cf-turnstile-response'; input.value='owned-token-'+window.__ownedRenders;
                container.append(input); queueMicrotask(()=>options.callback(input.value));return id;
            },remove(){}};` }));
        const used = new Set<string>();
        const calls: { path: string; token: string }[] = [];
        let failReset = true; let failSignup = true;
        await page.route(`${origin}/api/**`, async (route) => {
            const path = new URL(route.request().url()).pathname;
            const body = route.request().postDataJSON() || {};
            if (['/api/auth/send-reset', '/api/auth/signup', '/api/auth/login'].includes(path)) {
                const token = body.turnstileToken;
                assert.match(token, /^owned-token-/);
                assert.equal(used.has(`${page.url().split('?')[0]}:${token}`), false, 'a form must not replay a spent token');
                used.add(`${page.url().split('?')[0]}:${token}`);
                calls.push({ path, token });
            }
            let status = 200; let reply: Record<string, unknown> = { success: true };
            if (path === '/api/auth/send-reset' && failReset) { failReset = false; status = 503; reply = { error: 'Synthetic unavailable' }; }
            else if (path === '/api/auth/signup') { status = failSignup ? 503 : 200; failSignup = false; reply = status===200 ? { needsVerification: true } : { error: 'Synthetic delivery unavailable' }; }
            else if (path === '/api/auth/lookup') reply = { exists: true, hasPassword: true, emailVerified: true };
            else if (path === '/api/auth/login') { status = 401; reply = { error: 'Invalid email or password' }; }
            else if (path === '/api/auth/check-session') reply = { authenticated: false };
            await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(reply) });
        });
        await page.goto(`${origin}/forgot-password`);
        await page.getByLabel('Email', { exact: true }).fill('synthetic@example.invalid');
        const send = page.getByRole('button', { name: 'Send reset link', exact: true });
        await send.click();
        await expect(page.getByText('Something went wrong. Please try again.', { exact: true }).first()).toBeVisible();
        assert.equal(new URL(page.url()).pathname, '/forgot-password', '503 must not claim an email was sent');
        await expect(send).toBeEnabled();
        await send.click();
        await page.waitForURL('**/check-email?**');
        assert.equal(calls.filter((c) => c.path === '/api/auth/send-reset').length, 2);
        assert.notEqual(calls[0].token, calls[1].token);

        used.clear();
        await page.clock.install();
        await page.goto(`${origin}/signup`);
        await page.getByLabel('Email', { exact: true }).fill('synthetic@example.invalid');
        await page.getByRole('button', { name: 'Continue', exact: true }).click();
        await expect(page.getByText('Synthetic delivery unavailable')).toBeVisible();
        await page.getByRole('button', { name: 'Continue', exact: true }).click();
        await expect(page.getByLabel('Digit 1 of 6', { exact: true })).toBeVisible();
        await expect(page.locator('[data-lb-security-verification]')).toHaveCount(0);
        await page.clock.runFor(60_100);
        const resend = page.getByRole('button', { name: 'Resend code', exact: true });
        await expect(resend).toBeEnabled();
        await resend.click();
        await expect(page.getByRole('button', { name: /Resend in/ })).toBeDisabled();
        const signupCalls = calls.filter((c) => c.path === '/api/auth/signup');
        assert.equal(signupCalls.length, 3);
        assert.equal(new Set(signupCalls.map((c) => c.token)).size, 3);

        used.clear();
        await page.goto(`${origin}/lookup`);
        await expect(page.getByRole('heading', { name: 'Log in', exact: true })).toBeVisible();
        await expect(page.locator('[data-lb-security-verification]')).toHaveCount(0);
        await page.getByLabel('Email', { exact: true }).fill('synthetic@example.invalid');
        await page.getByRole('button', { name: 'Continue with email', exact: true }).click();
        await page.getByLabel('Password', { exact: true }).fill('Synthetic-Wrong-Password-42!');
        const login = page.getByRole('button', { name: 'Log in', exact: true });
        await login.click();
        await expect(login).toBeEnabled();
        await login.click();
        await expect.poll(() => calls.filter((c) => c.path === '/api/auth/login').length).toBe(2);
        const loginCalls = calls.filter((c) => c.path === '/api/auth/login');
        assert.notEqual(loginCalls[0].token, loginCalls[1].token);
        assert.deepEqual(errors, []);
        console.info('OWNED_TURNSTILE_FORMS: reset-error/retry, signup-error/retry/resend, lookup-placement/login-retry passed; SDK/HTTP fixtures only');
    } finally {
        await browser.close();
        server.closeAllConnections();
        await new Promise<void>((done) => server.close(() => done()));
    }
});
