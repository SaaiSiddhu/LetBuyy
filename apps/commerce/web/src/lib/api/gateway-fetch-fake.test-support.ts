// Test-only support for the storefront's gateway-proxy routes (never imported by application code).
//
// A proxy route's whole job is what it sends to the gateway and what it lets back to the browser, so these tests fake
// the ONE seam every proxy shares: the global fetch that storefrontApiFetch and the api-client finally call. Nothing
// else is mocked -- the real route handler, the real session-cookie decoding, the real header construction and the real
// api-client response unwrapping all run.
import { LETBUYY_BUYER_SESSION_HEADER } from '@letbuyy/auth-core';
import { STOREFRONT_BUYER_SESSION_COOKIE, encodeSession } from '@/lib/buyer-auth/flow';

export { LETBUYY_BUYER_SESSION_HEADER };

export interface RecordedGatewayRequest {
    url: URL;
    method: string;
    headers: Headers;
    body: string | null;
    cache: RequestCache | undefined;
}

export type GatewayResponder = (request: RecordedGatewayRequest) => Response | Promise<Response>;

export const FAKE_GATEWAY_BASE_URL = 'https://gateway.fake.test/v1';
export const SITE_ID = '0d8a7b1c-3e5f-4a6b-9c1d-2e3f4a5b6c7d';
// JWT-shaped (three base64url segments), which is all decodeSession checks; the gateway is what verifies signatures.
export const BUYER_TOKEN = 'aaaaaaaa.bbbbbbbb.cccccccc';

/** Replaces the global fetch for one test. Requests are recorded; `respond` decides what the "gateway" answers. */
export function installGatewayFake(respond: GatewayResponder): { requests: RecordedGatewayRequest[]; restore: () => void } {
    const originalFetch = globalThis.fetch;
    const originalBaseUrl = process.env.LETBUYY_API_BASE_URL;
    process.env.LETBUYY_API_BASE_URL = FAKE_GATEWAY_BASE_URL;
    const requests: RecordedGatewayRequest[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const recorded: RecordedGatewayRequest = {
            url: new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url),
            method: (init?.method ?? 'GET').toUpperCase(),
            headers: new Headers(init?.headers),
            body: typeof init?.body === 'string' ? init.body : null,
            cache: init?.cache,
        };
        requests.push(recorded);
        return respond(recorded);
    }) as typeof fetch;
    return {
        requests,
        restore: () => {
            globalThis.fetch = originalFetch;
            if (originalBaseUrl === undefined) delete process.env.LETBUYY_API_BASE_URL;
            else process.env.LETBUYY_API_BASE_URL = originalBaseUrl;
        },
    };
}

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
    return new Response(JSON.stringify(body), { ...init, headers: { 'Content-Type': 'application/json', ...init.headers } });
}

/** The Cookie header a signed-in buyer's browser sends on the store host. */
export function buyerCookieHeader(token = BUYER_TOKEN, siteId = SITE_ID): string {
    return `${STOREFRONT_BUYER_SESSION_COOKIE}=${encodeSession(siteId, token)}`;
}
