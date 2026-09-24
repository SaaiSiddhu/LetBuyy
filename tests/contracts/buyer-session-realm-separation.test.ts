// BUYER-4 (D-8) — the marketplace buyer session's realm separation, as a source contract.
//
// These are the properties that are cheap to break by accident, invisible in a single diff, and
// expensive once shipped. They are asserted against source rather than behaviour because the failure
// mode is a future edit, not a runtime bug: nothing would throw if a buyer cookie gained a parent
// domain, and nothing would fail a build if buyer login started reporting "no such account".

import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

/// Strip comments before asserting a token is ABSENT. Matching raw source cannot tell a use from a
/// mention, so a comment explaining why something is forbidden trips the very rule it documents —
/// which is exactly what happened when these tests were first written, and what the HS256 guard in
/// identity-issuer-d3.test.ts was fixed for earlier the same day. Use `read` for presence
/// assertions; use this for absence.
const code = (source: string) => source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const authCore = read('packages/auth-core/src/index.ts');
const buyerSession = read('apps/platform/identity/src/lib/auth/buyer-session.ts');
const buyerLogin = read('apps/platform/identity/src/app/api/buyer/login/route.ts');
const buyerRegister = read('apps/platform/identity/src/app/api/buyer/register/route.ts');
const rateLimit = read('apps/platform/identity/src/lib/rate-limit.ts');

test('the buyer session has its OWN cookie name, distinct from merchant and customer', () => {
    // Reusing either name would put one realm's credential exactly where another's is expected.
    assert.match(authCore, /LETBUYY_BUYER_SESSION_COOKIE = 'lb_buyer_session'/);
    assert.match(authCore, /LETBUYY_MERCHANT_SESSION_COOKIE = 'lb_session'/);
    assert.match(authCore, /LETBUYY_CUSTOMER_SESSION_COOKIE = 'lb_customer_session'/);

    const names = ['lb_buyer_session', 'lb_session', 'lb_customer_session'];
    assert.equal(new Set(names).size, 3, 'the three realms must not share a cookie name');
});

test('the buyer cookie is HOST-ONLY — it must never carry a domain attribute', () => {
    // cookies.ts sets COOKIE_DOMAIN so the platform apps share one login. That same attribute here
    // would transmit a shopper's credential to admin, apps, themes, developer and console.
    assert.ok(
        !/\bdomain\s*:/.test(code(buyerSession)),
        'buyer-session.ts must not set a cookie domain — a parent-domain buyer cookie reaches every platform app',
    );
    assert.ok(
        !code(buyerSession).includes('COOKIE_DOMAIN'),
        'buyer-session.ts must not reference COOKIE_DOMAIN at all',
    );
});

test('the buyer routes do not import the platform cookie helpers', () => {
    // The realistic accident: importing setSessionCookie from cookies.ts, which applies the parent
    // domain. Nothing would fail — the buyer would simply get a platform-realm cookie.
    for (const [name, source] of [['login', buyerLogin], ['register', buyerRegister]] as const) {
        assert.ok(
            !/from '@\/lib\/auth\/cookies'/.test(code(source)),
            `buyer ${name} must not use the platform cookie helpers`,
        );
        assert.match(source, /from '@\/lib\/auth\/buyer-session'/, `buyer ${name} must use the buyer cookie helper`);
    }
});

test('buyer login reports ONE generic failure — no enumeration', () => {
    // BUYER-3 makes the gateway answer identically for a missing account, a password-less account
    // and a wrong password. This route must not undo that by reporting them differently.
    assert.match(buyerLogin, /Invalid email or password\./);
    for (const leak of ['No account', 'no such', 'not found', 'NO_SUCH', 'disabled']) {
        assert.ok(
            !new RegExp(`return NextResponse\\.json\\(\\{\\s*error: '[^']*${leak}`, 'i').test(buyerLogin),
            `buyer login must not distinguish "${leak}" — that is an email-enumeration oracle`,
        );
    }
});

test('both buyer routes are rate limited, CSRF validated and Turnstile gated', () => {
    for (const [name, source] of [['login', buyerLogin], ['register', buyerRegister]] as const) {
        assert.match(source, /checkRateLimit\('buyer-(login|register)'/, `buyer ${name} must be rate limited`);
        assert.match(source, /validateCsrf\(request\)/, `buyer ${name} must validate CSRF`);
        assert.match(source, /verifyTurnstileToken\(/, `buyer ${name} must gate on Turnstile`);
    }
});

test('buyer rate limits are their OWN buckets, not the merchant ones', () => {
    // A shared bucket would let a burst of marketplace registrations exhaust a merchant's allowance
    // and lock them out of their own dashboard.
    assert.match(rateLimit, /'buyer-register': \{[^}]*prefix: 'rl:buyer-register'/);
    assert.match(rateLimit, /'buyer-login': \{[^}]*prefix: 'rl:buyer-login'/);
    assert.ok(!buyerLogin.includes("checkRateLimit('login'"), 'buyer login must not share the merchant login bucket');
    assert.ok(!buyerRegister.includes("checkRateLimit('signup'"), 'buyer register must not share the merchant signup bucket');
});

test('neither buyer route sends a store_id to the gateway', () => {
    // A buyer spans sellers. site_id is the tenant boundary and a buyer is not a tenant.
    for (const [name, source] of [['login', buyerLogin], ['register', buyerRegister]] as const) {
        assert.ok(!/store_id/.test(code(source)), `buyer ${name} must not carry a store_id`);
        assert.ok(!/site_id/.test(code(source)), `buyer ${name} must not carry a site_id`);
    }
});

test('the buyer token is minted by identity-platform, never by the gateway', () => {
    // ART-05: identity-platform is the sole issuer. The gateway module that owns buyer rows must not
    // sign anything.
    const gatewayBuyerRoutes = read('services/api-gateway/src/routes/storefront/buyer-account-routes.ts');
    for (const signing of ['SignJWT', 'createIdentityIssuedBuyerSessionToken', 'sign(']) {
        assert.ok(
            !code(gatewayBuyerRoutes).includes(signing),
            `the gateway's buyer routes must not issue tokens (found ${signing})`,
        );
    }
    assert.match(buyerLogin, /createIdentityIssuedBuyerSessionToken/);
    assert.match(buyerRegister, /createIdentityIssuedBuyerSessionToken/);
});

// ---------------------------------------------------------------------------------------------------
// APPID-P4a — every buyer route, not only the first two
// ---------------------------------------------------------------------------------------------------

/// Every route.ts under identity-platform's buyer API, found on disk so a route added later is covered
/// without anyone remembering to list it here.
function buyerRoutes(): [string, string][] {
    const dir = join(root, 'apps/platform/identity/src/app/api/buyer');
    const walk = (at: string): string[] => readdirSync(at).flatMap((name) => {
        const path = join(at, name);
        if (statSync(path).isDirectory()) return walk(path);
        return name === 'route.ts' ? [path] : [];
    });
    return walk(dir).map((path) => [relative(dir, path), readFileSync(path, 'utf8')]);
}

// APPID-P4b: the token exchange is the one buyer route that is called server to server. It reads and
// writes no cookie, so it has nothing for CSRF to protect; and it is the one route that names a site,
// because the session it mints is bound to the store that redeemed the code.
const TOKEN_ROUTE = 'oauth/token/route.ts';

test('every buyer route validates CSRF, stays off the platform cookie helpers and carries no store', () => {
    const routes = buyerRoutes();
    assert.ok(routes.length >= 10, `found ${routes.length} buyer routes`);
    assert.ok(routes.some(([name]) => name === TOKEN_ROUTE), 'the token route exists');
    for (const [name, source] of routes) {
        assert.ok(!/from '@\/lib\/auth\/cookies'/.test(code(source)), `${name} must not use the platform cookie helpers`);
        if (name === TOKEN_ROUTE) continue;
        assert.match(source, /validateCsrf\(request\)/, `${name} must validate CSRF`);
        assert.ok(!/store_id|site_id/.test(code(source)), `${name} must not carry a store — a buyer is not a tenant`);
    }
});

test('the token exchange touches no cookie, and takes its site only from the redeemed code', () => {
    const source = code(new Map(buyerRoutes()).get(TOKEN_ROUTE) ?? '');
    assert.ok(source, 'the token route exists');
    for (const cookieUse of ['cookies(', 'request.cookies', 'BuyerSessionCookie', 'set-cookie', 'Set-Cookie']) {
        assert.ok(!source.includes(cookieUse), `the token route must not touch cookies (found ${cookieUse})`);
    }
    // APPID-P4d: the redemption decides everything the token carries, through grantForRedemption,
    // which also decides WHICH token by the client the database recorded for the code.
    assert.match(source, /const grant = redeemed\.ok \? grantForRedemption\(payload\?\.data\) : null/, 'the site, client and epoch come from the gateway redemption');
    assert.ok(!/params\.(site_id|store_id)|params\[['"](site_id|store_id)/.test(source), 'never from the request');
    assert.match(source, /createIdentityIssuedStorefrontSessionToken\(\{\s*buyerAccountId: grant\.buyerAccountId,\s*siteId: grant\.siteId,\s*sessionEpoch: grant\.sessionEpoch,\s*\}\)/,
        'the storefront session is minted with the redeemed buyer, site and epoch');
    assert.match(source, /if \(grant\.kind === 'app'\) \{\s*const accessToken = await createIdentityIssuedBuyerSessionToken\(\{ buyerAccountId: grant\.buyerAccountId, sessionEpoch: grant\.sessionEpoch \}\)/,
        'only an app code gets a platform buyer session, with the redeemed buyer and epoch');
});

test('every buyer route that mints a token puts the account session epoch in it', () => {
    // Without the epoch the gateway counts a token as epoch 1, so after the account's first reset a
    // fresh sign-in would be refused at once. Worse, a helper that minted a CONSTANT epoch would keep
    // working until then and look correct in every test that never resets.
    const minting = buyerRoutes().filter(([, source]) => code(source).includes('createIdentityIssuedBuyerSessionToken('));
    assert.ok(minting.length >= 3, `expected login, register and recover/confirm to mint, found ${minting.map(([n]) => n).join(', ')}`);
    for (const [name, source] of minting) {
        // The token exchange mints with the epoch of the redeemed code, which the database confirmed is
        // current as it redeemed it; grantForRedemption refuses a missing or malformed one.
        const epoch = name === TOKEN_ROUTE ? /sessionEpoch: grant\.sessionEpoch/ : /sessionEpoch: buyerSessionEpoch\(buyer\.session_epoch\)/;
        assert.match(source, epoch, `${name} must mint with the epoch the gateway returned`);
    }
});

test('the code routes have their own rate-limit buckets, and recovery is Turnstile gated', () => {
    const routes = new Map(buyerRoutes());
    for (const [route, bucket] of [
        ['verify-email/send/route.ts', 'buyer-verify-send'],
        ['verify-email/confirm/route.ts', 'buyer-verify-confirm'],
        ['recover/send/route.ts', 'buyer-recover-send'],
        ['recover/confirm/route.ts', 'buyer-recover-confirm'],
    ] as const) {
        const source = routes.get(route);
        assert.ok(source, `${route} exists`);
        assert.ok(source.includes(`checkRateLimit('${bucket}'`), `${route} must use the ${bucket} bucket`);
    }
    assert.match(routes.get('recover/send/route.ts') ?? '', /verifyTurnstileToken\(/, 'the public recovery form must gate on Turnstile');
});

test('recovery answers every address the same way', () => {
    // The only success recover/send may return is the bare one, and no branch may name the account's
    // existence, state or limit.
    const source = code(new Map(buyerRoutes()).get('recover/send/route.ts') ?? '');
    const successes = source.match(/NextResponse\.json\(\{ success: true[^}]*\}/g) ?? [];
    assert.deepEqual(successes, ['NextResponse.json({ success: true }'], 'one success, with nothing in it');
    for (const leak of ['No account', 'no such', 'not found', 'disabled', 'rate_limited', 'already']) {
        assert.ok(!new RegExp(leak, 'i').test(source), `recover/send must not mention "${leak}"`);
    }
});
