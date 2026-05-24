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

        const location = request.nextUrl.searchParams.get('location') || 'main'
        const query = new URLSearchParams({
            store_id: resolved.storeId,
            location,
        })
        const workerResponse = await workerFetch(`/pages/navigation?${query.toString()}`)
        const payload = await readWorkerJson(workerResponse)
        return NextResponse.json(payload)
    } catch (error) {
        return workerErrorResponse(error, 'Unable to load navigation')
    }
}
