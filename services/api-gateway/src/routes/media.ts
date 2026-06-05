import { Hono } from 'hono';
import type { Env } from '../index';
import { resolveCustomUser, verifySiteOwnership } from '../lib/auth-user';
import { cursorPaginated, decodeListCursor, encodeListCursor, getSupabaseAdmin, success } from '../lib/supabase';
import { validate } from '../middleware/validation';
import { ListMediaQuery } from '../schemas/media.schema';
import type { z } from 'zod';

const router = new Hono<{ Bindings: Env }>();

type ListMediaQueryInput = z.infer<typeof ListMediaQuery>;

const MEDIA_LIST_COLUMNS = [
    'id',
    'store_id',
    'uploaded_by',
    'filename',
    'original_name',
    'url',
    'thumbnail_url',
    'mime_type',
    'size_bytes',
    'width',
    'height',
    'alt_text',
    'caption',
    'folder',
    'media_type',
    'tags',
    'usage_count',
    'created_at',
    'updated_at',
].join(',');

interface MediaOwnerRow {
    store_id?: string | null;
    url?: string | null;
}

// GET /media — List media files for a store
router.get('/', validate('query', ListMediaQuery), async (c) => {
    const auth = c.get('auth');
    const q = c.get('validatedQuery') as ListMediaQueryInput;
    const offset = (q.page - 1) * q.limit;
    const decodedCursor = decodeListCursor(q.cursor);
    const storeId = q.store_id;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!storeId) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'store_id is required' } }, 400);
    }
    if (!customUser) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }
    if (!(await verifySiteOwnership(db, storeId, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    let query = db
        .from('media')
        .select(MEDIA_LIST_COLUMNS, q.withCount ? { count: 'exact' } : undefined)
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false });

    if (q.folder) query = query.eq('folder', q.folder);
    if (q.type && q.type !== 'all') query = query.eq('media_type', q.type);
    if (q.search) {
        const search = q.search.replace(/[%(),]/g, '').trim();
        if (search) query = query.or(`filename.ilike.%${search}%,original_name.ilike.%${search}%`);
    }
    if (decodedCursor) query = query.lt('created_at', decodedCursor.value);
    query = q.cursor || q.page === 1
        ? query.limit(q.limit + 1)
        : query.range(offset, offset + q.limit);

    const { data, error, count } = await query;

    if (error) {
        return c.json({ success: false, error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    const rows = data || [];
    const pageRows = rows.slice(0, q.limit);
    const nextCursor = rows.length > q.limit
        ? encodeListCursor(pageRows[pageRows.length - 1] as unknown as Record<string, unknown>, 'created_at')
        : null;

    return c.json(cursorPaginated(pageRows, {
        page: q.page,
        limit: q.limit,
        total: q.withCount ? count || 0 : undefined,
        nextCursor,
    }));
});

// POST /media — Create media record (metadata registration after upload via R2)
router.post('/', async (c) => {
    const auth = c.get('auth');
    const body = await c.req.json();
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!body.store_id || !body.filename || !body.url || !body.mime_type) {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id, filename, url, and mime_type are required' } }, 400);
    }

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }
    if (!(await verifySiteOwnership(db, body.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    // Determine media type from mime
    let mediaType = 'other';
    if (body.mime_type.startsWith('image/')) mediaType = 'image';
    else if (body.mime_type.startsWith('video/')) mediaType = 'video';
    else if (body.mime_type.startsWith('audio/')) mediaType = 'audio';
    else if (body.mime_type.includes('pdf') || body.mime_type.includes('document') || body.mime_type.includes('text')) mediaType = 'document';

    const { data, error } = await db
        .from('media')
        .insert({
            store_id: body.store_id,
            uploaded_by: customUser.id,
            filename: body.filename,
            original_name: body.original_name || body.filename,
            url: body.url,
            thumbnail_url: body.thumbnail_url || null,
            mime_type: body.mime_type,
            size_bytes: body.size_bytes || 0,
            width: body.width || null,
            height: body.height || null,
            alt_text: body.alt_text || null,
            caption: body.caption || null,
            folder: body.folder || '/',
            media_type: mediaType,
            tags: body.tags || [],
        })
        .select()
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data), 201);
});

// PATCH /media/:id — Update media metadata
router.patch('/:id', async (c) => {
    const auth = c.get('auth');
    const mediaId = c.req.param('id');
    const body = await c.req.json();
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    const { data: existing } = await db
        .from('media')
        .select('store_id')
        .eq('id', mediaId)
        .single();

    const ownedMedia = existing as MediaOwnerRow | null;
    if (!customUser || !ownedMedia?.store_id || !(await verifySiteOwnership(db, ownedMedia.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const allowed = ['alt_text', 'caption', 'folder', 'tags', 'filename'];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
        if (body[key] !== undefined) updates[key] = body[key];
    }

    if (Object.keys(updates).length === 0) {
        return c.json({ error: { code: 'VALIDATION', message: 'No valid fields to update' } }, 400);
    }

    const { data, error } = await db
        .from('media')
        .update(updates)
        .eq('id', mediaId)
        .select()
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data));
});

// DELETE /media/:id — Delete a media record
router.delete('/:id', async (c) => {
    const auth = c.get('auth');
    const mediaId = c.req.param('id');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    const { data: existing } = await db
        .from('media')
        .select('store_id, url')
        .eq('id', mediaId)
        .single();

    const ownedMedia = existing as MediaOwnerRow | null;
    if (!customUser || !ownedMedia?.store_id || !(await verifySiteOwnership(db, ownedMedia.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    // Delete from database
    const { error } = await db.from('media').delete().eq('id', mediaId);

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    // Note: R2 object cleanup should be handled separately (e.g., via webhook or scheduled task)
    return c.json({ data: { deleted: true } });
});

export default router;
