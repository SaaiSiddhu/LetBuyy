import { NextRequest, NextResponse } from 'next/server'
import type { UpdateBlogCommentInput } from '@letbuyy/api-client'
import { createWorkerApiClient, workerErrorResponse } from '@/lib/api/worker-client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ store: string; commentId: string }> }
) {
    try {
        const { store, commentId } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const body = await request.json()
        const payload = await createWorkerApiClient().blog.comments.update(commentId, body as UpdateBlogCommentInput)

        return NextResponse.json({
            success: true,
            data: payload,
        })
    } catch (err) {
        return workerErrorResponse(err, 'Unable to update comment')
    }
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ store: string; commentId: string }> }
) {
    try {
        const { store, commentId } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const payload = await createWorkerApiClient().blog.comments.remove(commentId)

        return NextResponse.json({ success: true, data: payload })
    } catch (err) {
        return workerErrorResponse(err, 'Unable to delete comment')
    }
}
