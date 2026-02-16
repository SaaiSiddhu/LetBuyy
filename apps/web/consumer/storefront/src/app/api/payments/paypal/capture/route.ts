import { NextRequest, NextResponse } from 'next/server';
import { capturePayPalOrder } from '@/lib/paypal';
import { db } from '@/lib/supabase';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { paypalOrderId, orderId } = body;

        if (!paypalOrderId || !orderId) {
            return NextResponse.json(
                { error: 'Missing required fields: paypalOrderId, orderId' },
                { status: 400 }
            );
        }

        const result = await capturePayPalOrder(paypalOrderId);

        if (result.status === 'COMPLETED') {
            // Update the order as paid
            const { error } = await db
                .from('orders')
                .update({
                    payment_status: 'paid',
                    payment_id: result.captureId,
                    status: 'confirmed',
                })
                .eq('id', orderId);

            if (error) {
                console.error('[PayPal Capture] Order update failed:', error.message);
                return NextResponse.json({ error: 'Payment captured but order update failed' }, { status: 500 });
            }

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
        console.error('[PayPal Capture] Error:', error);
        return NextResponse.json(
            { error: 'Failed to capture PayPal payment' },
            { status: 500 }
        );
    }
}
