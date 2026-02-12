import { Hono } from 'hono';
import type { Env } from '../index';
import { getSupabaseAdmin, paginated, success } from '../lib/supabase';

const router = new Hono<{ Bindings: Env }>();

// GET /products — List products (optionally by store)
router.get('/', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.query('store_id');
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
    const offset = (page - 1) * limit;
    const db = getSupabaseAdmin(c);

    let query = db
        .from('products')
        .select('*, stores!inner(user_id)', { count: 'exact' })
        .eq('stores.user_id', auth.user.id)
        .order('display_order', { ascending: true })
        .range(offset, offset + limit - 1);

    if (storeId) {
        query = query.eq('store_id', storeId);
    }

    const { data, error, count } = await query;

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(paginated(data || [], count || 0, page, limit));
});

// GET /products/:id
router.get('/:id', async (c) => {
    const productId = c.req.param('id');
    const db = getSupabaseAdmin(c);

    const { data, error } = await db
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();

    if (error || !data) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Product not found' } }, 404);
    }

    return c.json(success(data));
});

// POST /products — Create a product
router.post('/', async (c) => {
    const auth = c.get('auth');
    const body = await c.req.json();
    const db = getSupabaseAdmin(c);

    if (!body.name || !body.store_id) {
        return c.json({ error: { code: 'VALIDATION', message: 'name and store_id are required' } }, 400);
    }

    // Verify ownership of the site
    const { data: store } = await db
        .from('stores')
        .select('id')
        .eq('id', body.store_id)
        .eq('user_id', auth.user.id)
        .single();

    if (!store) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'You do not own this store' } }, 403);
    }

    const { data, error } = await db
        .from('products')
        .insert({
            store_id: body.store_id,
            name: body.name,
            description: body.description || '',
            price: body.price || 0,
            compare_price: body.compare_price,
            images: body.images || [],
            category: body.category,
            stock: body.stock || 0,
            is_active: body.is_active ?? true,
            is_featured: body.is_featured ?? false,
            tags: body.tags || [],
            variants: body.variants || [],
            display_order: body.display_order || 0,
        })
        .select()
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data), 201);
});

// PATCH /products/:id
router.patch('/:id', async (c) => {
    const auth = c.get('auth');
    const productId = c.req.param('id');
    const body = await c.req.json();
    const db = getSupabaseAdmin(c);

    const allowed = ['name', 'description', 'price', 'compare_price', 'images',
        'category', 'stock', 'is_active', 'is_featured', 'tags', 'variants', 'display_order'];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
        if (body[key] !== undefined) updates[key] = body[key];
    }

    if (Object.keys(updates).length === 0) {
        return c.json({ error: { code: 'VALIDATION', message: 'No valid fields to update' } }, 400);
    }

    // Verify user owns the product's site
    const { data: product } = await db
        .from('products')
        .select('store_id, stores!inner(user_id)')
        .eq('id', productId)
        .single();

    if (!product || (product as any).stores?.user_id !== auth.user.id) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const { data, error } = await db
        .from('products')
        .update(updates)
        .eq('id', productId)
        .select()
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data));
});

// POST /products/bulk — Bulk operations (activate, deactivate, delete)
router.post('/bulk', async (c) => {
    const auth = c.get('auth');
    const { action, product_ids, store_id } = await c.req.json();
    const db = getSupabaseAdmin(c);

    if (!action || !product_ids || !Array.isArray(product_ids) || product_ids.length === 0) {
        return c.json({ error: { code: 'VALIDATION', message: 'action and product_ids[] required' } }, 400);
    }

    // Verify store ownership
    if (store_id) {
        const { data: store } = await db
            .from('stores')
            .select('id')
            .eq('id', store_id)
            .eq('user_id', auth.user.id)
            .single();

        if (!store) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized for this store' } }, 403);
        }
    }

    let update: Record<string, unknown>;
    switch (action) {
        case 'activate':
            update = { is_active: true };
            break;
        case 'deactivate':
            update = { is_active: false };
            break;
        case 'delete':
            update = { is_active: false }; // Soft delete
            break;
        default:
            return c.json({ error: { code: 'VALIDATION', message: `Invalid action: ${action}` } }, 400);
    }

    const { data, error } = await db
        .from('products')
        .update(update)
        .in('id', product_ids)
        .select('id');

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success({ affected: data?.length || 0, action }));
});

// DELETE /products/:id
router.delete('/:id', async (c) => {
    const auth = c.get('auth');
    const productId = c.req.param('id');
    const db = getSupabaseAdmin(c);

    // Verify ownership
    const { data: product } = await db
        .from('products')
        .select('store_id, stores!inner(user_id)')
        .eq('id', productId)
        .single();

    if (!product || (product as any).stores?.user_id !== auth.user.id) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    // Soft delete by setting is_active = false
    const { error } = await db
        .from('products')
        .update({ is_active: false })
        .eq('id', productId);

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json({ data: { deleted: true } });
});

export default router;
