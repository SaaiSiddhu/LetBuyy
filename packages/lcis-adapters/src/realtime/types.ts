/**
 * Supabase Realtime API response types — normalised shapes from the Realtime health endpoint.
 * All fields are read-only and schema-validated with Zod before use.
 * Values observed from source of truth; none are fabricated by LCIS.
 *
 * Channel/connection counts: NOT CONNECTED — no GET metrics endpoint is available
 * on the Supabase Realtime API without a separate management credential. LCIS maps
 * the topology and the exact source but does not fabricate counts.
 *
 * READ-ONLY: no mutation primitives exist in this file.
 */
import { z } from 'zod';
import type { LiveFact } from '../shared/contracts';

// ---------------------------------------------------------------------------
// Health response schema
// The Supabase Realtime health endpoint returns either:
//   { status: "ok" }
// or a bare string like "ok" / "healthy"
// We use a zod union to tolerate both.
// ---------------------------------------------------------------------------

export const RealtimeHealthObjectSchema = z.object({
  status: z.string(),
});
export type RealtimeHealthObject = z.infer<typeof RealtimeHealthObjectSchema>;

export const RealtimeHealthSchema = z.union([
  RealtimeHealthObjectSchema,
  z.string(),
]);
export type RealtimeHealth = z.infer<typeof RealtimeHealthSchema>;

// ---------------------------------------------------------------------------
// Normalised gathered payload
// ---------------------------------------------------------------------------

export interface RealtimePayload {
  /**
   * The parsed status string extracted from the health response.
   * e.g. "ok", "healthy", "up", or whatever the provider returned.
   * null when the health endpoint returned a shape we could not extract a status from.
   */
  readonly parsedStatus: string | null;
  /**
   * The raw health value returned by the provider (object or string).
   * Preserved verbatim for evidence citation.
   */
  readonly rawHealth: RealtimeHealth;
  /**
   * Channel / connection counts: NOT CONNECTED — no GET metrics endpoint
   * is publicly available on the Supabase Realtime API without a separate
   * management token. LCIS maps the topology but cannot fabricate these values.
   */
  readonly channelCountsNotConnected: 'NOT CONNECTED — no GET metrics endpoint available on Supabase Realtime API';
  /** Normalised LiveFacts for CorrelationEngine consumption. */
  readonly facts: readonly LiveFact[];
}
