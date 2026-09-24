import { NextResponse } from 'next/server';

/**
 * Storefront theme installation is intentionally blocked here.
 * Theme install/apply is a merchant mutation and must flow through the
 * authenticated admin proxy backed by the canonical Hono worker.
 */
export async function POST() {
    return NextResponse.json(
        {
            success: false,
            error: 'Theme installation must be performed from the authenticated admin API.',
        },
        { status: 410 }
    );
}
