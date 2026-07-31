/**
 * Cloudflare API response types — used only for parsing/validating the
 * {result, success, errors} envelope returned by api.cloudflare.com.
 * All shapes are read-only; no write surfaces exist.
 */
import { z } from 'zod';

// ── Shared envelope ──────────────────────────────────────────────────────────

export const CloudflareErrorSchema = z.object({
  code: z.number(),
  message: z.string(),
});

export function cfEnvelope<T extends z.ZodTypeAny>(resultSchema: T) {
  return z.object({
    success: z.boolean(),
    errors: z.array(CloudflareErrorSchema),
    result: resultSchema.nullable().optional(),
  });
}

// ── Workers scripts ──────────────────────────────────────────────────────────

export const WorkerScriptSchema = z.object({
  id: z.string(),
  etag: z.string().optional(),
  handlers: z.array(z.string()).optional(),
  created_on: z.string().optional(),
  modified_on: z.string().optional(),
});

export const WorkersListSchema = cfEnvelope(z.array(WorkerScriptSchema));
export type WorkerScript = z.infer<typeof WorkerScriptSchema>;
export type WorkersListEnvelope = z.infer<typeof WorkersListSchema>;

// ── Workers routes ────────────────────────────────────────────────────────────

export const WorkerRouteSchema = z.object({
  id: z.string(),
  pattern: z.string(),
  script: z.string().nullable().optional(),
});

export const RoutesListSchema = cfEnvelope(z.array(WorkerRouteSchema));
export type WorkerRoute = z.infer<typeof WorkerRouteSchema>;
export type RoutesListEnvelope = z.infer<typeof RoutesListSchema>;

// ── Queues ────────────────────────────────────────────────────────────────────

export const QueueSchema = z.object({
  queue_id: z.string(),
  queue_name: z.string(),
  created_on: z.string().optional(),
  producers_total: z.number().optional(),
  consumers_total: z.number().optional(),
  // Backlog / message count is NOT available via the list endpoint.
  // Queue metrics require a separate analytics API; honesty: NOT CONNECTED.
});

export const QueuesListSchema = cfEnvelope(z.array(QueueSchema));
export type Queue = z.infer<typeof QueueSchema>;
export type QueuesListEnvelope = z.infer<typeof QueuesListSchema>;

// ── KV namespaces ─────────────────────────────────────────────────────────────

export const KVNamespaceSchema = z.object({
  id: z.string(),
  title: z.string(),
  supports_url_encoding: z.boolean().optional(),
});

export const KVListSchema = cfEnvelope(z.array(KVNamespaceSchema));
export type KVNamespace = z.infer<typeof KVNamespaceSchema>;
export type KVListEnvelope = z.infer<typeof KVListSchema>;

// ── R2 buckets ────────────────────────────────────────────────────────────────

export const R2BucketSchema = z.object({
  name: z.string(),
  creation_date: z.string().optional(),
});

export const R2ListSchema = cfEnvelope(z.array(R2BucketSchema));
export type R2Bucket = z.infer<typeof R2BucketSchema>;
export type R2ListEnvelope = z.infer<typeof R2ListSchema>;

// ── Token verification ────────────────────────────────────────────────────────

export const TokenVerifySchema = cfEnvelope(
  z.object({
    id: z.string(),
    status: z.string(),
  }),
);
export type TokenVerifyEnvelope = z.infer<typeof TokenVerifySchema>;

// ── Gathered payload ──────────────────────────────────────────────────────────

export interface CloudflarePayload {
  /** Normalised worker scripts (name = script id). */
  readonly workers: readonly WorkerScript[];
  /** Normalised worker routes across all zones. */
  readonly routes: readonly WorkerRoute[];
  /** Queues (inventory only; metrics NOT CONNECTED via standard list API). */
  readonly queues: readonly Queue[];
  /** KV namespaces (inventory). */
  readonly kv: readonly KVNamespace[];
  /** R2 buckets (inventory). */
  readonly r2: readonly R2Bucket[];
}
