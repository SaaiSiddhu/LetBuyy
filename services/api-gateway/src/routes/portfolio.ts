import { Hono } from 'hono';
import type { Env } from '../index';
import { resolveCustomUser, verifySiteOwnership } from '../lib/auth-user';
import { getSupabaseAdmin, success } from '../lib/supabase';

const router = new Hono<{ Bindings: Env }>();

// GET /portfolio — List portfolio projects
router.get('/', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.query('store_id');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const ownedStoreIds = storeId ? [storeId] : await listOwnedStoreIds(db, customUser.id, auth.user.storeId);
    if (storeId && !(await verifySiteOwnership(db, storeId, customUser.id, auth.user.storeId))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }
    if (ownedStoreIds.length === 0) return c.json(success([]));

    const query = db
        .from('portfolio_projects')
        .select('*')
        .in('store_id', ownedStoreIds)
        .order('display_order', { ascending: true });

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
    const customUser = await resolveCustomUser(db, auth.user);

    if (!body.title || !body.store_id) {
        return c.json({ error: { code: 'VALIDATION', message: 'title and store_id required' } }, 400);
    }
    if (!customUser || !(await verifySiteOwnership(db, body.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
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
    const auth = c.get('auth');
    const projectId = c.req.param('id');
    const body = await c.req.json();
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    const { data: existing } = await db
        .from('portfolio_projects')
        .select('store_id')
        .eq('id', projectId)
        .single();

    const storeId = existing?.store_id as string | undefined;
    if (!customUser || !storeId || !(await verifySiteOwnership(db, storeId, customUser.id, auth.user.storeId))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

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
    const auth = c.get('auth');
    const projectId = c.req.param('id');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    const { data: existing } = await db
        .from('portfolio_projects')
        .select('store_id')
        .eq('id', projectId)
        .single();

    const storeId = existing?.store_id as string | undefined;
    if (!customUser || !storeId || !(await verifySiteOwnership(db, storeId, customUser.id, auth.user.storeId))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const { error } = await db.from('portfolio_projects').delete().eq('id', projectId);

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json({ data: { deleted: true } });
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
