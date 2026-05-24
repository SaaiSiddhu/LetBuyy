import { NextResponse } from 'next/server';

/**
 * Runtime seeding is disabled for production safety.
 * Theme/package registration must be handled by migrations or controlled
 * scripts, not a public storefront API route.
 */
export async function GET() {
    return NextResponse.json(
        {
            success: false,
            error: 'Runtime seed endpoint is disabled. Use controlled migration or script seeding.',
        },
        { status: 410 }
    );
}
