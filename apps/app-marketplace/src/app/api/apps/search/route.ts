import { NextRequest, NextResponse } from 'next/server';
import { AppService } from '@/lib/app-service';
import { logger } from '@/lib/logger';

/**
 * GET /api/apps/search — Full-text search
 * Query params: q, category, limit
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const category = searchParams.get('category') || undefined;
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!q) {
        return NextResponse.json({ apps: [], total: 0 });
    }

    try {
        const result = await AppService.searchApps(q, category, limit);

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
