import { NextRequest, NextResponse } from 'next/server'
import { merchantApiFetch, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

// GET /api/stores/:store/payouts → GET /payouts?store_id=...&status=...&limit=...
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const searchParams = request.nextUrl.searchParams
        const query = new URLSearchParams({ store_id: resolved.storeId })
        if (searchParams.get('status')) query.set('status', searchParams.get('status')!)
        if (searchParams.get('limit')) query.set('limit', searchParams.get('limit')!)

        const response = await merchantApiFetch(`/payouts?${query.toString()}`, { requireSession: true })
        const payload = await response.json().catch(() => null)
        return NextResponse.json(payload, { status: response.status })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to load payouts')
    }
}
