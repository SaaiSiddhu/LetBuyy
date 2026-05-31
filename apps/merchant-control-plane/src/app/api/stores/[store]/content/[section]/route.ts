import { NextRequest, NextResponse } from 'next/server'
import type { CreateResumeContentItemInput, ResumeContentSection } from '@letbuyy/api-client'
import { createWorkerApiClient, workerErrorResponse } from '@/lib/api/worker-client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ store: string; section: string }> }
) {
    try {
        const { store, section } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const payload = await createWorkerApiClient().resume.content.list(section as ResumeContentSection, {
            store_id: resolved.storeId,
        })

        return NextResponse.json({ success: true, data: payload })
    } catch (err) {
        return workerErrorResponse(err, 'Unable to load content section')
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
        const payload = await createWorkerApiClient().resume.content.create(
            section as ResumeContentSection,
            {
                ...body,
                store_id: resolved.storeId,
            } as CreateResumeContentItemInput
        )

        return NextResponse.json({ success: true, data: payload })
    } catch (err) {
        return workerErrorResponse(err, 'Unable to save content item')
    }
}
