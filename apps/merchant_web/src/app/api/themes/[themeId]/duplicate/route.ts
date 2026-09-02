import { NextRequest, NextResponse } from 'next/server'
import { merchantApiFetch, merchantApiErrorResponse, readMerchantApiJson } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

/**
 * POST /api/themes/[themeId]/duplicate
 *
 * Duplicates an installed theme within the authenticated merchant's store.
 * Gateway verifies site ownership and returns 404 (not 403) on cross-site IDs.
 * Enforces theme count limits (gateway returns 409 THEME_LIMIT_REACHED).
 * Body: { store_name: string; name?: string }
 *
 * Gateway route: POST /themes/:slug/duplicate
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

        const gatewayBody: Record<string, unknown> = { store_id: resolved.storeId }
        if (typeof body.name === 'string' && body.name.trim()) {
            gatewayBody.name = body.name.trim()
        }

        const res = await merchantApiFetch(`/themes/${encodeURIComponent(themeId)}/duplicate`, {
            method: 'POST',
            body: JSON.stringify(gatewayBody),
            requireSession: true,
        })
        const data = await readMerchantApiJson(res)
        return NextResponse.json(data, { status: 201 })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to duplicate theme')
    }
}
