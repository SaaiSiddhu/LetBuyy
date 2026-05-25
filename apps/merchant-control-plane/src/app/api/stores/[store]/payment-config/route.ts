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

        const workerResponse = await workerFetch(`/stores/${resolved.storeId}/payment-config`)
        const payload = await readWorkerJson(workerResponse)

        return NextResponse.json(payload)
    } catch (err) {
        return NextResponse.json(
            { error: 'Unable to load payment config' },
            { status: 500 }
        )
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
        const workerResponse = await workerFetch(`/stores/${resolved.storeId}/payment-config`, {
            method: 'POST',
            body: JSON.stringify({
                key_id: body.key_id,
                key_secret: body.key_secret,
                test_mode: Boolean(body.test_mode),
            }),
        })
        const payload = await readWorkerJson(workerResponse)

        return NextResponse.json(payload)
    } catch (err) {
        return NextResponse.json(
            { error: 'Unable to save payment config' },
            { status: 500 }
        )
    }
}
