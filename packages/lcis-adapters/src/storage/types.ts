/**
 * Cloudflare R2 API response types — normalised shapes from the Cloudflare REST API.
 * All fields are read-only and schema-validated with Zod before use.
 * Values observed from source of truth; none are fabricated by LCIS.
 *
 * READ-ONLY: no mutation primitives exist in this file.
 */
import { z } from 'zod';
import type { LiveFact } from '../shared/contracts';

// ---------------------------------------------------------------------------
// Bucket list schema
// The R2 API may return result as an object with a buckets array, or (in some
// versions) result directly as an array. Both shapes are tolerated.
// ---------------------------------------------------------------------------

export const R2BucketSchema = z.object({
  name: z.string(),
  creation_date: z.string().optional(),
  /** R2 location hint, e.g. "WNAM", "ENAM", "WEUR", "EEUR", "APAC". Optional — not always present. */
  location: z.string().optional(),
});
export type R2Bucket = z.infer<typeof R2BucketSchema>;

/** Shape when result contains a buckets array */
const R2BucketListResultObjectSchema = z.object({
  buckets: z.array(R2BucketSchema),
});

/** Cloudflare envelope: result may be an object with `buckets` or the array directly */
export const R2BucketListResponseSchema = z.object({
  success: z.boolean(),
  result: z.union([
    R2BucketListResultObjectSchema,
    z.array(R2BucketSchema),
  ]),
  errors: z.array(z.object({ code: z.number().optional(), message: z.string() })).optional(),
  messages: z.array(z.string()).optional(),
});
export type R2BucketListResponse = z.infer<typeof R2BucketListResponseSchema>;

// ---------------------------------------------------------------------------
// Per-bucket detail schema (loose — R2 bucket detail endpoint may vary)
// ---------------------------------------------------------------------------

export const R2BucketDetailSchema = z.object({
  name: z.string(),
  creation_date: z.string().optional(),
  location: z.string().optional(),
  /** Any other fields the API may return — captured for honesty. */
}).passthrough();
export type R2BucketDetail = z.infer<typeof R2BucketDetailSchema>;

export const R2BucketDetailResponseSchema = z.object({
  success: z.boolean(),
  result: R2BucketDetailSchema,
  errors: z.array(z.object({ code: z.number().optional(), message: z.string() })).optional(),
  messages: z.array(z.string()).optional(),
});
export type R2BucketDetailResponse = z.infer<typeof R2BucketDetailResponseSchema>;

// ---------------------------------------------------------------------------
// Normalised gathered payload
// ---------------------------------------------------------------------------

export interface R2BucketEntry {
  /** Bucket name as returned by the API. */
  readonly name: string;
  /** ISO creation date string if available, null otherwise. */
  readonly creationDate: string | null;
  /** Location hint if the API returned one, null otherwise. */
  readonly location: string | null;
  /**
   * Whether the per-bucket detail fetch succeeded.
   * False means detail is partial — evidence will say why.
   */
  readonly detailFetched: boolean;
}

export interface StoragePayload {
  /** All R2 buckets observed from the account bucket list. */
  readonly buckets: readonly R2BucketEntry[];
  /**
   * Total count as reported at list time.
   * Object counts/sizes: NOT CONNECTED — R2 usage metrics require GraphQL Analytics (POST-only, not available via read-only GET adapter).
   */
  readonly bucketCount: number;
  /** Normalised LiveFacts for CorrelationEngine consumption. */
  readonly facts: readonly LiveFact[];
}
