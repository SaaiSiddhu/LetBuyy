import { Hono, type Context } from 'hono';
import type { Env } from '../index';
import { resolveCustomUser, verifySiteOwnership, type WorkerAuthUser } from '../lib/auth-user';
import { getSupabaseAdmin } from '../lib/supabase';
import { validateUploadMime } from '../lib/upload-mime';

const router = new Hono<{ Bindings: Env }>();
type UploadContext = Context<{ Bindings: Env }>;
const STANDARD_UPLOAD_LIMIT_BYTES = 10 * 1024 * 1024;
const VIDEO_UPLOAD_LIMIT_BYTES = 100 * 1024 * 1024;
const MODEL_UPLOAD_LIMIT_BYTES = 50 * 1024 * 1024;

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

function safeUploadFolder(value: string): string {
    return value
        .trim()
        .replace(/[^a-zA-Z0-9/_-]/g, '-')
        .replace(/\/+/g, '/')
        .replace(/^\/+|\/+$/g, '')
        .slice(0, 96) || 'uploads';
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

function safeFileExtension(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
    return ext.slice(0, 12) || 'bin';
}

function mediaKindForUpload(file: File): 'video' | 'model' | 'standard' {
    const type = file.type.toLowerCase();
    const ext = safeFileExtension(file.name);
    if (type.startsWith('video/') || ['mp4', 'mov', 'm4v', 'webm'].includes(ext)) return 'video';
    if (type.startsWith('model/') || ['glb', 'gltf', 'usdz'].includes(ext)) return 'model';
    return 'standard';
}

function uploadLimitForKind(kind: 'video' | 'model' | 'standard'): number {
    if (kind === 'video') return VIDEO_UPLOAD_LIMIT_BYTES;
    if (kind === 'model') return MODEL_UPLOAD_LIMIT_BYTES;
    return STANDARD_UPLOAD_LIMIT_BYTES;
}

function uploadLimitLabel(bytes: number): string {
    return `${Math.floor(bytes / (1024 * 1024))}MB`;
}

function uploadMediaType(file: File, kind: 'video' | 'model' | 'standard'): 'image' | 'video' | 'audio' | 'document' | 'other' {
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
        const storeId = bodyStoreId || selectedStoreId;

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

        // Generate unique path
        const ext = safeFileExtension(file.name);
        // Use the full UUID (122 bits) rather than an 8-char slice (~32 bits) to
        // eliminate any theoretical brute-force enumeration of CDN URLs within a
        // specific store + millisecond window.
        const key = `public-media/${folder}/${auth.user.id}/${Date.now()}-${crypto.randomUUID().replace(/-/g, '')}.${ext}`;

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

        await c.env.R2_BUCKET.put(key, file.stream(), {
            httpMetadata: { contentType: file.type },
            customMetadata: {
                visibility: 'public',
                delivery: 'letbuyy-public-v1',
                owner_id: auth.user.id,
                ...(storeId ? { store_id: storeId } : {}),
                folder,
                original_name: file.name.slice(0, 160),
                media_type: mediaType,
            },
        });

        // Return the registered public-media delivery URL on this Worker.
        const publicUrl = `${assetBaseUrl}/${key}`;

        return c.json({
            data: {
                url: publicUrl,
                key,
                size: file.size,
                content_type: file.type,
                media_type: mediaType,
                storage: 'r2',
                cdn_configured: false,
                store_id: storeId || null,
            },
        }, 201);
    } catch (err) {
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
