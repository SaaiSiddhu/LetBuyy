import { NextRequest, NextResponse } from 'next/server';
import { createCheckoutSession } from '@/lib/stripe';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const {
            orderId,
            storeId,
            amount,
            currency = 'inr',
            customerEmail,
            storeName,
            successUrl,
            cancelUrl,
        } = body;

        if (!orderId || !storeId || !amount || !customerEmail || !successUrl || !cancelUrl) {
            return NextResponse.json(
                { error: 'Missing required fields: orderId, storeId, amount, customerEmail, successUrl, cancelUrl' },
                { status: 400 }
            );
        }

        const session = await createCheckoutSession({
            orderId,
            storeId,
            amount,
            currency,
            customerEmail,
            storeName,
            successUrl,
            cancelUrl,
        });

        return NextResponse.json({
            success: true,
            sessionId: session.id,
            url: session.url,
        });
    } catch (error) {
        console.error('[Stripe Checkout] Error:', error);
        return NextResponse.json(
            { error: 'Failed to create checkout session' },
            { status: 500 }
        );
    }
}
