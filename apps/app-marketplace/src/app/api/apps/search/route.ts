import { NextRequest, NextResponse } from 'next/server';
import { AppDiscoveryEventInputSchema, AppRequestInputSchema, AppSavedAppInputSchema, AppTelemetryEventInputSchema } from '@letbuyy/shared-types';
import { AppService } from '@/lib/app-service';
import { logger } from '@/lib/logger';
import { sanitizeMarketplaceSearchQuery } from '@/lib/marketplace-display';

/**
 * GET /api/apps/search — Full-text search
 * Query params: q, category, limit
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    if (searchParams.get('kind') === 'categories') {
        return NextResponse.json({ categories: await AppService.getCategoriesWithFallback() });
    }
    if (searchParams.get('kind') === 'feature_facets') {
        const categorySlug = searchParams.get('category');
        if (!categorySlug) return NextResponse.json({ feature_groups: [] });
        return NextResponse.json({
            feature_groups: await AppService.getCategoryFeatureFacets(categorySlug, [
                ...searchParams.getAll('feature_handles'),
                ...searchParams.getAll('feature_handles[]'),
            ]),
        });
    }
    if (searchParams.get('kind') === 'saved_apps') {
        return NextResponse.json(await AppService.getSavedApps(searchParams.get('site_id')));
    }

    const q = sanitizeMarketplaceSearchQuery(searchParams.get('q') || '');
    const category = searchParams.get('category') || undefined;
    const pricingModel = searchParams.get('pricing') || undefined;
    const ratingMin = searchParams.get('rating_min') || searchParams.get('rating') || undefined;
    const builtForLetbuyy = searchParams.get('built_for_letbuyy') === 'true' || searchParams.get('program') === 'built-for-letbuyy';
    const featureHandles = [
        ...searchParams.getAll('feature_handles'),
        ...searchParams.getAll('feature_handles[]'),
    ];
    const sort = (searchParams.get('sort') || 'popular') as 'popular' | 'rating' | 'recent' | 'name';
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!q) {
        return NextResponse.json({ apps: [], total: 0 });
    }

    try {
        const result = await AppService.searchApps(q, category, limit, { sort, pricingModel }, offset, ratingMin, builtForLetbuyy, featureHandles);

        if (!result.ok) {
            return NextResponse.json(
                { error: { code: 'MARKETPLACE_UNAVAILABLE', message: result.error.message } },
                { status: 503 }
            );
        }

        return NextResponse.json(result.value);
    } catch (error) {
        logger.error('app search failed', { error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json(
            { error: 'Search failed' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    const raw = await request.json().catch(() => null);
    if (raw?.action === 'request_app') {
        const parsedRequest = AppRequestInputSchema.safeParse(raw.request);
        if (!parsedRequest.success) {
            return NextResponse.json(
                { error: { code: 'VALIDATION', message: parsedRequest.error.issues[0]?.message || 'Invalid app request' } },
                { status: 400 },
            );
        }

        const accepted = await AppService.requestApp(parsedRequest.data);
        if (!accepted) {
            logger.error('failed to record marketplace app request', { category_slug: parsedRequest.data.category_slug || null });
            return NextResponse.json(
                { error: { code: 'MARKETPLACE_UNAVAILABLE', message: 'Could not capture app request' } },
                { status: 503 },
            );
        }

        return NextResponse.json({ accepted: true }, { status: 202 });
    }

    if (raw?.action === 'save_app') {
        const parsedSavedApp = AppSavedAppInputSchema.safeParse(raw.saved_app);
        if (!parsedSavedApp.success) {
            return NextResponse.json(
                { error: { code: 'VALIDATION', message: parsedSavedApp.error.issues[0]?.message || 'Invalid saved app' } },
                { status: 400 },
            );
        }

        try {
            return NextResponse.json(await AppService.saveApp(parsedSavedApp.data), { status: 201 });
        } catch (error) {
            logger.error('failed to save marketplace app', { error: error instanceof Error ? error.message : String(error) });
            return NextResponse.json(
                { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
                { status: 401 },
            );
        }
    }

    if (raw?.action === 'unsave_app') {
        const appId = typeof raw.app_id === 'string' ? raw.app_id : '';
        if (!appId) {
            return NextResponse.json(
                { error: { code: 'VALIDATION', message: 'app_id is required' } },
                { status: 400 },
            );
        }

        try {
            return NextResponse.json(await AppService.unsaveApp(appId, typeof raw.site_id === 'string' ? raw.site_id : null));
        } catch (error) {
            logger.error('failed to unsave marketplace app', { error: error instanceof Error ? error.message : String(error) });
            return NextResponse.json(
                { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
                { status: 401 },
            );
        }
    }

    if (raw?.action === 'telemetry_event') {
        const parsedTelemetry = AppTelemetryEventInputSchema.safeParse(raw.event);
        if (!parsedTelemetry.success) {
            return NextResponse.json(
                { error: { code: 'VALIDATION', message: parsedTelemetry.error.issues[0]?.message || 'Invalid telemetry event' } },
                { status: 400 },
            );
        }

        const accepted = await AppService.recordTelemetryEvent(parsedTelemetry.data);
        if (!accepted) {
            logger.error('failed to record marketplace telemetry event', { event_type: parsedTelemetry.data.event_type });
            return NextResponse.json(
                { error: { code: 'MARKETPLACE_UNAVAILABLE', message: 'Could not record telemetry event' } },
                { status: 503 },
            );
        }

        return NextResponse.json({ accepted: true }, { status: 202 });
    }

    const parsed = AppDiscoveryEventInputSchema.safeParse(raw);
    if (!parsed.success) {
        return NextResponse.json(
            { error: { code: 'VALIDATION', message: parsed.error.issues[0]?.message || 'Invalid discovery event' } },
            { status: 400 },
        );
    }

    const accepted = await AppService.recordDiscoveryEvent(parsed.data);
    if (!accepted) {
        logger.error('failed to record marketplace discovery event', { event_type: parsed.data.event_type });
        return NextResponse.json(
            { error: { code: 'MARKETPLACE_UNAVAILABLE', message: 'Could not record discovery event' } },
            { status: 503 },
        );
    }

    return NextResponse.json({ accepted: true }, { status: 202 });
}
