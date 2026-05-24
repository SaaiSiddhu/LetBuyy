import { NextRequest, NextResponse } from 'next/server'
import { readWorkerJson, workerFetch, workerErrorResponse } from '@/lib/api/worker-client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ store: string; policyId: string }> }
) {
    try {
        const { store, policyId } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const body = await request.json()
        const workerResponse = await workerFetch(`/pages/policies/${encodeURIComponent(policyId)}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        })
        const payload = await readWorkerJson(workerResponse)
        return NextResponse.json(payload)
    } catch (error) {
        return workerErrorResponse(error, 'Unable to update policy')
    }
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ store: string; policyId: string }> }
) {
    try {
        const { store, policyId } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const workerResponse = await workerFetch(`/pages/policies/${encodeURIComponent(policyId)}`, {
            method: 'DELETE',
        })
        const payload = await readWorkerJson(workerResponse)
        return NextResponse.json(payload)
    } catch (error) {
        return workerErrorResponse(error, 'Unable to delete policy')
    }
}
