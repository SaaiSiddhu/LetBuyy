import { NextRequest, NextResponse } from 'next/server'
import { UpdateStoreSchema } from '@letbuyy/tenant-core'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'
// Phase AA — SAFE-CSS LAW: server-side validation guards the DB even when the UI is bypassed.
import { validateCustomCss } from '@letbuyy/theme-engine'
import { merchantSecurityScope, privateSecurityResponse } from '@/lib/api/merchant-security-scope'
import { validateMerchantMutationRequest } from '@/lib/api/request-origin'

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return privateSecurityResponse(resolved.error)

        const payload = await createMerchantApiClient().stores.get(resolved.storeId)

        return privateSecurityResponse(NextResponse.json({ success: true, data: payload }))
    } catch (err) {
        return privateSecurityResponse(merchantApiErrorResponse(err, 'Unable to load store settings'))
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const denied = validateMerchantMutationRequest(request, { requireKey: false })
        if (denied) return privateSecurityResponse(denied)
        const { store } = await params
        const input: unknown = await request.json().catch(() => null)
        const parsed = UpdateStoreSchema.safeParse(input)
        if (!parsed.success) return privateSecurityResponse(NextResponse.json({
            error: { code: 'VALIDATION_ERROR', message: 'Review the store settings fields.' },
        }, { status: 400 }))
        const body = parsed.data
        let storeId: string
        let commandHeaders: Record<string, string> | undefined
        if (body.version !== undefined) {
            // Every committable profile edit carries a revision. Bind this
            // versioned protocol to the current actor, origin and original key.
            const scope = await merchantSecurityScope(request, Promise.resolve({ store }))
            if (scope.error) return scope.error
            storeId = scope.storeId!
            commandHeaders = scope.headers
        } else {
            const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
            if (resolved.error) return privateSecurityResponse(resolved.error)
            storeId = resolved.storeId!
        }

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

        const payload = await createMerchantApiClient(storeId).stores.update(storeId, body, { headers: commandHeaders })

        return privateSecurityResponse(NextResponse.json({ success: true, data: payload }))
    } catch (err) {
        return privateSecurityResponse(merchantApiErrorResponse(err, 'Unable to update store settings'))
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const scope = await merchantSecurityScope(request, params)
        if (scope.error) return scope.error
        const payload = await createMerchantApiClient(scope.storeId).stores.remove(scope.storeId!, { headers: scope.headers })

        return privateSecurityResponse(NextResponse.json({ success: true, data: payload }))
    } catch (err) {
        return privateSecurityResponse(merchantApiErrorResponse(err, 'Unable to close store'))
    }
}
