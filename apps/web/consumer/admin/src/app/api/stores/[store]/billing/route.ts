import { NextRequest, NextResponse } from 'next/server'
import { readWorkerJson, workerFetch } from '@/lib/api/worker-client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const [subscriptionResponse, historyResponse, paymentResponse] = await Promise.all([
            workerFetch(`/payments/subscription?store_id=${encodeURIComponent(resolved.storeId)}`),
            workerFetch(`/payments/subscription/history?store_id=${encodeURIComponent(resolved.storeId)}`),
            workerFetch(`/stores/${encodeURIComponent(resolved.storeId)}/payment-config`),
        ])

        const subscriptionPayload = await readWorkerJson(subscriptionResponse)
        const historyPayload = await readWorkerJson(historyResponse)
        const paymentPayload = await readWorkerJson(paymentResponse)

        return NextResponse.json({
            data: {
                subscription: subscriptionPayload?.data?.subscription || null,
                invoices: historyPayload?.data || [],
                payment: paymentPayload?.data || null,
            },
        })
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Unable to load billing data' },
            { status: 500 }
        )
    }
}
