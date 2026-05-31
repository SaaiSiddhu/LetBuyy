import { NextRequest, NextResponse } from 'next/server'
import type { CreateCouponInput } from '@letbuyy/api-client'
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

function toWorkerCoupon(body: AdminCouponBody, storeId?: string) {
    return {
        ...(storeId ? { store_id: storeId } : {}),
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

function fromWorkerCoupon(coupon: Record<string, unknown>) {
    const type = coupon.type ?? coupon.discount_type

    return {
        ...coupon,
        type: type === 'fixed' ? 'fixed_amount' : type,
        value: coupon.value ?? coupon.discount_value ?? 0,
        min_purchase: coupon.minimum_order_amount ?? coupon.min_order_amount ?? null,
        max_uses: coupon.usage_limit ?? null,
        used_count: coupon.usage_count ?? 0,
    }
}

function normalizeCouponStatus(value: string | null) {
    return value === 'active' || value === 'expired' ? value : 'all'
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const { searchParams } = new URL(request.url)
        const page = Number(searchParams.get('page') || '1')
        const limit = Number(searchParams.get('limit') || '100')
        const payload = await createWorkerApiClient().coupons.list({
            store_id: resolved.storeId,
            status: normalizeCouponStatus(searchParams.get('status')),
            page,
            limit,
        })
        const data = payload.data.map((coupon) => fromWorkerCoupon(coupon as unknown as Record<string, unknown>))

        return NextResponse.json({
            success: true,
            data,
            meta: {
                page: payload.page,
                per_page: payload.limit,
                total: payload.total,
                total_pages: Math.ceil(payload.total / Math.max(payload.limit, 1)),
                has_next: payload.has_more,
                has_prev: payload.page > 1,
            },
        })
    } catch (err) {
        return workerErrorResponse(err, 'Unable to load coupons')
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

        const body = await request.json() as AdminCouponBody
        const payload = await createWorkerApiClient().coupons.create(
            toWorkerCoupon(body, resolved.storeId) as CreateCouponInput
        )

        return NextResponse.json({
            success: true,
            data: fromWorkerCoupon(payload as unknown as Record<string, unknown>),
        })
    } catch (err) {
        return workerErrorResponse(err, 'Unable to save coupon')
    }
}
