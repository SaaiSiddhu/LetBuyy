import { NextRequest, NextResponse } from 'next/server'
import { readWorkerJson, workerFetch } from '@/lib/api/worker-client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

type RouteParams = {
    params: Promise<{
        store: string
        productId: string
    }>
}

function jsonError(_error: unknown, fallback: string, status = 500) {
    return NextResponse.json({ error: fallback }, { status })
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
    try {
        const { store, productId } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const workerResponse = await workerFetch(`/products/${encodeURIComponent(productId)}`, {
            requireSession: true,
        })
        const payload = await readWorkerJson(workerResponse) as { data?: { store_id?: string } }

        if (!payload.data || payload.data.store_id !== resolved.storeId) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 })
        }

        return NextResponse.json(payload)
    } catch (err) {
        return jsonError(err, 'Unable to load product')
    }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const { store, productId } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const body = await request.json()
        const workerResponse = await workerFetch(`/products/${encodeURIComponent(productId)}`, {
            method: 'PATCH',
            requireSession: true,
            body: JSON.stringify(body),
        })
        const payload = await readWorkerJson(workerResponse)

        return NextResponse.json(payload)
    } catch (err) {
        return jsonError(err, 'Unable to update product')
    }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
    try {
        const { store, productId } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const workerResponse = await workerFetch(`/products/${encodeURIComponent(productId)}`, {
            method: 'DELETE',
            requireSession: true,
        })
        const payload = await readWorkerJson(workerResponse)

        return NextResponse.json(payload)
    } catch (err) {
        return jsonError(err, 'Unable to delete product')
    }
}
