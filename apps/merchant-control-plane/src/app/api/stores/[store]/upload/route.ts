import { NextRequest, NextResponse } from 'next/server'
import type { CreateMediaInput } from '@letbuyy/api-client'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
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
        const uploadFile = file as File

        formData.set('folder', `${resolved.storeId}/products`)
        formData.set('store_id', resolved.storeId)

        const apiClient = createMerchantApiClient()
        const uploaded = await apiClient.upload.file(formData, { query: { store_id: resolved.storeId } })

        if (uploaded?.url) {
            await apiClient.media.create({
                store_id: resolved.storeId,
                filename: uploaded.key || uploadFile.name,
                original_name: uploadFile.name,
                url: uploaded.url,
                mime_type: uploadFile.type || uploaded.content_type || 'application/octet-stream',
                size_bytes: uploadFile.size || uploaded.size || 0,
                folder: 'products',
            } as CreateMediaInput).catch(() => null)
        }

        return NextResponse.json({ data: uploaded }, { status: 201 })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to upload file')
    }
}
