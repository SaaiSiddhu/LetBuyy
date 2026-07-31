/**
 * Razorpay API response types — normalised shapes from the Razorpay REST API.
 * All fields are read-only and schema-validated with Zod before use.
 * Values observed from source of truth; none are fabricated by LCIS.
 *
 * READ-ONLY: no mutation primitives exist in this file.
 *
 * Money honesty: amounts appear only in the payload with evidence citing that
 * the canonical ledger (LetBuyy Postgres: payment_transactions / refunds / payouts)
 * is the authoritative record. Razorpay amounts are the provider's view only.
 */
import { z } from 'zod';
import type { LiveFact } from '../shared/contracts';

// ---------------------------------------------------------------------------
// Probe response schema
// ---------------------------------------------------------------------------

/**
 * Loose probe schema — Razorpay GET /v1/payments?count=1.
 * We only need to confirm the shape has entity/count/items to prove connectivity.
 */
export const RazorpayProbeResponseSchema = z.object({
  entity: z.string().optional(),
  count: z.number().optional(),
  items: z.array(z.unknown()).optional(),
});
export type RazorpayProbeResponse = z.infer<typeof RazorpayProbeResponseSchema>;

// ---------------------------------------------------------------------------
// Payment schema
// ---------------------------------------------------------------------------

export const RazorpayPaymentSchema = z.object({
  id: z.string(),
  /** 'created' | 'authorized' | 'captured' | 'refunded' | 'failed' */
  status: z.string(),
  /** Amount in smallest currency unit (paise for INR). Provider view only. */
  amount: z.number(),
  currency: z.string().optional(),
  method: z.string().optional(),
  /** Unix epoch seconds */
  created_at: z.number(),
});
export type RazorpayPayment = z.infer<typeof RazorpayPaymentSchema>;

export const RazorpayPaymentsResponseSchema = z.object({
  entity: z.string().optional(),
  count: z.number().optional(),
  items: z.array(RazorpayPaymentSchema),
});
export type RazorpayPaymentsResponse = z.infer<typeof RazorpayPaymentsResponseSchema>;

// ---------------------------------------------------------------------------
// Settlement schema
// ---------------------------------------------------------------------------

export const RazorpaySettlementSchema = z.object({
  id: z.string(),
  /** 'created' | 'processed' | 'failed' */
  status: z.string(),
  /** Amount in smallest currency unit. Provider view only. */
  amount: z.number(),
  /** Unix epoch seconds */
  created_at: z.number(),
});
export type RazorpaySettlement = z.infer<typeof RazorpaySettlementSchema>;

export const RazorpaySettlementsResponseSchema = z.object({
  entity: z.string().optional(),
  count: z.number().optional(),
  items: z.array(RazorpaySettlementSchema),
});
export type RazorpaySettlementsResponse = z.infer<typeof RazorpaySettlementsResponseSchema>;

// ---------------------------------------------------------------------------
// Order schema
// ---------------------------------------------------------------------------

export const RazorpayOrderSchema = z.object({
  id: z.string(),
  /** 'created' | 'attempted' | 'paid' */
  status: z.string(),
  /** Amount in smallest currency unit. Provider view only. */
  amount: z.number(),
  /** Unix epoch seconds */
  created_at: z.number(),
});
export type RazorpayOrder = z.infer<typeof RazorpayOrderSchema>;

export const RazorpayOrdersResponseSchema = z.object({
  entity: z.string().optional(),
  count: z.number().optional(),
  items: z.array(RazorpayOrderSchema),
});
export type RazorpayOrdersResponse = z.infer<typeof RazorpayOrdersResponseSchema>;

// ---------------------------------------------------------------------------
// Normalised gathered payload
// ---------------------------------------------------------------------------

export interface RazorpayPayload {
  /** Recent payments — page 1 only (count=20). Status + amounts are the provider's view. */
  readonly payments: readonly RazorpayPayment[];
  /** Recent settlements — page 1 only (count=10). */
  readonly settlements: readonly RazorpaySettlement[];
  /** Recent orders — page 1 only (count=20). */
  readonly orders: readonly RazorpayOrder[];
  /** Normalised LiveFacts for CorrelationEngine consumption. */
  readonly facts: readonly LiveFact[];
}
