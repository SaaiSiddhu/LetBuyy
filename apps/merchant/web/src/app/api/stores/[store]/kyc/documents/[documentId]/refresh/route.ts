import { NextRequest, NextResponse } from 'next/server'
import { merchantApiFetch, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

// POST /api/stores/:store/kyc/documents/:documentId/refresh
//   → POST /kyc/documents/:documentId/refresh?store_id=...
// Preserve the browser's key so a retry of an ambiguous provider lookup
// reuses the same durable Gateway receipt.
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ store: string; documentId: string }> }
) {
    try {
        const { store, documentId } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error
        const key = request.headers.get('X-Idempotency-Key')
        if (!key || key.length < 8 || key.length > 160) return NextResponse.json({
            error: { code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'A valid idempotency key is required.' },
        }, { status: 400 })

        const query = new URLSearchParams({ store_id: resolved.storeId })
        const response = await merchantApiFetch(
            `/kyc/documents/${encodeURIComponent(documentId)}/refresh?${query.toString()}`,
            {
                method: 'POST',
                requireSession: true,
                headers: { 'X-Idempotency-Key': key },
            }
        )
        const payload = await response.json().catch(() => null)
        return NextResponse.json(payload, { status: response.status })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to refresh verification status')
    }
}
