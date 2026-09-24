import { NextRequest, NextResponse } from 'next/server'
import type { BlogPostListQuery, CreateBlogPostInput } from '@letbuyy/api-client'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

function normalizeBlogPostStatus(value: string | null): BlogPostListQuery['status'] | undefined {
    return value === 'draft' || value === 'published' || value === 'scheduled' || value === 'archived'
        ? value
        : undefined
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const { searchParams } = new URL(request.url)
        const page = Number(searchParams.get('page') || '1')
        const limit = Number(searchParams.get('limit') || '100')
        const payload = await createMerchantApiClient().blog.posts.list({
            store_id: resolved.storeId,
            page,
            limit,
            status: normalizeBlogPostStatus(searchParams.get('status')),
        })

        return NextResponse.json({
            success: true,
            data: payload.data,
            meta: {
                page: payload.page,
                per_page: payload.limit,
                total: payload.total,
                total_pages: Math.ceil(payload.total / Math.max(payload.limit, 1)),
                has_next: payload.has_more,
                has_prev: payload.page > 1,
            },
        })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to load posts')
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const body = await request.json()
        const payload = await createMerchantApiClient().blog.posts.create({
            ...body,
            store_id: resolved.storeId,
            content: typeof body.content === 'string' ? body.content : '',
        } as CreateBlogPostInput)

        return NextResponse.json({
            success: true,
            data: payload,
        })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to save post')
    }
}
