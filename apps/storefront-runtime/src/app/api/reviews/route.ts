// ============================================================
// PRODUCT REVIEWS API — Read reviews & submit new reviews
// GET  /api/reviews?productId=...&storeId=...  → list approved reviews
// POST /api/reviews                            → submit a review
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getUrbanKicksDemoReviews, URBAN_KICKS_DEMO_STORE_ID } from '@/lib/demo/urban-kicks-demo';
import { getSession } from '@/lib/session';
import { createStorefrontApiClient, StorefrontApiRequestError } from '@/lib/api/client';

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
        const body = await request.json();
        const { productId, storeId, rating, title, reviewBody } = body;

        if (!productId || !storeId || !rating) {
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
        const customerName = session?.name || body.customerName || 'Anonymous';
        const customerEmail = session?.email || body.customerEmail || null;

        const payload = await createStorefrontApiClient().storefront.submitProductReview({
            store_id: storeId,
            product_id: productId,
            customer_name: customerName,
            customer_email: customerEmail,
            rating,
            title: title || null,
            body: reviewBody || null,
            is_verified: !!session,
        });

        return NextResponse.json(payload, { status: 201 });
    } catch (error) {
        return reviewApiErrorResponse(error, 'Failed to submit review');
    }
}
