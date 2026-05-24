import { NextRequest, NextResponse } from 'next/server'
import { readWorkerJson, workerFetch } from '@/lib/api/worker-client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

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
            page: searchParams.get('page') || '1',
            limit: searchParams.get('limit') || '100',
        })
        if (searchParams.get('status') && searchParams.get('status') !== 'all') {
            query.set('status', searchParams.get('status')!)
        }

        const workerResponse = await workerFetch(`/blog/posts?${query.toString()}`)
        const payload = await readWorkerJson(workerResponse)

        return NextResponse.json(payload)
    } catch (err) {
        return NextResponse.json(
            { error: 'Unable to load posts' },
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
        const workerResponse = await workerFetch('/blog/posts', {
            method: 'POST',
            body: JSON.stringify({
                ...body,
                store_id: resolved.storeId,
                content: body.content || '',
            }),
        })
        const payload = await readWorkerJson(workerResponse)

        return NextResponse.json(payload)
    } catch (err) {
        return NextResponse.json(
            { error: 'Unable to save post' },
            { status: 500 }
        )
    }
}
