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

        const giftCards = await createWorkerApiClient().products.giftCards.list({
            store_id: resolved.storeId,
        })

        return NextResponse.json({ data: giftCards })
    } catch (err) {
        return workerErrorResponse(err, 'Unable to load gift cards')
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
        const giftCard = await createWorkerApiClient().products.giftCards.create({
            ...body,
            store_id: resolved.storeId,
        })

        return NextResponse.json({ data: giftCard }, { status: 201 })
    } catch (err) {
        return workerErrorResponse(err, 'Unable to issue gift card')
    }
}
