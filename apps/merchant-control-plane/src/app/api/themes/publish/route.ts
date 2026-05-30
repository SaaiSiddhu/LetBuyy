import { NextRequest, NextResponse } from 'next/server'
import { readWorkerJson, workerErrorResponse, workerFetch } from '@/lib/api/worker-client'

/**
 * POST /api/themes/publish
 * 
 * Toggles a store's status between 'published' and 'draft'.
 * 
 * Body: { storeId: string, action: 'publish' | 'unpublish' }
 */
export async function POST(request: NextRequest) {
    try {
        const { storeId, action } = await request.json()

        if (!storeId || !action) {
            return NextResponse.json(
                { error: 'storeId and action are required' },
                { status: 400 }
            )
        }

        if (!['publish', 'unpublish'].includes(action)) {
            return NextResponse.json(
                { error: 'action must be "publish" or "unpublish"' },
                { status: 400 }
            )
        }

        const encodedStoreId = encodeURIComponent(storeId)
        const response = action === 'publish'
            ? await workerFetch(`/stores/${encodedStoreId}/publish`, {
                method: 'POST',
                requireSession: true,
            })
            : await workerFetch(`/stores/${encodedStoreId}`, {
                method: 'PATCH',
                requireSession: true,
                body: JSON.stringify({ status: 'draft' }),
            })

        const payload = await readWorkerJson(response)
        const data = payload.data

        return NextResponse.json({
            success: true,
            status: data.status,
        })
    } catch (err) {
        return workerErrorResponse(err)
    }
}
