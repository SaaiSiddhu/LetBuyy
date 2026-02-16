import { Hono } from 'hono';
import type { Env } from '../index';
import { getSupabaseAdmin, paginated, success } from '../lib/supabase';

const router = new Hono<{ Bindings: Env }>();

// GET /app-store/apps — List marketplace apps (public-like, filtered by status=published for non-owners)
router.get('/apps', async (c) => {
    const category = c.req.query('category');
    const search = c.req.query('search');
    const pricing = c.req.query('pricing');
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
    const offset = (page - 1) * limit;
    const db = getSupabaseAdmin(c);

    let query = db
        .from('marketplace_apps')
        .select('*, app_developers(company_name, verified), app_categories(name, slug)', { count: 'exact' })
        .eq('status', 'published')
        .order('install_count', { ascending: false })
        .range(offset, offset + limit - 1);

    if (category) query = query.eq('category_id', category);
    if (pricing) query = query.eq('pricing_model', pricing);
    if (search) query = query.or(`name.ilike.%${search}%,tagline.ilike.%${search}%`);

    const { data, error, count } = await query;

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(paginated(data || [], count || 0, page, limit));
});

// GET /app-store/apps/:id — Get app details
router.get('/apps/:id', async (c) => {
    const appId = c.req.param('id');
    const db = getSupabaseAdmin(c);

    const { data, error } = await db
        .from('marketplace_apps')
        .select('*, app_developers(id, company_name, website_url, verified), app_categories(name, slug), app_extensions(*)')
        .eq('id', appId)
        .single();

    if (error || !data) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'App not found' } }, 404);
    }

    return c.json(success(data));
});

// GET /app-store/apps/:id/reviews — List reviews
router.get('/apps/:id/reviews', async (c) => {
    const appId = c.req.param('id');
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
    const offset = (page - 1) * limit;
    const db = getSupabaseAdmin(c);

    const { data, error, count } = await db
        .from('app_reviews')
        .select('*', { count: 'exact' })
        .eq('app_id', appId)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(paginated(data || [], count || 0, page, limit));
});

// POST /app-store/apps/:id/reviews — Submit a review
router.post('/apps/:id/reviews', async (c) => {
    const auth = c.get('auth');
    const appId = c.req.param('id');
    const body = await c.req.json();
    const db = getSupabaseAdmin(c);

    if (!body.rating || body.rating < 1 || body.rating > 5) {
        return c.json({ error: { code: 'VALIDATION', message: 'rating (1-5) is required' } }, 400);
    }

    // Check if user has installed this app (verified review)
    const { data: installation } = await db
        .from('app_installations')
        .select('id')
        .eq('app_id', appId)
        .eq('installed_by', auth.user.id)
        .limit(1);

    const isVerified = installation && installation.length > 0;

    const { data, error } = await db
        .from('app_reviews')
        .upsert(
            {
                app_id: appId,
                user_id: auth.user.id,
                store_id: body.store_id || null,
                rating: body.rating,
                title: body.title || null,
                body: body.body || null,
                is_verified: isVerified,
                status: 'published',
            },
            { onConflict: 'app_id,user_id' }
        )
        .select()
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    // Update app's denormalized rating
    const { data: stats } = await db
        .from('app_reviews')
        .select('rating')
        .eq('app_id', appId)
        .eq('status', 'published');

    if (stats && stats.length > 0) {
        const avgRating = stats.reduce((sum, r) => sum + r.rating, 0) / stats.length;
        await db
            .from('marketplace_apps')
            .update({
                rating_avg: Math.round(avgRating * 100) / 100,
                review_count: stats.length,
            })
            .eq('id', appId);
    }

    return c.json(success(data), 201);
});

// GET /app-store/installations — List installed apps for a store
router.get('/installations', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.query('store_id');
    const db = getSupabaseAdmin(c);

    if (!storeId) {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id is required' } }, 400);
    }

    const { data, error } = await db
        .from('app_installations')
        .select('*, marketplace_apps(id, name, slug, icon_url, tagline, pricing_model)')
        .eq('store_id', storeId)
        .eq('installed_by', auth.user.id)
        .neq('status', 'uninstalled')
        .order('installed_at', { ascending: false });

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data || []));
});

// POST /app-store/apps/:id/install — Install an app
router.post('/apps/:id/install', async (c) => {
    const auth = c.get('auth');
    const appId = c.req.param('id');
    const body = await c.req.json();
    const db = getSupabaseAdmin(c);

    if (!body.store_id) {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id is required' } }, 400);
    }

    // Verify store ownership
    const { data: store } = await db
        .from('stores')
        .select('id')
        .eq('id', body.store_id)
        .eq('user_id', auth.user.id)
        .single();

    if (!store) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    // Verify app exists and is published
    const { data: app } = await db
        .from('marketplace_apps')
        .select('id, name')
        .eq('id', appId)
        .eq('status', 'published')
        .single();

    if (!app) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'App not found or not available' } }, 404);
    }

    // Upsert installation
    const { data, error } = await db
        .from('app_installations')
        .upsert(
            {
                app_id: appId,
                store_id: body.store_id,
                installed_by: auth.user.id,
                status: 'active',
                scopes_granted: body.scopes || [],
                config: body.config || {},
                installed_at: new Date().toISOString(),
                uninstalled_at: null,
            },
            { onConflict: 'app_id,store_id' }
        )
        .select()
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    // Increment install count (best-effort, non-blocking)
    try {
        const { data: currentApp } = await db
            .from('marketplace_apps')
            .select('install_count')
            .eq('id', appId)
            .single();

        await db
            .from('marketplace_apps')
            .update({ install_count: (currentApp?.install_count || 0) + 1 })
            .eq('id', appId);
    } catch {
        // Non-critical — install count update failed silently
    }

    return c.json(success(data), 201);
});

// DELETE /app-store/apps/:id/install — Uninstall an app
router.delete('/apps/:id/install', async (c) => {
    const auth = c.get('auth');
    const appId = c.req.param('id');
    const storeId = c.req.query('store_id');
    const db = getSupabaseAdmin(c);

    if (!storeId) {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id is required' } }, 400);
    }

    const { error } = await db
        .from('app_installations')
        .update({
            status: 'uninstalled',
            uninstalled_at: new Date().toISOString(),
        })
        .eq('app_id', appId)
        .eq('store_id', storeId)
        .eq('installed_by', auth.user.id);

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json({ data: { uninstalled: true } });
});

// GET /app-store/developers/:id — Get developer profile + apps
router.get('/developers/:id', async (c) => {
    const devId = c.req.param('id');
    const db = getSupabaseAdmin(c);

    const { data: developer, error } = await db
        .from('app_developers')
        .select('id, company_name, website_url, description, verified, created_at')
        .eq('id', devId)
        .single();

    if (error || !developer) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Developer not found' } }, 404);
    }

    const { data: apps } = await db
        .from('marketplace_apps')
        .select('id, name, slug, icon_url, tagline, pricing_model, install_count, rating_avg, review_count')
        .eq('developer_id', devId)
        .eq('status', 'published')
        .order('install_count', { ascending: false });

    return c.json(success({ ...developer, apps: apps || [] }));
});

export default router;
