import { NextRequest, NextResponse } from 'next/server'
import { merchantApiFetch, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

const MAX_REQUEST_BYTES = 6 * 1024 * 1024

async function boundedForm(request: NextRequest): Promise<FormData | null> {
    if (!request.body) return null
    const reader = request.body.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    try {
        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            size += value.byteLength
            if (size > MAX_REQUEST_BYTES) { await reader.cancel(); return null }
            chunks.push(value)
        }
    } finally {
        reader.releaseLock()
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    return new Request(request.url, { method: 'POST', headers: { 'Content-Type': request.headers.get('content-type') || '' }, body: bytes }).formData()
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ store: string }> }) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error
        const length = Number(request.headers.get('content-length') || 0)
        if (length > MAX_REQUEST_BYTES) return NextResponse.json({ error: { code: 'KYC_FILE_TOO_LARGE', message: 'Choose a document under 5 MB.' } }, { status: 413 })
        const form = await boundedForm(request).catch(() => null)
        if (!form) return NextResponse.json({ error: { code: 'KYC_INVALID_UPLOAD', message: 'Choose a PDF, JPEG, or PNG under 5 MB.' } }, { status: 413 })
        // Construct the upstream body ourselves: a browser-supplied store ID is never trusted.
        const upstream = new FormData()
        upstream.set('store_id', resolved.storeId)
        const documentType = form.get('document_type')
        const last4 = form.get('document_number_last4')
        const file = form.get('file')
        if (typeof documentType === 'string') upstream.set('document_type', documentType)
        if (typeof last4 === 'string') upstream.set('document_number_last4', last4)
        if (file instanceof File) upstream.set('file', file)
        const response = await merchantApiFetch('/kyc/documents/upload', { method: 'POST', requireSession: true,
            headers: { 'X-Idempotency-Key': request.headers.get('x-idempotency-key') || crypto.randomUUID() }, body: upstream })
        return NextResponse.json(await response.json().catch(() => null), { status: response.status })
    } catch (error) {
        return merchantApiErrorResponse(error, 'Unable to upload verification document')
    }
}
