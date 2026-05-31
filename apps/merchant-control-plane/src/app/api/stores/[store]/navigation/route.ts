import { NextRequest, NextResponse } from 'next/server'
import { createWorkerApiClient, workerErrorResponse } from '@/lib/api/worker-client'
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
        const payload = await createWorkerApiClient().pages.navigation.get({
            store_id: resolved.storeId,
            location,
        })
        return NextResponse.json({ success: true, data: payload })
    } catch (error) {
        return workerErrorResponse(error, 'Unable to load navigation')
    }
}
