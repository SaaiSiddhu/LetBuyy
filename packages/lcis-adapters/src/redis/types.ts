/**
 * Redis (Upstash REST) API response types — normalised shapes from the Upstash REST API.
 * All fields are read-only and schema-validated with Zod before use.
 * Values observed from source of truth; none are fabricated by LCIS.
 *
 * READ-ONLY: no mutation primitives exist in this file.
 */
import { z } from 'zod';
import type { LiveFact } from '../shared/contracts';

// ---------------------------------------------------------------------------
// Probe (PING) response schema
// ---------------------------------------------------------------------------

export const RedisCommandResponseSchema = z.object({
  result: z.unknown(),
});
export type RedisCommandResponse = z.infer<typeof RedisCommandResponseSchema>;

export const RedisPingResponseSchema = z.object({
  result: z.string(),
});
export type RedisPingResponse = z.infer<typeof RedisPingResponseSchema>;

// ---------------------------------------------------------------------------
// DBSIZE response schema
// ---------------------------------------------------------------------------

export const RedisDbSizeResponseSchema = z.object({
  result: z.number().int().nonnegative(),
});
export type RedisDbSizeResponse = z.infer<typeof RedisDbSizeResponseSchema>;

// ---------------------------------------------------------------------------
// Normalised gathered payload
// ---------------------------------------------------------------------------

export interface RedisPayload {
  /** Total number of keys in the database as reported by DBSIZE. */
  readonly dbSize: number;
  /** Normalised LiveFacts for CorrelationEngine consumption. */
  readonly facts: readonly LiveFact[];
  /**
   * Memory usage and hit-ratio stats: NOT CONNECTED — the INFO command is not
   * in the allowlist because its response is unbounded free-text that cannot be
   * safely or deterministically parsed. Set UPSTASH_REDIS_REST_URL and
   * UPSTASH_REDIS_REST_TOKEN; even then, INFO requires a separate POST-based
   * command path that this read-only adapter does not expose.
   */
  readonly memoryNotConnected: string;
}
