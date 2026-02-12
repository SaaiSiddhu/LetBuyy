import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/paypal';
import { db } from '@/lib/supabase';

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
            console.error('[PayPal Webhook] Signature verification failed');
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }

        const event = JSON.parse(rawBody);
        const eventType = event.event_type;

        switch (eventType) {
            case 'PAYMENT.CAPTURE.COMPLETED': {
                const capture = event.resource;
                const orderId = capture.custom_id; // We set this during order creation

                if (orderId) {
                    await db
                        .from('orders')
                        .update({
                            payment_status: 'paid',
                            payment_id: capture.id,
                            status: 'confirmed',
                        })
                        .eq('id', orderId);

                    console.log(`[PayPal Webhook] Order ${orderId} marked as paid via capture ${capture.id}`);
                }
                break;
            }

            case 'PAYMENT.CAPTURE.DENIED':
            case 'PAYMENT.CAPTURE.REFUNDED': {
                const capture = event.resource;
                const orderId = capture.custom_id;

                if (orderId) {
                    const newStatus = eventType === 'PAYMENT.CAPTURE.DENIED' ? 'failed' : 'refunded';
                    await db
                        .from('orders')
                        .update({
                            payment_status: newStatus,
                            status: eventType === 'PAYMENT.CAPTURE.DENIED' ? 'cancelled' : 'refunded',
                        })
                        .eq('id', orderId);

                    console.log(`[PayPal Webhook] Order ${orderId} status: ${newStatus}`);
                }
                break;
            }

            default:
                console.log(`[PayPal Webhook] Unhandled event: ${eventType}`);
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error('[PayPal Webhook] Error:', error);
        return NextResponse.json(
            { error: 'Webhook processing failed' },
            { status: 400 }
        );
    }
}
