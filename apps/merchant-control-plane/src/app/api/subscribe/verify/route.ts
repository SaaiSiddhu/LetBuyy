import { NextRequest, NextResponse } from 'next/server'
import { readWorkerJson, workerErrorResponse, workerFetch } from '@/lib/api/worker-client'

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
        const response = await workerFetch('/payments/subscription/verify', {
            method: 'POST',
            body: JSON.stringify(body),
        })
        const payload = await readWorkerJson(response)

        return NextResponse.json({
            success: true,
            subscription: payload.data?.subscription,
            message: payload.data?.message || 'Subscription activated',
        })
    } catch (err) {
        return workerErrorResponse(err, 'Unable to verify subscription payment')
    }
}
