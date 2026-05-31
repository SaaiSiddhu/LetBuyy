import { NextRequest, NextResponse } from 'next/server'
import { createWorkerApiClient, workerErrorResponse } from '@/lib/api/worker-client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const body = await request.json().catch(() => ({}))
        const payload = await createWorkerApiClient().payments.subscription.cancel({
            ...body,
            store_id: resolved.storeId,
        })

        return NextResponse.json({ data: payload })
    } catch (err) {
        return workerErrorResponse(err, 'Unable to cancel subscription')
    }
}
