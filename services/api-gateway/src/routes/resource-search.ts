// ──────────────────────────────────────────────────────────────────────────────
// Phase W — Tenant-safe resource SEARCH route for the theme-editor U pickers.
//
// Mounted in themes.ts: router.route('/resource-search', resourceSearchRouter)
// Full path: GET /v1/themes/resource-search?store_id=<uuid>&type=<kind>&q=<text>&limit=<n>
//
// TENANCY LAW
//   1. resolveCustomUser (users_custom) — rejects customer HS256 tokens which
//      have no row in users_custom (those belong to store_customers).
//   2. verifySiteOwnership — rejects cross-site access; site is resolved from
//      the merchant session context, NEVER trusted from the browser payload.
//   3. Every table query carries .eq('store_id', store_id) with the
//      verified store_id from step 2 — never an arbitrary caller-supplied value.
//
// READ-ONLY. No write, no money, no RLS bypass beyond service-role read.
// ──────────────────────────────────────────────────────────────────────────────

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../index';
import { resolveCustomUser, verifySiteOwnership } from '../lib/auth-user';
import { getSupabaseAdmin } from '../lib/supabase';

const router = new Hono<{ Bindings: Env }>();

// ── Schema ────────────────────────────────────────────────────────────────────

const ResourceSearchQuerySchema = z.object({
    store_id: z.string().uuid(),
    type: z.enum(['product', 'collection', 'page', 'blog', 'menu']),
    q: z.string().trim().max(200).default(''),
    limit: z.coerce.number().int().min(1).max(50).default(20),
});

type ResourceType = 'product' | 'collection' | 'page' | 'blog' | 'menu';

// ── Result shape ──────────────────────────────────────────────────────────────

type SlimResource = {
    id: string;
    title: string;
    handle?: string | null;
    slug?: string | null;
};

// ── DB error helpers ──────────────────────────────────────────────────────────

type DbError = { message?: string; details?: string; hint?: string } | null | undefined;

function dbErrorText(error: DbError): string {
    return [error?.message, error?.details, error?.hint].filter(Boolean).join(' ').toLowerCase();
}

function isMissingTableError(error: DbError, tableName: string): boolean {
    const text = dbErrorText(error);
    return text.includes(tableName.toLowerCase()) && (
        text.includes('does not exist') ||
        text.includes('schema cache') ||
        text.includes('could not find')
    );
}

// ── Per-type search adapters (all tenant-scoped by store_id) ──────────────────

async function searchProducts(
    db: ReturnType<typeof getSupabaseAdmin>,
    store_id: string,
    q: string,
    limit: number,
): Promise<SlimResource[]> {
    let dbQuery = db
        .from('products')
        .select('id,name,handle')
        .eq('store_id', store_id)
        .is('deleted_at', null);

    if (q) dbQuery = dbQuery.ilike('name', `%${q}%`);

    const { data, error } = await dbQuery
        .order('name', { ascending: true })
        .limit(limit);

    if (error) {
        if (isMissingTableError(error, 'products')) return [];
        throw new Error(`products search failed: ${String(error?.message ?? 'unknown')}`);
    }

    return (data || []).map((r: Record<string, unknown>) => ({
        id: String(r.id ?? ''),
        title: String(r.name ?? ''),
        handle: r.handle ? String(r.handle) : null,
    }));
}

async function searchCollections(
    db: ReturnType<typeof getSupabaseAdmin>,
    store_id: string,
    q: string,
    limit: number,
): Promise<SlimResource[]> {
    let dbQuery = db
        .from('collections')
        .select('id,title,handle')
        .eq('store_id', store_id)
        .is('deleted_at', null);

    if (q) dbQuery = dbQuery.ilike('title', `%${q}%`);

    const { data, error } = await dbQuery
        .order('title', { ascending: true })
        .limit(limit);

    if (error) {
        if (isMissingTableError(error, 'collections')) return [];
        throw new Error(`collections search failed: ${String(error?.message ?? 'unknown')}`);
    }

    return (data || []).map((r: Record<string, unknown>) => ({
        id: String(r.id ?? ''),
        title: String(r.title ?? ''),
        handle: r.handle ? String(r.handle) : null,
    }));
}

async function searchPages(
    db: ReturnType<typeof getSupabaseAdmin>,
    store_id: string,
    q: string,
    limit: number,
): Promise<SlimResource[]> {
    // Primary: storefront_pages table (current schema)
    let primaryQuery = db
        .from('storefront_pages')
        .select('id,title,slug')
        .eq('store_id', store_id)
        .is('deleted_at', null);

    if (q) primaryQuery = primaryQuery.ilike('title', `%${q}%`);

    const { data, error } = await primaryQuery
        .order('title', { ascending: true })
        .limit(limit);

    if (!error) {
        return (data || []).map((r: Record<string, unknown>) => ({
            id: String(r.id ?? ''),
            title: String(r.title ?? ''),
            slug: r.slug ? String(r.slug) : null,
        }));
    }

    // Fallback: legacy pages table (migration-in-progress environments)
    if (isMissingTableError(error, 'storefront_pages')) {
        let legacyQuery = db
            .from('pages')
            .select('id,title,slug')
            .eq('store_id', store_id)
            .is('deleted_at', null);

        if (q) legacyQuery = legacyQuery.ilike('title', `%${q}%`);

        const { data: legacyData, error: legacyError } = await legacyQuery
            .order('title', { ascending: true })
            .limit(limit);

        if (legacyError) {
            if (isMissingTableError(legacyError, 'pages')) return [];
            throw new Error(`pages search failed: ${String(legacyError?.message ?? 'unknown')}`);
        }

        return (legacyData || []).map((r: Record<string, unknown>) => ({
            id: String(r.id ?? ''),
            title: String(r.title ?? ''),
            slug: r.slug ? String(r.slug) : null,
        }));
    }

    throw new Error(`pages search failed: ${String(error?.message ?? 'unknown')}`);
}

async function searchBlogPosts(
    db: ReturnType<typeof getSupabaseAdmin>,
    store_id: string,
    q: string,
    limit: number,
): Promise<SlimResource[]> {
    let dbQuery = db
        .from('blog_posts')
        .select('id,title,slug')
        .eq('store_id', store_id)
        .is('deleted_at', null);

    if (q) dbQuery = dbQuery.ilike('title', `%${q}%`);

    const { data, error } = await dbQuery
        .order('title', { ascending: true })
        .limit(limit);

    if (error) {
        if (isMissingTableError(error, 'blog_posts')) return [];
        throw new Error(`blog_posts search failed: ${String(error?.message ?? 'unknown')}`);
    }

    return (data || []).map((r: Record<string, unknown>) => ({
        id: String(r.id ?? ''),
        title: String(r.title ?? ''),
        slug: r.slug ? String(r.slug) : null,
    }));
}

async function searchMenus(
    db: ReturnType<typeof getSupabaseAdmin>,
    store_id: string,
    q: string,
    limit: number,
): Promise<SlimResource[]> {
    // Query navigation_menus directly to list all menus for the picker.
    // GET /pages/navigation returns items for ONE menu by location — not a menu list.
    let dbQuery = db
        .from('navigation_menus')
        .select('id,name,handle')
        .eq('store_id', store_id)
        .is('deleted_at', null);

    if (q) dbQuery = dbQuery.ilike('name', `%${q}%`);

    const { data, error } = await dbQuery
        .order('name', { ascending: true })
        .limit(limit);

    if (error) {
        if (isMissingTableError(error, 'navigation_menus')) return [];
        throw new Error(`navigation_menus search failed: ${String(error?.message ?? 'unknown')}`);
    }

    return (data || []).map((r: Record<string, unknown>) => ({
        id: String(r.id ?? ''),
        title: String(r.name ?? ''),
        handle: r.handle ? String(r.handle) : null,
    }));
}

// ── Route handler ─────────────────────────────────────────────────────────────
//
// GET /  (mounted at /themes/resource-search in themes.ts)
//
// Query params:
//   store_id  uuid     Required. Merchant's site.
//   type      enum     Required. product|collection|page|blog|menu.
//   q         string   Optional. Search term (case-insensitive ilike). Max 200 chars.
//   limit     int      Optional. Max results (1–50). Default 20.

router.get('/', async (c) => {
    const auth = c.get('auth');

    // Validate query params — unknown type rejected here (400)
    const parsed = ResourceSearchQuerySchema.safeParse({
        store_id: c.req.query('store_id'),
        type: c.req.query('type'),
        q: c.req.query('q'),
        limit: c.req.query('limit'),
    });

    if (!parsed.success) {
        return c.json(
            {
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid query parameters',
                    details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
                },
            },
            400,
        );
    }

    const { store_id, type, q, limit } = parsed.data;
    const db = getSupabaseAdmin(c);

    // TENANCY CHECK 1: Merchant gate.
    // resolveCustomUser queries users_custom (merchant table).
    // Customer HS256 tokens have no row in users_custom → null → 403.
    const customUser = await resolveCustomUser(db, auth.user);
    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    // TENANCY CHECK 2: Site ownership.
    // verifySiteOwnership checks sites.custom_user_id / user_id = customUser.id
    // AND cross-checks against auth.user.storeId (session-bound store).
    // Cross-tenant access (store_id != session storeId) → false → 403.
    const ownsStore = await verifySiteOwnership(db, store_id, customUser.id, auth.user.storeId);
    if (!ownsStore) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    // Per-type search — every adapter scopes by store_id (verified above)
    let results: SlimResource[];

    try {
        if (type === 'product') {
            results = await searchProducts(db, store_id, q, limit);
        } else if (type === 'collection') {
            results = await searchCollections(db, store_id, q, limit);
        } else if (type === 'page') {
            results = await searchPages(db, store_id, q, limit);
        } else if (type === 'blog') {
            results = await searchBlogPosts(db, store_id, q, limit);
        } else {
            // type === 'menu' (exhaustive: zod already validated the enum)
            results = await searchMenus(db, store_id, q, limit);
        }
    } catch (err) {
        return c.json(
            { error: { code: 'SEARCH_ERROR', message: err instanceof Error ? err.message : 'Search failed' } },
            500,
        );
    }

    return c.json({ data: results, meta: { type: type as ResourceType, count: results.length } });
});

export default router;
