import { NextRequest, NextResponse } from 'next/server'
import { merchantApiFetch, merchantApiErrorResponse } from '@/lib/api/client'
import { merchantSecurityScope, privateSecurityResponse } from '@/lib/api/merchant-security-scope'

// POST /api/stores/:store/payouts/:payoutId/settle → POST /payouts/:id/settle with X-Step-Up-Token
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ store: string; payoutId: string }> }
) {
    try {
        const { payoutId } = await params
        const resolved = await merchantSecurityScope(request, params)
        if (resolved.error) return resolved.error

        const body = await request.json() as {
            idempotency_key: string
            step_up_token: string
            step_up_verified_at: string
        }

        if (body.idempotency_key !== request.headers.get('X-Idempotency-Key')) return privateSecurityResponse(NextResponse.json({ error: { code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'The command keys must match.' } }, { status: 400 }))

        const settleHeaders: Record<string, string> = { ...resolved.headers }
        if (body.step_up_token) settleHeaders['X-Step-Up-Token'] = body.step_up_token
        if (body.step_up_verified_at) settleHeaders['X-Step-Up-Verified-At'] = body.step_up_verified_at

        const response = await merchantApiFetch(`/payouts/${encodeURIComponent(payoutId)}/settle`, {
            method: 'POST',
            requireSession: true,
            headers: settleHeaders,
            body: JSON.stringify({ idempotency_key: body.idempotency_key }),
        })
        const payload = await response.json().catch(() => null)
        return privateSecurityResponse(NextResponse.json(payload, { status: response.status }))
    } catch (err) {
        return privateSecurityResponse(merchantApiErrorResponse(err, 'Payout release failed'))
    }
}
