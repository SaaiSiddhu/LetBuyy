/**
 * StripeAdapter — READ-ONLY observer of Stripe account, balance, and webhook endpoints.
 *
 * Reads: account info (charges/payouts enabled), balance (currency presence + counts),
 *        webhook endpoints (status, enabled_events).
 * Uses the injected ReadOnlyHttpClient (GET only, host-allowlisted to api.stripe.com).
 * No mutation is possible — the interface exposes only this.http.get(...).
 *
 * Honesty contract:
 *  - Credentials absent → NOT_CONNECTED, names STRIPE_SECRET_KEY.
 *  - Balance amounts appear in payload.balanceSummary.raw only; they are NEVER emitted
 *    into LiveFact detail or evidence as authoritative money. Ledger authority remains
 *    the canonical Postgres ledger (create_checkout_order and related RPCs).
 *  - /v1/webhook_endpoints pagination not connected beyond limit=20; stated in evidence.
 *  - Confidence capped at 0.85 (webhook list is page-1 only; balance may reflect
 *    Stripe-Connect sub-account totals not visible here).
 *
 * Fact kinds: 'stripe-account' (subject = account id),
 *             'stripe-webhook' (subject = endpoint url host+path).
 */
import type { Evidence } from '@letbuyy/lcis-core';
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
  StripeAccountSchema,
  StripeBalanceSchema,
  StripeProbeSchema,
  StripeWebhookEndpointsResponseSchema,
  type StripeAccount,
  type StripeBalance,
  type StripePayload,
  type StripeWebhookEndpoint,
} from './types';

const STRIPE_API = 'https://api.stripe.com';
const SOURCE = 'Stripe';

/** Derive a short, stable host+path subject from a webhook URL for fact correlation. */
function webhookSubject(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}`;
  } catch {
    return url.slice(0, 80);
  }
}

export class StripeAdapter extends AdapterBase {
  constructor(deps: AdapterDeps) {
    super(deps);
  }

  metadata(): AdapterMetadata {
    return {
      name: 'stripe',
      displayName: 'Stripe',
      requiredEnv: ['STRIPE_SECRET_KEY'],
      capabilities: ['account', 'balance', 'webhook-endpoints'],
      sourceOfTruth: SOURCE,
    };
  }

  // ── Probe ─────────────────────────────────────────────────────────────────────

  protected async probe(): Promise<void> {
    const key = this.creds.value('STRIPE_SECRET_KEY');
    const raw = await this.http.get(`${STRIPE_API}/v1/account`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    const parsed = StripeProbeSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error('Stripe /v1/account: unexpected response shape — secret key may be invalid');
    }
  }

  // ── Gather ────────────────────────────────────────────────────────────────────

  protected async gather(): Promise<GatherResult> {
    const key = this.creds.value('STRIPE_SECRET_KEY');
    const headers = { Authorization: `Bearer ${key}` };
    const ev: Evidence[] = [];

    // ── Account ───────────────────────────────────────────────────────────────
    const accountRaw = await this.http.get(`${STRIPE_API}/v1/account`, { headers });
    const accountParsed = StripeAccountSchema.safeParse(accountRaw);
    if (!accountParsed.success) {
      throw new Error(
        `Stripe /v1/account: invalid response shape — ${accountParsed.error.issues[0]?.message ?? 'parse error'}`,
      );
    }
    const account: StripeAccount = accountParsed.data;
    ev.push(
      EvidenceBuilder.observed(
        'stripe.account',
        `id=${account.id} charges_enabled=${account.charges_enabled ?? 'unknown'} payouts_enabled=${account.payouts_enabled ?? 'unknown'} country=${account.country ?? 'unknown'}`,
        SOURCE,
      ),
    );

    // ── Balance ───────────────────────────────────────────────────────────────
    // HARD RULE: amounts stay in payload.balanceSummary.raw only; NOT emitted into facts/evidence.
    const balanceRaw = await this.http.get(`${STRIPE_API}/v1/balance`, { headers });
    const balanceParsed = StripeBalanceSchema.safeParse(balanceRaw);
    if (!balanceParsed.success) {
      throw new Error(
        `Stripe /v1/balance: invalid response shape — ${balanceParsed.error.issues[0]?.message ?? 'parse error'}`,
      );
    }
    const balance: StripeBalance = balanceParsed.data;
    const availableCurrencies = balance.available.map((b) => b.currency);
    const pendingCurrencies = balance.pending.map((b) => b.currency);
    ev.push(
      EvidenceBuilder.observed(
        'stripe.balance',
        `${balance.available.length} available bucket(s) (currencies: ${availableCurrencies.join(', ') || 'none'}) — amounts NOT CONNECTED as authoritative money; ledger authority remains the canonical Postgres ledger`,
        SOURCE,
      ),
    );

    // ── Webhook Endpoints ─────────────────────────────────────────────────────
    const webhooksRaw = await this.http.get(
      `${STRIPE_API}/v1/webhook_endpoints?limit=20`,
      { headers },
    );
    const webhooksParsed = StripeWebhookEndpointsResponseSchema.safeParse(webhooksRaw);
    if (!webhooksParsed.success) {
      throw new Error(
        `Stripe /v1/webhook_endpoints: invalid response shape — ${webhooksParsed.error.issues[0]?.message ?? 'parse error'}`,
      );
    }
    const webhookEndpoints: StripeWebhookEndpoint[] = webhooksParsed.data.data;
    ev.push(
      EvidenceBuilder.observed(
        'stripe.webhook_endpoints',
        `${webhookEndpoints.length} endpoint(s) observed (limit=20, page 1 only; additional endpoints NOT CONNECTED beyond first page)`,
        SOURCE,
      ),
    );

    // ── Normalise LiveFacts ───────────────────────────────────────────────────
    const facts: LiveFact[] = [];

    // Fact kind: 'stripe-account'
    facts.push({
      adapter: 'stripe',
      kind: 'stripe-account',
      subject: account.id,
      detail: [
        `Stripe account ${account.id}`,
        `charges_enabled=${account.charges_enabled ?? 'unknown'}`,
        `payouts_enabled=${account.payouts_enabled ?? 'unknown'}`,
        account.country ? `country=${account.country}` : null,
        `available_currencies=${availableCurrencies.join(',') || 'none'}`,
        `webhook_endpoints=${webhookEndpoints.length}`,
      ]
        .filter(Boolean)
        .join(' '),
      at: new Date(this.now()).toISOString(),
      evidence: [
        EvidenceBuilder.observed(
          `stripe.account.${account.id}`,
          `charges_enabled=${account.charges_enabled ?? 'unknown'} payouts_enabled=${account.payouts_enabled ?? 'unknown'}`,
          SOURCE,
        ),
      ],
    });

    // Facts kind: 'stripe-webhook' (one per endpoint)
    for (const ep of webhookEndpoints) {
      const subject = webhookSubject(ep.url);
      const isEnabled = ep.status === 'enabled';
      facts.push({
        adapter: 'stripe',
        kind: 'stripe-webhook',
        subject,
        detail: [
          `Stripe webhook endpoint ${subject}`,
          `status=${ep.status ?? 'unknown'}`,
          `events=${ep.enabled_events.length}`,
          !isEnabled ? 'NOT ENABLED' : null,
        ]
          .filter(Boolean)
          .join(' '),
        at:
          ep.created != null
            ? new Date(ep.created * 1000).toISOString()
            : new Date(this.now()).toISOString(),
        evidence: [
          EvidenceBuilder.observed(
            `stripe.webhook.${ep.id}`,
            `url=${subject} status=${ep.status ?? 'unknown'} events=${ep.enabled_events.length}`,
            SOURCE,
          ),
        ],
      });
    }

    const payload: StripePayload = {
      account,
      balanceSummary: {
        availableCurrencies,
        pendingCurrencies,
        availableCount: balance.available.length,
        pendingCount: balance.pending.length,
        raw: balance,
      },
      webhookEndpoints,
      facts,
    };

    return {
      payload,
      evidence: ev,
      // 0.85: webhook list is paginated (limit=20, page 1 only); balance reflects declared
      // Stripe account state, not the canonical Postgres ledger.
      confidence: 0.85,
    };
  }

  // ── Checks ────────────────────────────────────────────────────────────────────

  protected async checks(payload: unknown): Promise<readonly VerificationFinding[]> {
    const p = payload as StripePayload;
    const findings: VerificationFinding[] = [];

    // ── payments-disabled: critical when charges_enabled === false ─────────────
    if (p.account !== null && p.account.charges_enabled === false) {
      findings.push({
        kind: 'payments-disabled',
        severity: 'critical',
        subject: p.account.id,
        detail: `Stripe account ${p.account.id} has charges_enabled=false. Payment processing is disabled on this account. Resolve account restrictions in the Stripe Dashboard before accepting orders.`,
        evidence: [
          EvidenceBuilder.observed(
            `stripe.account.${p.account.id}`,
            'charges_enabled=false',
            SOURCE,
          ),
        ],
      });
    }

    // ── payouts-disabled: high when payouts_enabled === false ─────────────────
    if (p.account !== null && p.account.payouts_enabled === false) {
      findings.push({
        kind: 'payouts-disabled',
        severity: 'high',
        subject: p.account.id,
        detail: `Stripe account ${p.account.id} has payouts_enabled=false. Payouts to the bank account are disabled. Resolve payout restrictions in the Stripe Dashboard.`,
        evidence: [
          EvidenceBuilder.observed(
            `stripe.account.${p.account.id}`,
            'payouts_enabled=false',
            SOURCE,
          ),
        ],
      });
    }

    // ── webhook-disabled: high for each endpoint with status !== 'enabled' ─────
    for (const ep of p.webhookEndpoints) {
      if (ep.status !== 'enabled') {
        const subject = webhookSubject(ep.url);
        findings.push({
          kind: 'webhook-disabled',
          severity: 'high',
          subject,
          detail: `Stripe webhook endpoint "${subject}" (id=${ep.id}) has status="${ep.status ?? 'unknown'}". Events will not be delivered. Enable the endpoint in the Stripe Dashboard.`,
          evidence: [
            EvidenceBuilder.observed(
              `stripe.webhook.${ep.id}`,
              `url=${subject} status=${ep.status ?? 'unknown'}`,
              SOURCE,
            ),
          ],
        });
      }
    }

    // ── stripe-inventory: info — summary of observed Stripe configuration ──────
    if (p.account !== null) {
      const enabledEndpoints = p.webhookEndpoints.filter((ep) => ep.status === 'enabled').length;
      findings.push({
        kind: 'stripe-inventory',
        severity: 'info',
        subject: p.account.id,
        detail: [
          `Stripe account ${p.account.id} observed:`,
          `charges_enabled=${p.account.charges_enabled ?? 'unknown'}`,
          `payouts_enabled=${p.account.payouts_enabled ?? 'unknown'}`,
          `available_currencies=${p.balanceSummary.availableCurrencies.join(',') || 'none'}`,
          `webhook_endpoints=${p.webhookEndpoints.length} (${enabledEndpoints} enabled)`,
          'Balance amounts not cited as authoritative — ledger authority remains the canonical Postgres ledger.',
        ].join(' '),
        evidence: [
          EvidenceBuilder.observed(
            `stripe.account.${p.account.id}`,
            `webhook_endpoints=${p.webhookEndpoints.length} enabled=${enabledEndpoints}`,
            SOURCE,
          ),
        ],
      });
    }

    return findings;
  }

  protected snapshotTtlMs(): number {
    return 120_000; // 2 min — account/webhook topology changes infrequently
  }
}
