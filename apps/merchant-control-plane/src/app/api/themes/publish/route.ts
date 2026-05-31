import { NextRequest, NextResponse } from 'next/server'
import { createWorkerApiClient, workerErrorResponse } from '@/lib/api/worker-client'

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

        const api = createWorkerApiClient()
        const data = action === 'publish'
            ? await api.stores.publish(storeId)
            : await api.stores.update(storeId, { status: 'draft' })

        return NextResponse.json({
            success: true,
            status: data.status,
        })
    } catch (err) {
        return workerErrorResponse(err)
    }
}
