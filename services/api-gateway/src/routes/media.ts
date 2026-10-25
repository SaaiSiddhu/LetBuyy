import { Hono, type Context } from 'hono';
import type { Env } from '../index';
import { resolveCustomUser, verifySiteOwnership } from '../lib/auth-user';
import { cursorPaginated, decodeListCursor, encodeListCursor, getSupabaseAdmin, success } from '../lib/supabase';
import { EventExecutionAdapter } from '../execution/event-execution.adapter';
import { validate } from '../middleware/validation';
import { ListMediaQuery } from '../schemas/media.schema';
import { planSignedR2UploadIntent, type MediaAssetType } from '@letbuyy/infrastructure/storage-adapter';
import { z } from 'zod';
import { resolveMerchantResourceStoreIds } from '../lib/tenant-context';

const router = new Hono<{ Bindings: Env }>();
type MediaContext = Context<{ Bindings: Env }>;

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

const SignedMediaUploadSchema = z.object({
    site_id: z.string().uuid(),
    filename: z.string().trim().min(1).max(180),
    content_type: z.string().trim().min(1).max(160),
    size_bytes: z.number().int().positive().max(100 * 1024 * 1024),
    folder: z.string().trim().max(96).optional(),
    checksum_sha256: z.string().trim().regex(/^[a-f0-9]{64}$/i).optional(),
    channel: z.enum(['web', 'whatsapp', 'instagram', 'pos', 'api']).default('web'),
});
type SignedMediaUploadInput = z.infer<typeof SignedMediaUploadSchema>;

function requestId(c: MediaContext): string | null {
    return c.res.headers.get('X-Request-ID') || c.req.header('X-Request-ID') || null;
}

function assetTypeForMediaType(mediaType: string): MediaAssetType {
    if (mediaType === 'image' || mediaType === 'video' || mediaType === 'font' || mediaType === 'icon') return mediaType;
    return 'file';
}

function objectKeyFromMediaUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    try {
        return new URL(url).pathname.replace(/^\/+/, '') || null;
    } catch {
        return url.replace(/^\/+/, '') || null;
    }
}

function isOptionalMediaAssetWriteError(error: { message?: string } | null | undefined): boolean {
    const message = error?.message || '';
    return message.includes('schema cache')
        || message.includes('site_id')
        || message.includes('object_key')
        || message.includes('processing_status');
}

async function emitMediaProcessedEvent(
    c: MediaContext,
    input: {
        siteId: string;
        mediaId: string;
        assetId?: string | null;
        objectKey?: string | null;
        contentType?: string | null;
        sizeBytes?: number | null;
    },
): Promise<void> {
    await new EventExecutionAdapter(getSupabaseAdmin(c)).emitDomainEvent({
        storeId: input.siteId,
        aggregateType: 'media',
        aggregateId: input.mediaId,
        eventType: 'media.processed',
        payload: {
            site_id: input.siteId,
            media_id: input.mediaId,
            asset_id: input.assetId || undefined,
            object_key: input.objectKey || undefined,
            content_type: input.contentType || undefined,
            size_bytes: input.sizeBytes || undefined,
        },
        idempotencyKey: `media.processed:${input.siteId}:${input.mediaId}`,
        requestId: requestId(c),
    });
}

async function recordProcessedMediaAsset(
    db: ReturnType<typeof getSupabaseAdmin>,
    input: {
        siteId: string;
        filename: string;
        originalName: string;
        publicUrl: string;
        objectKey: string;
        mediaType: string;
        mimeType: string;
        sizeBytes: number;
        checksumSha256?: string | null;
        channel?: string | null;
    },
) {
    const { data, error } = await db
        .from('media_assets')
        .insert({
            store_id: input.siteId,
            site_id: input.siteId,
            asset_type: assetTypeForMediaType(input.mediaType),
            storage_provider: 'r2',
            storage_path: input.objectKey,
            object_key: input.objectKey,
            public_url: input.publicUrl,
            filename: input.originalName || input.filename,
            content_type: input.mimeType,
            size_bytes: input.sizeBytes,
            processing_status: 'processed',
            processed_at: new Date().toISOString(),
            checksum_sha256: input.checksumSha256 || null,
            source_channel: input.channel || 'web',
            metadata: {
                source: 'media-route',
                filename: input.filename,
            },
        })
        .select('id, object_key, processing_status')
        .single();

    if (error) {
        if (isOptionalMediaAssetWriteError(error)) return null;
        throw new Error(`Media asset mirror failed: ${error.message}`);
    }

    return data as { id: string; object_key: string; processing_status: string };
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

    const rows = (data || []) as unknown as Array<{ id: string; url: string; created_at: string; [key: string]: unknown }>;
    const pageRows = rows.slice(0, q.limit);
    const assets = pageRows.length ? await db.from('media_assets').select('public_url,object_key')
        .eq('site_id', storeId).in('public_url', pageRows.map(row => row.url)).is('deleted_at', null)
        : { data: [], error: null };
    if (assets.error) return c.json({ error: { code: 'MEDIA_STORAGE_UNAVAILABLE', message: 'Unable to confirm media storage' } }, 503);
    const objectKeys = new Map((assets.data || []).map(asset => [asset.public_url, asset.object_key]));
    const withStorage = pageRows.map(row => ({ ...row, storage_key: objectKeys.get(row.url) || null }));
    const nextCursor = rows.length > q.limit
        ? encodeListCursor(pageRows[pageRows.length - 1] as unknown as Record<string, unknown>, 'created_at')
        : null;

    return c.json(cursorPaginated(withStorage, {
        page: q.page,
        limit: q.limit,
        total: q.withCount ? count || 0 : undefined,
        nextCursor,
    }));
});

// POST /media/signed-upload — Plan an R2 upload intent (object key, public URL) without activating
// a media service. Phase D2: no caller anywhere signs or verifies this intent -- it previously
// carried an HMAC token that nothing ever checked (routes/upload.ts, the only live upload path, is
// independently guarded by session auth and never reads it). The signing machinery was removed;
// this route still records the planned media_assets row and returns the intent shape.
router.post('/signed-upload', async (c) => {
    const auth = c.get('auth');
    const parsed = SignedMediaUploadSchema.safeParse(await c.req.json());
    if (!parsed.success) {
        return c.json({ error: { code: 'VALIDATION', message: 'Invalid media upload intent' } }, 400);
    }

    const input: SignedMediaUploadInput = parsed.data;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);
    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }
    if (!(await verifySiteOwnership(db, input.site_id, customUser.id, auth.user.storeId))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const origin = new URL(c.req.url).origin;
    const intent = planSignedR2UploadIntent({
        siteId: input.site_id,
        intentId: crypto.randomUUID(),
        filename: input.filename,
        contentType: input.content_type,
        sizeBytes: input.size_bytes,
        folder: input.folder || 'media',
        publicBaseUrl: c.env.ASSET_PUBLIC_BASE_URL,
        uploadPath: `${origin}/v1/upload`,
    });

    const { data, error } = await db
        .from('media_assets')
        .insert({
            store_id: input.site_id,
            site_id: input.site_id,
            asset_type: intent.assetType,
            storage_provider: 'r2',
            storage_path: intent.objectKey,
            object_key: intent.objectKey,
            public_url: intent.publicUrl,
            filename: intent.filename,
            content_type: intent.contentType,
            size_bytes: intent.sizeBytes,
            upload_intent_expires_at: intent.expiresAt,
            processing_status: 'pending',
            checksum_sha256: input.checksum_sha256 || null,
            source_channel: input.channel,
            metadata: {
                ...intent.metadata,
                signed_upload: true,
            },
        })
        .select('id, object_key, public_url, upload_intent_expires_at, processing_status')
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success({
        asset: data,
        upload: intent,
    }), 201);
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

    const mediaRow = data as { id: string; url?: string | null };
    const objectKey = body.storage_key || body.object_key || body.storage_path || objectKeyFromMediaUrl(mediaRow.url || body.url) || `${body.store_id}/${body.filename}`;
    const asset = await recordProcessedMediaAsset(db, {
        siteId: body.store_id,
        filename: body.filename,
        originalName: body.original_name || body.filename,
        publicUrl: body.url,
        objectKey,
        mediaType,
        mimeType: body.mime_type,
        sizeBytes: body.size_bytes || 0,
        checksumSha256: body.checksum_sha256 || null,
        channel: body.channel || 'web',
    });
    await emitMediaProcessedEvent(c, {
        siteId: body.store_id,
        mediaId: mediaRow.id,
        assetId: asset?.id,
        objectKey,
        contentType: body.mime_type,
        sizeBytes: body.size_bytes || 0,
    });

    return c.json(success({ ...mediaRow, storage_key: objectKey, asset }), 201);
});

// PATCH /media/:id — Update media metadata
router.patch('/:id', async (c) => {
    const auth = c.get('auth');
    const mediaId = c.req.param('id');
    const body = await c.req.json();
    const db = getSupabaseAdmin(c);
    const storeIds = await resolveMerchantResourceStoreIds(c);
    const customUser = await resolveCustomUser(db, auth.user);

    const { data: existing } = await db
        .from('media')
        .select('store_id')
        .eq('id', mediaId).in('store_id', storeIds)
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
        .eq('id', mediaId).in('store_id', storeIds)
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
    const storeIds = await resolveMerchantResourceStoreIds(c);
    const customUser = await resolveCustomUser(db, auth.user);

    const { data: existing } = await db
        .from('media')
        .select('store_id, url')
        .eq('id', mediaId).in('store_id', storeIds)
        .single();

    const ownedMedia = existing as MediaOwnerRow | null;
    if (!customUser || !ownedMedia?.store_id || !(await verifySiteOwnership(db, ownedMedia.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    // Delete from database
    const { error } = await db.from('media').delete().eq('id', mediaId).in('store_id', storeIds);

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    // Note: R2 object cleanup should be handled separately (e.g., via webhook or scheduled task)
    return c.json({ data: { deleted: true } });
});

export default router;
