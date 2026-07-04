import { NextRequest, NextResponse } from 'next/server'
import { merchantApiFetch, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

// GET /api/stores/:store/commission → GET /commission?store_id=...&limit=...
// Read-only fee/settlement transparency. LetBuyy platform commission is a
// governance-enforced permanent 0% (migration 162_phase_a_commission_zero).
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const query = new URLSearchParams({ store_id: resolved.storeId })
        const limit = request.nextUrl.searchParams.get('limit')
        if (limit) query.set('limit', limit)

        const response = await merchantApiFetch(`/commission?${query.toString()}`, { requireSession: true })
        const payload = await response.json().catch(() => null)
        return NextResponse.json(payload, { status: response.status })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to load fees and settlement details')
    }
}
