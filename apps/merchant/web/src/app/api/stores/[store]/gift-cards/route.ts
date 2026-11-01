import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'
import { CreateGiftCardSchema } from '@letbuyy/commerce-core'
import { z } from 'zod'

const IssueInputSchema = CreateGiftCardSchema.omit({ store_id: true, idempotency_key: true }).extend({
    intent_id: z.uuid(),
}).strict()

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const giftCards = await createMerchantApiClient().products.giftCards.list({
            store_id: resolved.storeId,
        })

        return NextResponse.json({ data: giftCards })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to load gift cards')
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const parsed = IssueInputSchema.safeParse(await request.json().catch(() => null))
        if (!parsed.success) {
            return NextResponse.json({ error: { code: 'INVALID_GIFT_CARD_ISSUE', message: 'Enter a valid gift card value and issue request.' } }, { status: 400 })
        }
        const { intent_id: intentId, ...details } = parsed.data
        const giftCard = await createMerchantApiClient().products.giftCards.create({
            ...details,
            store_id: resolved.storeId,
            idempotency_key: `gift_card.issue:${resolved.storeId}:${intentId}`,
        })

        return NextResponse.json({ data: giftCard }, { status: giftCard.replayed ? 200 : 201 })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to issue gift card')
    }
}
