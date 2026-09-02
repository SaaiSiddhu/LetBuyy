// V1 LB-7: storefront-runtime proxy for store shipping rates.
// Proxies POST /v1/shipping/rates on the gateway using the internal API secret so
// the storefront checkout can display real merchant-configured rates.
// The caller (checkout-client.tsx) passes { store_id, pincode, subtotal_minor }.

import { NextRequest, NextResponse } from 'next/server';
import { internalStorefrontApiFetch } from '@/lib/api/client';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => null);

        if (!body?.store_id) {
            return NextResponse.json(
                { success: false, error: 'store_id is required' },
                { status: 400 },
            );
        }

        const response = await internalStorefrontApiFetch('/v1/shipping/rates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                store_id: body.store_id,
                pincode: body.pincode || '000000',
                subtotal_minor: typeof body.subtotal_minor === 'number' ? body.subtotal_minor : 0,
            }),
        });

        const payload = await response.json().catch(() => null);
        return NextResponse.json(payload, { status: response.status });
    } catch {
        return NextResponse.json(
            { success: false, error: 'Unable to load shipping rates' },
            { status: 500 },
        );
    }
}
