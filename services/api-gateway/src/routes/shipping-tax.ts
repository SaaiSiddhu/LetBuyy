// ============================================================
// SHIPPING & TAX — Manage shipping zones/rates and tax rates
// Routes:
//   GET/POST         /shipping           — List / create shipping rates
//   PATCH/DELETE      /shipping/:id       — Update / delete shipping rate
//   GET/POST         /taxes              — List / create tax rates
//   PATCH/DELETE      /taxes/:id          — Update / delete tax rate
// ============================================================

import { Hono } from 'hono';
import type { Env } from '../index';
import { resolveCustomUser, verifySiteOwnership } from '../lib/auth-user';
import { assertStaffPermission } from '../middleware/staff-permission';
import { getSupabaseAdmin, getSupabaseAdminUnguarded, success } from '../lib/supabase';
import { validate } from '../middleware/validation';
import {
    CreateShippingRateSchema,
    CreateShippingZoneSchema,
    CreateTaxRateSchema,
    planShippingRateCreate,
    planShippingRateUpdate,
    planShippingZoneCreate,
    planShippingZoneUpdate,
    planTaxRateCreate,
    planTaxRateUpdate,
    type CreateShippingRateInput,
    type CreateShippingZoneInput,
    type CreateTaxRateInput,
} from '@letbuyy/checkout-core';

const router = new Hono<{ Bindings: Env }>();

interface StoreScopedRow {
    id: string;
    store_id?: string | null;
}

interface ShippingRateRow {
    id: string;
    zone_id?: string | null;
}

type DatabaseErrorLike = {
    message?: string;
    details?: string;
    hint?: string;
} | null | undefined;

function databaseErrorText(error: DatabaseErrorLike): string {
    return [error?.message, error?.details, error?.hint].filter(Boolean).join(' ').toLowerCase();
}

function isMissingTableError(error: DatabaseErrorLike, tableName: string): boolean {
    const text = databaseErrorText(error);
    return text.includes(tableName.toLowerCase()) && (
        text.includes('does not exist') ||
        text.includes('schema cache') ||
        text.includes('could not find')
    );
}

function isMissingShippingSchemaError(error: DatabaseErrorLike): boolean {
    return (
        isMissingTableError(error, 'shipping_zones') ||
        isMissingTableError(error, 'shipping_rates') ||
        databaseErrorText(error).includes('relationship')
    );
}

function isMissingTaxSchemaError(error: DatabaseErrorLike): boolean {
    return isMissingTableError(error, 'tax_rates');
}

// ═══════════════════════════════════════════════════════════
//  SHIPPING ZONES
// ═══════════════════════════════════════════════════════════

// GET /shipping/zones — List shipping zones for a store
router.get('/shipping/zones', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.query('store_id');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!storeId) {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id required' } }, 400);
    }
    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }
    if (!(await verifySiteOwnership(db, storeId, customUser.id, auth.user.storeId))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const { data, error } = await db
        .from('shipping_zones')
        .select('*')
        .eq('store_id', storeId)
        .order('name');

    if (error) {
        if (isMissingShippingSchemaError(error)) return c.json(success([]));
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }
    return c.json(success(data || []));
});

// POST /shipping/zones — Create a shipping zone
router.post('/shipping/zones', validate('json', CreateShippingZoneSchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as CreateShippingZoneInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }
    if (!(await verifySiteOwnership(db, body.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const plan = planShippingZoneCreate(body);

    const { data, error } = await db
        .from('shipping_zones')
        .insert(plan.zoneInsert)
        .select()
        .single();

    if (error) {
        if (isMissingShippingSchemaError(error)) {
            return c.json({ error: { code: 'SHIPPING_SCHEMA_MISSING', message: 'Shipping tables are not available in this environment.' } }, 503);
        }
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }
    return c.json(success(data), 201);
});

// PATCH /shipping/zones/:id — Update a shipping zone
router.patch('/shipping/zones/:id', async (c) => {
    const auth = c.get('auth');
    const id = c.req.param('id');
    const body = await c.req.json() as Partial<CreateShippingZoneInput>;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    const { data: existing } = await getSupabaseAdminUnguarded(c)
        .from('shipping_zones')
        .select('id, store_id')
        .eq('id', id)
        .single();

    const ownedZone = existing as StoreScopedRow | null;
    if (!customUser || !ownedZone?.store_id || !(await verifySiteOwnership(db, ownedZone.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const plan = planShippingZoneUpdate(body);

    const { data, error } = await db
        .from('shipping_zones')
        .update(plan.updates)
        .eq('id', id)
        .eq('store_id', ownedZone.store_id)
        .select()
        .single();

    if (error) {
        if (isMissingShippingSchemaError(error)) {
            return c.json({ error: { code: 'SHIPPING_SCHEMA_MISSING', message: 'Shipping tables are not available in this environment.' } }, 503);
        }
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }
    return c.json(success(data));
});

// DELETE /shipping/zones/:id
router.delete('/shipping/zones/:id', async (c) => {
    const auth = c.get('auth');
    const id = c.req.param('id');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    const { data: existing } = await getSupabaseAdminUnguarded(c)
        .from('shipping_zones')
        .select('id, store_id')
        .eq('id', id)
        .single();

    const ownedZone = existing as StoreScopedRow | null;
    if (!customUser || !ownedZone?.store_id || !(await verifySiteOwnership(db, ownedZone.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const { error } = await db.from('shipping_zones').delete().eq('id', id).eq('store_id', ownedZone.store_id);
    if (error) return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    return c.json(success({ deleted: true }));
});

// ═══════════════════════════════════════════════════════════
//  SHIPPING RATES
// ═══════════════════════════════════════════════════════════

// GET /shipping — List shipping rates for a store
router.get('/shipping', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.query('store_id');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!storeId) {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id required' } }, 400);
    }
    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }
    if (!(await verifySiteOwnership(db, storeId, customUser.id, auth.user.storeId))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const { data, error } = await db
        .from('shipping_rates')
        .select('*, shipping_zones!inner(store_id)')
        .eq('site_id', storeId)
        .order('name');

    if (error) {
        if (isMissingShippingSchemaError(error)) return c.json(success([]));
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }
    return c.json(success(data || []));
});

// POST /shipping — Create a shipping rate
router.post('/shipping', validate('json', CreateShippingRateSchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as CreateShippingRateInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    const { data: zone } = await getSupabaseAdminUnguarded(c)
        .from('shipping_zones')
        .select('id, store_id')
        .eq('id', body.zone_id)
        .single();

    const ownedZone = zone as StoreScopedRow | null;
    if (!customUser || !ownedZone?.store_id || !(await verifySiteOwnership(db, ownedZone.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const staffBlock = await assertStaffPermission(c, ownedZone.store_id, customUser.id, 'shipping:write');
    if (staffBlock) return staffBlock;

    const plan = planShippingRateCreate(body, ownedZone.store_id);

    const { data, error } = await db
        .from('shipping_rates')
        .insert(plan.rateInsert)
        .select()
        .single();

    if (error) {
        if (isMissingShippingSchemaError(error)) {
            return c.json({ error: { code: 'SHIPPING_SCHEMA_MISSING', message: 'Shipping tables are not available in this environment.' } }, 503);
        }
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }
    return c.json(success(data), 201);
});

// PATCH /shipping/:id — Update a shipping rate
router.patch('/shipping/:id', async (c) => {
    const auth = c.get('auth');
    const id = c.req.param('id');
    const body = await c.req.json() as Record<string, unknown>;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);
    const unguardedDb = getSupabaseAdminUnguarded(c);

    // Verify ownership through store
    const { data: existing } = await unguardedDb
        .from('shipping_rates')
        .select('id, zone_id')
        .eq('id', id)
        .single();

    const rate = existing as ShippingRateRow | null;
    const { data: zone } = rate?.zone_id
        ? await unguardedDb.from('shipping_zones').select('id, store_id').eq('id', rate.zone_id).single()
        : { data: null };

    const ownedZone = zone as StoreScopedRow | null;
    if (!customUser || !ownedZone?.store_id || !(await verifySiteOwnership(db, ownedZone.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const staffBlock = await assertStaffPermission(c, ownedZone.store_id, customUser.id, 'shipping:write');
    if (staffBlock) return staffBlock;

    const plan = planShippingRateUpdate(body);

    const { data, error } = await db
        .from('shipping_rates')
        .update(plan.updates)
        .eq('id', id)
        .eq('site_id', ownedZone.store_id)
        .select()
        .single();

    if (error) {
        if (isMissingShippingSchemaError(error)) {
            return c.json({ error: { code: 'SHIPPING_SCHEMA_MISSING', message: 'Shipping tables are not available in this environment.' } }, 503);
        }
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }
    return c.json(success(data));
});

// DELETE /shipping/:id
router.delete('/shipping/:id', async (c) => {
    const auth = c.get('auth');
    const id = c.req.param('id');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);
    const unguardedDb = getSupabaseAdminUnguarded(c);

    const { data: existing } = await unguardedDb
        .from('shipping_rates')
        .select('id, zone_id')
        .eq('id', id)
        .single();

    const rate = existing as ShippingRateRow | null;
    const { data: zone } = rate?.zone_id
        ? await unguardedDb.from('shipping_zones').select('id, store_id').eq('id', rate.zone_id).single()
        : { data: null };

    const ownedZone = zone as StoreScopedRow | null;
    if (!customUser || !ownedZone?.store_id || !(await verifySiteOwnership(db, ownedZone.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const staffBlock = await assertStaffPermission(c, ownedZone.store_id, customUser.id, 'shipping:write');
    if (staffBlock) return staffBlock;

    const { error } = await db.from('shipping_rates').delete().eq('id', id).eq('site_id', ownedZone.store_id);
    if (error) return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    return c.json(success({ deleted: true }));
});

// ═══════════════════════════════════════════════════════════
//  TAX RATES
// ═══════════════════════════════════════════════════════════

// GET /taxes — List tax rates for a store
router.get('/taxes', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.query('store_id');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!storeId) {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id required' } }, 400);
    }
    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }
    if (!(await verifySiteOwnership(db, storeId, customUser.id, auth.user.storeId))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const { data, error } = await db
        .from('tax_rates')
        .select('*')
        .eq('store_id', storeId)
        .order('name');

    if (error) {
        if (isMissingTaxSchemaError(error)) return c.json(success([]));
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }
    return c.json(success(data || []));
});

// POST /taxes — Create a tax rate
router.post('/taxes', validate('json', CreateTaxRateSchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as CreateTaxRateInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }
    if (!(await verifySiteOwnership(db, body.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const plan = planTaxRateCreate(body);

    const { data, error } = await db
        .from('tax_rates')
        .insert(plan.taxRateInsert)
        .select()
        .single();

    if (error) {
        if (isMissingTaxSchemaError(error)) {
            return c.json({ error: { code: 'TAX_SCHEMA_MISSING', message: 'Tax tables are not available in this environment.' } }, 503);
        }
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }
    return c.json(success(data), 201);
});

// PATCH /taxes/:id — Update a tax rate
router.patch('/taxes/:id', async (c) => {
    const auth = c.get('auth');
    const id = c.req.param('id');
    const body = await c.req.json();
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    const { data: existing } = await getSupabaseAdminUnguarded(c)
        .from('tax_rates')
        .select('id, store_id')
        .eq('id', id)
        .single();

    const ownedTaxRate = existing as StoreScopedRow | null;
    if (!customUser || !ownedTaxRate?.store_id || !(await verifySiteOwnership(db, ownedTaxRate.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const plan = planTaxRateUpdate(body);

    const { data, error } = await db
        .from('tax_rates')
        .update(plan.updates)
        .eq('id', id)
        .eq('store_id', ownedTaxRate.store_id)
        .select()
        .single();

    if (error) {
        if (isMissingTaxSchemaError(error)) {
            return c.json({ error: { code: 'TAX_SCHEMA_MISSING', message: 'Tax tables are not available in this environment.' } }, 503);
        }
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }
    return c.json(success(data));
});

// DELETE /taxes/:id
router.delete('/taxes/:id', async (c) => {
    const auth = c.get('auth');
    const id = c.req.param('id');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    const { data: existing } = await getSupabaseAdminUnguarded(c)
        .from('tax_rates')
        .select('id, store_id')
        .eq('id', id)
        .single();

    const ownedTaxRate = existing as StoreScopedRow | null;
    if (!customUser || !ownedTaxRate?.store_id || !(await verifySiteOwnership(db, ownedTaxRate.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const { error } = await db.from('tax_rates').delete().eq('id', id).eq('store_id', ownedTaxRate.store_id);
    if (error) return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    return c.json(success({ deleted: true }));
});

export default router;
