import { validateMerchantMutationRequest } from '@/lib/api/request-origin'
import { NextRequest, NextResponse } from 'next/server'
import { UpdateShippingProfileSchema, UuidSchema } from '@letbuyy/shared-types'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

export async function PATCH(request: NextRequest, {params}: {params: Promise<{store:string;profileId:string}>}) {
    const denied = validateMerchantMutationRequest(request, { requireKey: false })
    if (denied) return denied
    try {
        const {store,profileId}=await params
        const resolved=await resolveOwnedStoreId(decodeURIComponent(store))
        if(resolved.error)return resolved.error
        const id=UuidSchema.safeParse(profileId),input=UpdateShippingProfileSchema.safeParse(await request.json())
        if(!id.success || !input.success)return NextResponse.json({error:{message:'Review the shipping profile settings.'}},{status:400})
        const profile=await createMerchantApiClient(resolved.storeId).shipping.profiles.update(id.data,input.data)
        return NextResponse.json({success:true,data:profile})
    } catch(error) {return merchantApiErrorResponse(error,'Unable to update the shipping profile')}
}
