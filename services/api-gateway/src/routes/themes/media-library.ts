// ──────────────────────────────────────────────────────────────────────────────
// Phase X — Tenant-safe media LIBRARY LIST route for the theme-editor picker.
//
// Mounted in themes.ts: router.route('/media-library', mediaLibraryRouter)
// Full path: GET /v1/themes/media-library?store_id=<uuid>&type=image|video|all&q=<text>&limit=<n>&cursor=<opaque>
//
// TENANCY LAW (identical enforcement to resource-search.ts, Phase W)
//   1. resolveCustomUser (users_custom) — rejects customer HS256 tokens which
//      have no row in users_custom (those belong to store_customers).
//   2. verifySiteOwnership — rejects cross-site access; site is resolved from
//      the merchant session context, NEVER trusted from the browser payload.
//   3. Every table query carries .eq('store_id', storeId) with the verified
//      storeId from step 2 — never an arbitrary caller-supplied value.
//
// STORAGE HONESTY:
//   - media table (Supabase) is CONNECTED: the existing GET /v1/media route
//     (src/routes/media.ts) already queries this table successfully.
//   - media_assets mirror table is silently optional (may be absent in some
//     environments); this route queries only the authoritative media table.
//   - If the media table is absent in a fresh environment the handler returns
//     500 with DB_ERROR; callers must handle this as an empty-state gracefully.
//
// READ-ONLY. No write, no money, no RLS bypass beyond service-role read.
// ──────────────────────────────────────────────────────────────────────────────

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../../index';
import { resolveCustomUser, verifySiteOwnership } from '../../lib/auth-user';
import { decodeListCursor, encodeListCursor, cursorPaginated, getSupabaseAdmin } from '../../lib/supabase';

const router = new Hono<{ Bindings: Env }>();

// ── Schema ────────────────────────────────────────────────────────────────────

const MediaLibraryQuerySchema = z.object({
    store_id: z.string().uuid(),
    type: z.enum(['image', 'video', 'all']).default('all'),
    q: z.string().trim().max(200).default(''),
    limit: z.coerce.number().int().min(1).max(100).default(40),
    cursor: z.string().trim().max(512).optional(),
});

// ── Column projection returned to callers ─────────────────────────────────────
// Intentionally slim: only what the picker needs to display thumbnails and
// insert a URL. No price, email, password, or secret fields.

const MEDIA_LIBRARY_COLUMNS = [
    'id',
    'filename',
    'url',
    'thumbnail_url',
    'mime_type',
    'size_bytes',
    'alt_text',
    'media_type',
    'created_at',
].join(',');

// ── Route handler ─────────────────────────────────────────────────────────────
//
// GET /  (mounted at /themes/media-library in themes.ts)
//
// Query params:
//   store_id  uuid     Required. The merchant's verified site.
//   type      enum     Optional. image | video | all (default: all).
//   q         string   Optional. Search term applied to filename and original_name (ilike). Max 200 chars.
//   limit     int      Optional. Max results per page (1–100, default 40).
//   cursor    string   Optional. Opaque cursor for the next page (from previous response meta.next_cursor).

router.get('/', async (c) => {
    const auth = c.get('auth');

    // Validate and parse query parameters.
    const parsed = MediaLibraryQuerySchema.safeParse({
        store_id: c.req.query('store_id'),
        type: c.req.query('type'),
        q: c.req.query('q'),
        limit: c.req.query('limit'),
        cursor: c.req.query('cursor'),
    });

    if (!parsed.success) {
        return c.json(
            {
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid query parameters',
                    details: parsed.error.issues.map((i) => ({
                        field: i.path.join('.'),
                        message: i.message,
                    })),
                },
            },
            400,
        );
    }

    const { store_id: storeId, type, q, limit, cursor } = parsed.data;
    const db = getSupabaseAdmin(c);

    // TENANCY CHECK 1: Merchant gate.
    // resolveCustomUser queries users_custom (merchant table).
    // Customer HS256 tokens have no row in users_custom → null → 403.
    const customUser = await resolveCustomUser(db, auth.user);
    if (!customUser) {
        return c.json(
            { error: { code: 'FORBIDDEN', message: 'User profile not found' } },
            403,
        );
    }

    // TENANCY CHECK 2: Site ownership.
    // verifySiteOwnership checks sites.custom_user_id / user_id = customUser.id
    // AND cross-checks against auth.user.storeId (session-bound store).
    // Cross-tenant access (storeId != session storeId) → false → 403.
    const ownsStore = await verifySiteOwnership(db, storeId, customUser.id, auth.user.storeId);
    if (!ownsStore) {
        return c.json(
            { error: { code: 'FORBIDDEN', message: 'Not authorized' } },
            403,
        );
    }

    // Build the media query — ALWAYS scoped by verified storeId.
    const decodedCursor = decodeListCursor(cursor);

    let query = db
        .from('media')
        .select(MEDIA_LIBRARY_COLUMNS)
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false });

    // Optional type filter (image | video; 'all' skips the filter).
    if (type !== 'all') {
        query = query.eq('media_type', type);
    }

    // Optional search: ilike on filename and original_name.
    if (q) {
        // Strip characters that have special meaning in PostgREST filter syntax
        // (condition delimiters + nesting operators) as well as single-quotes and
        // backslashes that could cause parsing edge-cases even though the Supabase
        // JS client sends this as a query-string parameter.
        const safe = q.replace(/[%(),'\\]/g, '').trim();
        if (safe) {
            query = query.or(`filename.ilike.%${safe}%,original_name.ilike.%${safe}%`);
        }
    }

    // Cursor pagination: fetch limit+1 rows so we know whether a next page exists.
    if (decodedCursor) {
        query = query.lt('created_at', decodedCursor.value);
    }
    query = query.limit(limit + 1);

    const { data, error } = await query;

    if (error) {
        return c.json(
            { error: { code: 'DB_ERROR', message: error.message } },
            500,
        );
    }

    const rows = data || [];
    const pageRows = rows.slice(0, limit);
    const nextCursor =
        rows.length > limit
            ? encodeListCursor(
                  pageRows[pageRows.length - 1] as unknown as Record<string, unknown>,
                  'created_at',
              )
            : null;

    return c.json(
        cursorPaginated(pageRows, {
            page: 1,
            limit,
            nextCursor,
        }),
    );
});

export default router;
