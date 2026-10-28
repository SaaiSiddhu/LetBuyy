import { NextRequest, NextResponse } from 'next/server'
import { SaveStorePaymentConfigSchema, UpdateStorePaymentMethodsSchema } from '@letbuyy/shared-types'
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

        const payload = await createMerchantApiClient().stores.paymentConfig.get(resolved.storeId)

        return NextResponse.json({ success: true, data: payload })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to load payment config')
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

        const parsed = SaveStorePaymentConfigSchema.safeParse(await request.json().catch(() => null))
        if (!parsed.success) return NextResponse.json({ error: { code: 'VALIDATION', message: 'Enter valid Razorpay credentials matching the selected environment.' } }, { status: 400 })
        const payload = await createMerchantApiClient().stores.paymentConfig.save(
            resolved.storeId,
            parsed.data,
            { idempotencyKey: request.headers.get('X-Idempotency-Key') }
        )

        return NextResponse.json({ success: true, data: payload })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to save payment config')
    }
}

// PATCH /api/stores/[store]/payment-config — Toggle cod_enabled / online_payment_enabled
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const parsed = UpdateStorePaymentMethodsSchema.safeParse(await request.json().catch(() => null))
        if (!parsed.success) return NextResponse.json({ error: { code: 'VALIDATION', message: 'Choose a valid payment method setting.' } }, { status: 400 })
        const payload = await createMerchantApiClient().stores.paymentConfig.updateMethods(
            resolved.storeId, parsed.data, { idempotencyKey: request.headers.get('X-Idempotency-Key') },
        )
        return NextResponse.json({ success: true, data: payload })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to update payment toggles')
    }
}
