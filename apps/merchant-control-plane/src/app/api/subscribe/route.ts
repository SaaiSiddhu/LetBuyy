import { NextRequest, NextResponse } from 'next/server'
import { readWorkerJson, workerErrorResponse, workerFetch } from '@/lib/api/worker-client'

/**
 * POST /api/subscribe
 *
 * Thin admin proxy for worker-owned subscription payment order creation.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const response = await workerFetch('/payments/subscription/order', {
            method: 'POST',
            body: JSON.stringify(body),
        })
        const payload = await readWorkerJson(response)

        return NextResponse.json(payload.data)
    } catch (err) {
        return workerErrorResponse(err, 'Unable to create subscription order')
    }
}
