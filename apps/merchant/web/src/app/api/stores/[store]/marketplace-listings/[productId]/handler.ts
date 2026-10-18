import { NextRequest, NextResponse } from 'next/server'
import { merchantApiErrorResponse, merchantApiFetch, readMerchantApiJson } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

type RouteParams = { params: Promise<{ store: string; productId: string }> }
type Listing = { id: string; product_id: string; status: string; rejection_reason: string | null }
type RouteDependencies = {
    resolveOwnedStoreId: typeof resolveOwnedStoreId
    merchantApiFetch: typeof merchantApiFetch
    readMerchantApiJson: typeof readMerchantApiJson
    merchantApiErrorResponse: typeof merchantApiErrorResponse
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function createMarketplaceListingHandlers(deps: RouteDependencies = {
    resolveOwnedStoreId,
    merchantApiFetch,
    readMerchantApiJson,
    merchantApiErrorResponse,
}) {
    async function loadProductListing(storeId: string, productId: string): Promise<Listing | null> {
        const query = new URLSearchParams({ store_id: storeId, channel: 'marketplace', product_id: productId, limit: '1' })
        const response = await deps.merchantApiFetch(`/channel-listings?${query}`, { requireSession: true })
        const payload = await deps.readMerchantApiJson(response)
        const rows = Array.isArray(payload?.data) ? payload.data : []
        return (rows[0] as Listing | undefined) ?? null
    }

    async function GET(_request: NextRequest, { params }: RouteParams) {
        try {
            const { store, productId } = await params
            if (!UUID.test(productId)) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid product id' } }, { status: 400 })
            const resolved = await deps.resolveOwnedStoreId(decodeURIComponent(store))
            if (resolved.error) return resolved.error
            const listing = await loadProductListing(resolved.storeId, productId)
            return NextResponse.json({ data: listing })
        } catch (error) {
            return deps.merchantApiErrorResponse(error, 'Unable to load marketplace review status')
        }
    }

    async function POST(request: NextRequest, { params }: RouteParams) {
        try {
            const { store, productId } = await params
            if (!UUID.test(productId)) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid product id' } }, { status: 400 })
            const resolved = await deps.resolveOwnedStoreId(decodeURIComponent(store))
            if (resolved.error) return resolved.error
            const body = await request.json().catch(() => null) as { reason?: unknown; idempotency_key?: unknown } | null
            const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''
            const idempotencyKey = typeof body?.idempotency_key === 'string' ? body.idempotency_key.trim() : ''
            if (reason.length < 8 || reason.length > 500 || idempotencyKey.length < 1 || idempotencyKey.length > 120) {
                return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Enter a correction response of 8 to 500 characters and retry.' } }, { status: 400 })
            }
            const listing = await loadProductListing(resolved.storeId, productId)
            if (!listing) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Marketplace listing not found for this product.' } }, { status: 404 })
            const response = await deps.merchantApiFetch(`/channel-listings/${encodeURIComponent(listing.id)}/resubmit`, {
                method: 'POST',
                requireSession: true,
                body: JSON.stringify({ store_id: resolved.storeId, reason, idempotency_key: idempotencyKey }),
            })
            return NextResponse.json({ data: await deps.readMerchantApiJson(response) })
        } catch (error) {
            return deps.merchantApiErrorResponse(error, 'Unable to resubmit marketplace listing')
        }
    }

    return { GET, POST }
}

