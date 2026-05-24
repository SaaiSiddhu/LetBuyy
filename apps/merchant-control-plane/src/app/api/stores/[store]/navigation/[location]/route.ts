import { NextRequest, NextResponse } from 'next/server'
import { readWorkerJson, workerFetch, workerErrorResponse } from '@/lib/api/worker-client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ store: string; location: string }> }
) {
    try {
        const { store, location } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const body = await request.json()
        const workerResponse = await workerFetch(`/pages/navigation/${encodeURIComponent(location)}`, {
            method: 'PUT',
            body: JSON.stringify({
                ...body,
                store_id: resolved.storeId,
                location,
            }),
        })
        const payload = await readWorkerJson(workerResponse)
        return NextResponse.json(payload)
    } catch (error) {
        return workerErrorResponse(error, 'Unable to save navigation')
    }
}
