import { NextRequest, NextResponse } from 'next/server'
import type { CreateMarketingEmailCampaignInput } from '@letbuyy/api-client'
import type {
    MarketingEmailAudience,
    MarketingEmailCampaignStatus,
} from '@letbuyy/shared-types'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

type RouteParams = { params: Promise<{ store: string }> }

const VALID_STATUSES: ReadonlyArray<MarketingEmailCampaignStatus> = [
    'draft',
    'scheduled',
    'sending',
    'sent',
    'failed',
    'cancelled',
]

function toStatusParam(value: string | null): MarketingEmailCampaignStatus | undefined {
    if (!value) return undefined
    return VALID_STATUSES.includes(value as MarketingEmailCampaignStatus)
        ? (value as MarketingEmailCampaignStatus)
        : undefined
}

// GET /api/stores/[store]/marketing/campaigns — list campaigns (paginated)
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const searchParams = request.nextUrl.searchParams
        const page = Math.max(1, Number(searchParams.get('page') || '1'))
        const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || '25')))
        const status = toStatusParam(searchParams.get('status'))

        const payload = await createMerchantApiClient().marketing.emailCampaigns.list({
            store_id: resolved.storeId,
            page,
            limit,
            ...(status !== undefined ? { status } : {}),
        })

        return NextResponse.json({
            data: payload.data,
            meta: {
                total: payload.total,
                page: payload.page,
                per_page: payload.limit,
                has_next: payload.has_more,
                has_prev: payload.page > 1,
            },
        })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to load campaigns')
    }
}

// POST /api/stores/[store]/marketing/campaigns — create campaign
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

        const input: CreateMarketingEmailCampaignInput = {
            store_id: resolved.storeId,
            name: typeof body.name === 'string' ? body.name : '',
            subject: typeof body.subject === 'string' ? body.subject : '',
            body_text: typeof body.body_text === 'string' ? body.body_text : '',
            audience,
            ...(typeof body.preview_text === 'string' ? { preview_text: body.preview_text } : {}),
            ...(typeof body.body_html === 'string' ? { body_html: body.body_html } : {}),
            ...(typeof body.scheduled_at === 'string' ? { scheduled_at: body.scheduled_at } : {}),
        }

        const campaign = await createMerchantApiClient().marketing.emailCampaigns.create(input)
        return NextResponse.json({ data: campaign }, { status: 201 })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to create campaign')
    }
}
