import { NextRequest, NextResponse } from 'next/server'
import { readWorkerJson, workerErrorResponse, workerFetch } from '@/lib/api/worker-client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const { searchParams } = new URL(request.url)
        const query = new URLSearchParams({
            store_id: resolved.storeId,
            status: searchParams.get('status') || 'all',
            payment_status: searchParams.get('payment_status') || 'all',
            page: searchParams.get('page') || '1',
            limit: searchParams.get('limit') || '50',
        })

        if (searchParams.get('search')) query.set('search', searchParams.get('search')!)
        if (searchParams.get('sort')) query.set('sort', searchParams.get('sort')!)
        if (searchParams.get('order')) query.set('order', searchParams.get('order')!)

        const workerResponse = await workerFetch(`/orders?${query.toString()}`)
        const payload = await readWorkerJson(workerResponse)

        return NextResponse.json(payload)
    } catch (err) {
        return workerErrorResponse(err, 'Unable to load orders')
    }
}
