import { Hono } from 'hono';
import type { Env } from '../index';
import { getSupabaseAdmin, success } from '../lib/supabase';

const router = new Hono<{ Bindings: Env }>();

// GET /portfolio — List portfolio projects
router.get('/', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.query('store_id');
    const db = getSupabaseAdmin(c);

    let query = db
        .from('portfolio_projects')
        .select('*, stores!inner(user_id)')
        .eq('stores.user_id', auth.user.id)
        .order('display_order', { ascending: true });

    if (storeId) query = query.eq('store_id', storeId);

    const { data, error } = await query;

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data || []));
});

// POST /portfolio — Create a project
router.post('/', async (c) => {
    const auth = c.get('auth');
    const body = await c.req.json();
    const db = getSupabaseAdmin(c);

    if (!body.title || !body.store_id) {
        return c.json({ error: { code: 'VALIDATION', message: 'title and store_id required' } }, 400);
    }

    const { data, error } = await db
        .from('portfolio_projects')
        .insert({
            store_id: body.store_id,
            title: body.title,
            description: body.description || '',
            thumbnail_url: body.thumbnail_url,
            live_url: body.live_url,
            github_url: body.github_url,
            tags: body.tags || [],
            display_order: body.display_order || 0,
        })
        .select()
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data), 201);
});

// PATCH /portfolio/:id
router.patch('/:id', async (c) => {
    const projectId = c.req.param('id');
    const body = await c.req.json();
    const db = getSupabaseAdmin(c);

    const allowed = ['title', 'description', 'thumbnail_url', 'live_url', 'github_url', 'tags', 'display_order'];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
        if (body[key] !== undefined) updates[key] = body[key];
    }

    const { data, error } = await db
        .from('portfolio_projects')
        .update(updates)
        .eq('id', projectId)
        .select()
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data));
});

// DELETE /portfolio/:id
router.delete('/:id', async (c) => {
    const projectId = c.req.param('id');
    const db = getSupabaseAdmin(c);

    const { error } = await db.from('portfolio_projects').delete().eq('id', projectId);

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json({ data: { deleted: true } });
});

export default router;
