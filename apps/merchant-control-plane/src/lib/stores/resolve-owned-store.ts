import { NextResponse } from 'next/server'
import { readWorkerJson, workerFetch } from '@/lib/api/worker-client'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i

export async function resolveOwnedStoreId(storeParam: string) {
    const lookupPath = UUID_RE.test(storeParam)
        ? `/stores/${encodeURIComponent(storeParam)}`
        : `/stores/handle/${encodeURIComponent(storeParam)}`

    const response = await workerFetch(lookupPath, {
        method: 'GET',
        requireSession: true,
    })

    if (response.status === 401) {
        return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
    }

    if (response.status === 404) {
        return { error: NextResponse.json({ error: 'Store not found' }, { status: 404 }) }
    }

    try {
        const payload = await readWorkerJson(response) as { data?: { id?: string } }
        if (payload.data?.id) {
            return { storeId: payload.data.id }
        }
    } catch {
        return { error: NextResponse.json({ error: 'Store not found' }, { status: 404 }) }
    }

    return { error: NextResponse.json({ error: 'Store not found' }, { status: 404 }) }
}
