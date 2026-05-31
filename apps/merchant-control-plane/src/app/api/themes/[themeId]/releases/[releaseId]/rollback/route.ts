import { NextRequest, NextResponse } from 'next/server'
import { createWorkerApiClient, workerErrorResponse } from '@/lib/api/worker-client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ themeId: string; releaseId: string }> }
) {
    try {
        const { themeId, releaseId } = await params
        const body = await request.json().catch(() => ({}))
        const { searchParams } = new URL(request.url)
        const storeName = body.store_name || body.store_id || searchParams.get('store_name') || searchParams.get('store_id')

        if (!storeName) {
            return NextResponse.json(
                { error: 'store_name is required' },
                { status: 400 }
            )
        }

        const resolved = await resolveOwnedStoreId(String(storeName))
        if (resolved.error) return resolved.error

        const payload = await createWorkerApiClient().themes.rollbackRelease(themeId, releaseId, {
            store_id: resolved.storeId,
            make_store_live: body.make_store_live !== false,
            rollback_message: body.rollback_message,
        })

        return NextResponse.json({ success: true, data: payload })
    } catch (err) {
        return workerErrorResponse(err, 'Unable to rollback theme release')
    }
}
