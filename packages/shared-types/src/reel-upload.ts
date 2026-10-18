import { z } from 'zod';

/** Technical metadata parser ceiling, not an approved upload/retention policy. */
export const REEL_UPLOAD_METADATA_BYTES = 8192;
export const ReelUploadStateSchema = z.enum(['reserved', 'receiving', 'transfer_unknown', 'received_unprocessed', 'expired']);
export const ReelUploadMimeSchema = z.enum(['video/mp4', 'video/webm']);
export const ReelUploadRequestKeySchema = z.string().min(8).max(200).regex(/^[^\s\x00-\x1f\x7f]+$/);
export const ReelUploadBeginSchema = z.object({
  idempotency_key: ReelUploadRequestKeySchema,
  filename: z.string().trim().min(1).max(180).regex(/^[^\x00-\x1f\x7f]+$/),
  content_type: ReelUploadMimeSchema,
  size_bytes: z.number().int().min(16).max(Number.MAX_SAFE_INTEGER),
  checksum_sha256: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
export const ReelUploadRetrySchema = z.object({
  idempotency_key: ReelUploadRequestKeySchema,
  expected_version: z.number().int().positive().max(999999999),
}).strict();
export const ReelUploadReadbackSchema = z.object({
  id: z.string().uuid(), site_id: z.string().uuid(), state: ReelUploadStateSchema,
  version: z.number().int().positive(), filename: z.string(), content_type: ReelUploadMimeSchema,
  size_bytes: z.number().int().positive(), checksum_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  idempotency_key: ReelUploadRequestKeySchema,
  expires_at: z.string(), created_at: z.string(), updated_at: z.string(),
  media_asset_id: z.string().uuid().nullable(), provenance_id: z.string().uuid().nullable(),
  processing_available: z.literal(false), inspection_available: z.literal(false), replayed: z.boolean(),
}).strict();
export const ReelUploadCapabilitiesSchema = z.object({
  private_upload_enabled: z.boolean(), processing_enabled: z.literal(false), inspection_enabled: z.literal(false),
  max_bytes: z.number().int().positive().nullable(), accepted_types: z.array(ReelUploadMimeSchema),
}).strict();
export type ReelUploadBegin = z.infer<typeof ReelUploadBeginSchema>;
export type ReelUploadRetry = z.infer<typeof ReelUploadRetrySchema>;
export type ReelUploadReadback = z.infer<typeof ReelUploadReadbackSchema>;
export type ReelUploadCapabilities = z.infer<typeof ReelUploadCapabilitiesSchema>;
