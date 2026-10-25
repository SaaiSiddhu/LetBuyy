import {CollectionListQuerySchema} from '@letbuyy/commerce-core'
import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const parsed = CollectionListQuerySchema.safeParse({store_id:resolved.storeId,
            page:request.nextUrl.searchParams.get('page') ?? undefined,
            limit:request.nextUrl.searchParams.get('limit') ?? undefined})
        if(!parsed.success) return NextResponse.json({error:{code:'VALIDATION',message:'Invalid collection page.'}},{status:400})
        const collections = await createMerchantApiClient().products.collections.list(parsed.data)
        return NextResponse.json(collections, {headers:{'Cache-Control':'no-store'}})
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to load collections')
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
        const collection = await createMerchantApiClient().products.collections.create({
            ...body,
            store_id: resolved.storeId,
        })

        return NextResponse.json({ data: collection }, { status: 201 })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to create collection')
    }
}
