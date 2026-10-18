import { z } from 'zod';

const uuid = z.string().uuid().transform((value) => value.toLowerCase());

/** Untrusted merchant selection/text only. Scope, content proof and approval are never caller fields. */
export const ReelReviewSubmissionSchema = z.object({
  media_asset_id: uuid,
  listing_id: uuid,
  variant_id: uuid.nullable(),
  thumbnail_asset_id: uuid,
  caption: z.string(),
  rights_evidence_ids: z.array(uuid),
}).strict().superRefine((input, ctx) => {
  if (new Set(input.rights_evidence_ids).size !== input.rights_evidence_ids.length) {
    ctx.addIssue({ code: 'custom', path: ['rights_evidence_ids'], message: 'Duplicate rights evidence' });
  }
});

export type ReelReviewSubmission = z.infer<typeof ReelReviewSubmissionSchema>;

// Technical HTTP intake budgets, not legal/rights or provider upload policy.
export const REEL_REVIEW_REQUEST_BYTES = 32768;
export const ReelDraftSelectionSchema = z.object({
  media_asset_id: uuid.nullable(), listing_id: uuid.nullable(), variant_id: uuid.nullable(),
  thumbnail_asset_id: uuid.nullable(), caption: z.string().max(4000),
  rights_evidence_ids: z.array(uuid).max(20),
}).strict().superRefine((value, ctx) => {
  if (new Set(value.rights_evidence_ids).size !== value.rights_evidence_ids.length) {
    ctx.addIssue({ code: 'custom', message: 'Duplicate rights evidence' });
  }
});
const commandBase = {
  expected_version: z.number().int().min(0).max(999999999),
  idempotency_key: z.string().min(8).max(200).regex(/^[^\s\x00-\x1f]+$/),
};
export const ReelMerchantCommandSchema = z.object({
  ...commandBase, action: z.enum(['save', 'submit']), selection: ReelDraftSelectionSchema,
}).strict().superRefine((value, ctx) => {
  if (value.action === 'submit' && !ReelReviewSubmissionSchema.safeParse(value.selection).success) {
    ctx.addIssue({ code: 'custom', message: 'Select owned media, a listing and thumbnail before submitting.' });
  }
});
export const ReelReviewerCommandSchema = z.object({
  ...commandBase, action: z.enum(['claim', 'reject', 'approve', 'take_down']), reason: z.string().max(1000).optional(),
}).strict().superRefine((value, ctx) => {
  if (['reject', 'take_down'].includes(value.action) && (value.reason?.trim().length ?? 0) < 8) {
    ctx.addIssue({ code: 'custom', message: 'Enter an actionable reason of at least eight characters.' });
  }
});
export type ReelMerchantCommand = z.infer<typeof ReelMerchantCommandSchema>;
export type ReelReviewerCommand = z.infer<typeof ReelReviewerCommandSchema>;
export type ReelDraftSelection = z.infer<typeof ReelDraftSelectionSchema>;
export interface ReelSummary {
  id: string; site_id: string; version: number; status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'delisted';
  assigned_reviewer_id: string | null; current_revision_id: string | null; updated_at: string;
}
export interface ReelReadback {
  reel: ReelSummary;
  revision: { id: string; version: number; selection: ReelDraftSelection; payload: ReelReviewPayload | null; fingerprint: string | null };
  events: Array<{ id: string; revision_id: string; actor_id: string; actor_realm: string; action: string; reason: string | null; created_at: string }>;
  custody_available: boolean; inspection_available: boolean; replayed?: boolean;
}
export interface ReelReferenceOptions {
  listings: Array<{ id: string; name: string; variants: Array<{ id: string; title: string }> }>;
  media: Array<{ id: string; label: string }>; thumbnails: Array<{ id: string; label: string }>;
  rights: Array<{ id: string; label: string }>;
}
export interface ReelReviewPage { items: ReelSummary[]; page: number; page_size: number; has_more: boolean; custody_available: boolean; inspection_available: boolean; references?: ReelReferenceOptions }

/** Immutable serialized review content; it conveys no approval or media-access authority. */
export type ReelReviewPayload = Readonly<{
  schema_version: 1;
  site_id: string;
  media: Readonly<{ asset_id: string; version: string; checksum_sha256: string; processing_evidence_id: string; provider_asset_id: string }>;
  product: Readonly<{ listing_id: string; product_id: string; variant_id: string | null; approved_product_fingerprint: string }>;
  caption: string;
  thumbnail: Readonly<{ asset_id: string; version: string; checksum_sha256: string }>;
  rights_evidence: readonly Readonly<{ evidence_id: string; version: string; checksum_sha256: string }>[];
}>;
