import { NextRequest, NextResponse } from 'next/server'
import { readWorkerJson, workerErrorResponse, workerFetch } from '@/lib/api/worker-client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ themeId: string }> }
) {
    try {
        const { themeId } = await params
        const { searchParams } = new URL(request.url)
        const storeName = searchParams.get('store_name') || searchParams.get('store_id')

        if (!storeName) {
            return NextResponse.json(
                { error: 'store_name query parameter is required' },
                { status: 400 }
            )
        }

        const resolved = await resolveOwnedStoreId(storeName)
        if (resolved.error) return resolved.error

        const payload = await readWorkerJson(await workerFetch(
            `/themes/${themeId}/releases?store_id=${encodeURIComponent(resolved.storeId)}`
        ))

        return NextResponse.json(payload)
    } catch (err) {
        return workerErrorResponse(err, 'Unable to load theme releases')
    }
}
