import { NextRequest, NextResponse } from 'next/server';
import { readWorkerJson, WorkerRequestError, workerFetch } from '@/lib/worker-client';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
    try {
        const { orderId, subdomain, idempotencyKey } = await request.json();

        if (!orderId || !subdomain || !idempotencyKey) {
            return NextResponse.json(
                { error: 'Missing required fields: orderId, subdomain, idempotencyKey' },
                { status: 400 }
            );
        }

        const response = await workerFetch(
            `/storefront/${encodeURIComponent(subdomain)}/payments/razorpay/order`,
            {
                method: 'POST',
                body: JSON.stringify({ orderId, idempotencyKey }),
            }
        );
        const payload = await readWorkerJson(response);
        const data = payload?.data || {};

        return NextResponse.json({
            success: true,
            keyId: data.keyId,
            razorpayOrderId: data.razorpayOrderId,
            amount: data.amount,
            currency: data.currency || 'INR',
        });
    } catch (error) {
        if (error instanceof WorkerRequestError) {
            return NextResponse.json(
                { error: error.message },
                { status: error.status }
            );
        }

        return NextResponse.json(
            { error: 'Failed to create Razorpay order' },
            { status: 500 }
        );
    }
}
