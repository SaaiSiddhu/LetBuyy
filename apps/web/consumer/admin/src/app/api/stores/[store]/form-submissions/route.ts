import { NextRequest, NextResponse } from 'next/server'
import { readWorkerJson, workerFetch } from '@/lib/api/worker-client'
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
            page: searchParams.get('page') || '1',
            limit: searchParams.get('limit') || '100',
            type: searchParams.get('type') || 'all',
            status: searchParams.get('status') || 'all',
        })

        const workerResponse = await workerFetch(`/form-submissions?${query.toString()}`)
        const payload = await readWorkerJson(workerResponse)

        return NextResponse.json(payload)
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Unable to load form submissions' },
            { status: 500 }
        )
    }
}
