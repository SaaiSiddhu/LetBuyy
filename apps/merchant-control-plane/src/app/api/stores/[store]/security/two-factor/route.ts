import { NextRequest, NextResponse } from 'next/server'
import { merchantApiFetch, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

// GET /api/stores/:store/security/two-factor → GET /2fa (overview: factors + sessions)
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const response = await merchantApiFetch('/2fa', { requireSession: true })
        const payload = await response.json().catch(() => null)
        return NextResponse.json(payload, { status: response.status })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to load 2FA status')
    }
}
