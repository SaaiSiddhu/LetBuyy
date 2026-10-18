import { REEL_UPLOAD_METADATA_BYTES } from '@letbuyy/shared-types'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'
import { NextRequest, NextResponse } from 'next/server'
import { ReelUploadRetrySchema } from '@letbuyy/shared-types'
import { merchantApiFetch, readMerchantApiJson } from '@/lib/api/client'
import { validateMerchantMutationRequest } from '@/lib/api/request-origin'
const intakeFailure = (status: number, code = 'REEL_UPLOAD_REQUEST_INVALID') => NextResponse.json({ error: { code } }, { status, headers: { 'Cache-Control': 'private, no-store' } })
async function intakeScope(request: NextRequest, store: string) {
    const client = createMerchantApiClient(), session = await client.auth.session()
    if (!session.authenticated || !session.user) return { error: intakeFailure(401, 'UNAUTHORIZED') }
    if (request.headers.get('X-LetBuyy-Merchant-Context') !== session.user.id) return { error: intakeFailure(409, 'SESSION_CONTEXT_CHANGED') }
    const owned = await resolveOwnedStoreId(decodeURIComponent(store))
    if (owned.error) return { error: owned.error }
    return { client, siteId: owned.storeId! }
}
async function intakeJson(request: Request): Promise<unknown> {
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) throw intakeFailure(415)
    const reader = request.body?.getReader(); if (!reader) throw intakeFailure(400)
    const chunks: Uint8Array[] = []; let size = 0
    try {
        while (true) {
            const { done, value } = await reader.read(); if (done) break
            size += value.byteLength
            if (size > REEL_UPLOAD_METADATA_BYTES) { await reader.cancel(); throw intakeFailure(413) }
            chunks.push(value)
        }
    } finally { reader.releaseLock() }
    const bytes = new Uint8Array(size); let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) } catch { throw intakeFailure(400) }
}
function intakeError(error: unknown) { return error instanceof Response ? error : merchantApiErrorResponse(error, 'Unable to confirm private intake. Retry this same request.') }

export const dynamic = 'force-dynamic'
export async function PUT(request: NextRequest, { params }: { params: Promise<{ store: string; intentId: string }> }) {
    const denied = validateMerchantMutationRequest(request); if (denied) return denied
    try {
        const { store, intentId } = await params, scope = await intakeScope(request, store)
        if (scope.error) return scope.error
        const command = ReelUploadRetrySchema.safeParse({ idempotency_key: request.headers.get('X-Idempotency-Key'), expected_version: Number(request.headers.get('X-Reel-Upload-Version')) })
        if (!command.success || !request.body || request.headers.has('content-encoding')) return intakeFailure(400)
        const capabilities = await scope.client!.reels.uploadCapabilities(scope.siteId!)
        if (!capabilities.private_upload_enabled || capabilities.max_bytes === null) return intakeFailure(503, 'REEL_PRIVATE_INTAKE_UNAVAILABLE')
        const row = await scope.client!.reels.uploadGet(scope.siteId!, intentId)
        if (row.idempotency_key !== command.data.idempotency_key || row.size_bytes > capabilities.max_bytes) return intakeFailure(409)
        if (request.headers.get('content-type') !== row.content_type || !capabilities.accepted_types.includes(row.content_type)) return intakeFailure(415)
        const length = request.headers.get('content-length')
        if (length && (!/^[0-9]+$/.test(length) || Number(length) !== row.size_bytes)) return intakeFailure(400)
        let bytes = 0
        const bounded = request.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
            transform(chunk, controller) {
                bytes += chunk.byteLength
                if (bytes > row.size_bytes || bytes > capabilities.max_bytes!) throw new Error('Private intake body exceeds the reserved bytes')
                controller.enqueue(chunk)
            },
            flush() { if (bytes !== row.size_bytes) throw new Error('Private intake body does not match the reserved bytes') },
        }), { signal: request.signal })
        const init: RequestInit & { duplex: 'half'; requireSession: true } = {
            method: 'PUT', requireSession: true, duplex: 'half', body: bounded, signal: request.signal,
            headers: { 'Content-Type': row.content_type, 'X-Idempotency-Key': command.data.idempotency_key, 'X-Reel-Upload-Version': String(command.data.expected_version), ...(length ? { 'Content-Length': length } : {}) },
        }
        const response = await merchantApiFetch(`/reels/uploads/${encodeURIComponent(intentId)}/content?store_id=${encodeURIComponent(scope.siteId!)}`, init)
        return NextResponse.json(await readMerchantApiJson(response), { headers: { 'Cache-Control': 'private, no-store' } })
    } catch (error) { return intakeError(error) }
}
