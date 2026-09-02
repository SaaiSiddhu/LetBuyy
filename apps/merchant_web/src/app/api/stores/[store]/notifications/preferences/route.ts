import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

// GET /api/stores/[store]/notifications/preferences
// Returns all notification_preferences rows for the authed user scoped to this store.
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const preferences = await createMerchantApiClient().notifications.preferences.list({
            store_id: resolved.storeId,
        })

        return NextResponse.json({ data: preferences })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to load notification preferences')
    }
}

// PUT /api/stores/[store]/notifications/preferences
// Upserts a single channel+category preference for the authed user in this store.
// Body: { channel: string; category: string; enabled?: boolean }
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

        const channel = typeof body.channel === 'string' ? body.channel.trim() : ''
        const category = typeof body.category === 'string' ? body.category.trim() : ''

        if (!channel || !category) {
            return NextResponse.json(
                { error: { code: 'VALIDATION', message: 'channel and category are required' } },
                { status: 400 }
            )
        }

        const preference = await createMerchantApiClient().notifications.preferences.update({
            store_id: resolved.storeId,
            channel,
            category,
            enabled: typeof body.enabled === 'boolean' ? body.enabled : true,
        })

        return NextResponse.json({ data: preference })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to update notification preference')
    }
}
