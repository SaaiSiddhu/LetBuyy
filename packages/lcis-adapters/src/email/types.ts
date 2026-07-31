/**
 * Resend API response types — normalised shapes from the Resend REST API.
 * All fields are read-only and schema-validated with Zod before use.
 * Values observed from source of truth; none are fabricated by LCIS.
 *
 * READ-ONLY: no mutation primitives exist in this file.
 */
import { z } from 'zod';
import type { LiveFact } from '../shared/contracts';

// ---------------------------------------------------------------------------
// Domain schema
// ---------------------------------------------------------------------------

/**
 * Resend domain statuses as returned by GET /domains.
 * 'verified' means DNS records are confirmed; any other value means not yet usable.
 */
export const ResendDomainStatusSchema = z.enum([
  'not_started',
  'pending',
  'verified',
  'failure',
  'temporary_failure',
]);
export type ResendDomainStatus = z.infer<typeof ResendDomainStatusSchema>;

export const ResendDomainSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** DNS verification status — 'verified' is the only healthy value. */
  status: ResendDomainStatusSchema.catch('not_started'),
  region: z.string().optional(),
  created_at: z.string().optional(),
});
export type ResendDomain = z.infer<typeof ResendDomainSchema>;

export const ResendDomainsResponseSchema = z.object({
  data: z.array(ResendDomainSchema),
});
export type ResendDomainsResponse = z.infer<typeof ResendDomainsResponseSchema>;

// ---------------------------------------------------------------------------
// Probe schema (loose — only confirms the API responds with an array)
// ---------------------------------------------------------------------------

/** Loose probe check: the response must have a data array. */
export const ResendProbeResponseSchema = z.object({
  data: z.array(z.unknown()),
});

// ---------------------------------------------------------------------------
// Normalised gathered payload
// ---------------------------------------------------------------------------

export interface EmailPayload {
  /** All observed sending domains (from GET /domains). */
  readonly domains: readonly ResendDomain[];
  /** Normalised LiveFacts for CorrelationEngine consumption. */
  readonly facts: readonly LiveFact[];
}
