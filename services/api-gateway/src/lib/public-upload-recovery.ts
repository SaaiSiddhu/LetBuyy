import { z } from 'zod';
import { safeUploadFolder, safeFileExtension } from './upload-mime';
export const PUBLIC_UPLOAD_RESOURCE = 'public_upload_pending';
export const PublicUploadProgressSchema = z.object({ upload_progress: z.object({
    version: z.literal(1), object_id: z.string().uuid(), actor_id: z.string().min(1).max(200),
}).strict() }).strict();
export type PublicUploadProgress = z.infer<typeof PublicUploadProgressSchema>['upload_progress'];
export function allocatedUploadKey(progress: PublicUploadProgress, folder: string, filename: string): string {
    return `public-media/${safeUploadFolder(folder)}/${progress.actor_id}/${progress.object_id.replace(/-/g, '')}.${safeFileExtension(filename)}`;
}
export function uploadObjectMatches(object: R2Object | null, input: {
    key: string; siteId: string; size: number; contentType: string;
    receiptId?: string; actorId?: string; sha256?: string;
}): boolean {
    const metadata = object?.customMetadata;
    return Boolean(object && object.key === input.key && object.size === input.size
        && object.httpMetadata?.contentType === input.contentType
        && metadata?.store_id === input.siteId && metadata?.visibility === 'public'
        && metadata?.delivery === 'letbuyy-public-v1'
        && (!input.receiptId || metadata?.upload_receipt_id === input.receiptId)
        && (!input.actorId || metadata?.owner_id === input.actorId)
        && (!input.sha256 || metadata?.upload_sha256 === input.sha256));
}

export function storedUploadResponse(base: string, key: string, input: {
    size: number; contentType: string; mediaType: 'image' | 'video' | 'audio' | 'document' | 'other'; storeId: string;
}) {
    return { data: { url: `${base}/${key}`, key, size: input.size, content_type: input.contentType,
        media_type: input.mediaType, storage: 'r2', cdn_configured: false, store_id: input.storeId } };
}
