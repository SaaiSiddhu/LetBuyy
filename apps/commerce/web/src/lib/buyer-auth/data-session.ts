import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { LETBUYY_STOREFRONT_SESSION_HEADER } from '@letbuyy/auth-core';
import { resolveStorefrontAccessContext } from '@/lib/storefront-access';
import { STOREFRONT_BUYER_SESSION_COOKIE, decodeSession, isSameOriginRequest } from './flow';

// Resolve the host independently of the cookie's untrusted site wrapper. The
// gateway verifies the signed site and account on every subsequent request.
export async function resolveBuyerDataSession(request: NextRequest): Promise<
    { siteId: string; headers: Record<string, string> } | { response: NextResponse }
> {
    const session = decodeSession(request.cookies.get(STOREFRONT_BUYER_SESSION_COOKIE)?.value);
    const refuse = () => ({ response: NextResponse.json({ error: 'Not authenticated' }, { status: 401, headers: { 'Cache-Control': 'no-store' } }) });
    if (!session) return refuse();
    if (request.method !== 'GET' && !isSameOriginRequest(request.headers)) {
        return { response: NextResponse.json({ error: 'A same-origin request is required.' }, { status: 403, headers: { 'Cache-Control': 'no-store' } }) };
    }
    try {
        const site = await resolveStorefrontAccessContext(request.headers.get('x-forwarded-host') || request.headers.get('host') || '');
        if (!site || site.site_id.toLowerCase() !== session.siteId.toLowerCase()) return refuse();
        return { siteId: site.site_id, headers: { [LETBUYY_STOREFRONT_SESSION_HEADER]: session.token } };
    } catch {
        return { response: NextResponse.json({ error: 'Your sign-in could not be checked right now.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }) };
    }
}
