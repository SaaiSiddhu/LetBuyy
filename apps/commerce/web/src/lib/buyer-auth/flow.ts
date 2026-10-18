// APPID-P4c — the storefront's half of buyer sign-in through identity-platform (first-party
// authorization code with PKCE, APPID-P4b).
//
// Pure, so every rule here is testable without Next.js. The routes under app/api/buyer-auth/ use it.
//
//   start     the storefront makes a state value and a PKCE verifier, keeps both in a __Host- cookie on
//             the store's own host, and sends the buyer to identity-platform with the state, the
//             verifier's S256 challenge and this host's callback.
//   callback  identity-platform sends the buyer back with a code and the same state. The state must
//             match the cookie's; the code and verifier are exchanged server to server; the session
//             identity-platform mints goes into another __Host- cookie. Nothing secret is ever in a URL.
//
// __Host- cookies cannot carry a Domain attribute, so no other store's subdomain can plant one here
// (cookie tossing between *.letbuyy.com stores), and they are HttpOnly, so theme scripts cannot read
// the verifier or the session.

import { LETBUYY_STOREFRONT_BUYER_CALLBACK_PATH, LETBUYY_STOREFRONT_CLIENT_ID } from '@letbuyy/auth-core';

export const STOREFRONT_BUYER_FLOW_COOKIE = '__Host-lb_buyer_auth';
export const STOREFRONT_BUYER_SESSION_COOKIE = '__Host-lb_store_buyer';
/** Ten minutes to sign in at identity-platform and come back; the code itself lives 60 seconds. */
export const STOREFRONT_BUYER_FLOW_TTL_SECONDS = 10 * 60;

export interface StorefrontBuyerFlow {
    state: string;
    verifier: string;
    returnTo: string;
    redirectUri: string;
    linkStoreCustomer?: true;
}

const HOSTNAME = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

export function isLocalStoreHostname(hostname: string): boolean {
    return hostname === 'localhost' || hostname.endsWith('.localhost');
}

/// This host's callback, written exactly as the gateway will accept it: https outside localhost
/// development (never downgraded by a forwarded protocol header), the host lowercased, a port kept
/// only on localhost, and the one callback path. Null for anything that is not a plain host name.
export function storefrontCallbackUrl(hostHeader: string | null | undefined): string | null {
    const raw = String(hostHeader || '').split(',')[0].trim().toLowerCase();
    const match = /^([^:]+)(?::(\d{1,5}))?$/.exec(raw);
    if (!match) return null;
    const [, hostname, port] = match;
    if (!HOSTNAME.test(hostname)) return null;
    if (isLocalStoreHostname(hostname)) {
        return `http://${hostname}${port ? `:${port}` : ''}${LETBUYY_STOREFRONT_BUYER_CALLBACK_PATH}`;
    }
    return `https://${hostname}${LETBUYY_STOREFRONT_BUYER_CALLBACK_PATH}`;
}

/// Where to send the buyer afterwards: a path on this same store, or its home page. A full URL, a
/// protocol-relative `//host`, a backslash (which browsers read as a slash) or a control character
/// would each turn sign-in into an open redirect.
export function safeReturnTo(value: string | null | undefined): string {
    if (!value || value.length > 1024) return '/';
    if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/';
    if (/[\u0000-\u001f\u007f]/.test(value)) return '/';
    return value;
}

function base64Url(bytes: Uint8Array): string {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function randomToken(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return base64Url(bytes);
}

/// RFC 7636: a 43-character verifier from 32 random bytes, and its S256 challenge.
export async function createPkcePair(): Promise<{ verifier: string; challenge: string }> {
    const verifier = randomToken();
    return { verifier, challenge: await pkceChallenge(verifier) };
}

export async function pkceChallenge(verifier: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    return base64Url(new Uint8Array(digest));
}

export function authorizeUrl(identityOrigin: string, input: { redirectUri: string; state: string; challenge: string; screen?: 'register' }): string {
    const url = new URL('/buyer/authorize', identityOrigin);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', LETBUYY_STOREFRONT_CLIENT_ID);
    url.searchParams.set('redirect_uri', input.redirectUri);
    url.searchParams.set('state', input.state);
    url.searchParams.set('code_challenge', input.challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    if (input.screen === 'register') url.searchParams.set('screen', 'register');
    return url.toString();
}

export function encodeFlow(flow: StorefrontBuyerFlow): string {
    return base64Url(new TextEncoder().encode(JSON.stringify(flow)));
}

/// The cookie comes back from the browser, so it is parsed as untrusted input: anything that is not
/// exactly the four fields in their expected shapes is no flow at all.
export function decodeFlow(value: string | null | undefined): StorefrontBuyerFlow | null {
    if (!value || value.length > 4096 || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
    try {
        const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
        const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Partial<StorefrontBuyerFlow>;
        if (typeof parsed.state !== 'string' || !TOKEN.test(parsed.state)) return null;
        if (typeof parsed.verifier !== 'string' || !TOKEN.test(parsed.verifier)) return null;
        if (typeof parsed.redirectUri !== 'string' || !parsed.redirectUri.endsWith(LETBUYY_STOREFRONT_BUYER_CALLBACK_PATH)) return null;
        if (typeof parsed.returnTo !== 'string' || safeReturnTo(parsed.returnTo) !== parsed.returnTo) return null;
        if (parsed.linkStoreCustomer !== undefined && parsed.linkStoreCustomer !== true) return null;
        return {
            state: parsed.state,
            verifier: parsed.verifier,
            returnTo: parsed.returnTo,
            redirectUri: parsed.redirectUri,
            ...(parsed.linkStoreCustomer === true ? { linkStoreCustomer: true as const } : {}),
        };
    } catch {
        return null;
    }
}

/// Compares every character whatever the first difference, so the time taken says nothing about
/// how much of a guessed state was right.
export function statesMatch(expected: string, received: string): boolean {
    if (expected.length !== received.length) return false;
    let difference = 0;
    for (let index = 0; index < expected.length; index += 1) {
        difference |= expected.charCodeAt(index) ^ received.charCodeAt(index);
    }
    return difference === 0;
}

/// The session cookie holds the site the session was issued for, then the token. The site is not
/// trusted for anything: the gateway compares it with the token's signed site and refuses a mismatch.
export function encodeSession(siteId: string, token: string): string {
    return `${siteId}~${token}`;
}

export function decodeSession(value: string | null | undefined): { siteId: string; token: string } | null {
    if (!value) return null;
    const separator = value.indexOf('~');
    if (separator < 0) return null;
    const siteId = value.slice(0, separator);
    const token = value.slice(separator + 1);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(siteId)) return null;
    if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token) || token.length > 4096) return null;
    return { siteId, token };
}

/// identity-platform's origin: NEXT_PUBLIC_ACCOUNTS_URL, or production's.
export function identityOrigin(env: Record<string, string | undefined> = process.env): string {
    const configured = (env.NEXT_PUBLIC_ACCOUNTS_URL || '').trim();
    const origin = /^https?:\/\/[^/]+/i.exec(configured)?.[0];
    return origin || 'https://accounts.letbuyy.com';
}

/** Refusal-only account hint. No buyer credential or download grant enters a URL. */
export function buyerPrivacyUrl(buyerAccountId: string, env: Record<string, string | undefined> = process.env): string {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(buyerAccountId)) throw new Error('A current buyer account is required.');
    const base = new URL(identityOrigin(env));
    if (base.username || base.password || !(base.protocol === 'https:' || (base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)))) throw new Error('A secure Identity origin is required.');
    const target = new URL('/buyer/privacy', base); target.searchParams.set('buyer_hint', buyerAccountId.toLowerCase());
    return target.toString();
}

/// A POST is accepted only from this store's own pages. Sec-Fetch-Site rejects cross-site and
/// sibling-store same-site requests; when Origin is present, it must also exactly match the
/// request origin (including scheme and port). The request URL is supplied by the framework.
export function isSameOriginRequest(headers: { get(name: string): string | null }, requestUrl: string): boolean {
    const fetchSite = headers.get('sec-fetch-site');
    if (fetchSite && fetchSite !== 'same-origin') return false;
    const origin = headers.get('origin');
    if (!origin) return fetchSite === 'same-origin';
    try {
        const actualOrigin = new URL(origin).origin;
        const request = new URL(requestUrl);
        const forwardedHost = headers.get('x-forwarded-host');
        const forwardedProto = headers.get('x-forwarded-proto');
        let expectedOrigin = request.origin;
        if (forwardedHost !== null || forwardedProto !== null) {
            const host = forwardedHost === null ? request.host : forwardedHost.trim();
            const forwardedProtocol = forwardedProto?.trim().toLowerCase();
            const protocol = forwardedProtocol
                ? `${forwardedProtocol.replace(/:$/, '')}:`
                : request.protocol;
            if (!host || /[\s,/@?#]/.test(host) || !/^https?:$/.test(protocol)) return false;
            const forwardedOrigin = new URL(`${protocol}//${host}`);
            if (forwardedOrigin.pathname !== '/' || forwardedOrigin.username || forwardedOrigin.password) return false;
            expectedOrigin = forwardedOrigin.origin;
        }
        return origin === actualOrigin && actualOrigin === expectedOrigin;
    } catch {
        return false;
    }
}
