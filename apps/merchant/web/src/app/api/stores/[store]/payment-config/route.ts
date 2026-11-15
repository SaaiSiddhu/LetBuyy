import { NextRequest, NextResponse } from 'next/server'
import { AttachStorePaymentWebhookSchema, SaveStorePaymentConfigSchema, UpdateStorePaymentMethodsSchema } from '@letbuyy/shared-types'
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

        const input = await request.json().catch(() => null)
        const attached = AttachStorePaymentWebhookSchema.safeParse(input)
        const saved = attached.success ? null : SaveStorePaymentConfigSchema.safeParse(input)
        if (!attached.success && !saved?.success) return NextResponse.json({ error: { code: 'VALIDATION', message: 'Enter valid test credentials or a webhook secret for the saved test connection.' } }, { status: 400 })
        const client = createMerchantApiClient().stores.paymentConfig
        const options = { idempotencyKey: request.headers.get('X-Idempotency-Key') }
        let payload
        if (attached.success) payload = await client.attachWebhook(resolved.storeId, attached.data, options)
        else if (saved?.success) payload = await client.save(resolved.storeId, saved.data, options)
        else return NextResponse.json({ error: { code: 'VALIDATION', message: 'Enter valid test credentials or a webhook secret for the saved test connection.' } }, { status: 400 })

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
