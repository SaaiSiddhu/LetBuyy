import { NextRequest, NextResponse } from 'next/server';
import { capturePayPalOrder } from '@/lib/paypal';
import { loadStorefrontPayableOrder, markOrderPaid } from '@/lib/payment-order';
import { WorkerRequestError } from '@/lib/worker-client';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { paypalOrderId, orderId, idempotencyKey } = body;

        if (!paypalOrderId || !orderId || !idempotencyKey) {
            return NextResponse.json(
                { error: 'Missing required fields: paypalOrderId, orderId, idempotencyKey' },
                { status: 400 }
            );
        }

        const order = await loadStorefrontPayableOrder(orderId);
        if (order.payment_id && order.payment_id !== paypalOrderId) {
            return NextResponse.json({ error: 'PayPal order does not match this checkout order' }, { status: 409 });
        }

        const result = await capturePayPalOrder(paypalOrderId);

        if (result.status === 'COMPLETED') {
            await markOrderPaid({ orderId, provider: 'paypal', paymentId: result.captureId, idempotencyKey });

            return NextResponse.json({
                success: true,
                captureId: result.captureId,
                status: result.status,
            });
        } else {
            return NextResponse.json({
                success: false,
                error: `PayPal capture status: ${result.status}`,
            }, { status: 400 });
        }
    } catch (error) {
        if (error instanceof WorkerRequestError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }

        if (error instanceof Error && error.message.includes('[PayPal]')) {
            return NextResponse.json({ error: 'PayPal is not configured' }, { status: 503 });
        }

        return NextResponse.json(
            { error: 'Failed to capture PayPal payment' },
            { status: 500 }
        );
    }
}
