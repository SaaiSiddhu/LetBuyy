import { NextRequest, NextResponse } from 'next/server';
import { AppService } from '@/lib/app-service';
import { appStoreWorkerFetch, proxyWorkerJson } from '@/lib/api/worker-client';

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

        const response = await appStoreWorkerFetch(`/app-store/apps/${id}/reviews`, {
            method: 'POST',
            requireSession: true,
            body: JSON.stringify({
                rating,
                title: title || null,
                body: reviewBody || '',
                store_id,
            }),
        });

        return proxyWorkerJson(response);
    } catch {
        return NextResponse.json(
            { error: 'Invalid request body' },
            { status: 400 }
        );
    }
}
