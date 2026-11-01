export interface StorageObjectDescriptor {
  provider: 'r2' | 's3' | 'supabase-storage' | 'local';
  bucket: string;
  key: string;
  contentType?: string;
  sizeBytes?: number;
  checksum?: string;
}

export interface StorageAdapterPort {
  putObject(descriptor: StorageObjectDescriptor, body: ArrayBuffer | Uint8Array | ReadableStream): Promise<StorageObjectDescriptor>;
  getSignedUrl(descriptor: StorageObjectDescriptor, expiresInSeconds: number): Promise<string>;
  deleteObject(descriptor: StorageObjectDescriptor): Promise<void>;
}

export type MediaAssetType = 'image' | 'video' | 'file' | 'font' | 'icon';

export interface SignedR2UploadIntentInput {
  siteId: string;
  intentId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  folder?: string | null;
  publicBaseUrl?: string | null;
  uploadPath?: string | null;
  expiresInSeconds?: number | null;
}

export interface SignedR2UploadIntent {
  provider: 'r2';
  bucket: 'LETBUYY_MEDIA';
  siteId: string;
  intentId: string;
  objectKey: string;
  assetType: MediaAssetType;
  filename: string;
  contentType: string;
  sizeBytes: number;
  publicUrl: string | null;
  uploadUrl: string;
  expiresAt: string;
  headers: Record<string, string>;
  metadata: Record<string, string>;
}

function safePathPart(value: string, fallback: string): string {
  const cleaned = value
    .trim()
    .replace(/[^a-zA-Z0-9._/-]/g, '-')
    .replace(/\/+/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .slice(0, 160);
  return cleaned || fallback;
}

function safeFilename(value: string): string {
  return safePathPart(value, 'asset.bin').replace(/\//g, '-');
}

export function mediaAssetTypeForContent(input: { contentType?: string | null; filename?: string | null }): MediaAssetType {
  const contentType = (input.contentType || '').toLowerCase();
  const filename = (input.filename || '').toLowerCase();
  if (contentType.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg|avif)$/.test(filename)) return 'image';
  if (contentType.startsWith('video/') || /\.(mp4|mov|m4v|webm)$/.test(filename)) return 'video';
  if (contentType.includes('font') || /\.(woff2?|ttf|otf)$/.test(filename)) return 'font';
  if (/\.(ico)$/.test(filename)) return 'icon';
  return 'file';
}

export function planSignedR2UploadIntent(input: SignedR2UploadIntentInput): SignedR2UploadIntent {
  const expiresInSeconds = Math.min(Math.max(Math.trunc(Number(input.expiresInSeconds || 900)), 60), 3600);
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
  const folder = safePathPart(input.folder || 'media', 'media');
  const filename = safeFilename(input.filename);
  const objectKey = `${folder}/${input.siteId}/${input.intentId}-${filename}`;
  const publicBaseUrl = input.publicBaseUrl?.trim().replace(/\/+$/, '') || null;
  const uploadPath = input.uploadPath?.trim() || '/v1/upload';

  return {
    provider: 'r2',
    bucket: 'LETBUYY_MEDIA',
    siteId: input.siteId,
    intentId: input.intentId,
    objectKey,
    assetType: mediaAssetTypeForContent({ contentType: input.contentType, filename }),
    filename,
    contentType: input.contentType || 'application/octet-stream',
    sizeBytes: Math.max(0, Math.trunc(Number(input.sizeBytes || 0))),
    publicUrl: publicBaseUrl ? `${publicBaseUrl}/${objectKey}` : null,
    uploadUrl: uploadPath,
    expiresAt,
    headers: {
      'x-letbuyy-site-id': input.siteId,
      'x-letbuyy-object-key': objectKey,
    },
    metadata: {
      site_id: input.siteId,
      object_key: objectKey,
      intent_id: input.intentId,
    },
  };
}

export { transferPrivateOriginal, inspectPrivateOriginal, originalKey, privateOriginalRuntimeAvailable,
  type OriginalIntent as PrivateReelOriginalIntent, type TransferBudget as PrivateReelTransferBudget,
  type VerifiedOriginal as VerifiedPrivateReelOriginal, type PrivateR2Binding } from './reel-private-r2';

export { signKycIndiaS3Post, type KycIndiaS3PostInput, type KycIndiaS3Post,
  type KycIndiaContentType } from './kyc-india-s3-post';
export { verifyKycIndiaS3Head, type KycIndiaS3HeadExpectation,
  type KycIndiaS3VerifiedObject } from './kyc-india-s3-head';
export { headKycIndiaS3Object, type KycIndiaS3HeadRequest } from './kyc-india-s3-head-request';
export { assumeKycIndiaUploadRole, kycIndiaUploadSessionPolicy,
  type KycIndiaUploadRoleInput, type KycIndiaUploadCredentials } from './kyc-india-s3-sts';
export { parseKycIndiaGuardDutyEvent, type KycIndiaGuardDutyExpectation,
  type KycIndiaScanResult } from './kyc-india-guardduty-event';
