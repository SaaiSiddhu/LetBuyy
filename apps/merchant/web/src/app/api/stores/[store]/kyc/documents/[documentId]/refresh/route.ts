import { NextRequest, NextResponse } from 'next/server'
import { merchantApiFetch, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

// POST /api/stores/:store/kyc/documents/:documentId/refresh
//   → POST /kyc/documents/:documentId/refresh?store_id=...
// store_id (query) + X-Idempotency-Key (header) satisfy the gateway's
// protected-mutation idempotency middleware for this body-less mutation.
export async function POST(
    _request: NextRequest,
    { params }: { params: Promise<{ store: string; documentId: string }> }
) {
    try {
        const { store, documentId } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const query = new URLSearchParams({ store_id: resolved.storeId })
        const response = await merchantApiFetch(
            `/kyc/documents/${encodeURIComponent(documentId)}/refresh?${query.toString()}`,
            {
                method: 'POST',
                requireSession: true,
                headers: { 'X-Idempotency-Key': crypto.randomUUID() },
            }
        )
        const payload = await response.json().catch(() => null)
        return NextResponse.json(payload, { status: response.status })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to refresh verification status')
    }
}
