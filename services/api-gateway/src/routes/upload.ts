import { Hono, type Context } from 'hono';
import { PublicUploadRecoveryInputSchema, FileUploadResultSchema } from '@letbuyy/shared-types';
import { IdempotencyExecutionAdapter } from '../execution/idempotency-execution.adapter';
import { AppError, ConflictError, ForbiddenError, ValidationError } from '../lib/errors';
import type { Env } from '../index';
import { allocatedUploadKey, PublicUploadProgressSchema, PUBLIC_UPLOAD_RESOURCE, uploadObjectMatches, storedUploadResponse } from '../lib/public-upload-recovery';
import { resolveCustomUser, verifySiteOwnership, type WorkerAuthUser } from '../lib/auth-user';
import { getSupabaseAdmin } from '../lib/supabase';
import { validateUploadMime, safeFileExtension, mediaKindForUpload, uploadLimitForKind, uploadLimitLabel, safeUploadFolder } from '../lib/upload-mime';

const router = new Hono<{ Bindings: Env }>();
type UploadContext = Context<{ Bindings: Env }>;

function isProductionEnv(env: Env): boolean {
    return [env.ENVIRONMENT, env.APP_ENV, env.NODE_ENV, env.DEPLOYMENT_ENV]
        .some((value) => value === 'production');
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 0x8000;

    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        const chunk = bytes.subarray(offset, offset + chunkSize);
        binary += String.fromCharCode(...chunk);
    }

    return btoa(binary);
}

function publicAssetBaseUrl(c: UploadContext): string | null {
    // Service-bound calls use an internal request host. The scoped public base
    // must name this Worker's registered /assets route, not the separate legacy
    // ASSET_PUBLIC_BASE_URL used by other media flows.
    const configured = c.env.UPLOAD_PUBLIC_BASE_URL?.trim();
    if (configured) {
        try {
            const url = new URL(configured);
            if ((url.protocol !== 'https:' && (isProductionEnv(c.env) || url.protocol !== 'http:'))
                || url.pathname.replace(/\/+$/, '') !== '/assets'
                || url.username || url.password || url.search || url.hash) return null;
            return `${url.origin}/assets`;
        } catch { return null; }
    }
    const requestUrl = new URL(c.req.url);
    if (isProductionEnv(c.env) || requestUrl.hostname.endsWith('.internal')) return null;
    // Local test/development Workers can serve their own allocated origin.
    return `${new URL(c.req.url).origin}/assets`;
}


// This route always returns public media (or inline development bytes). A KYC
// namespace must never imply private custody on either storage path. Recognizing
// these names contains the maintained caller; it cannot classify arbitrary files.
function isPrivateDocumentFolder(value: string): boolean {
    let decoded = value;
    try { decoded = decodeURIComponent(value); } catch { /* Inspect the literal invalid encoding. */ }
    const words = decoded.normalize('NFKC').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    return words.some((word) => /^(?:kyc|kycdocuments?|privatekyc|privatedocuments?)$/.test(word))
        || (words.some((word) => ['private', 'identity', 'verification'].includes(word))
            && words.some((word) => /^(?:documents?|proofs?|evidence)$/.test(word)));
}

function uploadMediaType(file: { type: string }, kind: 'video' | 'model' | 'standard'): 'image' | 'video' | 'audio' | 'document' | 'other' {
    const type = file.type.toLowerCase();
    if (kind === 'video') return 'video';
    if (kind === 'model') return 'other';
    if (type.startsWith('image/')) return 'image';
    if (type.startsWith('audio/')) return 'audio';
    if (type.includes('pdf') || type.includes('document') || type.includes('text')) return 'document';
    return 'other';
}

function uploadDeleteKeyFromPath(path: string): string {
    return decodeURIComponent(path)
        .replace(/^\/(?:v\d+\/)?upload\/?/, '')
        .replace(/^\/+|\/+$/g, '');
}

function stringValue(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function metadataValue(metadata: Record<string, string> | undefined, key: string): string | null {
    return stringValue(metadata?.[key]);
}

function isLegacyOwnerKey(key: string, ownerId: string): boolean {
    return key.split('/').filter(Boolean).includes(ownerId);
}

async function verifyUploadStoreOwnership(c: UploadContext, storeId: string, authUser: WorkerAuthUser): Promise<boolean> {
    if (authUser.storeId && authUser.storeId !== storeId) return false;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, authUser);
    if (!customUser) return false;

    return verifySiteOwnership(db, storeId, customUser.id, authUser.storeId);
}

function logUploadError(error: unknown): void {
    console.error(JSON.stringify({
        level: 'error',
        service: 'api-gateway',
        route: 'upload',
        message: error instanceof Error ? error.message : 'Unknown upload error',
    }));
}

// POST /upload/recover — Verify the original allocated object and acknowledge
// that same receipt. Never allocate, reclaim an upload lease or resend bytes.
router.post('/recover', async (c) => {
    const parsed = PublicUploadRecoveryInputSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw new ValidationError('Invalid saved upload details');
    const input = parsed.data, auth = c.get('auth');
    const selected = c.req.header('X-Store-ID')?.trim();
    if ((selected && selected !== input.store_id) ||
        !(await verifyUploadStoreOwnership(c, input.store_id, auth.user))) throw new ForbiddenError();
    const idempotency = new IdempotencyExecutionAdapter(getSupabaseAdmin(c));
    const receipt = await idempotency.readForRecovery({
        siteId: input.store_id, key: input.idempotency_key, scope: 'http:POST:/upload',
        requestBody: { method: 'POST', path: '/upload', query: {}, body: {
            store_id: input.store_id, folder: input.folder,
            file: { name: input.filename, content_type: input.content_type,
                size: input.byte_size, sha256: input.sha256_hex },
        } },
    });
    if (!receipt) throw new ConflictError('The storage acknowledgement is unconfirmed. Retain the saved request for review.');
    const completed = receipt.status === 'completed';
    const allocation = PublicUploadProgressSchema.safeParse(receipt.response_body);
    if (!completed && (!allocation.success || receipt.resource_type !== PUBLIC_UPLOAD_RESOURCE))
        throw new ConflictError('This older unfinished upload has no recoverable object identity. Retain it for review.');
    if (!completed && allocation.success && allocation.data.upload_progress.actor_id !== auth.user.id) throw new ForbiddenError();
    let value: unknown;
    let acknowledgement: ReturnType<typeof storedUploadResponse> | undefined;
    if (completed) {
        const envelope = receipt.response_body;
        value = envelope && typeof envelope === 'object' && !Array.isArray(envelope) ? envelope.data : null;
    } else if (allocation.success) {
        const base = publicAssetBaseUrl(c);
        if (!base) throw new AppError('Public upload delivery is unavailable', 503, 'STORAGE_UNAVAILABLE');
        const key = allocatedUploadKey(allocation.data.upload_progress, input.folder, input.filename);
        acknowledgement = storedUploadResponse(base, key, { size: input.byte_size, contentType: input.content_type,
            mediaType: uploadMediaType({ type: input.content_type }, mediaKindForUpload({ name: input.filename, type: input.content_type })), storeId: input.store_id });
        value = acknowledgement.data;
    }
    const result = FileUploadResultSchema.safeParse(value);
    if (!result.success || result.data.store_id !== input.store_id)
        throw new AppError('The saved upload acknowledgement could not be confirmed', 503, 'UPLOAD_RECEIPT_UNAVAILABLE');
    if (!c.env.R2_BUCKET) throw new AppError('File storage is unavailable', 503, 'STORAGE_UNAVAILABLE');
    const object = await c.env.R2_BUCKET.head(result.data.key);
    if (!uploadObjectMatches(object, { key: result.data.key, siteId: input.store_id,
        size: input.byte_size, contentType: input.content_type,
        ...(!completed ? { receiptId: receipt.id, actorId: auth.user.id, sha256: input.sha256_hex } : {}) }))
        throw new AppError('The uploaded object could not be confirmed. Retain the original request for review.', 503, 'UPLOAD_OBJECT_UNCONFIRMED');
    if (!(await verifyUploadStoreOwnership(c, input.store_id, auth.user))) throw new ForbiddenError();
    if (!completed) {
        if (!acknowledgement) throw new AppError('The original acknowledgement is unavailable', 503, 'UPLOAD_RECEIPT_UNAVAILABLE');
        await idempotency.completeRecovered({ id: receipt.id, siteId: input.store_id,
            requestHash: receipt.request_hash, resourceType: PUBLIC_UPLOAD_RESOURCE,
            responseBody: acknowledgement, statusCode: 201 });
    }
    if (!(await verifyUploadStoreOwnership(c, input.store_id, auth.user))) throw new ForbiddenError();
    return c.json({ data: result.data }, 200);
});

// POST /upload — Upload file to R2
router.post('/', async (c) => {
    const auth = c.get('auth');
    const contentType = c.req.header('Content-Type') || '';

    if (!contentType.includes('multipart/form-data') && !contentType.includes('application/octet-stream')) {
        return c.json({ error: { code: 'VALIDATION', message: 'Expected file upload' } }, 400);
    }

    try {
        const formData = await c.req.formData();
        const fileEntry = formData.get('file');
        const folderEntry = formData.get('folder');
        const bodyStoreId = stringValue(formData.get('store_id')) || stringValue(formData.get('site_id'));
        const selectedStoreId = stringValue(c.req.header('X-Store-ID'));
        if (bodyStoreId && selectedStoreId && bodyStoreId !== selectedStoreId) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'Selected store does not match this upload' } }, 403);
        }
        const storeId = bodyStoreId || selectedStoreId || auth.user.storeId;

        if (
            !fileEntry ||
            typeof fileEntry === 'string' ||
            typeof (fileEntry as { stream?: unknown }).stream !== 'function'
        ) {
            return c.json({ error: { code: 'VALIDATION', message: 'No file provided' } }, 400);
        }

        const file = fileEntry as File;
        const folder =
            typeof folderEntry === 'string' && folderEntry.trim().length > 0
                ? safeUploadFolder(folderEntry)
                : 'uploads';
        if (isPrivateDocumentFolder(typeof folderEntry === 'string' ? folderEntry : '')
            || isPrivateDocumentFolder(folder)) {
            return c.json({ error: {
                code: 'KYC_PRIVATE_UPLOAD_UNAVAILABLE',
                message: 'Private verification document uploads are unavailable. Do not send identity or bank documents through public media uploads.',
            } }, 503);
        }
        if (storeId && !(await verifyUploadStoreOwnership(c, storeId, auth.user))) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized to upload for this store' } }, 403);
        }

        // Phase X — MIME allowlist gate (SVG and other unsafe types rejected).
        const mimeCheck = validateUploadMime(file);
        if (!mimeCheck.ok) {
            return c.json({ error: { code: 'MIME_NOT_ALLOWED', message: mimeCheck.error } }, 400);
        }

        const mediaKind = mediaKindForUpload(file);
        const sizeLimit = uploadLimitForKind(mediaKind);
        const mediaType = uploadMediaType(file, mediaKind);
        if (file.size > sizeLimit) {
            return c.json({ error: { code: 'VALIDATION', message: `File too large (max ${uploadLimitLabel(sizeLimit)})` } }, 400);
        }

        const claim = c.get('publicUploadClaim');
        const allocation = PublicUploadProgressSchema.safeParse(claim?.recoveryBody);
        if (!claim || claim.siteId !== storeId || !allocation.success)
            throw new AppError('A durable original upload allocation is required', 503, 'UPLOAD_RECEIPT_UNAVAILABLE');
        if (allocation.data.upload_progress.actor_id !== auth.user.id) throw new ForbiddenError();
        const key = allocatedUploadKey(allocation.data.upload_progress, folder, file.name);

        if (!c.env.R2_BUCKET) {
            if (isProductionEnv(c.env)) {
                return c.json({ error: { code: 'STORAGE_UNAVAILABLE', message: 'File storage is not configured' } }, 503);
            }

            const base64 = arrayBufferToBase64(await file.arrayBuffer());
            return c.json({
                data: {
                    url: `data:${file.type || 'application/octet-stream'};base64,${base64}`,
                    key: `local-dev/${key}`,
                    size: file.size,
                    content_type: file.type,
                    media_type: mediaType,
                    storage: 'local-dev-inline',
                    cdn_configured: false,
                    store_id: storeId || null,
                },
            }, 201);
        }

        const assetBaseUrl = publicAssetBaseUrl(c);
        if (!assetBaseUrl) return c.json({ error: { code: 'STORAGE_UNAVAILABLE', message: 'Public upload delivery URL is not configured' } }, 503);

        const expectedObject = { key, siteId: storeId!, size: file.size, contentType: file.type,
            receiptId: claim.id, actorId: auth.user.id, sha256: claim.sha256 };
        const existing = await c.env.R2_BUCKET.head(key);
        if (existing && !uploadObjectMatches(existing, expectedObject))
            throw new ConflictError('The original object does not match this upload. Retain it for review.');
        if (!(await verifyUploadStoreOwnership(c, storeId!, auth.user))) throw new ForbiddenError();
        if (!existing) {
        await c.env.R2_BUCKET.put(key, file.stream(), {
            onlyIf: new Headers({ 'If-None-Match': '*' }),
            sha256: claim.sha256,
            httpMetadata: { contentType: file.type },
            customMetadata: {
                visibility: 'public',
                delivery: 'letbuyy-public-v1',
                owner_id: auth.user.id,
                ...(storeId ? { store_id: storeId } : {}),
                folder,
                original_name: file.name.slice(0, 160),
                media_type: mediaType,
                upload_receipt_id: claim.id,
                upload_sha256: claim.sha256,
            },
        });
        // A conditional loser or interrupted acknowledgement can only accept
        // the exact original bound object, never overwrite unrelated bytes.
        const stored = await c.env.R2_BUCKET.head(key);
        if (!uploadObjectMatches(stored, expectedObject))
            throw new AppError('Storage did not confirm the original object', 503, 'UPLOAD_OBJECT_UNCONFIRMED');
        }
        if (!(await verifyUploadStoreOwnership(c, storeId!, auth.user))) throw new ForbiddenError();

        // A new response and recovery serialize the same original object receipt.
        return c.json(storedUploadResponse(assetBaseUrl, key, {
            size: file.size, contentType: file.type, mediaType, storeId: storeId!,
        }), 201);
    } catch (err) {
        if (err instanceof AppError) throw err;
        logUploadError(err);
        return c.json({ error: { code: 'UPLOAD_ERROR', message: 'Failed to upload file' } }, 500);
    }
});

// DELETE /upload/:key — Delete file from R2
router.delete('/*', async (c) => {
    const auth = c.get('auth');
    const key = (c.req.param('*') || uploadDeleteKeyFromPath(c.req.path)).replace(/^\/+|\/+$/g, '');
    const requestedStoreId = stringValue(c.req.query('store_id')) || stringValue(c.req.query('site_id'));
    if (!key || key.includes('..') || key.includes('\\')) {
        return c.json({ error: { code: 'VALIDATION', message: 'File key required' } }, 400);
    }

    try {
        if (!c.env.R2_BUCKET) {
            if (isProductionEnv(c.env)) {
                return c.json({ error: { code: 'STORAGE_UNAVAILABLE', message: 'File storage is not configured' } }, 503);
            }

            return c.json({ data: { deleted: true, storage: 'local-dev-inline' } });
        }

        const object = await c.env.R2_BUCKET.head(key);
        if (!object) {
            return c.json({ error: { code: 'NOT_FOUND', message: 'File not found' } }, 404);
        }

        const metadataStoreId = metadataValue(object.customMetadata, 'store_id') || metadataValue(object.customMetadata, 'site_id');
        const ownerId = metadataValue(object.customMetadata, 'owner_id');

        if (metadataStoreId && requestedStoreId && metadataStoreId !== requestedStoreId) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized to delete this file' } }, 403);
        }

        if (metadataStoreId) {
            if (!(await verifyUploadStoreOwnership(c, metadataStoreId, auth.user))) {
                return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized to delete this file' } }, 403);
            }
        } else if (
            !requestedStoreId ||
            ownerId !== auth.user.id ||
            !isLegacyOwnerKey(key, auth.user.id) ||
            !(await verifyUploadStoreOwnership(c, requestedStoreId, auth.user))
        ) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized to delete this file' } }, 403);
        }

        await c.env.R2_BUCKET.delete(key);
        return c.json({ data: { deleted: true } });
    } catch (err) {
        return c.json({ error: { code: 'DELETE_ERROR', message: 'Failed to delete file' } }, 500);
    }
});

export default router;
