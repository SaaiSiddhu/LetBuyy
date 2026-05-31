import { NextRequest, NextResponse } from 'next/server'
import { createWorkerApiClient, workerErrorResponse } from '@/lib/api/worker-client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const apiClient = createWorkerApiClient()
        const [credits, usage] = await Promise.all([
            apiClient.ai.credits({ store_id: resolved.storeId }),
            apiClient.ai.usage({ store_id: resolved.storeId, limit: 20 }),
        ])

        return NextResponse.json({
            data: {
                credits,
                usage: usage.data,
            },
        })
    } catch (err) {
        return workerErrorResponse(err, 'Unable to load AI studio data')
    }
}
