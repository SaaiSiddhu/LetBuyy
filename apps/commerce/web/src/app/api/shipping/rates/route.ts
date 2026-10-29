import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { StorefrontDeliveryOptionsSchema } from '@letbuyy/checkout-core';
import { StorefrontShippingOptionsSchema } from '@letbuyy/shared-types';
import { storefrontApiFetch } from '@/lib/api/client';

const InputSchema = StorefrontDeliveryOptionsSchema.extend({ subdomain: z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/) });
const headers = { 'Cache-Control': 'no-store' };
export async function POST(request: NextRequest) {
    if (request.headers.get('origin') !== request.nextUrl.origin) return NextResponse.json({ error: 'Request origin is not allowed' }, { status: 403, headers });
    const raw = await request.text().catch(() => '');
    if (new TextEncoder().encode(raw).length > 32768) return NextResponse.json({ error: 'Request is too large' }, { status: 413, headers });
    let body: unknown; try { body = JSON.parse(raw); } catch { body = null; }
    const input = InputSchema.safeParse(body);
    if (!input.success) return NextResponse.json({ error: 'A valid delivery address and cart items are required' }, { status: 400, headers });
    const { subdomain, ...command } = input.data;
    try {
        const response = await storefrontApiFetch(`/storefront/${encodeURIComponent(subdomain)}/shipping-rates`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(command), cache: 'no-store',
        });
        const payload = await response.json().catch(() => null);
        const rates = response.ok ? StorefrontShippingOptionsSchema.safeParse(payload?.data?.rates) : null;
        if (rates?.success) return NextResponse.json({ success: true, data: { rates: rates.data,
            serviceability: { serviceable: rates.data.length > 0, source: 'seller_zone_configuration', carrier_confirmed: false } } }, { headers });
        const code = payload?.error?.code;
        if (code === 'CHECKOUT_SHIPPING_PROFILE_SPLIT_REQUIRED') return NextResponse.json({ error: { code,
            message: 'These items use different delivery profiles. Place a separate order for each profile.' } }, { status: 409, headers });
        if (code === 'CHECKOUT_SHIPPING_WEIGHT_REQUIRED') return NextResponse.json({ error: { code,
            message: 'The store needs to complete product shipping weights before delivery can be quoted. Please contact the store.' } }, { status: 503, headers });
    } catch { /* sanitized retryable failure below */ }
    return NextResponse.json({ error: { message: 'Delivery for these items could not be verified. Please contact the store or retry.' } }, { status: 503, headers });
}
