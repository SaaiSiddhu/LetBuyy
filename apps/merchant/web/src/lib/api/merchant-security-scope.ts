import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient } from './client'
import { validateMerchantMutationRequest } from './request-origin'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

export function privateSecurityResponse<T extends Response>(response: T): T {
    response.headers.set('Cache-Control', 'private, no-store')
    response.headers.set('Pragma', 'no-cache')
    return response
}

/** Validate the mounted account before reading or changing account-wide factors. */
export async function merchantSecurityScope(request: NextRequest, params: Promise<{ store: string }>, mutation = true) {
    if (mutation) {
        const denied = validateMerchantMutationRequest(request)
        if (denied) return { error: privateSecurityResponse(denied) }
    }
    const session = await createMerchantApiClient().auth.session()
    if (!session.authenticated || !session.user) return { error: privateSecurityResponse(NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Sign in to continue.' } }, { status: 401 })) }
    if (request.headers.get('X-LetBuyy-Merchant-Context') !== session.user.id) {
        return { error: privateSecurityResponse(NextResponse.json({ error: { code: 'SESSION_CONTEXT_CHANGED', message: 'The signed-in account changed. Reload this page.' } }, { status: 409 })) }
    }
    const { store } = await params
    const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
    if (resolved.error) return { error: privateSecurityResponse(resolved.error) }
    return { storeId: resolved.storeId!, actorId: session.user.id, headers: { 'X-Store-ID': resolved.storeId!, ...(mutation ? { 'X-Idempotency-Key': request.headers.get('X-Idempotency-Key')! } : {}) } }
}
