import { NextRequest, NextResponse } from 'next/server';
import { createCheckoutSession } from '@/lib/stripe';
import { attachPaymentReference, loadStorefrontPayableOrder } from '@/lib/payment-order';
import { WorkerRequestError } from '@/lib/worker-client';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const {
            orderId,
            storeId,
            currency = 'inr',
            customerEmail,
            storeName,
            successUrl,
            cancelUrl,
            idempotencyKey,
        } = body;

        if (!orderId || !storeId || !successUrl || !cancelUrl || !idempotencyKey) {
            return NextResponse.json(
                { error: 'Missing required fields: orderId, storeId, successUrl, cancelUrl, idempotencyKey' },
                { status: 400 }
            );
        }

        const order = await loadStorefrontPayableOrder(orderId, storeId);
        const checkoutEmail = order.customer_email || customerEmail;

        if (!checkoutEmail) {
            return NextResponse.json(
                { error: 'Customer email is required for Stripe checkout' },
                { status: 400 }
            );
        }

        const session = await createCheckoutSession({
            orderId,
            storeId,
            amount: order.total,
            currency,
            customerEmail: checkoutEmail,
            storeName,
            successUrl,
            cancelUrl,
            idempotencyKey,
        });

        await attachPaymentReference({
            orderId,
            provider: 'stripe',
            paymentReference: session.id,
            idempotencyKey,
        });

        return NextResponse.json({
            success: true,
            sessionId: session.id,
            url: session.url,
        });
    } catch (error) {
        if (error instanceof WorkerRequestError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }

        if (error instanceof Error && error.message.includes('STRIPE_SECRET_KEY')) {
            return NextResponse.json({ error: 'Stripe is not configured' }, { status: 503 });
        }

        return NextResponse.json(
            { error: 'Failed to create checkout session' },
            { status: 500 }
        );
    }
}
