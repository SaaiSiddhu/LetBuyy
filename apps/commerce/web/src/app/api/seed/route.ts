import { NextRequest, NextResponse } from 'next/server';

/**
 * Runtime seeding is disabled for production safety.
 * Theme/package registration must be handled by migrations or controlled
 * scripts, not a public storefront API route.
 */
export async function GET(request: NextRequest) {
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Not available' }, { status: 404 });
    }

    if (process.env.SEED_SECRET && request.headers.get('x-seed-secret') !== process.env.SEED_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(
        {
            success: false,
            error: 'Runtime seed endpoint is disabled. Use controlled migration or script seeding.',
        },
        { status: 410 }
    );
}
