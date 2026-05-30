import { NextRequest, NextResponse } from 'next/server'
import { readWorkerJson, workerFetch } from '@/lib/api/worker-client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

function normalizeStatus(status: string | null) {
    if (status === 'active') return 'active'
    if (status === 'draft' || status === 'inactive' || status === 'archived') return 'inactive'
    return 'all'
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const { searchParams } = new URL(request.url)
        const query = new URLSearchParams({
            store_id: resolved.storeId,
            status: normalizeStatus(searchParams.get('status')),
            page: searchParams.get('page') || '1',
            limit: searchParams.get('limit') || '100',
            sort: searchParams.get('sort') || 'created_at',
            order: searchParams.get('order') || 'desc',
        })

        if (searchParams.get('search')) query.set('search', searchParams.get('search')!)
        if (searchParams.get('category')) query.set('category', searchParams.get('category')!)

        const workerResponse = await workerFetch(`/products?${query.toString()}`, {
            requireSession: true,
        })
        const payload = await readWorkerJson(workerResponse)

        return NextResponse.json(payload)
    } catch (err) {
        return NextResponse.json(
            { error: 'Unable to load products' },
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
        const workerResponse = await workerFetch('/products', {
            method: 'POST',
            requireSession: true,
            body: JSON.stringify({
                ...body,
                store_id: resolved.storeId,
            }),
        })
        const payload = await readWorkerJson(workerResponse)

        return NextResponse.json(payload)
    } catch (err) {
        return NextResponse.json(
            { error: 'Unable to save product' },
            { status: 500 }
        )
    }
}
