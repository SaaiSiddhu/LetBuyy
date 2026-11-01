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
            error: { code: 'KYC_INVALID_UPLOAD', message: 'Choose a valid document.' },
        }, { status: 400 })
        const body = JSON.stringify({
            store_id: resolved.storeId,
            document_type: input.document_type,
            document_number_last4: input.document_number_last4,
            content_type: input.content_type,
            byte_size: input.byte_size,
            sha256_hex: input.sha256_hex,
        })
        const response = await merchantApiFetch('/kyc/documents/upload-intent', {
            method: 'POST', requireSession: true,
            headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': key }, body,
        })
        return NextResponse.json(await response.json().catch(() => null), { status: response.status })
    } catch (error) {
        return merchantApiErrorResponse(error, 'Unable to prepare private document upload')
    }
}
