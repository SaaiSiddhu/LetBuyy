import { NextRequest, NextResponse } from 'next/server'
import { readWorkerJson, workerFetch } from '@/lib/api/worker-client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const formData = await request.formData()
        const file = formData.get('file')
        if (!file || typeof file === 'string') {
            return NextResponse.json({ error: 'File is required' }, { status: 400 })
        }

        formData.set('folder', `${resolved.storeId}/products`)

        const uploadResponse = await workerFetch('/upload', {
            method: 'POST',
            body: formData,
        })
        const uploadPayload = await readWorkerJson(uploadResponse)
        const uploaded = uploadPayload?.data

        if (uploaded?.url) {
            await workerFetch('/media', {
                method: 'POST',
                body: JSON.stringify({
                    store_id: resolved.storeId,
                    filename: uploaded.key || (file as File).name,
                    original_name: (file as File).name,
                    url: uploaded.url,
                    mime_type: (file as File).type || uploaded.content_type || 'application/octet-stream',
                    size_bytes: (file as File).size || uploaded.size || 0,
                    folder: 'products',
                }),
            }).then(readWorkerJson).catch(() => null)
        }

        return NextResponse.json(uploadPayload)
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Unable to upload file' },
            { status: 500 }
        )
    }
}
