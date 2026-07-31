import { NextRequest, NextResponse } from 'next/server'
import type { SaveStorePaymentConfigInput } from '@letbuyy/api-client'
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

        const body = await request.json()
        const payload = await createMerchantApiClient().stores.paymentConfig.save(
            resolved.storeId,
            {
                key_id: body.key_id,
                key_secret: body.key_secret,
                test_mode: Boolean(body.test_mode),
            } as SaveStorePaymentConfigInput
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

        const body = await request.json() as { cod_enabled?: boolean; online_payment_enabled?: boolean }

        const updates: Record<string, boolean> = {}
        if (typeof body.cod_enabled === 'boolean') updates.cod_enabled = body.cod_enabled
        if (typeof body.online_payment_enabled === 'boolean') updates.online_payment_enabled = body.online_payment_enabled

        if (Object.keys(updates).length === 0) {
            return NextResponse.json(
                { error: { code: 'VALIDATION', message: 'No valid toggle fields provided' } },
                { status: 400 }
            )
        }

        // stores.update accepts Partial<Store> — cod_enabled/online_payment_enabled are
        // payment-adjacent columns added to the gateway PATCH allowed list.
        // The cast bridges the shared-types Store schema (which omits these columns) to
        // the actual DB columns that the gateway now writes.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await createMerchantApiClient().stores.update(resolved.storeId, updates as any)

        // Re-fetch the payment config so the response shape matches GET
        const payload = await createMerchantApiClient().stores.paymentConfig.get(resolved.storeId)
        return NextResponse.json({ success: true, data: payload })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to update payment toggles')
    }
}
