import { NextRequest, NextResponse } from 'next/server';
import { ThemeService } from '@/lib/theme-service';
import { logger } from '@/lib/logger';

/**
 * GET /api/themes
 * Returns a paginated, filterable list of themes.
 *
 * Query params: category, pricingType, search, sort, limit, offset
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = req.nextUrl;

        const filters = {
            category: searchParams.get('category') || undefined,
            pricingType: searchParams.get('pricingType') || undefined,
            search: searchParams.get('search') || undefined,
            sort: (searchParams.get('sort') as any) || 'popular',
            limit: parseInt(searchParams.get('limit') || '30', 10),
            offset: parseInt(searchParams.get('offset') || '0', 10),
        };

        const result = await ThemeService.listThemes(filters);

        if (!result.ok) {
            return NextResponse.json(
                { error: { code: 'MARKETPLACE_UNAVAILABLE', message: result.error.message }, themes: [], total: 0 },
                { status: 503 }
            );
        }

        return NextResponse.json(result.value);
    } catch (error) {
        logger.error('failed to list themes', { error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json(
            { error: 'Failed to fetch themes', themes: [], total: 0 },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json() as Record<string, unknown>;
        const bundle = body.bundle;

        if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) {
            return NextResponse.json(
                { error: 'bundle is required' },
                { status: 400 }
            );
        }

        const result = await ThemeService.uploadThemePackage(bundle as Record<string, unknown>);
        return NextResponse.json(result, { status: 201 });
    } catch (error) {
        logger.error('theme upload failed', { error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to upload theme package' },
            { status: 500 }
        );
    }
}
