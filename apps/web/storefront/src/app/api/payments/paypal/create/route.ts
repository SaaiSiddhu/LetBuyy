import { NextRequest, NextResponse } from 'next/server';
import { createPayPalOrder } from '@/lib/paypal';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const {
            orderId,
            storeId,
            amount,
            currency = 'INR',
            returnUrl,
            cancelUrl,
        } = body;

        if (!orderId || !storeId || !amount || !returnUrl || !cancelUrl) {
            return NextResponse.json(
                { error: 'Missing required fields: orderId, storeId, amount, returnUrl, cancelUrl' },
                { status: 400 }
            );
        }

        const result = await createPayPalOrder({
            orderId,
            storeId,
            amount,
            currency,
            returnUrl,
            cancelUrl,
        });

        return NextResponse.json({
            success: true,
            paypalOrderId: result.id,
            approvalUrl: result.approvalUrl,
        });
    } catch (error) {
        console.error('[PayPal Create] Error:', error);
        return NextResponse.json(
            { error: 'Failed to create PayPal order' },
            { status: 500 }
        );
    }
}
