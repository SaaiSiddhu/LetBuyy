import { Hono, type Context } from 'hono';
import type { Env } from '../../index';
import { resolveCustomUser, verifySiteOwnership } from '../../lib/auth-user';
import { getSupabaseAdmin, success } from '../../lib/supabase';
import { authMiddleware } from '../../middleware/auth';
import { AppRequestInputSchema, AppSavedAppInputSchema } from '@letbuyy/shared-types';

type AppStoreHono = Hono<{ Bindings: Env }>;
type AppRecord = Record<string, unknown>;

const APP_GROWTH_SELECT = '*, app_developers(id, company_name, slug, logo_url, website_url, support_email, verified), app_categories(id, name, slug, icon, group_name, seo_title, seo_description, seo_content, seo_faq), app_pricing_plans(id, app_id, developer_id, plan_slug, name, description, pricing_model, billing_mode, currency, amount_minor, interval, trial_days, usage_meter, usage_unit, included_usage, usage_unit_amount_minor, features, limits, is_default, status, sort_order)';

function normalizePositiveInt(value: string | undefined, fallback: number, max: number): number {
    const parsed = Number.parseInt(value || '', 10);
    if (!Number.isFinite(parsed) || parsed < 1) return fallback;
    return Math.min(parsed, max);
}

function stringOrNull(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function decorateAppRecord(app: AppRecord): AppRecord {
    const category = app.app_categories;
    if (category && typeof category === 'object' && !Array.isArray(category)) {
        const categoryRecord = category as AppRecord;
        app.app_categories = {
            ...categoryRecord,
            group: categoryRecord.group ?? categoryRecord.group_name,
        };
    }
    if (app.is_first_party_demo) {
        app.discovery_label = 'First-party demo app';
    }
    return app;
}

function decorateAppRecords(apps: AppRecord[] | null): AppRecord[] {
    return (apps || []).map((app) => decorateAppRecord({ ...app }));
}

async function requireOwnedSite(
    c: Context<{ Bindings: Env }>,
    requestedSiteId?: string | null,
) {
    const auth = c.get('auth');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);
    if (!customUser) {
        return { ok: false as const, status: 403, error: { code: 'FORBIDDEN', message: 'User profile not found' } };
    }

    const siteId = stringOrNull(requestedSiteId) || stringOrNull(auth.user.storeId);
    if (!siteId) {
        return { ok: false as const, status: 400, error: { code: 'VALIDATION', message: 'site_id is required' } };
    }

    const ownsStore = await verifySiteOwnership(db, siteId, customUser.id, auth.user.storeId);
    if (!ownsStore) {
        return { ok: false as const, status: 403, error: { code: 'FORBIDDEN', message: 'Not authorized for this store' } };
    }

    return { ok: true as const, db, customUser, siteId };
}

function ownershipStatus(status: number): 400 | 403 {
    return status === 400 ? 400 : 403;
}

async function readSavedApps(db: ReturnType<typeof getSupabaseAdmin>, siteId: string, savedBy: string) {
    const { data: savedRows, error: savedError } = await db
        .from('app_saved_apps')
        .select('id, site_id, app_id, saved_by, source, metadata, created_at, updated_at, deleted_at')
        .eq('site_id', siteId)
        .eq('saved_by', savedBy)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

    if (savedError) throw new Error(savedError.message);

    const appIds = (savedRows || [])
        .map((row) => typeof row.app_id === 'string' ? row.app_id : null)
        .filter((id): id is string => Boolean(id));
    if (appIds.length === 0) {
        return { saved_apps: [], apps: [] };
    }

    const { data: apps, error: appsError } = await db
        .from('marketplace_apps')
        .select(APP_GROWTH_SELECT)
        .eq('status', 'published')
        .eq('app_pricing_plans.status', 'active')
        .is('app_pricing_plans.deleted_at', null)
        .in('id', appIds);

    if (appsError) throw new Error(appsError.message);

    const byId = new Map(decorateAppRecords((apps || []) as AppRecord[]).map((app) => [String(app.id), app]));
    const saved_apps = (savedRows || []).map((row) => ({
        ...row,
        marketplace_apps: byId.get(String(row.app_id)) || null,
    }));

    return {
        saved_apps,
        apps: saved_apps.map((row) => row.marketplace_apps).filter((app): app is AppRecord => Boolean(app)),
    };
}

export function registerAppStoreGrowthRoutes(router: AppStoreHono) {
    router.get('/growth/new-this-week', async (c) => {
        const limit = normalizePositiveInt(c.req.query('limit'), 6, 24);
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const db = getSupabaseAdmin(c);
        const { data, error } = await db
            .from('marketplace_apps')
            .select(APP_GROWTH_SELECT)
            .eq('status', 'published')
            .eq('app_pricing_plans.status', 'active')
            .is('app_pricing_plans.deleted_at', null)
            .or(`published_at.gte.${since},created_at.gte.${since},updated_at.gte.${since}`)
            .order('published_at', { ascending: false })
            .limit(limit);

        if (error) {
            return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
        }

        return c.json(success(decorateAppRecords((data || []) as AppRecord[])));
    });

    router.get('/growth/bundles', async (c) => {
        const limit = normalizePositiveInt(c.req.query('limit'), 6, 24);
        const now = new Date().toISOString();
        const db = getSupabaseAdmin(c);
        const { data: bundles, error } = await db
            .from('app_bundles')
            .select('id, slug, name, description, status, currency, discount_percent, discount_amount_minor, disclosure, sort_order, starts_at, ends_at, created_at, updated_at')
            .eq('status', 'active')
            .is('deleted_at', null)
            .or(`starts_at.is.null,starts_at.lte.${now}`)
            .or(`ends_at.is.null,ends_at.gte.${now}`)
            .order('sort_order', { ascending: true })
            .limit(limit);

        if (error) return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);

        const bundleIds = (bundles || []).map((bundle) => bundle.id).filter((id): id is string => typeof id === 'string');
        if (bundleIds.length === 0) return c.json(success([]));

        const { data: items, error: itemsError } = await db
            .from('app_bundle_items')
            .select('bundle_id, app_id, sort_order')
            .in('bundle_id', bundleIds)
            .is('deleted_at', null)
            .order('sort_order', { ascending: true });

        if (itemsError) return c.json({ error: { code: 'DB_ERROR', message: itemsError.message } }, 500);

        const appIds = (items || []).map((item) => item.app_id).filter((id): id is string => typeof id === 'string');
        const { data: apps, error: appsError } = appIds.length > 0
            ? await db
                .from('marketplace_apps')
                .select(APP_GROWTH_SELECT)
                .eq('status', 'published')
                .eq('app_pricing_plans.status', 'active')
                .is('app_pricing_plans.deleted_at', null)
                .in('id', appIds)
            : { data: [], error: null };

        if (appsError) return c.json({ error: { code: 'DB_ERROR', message: appsError.message } }, 500);

        const appsById = new Map(decorateAppRecords((apps || []) as AppRecord[]).map((app) => [String(app.id), app]));
        const itemsByBundle = new Map<string, string[]>();
        for (const item of items || []) {
            if (typeof item.bundle_id !== 'string' || typeof item.app_id !== 'string') continue;
            itemsByBundle.set(item.bundle_id, [...(itemsByBundle.get(item.bundle_id) || []), item.app_id]);
        }

        return c.json(success((bundles || []).map((bundle) => ({
            ...bundle,
            apps: (itemsByBundle.get(bundle.id) || [])
                .map((appId) => appsById.get(appId))
                .filter((app): app is AppRecord => Boolean(app)),
        }))));
    });

    router.post('/growth/requests', async (c) => {
        const raw = await c.req.json().catch(() => null);
        const parsed = AppRequestInputSchema.safeParse(raw);
        if (!parsed.success) {
            return c.json({ error: { code: 'VALIDATION', message: parsed.error.issues[0]?.message || 'Invalid app request' } }, 400);
        }

        const db = getSupabaseAdmin(c);
        const { data, error } = await db
            .from('app_requests')
            .insert({
                site_id: null,
                requested_by: null,
                query: parsed.data.query || null,
                category_slug: parsed.data.category_slug || null,
                requested_app_name: parsed.data.requested_app_name || null,
                use_case: parsed.data.use_case,
                contact_email: parsed.data.contact_email || null,
                metadata: parsed.data.metadata || {},
            })
            .select('id, status')
            .single();

        if (error) return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
        return c.json(success({ accepted: true, request_id: data?.id || null, status: data?.status || 'open' }), 201);
    });

    router.get('/growth/saved-apps', authMiddleware, async (c) => {
        const ownership = await requireOwnedSite(c, c.req.query('site_id'));
        if (!ownership.ok) return c.json({ error: ownership.error }, ownershipStatus(ownership.status));

        try {
            return c.json(success(await readSavedApps(ownership.db, ownership.siteId, ownership.customUser.id)));
        } catch (error) {
            return c.json({ error: { code: 'DB_ERROR', message: error instanceof Error ? error.message : 'Could not load saved apps' } }, 500);
        }
    });

    router.post('/growth/saved-apps', authMiddleware, async (c) => {
        const raw = await c.req.json().catch(() => null);
        const parsed = AppSavedAppInputSchema.safeParse(raw);
        if (!parsed.success) {
            return c.json({ error: { code: 'VALIDATION', message: parsed.error.issues[0]?.message || 'Invalid saved app' } }, 400);
        }

        const ownership = await requireOwnedSite(c, parsed.data.site_id);
        if (!ownership.ok) return c.json({ error: ownership.error }, ownershipStatus(ownership.status));

        const { data: app, error: appError } = await ownership.db
            .from('marketplace_apps')
            .select('id')
            .eq('id', parsed.data.app_id)
            .eq('status', 'published')
            .maybeSingle();
        if (appError) return c.json({ error: { code: 'DB_ERROR', message: appError.message } }, 500);
        if (!app) return c.json({ error: { code: 'NOT_FOUND', message: 'Published app not found' } }, 404);

        const { error } = await ownership.db
            .from('app_saved_apps')
            .upsert({
                site_id: ownership.siteId,
                app_id: parsed.data.app_id,
                saved_by: ownership.customUser.id,
                source: parsed.data.source || 'marketplace',
                metadata: parsed.data.metadata || {},
                created_by: ownership.customUser.id,
                updated_by: ownership.customUser.id,
                deleted_at: null,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'site_id,app_id,saved_by' });

        if (error) return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);

        try {
            return c.json(success(await readSavedApps(ownership.db, ownership.siteId, ownership.customUser.id)), 201);
        } catch (readError) {
            return c.json({ error: { code: 'DB_ERROR', message: readError instanceof Error ? readError.message : 'Could not load saved apps' } }, 500);
        }
    });

    router.delete('/growth/saved-apps/:appId', authMiddleware, async (c) => {
        const ownership = await requireOwnedSite(c, c.req.query('site_id'));
        if (!ownership.ok) return c.json({ error: ownership.error }, ownershipStatus(ownership.status));

        const { error } = await ownership.db
            .from('app_saved_apps')
            .update({
                deleted_at: new Date().toISOString(),
                updated_by: ownership.customUser.id,
                updated_at: new Date().toISOString(),
            })
            .eq('site_id', ownership.siteId)
            .eq('saved_by', ownership.customUser.id)
            .eq('app_id', c.req.param('appId'));

        if (error) return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);

        try {
            return c.json(success(await readSavedApps(ownership.db, ownership.siteId, ownership.customUser.id)));
        } catch (readError) {
            return c.json({ error: { code: 'DB_ERROR', message: readError instanceof Error ? readError.message : 'Could not load saved apps' } }, 500);
        }
    });
}
