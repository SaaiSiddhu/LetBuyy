import {privateSecurityResponse} from '@/lib/api/merchant-security-scope'
import {merchantWarehouseScope,merchantWarehouseResponse} from '@/lib/api/merchant-warehouse-scope'
import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'
import type { CreatePurchaseOrderInput } from '@letbuyy/api-client'

type RouteParams = { params: Promise<{ store: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const data = await createMerchantApiClient().inventory.purchaseOrders.list({
            store_id: resolved.storeId,
        })
        return privateSecurityResponse(NextResponse.json({ data }))
    } catch (err) {
        return privateSecurityResponse(merchantApiErrorResponse(err, 'Unable to load purchase orders'))
    }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const body = await request.json() as Omit<CreatePurchaseOrderInput, 'store_id'>
        const scope = await merchantWarehouseScope(request,params,body)
        if(scope.error)return scope.error
        const data = await createMerchantApiClient().inventory.purchaseOrders.create({
            ...body,
            store_id: scope.storeId,
        },{storeId:scope.storeId,idempotencyKey:scope.idempotencyKey})
        return merchantWarehouseResponse(data,scope,201)
    } catch (err) {
        return privateSecurityResponse(merchantApiErrorResponse(err, 'Unable to create purchase order'))
    }
}
