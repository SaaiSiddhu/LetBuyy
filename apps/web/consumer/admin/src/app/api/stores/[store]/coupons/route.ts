import { NextRequest, NextResponse } from 'next/server'
import { readWorkerJson, workerErrorResponse, workerFetch } from '@/lib/api/worker-client'
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

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const { searchParams } = new URL(request.url)
        const query = new URLSearchParams({
            store_id: resolved.storeId,
            status: searchParams.get('status') || 'all',
            page: searchParams.get('page') || '1',
            limit: searchParams.get('limit') || '100',
        })

        const workerResponse = await workerFetch(`/coupons?${query.toString()}`)
        const payload = await readWorkerJson(workerResponse)
        const data = Array.isArray(payload.data)
            ? payload.data.map((coupon: Record<string, unknown>) => fromWorkerCoupon(coupon))
            : []

        return NextResponse.json({ ...payload, data })
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
        const workerResponse = await workerFetch('/coupons', {
            method: 'POST',
            body: JSON.stringify(toWorkerCoupon(body, resolved.storeId)),
        })
        const payload = await readWorkerJson(workerResponse)

        return NextResponse.json({
            ...payload,
            data: payload.data ? fromWorkerCoupon(payload.data) : payload.data,
        })
    } catch (err) {
        return workerErrorResponse(err, 'Unable to save coupon')
    }
}
