/**
 * Cloudflare Cron Triggers API response types.
 * All fields are read-only and Zod-validated before use.
 * Values observed from source of truth; none are fabricated by LCIS.
 *
 * READ-ONLY: no mutation primitives exist in this file.
 */
import { z } from 'zod';
import type { LiveFact } from '../shared/contracts';

// ---------------------------------------------------------------------------
// Scripts list schema — GET /accounts/{acct}/workers/scripts
// ---------------------------------------------------------------------------

export const CfWorkerScriptSchema = z.object({
  id: z.string(),
  /** etag / hash is optional */
  etag: z.string().optional(),
  /** ISO timestamp or epoch seconds */
  created_on: z.string().optional(),
  modified_on: z.string().optional(),
  deployment_id: z.string().optional(),
});
export type CfWorkerScript = z.infer<typeof CfWorkerScriptSchema>;

export const CfScriptsResponseSchema = z.object({
  success: z.boolean(),
  result: z.array(CfWorkerScriptSchema),
  errors: z.array(z.unknown()).optional(),
  messages: z.array(z.unknown()).optional(),
});
export type CfScriptsResponse = z.infer<typeof CfScriptsResponseSchema>;

// ---------------------------------------------------------------------------
// Schedules per script — GET /accounts/{acct}/workers/scripts/{name}/schedules
// Cloudflare returns either:
//   { success, result: { schedules: [...] } }
// or (older format):
//   { success, result: [...] }
// Both are tolerated.
// ---------------------------------------------------------------------------

export const CfScheduleEntrySchema = z.object({
  cron: z.string(),
  created_on: z.string().optional(),
  modified_on: z.string().optional(),
});
export type CfScheduleEntry = z.infer<typeof CfScheduleEntrySchema>;

/**
 * The inner result shape — object with .schedules array, or array directly.
 */
export const CfScheduleResultSchema = z.union([
  z.object({ schedules: z.array(CfScheduleEntrySchema) }),
  z.array(CfScheduleEntrySchema),
]);
export type CfScheduleResult = z.infer<typeof CfScheduleResultSchema>;

export const CfSchedulesResponseSchema = z.object({
  success: z.boolean(),
  result: CfScheduleResultSchema,
  errors: z.array(z.unknown()).optional(),
  messages: z.array(z.unknown()).optional(),
});
export type CfSchedulesResponse = z.infer<typeof CfSchedulesResponseSchema>;

// ---------------------------------------------------------------------------
// Normalised payload
// ---------------------------------------------------------------------------

export interface CronScriptSchedules {
  /** Worker script name (the `id` field from the scripts list). */
  readonly scriptName: string;
  readonly schedules: readonly CfScheduleEntry[];
  /** True when the per-script schedule fetch succeeded; false when it errored. */
  readonly fetched: boolean;
  /** Reason the fetch failed (only set when fetched=false). */
  readonly fetchError?: string;
}

export interface CronPayload {
  /** All observed Worker scripts. */
  readonly scripts: readonly CfWorkerScript[];
  /** Schedules per script, keyed by script name. */
  readonly schedulesByScript: ReadonlyArray<CronScriptSchedules>;
  /** Flat list of all schedules across all scripts. */
  readonly allSchedules: ReadonlyArray<{ readonly scriptName: string; readonly cron: string; readonly at: string | null }>;
  /** Normalised LiveFacts for CorrelationEngine consumption. */
  readonly facts: readonly LiveFact[];
}
