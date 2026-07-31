import { NextRequest, NextResponse } from 'next/server'
import type { UpdateStoreInput } from '@letbuyy/api-client'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'
// Phase AA — SAFE-CSS LAW: server-side validation guards the DB even when the UI is bypassed.
import { validateCustomCss } from '@letbuyy/theme-engine'

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const payload = await createMerchantApiClient().stores.get(resolved.storeId)

        return NextResponse.json({ success: true, data: payload })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to load store settings')
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const body = await request.json()

        // Phase AA — server-side CSS validation (SAFE-CSS LAW).
        // The client-side validateCustomCss() in appearance/page.tsx can be bypassed by
        // direct API calls.  This gateway-level guard ensures malicious CSS is never persisted.
        const rawCss = (body as Record<string, unknown>)?.site_settings &&
            typeof ((body as Record<string, unknown>).site_settings as Record<string, unknown>)?.custom_css === 'string'
            ? ((body as Record<string, unknown>).site_settings as Record<string, unknown>).custom_css as string
            : undefined
        if (typeof rawCss === 'string' && rawCss.trim()) {
            const cssResult = validateCustomCss(rawCss)
            if (!cssResult.ok) {
                return NextResponse.json(
                    {
                        error: 'Custom CSS contains unsafe constructs. Fix the listed violations before saving.',
                        violations: cssResult.violations,
                    },
                    { status: 422 },
                )
            }
        }

        const payload = await createMerchantApiClient().stores.update(resolved.storeId, body as UpdateStoreInput)

        return NextResponse.json({ success: true, data: payload })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to update store settings')
    }
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const payload = await createMerchantApiClient().stores.remove(resolved.storeId)

        return NextResponse.json({ success: true, data: payload })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to delete store')
    }
}
