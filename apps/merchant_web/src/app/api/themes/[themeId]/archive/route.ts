import { NextRequest, NextResponse } from 'next/server'
import { merchantApiFetch, merchantApiErrorResponse, readMerchantApiJson } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

/**
 * POST /api/themes/[themeId]/archive
 *
 * Archives an unpublished site theme. The gateway blocks archiving the currently
 * published theme (returns 409 THEME_CURRENTLY_PUBLISHED).
 * Body: { store_name: string }
 *
 * Gateway route: POST /themes/:slug/archive
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ themeId: string }> }
) {
    try {
        const { themeId } = await params
        const body = await request.json().catch(() => ({})) as Record<string, unknown>
        const storeName = typeof body.store_name === 'string' ? body.store_name : ''

        if (!storeName) {
            return NextResponse.json(
                { error: { code: 'MISSING_PARAM', message: 'store_name is required' } },
                { status: 400 }
            )
        }

        const resolved = await resolveOwnedStoreId(storeName)
        if (resolved.error) return resolved.error

        const res = await merchantApiFetch(`/themes/${encodeURIComponent(themeId)}/archive`, {
            method: 'POST',
            body: JSON.stringify({ store_id: resolved.storeId }),
            requireSession: true,
        })
        const data = await readMerchantApiJson(res)
        return NextResponse.json(data)
    } catch (err) {
        // Gateway 409 THEME_CURRENTLY_PUBLISHED is passed through so the UI
        // can surface a merchant-friendly message ("Cannot archive your current theme").
        return merchantApiErrorResponse(err, 'Unable to archive theme')
    }
}
