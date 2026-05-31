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

        const collections = await createWorkerApiClient().products.collections.list({
            store_id: resolved.storeId,
        })

        return NextResponse.json({ data: collections })
    } catch (err) {
        return workerErrorResponse(err, 'Unable to load collections')
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
        const collection = await createWorkerApiClient().products.collections.create({
            ...body,
            store_id: resolved.storeId,
        })

        return NextResponse.json({ data: collection }, { status: 201 })
    } catch (err) {
        return workerErrorResponse(err, 'Unable to create collection')
    }
}
