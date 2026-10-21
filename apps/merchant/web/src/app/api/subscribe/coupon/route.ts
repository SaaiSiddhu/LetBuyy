import { NextRequest, NextResponse } from 'next/server'
import type { ValidateSubscriptionCouponInput } from '@letbuyy/api-client'
import { createMerchantApiClient, merchantApiErrorResponse, merchantApiReadSignal } from '@/lib/api/client'

/**
 * POST /api/subscribe/coupon
 *
 * Thin admin proxy for worker-owned subscription coupon validation (read-only
 * preview). The gateway computes the server-authoritative base amount and
 * returns the discount; the actual discount is re-applied server-side at order
 * creation, never trusted from the client.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const payload = await createMerchantApiClient().payments.subscription.coupon(body as ValidateSubscriptionCouponInput, { signal: merchantApiReadSignal(request.signal) })

        return NextResponse.json(payload)
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to validate coupon')
    }
}
