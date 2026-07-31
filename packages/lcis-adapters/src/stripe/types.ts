/**
 * Stripe API response types — normalised shapes from the Stripe REST API.
 * All fields are read-only and schema-validated with Zod before use.
 * Values observed from the source of truth; none are fabricated by LCIS.
 *
 * READ-ONLY: no mutation primitives exist in this file.
 *
 * IMPORTANT: Balance amount values appear in payload only. They MUST NOT be emitted
 * into LiveFact detail/evidence as authoritative money totals. Ledger authority
 * remains the canonical Postgres ledger (create_checkout_order etc.).
 */
import { z } from 'zod';
import type { LiveFact } from '../shared/contracts';

// ---------------------------------------------------------------------------
// Account schema — GET /v1/account
// ---------------------------------------------------------------------------

/** Loose schema: only the fields LCIS uses are required; extras are stripped. */
export const StripeAccountSchema = z.object({
  id: z.string(),
  charges_enabled: z.boolean().optional(),
  payouts_enabled: z.boolean().optional(),
  country: z.string().optional(),
  email: z.string().optional(),
  type: z.string().optional(),
  details_submitted: z.boolean().optional(),
  capabilities: z.record(z.string(), z.string()).optional(),
});
export type StripeAccount = z.infer<typeof StripeAccountSchema>;

// ---------------------------------------------------------------------------
// Balance schema — GET /v1/balance
// ---------------------------------------------------------------------------

export const StripeBalanceAmountSchema = z.object({
  amount: z.number(),
  currency: z.string(),
  source_types: z.record(z.string(), z.number()).optional(),
});
export type StripeBalanceAmount = z.infer<typeof StripeBalanceAmountSchema>;

export const StripeBalanceSchema = z.object({
  object: z.literal('balance').optional(),
  available: z.array(StripeBalanceAmountSchema),
  pending: z.array(StripeBalanceAmountSchema),
  connect_reserved: z.array(StripeBalanceAmountSchema).optional(),
  livemode: z.boolean().optional(),
});
export type StripeBalance = z.infer<typeof StripeBalanceSchema>;

// ---------------------------------------------------------------------------
// Webhook endpoint schema — GET /v1/webhook_endpoints?limit=20
// ---------------------------------------------------------------------------

export const StripeWebhookEndpointSchema = z.object({
  id: z.string(),
  url: z.string(),
  status: z.string().optional(),
  enabled_events: z.array(z.string()),
  created: z.number().optional(),
  application: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
  livemode: z.boolean().optional(),
  api_version: z.string().nullable().optional(),
});
export type StripeWebhookEndpoint = z.infer<typeof StripeWebhookEndpointSchema>;

export const StripeWebhookEndpointsResponseSchema = z.object({
  object: z.literal('list').optional(),
  data: z.array(StripeWebhookEndpointSchema),
  has_more: z.boolean().optional(),
  url: z.string().optional(),
});
export type StripeWebhookEndpointsResponse = z.infer<typeof StripeWebhookEndpointsResponseSchema>;

// ---------------------------------------------------------------------------
// Probe schema — minimal subset of /v1/account needed for connectivity check
// ---------------------------------------------------------------------------

export const StripeProbeSchema = z.object({
  id: z.string(),
});

// ---------------------------------------------------------------------------
// Normalised gathered payload
// ---------------------------------------------------------------------------

export interface StripePayload {
  /** Observed Stripe account metadata. */
  readonly account: StripeAccount | null;
  /**
   * Balance summary: currency presence and bucket counts only.
   * Raw amounts NOT emitted into facts/evidence as authoritative money —
   * ledger authority remains the canonical Postgres ledger.
   */
  readonly balanceSummary: {
    readonly availableCurrencies: readonly string[];
    readonly pendingCurrencies: readonly string[];
    readonly availableCount: number;
    readonly pendingCount: number;
    /** Present for payload consumers who need raw data; cite "ledger authority remains canonical Postgres ledger". */
    readonly raw: StripeBalance | null;
  };
  /** Observed webhook endpoints (up to 20; /v1/webhook_endpoints pagination not connected beyond page 1). */
  readonly webhookEndpoints: readonly StripeWebhookEndpoint[];
  /** Normalised LiveFacts for CorrelationEngine consumption. */
  readonly facts: readonly LiveFact[];
}
