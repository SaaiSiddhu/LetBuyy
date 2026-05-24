import { NextRequest, NextResponse } from 'next/server';
import { createPayPalOrder } from '@/lib/paypal';
import { attachPaymentReference, loadStorefrontPayableOrder } from '@/lib/payment-order';
import { WorkerRequestError } from '@/lib/worker-client';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const {
            orderId,
            storeId,
            returnUrl,
            cancelUrl,
            idempotencyKey,
        } = body;

        if (!orderId || !storeId || !returnUrl || !cancelUrl || !idempotencyKey) {
            return NextResponse.json(
                { error: 'Missing required fields: orderId, storeId, returnUrl, cancelUrl, idempotencyKey' },
                { status: 400 }
            );
        }

        const order = await loadStorefrontPayableOrder(orderId, storeId);
        const result = await createPayPalOrder({
            orderId,
            storeId,
            amount: order.total,
            currency: 'INR',
            returnUrl,
            cancelUrl,
            idempotencyKey,
        });

        await attachPaymentReference({
            orderId,
            provider: 'paypal',
            paymentReference: result.id,
            idempotencyKey,
        });

        return NextResponse.json({
            success: true,
            paypalOrderId: result.id,
            approvalUrl: result.approvalUrl,
        });
    } catch (error) {
        if (error instanceof WorkerRequestError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }

        if (error instanceof Error && error.message.includes('[PayPal]')) {
            return NextResponse.json({ error: 'PayPal is not configured' }, { status: 503 });
        }

        return NextResponse.json(
            { error: 'Failed to create PayPal order' },
            { status: 500 }
        );
    }
}
