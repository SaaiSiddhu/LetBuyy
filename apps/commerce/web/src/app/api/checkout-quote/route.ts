import { NextRequest, NextResponse } from 'next/server';
import { StorefrontCheckoutQuoteSchema } from '@letbuyy/checkout-core';
import { CheckoutTotalsQuoteSchema } from '@letbuyy/shared-types';
import { storefrontApiFetch } from '@/lib/api/client';
import { isSameOriginRequest } from '@/lib/buyer-auth/flow';
import { z } from 'zod';

const RequestSchema = StorefrontCheckoutQuoteSchema.extend({ subdomain: z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/) });
const headers = { 'Cache-Control': 'no-store' };
export async function POST(request: NextRequest) {
    if (!isSameOriginRequest(request.headers, request.url)) return NextResponse.json({ error: { message: 'Request origin is not allowed.' } }, { status: 403, headers });
    const raw = await request.text().catch(() => '');
    if (new TextEncoder().encode(raw).length > 32_768) return NextResponse.json({ error: { message: 'Checkout request is too large.' } }, { status: 413, headers });
    let body: unknown;
    try { body = JSON.parse(raw); } catch { body = null; }
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: { message: 'Choose a valid delivery address and option.' } }, { status: 400, headers });
    const { subdomain, ...input } = parsed.data;
    try {
        const upstream = await storefrontApiFetch(`/storefront/${encodeURIComponent(subdomain)}/checkout-quote`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), cache: 'no-store',
        });
        const payload = await upstream.json().catch(() => null);
        if (!upstream.ok) {
            const setup = payload?.error?.code === 'CHECKOUT_TAX_SETUP_REQUIRED';
            return NextResponse.json({ error: { message: setup ? 'Tax setup for this order needs attention. Please contact the store before paying.' : 'The order total could not be verified. Please retry.' } }, { status: upstream.status === 409 ? 409 : 503, headers });
        }
        const quote = CheckoutTotalsQuoteSchema.safeParse(payload?.data?.quote);
        if (quote.success) return NextResponse.json({ success: true, data: { quote: quote.data } }, { headers });
    } catch { /* return a sanitized, retryable refusal */ }
    return NextResponse.json({ error: { message: 'The order total is temporarily unavailable. Please retry.' } }, { status: 503, headers });
}
