// APPID-P4c — the storefront's end of buyer sign-in (apps/commerce/web/src/lib/buyer-auth/flow.ts and
// app/api/buyer-auth/*), and its agreement with the other two ends.
//
// Three runtimes each hold part of one contract: commerce/web writes the callback URL and the
// authorize URL, identity-platform parses the request, the gateway accepts or refuses the callback.
// Written separately, they drift; so each rule is checked here against the OTHER end's own parser,
// not against a second copy of it.

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    STOREFRONT_BUYER_FLOW_COOKIE,
    STOREFRONT_BUYER_SESSION_COOKIE,
    authorizeUrl,
    decodeFlow,
    decodeSession,
    encodeFlow,
    encodeSession,
    identityOrigin,
    isSameOriginRequest,
    pkceChallenge,
    safeReturnTo,
    statesMatch,
    storefrontCallbackUrl,
} from '../../apps/commerce/web/src/lib/buyer-auth/flow';
import { isStorefrontInternalOnlyPath } from '../../apps/commerce/web/src/lib/api/internal-only-paths';
import { parseStorefrontCallback } from '../../services/api-gateway/src/routes/storefront/buyer-authorization-routes';
import { parseAuthorizationRequest } from '../../apps/platform/identity/src/lib/auth/buyer-authorization';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const TOKEN = 'a'.repeat(43);

test('the callback is built from the host the way the gateway accepts it', () => {
    const cases: [string, string][] = [
        ['store-one.letbuyy.com', 'https://store-one.letbuyy.com/api/buyer-auth/callback'],
        ['Store-One.LetBuyy.com', 'https://store-one.letbuyy.com/api/buyer-auth/callback'],
        ['shop.asha-handloom.in:443', 'https://shop.asha-handloom.in/api/buyer-auth/callback'],
        ['store-one.letbuyy.com, proxy.internal', 'https://store-one.letbuyy.com/api/buyer-auth/callback'],
        ['store-one.localhost:9000', 'http://store-one.localhost:9000/api/buyer-auth/callback'],
        ['localhost:9000', 'http://localhost:9000/api/buyer-auth/callback'],
    ];
    for (const [host, expected] of cases) {
        const built = storefrontCallbackUrl(host);
        assert.equal(built, expected, host);
        assert.ok(parseStorefrontCallback(built!), `the gateway must accept what the storefront builds for ${host}`);
    }
    for (const bad of ['', 'evil.example/path', 'a..b.com', 'user@store.letbuyy.com', 'store one.letbuyy.com', '-bad.letbuyy.com', 'store.letbuyy.com:99999x']) {
        assert.equal(storefrontCallbackUrl(bad), null, bad);
    }
});

test('the authorize URL is exactly what identity-platform accepts, with an RFC 7636 challenge', async () => {
    // RFC 7636, Appendix B.
    assert.equal(await pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
    const url = new URL(authorizeUrl('https://accounts.letbuyy.com', {
        redirectUri: 'https://store-one.letbuyy.com/api/buyer-auth/callback',
        state: TOKEN,
        challenge: await pkceChallenge(TOKEN),
    }));
    assert.equal(url.origin + url.pathname, 'https://accounts.letbuyy.com/buyer/authorize');
    const parsed = parseAuthorizationRequest(Object.fromEntries(url.searchParams.entries()));
    assert.ok(parsed, 'identity-platform must accept the request the storefront sends');
    assert.equal(parsed.redirectUri, 'https://store-one.letbuyy.com/api/buyer-auth/callback');
    assert.equal(parsed.state, TOKEN);
});

test('return_to is a path on this store or the home page', () => {
    assert.equal(safeReturnTo('/products/kurta?size=m'), '/products/kurta?size=m');
    for (const bad of [null, '', 'https://evil.example', '//evil.example/x', '/\\evil.example', 'javascript:alert(1)', '/a\nb', `/${'x'.repeat(1100)}`]) {
        assert.equal(safeReturnTo(bad), '/', String(bad).slice(0, 30));
    }
});

test('the flow cookie round-trips, and anything tampered is no flow at all', () => {
    const flow = { state: TOKEN, verifier: 'b'.repeat(43), returnTo: '/cart', redirectUri: 'https://s.letbuyy.com/api/buyer-auth/callback' };
    assert.deepEqual(decodeFlow(encodeFlow(flow)), flow);
    for (const tampered of [
        { ...flow, returnTo: 'https://evil.example' },
        { ...flow, state: 'short' },
        { ...flow, verifier: 'has spaces in it and is long enough to pass length checks x' },
        { ...flow, redirectUri: 'https://evil.example/elsewhere' },
    ]) {
        assert.equal(decodeFlow(encodeFlow(tampered)), null, JSON.stringify(tampered).slice(0, 60));
    }
    assert.equal(decodeFlow('not base64 !'), null);
    assert.equal(decodeFlow(undefined), null);
});

test('state comparison is exact', () => {
    assert.equal(statesMatch(TOKEN, TOKEN), true);
    assert.equal(statesMatch(TOKEN, `${TOKEN.slice(0, 42)}b`), false);
    assert.equal(statesMatch(TOKEN, TOKEN.slice(0, 42)), false);
});

test('the session cookie holds a site and a token, and nothing else parses', () => {
    const site = '44444444-4444-4444-8444-000000000001';
    assert.deepEqual(decodeSession(encodeSession(site, 'h.p.s')), { siteId: site, token: 'h.p.s' });
    for (const bad of [null, '', 'no-separator', `${site}~not-a-jwt`, `not-a-site~h.p.s`]) {
        assert.equal(decodeSession(bad), null, String(bad));
    }
});

test('identity-platform origin comes from NEXT_PUBLIC_ACCOUNTS_URL, or production', () => {
    assert.equal(identityOrigin({ NEXT_PUBLIC_ACCOUNTS_URL: 'http://localhost:9002/' }), 'http://localhost:9002');
    assert.equal(identityOrigin({}), 'https://accounts.letbuyy.com');
    assert.equal(identityOrigin({ NEXT_PUBLIC_ACCOUNTS_URL: 'javascript:alert(1)' }), 'https://accounts.letbuyy.com');
});

test('sign-out is accepted only from the store\'s own pages', () => {
    const headers = (values: Record<string, string>) => ({ get: (name: string) => values[name.toLowerCase()] ?? null });
    const requestUrl = 'https://s.letbuyy.com/api/buyer-auth/logout';
    assert.equal(isSameOriginRequest(headers({ 'sec-fetch-site': 'same-origin' }), requestUrl), true);
    assert.equal(isSameOriginRequest(headers({ 'sec-fetch-site': 'cross-site', origin: 'https://s.letbuyy.com' }), requestUrl), false);
    assert.equal(isSameOriginRequest(headers({ origin: 'https://s.letbuyy.com' }), requestUrl), true);
    assert.equal(isSameOriginRequest(headers({ origin: 'https://evil.example' }), requestUrl), false);
    assert.equal(isSameOriginRequest(headers({ host: 's.letbuyy.com' }), requestUrl), false);
    assert.equal(isSameOriginRequest(headers({ origin: 'http://s.letbuyy.com' }), requestUrl), false);
    assert.equal(isSameOriginRequest(headers({ origin: 'https://s.letbuyy.com:444' }), requestUrl), false);
});

test('the gateway read is signed as the storefront, and only that exact path is added', () => {
    assert.equal(isStorefrontInternalOnlyPath('/storefront/buyer/storefront-session?store_id=x'), true);
    assert.equal(isStorefrontInternalOnlyPath('/storefront/buyer/storefront-session/'), true);
    assert.equal(isStorefrontInternalOnlyPath('/storefront/buyer/storefront-session-extra'), false);
    assert.equal(isStorefrontInternalOnlyPath('/storefront/buyer/me'), false);
});

test('every buyer-auth cookie is a __Host- cookie: HttpOnly, Secure, host-only, path /', () => {
    assert.ok(STOREFRONT_BUYER_FLOW_COOKIE.startsWith('__Host-') && STOREFRONT_BUYER_SESSION_COOKIE.startsWith('__Host-'));
    const dir = join(root, 'apps/commerce/web/src/app/api/buyer-auth');
    let sets = 0;
    for (const route of readdirSync(dir, { withFileTypes: true }).filter(entry => entry.isDirectory())) {
        const source = readFileSync(join(dir, route.name, 'route.ts'), 'utf8');
        // Each call ends with its options object and `});`. Bounding a call by the first `}` instead
        // would stop inside an argument like encodeFlow({ ... }) and never reach the options.
        for (const chunk of source.split('cookies.set(').slice(1)) {
            sets += 1;
            const call = chunk.slice(0, chunk.indexOf('});') + 1);
            const options = call.slice(call.lastIndexOf('{'));
            assert.match(options, /httpOnly: true/, `${route.name}: ${options.slice(0, 60)}`);
            assert.match(options, /secure: true/, route.name);
            assert.match(options, /path: '\/'/, route.name);
            assert.match(options, /sameSite: 'lax'/, route.name);
            assert.ok(!/domain:/.test(options), `${route.name} must not set a domain`);
        }
        assert.ok(!/access_token=|[?&]token=/.test(source), `${route.name} must never put a token in a URL`);
    }
    assert.ok(sets >= 5, `found ${sets} cookie writes`);
});
