import { NextRequest, NextResponse } from 'next/server';
import { readWorkerJson, workerFetch } from '@/lib/worker-client';

export async function GET(req: NextRequest) {
    const query = req.nextUrl.searchParams.get('q')?.trim().toLowerCase();

    if (!query || query.length < 3) {
        return NextResponse.json({
            status: 'invalid',
            message: 'Store name must be at least 3 characters',
        });
    }

    if (!/^[a-zA-Z0-9-]+$/.test(query)) {
        return NextResponse.json({
            status: 'invalid',
            message: 'Store name can only contain letters, numbers, and hyphens',
        });
    }

    try {
        const response = await workerFetch(`/storefront/lookup?q=${encodeURIComponent(query)}`);
        const payload = await readWorkerJson(response);
        return NextResponse.json(payload?.data || { status: 'not_found' });
    } catch (err) {
        console.error('[store-lookup] Worker proxy error:', err);
        return NextResponse.json({ status: 'not_found' });
    }
}
