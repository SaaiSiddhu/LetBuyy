import {privateSecurityResponse} from '@/lib/api/merchant-security-scope'
import {merchantWarehouseScope,merchantWarehouseResponse} from '@/lib/api/merchant-warehouse-scope'
import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import {WarehouseTransferListQuerySchema} from '@letbuyy/shared-types'
import {merchantSecurityScope} from '@/lib/api/merchant-security-scope'
import type { CreateInventoryTransferInput } from '@letbuyy/api-client'

type RouteParams = { params: Promise<{ store: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const scope=await merchantSecurityScope(request,params,false)
        if(scope.error)return scope.error
        const query=WarehouseTransferListQuerySchema.safeParse({...Object.fromEntries(request.nextUrl.searchParams),store_id:scope.storeId})
        if(!query.success)return privateSecurityResponse(NextResponse.json({error:{code:'VALIDATION_ERROR',message:'Choose a valid warehouse page and filters.'}},{status:400}))
        const page=await createMerchantApiClient().inventory.transfers.list(query.data,{storeId:scope.storeId,cache:'no-store'})
        return privateSecurityResponse(NextResponse.json({data:page.data,meta:{store_id:scope.storeId,
            total:page.total,page:page.page,per_page:page.limit,has_next:page.has_more,total_is_exact:page.total_is_exact}}))
    } catch (err) {
        return privateSecurityResponse(merchantApiErrorResponse(err, 'Unable to load inventory transfers'))
    }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const body = await request.json() as Omit<CreateInventoryTransferInput, 'store_id'>
        const scope = await merchantWarehouseScope(request,params,body)
        if(scope.error)return scope.error
        const data = await createMerchantApiClient().inventory.transfers.create({
            ...body,
            store_id: scope.storeId,
        },{storeId:scope.storeId,idempotencyKey:scope.idempotencyKey})
        return merchantWarehouseResponse(data,scope,201)
    } catch (err) {
        return privateSecurityResponse(merchantApiErrorResponse(err, 'Unable to create inventory transfer'))
    }
}
