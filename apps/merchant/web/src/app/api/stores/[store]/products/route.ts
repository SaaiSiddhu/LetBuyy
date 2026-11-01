import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'
import type { ProductListQuery } from '@letbuyy/api-client'

function normalizeStatus(status: string | null) {
    if (status === 'active') return 'active'
    if (status === 'draft' || status === 'archived' || status === 'inactive') return status
    return 'all'
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
        const query: ProductListQuery = {
            store_id: resolved.storeId,
            status: normalizeStatus(searchParams.get('status')),
            page: Number(searchParams.get('page') || '1'),
            limit: Number(searchParams.get('limit') || '100'),
            withCount: searchParams.get('withCount') === 'true',
            sort: searchParams.get('sort') || 'created_at',
            order: searchParams.get('order') === 'asc' ? 'asc' : 'desc',
        }

        if (searchParams.get('search')) query.search = searchParams.get('search')!
        if (searchParams.get('category')) query.category = searchParams.get('category')!

        const products = searchParams.get('view') === 'summary'
            ? await createMerchantApiClient().products.listSummary(query)
            : await createMerchantApiClient().products.list(query)

        return NextResponse.json({
            data: products.data,
            meta: {
                total: products.total,
                page: products.page,
                per_page: products.limit,
                has_next: products.has_more,
                total_is_exact: products.total_is_exact,
                next_cursor: products.next_cursor,
            },
        })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to load products')
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
        const product = await createMerchantApiClient().products.create({
            ...body,
            store_id: resolved.storeId,
        })

        return NextResponse.json({ data: product }, { status: 201 })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to save product')
    }
}
