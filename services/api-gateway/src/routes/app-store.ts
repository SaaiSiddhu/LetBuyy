import { Hono } from 'hono';
import type { Env } from '../index';
import { resolveCustomUser, verifySiteOwnership } from '../lib/auth-user';
import { getSupabaseAdmin, paginated, success } from '../lib/supabase';
import { authMiddleware } from '../middleware/auth';
import { isAppStoreUuid as isUuid } from '@letbuyy/app-engine';
import { registerAppStoreExtensionRoutes } from './app-store/extension-routes';
import { registerAppStoreBillingOAuthRoutes } from './app-store/billing-oauth-routes';
import { registerAppStoreInstallLifecycleRoutes } from './app-store/install-lifecycle-routes';
import { registerAppStoreDeveloperRoutes } from './app-store/developer-routes';
import { registerAppStoreComplianceRoutes } from './app-store/compliance-routes';

const router = new Hono<{ Bindings: Env }>();

// GET /app-store/categories — List active app categories
router.get('/categories', async (c) => {
    const { data, error } = await getSupabaseAdmin(c)
        .from('app_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data || []));
});

// GET /app-store/apps — List marketplace apps (public-like, filtered by status=published for non-owners)
router.get('/apps', async (c) => {
    const category = c.req.query('category');
    const search = c.req.query('search');
    const pricing = c.req.query('pricing');
    const siteType = c.req.query('site_type');
    const sort = c.req.query('sort') || 'popular';
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
    const offset = (page - 1) * limit;
    const db = getSupabaseAdmin(c);

    let query = db
        .from('marketplace_apps')
        .select('*, app_developers!inner(company_name, slug, logo_url, verified), app_categories!inner(name, slug, icon)', { count: 'exact' })
        .eq('status', 'published');

    if (category) query = isUuid(category) ? query.eq('category_id', category) : query.eq('app_categories.slug', category);
    if (pricing) query = query.eq('pricing_model', pricing);
    if (siteType) query = query.contains('supported_site_types', [siteType]);
    if (search) query = query.or(`name.ilike.%${search}%,tagline.ilike.%${search}%`);

    switch (sort) {
        case 'rating':
            query = query.order('rating_avg', { ascending: false });
            break;
        case 'recent':
            query = query.order('created_at', { ascending: false });
            break;
        case 'name':
            query = query.order('name', { ascending: true });
            break;
        case 'popular':
        default:
            query = query.order('install_count', { ascending: false });
            break;
    }

    query = query.range(offset, offset + limit - 1);

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

    let query = db
        .from('marketplace_apps')
        .select('*, app_developers(id, company_name, slug, logo_url, website_url, support_email, verified), app_categories(name, slug, icon), app_extensions(*)')
        .eq('status', 'published');

    query = isUuid(appId) ? query.eq('id', appId) : query.eq('slug', appId);

    const { data, error } = await query.single();

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
router.post('/apps/:id/reviews', authMiddleware, async (c) => {
    const auth = c.get('auth');
    const appId = c.req.param('id');
    const body = await c.req.json();
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    if (!body.rating || body.rating < 1 || body.rating > 5) {
        return c.json({ error: { code: 'VALIDATION', message: 'rating (1-5) is required' } }, 400);
    }

    if (body.store_id) {
        const ownsStore = await verifySiteOwnership(db, body.store_id, customUser.id, auth.user.storeId);
        if (!ownsStore) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized for this store' } }, 403);
        }
    }

    // Require an active installation for this app before accepting a review
    // (verified-install reviews only — no drive-by ratings).
    let installationQuery = db
        .from('app_installations')
        .select('id')
        .eq('app_id', appId)
        .eq('installed_by', customUser.id)
        .eq('status', 'active');
    if (body.store_id) {
        installationQuery = installationQuery.eq('store_id', body.store_id);
    }
    const { data: installation } = await installationQuery.limit(1);

    if (!installation || installation.length === 0) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'You must have an active installation of this app to review it' } }, 403);
    }

    const isVerified = true;

    const { data, error } = await db
        .from('app_reviews')
        .upsert(
            {
                app_id: appId,
                user_id: customUser.id,
                store_id: body.store_id || null,
                user_name: customUser.full_name || customUser.email.split('@')[0] || 'Anonymous',
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

registerAppStoreExtensionRoutes(router);

registerAppStoreBillingOAuthRoutes(router);

registerAppStoreInstallLifecycleRoutes(router);

registerAppStoreComplianceRoutes(router);

registerAppStoreDeveloperRoutes(router);

export default router;
