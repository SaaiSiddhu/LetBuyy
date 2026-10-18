import { NextRequest, NextResponse } from 'next/server'
import type { SetMerchantLoyaltyInput } from '@letbuyy/api-client'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { validateMerchantMutationRequest } from '@/lib/api/request-origin'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

const SETTING_KEYS = ['expected_updated_at', 'is_active', 'earn_rate_bps', 'redeem_cap_bps', 'point_value_minor']

async function scope(request: NextRequest, params: Promise<{ store: string }>) {
    const client = createMerchantApiClient()
    const session = await client.auth.session()
    if (!session.authenticated || !session.user) return { error: NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Sign in to continue.' } }, { status: 401 }) }
    // This is a stale-form refusal, never a grant of authority from a header.
    if (request.headers.get('X-LetBuyy-Merchant-Context') !== session.user.id) {
        return { error: NextResponse.json({ error: { code: 'SESSION_CONTEXT_CHANGED', message: 'The signed-in account changed. Reload this page.' } }, { status: 409 }) }
    }
    const { store } = await params
    const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
    return { ...resolved, client }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ store: string }> }) {
    try {
        const resolved = await scope(request, params)
        if (resolved.error) return resolved.error
        const data = await resolved.client!.loyalty.program(resolved.storeId!)
        return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'private, no-store' } })
    } catch (error) { return merchantApiErrorResponse(error, 'Unable to load loyalty settings') }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ store: string }> }) {
    const denied = validateMerchantMutationRequest(request)
    if (denied) return denied
    try {
        const resolved = await scope(request, params)
        if (resolved.error) return resolved.error
        const body: unknown = await request.json().catch(() => null)
        if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !SETTING_KEYS.includes(key))) {
            return NextResponse.json({ error: { code: 'VALIDATION', message: 'Invalid loyalty settings.' } }, { status: 400 })
        }
        const data = await resolved.client!.loyalty.setProgram({ ...body, store_id: resolved.storeId! } as SetMerchantLoyaltyInput, {
            idempotencyKey: request.headers.get('X-Idempotency-Key')!,
        })
        return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'private, no-store' } })
    } catch (error) { return merchantApiErrorResponse(error, 'Unable to save loyalty settings') }
}
