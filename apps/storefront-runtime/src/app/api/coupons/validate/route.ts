// ============================================================
// COUPON VALIDATION API — Worker proxy for checkout coupon checks
// GET /api/coupons/validate?code=...&storeId=...&subtotal=...
// Optional: subdomain=...
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createStorefrontApiClient } from '@/lib/worker-client';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const code = searchParams.get('code')?.trim();
        const storeId = searchParams.get('storeId')?.trim();
        const subdomain = searchParams.get('subdomain')?.trim();
        const subtotal = searchParams.get('subtotal') || '0';

        if (!code || (!storeId && !subdomain)) {
            return NextResponse.json({ valid: false, error: 'Code and store context required' }, { status: 400 });
        }

        const client = createStorefrontApiClient();
        const data = subdomain
            ? await client.storefront.validateCoupon(subdomain, { code, subtotal })
            : await client.storefront.validateCouponByStoreId(storeId || '', { code, subtotal });

        return NextResponse.json(data);
    } catch {
        return NextResponse.json({ valid: false, error: 'Validation failed' }, { status: 500 });
    }
}
