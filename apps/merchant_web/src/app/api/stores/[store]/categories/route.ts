import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const categories = await createMerchantApiClient().categories.list({
            store_id: resolved.storeId,
            flat: true,
        })

        return NextResponse.json({ data: categories })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to load categories')
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
        const category = await createMerchantApiClient().categories.create({
            ...body,
            store_id: resolved.storeId,
        })

        return NextResponse.json({ data: category }, { status: 201 })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to save category')
    }
}
