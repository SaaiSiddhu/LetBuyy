import { NextRequest, NextResponse } from 'next/server'
import { merchantApiFetch, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'
import { readDirectUploadJson } from '@/lib/kyc/direct-upload-json'

export async function POST(request: NextRequest, { params }: { params: Promise<{ store: string }> }) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error
        const key = request.headers.get('X-Idempotency-Key')
        if (!key || key.length < 8 || key.length > 160) return NextResponse.json({
            error: { code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'A valid idempotency key is required.' },
        }, { status: 400 })
        const input = await readDirectUploadJson(request)
        if (!input) return NextResponse.json({
            error: { code: 'KYC_INVALID_UPLOAD', message: 'The uploaded document could not be confirmed.' },
        }, { status: 400 })
        const response = await merchantApiFetch('/kyc/documents/upload-complete', {
            method: 'POST', requireSession: true,
            headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': key },
            body: JSON.stringify({ store_id: resolved.storeId,
                receipt_id: input.receipt_id, version_id: input.version_id }),
        })
        return NextResponse.json(await response.json().catch(() => null), { status: response.status })
    } catch (error) {
        return merchantApiErrorResponse(error, 'Unable to confirm private document upload')
    }
}
