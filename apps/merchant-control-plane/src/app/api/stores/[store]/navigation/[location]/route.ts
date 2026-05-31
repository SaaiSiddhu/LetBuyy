import { NextRequest, NextResponse } from 'next/server'
import { createWorkerApiClient, workerErrorResponse } from '@/lib/api/worker-client'
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
        const payload = await createWorkerApiClient().pages.navigation.replace(location, {
            ...body,
            store_id: resolved.storeId,
            location,
        })
        return NextResponse.json({ success: true, data: payload })
    } catch (error) {
        return workerErrorResponse(error, 'Unable to save navigation')
    }
}
