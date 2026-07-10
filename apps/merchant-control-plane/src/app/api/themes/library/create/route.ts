import { NextRequest, NextResponse } from 'next/server'
import { merchantApiFetch, merchantApiErrorResponse, readMerchantApiJson } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

/**
 * POST /api/themes/library/create
 *
 * Creates a new blank site-owned theme for the authenticated merchant's store.
 * Enforces theme count limits server-side (gateway returns 409 THEME_LIMIT_REACHED).
 * Body: { store_name: string; name: string; template_slug?: string }
 *
 * Gateway route: POST /themes/library/create
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({})) as Record<string, unknown>
        const storeName = typeof body.store_name === 'string' ? body.store_name : ''
        const name = typeof body.name === 'string' ? body.name.trim() : ''
        const templateSlug = typeof body.template_slug === 'string' ? body.template_slug : undefined

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

        const gatewayBody: Record<string, unknown> = {
            store_id: resolved.storeId,
            name,
        }
        if (templateSlug) gatewayBody.template_slug = templateSlug

        const res = await merchantApiFetch('/themes/library/create', {
            method: 'POST',
            body: JSON.stringify(gatewayBody),
            requireSession: true,
        })
        const data = await readMerchantApiJson(res)
        return NextResponse.json(data, { status: 201 })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to create theme')
    }
}
