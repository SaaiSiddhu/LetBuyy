import { NextRequest, NextResponse } from 'next/server';
import { constructWebhookEvent } from '@/lib/stripe';
import { db } from '@/lib/supabase';

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
                const orderId = session.metadata?.orderId;

                if (orderId) {
                    // Update order payment status
                    const { error } = await db
                        .from('orders')
                        .update({
                            payment_status: 'paid',
                            payment_id: session.payment_intent as string,
                            status: 'confirmed',
                        })
                        .eq('id', orderId);

                    if (error) {
                        console.error('[Stripe Webhook] Order update failed:', error.message);
                    } else {
                        console.log(`[Stripe Webhook] Order ${orderId} marked as paid`);
                    }
                }
                break;
            }

            case 'checkout.session.expired': {
                const session = event.data.object;
                const orderId = session.metadata?.orderId;

                if (orderId) {
                    await db
                        .from('orders')
                        .update({ payment_status: 'failed', status: 'cancelled' })
                        .eq('id', orderId);

                    console.log(`[Stripe Webhook] Order ${orderId} cancelled (session expired)`);
                }
                break;
            }

            default:
                console.log(`[Stripe Webhook] Unhandled event: ${event.type}`);
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error('[Stripe Webhook] Error:', error);
        return NextResponse.json(
            { error: 'Webhook processing failed' },
            { status: 400 }
        );
    }
}
