import { NextRequest, NextResponse } from 'next/server'
import { readWorkerJson, workerFetch } from '@/lib/api/worker-client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ store: string; section: string; itemId: string }> }
) {
    try {
        const { store, section, itemId } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const body = await request.json()
        const workerResponse = await workerFetch(`/resume/section/${encodeURIComponent(section)}/${encodeURIComponent(itemId)}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        })
        const payload = await readWorkerJson(workerResponse)

        return NextResponse.json(payload)
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Unable to update content item' },
            { status: 500 }
        )
    }
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ store: string; section: string; itemId: string }> }
) {
    try {
        const { store, section, itemId } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const workerResponse = await workerFetch(`/resume/section/${encodeURIComponent(section)}/${encodeURIComponent(itemId)}`, {
            method: 'DELETE',
        })
        const payload = await readWorkerJson(workerResponse)

        return NextResponse.json(payload)
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Unable to delete content item' },
            { status: 500 }
        )
    }
}
