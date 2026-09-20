// ============================================================
// SMART COLLECTIONS — CRUD + live preview
// Gateway route: /v1/smart-collections
// ============================================================

import { Hono } from 'hono';
import type { Env } from '../index';
import { resolveCustomUser, verifySiteOwnership } from '../lib/auth-user';
import { assertStaffPermission } from '../middleware/staff-permission';
import { getSupabaseAdmin, getSupabaseAdminUnguarded, success } from '../lib/supabase';
import { filterProducts, type SmartCondition, type SmartMatchType, type EvalProduct } from '../lib/smart-collection-eval';

const router = new Hono<{ Bindings: Env }>();

// Columns selected for the smart_collections table
const SC_COLUMNS = 'id,store_id,name,slug,description,conditions,match_type,created_at,created_by,updated_by,version';

// Columns selected for products during preview evaluation
const PRODUCT_PREVIEW_COLUMNS = 'id,name,title,product_type,vendor,tags,price,stock,inventory_quantity';

// Max products fetched for preview evaluation (guard against massive catalogs)
const PREVIEW_PRODUCT_LIMIT = 500;

// Max sample product IDs returned in preview response
const PREVIEW_SAMPLE_SIZE = 10;

interface SmartCollectionRow {
    id: string;
    store_id: string;
    name: string;
    slug: string;
    description?: string | null;
    conditions: SmartCondition[];
    match_type: SmartMatchType;
    created_at: string;
    created_by?: string | null;
    updated_by?: string | null;
    version: number;
}

interface SmartCollectionOwnerRow {
    id: string;
    store_id?: string | null;
}

// ── GET / — list smart collections for a store ────────────────────────────────
router.get('/', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.query('store_id');

    if (!storeId) {
        return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'store_id query parameter is required' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    if (!(await verifySiteOwnership(db, storeId, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const { data, error } = await db
        .from('smart_collections')
        .select(SC_COLUMNS)
        .eq('store_id', storeId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

    if (error) {
        return c.json({ success: false, error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data || []));
});

// ── POST / — create a smart collection ───────────────────────────────────────
router.post('/', async (c) => {
    const auth = c.get('auth');
    const body = await c.req.json() as {
        store_id: string;
        name: string;
        slug: string;
        description?: string;
        conditions: SmartCondition[];
        match_type?: SmartMatchType;
    };

    if (!body.store_id || !body.name || !body.slug) {
        return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'store_id, name, and slug are required' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    if (!(await verifySiteOwnership(db, body.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const staffBlock = await assertStaffPermission(c, body.store_id, customUser.id, 'products:write');
    if (staffBlock) return staffBlock;

    // Check slug uniqueness within the store
    const { data: existing } = await db
        .from('smart_collections')
        .select('id')
        .eq('store_id', body.store_id)
        .eq('slug', body.slug)
        .is('deleted_at', null)
        .limit(1);

    if (existing && existing.length > 0) {
        return c.json({ success: false, error: { code: 'CONFLICT', message: 'A smart collection with this slug already exists' } }, 409);
    }

    const { data, error } = await db
        .from('smart_collections')
        .insert({
            store_id: body.store_id,
            name: body.name,
            slug: body.slug,
            description: body.description ?? null,
            conditions: body.conditions ?? [],
            match_type: body.match_type ?? 'all',
            created_by: customUser.id,
        })
        .select(SC_COLUMNS)
        .single();

    if (error) {
        return c.json({ success: false, error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data), 201);
});

// ── PATCH /:id — update a smart collection ────────────────────────────────────
router.patch('/:id', async (c) => {
    const auth = c.get('auth');
    const collectionId = c.req.param('id');
    const body = await c.req.json() as Partial<{
        name: string;
        slug: string;
        description: string | null;
        conditions: SmartCondition[];
        match_type: SmartMatchType;
    }>;

    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    // Resolve ownership first via the collection record
    const { data: existing } = await getSupabaseAdminUnguarded(c)
        .from('smart_collections')
        .select('id, store_id')
        .eq('id', collectionId)
        .is('deleted_at', null)
        .single();

    const owned = existing as SmartCollectionOwnerRow | null;
    if (!customUser || !owned?.store_id || !(await verifySiteOwnership(db, owned.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const staffBlock = await assertStaffPermission(c, owned.store_id, customUser.id, 'products:write');
    if (staffBlock) return staffBlock;

    // Build patch object from allowed mutable fields only
    const patch: Record<string, unknown> = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.slug !== undefined) patch.slug = body.slug;
    if ('description' in body) patch.description = body.description ?? null;
    if (body.conditions !== undefined) patch.conditions = body.conditions;
    if (body.match_type !== undefined) patch.match_type = body.match_type;
    patch.updated_by = customUser.id;

    if (Object.keys(patch).length <= 1) {
        // Only updated_by was set — nothing to actually update
        return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'No valid fields to update' } }, 400);
    }

    // Slug uniqueness check if slug is being changed
    if (body.slug !== undefined) {
        const { data: slugConflict } = await db
            .from('smart_collections')
            .select('id')
            .eq('store_id', owned.store_id)
            .eq('slug', body.slug)
            .neq('id', collectionId)
            .is('deleted_at', null)
            .limit(1);

        if (slugConflict && slugConflict.length > 0) {
            return c.json({ success: false, error: { code: 'CONFLICT', message: 'A smart collection with this slug already exists' } }, 409);
        }
    }

    const { data, error } = await db
        .from('smart_collections')
        .update(patch)
        .eq('id', collectionId)
        .eq('store_id', owned.store_id)
        .select(SC_COLUMNS)
        .single();

    if (error || !data) {
        return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Smart collection not found' } }, 404);
    }

    return c.json(success(data));
});

// ── GET /:id/preview — evaluate conditions against the store's products ───────
router.get('/:id/preview', async (c) => {
    const auth = c.get('auth');
    const collectionId = c.req.param('id');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    // Fetch the smart collection
    const { data: sc, error: scError } = await getSupabaseAdminUnguarded(c)
        .from('smart_collections')
        .select(SC_COLUMNS)
        .eq('id', collectionId)
        .is('deleted_at', null)
        .single();

    if (scError || !sc) {
        return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Smart collection not found' } }, 404);
    }

    const scRow = sc as SmartCollectionRow;

    if (!customUser || !(await verifySiteOwnership(db, scRow.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    // Fetch the store's active products for evaluation
    const { data: products, error: prodError } = await db
        .from('products')
        .select(PRODUCT_PREVIEW_COLUMNS)
        .eq('store_id', scRow.store_id)
        .is('deleted_at', null)
        .eq('is_active', true)
        .limit(PREVIEW_PRODUCT_LIMIT);

    if (prodError) {
        return c.json({ success: false, error: { code: 'DB_ERROR', message: prodError.message } }, 500);
    }

    const evalProducts = (products || []) as EvalProduct[];
    const matched = filterProducts(evalProducts, scRow.conditions ?? [], (scRow.match_type as SmartMatchType) ?? 'all');

    return c.json(success({
        collection_id: scRow.id,
        match_type: scRow.match_type,
        condition_count: (scRow.conditions ?? []).length,
        count: matched.length,
        sample_product_ids: matched.slice(0, PREVIEW_SAMPLE_SIZE).map((p) => p.id),
        // Indicate whether the result is over the evaluation limit
        evaluated_of: evalProducts.length,
        capped_at: PREVIEW_PRODUCT_LIMIT,
    }));
});

export default router;
