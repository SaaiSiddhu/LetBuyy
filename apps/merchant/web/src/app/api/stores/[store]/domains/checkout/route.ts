import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

async function respond(params: Promise<{ store: string }>, prepare: boolean) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error
        const api = createMerchantApiClient().customDomains
        const data = prepare
            ? await api.prepareCheckout({ site_id: resolved.storeId })
            : await api.checkout({ site_id: resolved.storeId })
        return NextResponse.json({ data }, { status: prepare && data.status !== 'active' ? 202 : 200, headers: { 'Cache-Control': 'no-store' } })
    } catch (error) { return merchantApiErrorResponse(error, 'Unable to check the secure checkout address') }
}
export function GET(_request: NextRequest, { params }: { params: Promise<{ store: string }> }) { return respond(params, false) }
export function POST(_request: NextRequest, { params }: { params: Promise<{ store: string }> }) { return respond(params, true) }
