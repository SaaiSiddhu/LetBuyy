/**
 * RazorpayAdapter — READ-ONLY observer of Razorpay payments, settlements, and orders.
 *
 * Reads (page 1 only):
 *   GET /v1/payments?count=20
 *   GET /v1/settlements?count=10
 *   GET /v1/orders?count=20
 *
 * Uses the injected ReadOnlyHttpClient (GET only).
 * Auth: HTTP Basic — 'Basic ' + base64(keyId:secret). Credentials go only into the
 * Authorization header; they are never written to evidence, logs, or payload.
 *
 * Money honesty contract (mirrors Stripe adapter):
 *   - Counts and statuses are reported in facts.
 *   - Amounts are present in payload items with explicit evidence noting that the
 *     LetBuyy canonical ledger (Postgres RPCs: create_checkout_order /
 *     confirm_order_payment_with_ledger / complete_order_refund) is the authoritative
 *     record; Razorpay amounts are the provider's view only.
 *   - Only page 1 is fetched; additional pages are NOT CONNECTED (paginated API).
 *   - Confidence capped at 0.85 (page-1 only; all live metric values NOT CONNECTED).
 *
 * Fact kinds assigned to this adapter (namespaced to avoid collisions):
 *   rzp-payment, rzp-settlement, rzp-order
 */
import { type Evidence } from '@letbuyy/lcis-core';
import {
  AdapterBase,
  type AdapterDeps,
  type AdapterMetadata,
  EvidenceBuilder,
  type GatherResult,
  type LiveFact,
  type VerificationFinding,
} from '../shared/index';
import {
  type RazorpayPayment,
  type RazorpaySettlement,
  type RazorpayOrder,
  type RazorpayPayload,
  RazorpayProbeResponseSchema,
  RazorpayPaymentsResponseSchema,
  RazorpaySettlementsResponseSchema,
  RazorpayOrdersResponseSchema,
} from './types';

const RZP_API = 'https://api.razorpay.com';
const SOURCE = 'Razorpay';

/** One day in milliseconds — used for order-unpaid age check. */
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** Convert epoch-seconds (Razorpay) to milliseconds. */
function epochSecToMs(epochSec: number): number {
  return epochSec * 1000;
}

/** Convert epoch-seconds to ISO string. */
function epochSecToIso(epochSec: number): string {
  return new Date(epochSecToMs(epochSec)).toISOString();
}

/** Build a Basic auth header value from keyId + secret. */
function basicAuth(keyId: string | undefined, secret: string | undefined): string {
  const id = keyId ?? '';
  const sec = secret ?? '';
  return 'Basic ' + Buffer.from(`${id}:${sec}`).toString('base64');
}

export class RazorpayAdapter extends AdapterBase {
  constructor(deps: AdapterDeps) {
    super(deps);
  }

  metadata(): AdapterMetadata {
    return {
      name: 'razorpay',
      displayName: 'Razorpay',
      requiredEnv: ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'],
      capabilities: ['payments', 'settlements', 'orders'],
      sourceOfTruth: SOURCE,
    };
  }

  // ── Probe ─────────────────────────────────────────────────────────────────────

  protected async probe(): Promise<void> {
    const keyId = this.creds.value('RAZORPAY_KEY_ID');
    const secret = this.creds.value('RAZORPAY_KEY_SECRET');
    const raw = await this.http.get(`${RZP_API}/v1/payments?count=1`, {
      headers: { Authorization: basicAuth(keyId, secret) },
    });
    const parsed = RazorpayProbeResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(
        'Razorpay /v1/payments?count=1: unexpected response shape — credentials may be invalid',
      );
    }
  }

  // ── Gather ────────────────────────────────────────────────────────────────────

  protected async gather(): Promise<GatherResult> {
    const keyId = this.creds.value('RAZORPAY_KEY_ID');
    const secret = this.creds.value('RAZORPAY_KEY_SECRET');
    const headers = { Authorization: basicAuth(keyId, secret) };
    const ev: Evidence[] = [];

    // ── Payments (page 1, count=20) ───────────────────────────────────────────
    const paymentsRaw = await this.http.get(`${RZP_API}/v1/payments?count=20`, { headers });
    const paymentsParsed = RazorpayPaymentsResponseSchema.safeParse(paymentsRaw);
    if (!paymentsParsed.success) {
      throw new Error(
        `Razorpay /v1/payments: invalid response shape — ${paymentsParsed.error.issues[0]?.message ?? 'parse error'}`,
      );
    }
    const payments: RazorpayPayment[] = paymentsParsed.data.items;
    ev.push(
      EvidenceBuilder.observed(
        'razorpay.payments',
        `${payments.length} payment(s) — page 1 only (count=20); additional pages NOT CONNECTED (paginated API). Amounts are Razorpay provider view only; canonical ledger (Postgres confirm_order_payment_with_ledger RPC) is authoritative.`,
        SOURCE,
      ),
    );

    // ── Settlements (page 1, count=10) ────────────────────────────────────────
    const settlementsRaw = await this.http.get(`${RZP_API}/v1/settlements?count=10`, { headers });
    const settlementsParsed = RazorpaySettlementsResponseSchema.safeParse(settlementsRaw);
    if (!settlementsParsed.success) {
      throw new Error(
        `Razorpay /v1/settlements: invalid response shape — ${settlementsParsed.error.issues[0]?.message ?? 'parse error'}`,
      );
    }
    const settlements: RazorpaySettlement[] = settlementsParsed.data.items;
    ev.push(
      EvidenceBuilder.observed(
        'razorpay.settlements',
        `${settlements.length} settlement(s) — page 1 only (count=10); additional pages NOT CONNECTED. Amounts are provider view only; canonical payout ledger is authoritative.`,
        SOURCE,
      ),
    );

    // ── Orders (page 1, count=20) ─────────────────────────────────────────────
    const ordersRaw = await this.http.get(`${RZP_API}/v1/orders?count=20`, { headers });
    const ordersParsed = RazorpayOrdersResponseSchema.safeParse(ordersRaw);
    if (!ordersParsed.success) {
      throw new Error(
        `Razorpay /v1/orders: invalid response shape — ${ordersParsed.error.issues[0]?.message ?? 'parse error'}`,
      );
    }
    const orders: RazorpayOrder[] = ordersParsed.data.items;
    ev.push(
      EvidenceBuilder.observed(
        'razorpay.orders',
        `${orders.length} order(s) — page 1 only (count=20); additional pages NOT CONNECTED. Amounts are provider view only; canonical ledger (create_checkout_order RPC) is authoritative.`,
        SOURCE,
      ),
    );

    // ── Normalise facts for CorrelationEngine ─────────────────────────────────
    const facts: LiveFact[] = [];

    for (const p of payments) {
      facts.push({
        adapter: 'razorpay',
        kind: 'rzp-payment',
        subject: p.id,
        detail: `Razorpay payment ${p.id}: status=${p.status}${p.method ? ` method=${p.method}` : ''}${p.currency ? ` currency=${p.currency}` : ''}. Amount is provider view only; LetBuyy canonical ledger is authoritative.`,
        at: epochSecToIso(p.created_at),
        evidence: [
          EvidenceBuilder.observed(
            `razorpay.payment.${p.id}`,
            `status=${p.status} amount_provider=${p.amount}`,
            SOURCE,
          ),
        ],
      });
    }

    for (const s of settlements) {
      facts.push({
        adapter: 'razorpay',
        kind: 'rzp-settlement',
        subject: s.id,
        detail: `Razorpay settlement ${s.id}: status=${s.status}. Amount is provider view only; canonical payout ledger is authoritative.`,
        at: epochSecToIso(s.created_at),
        evidence: [
          EvidenceBuilder.observed(
            `razorpay.settlement.${s.id}`,
            `status=${s.status} amount_provider=${s.amount}`,
            SOURCE,
          ),
        ],
      });
    }

    for (const o of orders) {
      facts.push({
        adapter: 'razorpay',
        kind: 'rzp-order',
        subject: o.id,
        detail: `Razorpay order ${o.id}: status=${o.status}. Amount is provider view only; canonical ledger (create_checkout_order) is authoritative.`,
        at: epochSecToIso(o.created_at),
        evidence: [
          EvidenceBuilder.observed(
            `razorpay.order.${o.id}`,
            `status=${o.status} amount_provider=${o.amount}`,
            SOURCE,
          ),
        ],
      });
    }

    const payload: RazorpayPayload = { payments, settlements, orders, facts };

    return {
      payload,
      evidence: ev,
      // 0.85: page-1 only for all three endpoints; live metric values (rates, volumes,
      // refund ratios, settlement cycles) are NOT CONNECTED — they require Analytics API
      // or Razorpay dashboard which has no read API mapped here.
      confidence: 0.85,
    };
  }

  // ── Checks ────────────────────────────────────────────────────────────────────

  protected async checks(payload: unknown): Promise<readonly VerificationFinding[]> {
    const p = payload as RazorpayPayload;
    const findings: VerificationFinding[] = [];
    // Use injected clock — never wall clock, so checks are deterministic in tests.
    const nowMs = new Date(this.now()).getTime();

    // ── payment-failed (high): any payment with status 'failed' ───────────────
    const failedPayments = p.payments.filter((pay) => pay.status === 'failed');
    for (const pay of failedPayments) {
      findings.push({
        kind: 'payment-failed',
        severity: 'high',
        subject: pay.id,
        detail: `Razorpay payment ${pay.id} has status 'failed' (created ${epochSecToIso(pay.created_at)}). Investigate via Razorpay dashboard; check LetBuyy canonical ledger for reconciliation.`,
        evidence: [
          EvidenceBuilder.observed(
            `razorpay.payment.${pay.id}`,
            `status=failed created=${epochSecToIso(pay.created_at)}`,
            SOURCE,
          ),
        ],
      });
    }

    // ── settlement-pending (medium): settlements not in 'processed' status ────
    const pendingSettlements = p.settlements.filter((s) => s.status !== 'processed');
    for (const s of pendingSettlements) {
      findings.push({
        kind: 'settlement-pending',
        severity: 'medium',
        subject: s.id,
        detail: `Razorpay settlement ${s.id} has status '${s.status}' (not 'processed', created ${epochSecToIso(s.created_at)}). Monitor for payout delays; canonical payout ledger is authoritative for LetBuyy books.`,
        evidence: [
          EvidenceBuilder.observed(
            `razorpay.settlement.${s.id}`,
            `status=${s.status} created=${epochSecToIso(s.created_at)}`,
            SOURCE,
          ),
        ],
      });
    }

    // ── order-unpaid (info): orders with status 'created' older than 1 day ───
    const oldUnpaidOrders = p.orders.filter((o) => {
      if (o.status !== 'created') return false;
      return nowMs - epochSecToMs(o.created_at) > ONE_DAY_MS;
    });
    for (const o of oldUnpaidOrders) {
      findings.push({
        kind: 'order-unpaid',
        severity: 'info',
        subject: o.id,
        detail: `Razorpay order ${o.id} has status 'created' (unpaid) and was created more than 1 day ago (${epochSecToIso(o.created_at)}). May indicate an abandoned checkout; reconcile with LetBuyy canonical order ledger.`,
        evidence: [
          EvidenceBuilder.observed(
            `razorpay.order.${o.id}`,
            `status=created created=${epochSecToIso(o.created_at)} age_ms=${nowMs - epochSecToMs(o.created_at)}`,
            SOURCE,
          ),
        ],
      });
    }

    // ── rzp-inventory (info): summary of what was observed ───────────────────
    findings.push({
      kind: 'rzp-inventory',
      severity: 'info',
      subject: 'razorpay',
      detail: `Razorpay page-1 snapshot: ${p.payments.length} payment(s), ${p.settlements.length} settlement(s), ${p.orders.length} order(s) observed. Additional pages NOT CONNECTED (paginated API). Canonical ledger is authoritative for all money values.`,
      evidence: [
        EvidenceBuilder.observed('razorpay.payments', `count=${p.payments.length} (page 1)`, SOURCE),
        EvidenceBuilder.observed('razorpay.settlements', `count=${p.settlements.length} (page 1)`, SOURCE),
        EvidenceBuilder.observed('razorpay.orders', `count=${p.orders.length} (page 1)`, SOURCE),
      ],
    });

    return findings;
  }

  protected snapshotTtlMs(): number {
    return 60_000; // 1 min — payment data changes frequently
  }
}
