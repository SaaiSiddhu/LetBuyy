import { NextRequest, NextResponse } from 'next/server';
import { AppService } from '@/lib/app-service';

/**
 * GET /api/apps — List and filter published apps
 * Query params: category, sort, limit, offset, pricing, siteType
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || undefined;
    const sort = (searchParams.get('sort') || 'popular') as 'popular' | 'rating' | 'recent' | 'name';
    const pricingModel = searchParams.get('pricing') || undefined;
    const siteType = searchParams.get('siteType') || undefined;
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    try {
        const result = await AppService.listApps({
            category,
            sort,
            pricingModel,
            siteType,
            limit,
            offset,
        });

        if (!result.ok) {
            return NextResponse.json(
                { error: { code: 'MARKETPLACE_UNAVAILABLE', message: result.error.message } },
                { status: 503 }
            );
        }

        return NextResponse.json(result.value);
    } catch (error) {
        console.error('[API /apps] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch apps' },
            { status: 500 }
        );
    }
}
