import { validateMerchantMutationRequest } from '@/lib/api/request-origin'
import { NextRequest, NextResponse } from 'next/server'
import { CreateShippingProfileSchema } from '@letbuyy/shared-types'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

export async function GET(_request: NextRequest, {params}: {params: Promise<{store: string}>}) {
    try {
        const {store}=await params
        const resolved=await resolveOwnedStoreId(decodeURIComponent(store))
        if(resolved.error)return resolved.error
        const profiles=await createMerchantApiClient(resolved.storeId).shipping.profiles.list({store_id:resolved.storeId})
        return NextResponse.json({success:true,data:profiles})
    } catch(error){return merchantApiErrorResponse(error,'Unable to load shipping profiles')}
}

export async function POST(request: NextRequest, {params}: {params: Promise<{store: string}>}) {
    const denied = validateMerchantMutationRequest(request, { requireKey: false })
    if (denied) return denied
    try {
        const {store}=await params
        const resolved=await resolveOwnedStoreId(decodeURIComponent(store))
        if(resolved.error)return resolved.error
        const input=CreateShippingProfileSchema.safeParse({...await request.json(),store_id:resolved.storeId})
        if(!input.success)return NextResponse.json({error:{message:input.error.issues[0]?.message || 'Review the profile settings.'}},{status:400})
        const profile=await createMerchantApiClient(resolved.storeId).shipping.profiles.create(input.data)
        return NextResponse.json({success:true,data:profile},{status:201})
    } catch(error) {return merchantApiErrorResponse(error,'Unable to save the shipping profile')}
}
