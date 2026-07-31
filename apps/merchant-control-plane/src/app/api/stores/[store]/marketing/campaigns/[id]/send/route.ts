import { NextRequest, NextResponse } from 'next/server'
import type { SendMarketingEmailCampaignInput } from '@letbuyy/api-client'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

type RouteParams = { params: Promise<{ store: string; id: string }> }

// POST /api/stores/[store]/marketing/campaigns/[id]/send — send campaign (user-triggered only)
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const { store, id } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const body = await request.json().catch(() => null) as Record<string, unknown> | null
        if (!body || typeof body !== 'object') {
            return NextResponse.json(
                { error: { code: 'VALIDATION', message: 'Request body is required' } },
                { status: 400 },
            )
        }

        const idempotencyKey =
            typeof body.idempotency_key === 'string' && body.idempotency_key.trim()
                ? body.idempotency_key.trim()
                : crypto.randomUUID()

        const input: SendMarketingEmailCampaignInput = {
            store_id: resolved.storeId,
            idempotency_key: idempotencyKey,
        }

        const result = await createMerchantApiClient().marketing.emailCampaigns.send(id, input)
        return NextResponse.json({ data: result })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to send campaign')
    }
}
