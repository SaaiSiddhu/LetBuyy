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

        const categories = await createWorkerApiClient().categories.list({
            store_id: resolved.storeId,
            flat: true,
        })

        return NextResponse.json({ data: categories })
    } catch (err) {
        return workerErrorResponse(err, 'Unable to load categories')
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
        const category = await createWorkerApiClient().categories.create({
            ...body,
            store_id: resolved.storeId,
        })

        return NextResponse.json({ data: category }, { status: 201 })
    } catch (err) {
        return workerErrorResponse(err, 'Unable to save category')
    }
}
