/**
 * PostgresAdapter types — normalised shapes from the Supabase Management API.
 * All fields are read-only and schema-validated with Zod before use.
 * Values observed from source of truth; none are fabricated by LCIS.
 *
 * READ-ONLY: no mutation primitives exist in this file.
 */
import { z } from 'zod';
import type { LiveFact } from '../shared/contracts';

// ---------------------------------------------------------------------------
// Probe schema — GET /v1/projects/{ref}
// ---------------------------------------------------------------------------

/** Loose project schema: only id + name required; all other fields pass through. */
export const SupabaseProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  region: z.string().optional(),
  /** Postgres version string, e.g. "15.1.0.117". */
  db_version: z.string().optional(),
  status: z.string().optional(),
  created_at: z.string().optional(),
}).passthrough();
export type SupabaseProject = z.infer<typeof SupabaseProjectSchema>;

// ---------------------------------------------------------------------------
// Health schema — GET /v1/projects/{ref}/health?services=db
// ---------------------------------------------------------------------------

/**
 * Supabase Management API returns an array of service health objects.
 * We accept any extra fields via passthrough.
 */
export const SupabaseServiceHealthSchema = z.object({
  name: z.string(),
  status: z.string(),
}).passthrough();
export type SupabaseServiceHealth = z.infer<typeof SupabaseServiceHealthSchema>;

export const SupabaseHealthResponseSchema = z.array(SupabaseServiceHealthSchema);
export type SupabaseHealthResponse = z.infer<typeof SupabaseHealthResponseSchema>;

// ---------------------------------------------------------------------------
// Config schema — GET /v1/projects/{ref}/config/database/postgres
// ---------------------------------------------------------------------------

/**
 * Loose passthrough record: the API returns a JSON object of postgres config keys.
 * We do not assert an exhaustive set; unrecognised keys are preserved.
 */
export const SupabasePostgresConfigSchema = z.record(z.string(), z.unknown());
export type SupabasePostgresConfig = z.infer<typeof SupabasePostgresConfigSchema>;

// ---------------------------------------------------------------------------
// Config key allowlist we expose as individual LiveFacts
// ---------------------------------------------------------------------------

/** The narrow allow-list of config keys reported as db-config facts. */
export const DB_CONFIG_ALLOWLIST = [
  'max_connections',
  'statement_timeout',
  'work_mem',
] as const;
export type DbConfigKey = (typeof DB_CONFIG_ALLOWLIST)[number];

// ---------------------------------------------------------------------------
// Healthy status values accepted from the health endpoint
// ---------------------------------------------------------------------------

/** Status strings that mean "this service is healthy". */
export const HEALTHY_STATUSES = new Set(['ACTIVE_HEALTHY', 'healthy', 'ok']);

// ---------------------------------------------------------------------------
// Normalised gathered payload
// ---------------------------------------------------------------------------

export interface PostgresPayload {
  /** Project metadata observed from /v1/projects/{ref}. */
  readonly project: SupabaseProject;
  /**
   * Raw service health entries from /v1/projects/{ref}/health?services=db.
   * Empty when the endpoint is absent or returns an unexpected shape.
   */
  readonly health: readonly SupabaseServiceHealth[];
  /**
   * True when the health endpoint returned a valid array.
   * False means health data is NOT CONNECTED (parse error or fetch failure).
   */
  readonly healthConnected: boolean;
  /**
   * Subset of postgres config keys from the allowlist, observed from
   * /v1/projects/{ref}/config/database/postgres. Empty when unavailable.
   */
  readonly configValues: Readonly<Partial<Record<DbConfigKey, unknown>>>;
  /**
   * True when the config endpoint returned a valid record.
   */
  readonly configConnected: boolean;
  /** Normalised LiveFacts for CorrelationEngine consumption. */
  readonly facts: readonly LiveFact[];
}
