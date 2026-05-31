import { NextRequest, NextResponse } from 'next/server';
import { createStorefrontApiClient, WorkerRequestError } from '@/lib/worker-client';

function getWorkerErrorMessage(payload: unknown, fallback: string) {
    if (payload && typeof payload === 'object') {
        const error = (payload as { error?: unknown }).error;
        if (typeof error === 'string') return error;
        if (error && typeof error === 'object') {
            const message = (error as { message?: unknown }).message;
            if (typeof message === 'string') return message;
        }
        const message = (payload as { message?: unknown }).message;
        if (typeof message === 'string') return message;
    }

    return fallback;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const {
            subdomain,
            customer,
            items,
            paymentMethod,
        } = body;
        const idempotencyKey = body.idempotencyKey || body.idempotency_key;

        if (!subdomain || !customer || !items || !idempotencyKey) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        const payload = await createStorefrontApiClient().storefront.createOrder(subdomain, {
            customer,
            items,
            paymentMethod: paymentMethod || 'razorpay',
            deliveryOption: body.deliveryOption || body.delivery_option || 'standard',
            notes: body.notes,
            couponCode: body.couponCode || body.coupon_code,
            giftCardCode: body.giftCardCode || body.gift_card_code,
            idempotencyKey,
        });
        const order = payload.order;

        if (!order) {
            return NextResponse.json(
                { success: false, error: 'Order creation failed' },
                { status: 502 }
            );
        }

        return NextResponse.json({
            success: true,
            order,
        }, { status: 201 });

    } catch (error) {
        if (error instanceof WorkerRequestError) {
            return NextResponse.json(
                {
                    success: false,
                    error: getWorkerErrorMessage(error.payload, error.message),
                },
                { status: error.status }
            );
        }

        return NextResponse.json(
            { success: false, error: 'Failed to create order' },
            { status: 500 }
        );
    }
}
