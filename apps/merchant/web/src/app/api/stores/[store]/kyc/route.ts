import { NextRequest, NextResponse } from 'next/server'
import { merchantApiFetch, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

// GET /api/stores/:store/kyc → GET /kyc?store_id=...
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const query = new URLSearchParams({ store_id: resolved.storeId })
        const response = await merchantApiFetch(`/kyc?${query.toString()}`, { requireSession: true })
        const payload = await response.json().catch(() => null)
        return NextResponse.json(payload, { status: response.status })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to load verification status')
    }
}

// POST /api/stores/:store/kyc → POST /kyc/documents
// Body: { document_type, document_number_last4? }. Documents use private upload.
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
        if (body.file_url !== undefined || body.file_name !== undefined) {
            return NextResponse.json({ error: { code: 'KYC_LINK_NOT_ACCEPTED', message: 'Upload documents privately; document links are not accepted.' } }, { status: 400 })
        }

        const key = typeof body.idempotency_key === 'string' && body.idempotency_key
            ? body.idempotency_key : crypto.randomUUID()
        const response = await merchantApiFetch('/kyc/documents', {
            method: 'POST',
            requireSession: true,
            headers: { 'X-Idempotency-Key': key },
            body: JSON.stringify({
                store_id: resolved.storeId,
                document_type: body.document_type,
                document_number_last4: body.document_number_last4 || undefined,
                idempotency_key: key,
            }),
        })
        const payload = await response.json().catch(() => null)
        return NextResponse.json(payload, { status: response.status })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to submit verification document')
    }
}
