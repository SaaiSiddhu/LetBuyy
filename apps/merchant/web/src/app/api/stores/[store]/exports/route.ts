import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse, merchantApiReadSignal } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'
import { validateMerchantMutationRequest } from '@/lib/api/request-origin'

/** Start the canonical background export once; list pages are never CSV sources. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ store: string }> }) {
    const denied = validateMerchantMutationRequest(request, { requireKey: false })
    if (denied) return denied
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error
        const body = await request.json().catch(() => null)
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            return NextResponse.json({ error: { message: 'Invalid export request' } }, { status: 400 })
        }
        const client = createMerchantApiClient()
        const options = { signal: merchantApiReadSignal(request.signal) }
        const scope = { store_id: resolved.storeId }
        let payload
        switch (body.type) {
            case 'products': payload = await client.exports.products(scope, options); break
            case 'customers': payload = await client.exports.customers(scope, options); break
            case 'orders':
                if (body.status && !['pending', 'processing', 'shipped', 'delivered', 'cancelled'].includes(body.status)) {
                    return NextResponse.json({ error: { message: 'Invalid order status' } }, { status: 400 })
                }
                payload = await client.exports.orders({ ...scope, ...(body.status ? { status: body.status } : {}) }, options)
                break
            default: return NextResponse.json({ error: { message: 'Invalid export type' } }, { status: 400 })
        }
        return NextResponse.json({ data: payload }, { status: 202, headers: { 'Cache-Control': 'private, no-store' } })
    } catch (error) {
        return merchantApiErrorResponse(error, 'Unable to prepare export')
    }
}
