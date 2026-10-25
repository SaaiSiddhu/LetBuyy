// The browser's HttpOnly buyer cookie reaches only this same-origin adapter.
// Gateway ownership, cart revision, review and payment locks remain authoritative.
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { LETBUYY_STOREFRONT_SESSION_HEADER } from '@letbuyy/auth-core';
import { storefrontApiFetch } from '@/lib/api/client';
import { decodeSession, isSameOriginRequest, STOREFRONT_BUYER_SESSION_COOKIE } from '@/lib/buyer-auth/flow';
import { resolveStorefrontAccessContext } from '@/lib/storefront-access';

const NO_STORE = { 'Cache-Control': 'no-store' };
const Params = z.object({ subdomain: z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/), cartToken: z.string().regex(/^ct_[A-Za-z0-9]{16,80}$/) });
const Body = z.record(z.string(), z.unknown()); // Domain validation remains in the canonical Gateway schema.
const MAX_BODY = 1024 * 1024;
type Context = { params: Promise<{ subdomain: string; cartToken: string }> };
const failure = (status: number, code: string, message: string) => NextResponse.json({ success: false, error: { code, message } }, { status, headers: NO_STORE });

async function forward(request: NextRequest, context: Context, mutation: boolean) {
    const params = Params.safeParse(await context.params);
    if (!params.success) return failure(400, 'VALIDATION', 'Invalid saved cart.');
    if (mutation && !isSameOriginRequest(request.headers, request.url)) return failure(403, 'FORBIDDEN', 'A same-origin cart request is required.');
    let body: string | undefined;
    if (mutation) {
        if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return failure(415, 'VALIDATION', 'Cart details must be JSON.');
        if (Number(request.headers.get('content-length') || 0) > MAX_BODY) return failure(413, 'VALIDATION', 'Cart details are too large.');
        body = await request.text().catch(() => '');
        if (new TextEncoder().encode(body).length > MAX_BODY) return failure(413, 'VALIDATION', 'Cart details are too large.');
        let parsed: unknown;
        try { parsed = JSON.parse(body); } catch { return failure(400, 'VALIDATION', 'Invalid cart details.'); }
        if (!Body.safeParse(parsed).success) return failure(400, 'VALIDATION', 'Invalid cart details.');
    }
    const headers: Record<string, string> = {};
    if (mutation) {
        const raw = request.cookies.get(STOREFRONT_BUYER_SESSION_COOKIE)?.value;
        const session = raw === undefined ? null : decodeSession(raw);
        if (raw !== undefined && !session) return failure(401, 'UNAUTHORIZED', 'Please sign in at this store again.');
        if (session) {
            try {
                const site = await resolveStorefrontAccessContext(request.headers.get('x-forwarded-host') || request.headers.get('host') || request.nextUrl.host);
                if (!site || site.site_id.toLowerCase() !== session.siteId.toLowerCase() || site.subdomain !== params.data.subdomain) return failure(403, 'FORBIDDEN', 'This sign-in belongs to another store.');
            } catch { return failure(503, 'UNAVAILABLE', 'Your sign-in could not be checked right now.'); }
            headers[LETBUYY_STOREFRONT_SESSION_HEADER] = session.token;
        }
    }
    try {
        const upstream = await storefrontApiFetch(`/storefront/${params.data.subdomain}/cart/${params.data.cartToken}`, {
            method: mutation ? 'PATCH' : 'GET', headers, body, cache: 'no-store', signal: AbortSignal.timeout(10_000),
        });
        if (upstream.status >= 500) return failure(503, 'UNAVAILABLE', 'Your saved cart is temporarily unavailable.');
        const payload: unknown = await upstream.json();
        return NextResponse.json(payload, { status: upstream.status, headers: NO_STORE });
    } catch { return failure(503, 'UNAVAILABLE', 'Your saved cart is temporarily unavailable.'); }
}

export async function GET(request: NextRequest, context: Context) { return forward(request, context, false); }
export async function PATCH(request: NextRequest, context: Context) { return forward(request, context, true); }
