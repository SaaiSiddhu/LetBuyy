import { validateMerchantMutationRequest } from '@/lib/api/request-origin'
import { NextRequest, NextResponse } from 'next/server'
import type { CreateTaxRateInput } from '@letbuyy/api-client'
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

        const apiClient = createMerchantApiClient(resolved.storeId)
        const [storePayload, rates] = await Promise.all([
            apiClient.stores.get(resolved.storeId),
            apiClient.taxes.list({ store_id: resolved.storeId }),
        ])
        const address=storePayload.invoice_address
        const postalCode = [address?.zip, address?.postal_code, address?.pincode]
            .find(value => typeof value === 'string' && /^[1-9][0-9]{5}$/.test(value))
        const registrationConfigured=Boolean(storePayload.gstin && storePayload.gst_state_code
            && /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(storePayload.gstin)
            && storePayload.gstin.slice(0,2)===storePayload.gst_state_code && storePayload.legal_name?.trim()
            && address?.line1?.trim() && address?.city?.trim() && postalCode)

        return NextResponse.json({
            success: true,
            data: {
                tax_inclusive: Boolean(storePayload.tax_inclusive),
                registration_configured: registrationConfigured,
                rates,
            },
        })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to load tax settings')
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    const denied = validateMerchantMutationRequest(request, { requireKey: false })
    if (denied) return denied
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const body = await request.json()
        const payload = await createMerchantApiClient(resolved.storeId).stores.update(resolved.storeId, {
            tax_inclusive: Boolean(body.tax_inclusive),
        })

        return NextResponse.json({ success: true, data: payload })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to update tax settings')
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    const denied = validateMerchantMutationRequest(request, { requireKey: false })
    if (denied) return denied
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const body = await request.json()
        const payload = await createMerchantApiClient(resolved.storeId).taxes.create({
            ...body,
            store_id: resolved.storeId,
        } as CreateTaxRateInput)

        return NextResponse.json({ success: true, data: payload })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to save tax rate')
    }
}
