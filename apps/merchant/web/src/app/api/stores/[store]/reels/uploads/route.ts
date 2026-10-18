import { NextRequest, NextResponse } from 'next/server'
import { REEL_UPLOAD_METADATA_BYTES, ReelUploadBeginSchema } from '@letbuyy/shared-types'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { validateMerchantMutationRequest } from '@/lib/api/request-origin'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

export const dynamic = 'force-dynamic'
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
export async function GET(request: NextRequest, { params }: { params: Promise<{ store: string }> }) {
    try {
        const { store } = await params, scope = await intakeScope(request, store)
        if (scope.error) return scope.error
        const data = request.nextUrl.searchParams.get('capabilities') === 'true'
            ? await scope.client!.reels.uploadCapabilities(scope.siteId!) : await scope.client!.reels.uploadList(scope.siteId!)
        return NextResponse.json({ data }, { headers: { 'Cache-Control': 'private, no-store' } })
    } catch (error) { return intakeError(error) }
}
export async function POST(request: NextRequest, { params }: { params: Promise<{ store: string }> }) {
    const denied = validateMerchantMutationRequest(request); if (denied) return denied
    try {
        const { store } = await params, scope = await intakeScope(request, store)
        if (scope.error) return scope.error
        const parsed = ReelUploadBeginSchema.safeParse(await intakeJson(request))
        if (!parsed.success || request.headers.get('X-Idempotency-Key') !== parsed.data.idempotency_key) return intakeFailure(400)
        return NextResponse.json({ data: await scope.client!.reels.uploadBegin(scope.siteId!, parsed.data) }, { status: 201, headers: { 'Cache-Control': 'private, no-store' } })
    } catch (error) { return intakeError(error) }
}
