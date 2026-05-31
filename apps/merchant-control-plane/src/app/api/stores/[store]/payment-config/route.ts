import { NextRequest, NextResponse } from 'next/server'
import type { SaveStorePaymentConfigInput } from '@letbuyy/api-client'
import { createWorkerApiClient, workerErrorResponse } from '@/lib/api/worker-client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const payload = await createWorkerApiClient().stores.paymentConfig.get(resolved.storeId)

        return NextResponse.json({ success: true, data: payload })
    } catch (err) {
        return workerErrorResponse(err, 'Unable to load payment config')
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
        const payload = await createWorkerApiClient().stores.paymentConfig.save(
            resolved.storeId,
            {
                key_id: body.key_id,
                key_secret: body.key_secret,
                test_mode: Boolean(body.test_mode),
            } as SaveStorePaymentConfigInput
        )

        return NextResponse.json({ success: true, data: payload })
    } catch (err) {
        return workerErrorResponse(err, 'Unable to save payment config')
    }
}
