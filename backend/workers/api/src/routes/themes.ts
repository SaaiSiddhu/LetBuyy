import { Hono } from 'hono';
import type { Env } from '../index';
import { getSupabaseAdmin, paginated, success } from '../lib/supabase';

const router = new Hono<{ Bindings: Env }>();

// GET /themes — List available themes (public)
router.get('/', async (c) => {
    const category = c.req.query('category');
    const siteType = c.req.query('site_type');
    const pricing = c.req.query('pricing');
    const search = c.req.query('search');
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
    const offset = (page - 1) * limit;
    const db = getSupabaseAdmin(c);

    let query = db
        .from('themes')
        .select('*', { count: 'exact' })
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .range(offset, offset + limit - 1);

    if (category) query = query.eq('category', category);
    if (siteType) query = query.contains('supported_site_types', [siteType]);
    if (pricing) query = query.eq('letbuyy_pricing_type', pricing);
    if (search) query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);

    const { data, error, count } = await query;

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(paginated(data || [], count || 0, page, limit));
});

// GET /themes/categories — List unique theme categories
router.get('/categories', async (c) => {
    const db = getSupabaseAdmin(c);

    const { data, error } = await db
        .from('themes')
        .select('category')
        .eq('is_active', true)
        .not('category', 'is', null);

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    // Deduplicate
    const categories = [...new Set((data || []).map((t) => t.category).filter(Boolean))];
    return c.json(success(categories));
});

// GET /themes/:slug — Get theme details by slug
router.get('/:slug', async (c) => {
    const slug = c.req.param('slug');
    const db = getSupabaseAdmin(c);

    const { data, error } = await db
        .from('themes')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .single();

    if (error || !data) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Theme not found' } }, 404);
    }

    // Fetch reviews
    const { data: reviews } = await db
        .from('theme_reviews')
        .select('*')
        .eq('theme_id', data.id)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(10);

    return c.json(success({ ...data, reviews: reviews || [] }));
});

// POST /themes/:slug/install — Install/apply a theme to a store
router.post('/:slug/install', async (c) => {
    const auth = c.get('auth');
    const slug = c.req.param('slug');
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

    // Get theme by slug
    const { data: theme } = await db
        .from('themes')
        .select('id, name, is_premium, letbuyy_pricing_type')
        .eq('slug', slug)
        .eq('is_active', true)
        .single();

    if (!theme) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Theme not found' } }, 404);
    }

    // Check if premium and user has purchased
    if (theme.is_premium || theme.letbuyy_pricing_type !== 'free') {
        const { data: purchase } = await db
            .from('theme_purchases')
            .select('id')
            .eq('user_id', auth.user.id)
            .eq('theme_id', theme.id)
            .eq('status', 'completed')
            .single();

        if (!purchase) {
            return c.json({ error: { code: 'PAYMENT_REQUIRED', message: 'This is a premium theme. Please purchase it first.' } }, 402);
        }
    }

    // Deactivate other themes for this store
    await db
        .from('store_themes')
        .update({ is_active: false })
        .eq('store_id', body.store_id);

    // Upsert the installation
    const { data: installation, error } = await db
        .from('store_themes')
        .upsert(
            {
                store_id: body.store_id,
                theme_id: theme.id,
                is_active: true,
                config_overrides: body.config_overrides || {},
                installed_at: new Date().toISOString(),
            },
            { onConflict: 'store_id,theme_id' }
        )
        .select()
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    // Also update the store's theme_id for quick access
    await db
        .from('stores')
        .update({ theme_id: slug })
        .eq('id', body.store_id);

    return c.json(success(installation), 201);
});

// POST /themes/:slug/purchase — Record a theme purchase (stub — needs payment)
router.post('/:slug/purchase', async (c) => {
    const auth = c.get('auth');
    const slug = c.req.param('slug');
    const body = await c.req.json();
    const db = getSupabaseAdmin(c);

    // Get theme
    const { data: theme } = await db
        .from('themes')
        .select('id, name, letbuyy_price_inr, letbuyy_price_usd')
        .eq('slug', slug)
        .single();

    if (!theme) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Theme not found' } }, 404);
    }

    // Stub: create a pending purchase record
    const { data, error } = await db
        .from('theme_purchases')
        .upsert(
            {
                user_id: auth.user.id,
                theme_id: theme.id,
                price_paid_inr: theme.letbuyy_price_inr || 0,
                price_paid_usd: theme.letbuyy_price_usd || 0,
                currency: body.currency || 'INR',
                payment_method: 'pending',
                status: 'pending',
            },
            { onConflict: 'user_id,theme_id' }
        )
        .select()
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json({
        data: {
            purchase_id: data.id,
            theme: theme.name,
            amount_inr: theme.letbuyy_price_inr,
            status: 'pending',
            message: 'Payment processing will be available once Razorpay integration is configured.',
            is_stub: true,
        },
    });
});

// GET /themes/purchases — List user's purchased themes
router.get('/purchases/list', async (c) => {
    const auth = c.get('auth');
    const db = getSupabaseAdmin(c);

    const { data, error } = await db
        .from('theme_purchases')
        .select('*, themes(id, name, slug, thumbnail_url, description)')
        .eq('user_id', auth.user.id)
        .order('purchased_at', { ascending: false });

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data || []));
});

export default router;
