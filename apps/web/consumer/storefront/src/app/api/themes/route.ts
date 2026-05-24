import { NextResponse } from 'next/server';
import { readWorkerJson, workerFetch } from '@/lib/worker-client';

/**
 * GET /api/themes — Storefront-facing theme catalog proxy.
 * The catalog source of truth is the worker/database theme package registry.
 */

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const slug = searchParams.get('slug');
        const workerPath = slug
            ? `/themes/${encodeURIComponent(slug)}`
            : `/themes?${toWorkerSearchParams(searchParams).toString()}`;
        const response = await workerFetch(workerPath);
        const payload = await readWorkerJson(response);

        if (slug) {
            return NextResponse.json({
                success: true,
                theme: payload.data ?? null,
            });
        }

        const data = Array.isArray(payload.data) ? payload.data : [];
        return NextResponse.json({
            success: true,
            themes: data,
            total: payload.meta?.total ?? data.length,
            meta: payload.meta ?? null,
        });
    } catch (error) {
        console.error('Themes API error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch themes' },
            { status: 500 }
        );
    }
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
