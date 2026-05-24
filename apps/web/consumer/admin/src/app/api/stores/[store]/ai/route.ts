import { NextRequest, NextResponse } from 'next/server'
import { readWorkerJson, workerFetch } from '@/lib/api/worker-client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const [creditsResponse, usageResponse] = await Promise.all([
            workerFetch(`/ai/credits?store_id=${encodeURIComponent(resolved.storeId)}`),
            workerFetch(`/ai/usage?store_id=${encodeURIComponent(resolved.storeId)}&limit=20`),
        ])
        const creditsPayload = await readWorkerJson(creditsResponse)
        const usagePayload = await readWorkerJson(usageResponse)

        return NextResponse.json({
            data: {
                credits: creditsPayload?.data || null,
                usage: usagePayload?.data || [],
            },
        })
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Unable to load AI studio data' },
            { status: 500 }
        )
    }
}
