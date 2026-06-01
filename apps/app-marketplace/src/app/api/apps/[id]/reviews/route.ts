import { NextRequest, NextResponse } from 'next/server';
import { AppService } from '@/lib/app-service';
import { appMarketplaceErrorResponse, createAppMarketplaceApiClient } from '@/lib/api/client';

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/apps/[id]/reviews — Get reviews for an app
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    const { id } = await params;

    const { reviews, total } = await AppService.getAppReviews(id);

    return NextResponse.json({ reviews, total });
}

/**
 * POST /api/apps/[id]/reviews — Submit a review (auth required)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
    const { id } = await params;

    try {
        const body = await request.json();
        const { rating, title, body: reviewBody, store_id } = body;

        if (!rating || rating < 1 || rating > 5) {
            return NextResponse.json(
                { error: 'Rating must be between 1 and 5' },
                { status: 400 }
            );
        }

        const api = await createAppMarketplaceApiClient({ requireSession: true });
        const data = await api.appStore.submitReview(id, {
            rating,
            title: title || null,
            body: reviewBody || '',
            store_id,
        });

        return NextResponse.json({ data }, { status: 201 });
    } catch (error) {
        if (error instanceof SyntaxError) {
            return NextResponse.json(
                { error: 'Invalid request body' },
                { status: 400 }
            );
        }
        return appMarketplaceErrorResponse(error, 'Invalid request body');
    }
}
