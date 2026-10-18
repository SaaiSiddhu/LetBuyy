import { NextRequest, NextResponse } from 'next/server'
import { merchantApiFetch, merchantApiErrorResponse } from '@/lib/api/client'
import { merchantSecurityScope, privateSecurityResponse } from '@/lib/api/merchant-security-scope'

// POST /api/stores/:store/orders/:orderId/refund
// Resolves the canonical refund payment UUID from the owned order, then calls POST /payments/:paymentId/refund with X-Step-Up-Token.
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ store: string; orderId: string }> }
) {
    try {
        const { orderId } = await params
        const resolved = await merchantSecurityScope(request, params)
        if (resolved.error) return resolved.error

        const body = await request.json() as {
            amount_minor?: number
            reason?: string
            provider_refund_id?: string
            idempotency_key: string
            step_up_token: string
            step_up_verified_at: string
        }

        if (body.idempotency_key !== request.headers.get('X-Idempotency-Key')) return privateSecurityResponse(NextResponse.json({ error: { code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'The command keys must match.' } }, { status: 400 }))

        // Resolve the owned order first; legacy payment_id can be a provider reference.
        const orderResponse = await merchantApiFetch(`/orders/${encodeURIComponent(orderId)}`, {
            requireSession: true,
            headers: resolved.headers,
        })
        if (!orderResponse.ok) {
            const errPayload = await orderResponse.json().catch(() => null)
            return NextResponse.json(errPayload ?? { error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' } }, { status: orderResponse.status })
        }
        const orderPayload = await orderResponse.json().catch(() => null) as {
            data?: { id?: string; refund_payment_id?: string | null; refund_payment_resolution?: string; store_id?: string }
        } | null
        const paymentId = orderPayload?.data?.refund_payment_id
        if (!paymentId) {
            return NextResponse.json(
                { error: { code: 'PAYMENT_NOT_FOUND', message: orderPayload?.data?.refund_payment_resolution === 'ambiguous' ? 'Multiple captured payment records need reconciliation before a refund.' : 'No captured canonical payment record is linked to this order.' } },
                { status: 422 }
            )
        }

        // Step 2: call gateway refund endpoint with step-up headers
        const refundHeaders: Record<string, string> = { ...resolved.headers }
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
        return privateSecurityResponse(NextResponse.json(refundPayload, { status: refundResponse.status }))
    } catch (err) {
        return privateSecurityResponse(merchantApiErrorResponse(err, 'Refund failed'))
    }
}
