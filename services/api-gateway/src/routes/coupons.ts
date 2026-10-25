import { resolveMerchantResourceStoreIds } from '../lib/tenant-context';
// ============================================================
// COUPONS — CRUD + validation (Doc 05 + Doc 08 § 10)
// ============================================================

import { Hono } from 'hono';
import type { Env } from '../index';
import { resolveCustomUser, verifySiteOwnership } from '../lib/auth-user';
import { assertStaffPermission } from '../middleware/staff-permission';
import { getSupabaseAdmin, paginated, success } from '../lib/supabase';
import { validate } from '../middleware/validation';
import {
    CreateCouponSchema,
    ValidateCouponSchema,
    ListCouponsQuery,
} from '../schemas/coupon.schema';
import {
    couponValidationReason,
    normalizeCouponRecord,
    planCouponCreate,
    planCouponUpdate,
    planCouponValidation,
    type CouponRecord,
    type CreateCouponInput,
    type ListCouponsInput,
} from '@letbuyy/checkout-core';

const router = new Hono<{ Bindings: Env }>();

type CouponPatchInput = Partial<CreateCouponInput>;

interface CouponOwnerRow {
    id: string;
    store_id?: string | null;
}

// GET /coupons — List coupons for a store
router.get('/', validate('query', ListCouponsQuery), async (c) => {
    const auth = c.get('auth');
    const query = c.get('validatedQuery') as ListCouponsInput;
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

    return c.json(paginated((data || []).map(normalizeCouponRecord), count || 0, query.page, query.limit));
});

// POST /coupons — Create a coupon
router.post('/', validate('json', CreateCouponSchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as CreateCouponInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    // V1 scope-lock: bogo is not supported; DB CHECK allows it but the API does not.
    if ((body as { type?: string }).type === 'bogo') {
        return c.json({
            success: false,
            error: {
                code: 'UNSUPPORTED_DISCOUNT_TYPE',
                message: 'V1 supports percentage, fixed, and free_shipping discount types. bogo is not available.',
            },
        }, 422);
    }

    if (!customUser) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }
    if (!(await verifySiteOwnership(db, body.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const staffBlock = await assertStaffPermission(c, body.store_id, customUser.id, 'marketing:write');
    if (staffBlock) return staffBlock;

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
        .insert(planCouponCreate(body).couponInsert)
        .select()
        .single();

    if (error) {
        return c.json({ success: false, error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(normalizeCouponRecord(data)), 201);
});

// GET /coupons/:id — Get coupon details
router.get('/:id', async (c) => {
    const auth = c.get('auth');
    const couponId = c.req.param('id');
    const db = getSupabaseAdmin(c);
    const storeIds = await resolveMerchantResourceStoreIds(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const { data, error } = await db
        .from('coupons')
        .select('*')
        .eq('id', couponId).in('store_id', storeIds)
        .single();

    if (error || !data || !(await verifySiteOwnership(db, data.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Coupon not found' } }, 404);
    }

    return c.json(success(normalizeCouponRecord(data)));
});

// PATCH /coupons/:id — Update a coupon
router.patch('/:id', async (c) => {
    const auth = c.get('auth');
    const couponId = c.req.param('id');
    const body = await c.req.json() as CouponPatchInput;
    const patch = body as Record<string, unknown>;
    const db = getSupabaseAdmin(c);
    const storeIds = await resolveMerchantResourceStoreIds(c);
    const customUser = await resolveCustomUser(db, auth.user);

    // V1 scope-lock: reject bogo type changes.
    if (patch.type === 'bogo') {
        return c.json({
            success: false,
            error: {
                code: 'UNSUPPORTED_DISCOUNT_TYPE',
                message: 'V1 supports percentage, fixed, and free_shipping discount types. bogo is not available.',
            },
        }, 422);
    }

    const { data: existing } = await db
        .from('coupons')
        .select('id, store_id')
        .eq('id', couponId).in('store_id', storeIds)
        .single();

    const ownedCoupon = existing as CouponOwnerRow | null;
    if (!customUser || !ownedCoupon?.store_id || !(await verifySiteOwnership(db, ownedCoupon.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const staffBlock = await assertStaffPermission(c, ownedCoupon.store_id, customUser.id, 'marketing:write');
    if (staffBlock) return staffBlock;

    const updates = planCouponUpdate(patch).updates;

    if (Object.keys(updates).length === 0) {
        return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'No valid fields to update' } }, 400);
    }

    const { data, error } = await db
        .from('coupons')
        .update(updates)
        .eq('id', couponId).in('store_id', storeIds)
        .select()
        .single();

    if (error || !data) {
        return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Coupon not found' } }, 404);
    }

    return c.json(success(normalizeCouponRecord(data)));
});

// DELETE /coupons/:id — Soft delete (deactivate)
router.delete('/:id', async (c) => {
    const auth = c.get('auth');
    const couponId = c.req.param('id');
    const db = getSupabaseAdmin(c);
    const storeIds = await resolveMerchantResourceStoreIds(c);
    const customUser = await resolveCustomUser(db, auth.user);

    const { data: existing } = await db
        .from('coupons')
        .select('id, store_id')
        .eq('id', couponId).in('store_id', storeIds)
        .single();

    const ownedCoupon = existing as CouponOwnerRow | null;
    if (!customUser || !ownedCoupon?.store_id || !(await verifySiteOwnership(db, ownedCoupon.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const staffBlock = await assertStaffPermission(c, ownedCoupon.store_id, customUser.id, 'marketing:write');
    if (staffBlock) return staffBlock;

    const { error } = await db
        .from('coupons')
        .update({ is_active: false })
        .eq('id', couponId).in('store_id', storeIds);

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
    const auth = c.get('auth');
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser || !(await verifySiteOwnership(db, body.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

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

    const plan = planCouponValidation(coupon as CouponRecord);
    if (!plan.valid) {
        return c.json(success({ valid: false, reason: couponValidationReason(plan.failureCode) }));
    }

    return c.json(success({
        valid: true,
        coupon: {
            code: plan.coupon.code,
            type: plan.coupon.type,
            value: plan.coupon.value,
            discount_class: plan.coupon.discountClass,
            combines_with: plan.coupon.combinesWith,
            minimum_order_amount: plan.coupon.minimumOrderAmount,
            maximum_discount: plan.coupon.maximumDiscount,
        },
        pricing_authority: plan.pricingAuthority,
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
