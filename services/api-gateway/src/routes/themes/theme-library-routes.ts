// ──────────────────────────────────────────────────────────────────────────────
// Phase Q: Theme Library Management Routes
//
// Extracted from themes.ts into dedicated sub-router module.
// Mounted via mountThemeLibraryRoutes(router) in themes.ts.
//
// Routes registered:
//   GET    /themes/library?store_id=
//   POST   /themes/library/create
//   POST   /themes/:slug/duplicate
//   PATCH  /themes/:slug/rename
//   POST   /themes/:slug/archive
//   DELETE /themes/:slug/unpublished?store_id=
//
// Tenancy law: site resolved from authenticated merchant context only;
// store_id from body/query is verified via adapter.verifyStoreOwner.
// ──────────────────────────────────────────────────────────────────────────────

import type { Context, Hono } from 'hono';
import type { Env } from '../../index';
import { resolveCustomUser } from '../../lib/auth-user';
import { getSupabaseAdmin, success } from '../../lib/supabase';
import { validate } from '../../middleware/validation';
import {
    ArchiveSiteThemeSchema,
    CreateSiteThemeSchema,
    DeleteUnpublishedThemeQuerySchema,
    DuplicateSiteThemeSchema,
    ListSiteThemesQuerySchema,
    RenameSiteThemeSchema,
    type ArchiveSiteThemeInput,
    type CreateSiteThemeInput,
    type DuplicateSiteThemeInput,
    type RenameSiteThemeInput,
} from '../../schemas/theme.schema';
import { applyStorePlanTierDefaults, type BillingPlanCatalogRecord } from '@letbuyy/billing-core';
import { ThemeExecutionAdapter } from '../../execution/theme-execution.adapter';

interface StoreThemeLimit {
    limit: number | null;
    plan_name: string;
}

export async function resolveStoreThemeLimit(
    db: ReturnType<typeof getSupabaseAdmin>,
    storeId: string,
): Promise<StoreThemeLimit> {
    const { data: site } = await db
        .from('sites')
        .select('site_type')
        .eq('id', storeId)
        .maybeSingle();
    const siteType = typeof site?.site_type === 'string' && site.site_type ? site.site_type : 'store';

    const { data: sub } = await db
        .from('subscriptions')
        .select('plan')
        .eq('store_id', storeId)
        .in('status', ['active', 'past_due', 'failed'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    const slug = typeof sub?.plan === 'string' && sub.plan ? sub.plan : 'free';

    const { data: planRow } = await db
        .from('plans')
        .select('*')
        .eq('site_type', siteType)
        .eq('slug', slug)
        .eq('is_active', true)
        .maybeSingle();

    const plan = applyStorePlanTierDefaults(
        (planRow as BillingPlanCatalogRecord) ||
            ({ slug, site_type: siteType, name: slug } as unknown as BillingPlanCatalogRecord),
    );

    const rawThemeLimit = (plan.limits as Record<string, unknown> | null | undefined)?.themes;
    const themeLimit = rawThemeLimit === null || rawThemeLimit === undefined
        ? null
        : Number(rawThemeLimit);

    return {
        limit: Number.isFinite(themeLimit) ? themeLimit : null,
        plan_name: plan.name || slug,
    };
}

export async function countInstalledSiteThemes(
    db: ReturnType<typeof getSupabaseAdmin>,
    storeId: string,
): Promise<number> {
    const { count } = await db
        .from('theme_instances')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', storeId)
        .not('instance_status', 'in', '(archived,deleted)')
        .is('deleted_at', null);
    return count || 0;
}

function getRequestId(c: Context<{ Bindings: Env }>): string {
    return c.req.header('x-request-id') || crypto.randomUUID();
}

export function mountThemeLibraryRoutes(router: Hono<{ Bindings: Env }>) {
    // GET /themes/library?store_id= — List themes installed on a site
    router.get('/library', async (c) => {
        const auth = c.get('auth');
        const db = getSupabaseAdmin(c);
        const customUser = await resolveCustomUser(db, auth.user);
        if (!customUser) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
        }

        const query = ListSiteThemesQuerySchema.safeParse({ store_id: c.req.query('store_id') });
        if (!query.success) {
            return c.json({ error: { code: 'VALIDATION_ERROR', message: 'store_id is required and must be a valid UUID', issues: query.error.issues } }, 400);
        }

        const service = new ThemeExecutionAdapter(db);
        try {
            const result = await service.listSiteThemes(query.data.store_id, customUser.id);
            return c.json(success(result));
        } catch (err: unknown) {
            if ((err as { name?: string })?.name === 'ForbiddenError') {
                return c.json({ error: { code: 'FORBIDDEN', message: 'Store not found or not owned by this user' } }, 403);
            }
            throw err;
        }
    });

    // POST /themes/library/create — Create a blank site-owned theme
    router.post('/library/create', validate('json', CreateSiteThemeSchema), async (c) => {
        const auth = c.get('auth');
        const db = getSupabaseAdmin(c);
        const customUser = await resolveCustomUser(db, auth.user);
        if (!customUser) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
        }

        const body = c.get('validatedBody') as CreateSiteThemeInput;
        const service = new ThemeExecutionAdapter(db);

        // Ownership check FIRST — prevents leaking plan/billing details of a foreign store
        // to any authenticated merchant who submits a cross-tenant store_id.
        try {
            await service.verifyStoreOwner(body.store_id, customUser.id);
        } catch (err: unknown) {
            if ((err as { name?: string })?.name === 'ForbiddenError') {
                return c.json({ error: { code: 'FORBIDDEN', message: 'Store not found or not owned by this user' } }, 403);
            }
            throw err;
        }

        // Plan limit check (server-authoritative; never trust client counts).
        // Runs after ownership is confirmed so billing info is only visible to the owner.
        const { limit, plan_name } = await resolveStoreThemeLimit(db, body.store_id);
        if (limit !== null) {
            const used = await countInstalledSiteThemes(db, body.store_id);
            if (used >= limit) {
                return c.json({
                    error: {
                        code: 'THEME_LIMIT_REACHED',
                        message: `Your ${plan_name} plan allows up to ${limit} theme(s). Upgrade to add more.`,
                        details: { limit, used, plan_name },
                    },
                }, 409);
            }
        }

        try {
            const result = await service.createSiteTheme(body.store_id, body, customUser.id, getRequestId(c));
            return c.json(success(result), 201);
        } catch (err: unknown) {
            if ((err as { name?: string })?.name === 'ForbiddenError') {
                return c.json({ error: { code: 'FORBIDDEN', message: 'Store not found or not owned by this user' } }, 403);
            }
            throw err;
        }
    });

    // POST /themes/:slug/duplicate — Duplicate an installed theme for a site
    router.post('/:slug/duplicate', validate('json', DuplicateSiteThemeSchema), async (c) => {
        const auth = c.get('auth');
        const slug = c.req.param('slug');
        const db = getSupabaseAdmin(c);
        const customUser = await resolveCustomUser(db, auth.user);
        if (!customUser) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
        }

        const body = c.get('validatedBody') as DuplicateSiteThemeInput;
        const service = new ThemeExecutionAdapter(db);

        try {
            await service.verifyStoreOwner(body.store_id, customUser.id);
        } catch (err: unknown) {
            if ((err as { name?: string })?.name === 'ForbiddenError') {
                return c.json({ error: { code: 'FORBIDDEN', message: 'Store not found or not owned by this user' } }, 403);
            }
            throw err;
        }

        const { limit, plan_name } = await resolveStoreThemeLimit(db, body.store_id);
        if (limit !== null) {
            const used = await countInstalledSiteThemes(db, body.store_id);
            if (used >= limit) {
                return c.json({
                    error: {
                        code: 'THEME_LIMIT_REACHED',
                        message: `Your ${plan_name} plan allows up to ${limit} theme(s). Upgrade to add more.`,
                        details: { limit, used, plan_name },
                    },
                }, 409);
            }
        }

        try {
            const result = await service.duplicateSiteTheme(slug, body.store_id, body, customUser.id, getRequestId(c));
            return c.json(success(result), 201);
        } catch (err: unknown) {
            const name = (err as { name?: string })?.name;
            if (name === 'ForbiddenError') {
                return c.json({ error: { code: 'FORBIDDEN', message: 'Store not found or not owned by this user' } }, 403);
            }
            if (name === 'NotFoundError') {
                return c.json({ error: { code: 'NOT_FOUND', message: 'Theme not found in your store' } }, 404);
            }
            throw err;
        }
    });

    // PATCH /themes/:slug/rename — Rename a site theme
    router.patch('/:slug/rename', validate('json', RenameSiteThemeSchema), async (c) => {
        const auth = c.get('auth');
        const slug = c.req.param('slug');
        const db = getSupabaseAdmin(c);
        const customUser = await resolveCustomUser(db, auth.user);
        if (!customUser) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
        }

        const body = c.get('validatedBody') as RenameSiteThemeInput;
        const service = new ThemeExecutionAdapter(db);
        try {
            const result = await service.renameSiteTheme(slug, body.store_id, body, customUser.id, getRequestId(c));
            return c.json(success(result));
        } catch (err: unknown) {
            const name = (err as { name?: string })?.name;
            if (name === 'ForbiddenError') {
                return c.json({ error: { code: 'FORBIDDEN', message: 'Store not found or not owned by this user' } }, 403);
            }
            if (name === 'NotFoundError') {
                return c.json({ error: { code: 'NOT_FOUND', message: 'Theme not found in your store' } }, 404);
            }
            throw err;
        }
    });

    // POST /themes/:slug/archive — Archive an unpublished theme
    router.post('/:slug/archive', validate('json', ArchiveSiteThemeSchema), async (c) => {
        const auth = c.get('auth');
        const slug = c.req.param('slug');
        const db = getSupabaseAdmin(c);
        const customUser = await resolveCustomUser(db, auth.user);
        if (!customUser) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
        }

        const body = c.get('validatedBody') as ArchiveSiteThemeInput;
        const service = new ThemeExecutionAdapter(db);
        try {
            const result = await service.archiveSiteTheme(slug, body.store_id, body, customUser.id, getRequestId(c));
            return c.json(success(result));
        } catch (err: unknown) {
            const name = (err as { name?: string })?.name;
            if (name === 'ForbiddenError') {
                return c.json({ error: { code: 'FORBIDDEN', message: 'Store not found or not owned by this user' } }, 403);
            }
            if (name === 'NotFoundError') {
                return c.json({ error: { code: 'NOT_FOUND', message: 'Theme not found in your store' } }, 404);
            }
            if (name === 'ConflictError') {
                return c.json({
                    error: {
                        code: 'THEME_CURRENTLY_PUBLISHED',
                        message: 'Cannot archive the currently published theme. Publish another theme first.',
                    },
                }, 409);
            }
            throw err;
        }
    });

    // DELETE /themes/:slug/unpublished?store_id= — Delete an unpublished site theme
    router.delete('/:slug/unpublished', async (c) => {
        const auth = c.get('auth');
        const slug = c.req.param('slug');
        const db = getSupabaseAdmin(c);
        const customUser = await resolveCustomUser(db, auth.user);
        if (!customUser) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
        }

        const query = DeleteUnpublishedThemeQuerySchema.safeParse({ store_id: c.req.query('store_id') });
        if (!query.success) {
            return c.json({ error: { code: 'VALIDATION_ERROR', message: 'store_id is required and must be a valid UUID', issues: query.error.issues } }, 400);
        }

        const service = new ThemeExecutionAdapter(db);
        try {
            const result = await service.deleteUnpublishedSiteTheme(slug, query.data.store_id, customUser.id, getRequestId(c));
            return c.json(success(result));
        } catch (err: unknown) {
            const name = (err as { name?: string })?.name;
            if (name === 'ForbiddenError') {
                return c.json({ error: { code: 'FORBIDDEN', message: 'Store not found or not owned by this user' } }, 403);
            }
            if (name === 'NotFoundError') {
                return c.json({ error: { code: 'NOT_FOUND', message: 'Theme not found in your store' } }, 404);
            }
            if (name === 'ConflictError') {
                return c.json({
                    error: {
                        code: 'CANNOT_DELETE_PUBLISHED_THEME',
                        message: 'Cannot delete the currently published theme. Publish another theme first.',
                    },
                }, 409);
            }
            throw err;
        }
    });
}
