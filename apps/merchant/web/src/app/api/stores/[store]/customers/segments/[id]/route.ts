import { NextRequest, NextResponse } from 'next/server'
import type { CustomerSegmentRules } from '@letbuyy/shared-types'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

type RouteParams = { params: Promise<{ store: string; id: string }> }

export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const { store, id } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const body = await request.json() as Record<string, unknown>
        const segment = await createMerchantApiClient().customers.segments.update(
            id,
            {
                ...(body.name !== undefined ? { name: body.name as string } : {}),
                ...(body.description !== undefined ? { description: body.description as string | undefined } : {}),
                ...(body.rules !== undefined ? { rules: body.rules as CustomerSegmentRules } : {}),
            },
        )
        return NextResponse.json({ data: segment })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to update customer segment')
    }
}
