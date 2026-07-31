/**
 * Cloudflare Analytics Engine adapter types — normalised shapes from the Cloudflare REST API.
 * All fields are read-only and schema-validated with Zod before use.
 * Values observed from source of truth; none are fabricated by LCIS.
 *
 * READ-ONLY: no mutation primitives exist in this file.
 *
 * HONESTY: Analytics Engine query VALUES (row counts, events, metrics) are structurally
 * unreachable from this adapter. The AE SQL API (POST /accounts/{acct}/analytics_engine/sql)
 * is POST-only and the LCAS boundary is GET-only. Values remain NOT CONNECTED citing
 * 'Analytics Engine SQL API (POST /analytics_engine/sql)' as the exact source.
 */
import { z } from 'zod';
import type { LiveFact } from '../shared/contracts';

// ---------------------------------------------------------------------------
// Workers scripts list schema (probe + gather entrypoint)
// ---------------------------------------------------------------------------

export const WorkerScriptSchema = z.object({
  id: z.string(),
  etag: z.string().optional(),
  handlers: z.array(z.string()).optional(),
  modified_on: z.string().optional(),
  created_on: z.string().optional(),
  usage_model: z.string().optional(),
  tail_consumers: z.array(z.unknown()).optional(),
});
export type WorkerScript = z.infer<typeof WorkerScriptSchema>;

export const WorkerScriptsResponseSchema = z.object({
  success: z.boolean(),
  result: z.array(WorkerScriptSchema),
  errors: z.array(z.unknown()).optional(),
  messages: z.array(z.unknown()).optional(),
});
export type WorkerScriptsResponse = z.infer<typeof WorkerScriptsResponseSchema>;

// ---------------------------------------------------------------------------
// Worker script settings (bindings, including analytics_engine bindings)
// ---------------------------------------------------------------------------

/** Loose binding schema — only the fields we care about are required. */
export const WorkerBindingSchema = z.object({
  type: z.string(),
  name: z.string(),
  dataset: z.string().optional(),
}).passthrough();
export type WorkerBinding = z.infer<typeof WorkerBindingSchema>;

/**
 * Loose settings schema — we tolerate extra/unknown fields in the settings
 * object so that CF API additions don't break the adapter.
 */
export const WorkerScriptSettingsSchema = z.object({
  result: z.object({
    bindings: z.array(WorkerBindingSchema).optional(),
  }).passthrough().optional(),
  success: z.boolean().optional(),
  errors: z.array(z.unknown()).optional(),
}).passthrough();
export type WorkerScriptSettings = z.infer<typeof WorkerScriptSettingsSchema>;

// ---------------------------------------------------------------------------
// Normalised gathered payload
// ---------------------------------------------------------------------------

/** One Analytics Engine dataset with the scripts that bind to it. */
export interface AEDatasetRecord {
  /** The AE dataset name (from the binding.dataset field). */
  readonly dataset: string;
  /** Script IDs that declare an analytics_engine binding to this dataset. */
  readonly boundScripts: readonly string[];
  /** Binding names across all scripts that point to this dataset. */
  readonly bindingNames: readonly string[];
}

/** One raw analytics_engine binding observed on a script. */
export interface AEBindingRecord {
  readonly scriptId: string;
  readonly bindingName: string;
  readonly dataset: string;
}

export interface AnalyticsEnginePayload {
  /** All Worker script IDs observed from /workers/scripts. */
  readonly scriptIds: readonly string[];
  /**
   * Per-script settings fetch outcome.
   * status 'ok' | 'error' — error detail is honest/evidence-cited; no fabrication.
   */
  readonly scriptStatuses: readonly { scriptId: string; status: 'ok' | 'error'; detail: string }[];
  /** All AE bindings found across all scripts. */
  readonly aeBindings: readonly AEBindingRecord[];
  /** AE datasets de-duplicated with the list of scripts that bind to each. */
  readonly aeDatasets: readonly AEDatasetRecord[];
  /** Normalised LiveFacts for CorrelationEngine consumption. */
  readonly facts: readonly LiveFact[];
}
