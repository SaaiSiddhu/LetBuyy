import { NextRequest, NextResponse } from 'next/server';
import { AppService } from '@/lib/app-service';
import { logger } from '@/lib/logger';

/**
 * GET /api/apps — List and filter published apps
 * Query params: category, sort, limit, offset, pricing, siteType, built_for_letbuyy
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || undefined;
    if (searchParams.get('action') === 'feature_facets' && category) {
        return NextResponse.json({
            feature_groups: await AppService.getCategoryFeatureFacets(category, [
                ...searchParams.getAll('feature_handles'),
                ...searchParams.getAll('feature_handles[]'),
            ]),
        });
    }

    const collection = searchParams.get('collection') || undefined;
    const sort = (searchParams.get('sort') || 'popular') as 'popular' | 'rating' | 'recent' | 'name';
    const pricingModel = searchParams.get('pricing') || undefined;
    const ratingMin = searchParams.get('rating_min') || searchParams.get('rating') || undefined;
    const siteType = searchParams.get('siteType') || undefined;
    const featured = searchParams.get('featured') === 'true' || searchParams.get('featured') === '1';
    const builtForLetbuyy = searchParams.get('built_for_letbuyy') === 'true' || searchParams.get('program') === 'built-for-letbuyy';
    const featureHandles = [
        ...searchParams.getAll('feature_handles'),
        ...searchParams.getAll('feature_handles[]'),
    ];
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    try {
        const result = await AppService.listApps({
            category,
            collection,
            featured,
            builtForLetbuyy,
            sort,
            pricingModel,
            ratingMin,
            siteType,
            featureHandles,
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
        logger.error('failed to list apps', { error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json(
            { error: 'Failed to fetch apps' },
            { status: 500 }
        );
    }
}
