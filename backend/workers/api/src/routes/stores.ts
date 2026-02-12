import { Hono } from 'hono';
import type { Env } from '../index';
import { getSupabaseAdmin, paginated, success } from '../lib/supabase';

const router = new Hono<{ Bindings: Env }>();

// GET /stores — List all stores for the authenticated user
router.get('/', async (c) => {
    const auth = c.get('auth');
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '10'), 50);
    const offset = (page - 1) * limit;

    const db = getSupabaseAdmin(c);

    const { data, error, count } = await db
        .from('stores')
        .select('*', { count: 'exact' })
        .eq('user_id', auth.user.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(paginated(data || [], count || 0, page, limit));
});

// GET /stores/public/:subdomain — Public store data (no auth required)
router.get('/public/:subdomain', async (c) => {
    const subdomain = c.req.param('subdomain');
    const db = getSupabaseAdmin(c);

    const { data, error } = await db
        .from('stores')
        .select('id, name, subdomain, tagline, logo_url, custom_domain, site_type, theme_id, template_config, meta_title, meta_description, published_at')
        .eq('subdomain', subdomain)
        .eq('status', 'published')
        .single();

    if (error || !data) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);
    }

    return c.json(success(data));
});

// GET /stores/:id — Get a specific store
router.get('/:id', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.param('id');
    const db = getSupabaseAdmin(c);

    const { data, error } = await db
        .from('stores')
        .select('*')
        .eq('id', storeId)
        .eq('user_id', auth.user.id)
        .single();

    if (error || !data) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);
    }

    return c.json(success(data));
});

// POST /stores — Create a new store
router.post('/', async (c) => {
    const auth = c.get('auth');
    const body = await c.req.json();
    const db = getSupabaseAdmin(c);

    // Validate required fields
    if (!body.name || !body.subdomain) {
        return c.json({ error: { code: 'VALIDATION', message: 'name and subdomain are required' } }, 400);
    }

    // Check subdomain uniqueness
    const { data: existing } = await db
        .from('stores')
        .select('id')
        .eq('subdomain', body.subdomain)
        .limit(1);

    if (existing && existing.length > 0) {
        return c.json({ error: { code: 'CONFLICT', message: 'Subdomain already taken' } }, 409);
    }

    const { data, error } = await db
        .from('stores')
        .insert({
            user_id: auth.user.id,
            name: body.name,
            subdomain: body.subdomain.toLowerCase().replace(/[^a-z0-9-]/g, ''),
            site_type: body.site_type || 'store',
            status: 'draft',
            tagline: body.tagline,
            theme_id: body.theme_id || 'modern',
            template_config: body.template_config || {},
        })
        .select()
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data), 201);
});

// PATCH /stores/:id — Update a store
router.patch('/:id', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.param('id');
    const body = await c.req.json();
    const db = getSupabaseAdmin(c);

    // Build update payload (only allow safe fields)
    const allowed = ['name', 'tagline', 'status', 'theme_id', 'template_config',
        'logo_url', 'custom_domain', 'seo_title', 'seo_description'];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
        if (body[key] !== undefined) updates[key] = body[key];
    }

    if (Object.keys(updates).length === 0) {
        return c.json({ error: { code: 'VALIDATION', message: 'No valid fields to update' } }, 400);
    }

    // Publish timestamp
    if (updates.status === 'published') {
        updates.published_at = new Date().toISOString();
    }

    const { data, error } = await db
        .from('stores')
        .update(updates)
        .eq('id', storeId)
        .eq('user_id', auth.user.id)
        .select()
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data));
});

// POST /stores/:id/publish — Publish a store
router.post('/:id/publish', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.param('id');
    const db = getSupabaseAdmin(c);

    const { data, error } = await db
        .from('stores')
        .update({
            status: 'published',
            published_at: new Date().toISOString(),
        })
        .eq('id', storeId)
        .eq('user_id', auth.user.id)
        .select()
        .single();

    if (error || !data) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Store not found or not owned by you' } }, 404);
    }

    return c.json(success(data));
});

// DELETE /stores/:id — Soft delete (set status to suspended)
router.delete('/:id', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.param('id');
    const db = getSupabaseAdmin(c);

    const { error } = await db
        .from('stores')
        .update({ status: 'suspended' })
        .eq('id', storeId)
        .eq('user_id', auth.user.id);

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json({ data: { deleted: true } });
});

export default router;
