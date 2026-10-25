// ============================================================
// SHIPPING & TAX — Manage shipping zones/rates and tax rates
// Routes:
//   GET/POST         /shipping           — List / create shipping rates
//   PATCH/DELETE      /shipping/:id       — Update / delete shipping rate
//   GET/POST         /taxes              — List / create tax rates
//   PATCH/DELETE      /taxes/:id          — Update / delete tax rate
// ============================================================

import { Hono, type Context } from 'hono';
import type { Env } from '../index';
import { resolveCustomUser, verifySiteOwnership } from '../lib/auth-user';
import { assertStaffPermission } from '../middleware/staff-permission';
import { AppError, ForbiddenError } from '../lib/errors';
import { getSupabaseAdmin, success } from '../lib/supabase';
import { validate } from '../middleware/validation';
import {
    CreateShippingRateSchema,
    CreateShippingZoneSchema,
    CreateTaxRateSchema,
    UpdateShippingZoneSchema,
    UpdateShippingRateSchema,
    UpdateTaxRateSchema,
    planShippingRateCreate,
    planShippingRateUpdate,
    planShippingZoneCreate,
    planShippingZoneUpdate,
    planTaxRateCreate,
    planTaxRateUpdate,
    serializeMerchantTaxRate,
    type CreateShippingRateInput,
    type CreateShippingZoneInput,
    type CreateTaxRateInput,
} from '@letbuyy/checkout-core';

const router = new Hono<{ Bindings: Env }>();

type DatabaseErrorLike = {
    message?: string;
    details?: string;
    hint?: string;
} | null | undefined;

/** Store selection grants no authority: verify the live owner before using it
 * as a tenant predicate, then keep both resource lookup and mutation scoped.
 * Mutations without store context remain rejected by gateway idempotency.
 */
async function resolveShippingTaxResourceScope(
    c: Context<{ Bindings: Env }>,
    table: 'shipping_zones' | 'shipping_rates' | 'tax_rates',
    id: string,
) {
    const auth = c.get('auth');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);
    const storeId = auth.user.storeId || c.req.header('X-Store-ID')?.trim();
    if (!customUser || !storeId || !(await verifySiteOwnership(db, storeId, customUser.id, auth.user.storeId))) {
        throw new ForbiddenError();
    }
    const scopeColumn = table === 'tax_rates' ? 'store_id' : 'site_id';
    const projection = table === 'tax_rates' ? 'id, store_id'
        : table === 'shipping_zones' ? 'id, site_id, store_id' : 'id, site_id, zone_id';
    const { data, error } = await db.from(table).select(projection)
        .eq('id', id).eq(scopeColumn, storeId).maybeSingle();
    if (error) throw new AppError('Settings scope lookup unavailable', 503, 'SETTINGS_UNAVAILABLE');
    const row = data as { id: string; store_id?: string; site_id?: string; zone_id?: string } | null;
    if (!row || (table === 'shipping_zones' && row.store_id !== storeId)) throw new ForbiddenError();
    if (table === 'shipping_rates') {
        const { data: zone, error: zoneError } = await db.from('shipping_zones')
            .select('id').eq('id', row.zone_id).eq('site_id', storeId).eq('store_id', storeId).maybeSingle();
        if (zoneError) throw new AppError('Settings scope lookup unavailable', 503, 'SETTINGS_UNAVAILABLE');
        if (!zone) throw new ForbiddenError();
    }
    return { db, customUser, storeId, scopeColumn };
}

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
        if (isMissingShippingSchemaError(error)) return c.json({ error: { code: 'SHIPPING_SCHEMA_MISSING', message: 'Shipping settings are unavailable.' } }, 503);
        return c.json({ error: { code: 'DB_ERROR', message: 'Unable to access settings' } }, 500);
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
        return c.json({ error: { code: 'DB_ERROR', message: 'Unable to access settings' } }, 500);
    }
    return c.json(success(data), 201);
});

// PATCH /shipping/zones/:id — Update a shipping zone
router.patch('/shipping/zones/:id', validate('json', UpdateShippingZoneSchema), async (c) => {
    const id = c.req.param('id');
    const body = c.get('validatedBody') as Record<string, unknown>;
    const { db, storeId, scopeColumn } = await resolveShippingTaxResourceScope(c, 'shipping_zones', id);
    const plan = planShippingZoneUpdate(body);

    const { data, error } = await db
        .from('shipping_zones')
        .update(plan.updates)
        .eq('id', id).eq(scopeColumn, storeId)
        .select()
        .single();

    if (error) {
        if (isMissingShippingSchemaError(error)) {
            return c.json({ error: { code: 'SHIPPING_SCHEMA_MISSING', message: 'Shipping tables are not available in this environment.' } }, 503);
        }
        return c.json({ error: { code: 'DB_ERROR', message: 'Unable to access settings' } }, 500);
    }
    return c.json(success(data));
});

// DELETE /shipping/zones/:id
router.delete('/shipping/zones/:id', async (c) => {
    const id = c.req.param('id');
    const { db, storeId, scopeColumn } = await resolveShippingTaxResourceScope(c, 'shipping_zones', id);
    const { error } = await db.from('shipping_zones').delete().eq('id', id).eq(scopeColumn, storeId);
    if (error) return c.json({ error: { code: 'DB_ERROR', message: 'Unable to access settings' } }, 500);
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
        .eq('shipping_zones.store_id', storeId)
        .order('name');

    if (error) {
        if (isMissingShippingSchemaError(error)) return c.json({ error: { code: 'SHIPPING_SCHEMA_MISSING', message: 'Shipping settings are unavailable.' } }, 503);
        return c.json({ error: { code: 'DB_ERROR', message: 'Unable to access settings' } }, 500);
    }
    return c.json(success(data || []));
});

// POST /shipping — Create a shipping rate
router.post('/shipping', validate('json', CreateShippingRateSchema), async (c) => {
    const body = c.get('validatedBody') as CreateShippingRateInput;
    const { db, customUser, storeId } = await resolveShippingTaxResourceScope(c, 'shipping_zones', body.zone_id);
    const staffBlock = await assertStaffPermission(c, storeId, customUser.id, 'shipping:write');
    if (staffBlock) return staffBlock;

    const plan = planShippingRateCreate(body);

    const { data, error } = await db
        .from('shipping_rates')
        .insert({ ...plan.rateInsert, site_id: storeId, cod_enabled: true })
        .select()
        .single();

    if (error) {
        if (isMissingShippingSchemaError(error)) {
            return c.json({ error: { code: 'SHIPPING_SCHEMA_MISSING', message: 'Shipping tables are not available in this environment.' } }, 503);
        }
        return c.json({ error: { code: 'DB_ERROR', message: 'Unable to access settings' } }, 500);
    }
    return c.json(success(data), 201);
});

// PATCH /shipping/:id — Update a shipping rate
router.patch('/shipping/:id', validate('json', UpdateShippingRateSchema), async (c) => {
    const id = c.req.param('id');
    const body = c.get('validatedBody') as Record<string, unknown>;
    const { db, customUser, storeId, scopeColumn } = await resolveShippingTaxResourceScope(c, 'shipping_rates', id);
    const staffBlock = await assertStaffPermission(c, storeId, customUser.id, 'shipping:write');
    if (staffBlock) return staffBlock;

    const plan = planShippingRateUpdate(body);

    const { data, error } = await db
        .from('shipping_rates')
        .update(plan.updates)
        .eq('id', id).eq(scopeColumn, storeId)
        .select()
        .single();

    if (error) {
        if (isMissingShippingSchemaError(error)) {
            return c.json({ error: { code: 'SHIPPING_SCHEMA_MISSING', message: 'Shipping tables are not available in this environment.' } }, 503);
        }
        return c.json({ error: { code: 'DB_ERROR', message: 'Unable to access settings' } }, 500);
    }
    return c.json(success(data));
});

// DELETE /shipping/:id
router.delete('/shipping/:id', async (c) => {
    const id = c.req.param('id');
    const { db, customUser, storeId, scopeColumn } = await resolveShippingTaxResourceScope(c, 'shipping_rates', id);
    const staffBlock = await assertStaffPermission(c, storeId, customUser.id, 'shipping:write');
    if (staffBlock) return staffBlock;

    const { error } = await db.from('shipping_rates').delete().eq('id', id).eq(scopeColumn, storeId);
    if (error) return c.json({ error: { code: 'DB_ERROR', message: 'Unable to access settings' } }, 500);
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
        if (isMissingTaxSchemaError(error)) return c.json({ error: { code: 'TAX_SCHEMA_MISSING', message: 'Tax settings are unavailable.' } }, 503);
        return c.json({ error: { code: 'DB_ERROR', message: 'Unable to access settings' } }, 500);
    }
    return c.json(success((data || []).map(serializeMerchantTaxRate)));
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
        return c.json({ error: { code: 'DB_ERROR', message: 'Unable to access settings' } }, 500);
    }
    return c.json(success(serializeMerchantTaxRate(data)), 201);
});

// PATCH /taxes/:id — Update a tax rate
router.patch('/taxes/:id', validate('json', UpdateTaxRateSchema), async (c) => {
    const id = c.req.param('id');
    const body = c.get('validatedBody') as Record<string, unknown>;
    const { db, storeId, scopeColumn } = await resolveShippingTaxResourceScope(c, 'tax_rates', id);
    const plan = planTaxRateUpdate(body);

    const { data, error } = await db
        .from('tax_rates')
        .update(plan.updates)
        .eq('id', id).eq(scopeColumn, storeId)
        .select()
        .single();

    if (error) {
        if (isMissingTaxSchemaError(error)) {
            return c.json({ error: { code: 'TAX_SCHEMA_MISSING', message: 'Tax tables are not available in this environment.' } }, 503);
        }
        return c.json({ error: { code: 'DB_ERROR', message: 'Unable to access settings' } }, 500);
    }
    return c.json(success(serializeMerchantTaxRate(data)));
});

// DELETE /taxes/:id
router.delete('/taxes/:id', async (c) => {
    const id = c.req.param('id');
    const { db, storeId, scopeColumn } = await resolveShippingTaxResourceScope(c, 'tax_rates', id);
    const { error } = await db.from('tax_rates').delete().eq('id', id).eq(scopeColumn, storeId);
    if (error) return c.json({ error: { code: 'DB_ERROR', message: 'Unable to access settings' } }, 500);
    return c.json(success({ deleted: true }));
});

export default router;
