// ============================================================
// COUPONS — CRUD + validation (Doc 05 + Doc 08 § 10)
// ============================================================

import { Hono } from 'hono';
import type { Env } from '../index';
import { resolveCustomUser, verifySiteOwnership } from '../lib/auth-user';
import { getSupabaseAdmin, paginated, success } from '../lib/supabase';
import { validate } from '../middleware/validation';
import {
    CreateCouponSchema,
    ValidateCouponSchema,
    ListCouponsQuery,
} from '../schemas/coupon.schema';
import type { z } from 'zod';

const router = new Hono<{ Bindings: Env }>();

type CreateCouponInput = z.infer<typeof CreateCouponSchema>;
type ListCouponsQueryInput = z.infer<typeof ListCouponsQuery>;
type CouponPatchInput = Partial<CreateCouponInput>;

interface CouponRow extends Record<string, unknown> {
    type?: string | null;
    value?: number | string | null;
    minimum_order_amount?: number | string | null;
    maximum_discount?: number | string | null;
    per_customer_limit?: number | string | null;
    discount_type?: string | null;
    discount_value?: number | string | null;
    min_order_amount?: number | string | null;
    max_discount?: number | string | null;
    per_user_limit?: number | string | null;
}

interface CouponOwnerRow {
    id: string;
    store_id?: string | null;
}

function normalizeCoupon(coupon: unknown) {
    if (!coupon || typeof coupon !== 'object') {
        return coupon;
    }

    const row = coupon as CouponRow;

    return {
        ...row,
        type: row.type ?? row.discount_type ?? null,
        value: row.value ?? row.discount_value ?? null,
        minimum_order_amount: row.minimum_order_amount ?? row.min_order_amount ?? null,
        maximum_discount: row.maximum_discount ?? row.max_discount ?? null,
        per_customer_limit: row.per_customer_limit ?? row.per_user_limit ?? 1,
    };
}

function toIsoTimestamp(value: unknown) {
    if (value === undefined || value === null || value === '') {
        return null;
    }

    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function toCouponInsert(body: CreateCouponInput) {
    return {
        store_id: body.store_id,
        code: body.code,
        description: body.description ?? null,
        discount_type: body.type,
        discount_value: body.value,
        min_order_amount: body.minimum_order_amount ?? null,
        max_discount: body.maximum_discount ?? null,
        usage_limit: body.usage_limit ?? null,
        usage_count: 0,
        per_user_limit: body.per_customer_limit ?? 1,
        starts_at: toIsoTimestamp(body.starts_at),
        expires_at: toIsoTimestamp(body.expires_at),
        is_active: body.is_active,
    };
}

function toCouponUpdate(patch: Record<string, unknown>) {
    const columnMap: Record<string, string> = {
        type: 'discount_type',
        value: 'discount_value',
        minimum_order_amount: 'min_order_amount',
        maximum_discount: 'max_discount',
        per_customer_limit: 'per_user_limit',
    };
    const allowed = [
        'code', 'type', 'description', 'value', 'minimum_order_amount', 'maximum_discount',
        'usage_limit', 'per_customer_limit', 'starts_at', 'expires_at', 'is_active',
    ];

    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
        if (patch[key] === undefined) continue;

        const column = columnMap[key] || key;
        updates[column] = key === 'starts_at' || key === 'expires_at'
            ? toIsoTimestamp(patch[key])
            : patch[key];
    }

    return updates;
}

// GET /coupons — List coupons for a store
router.get('/', validate('query', ListCouponsQuery), async (c) => {
    const auth = c.get('auth');
    const query = c.get('validatedQuery') as ListCouponsQueryInput;
    const offset = (query.page - 1) * query.limit;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const ownedStoreIds = query.store_id
        ? [query.store_id]
        : await listOwnedStoreIds(db, customUser.id, auth.user.storeId);

    if (query.store_id && !(await verifySiteOwnership(db, query.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    if (ownedStoreIds.length === 0) {
        return c.json(paginated([], 0, query.page, query.limit));
    }

    let dbQuery = db
        .from('coupons')
        .select('*', { count: 'exact' })
        .in('store_id', ownedStoreIds)
        .order('created_at', { ascending: false })
        .range(offset, offset + query.limit - 1);

    const now = new Date().toISOString();
    if (query.status === 'active') {
        dbQuery = dbQuery.eq('is_active', true).or(`expires_at.is.null,expires_at.gte.${now}`);
    } else if (query.status === 'expired') {
        dbQuery = dbQuery.lt('expires_at', now);
    }

    const { data, error, count } = await dbQuery;

    if (error) {
        return c.json({ success: false, error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(paginated((data || []).map(normalizeCoupon), count || 0, query.page, query.limit));
});

// POST /coupons — Create a coupon
router.post('/', validate('json', CreateCouponSchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as CreateCouponInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }
    if (!(await verifySiteOwnership(db, body.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    // Check code uniqueness within store
    const { data: existing } = await db
        .from('coupons')
        .select('id')
        .eq('store_id', body.store_id)
        .eq('code', body.code)
        .limit(1);

    if (existing && existing.length > 0) {
        return c.json({ success: false, error: { code: 'CONFLICT', message: 'Coupon code already exists' } }, 409);
    }

    const { data, error } = await db
        .from('coupons')
        .insert(toCouponInsert(body))
        .select()
        .single();

    if (error) {
        return c.json({ success: false, error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(normalizeCoupon(data)), 201);
});

// GET /coupons/:id — Get coupon details
router.get('/:id', async (c) => {
    const auth = c.get('auth');
    const couponId = c.req.param('id');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const { data, error } = await db
        .from('coupons')
        .select('*')
        .eq('id', couponId)
        .single();

    if (error || !data || !(await verifySiteOwnership(db, data.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Coupon not found' } }, 404);
    }

    return c.json(success(normalizeCoupon(data)));
});

// PATCH /coupons/:id — Update a coupon
router.patch('/:id', async (c) => {
    const auth = c.get('auth');
    const couponId = c.req.param('id');
    const body = await c.req.json() as CouponPatchInput;
    const patch = body as Record<string, unknown>;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    const { data: existing } = await db
        .from('coupons')
        .select('id, store_id')
        .eq('id', couponId)
        .single();

    const ownedCoupon = existing as CouponOwnerRow | null;
    if (!customUser || !ownedCoupon?.store_id || !(await verifySiteOwnership(db, ownedCoupon.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const updates = toCouponUpdate(patch);

    if (Object.keys(updates).length === 0) {
        return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'No valid fields to update' } }, 400);
    }

    const { data, error } = await db
        .from('coupons')
        .update(updates)
        .eq('id', couponId)
        .select()
        .single();

    if (error || !data) {
        return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Coupon not found' } }, 404);
    }

    return c.json(success(normalizeCoupon(data)));
});

// DELETE /coupons/:id — Soft delete (deactivate)
router.delete('/:id', async (c) => {
    const auth = c.get('auth');
    const couponId = c.req.param('id');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    const { data: existing } = await db
        .from('coupons')
        .select('id, store_id')
        .eq('id', couponId)
        .single();

    const ownedCoupon = existing as CouponOwnerRow | null;
    if (!customUser || !ownedCoupon?.store_id || !(await verifySiteOwnership(db, ownedCoupon.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const { error } = await db
        .from('coupons')
        .update({ is_active: false })
        .eq('id', couponId);

    if (error) {
        return c.json({ success: false, error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success({ deleted: true }));
});

// POST /coupons/validate — Validate code existence only.
// Checkout is the only authority for discount amounts because it has canonical
// cart prices, inventory, shipping and customer context inside one DB mutation.
router.post('/validate', validate('json', ValidateCouponSchema), async (c) => {
    const body = c.get('validatedBody') as {
        store_id: string; code: string; order_total: number;
        product_ids?: string[]; customer_id?: string;
    };
    const db = getSupabaseAdmin(c);

    const { data: coupon } = await db
        .from('coupons')
        .select('*')
        .eq('store_id', body.store_id)
        .eq('code', body.code.toUpperCase())
        .eq('is_active', true)
        .single();

    if (!coupon) {
        return c.json(success({ valid: false, reason: 'Coupon not found or inactive' }));
    }

    // Check expiry
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
        return c.json(success({ valid: false, reason: 'Coupon has expired' }));
    }

    // Check start date
    if (coupon.starts_at && new Date(coupon.starts_at) > new Date()) {
        return c.json(success({ valid: false, reason: 'Coupon is not yet active' }));
    }

    // Check usage limit
    if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
        return c.json(success({ valid: false, reason: 'Coupon usage limit reached' }));
    }

    return c.json(success({
        valid: true,
        coupon: {
            code: coupon.code,
            type: coupon.type || coupon.discount_type,
            value: coupon.value || coupon.discount_value,
            minimum_order_amount: coupon.minimum_order_amount || coupon.min_order_amount,
            maximum_discount: coupon.maximum_discount || coupon.max_discount,
        },
        pricing_authority: 'checkout',
    }));
});

async function listOwnedStoreIds(
    db: ReturnType<typeof getSupabaseAdmin>,
    userId: string,
    sessionStoreId?: string
) {
    let query = db
        .from('sites')
        .select('id')
        .or(`custom_user_id.eq.${userId},user_id.eq.${userId}`)
        .is('deleted_at', null);

    if (sessionStoreId) query = query.eq('id', sessionStoreId);

    const { data, error } = await query;
    if (error) throw new Error(`Store ownership lookup failed: ${error.message}`);

    return (data || []).map((store) => store.id as string);
}

export default router;
