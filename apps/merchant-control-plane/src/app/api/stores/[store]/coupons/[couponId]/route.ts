import { NextRequest, NextResponse } from 'next/server'
import type { UpdateCouponInput } from '@letbuyy/api-client'
import { createWorkerApiClient, workerErrorResponse } from '@/lib/api/worker-client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

type AdminCouponBody = {
    code?: string
    type?: 'percentage' | 'fixed_amount' | 'fixed' | 'free_shipping'
    value?: number
    min_purchase?: number | null
    max_uses?: number | null
    starts_at?: string | null
    expires_at?: string | null
    is_active?: boolean
}

function toWorkerCoupon(body: AdminCouponBody) {
    return {
        ...(body.code !== undefined ? { code: body.code } : {}),
        ...(body.type !== undefined ? { type: body.type === 'fixed_amount' ? 'fixed' : body.type } : {}),
        ...(body.value !== undefined ? { value: body.value } : {}),
        ...(body.min_purchase !== undefined ? { minimum_order_amount: body.min_purchase ?? undefined } : {}),
        ...(body.max_uses !== undefined ? { usage_limit: body.max_uses ?? undefined } : {}),
        ...(body.starts_at !== undefined ? { starts_at: body.starts_at || undefined } : {}),
        ...(body.expires_at !== undefined ? { expires_at: body.expires_at || undefined } : {}),
        ...(body.is_active !== undefined ? { is_active: body.is_active } : {}),
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ store: string; couponId: string }> }
) {
    try {
        const { store, couponId } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const body = await request.json() as AdminCouponBody
        const payload = await createWorkerApiClient().coupons.update(
            couponId,
            toWorkerCoupon(body) as UpdateCouponInput
        )

        return NextResponse.json({ success: true, data: payload })
    } catch (err) {
        return workerErrorResponse(err, 'Unable to update coupon')
    }
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ store: string; couponId: string }> }
) {
    try {
        const { store, couponId } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const payload = await createWorkerApiClient().coupons.remove(couponId)

        return NextResponse.json({ success: true, data: payload })
    } catch (err) {
        return workerErrorResponse(err, 'Unable to delete coupon')
    }
}
