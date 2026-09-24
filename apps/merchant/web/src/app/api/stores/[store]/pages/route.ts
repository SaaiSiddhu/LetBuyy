import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

function normalizePageStatus(value: string | null) {
    return value === 'draft' || value === 'published' || value === 'archived' ? value : 'all'
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const searchParams = request.nextUrl.searchParams
        const page = Number(searchParams.get('page') || '1')
        const limit = Number(searchParams.get('limit') || '100')
        const payload = await createMerchantApiClient().pages.list({
            store_id: resolved.storeId,
            page,
            limit,
            status: normalizePageStatus(searchParams.get('status')),
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
    } catch (error) {
        return merchantApiErrorResponse(error, 'Unable to load pages')
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
        const payload = await createMerchantApiClient().pages.create({
            ...body,
            store_id: resolved.storeId,
        })

        return NextResponse.json({ success: true, data: payload })
    } catch (error) {
        return merchantApiErrorResponse(error, 'Unable to create page')
    }
}
