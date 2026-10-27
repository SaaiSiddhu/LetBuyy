import { NextRequest, NextResponse } from 'next/server';
import { createStorefrontApiClient } from '@/lib/api/client';

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
        const data = await createStorefrontApiClient().storefront.lookup({ q: query });
        return NextResponse.json(data || { status: 'not_found' }, { headers: { 'Cache-Control': 'no-store' } });
    } catch {
        console.error(JSON.stringify({ event: 'storefront.lookup_unavailable' }));
        return NextResponse.json({ status: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
}
