// ============================================================
// PRODUCT REVIEWS API — Read reviews & submit new reviews
// GET  /api/reviews?productId=...&storeId=...  → list approved reviews
// POST /api/reviews                            → submit a review
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { STOREFRONT_BUYER_SESSION_COOKIE } from '@/lib/buyer-auth/flow';
import { resolveBuyerDataSession } from '@/lib/buyer-auth/data-session';
import { getUrbanKicksDemoReviews, URBAN_KICKS_DEMO_STORE_ID } from '@/lib/demo/urban-kicks-demo';
import { getSession } from '@/lib/session';
import { createStorefrontApiClient, storefrontApiFetch, StorefrontApiRequestError } from '@/lib/api/client';
import { verifyExpectedBuyerIdentity } from '@/lib/buyer-auth/expected-buyer';

function getErrorMessage(payload: unknown, fallback: string) {
    if (payload && typeof payload === 'object') {
        const error = (payload as { error?: unknown }).error;
        if (typeof error === 'string') return error;
        if (error && typeof error === 'object') {
            const message = (error as { message?: unknown }).message;
            if (typeof message === 'string') return message;
        }
        const message = (payload as { message?: unknown }).message;
        if (typeof message === 'string') return message;
    }

    return fallback;
}

function reviewApiErrorResponse(error: unknown, fallbackMessage: string) {
    if (error instanceof StorefrontApiRequestError) {
        return NextResponse.json(
            {
                error: getErrorMessage(error.payload, error.message),
            },
            { status: error.status }
        );
    }

    return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}

// ── GET — Fetch approved reviews for a product ─────────────
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const productId = searchParams.get('productId');
        const storeId = searchParams.get('storeId');

        if (!productId || !storeId) {
            return NextResponse.json({ error: 'productId and storeId required' }, { status: 400 });
        }

        if (storeId === URBAN_KICKS_DEMO_STORE_ID) {
            return NextResponse.json(getUrbanKicksDemoReviews(productId));
        }

        const payload = await createStorefrontApiClient().storefront.productReviews({
            product_id: productId,
            store_id: storeId,
        });
        return NextResponse.json(payload || { reviews: [], summary: { totalReviews: 0, averageRating: 0, distribution: [] } });
    } catch (error) {
        return reviewApiErrorResponse(error, 'Failed to fetch reviews');
    }
}

// ── POST — Submit a new review ─────────────────────────────
export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => null) as Record<string, unknown> | null;
        if (!body || Array.isArray(body)) return NextResponse.json({ error: 'A review is required.' }, { status: 400 });
        const { productId, storeId, rating, title, reviewBody } = body;

        // A canonical buyer session always takes precedence over the transitional per-store
        // customer cookie. Store and identity fields are resolved from signed/server state.
        if (request.cookies.get(STOREFRONT_BUYER_SESSION_COOKIE)) {
            const session = await resolveBuyerDataSession(request);
            if ('response' in session) return session.response;
            if (typeof storeId !== 'string' || storeId.toLowerCase() !== session.siteId.toLowerCase()) {
                return NextResponse.json({ error: 'This review does not belong to the current store.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
            }
            // A product page can stay open while another tab replaces the shared host-only
            // cookie. Bind its review draft to the buyer whose verified identity was rendered;
            // this value is comparison-only and never forwarded as authority.
            const identityFailure = await verifyExpectedBuyerIdentity(session, request.headers.get('x-letbuyy-expected-buyer-id'), {
                missing: 'Reload your account before submitting this review.',
                unavailable: 'Your account could not be checked before submitting this review.',
                changed: 'Your account changed. Reload before submitting this review.',
            });
            if (identityFailure) return identityFailure;
            if (typeof productId !== 'string' || !Number.isInteger(rating) || Number(rating) < 1 || Number(rating) > 5) {
                return NextResponse.json({ error: 'A product and rating from 1 to 5 are required.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
            }
            let result: Response;
            try {
                result = await storefrontApiFetch(`/storefront/buyer/reviews?store_id=${encodeURIComponent(session.siteId)}`, {
                    method: 'POST',
                    headers: session.headers,
                    body: JSON.stringify({
                        product_id: productId,
                        rating,
                        ...(typeof title === 'string' ? { title } : {}),
                        ...(typeof reviewBody === 'string' ? { body: reviewBody } : {}),
                        turnstile_token: body.turnstileToken ?? body.turnstile_token ?? null,
                    }),
                    cache: 'no-store',
                });
            } catch {
                return NextResponse.json({ error: 'Reviews are unavailable right now.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
            }
            const noStore = { 'Cache-Control': 'no-store' };
            if (result.status === 401) return NextResponse.json({ error: 'Sign in to LetBuyy again to submit this review.' }, { status: 401, headers: noStore });
            if (result.status === 403) return NextResponse.json({ error: 'Complete the security check and try again.' }, { status: 403, headers: noStore });
            if (result.status === 409) {
                const failure = await result.json().catch(() => null) as { error?: { code?: unknown } } | null;
                const notLinked = failure?.error?.code === 'STORE_ACCOUNT_NOT_LINKED';
                const unavailable = failure?.error?.code === 'STORE_ACCOUNT_UNAVAILABLE';
                return NextResponse.json({ error: notLinked ? 'Connect this store account in your LetBuyy settings before submitting a review.' : unavailable ? 'This store account is unavailable for reviews. Contact the store for help.' : 'You have already reviewed this product.', ...(notLinked ? { code: 'STORE_ACCOUNT_NOT_LINKED' } : unavailable ? { code: 'STORE_ACCOUNT_UNAVAILABLE' } : {}) }, { status: 409, headers: noStore });
            }
            if (result.status === 400 || result.status === 404) {
                const failure = await result.json().catch(() => null) as { error?: { message?: unknown } } | null;
                const message = typeof failure?.error?.message === 'string' ? failure.error.message : 'This product is not accepting reviews.';
                return NextResponse.json({ error: message }, { status: result.status, headers: noStore });
            }
            if (!result.ok) return NextResponse.json({ error: 'Reviews are unavailable right now.' }, { status: 503, headers: noStore });
            const payload = await result.json().catch(() => null) as { data?: { review?: { id?: unknown }; message?: unknown } } | null;
            if (typeof payload?.data?.review?.id !== 'string') return NextResponse.json({ error: 'Reviews are unavailable right now.' }, { status: 503, headers: noStore });
            return NextResponse.json({ success: true, review: { id: payload.data.review.id, status: 'pending' }, message: typeof payload.data.message === 'string' ? payload.data.message : 'Review submitted for approval.' }, { status: 201, headers: noStore });
        }

        if (typeof productId !== 'string' || typeof storeId !== 'string' || typeof rating !== 'number' || !Number.isFinite(rating)) {
            return NextResponse.json(
                { error: 'productId, storeId, and rating are required' },
                { status: 400 }
            );
        }

        if (rating < 1 || rating > 5) {
            return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 });
        }

        // Get customer info from session (if logged in)
        const session = await getSession();
        const customerName = session?.name || (typeof body.customerName === 'string' ? body.customerName : 'Anonymous');
        const customerEmail = session?.email || (typeof body.customerEmail === 'string' ? body.customerEmail : null);

        const payload = await createStorefrontApiClient().storefront.submitProductReview({
            store_id: storeId,
            product_id: productId,
            customer_name: customerName,
            customer_email: customerEmail,
            rating,
            title: typeof title === 'string' ? title : null,
            body: typeof reviewBody === 'string' ? reviewBody : null,
            is_verified: !!session,
            turnstile_token: typeof body.turnstileToken === 'string' ? body.turnstileToken : typeof body.turnstile_token === 'string' ? body.turnstile_token : null,
        });

        return NextResponse.json(payload, { status: 201 });
    } catch (error) {
        return reviewApiErrorResponse(error, 'Failed to submit review');
    }
}
