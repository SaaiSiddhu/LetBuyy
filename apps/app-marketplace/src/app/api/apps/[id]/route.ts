import { NextRequest, NextResponse } from 'next/server';
import { AppService } from '@/lib/app-service';

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/apps/[id] — Get app details by id or slug
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    const { id } = await params;

    const app = await AppService.getAppBySlug(id);

    if (!app) {
        return NextResponse.json(
            { error: 'App not found' },
            { status: 404 }
        );
    }

    const { reviews } = await AppService.getAppReviews(app.id as string);

    return NextResponse.json({
        app,
        reviews,
    });
}
