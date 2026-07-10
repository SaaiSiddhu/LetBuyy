import { NextRequest, NextResponse } from 'next/server'
import { merchantApiFetch, merchantApiErrorResponse, readMerchantApiJson } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

/**
 * PATCH /api/themes/[themeId]/rename
 *
 * Renames a site theme. Scoped to the authenticated merchant's store.
 * Body: { store_name: string; name: string }
 *
 * Gateway route: PATCH /themes/:slug/rename
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ themeId: string }> }
) {
    try {
        const { themeId } = await params
        const body = await request.json().catch(() => ({})) as Record<string, unknown>
        const storeName = typeof body.store_name === 'string' ? body.store_name : ''
        const name = typeof body.name === 'string' ? body.name.trim() : ''

        if (!storeName) {
            return NextResponse.json(
                { error: { code: 'MISSING_PARAM', message: 'store_name is required' } },
                { status: 400 }
            )
        }
        if (!name) {
            return NextResponse.json(
                { error: { code: 'MISSING_PARAM', message: 'name is required' } },
                { status: 400 }
            )
        }
        if (name.length > 120) {
            return NextResponse.json(
                { error: { code: 'VALIDATION', message: 'Theme name must be 120 characters or fewer' } },
                { status: 400 }
            )
        }

        const resolved = await resolveOwnedStoreId(storeName)
        if (resolved.error) return resolved.error

        const res = await merchantApiFetch(`/themes/${encodeURIComponent(themeId)}/rename`, {
            method: 'PATCH',
            body: JSON.stringify({ store_id: resolved.storeId, name }),
            requireSession: true,
        })
        const data = await readMerchantApiJson(res)
        return NextResponse.json(data)
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to rename theme')
    }
}
