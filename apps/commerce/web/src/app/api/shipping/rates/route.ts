// V1 LB-7: customer-web proxy for store shipping rates.
// Proxies POST /v1/shipping/rates on the gateway using the internal API secret so
// the storefront checkout can display real merchant-configured rates.
// The caller (checkout-client.tsx) passes { store_id, pincode, subtotal_minor }.

import { NextRequest, NextResponse } from 'next/server';
import { storefrontApiFetch } from '@/lib/api/client';

export async function POST(request: NextRequest) {
    try {
        if (request.headers.get('origin') !== request.nextUrl.origin) {
            return NextResponse.json({ success: false, error: 'Request origin is not allowed' }, { status: 403 });
        }
        const body = await request.json().catch(() => null);
        const subdomain = typeof body?.subdomain === 'string' ? body.subdomain : '';
        const pincode = typeof body?.pincode === 'string' ? body.pincode : '';
        const state = typeof body?.state === 'string' ? body.state : '';
        const stateCode = typeof body?.state_code === 'string' ? body.state_code : '';
        const subtotalMinor = body?.subtotal_minor;
        if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain)
            || !/^[1-9][0-9]{5}$/.test(pincode)
            || !state || state.length > 100
            || (stateCode && !/^[A-Z0-9]{1,3}$/.test(stateCode))
            || typeof subtotalMinor !== 'number' || !Number.isSafeInteger(subtotalMinor) || subtotalMinor < 0) {
            return NextResponse.json(
                { success: false, error: 'A valid delivery address and cart subtotal are required' },
                { status: 400 },
            );
        }

        const query = new URLSearchParams({ pincode, state, subtotal_minor: String(subtotalMinor) });
        if (stateCode) query.set('state_code', stateCode);
        const response = await storefrontApiFetch(`/storefront/${encodeURIComponent(subdomain)}/shipping-rates?${query}`, { cache: 'no-store' });

        const payload = await response.json().catch(() => null);
        return NextResponse.json(payload, { status: response.status });
    } catch {
        return NextResponse.json(
            { success: false, error: 'Unable to load shipping rates' },
            { status: 500 },
        );
    }
}
