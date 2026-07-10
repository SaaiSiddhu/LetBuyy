import { NextRequest, NextResponse } from 'next/server'
import { merchantApiFetch, merchantApiErrorResponse, readMerchantApiJson } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

/**
 * GET /api/themes/library?store_name=xxx
 *
 * Returns all theme instances installed on a site (library listing).
 * Thin proxy only — resolves owned storeId server-side from authenticated session.
 * Never trusts browser-supplied store UUIDs: storeId is resolved from store_name.
 *
 * Gateway route: GET /themes/library?store_id=<uuid>
 * Response shape mirrors gateway LibrarySiteThemesResult.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const storeName = searchParams.get('store_name')

        if (!storeName) {
            return NextResponse.json(
                { error: { code: 'MISSING_PARAM', message: 'store_name query parameter is required' } },
                { status: 400 }
            )
        }

        const resolved = await resolveOwnedStoreId(storeName)
        if (resolved.error) return resolved.error

        const res = await merchantApiFetch(
            `/themes/library?store_id=${encodeURIComponent(resolved.storeId)}`,
            { requireSession: true }
        )
        const data = await readMerchantApiJson(res)
        return NextResponse.json(data)
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to load theme library')
    }
}
