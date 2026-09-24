import { NextRequest, NextResponse } from 'next/server'
import { merchantApiFetch, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

// POST /api/stores/:store/orders/:orderId/refund
// Resolves payment_id from order, then calls POST /payments/:paymentId/refund with X-Step-Up-Token.
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ store: string; orderId: string }> }
) {
    try {
        const { store, orderId } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const body = await request.json() as {
            amount_minor?: number
            reason?: string
            provider_refund_id?: string
            idempotency_key: string
            step_up_token: string
            step_up_verified_at: string
        }

        // Step 1: resolve order to find payment_id (the gateway GET /orders/:id returns payment_id in the order row)
        const orderResponse = await merchantApiFetch(`/orders/${encodeURIComponent(orderId)}`, {
            requireSession: true,
        })
        if (!orderResponse.ok) {
            const errPayload = await orderResponse.json().catch(() => null)
            return NextResponse.json(errPayload ?? { error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' } }, { status: orderResponse.status })
        }
        const orderPayload = await orderResponse.json().catch(() => null) as {
            data?: { id?: string; payment_id?: string; store_id?: string }
        } | null
        const paymentId = orderPayload?.data?.payment_id
        if (!paymentId) {
            return NextResponse.json(
                { error: { code: 'PAYMENT_NOT_FOUND', message: 'No payment record is linked to this order.' } },
                { status: 422 }
            )
        }

        // Step 2: call gateway refund endpoint with step-up headers
        const refundHeaders: Record<string, string> = {}
        if (body.step_up_token) refundHeaders['X-Step-Up-Token'] = body.step_up_token
        if (body.step_up_verified_at) refundHeaders['X-Step-Up-Verified-At'] = body.step_up_verified_at

        const refundResponse = await merchantApiFetch(`/payments/${encodeURIComponent(paymentId)}/refund`, {
            method: 'POST',
            requireSession: true,
            headers: refundHeaders,
            body: JSON.stringify({
                idempotency_key: body.idempotency_key,
                ...(body.amount_minor != null ? { amount_minor: body.amount_minor } : {}),
                ...(body.reason ? { reason: body.reason } : {}),
                ...(body.provider_refund_id ? { provider_refund_id: body.provider_refund_id } : {}),
            }),
        })
        const refundPayload = await refundResponse.json().catch(() => null)
        return NextResponse.json(refundPayload, { status: refundResponse.status })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Refund failed')
    }
}
