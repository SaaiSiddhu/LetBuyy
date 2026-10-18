import { NextRequest, NextResponse } from 'next/server'
import type { CreateSubscriptionOrderInput } from '@letbuyy/api-client'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'

/**
 * POST /api/subscribe
 *
 * Thin admin proxy for worker-owned subscription payment order creation.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const payload = await createMerchantApiClient().payments.subscription.createOrder(body as CreateSubscriptionOrderInput, {
            idempotencyKey: request.headers.get('X-Idempotency-Key'),
        })

        return NextResponse.json(payload)
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to create subscription order')
    }
}
