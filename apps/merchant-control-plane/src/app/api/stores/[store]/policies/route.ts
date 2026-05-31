import { NextRequest, NextResponse } from 'next/server'
import { createWorkerApiClient, workerErrorResponse } from '@/lib/api/worker-client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

function normalizePolicyStatus(value: string | null) {
    return value === 'draft' || value === 'published' || value === 'archived' ? value : 'all'
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const searchParams = request.nextUrl.searchParams
        const payload = await createWorkerApiClient().pages.policies.list({
            store_id: resolved.storeId,
            status: normalizePolicyStatus(searchParams.get('status')),
        })
        return NextResponse.json({ success: true, data: payload })
    } catch (error) {
        return workerErrorResponse(error, 'Unable to load policies')
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
        const payload = await createWorkerApiClient().pages.policies.create({
            ...body,
            store_id: resolved.storeId,
        })
        return NextResponse.json({ success: true, data: payload })
    } catch (error) {
        return workerErrorResponse(error, 'Unable to save policy')
    }
}
