import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { merchantSecurityScope } from '@/lib/api/merchant-security-scope'
import type { InventoryAdjustInput } from '@letbuyy/api-client'

type InventoryAdjustBody = {
    product_id?: string
    variant_id?: string | null
    location_id?: string | null
    adjustment?: number
    reason?: string
    notes?: string | null
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const scope = await merchantSecurityScope(request, params)
        if (scope.error) return scope.error

        const idempotencyKey = request.headers.get('X-Idempotency-Key')?.trim()
        if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 200) {
            return NextResponse.json({
                error: {
                    code: 'IDEMPOTENCY_KEY_REQUIRED',
                    message: 'A valid inventory update key is required. Retry the same update to safely complete it.',
                },
            }, { status: 400 })
        }

        const body = await request.json() as InventoryAdjustBody
        const payload = await createMerchantApiClient().inventory.adjust({
            product_id: body.product_id,
            variant_id: body.variant_id || null,
            location_id: body.location_id || undefined,
            adjustment: body.adjustment,
            reason: body.reason || 'correction',
            notes: body.notes || null,
        } as InventoryAdjustInput, { idempotencyKey, storeId: scope.storeId })

        return NextResponse.json({ data: payload }, { headers: { 'Cache-Control': 'private, no-store' } })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to adjust inventory')
    }
}
