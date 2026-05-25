import { NextRequest, NextResponse } from 'next/server'
import { readWorkerJson, workerFetch } from '@/lib/api/worker-client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ store: string; employeeId: string }> }
) {
    try {
        const { store, employeeId } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const body = await request.json()
        const workerResponse = await workerFetch(`/employees/${encodeURIComponent(employeeId)}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        })
        const payload = await readWorkerJson(workerResponse)

        return NextResponse.json(payload)
    } catch (err) {
        return NextResponse.json(
            { error: 'Unable to update staff member' },
            { status: 500 }
        )
    }
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ store: string; employeeId: string }> }
) {
    try {
        const { store, employeeId } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const workerResponse = await workerFetch(`/employees/${encodeURIComponent(employeeId)}`, {
            method: 'DELETE',
        })
        const payload = await readWorkerJson(workerResponse)

        return NextResponse.json(payload)
    } catch (err) {
        return NextResponse.json(
            { error: 'Unable to remove staff member' },
            { status: 500 }
        )
    }
}
