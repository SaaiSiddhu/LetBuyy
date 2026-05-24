import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/paypal';
import { markOrderPaid, markOrderPaymentFailed } from '@/lib/payment-order';

export async function POST(request: NextRequest) {
    try {
        const rawBody = await request.text();

        // Collect PayPal webhook headers
        const headers: Record<string, string> = {};
        ['paypal-auth-algo', 'paypal-cert-url', 'paypal-transmission-id', 'paypal-transmission-sig', 'paypal-transmission-time'].forEach(h => {
            const val = request.headers.get(h);
            if (val) headers[h] = val;
        });

        // Verify webhook signature
        const isValid = await verifyWebhookSignature({ body: rawBody, headers });
        if (!isValid) {
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }

        const event = JSON.parse(rawBody);
        const eventType = event.event_type;

        switch (eventType) {
            case 'PAYMENT.CAPTURE.COMPLETED': {
                const capture = event.resource;
                const orderId = capture.custom_id; // We set this during order creation

                if (orderId) {
                    await markOrderPaid({
                        orderId,
                        provider: 'paypal',
                        paymentId: capture.id,
                        idempotencyKey: event.id || capture.id,
                    });
                }
                break;
            }

            case 'PAYMENT.CAPTURE.DENIED':
            case 'PAYMENT.CAPTURE.REFUNDED': {
                const capture = event.resource;
                const orderId = capture.custom_id;

                if (orderId) {
                    const newStatus = eventType === 'PAYMENT.CAPTURE.DENIED' ? 'failed' : 'refunded';
                    await markOrderPaymentFailed({
                        orderId,
                        provider: 'paypal',
                        providerEventId: event.id || capture.id,
                        paymentStatus: newStatus,
                        orderStatus: eventType === 'PAYMENT.CAPTURE.DENIED' ? 'cancelled' : 'refunded',
                        reason: eventType,
                        releaseInventory: eventType === 'PAYMENT.CAPTURE.DENIED',
                        idempotencyKey: event.id || capture.id,
                    });
                }
                break;
            }

            default:
                break;
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        return NextResponse.json(
            { error: 'Webhook processing failed' },
            { status: 400 }
        );
    }
}
