import { NextRequest, NextResponse } from 'next/server'
import type { CustomerSegmentRules } from '@letbuyy/shared-types'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

type RouteParams = { params: Promise<{ store: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const url = new URL(request.url)
        const search = url.searchParams.get('search') ?? undefined

        const segments = await createMerchantApiClient().customers.segments.list({
            store_id: resolved.storeId,
            ...(search ? { search } : {}),
        })
        return NextResponse.json({ data: segments })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to load customer segments')
    }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const body = await request.json() as Record<string, unknown>
        const segment = await createMerchantApiClient().customers.segments.create({
            store_id: resolved.storeId,
            name: body.name as string,
            description: (body.description as string | undefined) ?? undefined,
            rules: (body.rules as CustomerSegmentRules) ?? { tags_any: [] },
        })
        return NextResponse.json({ data: segment }, { status: 201 })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to create customer segment')
    }
}
