import { NextRequest, NextResponse } from 'next/server';
import { ThemeService } from '@/lib/theme-service';

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

        return NextResponse.json(result);
    } catch (error) {
        console.error('[API] /api/themes error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch themes', themes: [], total: 0 },
            { status: 500 }
        );
    }
}
