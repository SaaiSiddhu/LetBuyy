import { Hono } from 'hono';
import type { Env } from '../index';
import { getSupabaseAdmin, paginated, success } from '../lib/supabase';

const router = new Hono<{ Bindings: Env }>();

// GET /media — List media files for a store
router.get('/', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.query('store_id');
    const folder = c.req.query('folder');
    const mediaType = c.req.query('type');
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '30'), 100);
    const offset = (page - 1) * limit;
    const db = getSupabaseAdmin(c);

    if (!storeId) {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id is required' } }, 400);
    }

    let query = db
        .from('media')
        .select('*, stores!inner(user_id)', { count: 'exact' })
        .eq('stores.user_id', auth.user.id)
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (folder) query = query.eq('folder', folder);
    if (mediaType) query = query.eq('media_type', mediaType);

    const { data, error, count } = await query;

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(paginated(data || [], count || 0, page, limit));
});

// POST /media — Create media record (metadata registration after upload via R2)
router.post('/', async (c) => {
    const auth = c.get('auth');
    const body = await c.req.json();
    const db = getSupabaseAdmin(c);

    if (!body.store_id || !body.filename || !body.url || !body.mime_type) {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id, filename, url, and mime_type are required' } }, 400);
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
            uploaded_by: auth.user.id,
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

    // Verify ownership
    const { data: existing } = await db
        .from('media')
        .select('store_id, stores!inner(user_id)')
        .eq('id', mediaId)
        .single();

    if (!existing || (existing as any).stores?.user_id !== auth.user.id) {
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

    const { data: existing } = await db
        .from('media')
        .select('store_id, url, stores!inner(user_id)')
        .eq('id', mediaId)
        .single();

    if (!existing || (existing as any).stores?.user_id !== auth.user.id) {
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
