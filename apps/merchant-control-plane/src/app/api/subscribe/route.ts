import { NextRequest, NextResponse } from 'next/server'
import type { CreateSubscriptionOrderInput } from '@letbuyy/api-client'
import { createWorkerApiClient, workerErrorResponse } from '@/lib/api/worker-client'

/**
 * POST /api/subscribe
 *
 * Thin admin proxy for worker-owned subscription payment order creation.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const payload = await createWorkerApiClient().payments.subscription.createOrder(body as CreateSubscriptionOrderInput)

        return NextResponse.json(payload)
    } catch (err) {
        return workerErrorResponse(err, 'Unable to create subscription order')
    }
}
