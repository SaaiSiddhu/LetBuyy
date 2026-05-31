import { NextRequest, NextResponse } from 'next/server'
import { createWorkerApiClient, workerErrorResponse } from '@/lib/api/worker-client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ themeId: string }> }
) {
    try {
        const { themeId } = await params
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

        const payload = await createWorkerApiClient().themes.previewSession(themeId, {
            store_id: resolved.storeId,
            ttl_seconds: Number(body.ttl_seconds || 900),
        })

        return NextResponse.json({ success: true, data: payload })
    } catch (err) {
        return workerErrorResponse(err, 'Unable to create preview session')
    }
}
