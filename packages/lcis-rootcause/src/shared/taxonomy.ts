/**
 * The LRAS symptom taxonomy — a FIXED, deterministic keyword table mapping symptom text to
 * the six mandated symptom kinds, their domains, and twin anchors. No fuzzy matching, no AI:
 * lowercase substring matching against this table, first-listed kind wins on tie by order.
 * Unmatched text → kind 'unknown' (the honest fallback that drives verdict UNKNOWN).
 */
import type { SymptomKind } from './types';

export interface TaxonomyEntry {
  readonly kind: Exclude<SymptomKind, 'unknown'>;
  /** Lowercase terms; a symptom matches when ANY term is a substring of the lowered text. */
  readonly terms: readonly string[];
  readonly domains: readonly string[];
  /** Twin anchor ids ('<layer>:<name>'). */
  readonly anchors: readonly string[];
}

export const SYMPTOM_TAXONOMY: readonly TaxonomyEntry[] = [
  {
    kind: 'orders-failing',
    terms: ['orders failing', 'order failing', 'orders fail', 'order creation', 'cannot place order', 'order error'],
    domains: ['orders', 'payments', 'inventory'],
    anchors: ['domain:orders', 'table:orders', 'rpc:create_checkout_order'],
  },
  {
    kind: 'checkout-broken',
    terms: ['checkout broken', 'checkout failing', 'checkout error', 'cannot checkout', 'payment failing', 'payment failed', 'razorpay'],
    domains: ['payments', 'orders'],
    anchors: ['domain:payments', 'rpc:create_checkout_order', 'rpc:confirm_order_payment_with_ledger'],
  },
  {
    kind: 'queue-backlog',
    terms: ['queue backlog', 'queue backed up', 'jobs stuck', 'queue lag', 'messages piling', 'consumer lag'],
    domains: ['operations'],
    anchors: ['queue:order-events'],
  },
  {
    kind: 'high-latency',
    terms: ['high latency', 'slow response', 'timeout', 'timeouts', 'slow api', 'p95', 'degraded performance'],
    domains: ['operations'],
    anchors: [],
  },
  {
    kind: 'deployment-failed',
    terms: ['deployment failed', 'deploy failed', 'deploy broken', 'build failed', 'release failed', 'rollout failed'],
    domains: ['operations'],
    anchors: [],
  },
  {
    kind: 'worker-crashed',
    terms: ['worker crashed', 'worker crash', 'worker down', 'worker failing', 'cron failed', 'job crashed'],
    domains: ['operations'],
    anchors: ['worker:queue-worker'],
  },
];
