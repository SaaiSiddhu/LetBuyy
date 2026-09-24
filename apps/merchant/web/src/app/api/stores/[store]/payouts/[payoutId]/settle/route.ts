import { NextRequest, NextResponse } from 'next/server'
import { merchantApiFetch, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

// POST /api/stores/:store/payouts/:payoutId/settle → POST /payouts/:id/settle with X-Step-Up-Token
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ store: string; payoutId: string }> }
) {
    try {
        const { store, payoutId } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const body = await request.json() as {
            idempotency_key: string
            step_up_token: string
            step_up_verified_at: string
        }

        const settleHeaders: Record<string, string> = {}
        if (body.step_up_token) settleHeaders['X-Step-Up-Token'] = body.step_up_token
        if (body.step_up_verified_at) settleHeaders['X-Step-Up-Verified-At'] = body.step_up_verified_at

        const response = await merchantApiFetch(`/payouts/${encodeURIComponent(payoutId)}/settle`, {
            method: 'POST',
            requireSession: true,
            headers: settleHeaders,
            body: JSON.stringify({ idempotency_key: body.idempotency_key }),
        })
        const payload = await response.json().catch(() => null)
        return NextResponse.json(payload, { status: response.status })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Payout release failed')
    }
}
