import { NextResponse } from 'next/server';
import { createStorefrontApiClient } from '@/lib/api/client';

/**
 * GET /api/themes — Storefront-facing theme catalog proxy.
 * The catalog source of truth is the worker/database theme package registry.
 */

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const slug = searchParams.get('slug');
        const client = createStorefrontApiClient();

        if (slug) {
            const theme = await client.themes.get(slug);
            return NextResponse.json({
                success: true,
                theme,
            });
        }

        const catalog = await client.themes.listCatalog(toThemeQuery(searchParams));
        return NextResponse.json({
            success: true,
            themes: catalog.data,
            total: catalog.total,
            meta: {
                total: catalog.total,
                page: catalog.page,
                per_page: catalog.limit,
                has_next: catalog.has_more,
            },
        });
    } catch (error) {
        console.error('Themes API error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch themes' },
            { status: 500 }
        );
    }
}

function toThemeQuery(input: URLSearchParams): Record<string, string> {
    return Object.fromEntries(toWorkerSearchParams(input).entries());
}

function toWorkerSearchParams(input: URLSearchParams) {
    const params = new URLSearchParams(input);

    const siteType = params.get('siteType');
    if (siteType && !params.has('site_type')) {
        params.set('site_type', siteType);
        params.delete('siteType');
    }

    if (params.has('tag') && !params.has('search')) {
        params.set('search', params.get('tag') || '');
    }
    params.delete('tag');
    params.delete('slug');

    return params;
}
