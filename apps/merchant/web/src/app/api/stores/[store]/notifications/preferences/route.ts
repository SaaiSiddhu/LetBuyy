import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'
import { z } from 'zod'

const PreferenceUpdateSchema = z.object({
    channel: z.enum(['email', 'in_app', 'sms', 'push', 'whatsapp']),
    category: z.string().trim().min(1).max(120),
    enabled: z.boolean().optional(),
}).strict()

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

        return NextResponse.json({ data: preferences }, { headers: { 'Cache-Control': 'private, no-store' } })
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

        const parsed = PreferenceUpdateSchema.safeParse(await request.json().catch(() => null))
        if (!parsed.success) {
            return NextResponse.json(
                { error: { code: 'VALIDATION', message: 'Invalid notification preference' } },
                { status: 400 }
            )
        }

        const preference = await createMerchantApiClient().notifications.preferences.update({
            store_id: resolved.storeId,
            channel: parsed.data.channel,
            category: parsed.data.category,
            enabled: parsed.data.enabled ?? true,
        })

        return NextResponse.json({ data: preference }, { headers: { 'Cache-Control': 'private, no-store' } })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to update notification preference')
    }
}
