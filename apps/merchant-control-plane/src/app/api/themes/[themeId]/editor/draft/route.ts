import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

/**
 * POST /api/themes/[themeId]/editor/draft?store_name=xxx
 *
 * Auto-save draft every N seconds when the editor is dirty.
 * Body: { draftConfig }
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ themeId: string }> }
) {
    try {
        const { themeId } = await params
        const { searchParams } = new URL(request.url)
        const storeName = searchParams.get('store_name')

        if (!storeName) {
            return NextResponse.json(
                { error: 'store_name query parameter is required' },
                { status: 400 }
            )
        }

        const body = await request.json()
        const { draftConfig } = body

        if (!draftConfig) {
            return NextResponse.json(
                { error: 'draftConfig is required in body' },
                { status: 400 }
            )
        }

        const resolved = await resolveOwnedStoreId(storeName)
        if (resolved.error) return resolved.error

        const payload = await createMerchantApiClient().themes.saveDraft(themeId, {
            store_id: resolved.storeId,
            template_config: draftConfig,
            client: 'admin-web',
        })

        return NextResponse.json({
            success: true,
            savedAt: payload.saved_at || new Date().toISOString(),
            version: payload.version,
        })
    } catch (err) {
        return merchantApiErrorResponse(err)
    }
}

/**
 * DELETE /api/themes/[themeId]/editor/draft?store_name=xxx
 *
 * Discard saved draft (e.g., when user clicks "discard changes").
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ themeId: string }> }
) {
    try {
        const { themeId } = await params
        const { searchParams } = new URL(request.url)
        const storeName = searchParams.get('store_name')

        if (!storeName) {
            return NextResponse.json(
                { error: 'store_name query parameter is required' },
                { status: 400 }
            )
        }

        const resolved = await resolveOwnedStoreId(storeName)
        if (resolved.error) return resolved.error

        await createMerchantApiClient().themes.deleteDraft(themeId, resolved.storeId)

        return NextResponse.json({ success: true })
    } catch (err) {
        return merchantApiErrorResponse(err)
    }
}
