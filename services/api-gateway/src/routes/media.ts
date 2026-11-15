import { Hono } from 'hono';
import type { Env } from '../index';
import { resolveCustomUser, verifySiteOwnership } from '../lib/auth-user';
import { cursorPaginated, decodeListCursor, encodeListCursor, getSupabaseAdmin, success } from '../lib/supabase';
import { validate } from '../middleware/validation';
import { ListMediaQuery, RegisterMediaSchema, UpdateMediaSchema } from '../schemas/media.schema';
import type { MediaRegistrationInput, MediaMetadataUpdate } from '@letbuyy/shared-types';
import { commitMediaCommand } from '../execution/media-command.adapter';
import { planSignedR2UploadIntent } from '@letbuyy/infrastructure/storage-adapter';
import { z } from 'zod';
import { resolveOwnedStoreScope } from '../lib/tenant-context';

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

function objectKeyFromMediaUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    try {
        return new URL(url).pathname.replace(/^\/+/, '') || null;
    } catch {
        return url.replace(/^\/+/, '') || null;
    }
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

// Public metadata effects and the existing HTTP receipt commit together under
// the canonical tenant transaction, including metadata edits and logical delete.
router.post('/', validate('json', RegisterMediaSchema), async (c) => {
    const body = c.get('validatedBody') as MediaRegistrationInput;
    const scope = await resolveOwnedStoreScope(c, body.store_id);
    let mediaType = 'other';
    if (body.mime_type.startsWith('image/')) mediaType = 'image';
    else if (body.mime_type.startsWith('video/')) mediaType = 'video';
    else if (body.mime_type.startsWith('audio/')) mediaType = 'audio';
    else if (body.mime_type.includes('pdf') || body.mime_type.includes('document') || body.mime_type.includes('text')) mediaType = 'document';
    const objectKey = body.storage_key || body.object_key || body.storage_path || objectKeyFromMediaUrl(body.url);
    if (!objectKey || objectKey.length > 512) return c.json({error: {code: 'VALIDATION', message: 'Review the media storage key'}}, 400);
    const reply = await commitMediaCommand(c.env, scope, c.get('mediaCommandClaim'), {operation: 'create', input: body, objectKey, mediaType});
    c.set('atomicIdempotencyCommitted', true);
    return c.json(reply.body, reply.statusCode);
});

const MediaIdSchema = z.object({id: z.string().uuid()});
router.patch('/:id', validate('param', MediaIdSchema), validate('json', UpdateMediaSchema), async (c) => {
    const claim = c.get('mediaCommandClaim');
    if (!claim) return c.json({error: {code: 'MEDIA_COMMAND_UNCONFIRMED', message: 'The original media receipt is unavailable'}}, 503);
    const scope = await resolveOwnedStoreScope(c, claim.siteId);
    const reply = await commitMediaCommand(c.env, scope, claim, {operation: 'update', id: c.req.param('id'), input: c.get('validatedBody') as MediaMetadataUpdate});
    c.set('atomicIdempotencyCommitted', true);
    return c.json(reply.body, reply.statusCode);
});

router.delete('/:id', validate('param', MediaIdSchema), async (c) => {
    const claim = c.get('mediaCommandClaim');
    if (!claim) return c.json({error: {code: 'MEDIA_COMMAND_UNCONFIRMED', message: 'The original media receipt is unavailable'}}, 503);
    const scope = await resolveOwnedStoreScope(c, claim.siteId);
    const reply = await commitMediaCommand(c.env, scope, claim, {operation: 'delete', id: c.req.param('id')});
    c.set('atomicIdempotencyCommitted', true);
    return c.json(reply.body, reply.statusCode);
});

export default router;
