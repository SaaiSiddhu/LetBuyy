// ============================================================
// CATEGORIES — Hierarchical product categories (Doc 08 § 5.4)
// ============================================================

import { Hono } from 'hono';
import type { Env } from '../index';
import { resolveCustomUser, verifySiteOwnership } from '../lib/auth-user';
import { getSupabaseAdmin, paginated, success } from '../lib/supabase';
import { validate } from '../middleware/validation';
import {
    buildCategoryTree,
    CreateCategorySchema,
    planCategoryCreate,
    UpdateCategorySchema,
    type CategoryParentRecord,
    type CategoryTreeRecord,
    type CreateCategoryInput,
    type UpdateCategoryInput,
} from '@letbuyy/commerce-core';

const router = new Hono<{ Bindings: Env }>();

interface CategoryOwnerRow {
    id: string;
    store_id?: string | null;
    level?: number | null;
    path?: string | null;
}

type DatabaseErrorLike = {
    message?: string;
    details?: string;
    hint?: string;
} | null | undefined;

function databaseErrorText(error: DatabaseErrorLike): string {
    return [error?.message, error?.details, error?.hint].filter(Boolean).join(' ').toLowerCase();
}

function isMissingColumnError(error: DatabaseErrorLike, columnName: string): boolean {
    const text = databaseErrorText(error);
    return text.includes(columnName.toLowerCase()) && (
        text.includes('does not exist') ||
        text.includes('schema cache') ||
        text.includes('could not find')
    );
}

function isMissingDeletedAtError(error: DatabaseErrorLike): boolean {
    return isMissingColumnError(error, 'deleted_at');
}

function isMissingTableError(error: DatabaseErrorLike, tableName: string): boolean {
    const text = databaseErrorText(error);
    return text.includes(tableName.toLowerCase()) && (
        text.includes('does not exist') ||
        text.includes('schema cache') ||
        text.includes('could not find')
    );
}

// GET /categories — List categories for a store (tree structure)
router.get('/', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.query('store_id');
    const flat = c.req.query('flat') === 'true';
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const ownedStoreIds = storeId
        ? [storeId]
        : await listOwnedStoreIds(db, customUser.id, auth.user.storeId);

    if (storeId && !(await verifySiteOwnership(db, storeId, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    if (ownedStoreIds.length === 0) {
        return c.json(success([]));
    }

    let query = db
        .from('product_categories')
        .select('*')
        .in('store_id', ownedStoreIds)
        .order('display_order', { ascending: true });

    const { data, error } = await query;

    if (isMissingTableError(error, 'product_categories')) {
        return c.json(success([]));
    }

    if (error) {
        return c.json({ success: false, error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    if (flat) {
        return c.json(success(data || []));
    }

    // Build tree structure
    const categories = (data || []) as CategoryTreeRecord[];
    const tree = buildCategoryTree(categories);
    return c.json(success(tree));
});

// POST /categories — Create a category
router.post('/', validate('json', CreateCategorySchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as CreateCategoryInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }
    if (!(await verifySiteOwnership(db, body.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    let parentCategory: CategoryParentRecord | null = null;
    if (body.parent_id) {
        const { data: parent } = await db
            .from('product_categories')
            .select('level, path, store_id')
            .eq('id', body.parent_id)
            .single();

        parentCategory = parent as CategoryOwnerRow | null;
    }
    const plan = planCategoryCreate(body, parentCategory);

    const { data, error } = await db
        .from('product_categories')
        .insert(plan.categoryInsert)
        .select()
        .single();

    if (isMissingTableError(error, 'product_categories')) {
        return c.json({
            success: false,
            error: {
                code: 'CATEGORIES_SCHEMA_MISSING',
                message: 'Product categories are not available in this local database schema',
            },
        }, 503);
    }

    if (error) {
        return c.json({ success: false, error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data), 201);
});

// GET /categories/:id — Get a single category
router.get('/:id', async (c) => {
    const auth = c.get('auth');
    const categoryId = c.req.param('id');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const { data, error } = await db
        .from('product_categories')
        .select('*, products(count)')
        .eq('id', categoryId)
        .single();

    if (error || !data || !(await verifySiteOwnership(db, data.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Category not found' } }, 404);
    }

    return c.json(success(data));
});

// PATCH /categories/:id — Update a category
router.patch('/:id', validate('json', UpdateCategorySchema), async (c) => {
    const auth = c.get('auth');
    const categoryId = c.req.param('id');
    const body = c.get('validatedBody') as UpdateCategoryInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    const { data: existing } = await db
        .from('product_categories')
        .select('id, store_id')
        .eq('id', categoryId)
        .single();

    const ownedCategory = existing as CategoryOwnerRow | null;
    if (!customUser || !ownedCategory?.store_id || !(await verifySiteOwnership(db, ownedCategory.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const { data, error } = await db
        .from('product_categories')
        .update(body)
        .eq('id', categoryId)
        .select()
        .single();

    if (error || !data) {
        return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Category not found' } }, 404);
    }

    return c.json(success(data));
});

// DELETE /categories/:id — Delete a category
router.delete('/:id', async (c) => {
    const auth = c.get('auth');
    const categoryId = c.req.param('id');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    const { data: existing } = await db
        .from('product_categories')
        .select('id, store_id')
        .eq('id', categoryId)
        .single();

    const ownedCategory = existing as CategoryOwnerRow | null;
    if (!customUser || !ownedCategory?.store_id || !(await verifySiteOwnership(db, ownedCategory.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    // Set children's parent_id to null
    await db
        .from('product_categories')
        .update({ parent_id: null })
        .eq('parent_id', categoryId);

    // Remove category reference from products
    await db
        .from('products')
        .update({ category_id: null })
        .eq('category_id', categoryId);

    const { error } = await db
        .from('product_categories')
        .delete()
        .eq('id', categoryId);

    if (error) {
        return c.json({ success: false, error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success({ deleted: true }));
});

// ── Helpers ─────────────────────────────────────────────────

async function listOwnedStoreIds(
    db: ReturnType<typeof getSupabaseAdmin>,
    userId: string,
    sessionStoreId?: string
) {
    const buildOwnedStoresQuery = (includeDeletedAtFilter: boolean) => {
        let query = db
        .from('sites')
        .select('id')
        .or(`custom_user_id.eq.${userId},user_id.eq.${userId}`);

        if (includeDeletedAtFilter) query = query.is('deleted_at', null);
        if (sessionStoreId) query = query.eq('id', sessionStoreId);
        return query;
    };

    let { data, error } = await buildOwnedStoresQuery(true);
    if (isMissingDeletedAtError(error)) {
        ({ data, error } = await buildOwnedStoresQuery(false));
    }
    if (error) throw new Error(`Store ownership lookup failed: ${error.message}`);

    return (data || []).map((store) => store.id as string);
}

export default router;
