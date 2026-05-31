import { NextRequest, NextResponse } from 'next/server'
import type { ResumeContentSection, UpdateResumeContentItemInput } from '@letbuyy/api-client'
import { createWorkerApiClient, workerErrorResponse } from '@/lib/api/worker-client'
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
        const payload = await createWorkerApiClient().resume.content.update(
            section as ResumeContentSection,
            itemId,
            body as UpdateResumeContentItemInput
        )

        return NextResponse.json({ success: true, data: payload })
    } catch (err) {
        return workerErrorResponse(err, 'Unable to update content item')
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

        const payload = await createWorkerApiClient().resume.content.remove(section as ResumeContentSection, itemId)

        return NextResponse.json({ success: true, data: payload })
    } catch (err) {
        return workerErrorResponse(err, 'Unable to delete content item')
    }
}
