import { NextRequest, NextResponse } from 'next/server'
import { ReelMerchantCommandSchema, REEL_REVIEW_REQUEST_BYTES } from '@letbuyy/cms-core'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { validateMerchantMutationRequest } from '@/lib/api/request-origin'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

type Params = { params: Promise<{ store: string; reelId: string }> }
async function scope(request: NextRequest, params: Params['params']) {
    const client = createMerchantApiClient(), session = await client.auth.session()
    if (!session.authenticated || !session.user) return { error: NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 }) }
    if (request.headers.get('X-LetBuyy-Merchant-Context') !== session.user.id) return { error: NextResponse.json({ error: { code: 'SESSION_CONTEXT_CHANGED' } }, { status: 409 }) }
    const { store, reelId } = await params, owned = await resolveOwnedStoreId(decodeURIComponent(store))
    if (owned.error) return owned
    return { client, siteId: owned.storeId!, reelId }
}
export async function GET(request: NextRequest, { params }: Params) {
    try {
        const resolved = await scope(request, params)
        if (resolved.error) return resolved.error
        return NextResponse.json({ data: await resolved.client!.reels.get(resolved.siteId!, resolved.reelId!) }, { headers: { 'Cache-Control': 'private, no-store' } })
    } catch (error) { return merchantApiErrorResponse(error, 'Unable to load private reel') }
}
export async function POST(request: NextRequest, { params }: Params) {
    const denied = validateMerchantMutationRequest(request); if (denied) return denied
    try {
        const resolved = await scope(request, params)
        if (resolved.error) return resolved.error
        const reader = request.body?.getReader(); if (!reader) return NextResponse.json({ error: { code: 'VALIDATION' } }, { status: 400 })
        const chunks: Uint8Array[] = []; let size = 0
        try {
            while (true) {
                const { done, value } = await reader.read(); if (done) break
                size += value.byteLength
                if (size > REEL_REVIEW_REQUEST_BYTES) { await reader.cancel(); return NextResponse.json({ error: { code: 'REEL_REQUEST_INVALID' } }, { status: 413 }) }
                chunks.push(value)
            }
        } finally { reader.releaseLock() }
        const bytes = new Uint8Array(size); let at = 0
        for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.length }
        let body: unknown
        try { body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) } catch { return NextResponse.json({ error: { code: 'VALIDATION' } }, { status: 400 }) }
        const parsed = ReelMerchantCommandSchema.safeParse(body)
        if (!parsed.success || parsed.data.idempotency_key !== request.headers.get('X-Idempotency-Key')) return NextResponse.json({ error: { code: 'VALIDATION' } }, { status: 400 })
        return NextResponse.json({ data: await resolved.client!.reels.mutate(resolved.siteId!, resolved.reelId!, parsed.data) }, { headers: { 'Cache-Control': 'private, no-store' } })
    } catch (error) { return merchantApiErrorResponse(error, 'Unable to save reel. Retry the same request.') }
}
