import { z } from 'zod';
import { ReelReviewSubmissionSchema, type ReelReviewPayload } from '@letbuyy/shared-types';
export {
  REEL_REVIEW_REQUEST_BYTES, ReelReviewSubmissionSchema, ReelDraftSelectionSchema, ReelMerchantCommandSchema, ReelReviewerCommandSchema,
  type ReelReviewSubmission, type ReelDraftSelection, type ReelMerchantCommand, type ReelReviewerCommand,
  type ReelSummary, type ReelReadback, type ReelReferenceOptions, type ReelReviewPage, type ReelReviewPayload,
} from '@letbuyy/shared-types';


const uuid = z.string().uuid().transform((value) => value.toLowerCase());
const sha256 = z.string().regex(/^[a-f0-9]{64}$/, 'Expected an exact SHA-256 fingerprint');
// Opaque, immutable provider/storage version, never a URL or a playback credential.
const version = z.string().min(1).max(200).regex(/^[A-Za-z0-9._:-]+$/);
const providerAssetId = z.string().min(1).max(200).regex(/^[A-Za-z0-9_-]+$/, 'Expected an opaque provider asset ID');

const assetSchema = z.object({
  id: uuid,
  site_id: uuid,
  asset_type: z.enum(['video', 'image']),
  version,
  checksum_sha256: sha256,
  access: z.enum(['private', 'public']),
  deleted: z.boolean(),
}).strict();

// This is a server integration contract, not an HTTP schema. In particular, a generic
// media_assets.processing_status='processed' registration cannot supply this evidence.
const serverContextSchema = z.object({
  site: z.object({ id: uuid, status: z.string(), deleted: z.boolean() }).strict(),
  media: assetSchema.extend({ provider_asset_id: providerAssetId }),
  processing_evidence: z.object({
    id: uuid,
    site_id: uuid,
    media_asset_id: uuid,
    media_version: version,
    checksum_sha256: sha256,
    provider_asset_id: providerAssetId,
    state: z.enum(['pending', 'processing', 'ready', 'failed', 'deleted']),
  }).strict(),
  thumbnail: assetSchema,
  product: z.object({ id: uuid, site_id: uuid, is_active: z.boolean(), deleted: z.boolean() }).strict(),
  listing: z.object({
    id: uuid,
    site_id: uuid,
    product_id: uuid,
    channel: z.string(),
    status: z.string(),
    visibility: z.string(),
    approved_product_fingerprint: sha256.nullable(),
    // Exact output of marketplace_listing_review_fingerprint(uuid) in the same transaction.
    current_product_fingerprint: sha256.nullable(),
  }).strict(),
  // Complete current relational product_variants set, not products.variants or client options.
  variants: z.array(z.object({ id: uuid, product_id: uuid }).strict()),
  rights_evidence: z.array(z.object({
    id: uuid, site_id: uuid, version, checksum_sha256: sha256, deleted: z.boolean(),
  }).strict()),
}).strict();

/**
 * Supplied ONLY by the server after authenticated merchant/staff scope resolution and
 * authorized canonical reads. The server must resolve all rows under one transaction,
 * including the SQL fingerprint and verified private processing evidence. This library
 * validates consistency; it does not authenticate rows, check permissions, query storage,
 * establish rights policy or replace database locking/revalidation at submit/decision time.
 */
export type ServerResolvedReelReviewContext = z.input<typeof serverContextSchema>;

export type ReelReviewBindingErrorCode =
  | 'REEL_SCOPE_MISMATCH'
  | 'REEL_MEDIA_UNAVAILABLE'
  | 'REEL_PROCESSING_UNVERIFIED'
  | 'REEL_THUMBNAIL_UNAVAILABLE'
  | 'REEL_LISTING_UNAVAILABLE'
  | 'REEL_PRODUCT_REVISION_STALE'
  | 'REEL_VARIANT_MISMATCH'
  | 'REEL_RIGHTS_EVIDENCE_UNAVAILABLE';

export class ReelReviewBindingError extends Error {
  constructor(public readonly code: ReelReviewBindingErrorCode) {
    super(code);
    this.name = 'ReelReviewBindingError';
  }
}

function requireBinding(condition: boolean, code: ReelReviewBindingErrorCode): asserts condition {
  if (!condition) throw new ReelReviewBindingError(code);
}

/** Builds review CONTENT, with no approval/publication state or provider credentials. */
export function buildReelReviewPayload(
  submission: unknown,
  serverResolved: ServerResolvedReelReviewContext,
) {
  const request = ReelReviewSubmissionSchema.parse(submission);
  const resolved = serverContextSchema.parse(serverResolved);
  const { site, media, processing_evidence: processing, thumbnail, product, listing } = resolved;

  requireBinding(
    [media.site_id, processing.site_id, thumbnail.site_id, product.site_id, listing.site_id]
      .every((siteId) => siteId === site.id),
    'REEL_SCOPE_MISMATCH',
  );
  requireBinding(
    request.media_asset_id === media.id && media.asset_type === 'video'
      && media.access === 'private' && !media.deleted,
    'REEL_MEDIA_UNAVAILABLE',
  );
  requireBinding(
    processing.state === 'ready' && processing.media_asset_id === media.id
      && processing.provider_asset_id === media.provider_asset_id
      && processing.media_version === media.version && processing.checksum_sha256 === media.checksum_sha256,
    'REEL_PROCESSING_UNVERIFIED',
  );
  requireBinding(
    request.thumbnail_asset_id === thumbnail.id && thumbnail.asset_type === 'image'
      && thumbnail.access === 'private' && !thumbnail.deleted,
    'REEL_THUMBNAIL_UNAVAILABLE',
  );
  requireBinding(
    request.listing_id === listing.id && listing.product_id === product.id
      && listing.channel === 'marketplace' && listing.status === 'approved' && listing.visibility === 'public'
      && product.is_active && !product.deleted && site.status === 'published' && !site.deleted,
    'REEL_LISTING_UNAVAILABLE',
  );
  requireBinding(
    listing.approved_product_fingerprint !== null && listing.current_product_fingerprint !== null
      && listing.approved_product_fingerprint === listing.current_product_fingerprint,
    'REEL_PRODUCT_REVISION_STALE',
  );
  requireBinding(
    new Set(resolved.variants.map((item) => item.id)).size === resolved.variants.length
      && resolved.variants.every((item) => item.product_id === product.id)
      && (request.variant_id === null
        ? resolved.variants.length === 0
        : resolved.variants.some((item) => item.id === request.variant_id)),
    'REEL_VARIANT_MISMATCH',
  );
  requireBinding(
    new Set(resolved.rights_evidence.map((item) => item.id)).size === resolved.rights_evidence.length
      && resolved.rights_evidence.length === request.rights_evidence_ids.length
      && resolved.rights_evidence.every((item) => item.site_id === site.id && !item.deleted
        && request.rights_evidence_ids.includes(item.id)),
    'REEL_RIGHTS_EVIDENCE_UNAVAILABLE',
  );

  // Fixed field order and ID-sorted set make serialization independent of DB/object order.
  // Preserve authored text byte-for-byte: trimming/Unicode normalization could hide a change.
  // Preserve the SQL fingerprint verbatim; never reserialize the SQL product snapshot here.
  return Object.freeze({
    schema_version: 1 as const,
    site_id: site.id,
    media: Object.freeze({
      asset_id: media.id, version: media.version, checksum_sha256: media.checksum_sha256,
      processing_evidence_id: processing.id, provider_asset_id: processing.provider_asset_id,
    }),
    product: Object.freeze({
      listing_id: listing.id, product_id: product.id, variant_id: request.variant_id,
      approved_product_fingerprint: listing.approved_product_fingerprint,
    }),
    caption: request.caption,
    thumbnail: Object.freeze({ asset_id: thumbnail.id, version: thumbnail.version, checksum_sha256: thumbnail.checksum_sha256 }),
    // Evidence is bound for the human review; its presence or absence is not a rights verdict.
    rights_evidence: Object.freeze(resolved.rights_evidence.slice().sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0).map((item) => Object.freeze({
      evidence_id: item.id, version: item.version, checksum_sha256: item.checksum_sha256,
    }))),
  });
}

/** Digest is revision identity only, never approval or proof of provenance. No provider I/O. */
export async function fingerprintReelReviewPayload(
  submission: unknown,
  serverResolved: ServerResolvedReelReviewContext,
): Promise<Readonly<{ payload: ReelReviewPayload; fingerprint: string }>> {
  const payload = buildReelReviewPayload(submission, serverResolved);
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const fingerprint = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return Object.freeze({ payload, fingerprint });
}
