// Store-specific wishlist access for a LetBuyy buyer, backed by the existing verified
// buyer-to-store-customer relationship. The client never selects either principal or site.
import { NextRequest, NextResponse } from 'next/server';
import { storefrontApiFetch } from '@/lib/api/client';
import { resolveBuyerDataSession } from '@/lib/buyer-auth/data-session';
import { verifyExpectedBuyerIdentity } from '@/lib/buyer-auth/expected-buyer';

const NO_STORE = { 'Cache-Control': 'no-store' };
const failure = (status = 503) => NextResponse.json({ error: 'Your wishlist is unavailable right now.' }, { status, headers: NO_STORE });

export async function GET(request: NextRequest) {
    const session = await resolveBuyerDataSession(request);
    if ('response' in session) return session.response;
    let response: Response;
    try {
        response = await storefrontApiFetch(`/storefront/buyer/wishlist?store_id=${encodeURIComponent(session.siteId)}`, {
            method: 'GET', headers: session.headers, cache: 'no-store',
        });
    } catch {
        return failure();
    }
    if (response.status === 401 || response.status === 403) return failure(401);
    if (!response.ok) return failure();
    const payload = await response.json().catch(() => null) as { data?: { linked?: unknown; reason?: unknown; product_ids?: unknown } } | null;
    if (typeof payload?.data?.linked !== 'boolean' || !Array.isArray(payload.data.product_ids)
        || payload.data.product_ids.some((value) => typeof value !== 'string')
        || (!payload.data.linked && !['not_linked', 'store_account_unavailable'].includes(String(payload.data.reason)))) return failure();
    return NextResponse.json({ linked: payload.data.linked, storeAccountUnavailable: payload.data.reason === 'store_account_unavailable', productIds: payload.data.product_ids }, { headers: NO_STORE });
}

async function mutate(request: NextRequest, method: 'POST' | 'DELETE') {
    const session = await resolveBuyerDataSession(request);
    if ('response' in session) return session.response;
    const body = await request.json().catch(() => null) as { productId?: unknown; variantId?: unknown } | null;
    if (!body || typeof body.productId !== 'string' || !body.productId.trim() || body.productId.length > 200
        || (body.variantId != null && (typeof body.variantId !== 'string' || !body.variantId.trim() || body.variantId.length > 200))) {
        return NextResponse.json({ error: 'A valid product is required.' }, { status: 400, headers: NO_STORE });
    }
    const identityFailure = await verifyExpectedBuyerIdentity(session, request.headers.get('x-letbuyy-expected-buyer-id'), {
        missing: 'Reload your account before changing your wishlist.',
        unavailable: 'Your account could not be checked before changing your wishlist.',
        changed: 'Your account changed. Reload before changing your wishlist.',
    });
    if (identityFailure) return identityFailure;

    let response: Response;
    try {
        response = await storefrontApiFetch(`/storefront/buyer/wishlist?store_id=${encodeURIComponent(session.siteId)}`, {
            method,
            headers: session.headers,
            body: JSON.stringify({ product_id: body.productId, ...(method === 'POST' && typeof body.variantId === 'string' ? { variant_id: body.variantId } : {}) }),
            cache: 'no-store',
        });
    } catch {
        return failure();
    }
    if (response.status === 401 || response.status === 403) return failure(401);
    if (response.status === 409) {
        const failureBody = await response.json().catch(() => null) as { error?: { code?: unknown } } | null;
        if (failureBody?.error?.code === 'STORE_ACCOUNT_UNAVAILABLE') {
            return NextResponse.json({ error: 'This store account is unavailable for wishlist use. Contact the store for help.', code: 'STORE_ACCOUNT_UNAVAILABLE' }, { status: 409, headers: NO_STORE });
        }
        return NextResponse.json({ error: 'Connect this store account before saving a wishlist.', code: 'STORE_ACCOUNT_NOT_LINKED' }, { status: 409, headers: NO_STORE });
    }
    if (response.status === 400) return NextResponse.json({ error: 'A valid product is required.' }, { status: 400, headers: NO_STORE });
    if (!response.ok) return failure();
    return NextResponse.json({ success: true }, { headers: NO_STORE });
}

export async function POST(request: NextRequest) { return mutate(request, 'POST'); }
export async function DELETE(request: NextRequest) { return mutate(request, 'DELETE'); }
