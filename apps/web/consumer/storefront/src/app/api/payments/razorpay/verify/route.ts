import { NextRequest, NextResponse } from 'next/server';
import { readWorkerJson, WorkerRequestError, workerFetch } from '@/lib/worker-client';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
    try {
        const {
            orderId,
            subdomain,
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            idempotencyKey,
        } = await request.json();

        if (!orderId || !subdomain || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !idempotencyKey) {
            return NextResponse.json(
                { error: 'Missing required Razorpay verification fields' },
                { status: 400 }
            );
        }

        const response = await workerFetch(
            `/storefront/${encodeURIComponent(subdomain)}/payments/razorpay/verify`,
            {
                method: 'POST',
                body: JSON.stringify({
                    orderId,
                    razorpay_order_id,
                    razorpay_payment_id,
                    razorpay_signature,
                    idempotencyKey,
                }),
            }
        );
        await readWorkerJson(response);

        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof WorkerRequestError) {
            return NextResponse.json(
                { error: error.message },
                { status: error.status }
            );
        }

        return NextResponse.json(
            { error: 'Failed to verify Razorpay payment' },
            { status: 500 }
        );
    }
}
