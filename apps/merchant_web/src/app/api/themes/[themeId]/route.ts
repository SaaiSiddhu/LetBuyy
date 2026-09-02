import { NextRequest, NextResponse } from 'next/server'
import { merchantApiFetch, merchantApiErrorResponse, readMerchantApiJson } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

/**
 * DELETE /api/themes/[themeId]?store_name=xxx
 *
 * Deletes an unpublished site theme (soft-delete). The gateway blocks deletion of
 * the currently published theme (returns 409 CANNOT_DELETE_PUBLISHED_THEME).
 * Query: store_name=<handle>
 *
 * Gateway route: DELETE /themes/:slug/unpublished?store_id=<uuid>
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ themeId: string }> }
) {
    try {
        const { themeId } = await params
        const { searchParams } = new URL(request.url)
        const storeName = searchParams.get('store_name') ?? ''

        if (!storeName) {
            return NextResponse.json(
                { error: { code: 'MISSING_PARAM', message: 'store_name query parameter is required' } },
                { status: 400 }
            )
        }

        const resolved = await resolveOwnedStoreId(storeName)
        if (resolved.error) return resolved.error

        const res = await merchantApiFetch(
            `/themes/${encodeURIComponent(themeId)}/unpublished?store_id=${encodeURIComponent(resolved.storeId)}`,
            {
                method: 'DELETE',
                requireSession: true,
            }
        )
        const data = await readMerchantApiJson(res)
        return NextResponse.json(data)
    } catch (err) {
        // Gateway 409 CANNOT_DELETE_PUBLISHED_THEME is passed through so the UI
        // can surface a merchant-friendly message ("Cannot delete the currently published theme").
        return merchantApiErrorResponse(err, 'Unable to delete theme')
    }
}
