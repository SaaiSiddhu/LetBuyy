import { NextRequest, NextResponse } from 'next/server'
import { readWorkerJson, workerFetch } from '@/lib/api/worker-client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ store: string; section: string }> }
) {
    try {
        const { store, section } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const query = new URLSearchParams({ store_id: resolved.storeId })
        const workerResponse = await workerFetch(`/resume/section/${encodeURIComponent(section)}?${query.toString()}`)
        const payload = await readWorkerJson(workerResponse)

        return NextResponse.json(payload)
    } catch (err) {
        return NextResponse.json(
            { error: 'Unable to load content section' },
            { status: 500 }
        )
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ store: string; section: string }> }
) {
    try {
        const { store, section } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const body = await request.json()
        const workerResponse = await workerFetch(`/resume/section/${encodeURIComponent(section)}`, {
            method: 'POST',
            body: JSON.stringify({
                ...body,
                store_id: resolved.storeId,
            }),
        })
        const payload = await readWorkerJson(workerResponse)

        return NextResponse.json(payload)
    } catch (err) {
        return NextResponse.json(
            { error: 'Unable to save content item' },
            { status: 500 }
        )
    }
}
