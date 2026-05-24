import { NextRequest, NextResponse } from 'next/server'
import { readWorkerJson, workerFetch, workerErrorResponse } from '@/lib/api/worker-client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const searchParams = request.nextUrl.searchParams
        const query = new URLSearchParams({
            store_id: resolved.storeId,
            status: searchParams.get('status') || 'all',
        })
        const workerResponse = await workerFetch(`/pages/policies?${query.toString()}`)
        const payload = await readWorkerJson(workerResponse)
        return NextResponse.json(payload)
    } catch (error) {
        return workerErrorResponse(error, 'Unable to load policies')
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const body = await request.json()
        const workerResponse = await workerFetch('/pages/policies', {
            method: 'POST',
            body: JSON.stringify({
                ...body,
                store_id: resolved.storeId,
            }),
        })
        const payload = await readWorkerJson(workerResponse)
        return NextResponse.json(payload)
    } catch (error) {
        return workerErrorResponse(error, 'Unable to save policy')
    }
}
