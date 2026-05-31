import { NextRequest, NextResponse } from 'next/server'
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

        const apiClient = createWorkerApiClient()
        const [subscriptionPayload, historyPayload, paymentPayload] = await Promise.all([
            apiClient.payments.subscription.get({ store_id: resolved.storeId }),
            apiClient.payments.subscription.history({ store_id: resolved.storeId }),
            apiClient.stores.paymentConfig.get(resolved.storeId),
        ])

        return NextResponse.json({
            data: {
                subscription: subscriptionPayload.subscription || null,
                invoices: historyPayload,
                payment: paymentPayload || null,
            },
        })
    } catch (err) {
        return workerErrorResponse(err, 'Unable to load billing data')
    }
}
