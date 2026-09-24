import { NextRequest, NextResponse } from 'next/server'
import type { MarketingEmailAudience } from '@letbuyy/shared-types'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

type RouteParams = { params: Promise<{ store: string }> }

// POST /api/stores/[store]/marketing/campaigns/audience-preview — preview recipient count + sample
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const body = await request.json().catch(() => null) as Record<string, unknown> | null
        if (!body || typeof body !== 'object') {
            return NextResponse.json(
                { error: { code: 'VALIDATION', message: 'Request body is required' } },
                { status: 400 },
            )
        }

        const defaultAudience: MarketingEmailAudience = { type: 'all_marketing', recipients: [] }
        const audience =
            body.audience && typeof body.audience === 'object'
                ? (body.audience as MarketingEmailAudience)
                : defaultAudience

        const result = await createMerchantApiClient().marketing.emailCampaigns.previewAudience({
            store_id: resolved.storeId,
            audience,
        })
        return NextResponse.json({ data: result })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to preview audience')
    }
}
