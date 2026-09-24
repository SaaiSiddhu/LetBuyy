import { NextRequest, NextResponse } from 'next/server'
import type { UpdateBlogPostInput } from '@letbuyy/api-client'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ store: string; postId: string }> }
) {
    try {
        const { store, postId } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const body = await request.json()
        const payload = await createMerchantApiClient().blog.posts.update(postId, {
            ...body,
            ...(body.content !== undefined ? { content: typeof body.content === 'string' ? body.content : '' } : {}),
        } as UpdateBlogPostInput)

        return NextResponse.json({
            success: true,
            data: payload,
        })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to update post')
    }
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ store: string; postId: string }> }
) {
    try {
        const { store, postId } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const payload = await createMerchantApiClient().blog.posts.remove(postId)

        return NextResponse.json({ success: true, data: payload })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to delete post')
    }
}
