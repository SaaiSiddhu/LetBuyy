import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'
import {WarehouseOptionListQuerySchema} from '@letbuyy/shared-types'
import {merchantSecurityScope,privateSecurityResponse} from '@/lib/api/merchant-security-scope'
import type { CreateInventoryLocationInput } from '@letbuyy/api-client'

type RouteParams = { params: Promise<{ store: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const scope=await merchantSecurityScope(request,params,false)
        if(scope.error)return scope.error
        const query=WarehouseOptionListQuerySchema.safeParse({...Object.fromEntries(request.nextUrl.searchParams),store_id:scope.storeId})
        if(!query.success)return privateSecurityResponse(NextResponse.json({error:{code:'VALIDATION_ERROR',message:'Choose a valid warehouse page and filters.'}},{status:400}))
        const page=await createMerchantApiClient().inventory.locations.list(query.data,{storeId:scope.storeId,cache:'no-store'})
        return privateSecurityResponse(NextResponse.json({data:page.data,meta:{store_id:scope.storeId,total:page.total,page:page.page,per_page:page.limit,has_next:page.has_more,total_is_exact:page.total_is_exact}}))
    } catch (err) {
        return privateSecurityResponse(merchantApiErrorResponse(err, 'Unable to load warehouse choices'))
    }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const body = await request.json() as Omit<CreateInventoryLocationInput, 'store_id'>
        const data = await createMerchantApiClient().inventory.locations.create({
            ...body,
            store_id: resolved.storeId,
        })
        return NextResponse.json({ data }, { status: 201 })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to create inventory location')
    }
}
