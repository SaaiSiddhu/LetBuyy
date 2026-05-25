import { NextRequest, NextResponse } from 'next/server';
import { constructWebhookEvent } from '@/lib/stripe';
import { markOrderPaid, markOrderPaymentFailed } from '@/lib/payment-order';

export async function POST(request: NextRequest) {
    try {
        const rawBody = await request.text();
        const signature = request.headers.get('stripe-signature');

        if (!signature) {
            return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
        }

        const event = constructWebhookEvent(rawBody, signature);

        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object;
                const orderId = session.metadata?.order_id || session.metadata?.orderId;

                if (orderId) {
                    await markOrderPaid({
                        orderId,
                        provider: 'stripe',
                        paymentId: String(session.payment_intent || session.id),
                        idempotencyKey: event.id,
                    });
                }
                break;
            }

            case 'checkout.session.expired': {
                const session = event.data.object;
                const orderId = session.metadata?.order_id || session.metadata?.orderId;

                if (orderId) {
                    await markOrderPaymentFailed({
                        orderId,
                        provider: 'stripe',
                        providerEventId: event.id,
                        paymentStatus: 'failed',
                        orderStatus: 'cancelled',
                        reason: 'Stripe checkout session expired',
                        releaseInventory: true,
                        idempotencyKey: event.id,
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
