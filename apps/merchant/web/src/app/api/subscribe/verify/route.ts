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
        if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.expected_actor_id !== 'string') {
            return NextResponse.json({error: {code: 'CHECKOUT_ACTOR_REQUIRED', message: 'Reload checkout before continuing.'}}, {status: 400})
        }
        const {expected_actor_id, ...checkoutBody} = body
        const client = createMerchantApiClient()
        const session = await client.auth.session()
        if (!session.authenticated || !session.user) {
            return NextResponse.json({error: {code: 'UNAUTHORIZED', message: 'Sign in before continuing checkout.'}}, {status: 401})
        }
        if (session.user.id !== expected_actor_id) {
            return NextResponse.json({error: {code: 'CHECKOUT_ACCOUNT_CHANGED', message: 'Your account changed. Reopen checkout in the current account.'}}, {status: 409})
        }
        const payload = await client.payments.subscription.verify(checkoutBody as VerifySubscriptionInput, {
            idempotencyKey: request.headers.get('X-Idempotency-Key'),
        })

        return NextResponse.json({
            success: true,
            subscription: payload.subscription,
            message: payload.message || 'Subscription activated',
        })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to verify subscription payment')
    }
}
