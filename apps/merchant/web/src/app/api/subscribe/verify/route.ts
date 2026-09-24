import { NextRequest, NextResponse } from 'next/server'
import type { VerifySubscriptionInput } from '@letbuyy/api-client'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'

/**
 * POST /api/subscribe/verify
 *
 * Thin admin proxy for the worker-owned subscription verification flow.
 * The Hono worker verifies payment signatures, store ownership, plan state,
 * subscription activation, billing history, and trial status updates.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const payload = await createMerchantApiClient().payments.subscription.verify(body as VerifySubscriptionInput)

        return NextResponse.json({
            success: true,
            subscription: payload.subscription,
            message: payload.message || 'Subscription activated',
        })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to verify subscription payment')
    }
}
