import { NextRequest, NextResponse } from 'next/server'
import { readWorkerJson, workerFetch } from '@/lib/api/worker-client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ store: string; categoryId: string }> }
) {
    try {
        const { store, categoryId } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const body = await request.json()
        const workerResponse = await workerFetch(`/categories/${encodeURIComponent(categoryId)}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        })
        const payload = await readWorkerJson(workerResponse)

        return NextResponse.json(payload)
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Unable to update category' },
            { status: 500 }
        )
    }
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ store: string; categoryId: string }> }
) {
    try {
        const { store, categoryId } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const workerResponse = await workerFetch(`/categories/${encodeURIComponent(categoryId)}`, {
            method: 'DELETE',
        })
        const payload = await readWorkerJson(workerResponse)

        return NextResponse.json(payload)
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Unable to delete category' },
            { status: 500 }
        )
    }
}
