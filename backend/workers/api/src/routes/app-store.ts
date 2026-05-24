import { Hono } from 'hono';
import type { Env } from '../index';
import { findFirstOwnedSiteId, resolveCustomUser, verifySiteOwnership } from '../lib/auth-user';
import { getSupabaseAdmin, paginated, success } from '../lib/supabase';
import { authMiddleware } from '../middleware/auth';

const router = new Hono<{ Bindings: Env }>();

type JsonRecord = Record<string, unknown>;

function slugify(value: string): string {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

function stringOrNull(value: unknown): string | null {
    return isNonEmptyString(value) ? value.trim() : null;
}

function stringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function parseJsonRecord(value: unknown): JsonRecord {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as JsonRecord;
}

function isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(value);
}

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

    // Check if user has installed this app (verified review)
    const { data: installation } = await db
        .from('app_installations')
        .select('id')
        .eq('app_id', appId)
        .eq('installed_by', customUser.id)
        .limit(1);

    const isVerified = installation && installation.length > 0;

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

// GET /app-store/installations — List installed apps for a store
router.get('/installations', authMiddleware, async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.query('store_id');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const resolvedStoreId = storeId || await findFirstOwnedSiteId(db, customUser.id);

    if (!resolvedStoreId) {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id is required' } }, 400);
    }

    const ownsStore = await verifySiteOwnership(db, resolvedStoreId, customUser.id, auth.user.storeId);
    if (!ownsStore) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const { data, error } = await db
        .from('app_installations')
        .select('*, marketplace_apps(id, name, slug, icon_url, tagline, pricing_model)')
        .eq('store_id', resolvedStoreId)
        .eq('installed_by', customUser.id)
        .neq('status', 'uninstalled')
        .order('installed_at', { ascending: false });

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data || []));
});

// POST /app-store/apps/:id/install — Install an app
router.post('/apps/:id/install', authMiddleware, async (c) => {
    const auth = c.get('auth');
    const appId = c.req.param('id');
    const body = await c.req.json();
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const storeId = stringOrNull(body.store_id) || await findFirstOwnedSiteId(db, customUser.id);

    if (!storeId) {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id is required' } }, 400);
    }

    // Verify store ownership
    const ownsStore = await verifySiteOwnership(db, storeId, customUser.id, auth.user.storeId);
    if (!ownsStore) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    // Verify app exists and is published
    const { data: app } = await db
        .from('marketplace_apps')
        .select('id, name, api_scopes')
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
                store_id: storeId,
                installed_by: customUser.id,
                status: 'active',
                scopes_granted: stringArray(body.scopes).length > 0 ? stringArray(body.scopes) : (app.api_scopes || []),
                config: parseJsonRecord(body.config),
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
router.delete('/apps/:id/install', authMiddleware, async (c) => {
    const auth = c.get('auth');
    const appId = c.req.param('id');
    const storeId = c.req.query('store_id');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const resolvedStoreId = storeId || await findFirstOwnedSiteId(db, customUser.id);

    if (!resolvedStoreId) {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id is required' } }, 400);
    }

    const ownsStore = await verifySiteOwnership(db, resolvedStoreId, customUser.id, auth.user.storeId);
    if (!ownsStore) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const { error } = await db
        .from('app_installations')
        .update({
            status: 'uninstalled',
            uninstalled_at: new Date().toISOString(),
        })
        .eq('app_id', appId)
        .eq('store_id', resolvedStoreId)
        .eq('installed_by', customUser.id);

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json({ data: { uninstalled: true } });
});

// GET /app-store/developers/me — Get current user's developer profile
router.get('/developers/me', authMiddleware, async (c) => {
    const auth = c.get('auth');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const { data: developer, error } = await db
        .from('app_developers')
        .select('*')
        .eq('user_id', customUser.id)
        .maybeSingle();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success({ developer: developer || null }));
});

// POST /app-store/developers/register — Register current user as an app developer
router.post('/developers/register', authMiddleware, async (c) => {
    const auth = c.get('auth');
    const body = await c.req.json();
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const companyName = stringOrNull(body.company_name);
    const supportEmail = stringOrNull(body.support_email || body.contact_email);

    if (!companyName || !supportEmail) {
        return c.json({ error: { code: 'VALIDATION', message: 'company_name and support_email are required' } }, 400);
    }

    const slug = slugify(companyName);
    if (!slug) {
        return c.json({ error: { code: 'VALIDATION', message: 'company_name must contain letters or numbers' } }, 400);
    }

    const { data: developer, error } = await db
        .from('app_developers')
        .insert({
            user_id: customUser.id,
            company_name: companyName,
            slug,
            website_url: stringOrNull(body.website_url || body.website),
            support_email: supportEmail,
            description: stringOrNull(body.description || body.bio),
            country: stringOrNull(body.country) || 'IN',
            status: 'pending',
            verified: false,
        })
        .select()
        .single();

    if (error) {
        if (error.code === '23505') {
            return c.json({ error: { code: 'CONFLICT', message: 'Developer profile already exists for this account or company' } }, 409);
        }
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success({ developer }), 201);
});

// GET /app-store/developers/apps — List current developer profile and submitted apps
router.get('/developers/apps', authMiddleware, async (c) => {
    const auth = c.get('auth');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const { data: developer, error: developerError } = await db
        .from('app_developers')
        .select('id, company_name, status, verified')
        .eq('user_id', customUser.id)
        .maybeSingle();

    if (developerError) {
        return c.json({ error: { code: 'DB_ERROR', message: developerError.message } }, 500);
    }

    if (!developer) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Developer profile not found' } }, 404);
    }

    const { data: apps, error: appsError } = await db
        .from('marketplace_apps')
        .select('id, name, slug, tagline, icon_url, status, install_count, rating_avg, review_count, pricing_model, price_inr, created_at')
        .eq('developer_id', developer.id)
        .order('created_at', { ascending: false });

    if (appsError) {
        return c.json({ error: { code: 'DB_ERROR', message: appsError.message } }, 500);
    }

    return c.json(success({ developer, apps: apps || [] }));
});

// POST /app-store/developers/apps — Submit a new marketplace app for review
router.post('/developers/apps', authMiddleware, async (c) => {
    const auth = c.get('auth');
    const body = await c.req.json();
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const { data: developer } = await db
        .from('app_developers')
        .select('id, status')
        .eq('user_id', customUser.id)
        .maybeSingle();

    if (!developer) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'You must register as a developer first' } }, 403);
    }

    const name = stringOrNull(body.name);
    const tagline = stringOrNull(body.tagline);
    const description = stringOrNull(body.description);
    const categoryId = stringOrNull(body.category_id);
    const appUrl = stringOrNull(body.app_url);
    const privacyUrl = stringOrNull(body.privacy_url || body.privacy_policy_url);

    if (!name || !tagline || !description || !categoryId || !appUrl || !privacyUrl) {
        return c.json(
            { error: { code: 'VALIDATION', message: 'name, tagline, description, category_id, app_url, and privacy_url are required' } },
            400
        );
    }

    const requestedSlug = stringOrNull(body.slug);
    const slug = slugify(requestedSlug || name);
    if (!slug) {
        return c.json({ error: { code: 'VALIDATION', message: 'slug must contain letters or numbers' } }, 400);
    }

    const { data: existingSlug } = await db
        .from('marketplace_apps')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();

    if (existingSlug) {
        return c.json({ error: { code: 'CONFLICT', message: 'This app slug is already taken' } }, 409);
    }

    const priceMonthly = Number(body.price_monthly || 0);
    const priceInr = Number.isFinite(priceMonthly) ? Math.max(Math.round(priceMonthly * 100) / 100, 0) : 0;

    const { data: app, error } = await db
        .from('marketplace_apps')
        .insert({
            developer_id: developer.id,
            name,
            slug,
            tagline,
            description,
            category_id: categoryId,
            app_url: appUrl,
            privacy_policy_url: privacyUrl,
            pricing_model: stringOrNull(body.pricing_model) || 'free',
            price_inr: priceInr,
            status: body.save_as_draft ? 'draft' : 'in_review',
            install_count: 0,
            rating_avg: 0,
            review_count: 0,
        })
        .select('id, name, status')
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success({ app }), 201);
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
