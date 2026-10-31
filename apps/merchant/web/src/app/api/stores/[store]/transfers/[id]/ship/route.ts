import {privateSecurityResponse} from '@/lib/api/merchant-security-scope'
import {merchantWarehouseScope,merchantWarehouseResponse} from '@/lib/api/merchant-warehouse-scope'
import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import type { ShipInventoryTransferInput } from '@letbuyy/api-client'

type RouteParams = { params: Promise<{ store: string; id: string }> }

export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params
        const body = await request.json() as Omit<ShipInventoryTransferInput, 'store_id'>
        const scope = await merchantWarehouseScope(request,params,body)
        if(scope.error)return scope.error
        const data = await createMerchantApiClient().inventory.transfers.ship(
            decodeURIComponent(id),
            { ...body, store_id: scope.storeId },
            {storeId:scope.storeId,idempotencyKey:scope.idempotencyKey},
        )
        return merchantWarehouseResponse(data,scope)
    } catch (err) {
        return privateSecurityResponse(merchantApiErrorResponse(err, 'Unable to ship inventory transfer'))
    }
}
