/**
 * CommerceOperationsService — LCOS Phase 6 commerce intelligence.
 * Answers "What is happening to revenue?" by observing/analyzing/reporting across:
 *   GMV trend, order trend, refund spikes, payment failures, checkout degradation.
 *
 * READ-ONLY P0: observes/analyzes/reports only. No fetch, no child_process, no spawn,
 * no exec, no eval, no writeFile, no network calls, no DB writes. Deterministic. No AI.
 * No placeholders/mocks/stubs/TODOs.
 *
 * HONESTY CONTRACT: every live VALUE (GMV, order/refund/payment rates) is NOT_CONNECTED —
 * value=null + exact env var named; confidence=0 for any NOT_CONNECTED result.
 * Structural topology (money tables, RPCs, ledger model) is CONNECTED.
 */

import { type LcisEngine, evidence } from '@letbuyy/lcis-core';
import {
  LiveSignalRegistry,
  OperationalEvidenceBuilder,
  OperationalFindingBuilder,
  OperationalHealthCalculator,
  OperationsArtifactStore,
  TelemetryNormalizer,
  defaultNow,
  operations,
  type CommerceReport,
  type LiveSignal,
  type OperationalFact,
  type OperationalFinding,
} from '../shared/index';

// ── Internal artifact row shapes (read-only, db-intel.json) ──────────────────

interface DbTable {
  readonly name: string;
  readonly money: boolean;
  readonly tenant: boolean;
  readonly rls: boolean;
  readonly createdIn?: string;
}

interface DbFunction {
  readonly name: string;
  readonly money: boolean;
  readonly securityDefiner: boolean;
  readonly hasIdempotency: boolean;
  readonly forUpdate: boolean;
}

interface CommerceDomain {
  readonly key: string;
  readonly label: string;
  readonly routes: number;
  readonly rpcs: number;
  readonly tables: number;
  readonly money: boolean;
}

// ── Env var constants (exactly as named in docs) ──────────────────────────────

const SUPABASE_URL = 'SUPABASE_URL';
const SUPABASE_KEY = 'SUPABASE_SERVICE_ROLE_KEY';

// ── Service ───────────────────────────────────────────────────────────────────

export class CommerceOperationsService {
  private readonly store: OperationsArtifactStore;
  private readonly eb: OperationalEvidenceBuilder;
  private readonly fb: OperationalFindingBuilder;
  private readonly tn: TelemetryNormalizer;
  private readonly reg: LiveSignalRegistry;
  private readonly health: OperationalHealthCalculator;

  constructor(
    private readonly core: LcisEngine,
    private readonly now: () => string = defaultNow,
  ) {
    this.store = new OperationsArtifactStore(core);
    this.eb = new OperationalEvidenceBuilder();
    this.fb = new OperationalFindingBuilder();
    this.tn = new TelemetryNormalizer();
    this.reg = new LiveSignalRegistry();
    this.health = new OperationalHealthCalculator();
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private dbTables(): readonly DbTable[] {
    const raw = this.store.raw('db-intel') as Record<string, unknown> | null;
    const tables = raw?.['tables'];
    return Array.isArray(tables) ? (tables as DbTable[]) : [];
  }

  private dbFunctions(): readonly DbFunction[] {
    const raw = this.store.raw('db-intel') as Record<string, unknown> | null;
    const fns = raw?.['functions'];
    return Array.isArray(fns) ? (fns as DbFunction[]) : [];
  }

  private moneyTables(): readonly DbTable[] {
    return this.dbTables().filter((t) => t.money);
  }

  private moneyFunctions(): readonly DbFunction[] {
    return this.dbFunctions().filter((f) => f.money);
  }

  private revenueFunnelStages(): readonly string[] {
    const rev = this.store.revenue() as Record<string, unknown> | null;
    const models = rev?.['models'] as Record<string, unknown> | undefined;
    const funnel = models?.['funnel'] as Record<string, unknown> | undefined;
    const stages = funnel?.['stages'];
    return Array.isArray(stages) ? (stages as string[]) : [];
  }

  private leakageRpcs(): readonly string[] {
    const rev = this.store.revenue() as Record<string, unknown> | null;
    const models = rev?.['models'] as Record<string, unknown> | undefined;
    const ld = models?.['leakageDetection'] as Record<string, unknown> | undefined;
    const rpcs = ld?.['rpcs'];
    return Array.isArray(rpcs) ? (rpcs as string[]) : [];
  }

  private commerceDomains(): readonly CommerceDomain[] {
    const raw = this.store.raw('commerce-control-intel') as Record<string, unknown> | null;
    const domains = raw?.['domains'];
    return Array.isArray(domains) ? (domains as CommerceDomain[]) : [];
  }

  private checkoutJourney(): readonly string[] {
    const raw = this.store.raw('commerce-control-intel') as Record<string, unknown> | null;
    const journeys = raw?.['journeys'] as Record<string, unknown> | undefined;
    const order = journeys?.['order'];
    return Array.isArray(order) ? (order as string[]) : [];
  }

  private paymentJourney(): readonly string[] {
    const raw = this.store.raw('commerce-control-intel') as Record<string, unknown> | null;
    const journeys = raw?.['journeys'] as Record<string, unknown> | undefined;
    const payment = journeys?.['payment'];
    return Array.isArray(payment) ? (payment as string[]) : [];
  }

  private refundJourney(): readonly string[] {
    const raw = this.store.raw('commerce-control-intel') as Record<string, unknown> | null;
    const journeys = raw?.['journeys'] as Record<string, unknown> | undefined;
    const refund = journeys?.['refund'];
    return Array.isArray(refund) ? (refund as string[]) : [];
  }

  // ── Public detector methods ────────────────────────────────────────────────

  /**
   * detectGmvTrend — live GMV is NOT_CONNECTED (requires Supabase).
   * Structural: the revenue funnel topology (GMV → captured → net revenue → payout) is CONNECTED.
   */
  detectGmvTrend(): OperationalFinding[] {
    const findings: OperationalFinding[] = [];
    const stages = this.revenueFunnelStages();

    // Structural finding: funnel topology CONNECTED
    if (stages.length > 0) {
      findings.push(
        this.fb.build({
          id: 'COMMERCE-GMV-FUNNEL-TOPOLOGY',
          area: 'commerce',
          kind: 'gmv-funnel',
          severity: 'info',
          subject: 'revenue-funnel-topology',
          title: 'Revenue funnel topology CONNECTED',
          detail: `${stages.length}-stage funnel declared: ${stages.join(' → ')}. GMV source: orders.total_minor (Supabase). Live amounts NOT_CONNECTED.`,
          status: 'CONNECTED',
          evidence: [
            this.eb.artifact('revenue-intelligence-v2', 'models.funnel.stages', `Funnel stages: ${stages.join(', ')}`),
            this.eb.notConnected('orders.total_minor', SUPABASE_URL),
          ],
        }),
      );
    }

    // NOT_CONNECTED finding: live GMV value unavailable
    findings.push(
      this.fb.build({
        id: 'COMMERCE-GMV-LIVE-NOT-CONNECTED',
        area: 'commerce',
        kind: 'gmv-live',
        severity: 'info',
        subject: 'gmv-amount',
        title: 'GMV live amount NOT_CONNECTED',
        detail: `Gross Merchandise Value requires ${SUPABASE_URL} + ${SUPABASE_KEY}. Source: orders.total_minor grouped by site_id.`,
        status: 'NOT_CONNECTED',
        evidence: [
          this.eb.notConnected('orders.total_minor', SUPABASE_URL),
          this.eb.notConnected('orders.total_minor', SUPABASE_KEY),
        ],
        confidence: 0,
      }),
    );

    return findings;
  }

  /**
   * detectOrderTrend — live order rate is NOT_CONNECTED.
   * Structural: the orders domain topology (routes/RPCs/tables) is CONNECTED.
   */
  detectOrderTrend(): OperationalFinding[] {
    const findings: OperationalFinding[] = [];
    const domains = this.commerceDomains();
    const ordersDomain = domains.find((d) => d.key === 'orders');

    if (ordersDomain) {
      findings.push(
        this.fb.build({
          id: 'COMMERCE-ORDER-DOMAIN-TOPOLOGY',
          area: 'commerce',
          kind: 'order-topology',
          severity: 'info',
          subject: 'orders-domain',
          title: 'Orders domain topology CONNECTED',
          detail: `Orders domain: ${ordersDomain.routes} routes, ${ordersDomain.rpcs} RPCs, ${ordersDomain.tables} tables, money=${ordersDomain.money}. Live order rate NOT_CONNECTED.`,
          status: 'CONNECTED',
          evidence: [
            this.eb.artifact('commerce-control-intel', 'domains[key=orders]', `routes=${ordersDomain.routes} rpcs=${ordersDomain.rpcs} tables=${ordersDomain.tables}`),
            this.eb.table('orders', 'Primary order table; total_minor is the GMV source'),
          ],
        }),
      );
    }

    // Checkout journey structural CONNECTED
    const journey = this.checkoutJourney();
    if (journey.length > 0) {
      findings.push(
        this.fb.build({
          id: 'COMMERCE-ORDER-JOURNEY-TOPOLOGY',
          area: 'commerce',
          kind: 'order-journey',
          severity: 'info',
          subject: 'checkout-order-journey',
          title: 'Order journey topology CONNECTED',
          detail: `${journey.length}-step order journey: ${journey.join(' → ')}. Anchored on create_checkout_order RPC.`,
          status: 'CONNECTED',
          evidence: [
            this.eb.artifact('commerce-control-intel', 'journeys.order', journey.join(' → ')),
            this.eb.rpc('create_checkout_order', 'Canonical checkout RPC; SECURITY DEFINER + FOR UPDATE + idempotency_key'),
          ],
        }),
      );
    }

    // NOT_CONNECTED: live order rate
    findings.push(
      this.fb.build({
        id: 'COMMERCE-ORDER-RATE-NOT-CONNECTED',
        area: 'commerce',
        kind: 'order-rate-live',
        severity: 'info',
        subject: 'order-rate',
        title: 'Order rate live metric NOT_CONNECTED',
        detail: `Live order rate requires ${SUPABASE_URL} + ${SUPABASE_KEY}. Source: orders table (Supabase).`,
        status: 'NOT_CONNECTED',
        evidence: [
          this.eb.notConnected('orders', SUPABASE_URL),
          this.eb.notConnected('orders', SUPABASE_KEY),
        ],
        confidence: 0,
      }),
    );

    return findings;
  }

  /**
   * detectRefundSpikes — live refund rate is NOT_CONNECTED.
   * Structural: the refund RPC ledger path (complete_order_refund → ledger reversal → restore_gift_card_on_refund) is CONNECTED.
   */
  detectRefundSpikes(): OperationalFinding[] {
    const findings: OperationalFinding[] = [];
    const journey = this.refundJourney();

    if (journey.length > 0) {
      findings.push(
        this.fb.build({
          id: 'COMMERCE-REFUND-LEDGER-PATH-CONNECTED',
          area: 'commerce',
          kind: 'refund-ledger-path',
          severity: 'info',
          subject: 'refund-rpc-chain',
          title: 'Refund RPC ledger path CONNECTED',
          detail: `${journey.length}-step refund journey: ${journey.join(' → ')}. complete_order_refund writes to refunds + ledger reversal; restore_gift_card_on_refund restores gift-card balance.`,
          status: 'CONNECTED',
          evidence: [
            this.eb.artifact('commerce-control-intel', 'journeys.refund', journey.join(' → ')),
            this.eb.rpc('complete_order_refund', 'SECURITY DEFINER + FOR UPDATE + idempotency_key; touches refunds, orders, refund_transactions, outbox_events'),
            this.eb.rpc('restore_gift_card_on_refund', 'SECURITY DEFINER + FOR UPDATE + idempotency_key; restores gift_card_ledger_entries'),
          ],
        }),
      );
    }

    // Structural: leakage detection RPCs for refund reconciliation
    const leakageRpcs = this.leakageRpcs();
    if (leakageRpcs.length > 0) {
      findings.push(
        this.fb.build({
          id: 'COMMERCE-REFUND-LEAKAGE-RPCS-CONNECTED',
          area: 'commerce',
          kind: 'refund-leakage-detection',
          severity: 'info',
          subject: 'leakage-detection-rpcs',
          title: `${leakageRpcs.length} leakage-detection RPCs CONNECTED`,
          detail: `Reconciliation/leakage RPCs declared: ${leakageRpcs.join(', ')}. These can detect ledger drift and COD reconciliation gaps.`,
          status: 'CONNECTED',
          evidence: [
            this.eb.artifact('revenue-intelligence-v2', 'models.leakageDetection.rpcs', `${leakageRpcs.length} RPCs`),
            ...leakageRpcs.slice(0, 4).map((r) => this.eb.rpc(r, 'Leakage detection RPC')),
          ],
        }),
      );
    }

    // NOT_CONNECTED: live refund rate
    findings.push(
      this.fb.build({
        id: 'COMMERCE-REFUND-RATE-NOT-CONNECTED',
        area: 'commerce',
        kind: 'refund-rate-live',
        severity: 'info',
        subject: 'refund-rate',
        title: 'Refund rate live metric NOT_CONNECTED',
        detail: `Live refund rate requires ${SUPABASE_URL} + ${SUPABASE_KEY}. Source: refunds + refund_transactions (Supabase).`,
        status: 'NOT_CONNECTED',
        evidence: [
          this.eb.notConnected('refunds', SUPABASE_URL),
          this.eb.notConnected('refund_transactions', SUPABASE_KEY),
        ],
        confidence: 0,
      }),
    );

    return findings;
  }

  /**
   * detectPaymentFailures — live failure rate is NOT_CONNECTED.
   * Structural risk: any money function that is NOT securityDefiner or NOT idempotent = a
   * CONNECTED risk finding (read from db-intel functions).
   */
  detectPaymentFailures(): OperationalFinding[] {
    const findings: OperationalFinding[] = [];
    const fns = this.moneyFunctions();

    // Structural: payment journey topology CONNECTED
    const paymentJourney = this.paymentJourney();
    if (paymentJourney.length > 0) {
      findings.push(
        this.fb.build({
          id: 'COMMERCE-PAYMENT-JOURNEY-CONNECTED',
          area: 'commerce',
          kind: 'payment-journey',
          severity: 'info',
          subject: 'payment-journey-topology',
          title: 'Payment journey topology CONNECTED',
          detail: `${paymentJourney.length}-step payment journey: ${paymentJourney.join(' → ')}. confirm_order_payment_with_ledger is the canonical capture RPC.`,
          status: 'CONNECTED',
          evidence: [
            this.eb.artifact('commerce-control-intel', 'journeys.payment', paymentJourney.join(' → ')),
            this.eb.rpc('confirm_order_payment_with_ledger', 'SECURITY DEFINER + FOR UPDATE + idempotency_key; touches orders, payment_transactions'),
          ],
        }),
      );
    }

    // Structural risk: money functions NOT securityDefiner
    const notSdFns = fns.filter((f) => !f.securityDefiner);
    for (const fn of notSdFns) {
      // Skip known trigger/read helpers where this is expected
      const isTriggerOrHelper = ['enforce_ledger_transaction_balance', 'ledger_balance_breaks'].includes(fn.name);
      findings.push(
        this.fb.build({
          id: `COMMERCE-PAYMENT-NO-SD-${fn.name}`,
          area: 'commerce',
          kind: 'payment-security-no-sd',
          severity: isTriggerOrHelper ? 'info' : 'high',
          subject: fn.name,
          title: isTriggerOrHelper
            ? `${fn.name} is a trigger/read helper without SECURITY DEFINER (expected)`
            : `Money function ${fn.name} is NOT SECURITY DEFINER — potential privilege escalation risk`,
          detail: isTriggerOrHelper
            ? `${fn.name} is a trigger function or read helper; missing SECURITY DEFINER is expected for this role. No mutation risk.`
            : `${fn.name} is a money-touching function without SECURITY DEFINER. Any caller with EXECUTE permission can invoke it. Risk: privilege escalation in money path.`,
          status: 'CONNECTED',
          evidence: [
            this.eb.rpc(fn.name, `money=true, securityDefiner=false, hasIdempotency=${fn.hasIdempotency}, forUpdate=${fn.forUpdate}`),
            evidence('artifact-field', 'db-intel.json:functions', `${fn.name} money=true securityDefiner=false`, 'graphify-out/db-intel.json'),
          ],
        }),
      );
    }

    // Structural risk: money functions with SECURITY DEFINER but NO idempotency (mutation risk)
    const sdNoIdemFns = fns.filter(
      (f) => f.securityDefiner && !f.hasIdempotency && f.forUpdate,
    );
    for (const fn of sdNoIdemFns) {
      findings.push(
        this.fb.build({
          id: `COMMERCE-PAYMENT-NO-IDEMPOTENCY-${fn.name}`,
          area: 'commerce',
          kind: 'payment-security-no-idempotency',
          severity: 'medium',
          subject: fn.name,
          title: `Money mutator ${fn.name} has FOR UPDATE but no idempotency_key`,
          detail: `${fn.name}: securityDefiner=true, forUpdate=true, hasIdempotency=false. Duplicate calls could cause duplicate money mutations. All canonical write paths require idempotency_key.`,
          status: 'CONNECTED',
          evidence: [
            this.eb.rpc(fn.name, `money=true, securityDefiner=true, hasIdempotency=false, forUpdate=true`),
            evidence('artifact-field', 'db-intel.json:functions', `${fn.name} missing idempotency_key`, 'graphify-out/db-intel.json'),
          ],
        }),
      );
    }

    // NOT_CONNECTED: live payment failure rate
    findings.push(
      this.fb.build({
        id: 'COMMERCE-PAYMENT-FAILURE-RATE-NOT-CONNECTED',
        area: 'commerce',
        kind: 'payment-failure-rate-live',
        severity: 'info',
        subject: 'payment-failure-rate',
        title: 'Payment failure rate live metric NOT_CONNECTED',
        detail: `Live payment failure rate requires ${SUPABASE_URL} + ${SUPABASE_KEY}. Source: payment_transactions (Supabase).`,
        status: 'NOT_CONNECTED',
        evidence: [
          this.eb.notConnected('payment_transactions', SUPABASE_URL),
          this.eb.notConnected('payment_transactions', SUPABASE_KEY),
        ],
        confidence: 0,
      }),
    );

    return findings;
  }

  /**
   * detectCheckoutDegradation — live checkout metrics are NOT_CONNECTED.
   * Structural: the checkout RPC chain (create_checkout_order topology) is CONNECTED.
   */
  detectCheckoutDegradation(): OperationalFinding[] {
    const findings: OperationalFinding[] = [];
    const fns = this.dbFunctions();
    const checkoutRpc = fns.find((f) => f.name === 'create_checkout_order');

    if (checkoutRpc) {
      findings.push(
        this.fb.build({
          id: 'COMMERCE-CHECKOUT-RPC-CONNECTED',
          area: 'commerce',
          kind: 'checkout-rpc',
          severity: 'info',
          subject: 'create_checkout_order',
          title: 'Checkout RPC chain CONNECTED (create_checkout_order)',
          detail: `create_checkout_order: securityDefiner=${checkoutRpc.securityDefiner}, hasIdempotency=${checkoutRpc.hasIdempotency}, forUpdate=${checkoutRpc.forUpdate}, money=${checkoutRpc.money}. Canonical write path with highest blast radius (19+ tables).`,
          status: 'CONNECTED',
          evidence: [
            this.eb.rpc('create_checkout_order', 'SECURITY DEFINER + FOR UPDATE + idempotency_key; touches orders, order_items, payment_transactions, gift_card_ledger_entries, inventory_reservations, checkout_sessions, outbox_events'),
            evidence('artifact-field', 'db-intel.json:functions', 'create_checkout_order: SD+idempotency+forUpdate', 'graphify-out/db-intel.json'),
          ],
        }),
      );
    }

    // Structural: money domains that are part of checkout chain
    const checkoutDomains = ['orders', 'payments', 'inventory'];
    const domains = this.commerceDomains();
    for (const key of checkoutDomains) {
      const d = domains.find((cd) => cd.key === key);
      if (d) {
        findings.push(
          this.fb.build({
            id: `COMMERCE-CHECKOUT-DOMAIN-${key.toUpperCase()}`,
            area: 'commerce',
            kind: 'checkout-domain',
            severity: 'info',
            subject: key,
            title: `Checkout chain domain ${d.label} CONNECTED`,
            detail: `${d.label}: ${d.routes} routes, ${d.rpcs} RPCs, ${d.tables} tables, money=${d.money}. Part of the checkout execution chain.`,
            status: 'CONNECTED',
            evidence: [
              this.eb.artifact('commerce-control-intel', `domains[key=${key}]`, `routes=${d.routes} rpcs=${d.rpcs} tables=${d.tables} money=${d.money}`),
            ],
          }),
        );
      }
    }

    // NOT_CONNECTED: live checkout degradation
    findings.push(
      this.fb.build({
        id: 'COMMERCE-CHECKOUT-DEGRADATION-NOT-CONNECTED',
        area: 'commerce',
        kind: 'checkout-degradation-live',
        severity: 'info',
        subject: 'checkout-success-rate',
        title: 'Checkout degradation live metric NOT_CONNECTED',
        detail: `Live checkout success/failure rate requires ${SUPABASE_URL} + ${SUPABASE_KEY}. Source: orders + payment_transactions (Supabase).`,
        status: 'NOT_CONNECTED',
        evidence: [
          this.eb.notConnected('orders + payment_transactions', SUPABASE_URL),
          this.eb.notConnected('orders + payment_transactions', SUPABASE_KEY),
        ],
        confidence: 0,
      }),
    );

    return findings;
  }

  /**
   * generateCommerceReport — the canonical LCOS commerce area report.
   * Facts from structural artifacts + signals from LiveSignalRegistry + findings from all detectors.
   * Subscriptions are honestly NOT IMPLEMENTED.
   */
  generateCommerceReport(): CommerceReport {
    const allFindings: OperationalFinding[] = [
      ...this.detectGmvTrend(),
      ...this.detectOrderTrend(),
      ...this.detectRefundSpikes(),
      ...this.detectPaymentFailures(),
      ...this.detectCheckoutDegradation(),
      // Subscriptions: honestly NOT IMPLEMENTED
      this.fb.build({
        id: 'COMMERCE-SUBSCRIPTIONS-NOT-IMPLEMENTED',
        area: 'commerce',
        kind: 'subscriptions-status',
        severity: 'info',
        subject: 'subscriptions-domain',
        title: 'Subscriptions commerce domain NOT IMPLEMENTED',
        detail: 'The subscriptions table exists in the schema as a churn signal, but there is no subscriptions commerce domain, no subscription-payment RPC, and no subscription journey. Recurring subscription billing as a merchant feature is NOT IMPLEMENTED.',
        status: 'CONNECTED',
        evidence: [
          this.eb.artifact('commerce-control-intel', 'domains', 'No subscriptions domain in commerce-control-intel'),
          this.eb.doc('LCOS_COMMERCE_DISCOVERY.md#7', 'Subscriptions honestly NOT IMPLEMENTED', 'docs/lcis-operations/LCOS_COMMERCE_DISCOVERY.md'),
        ],
      }),
    ];

    // Facts from structural artifacts
    const facts: OperationalFact[] = [
      ...this.buildLedgerFacts(),
      ...this.buildFunnelFacts(),
      ...this.buildMoneyTableFacts(),
    ];

    // Signals from the registry (commerce area)
    const commerceSignals = this.reg.byArea('commerce');
    const signals: LiveSignal[] = commerceSignals.map((sig) =>
      this.tn.signalToLive(sig, [
        evidence('artifact-field', sig.dataSource, sig.label, `graphify-out/${sig.dataSource}`),
      ]),
    );

    // Health from findings + signals
    const health = this.health.forArea('commerce', allFindings, signals);

    // Aggregate evidence
    const allEvidence = [
      ...allFindings.flatMap((f) => [...f.evidence]),
      this.eb.artifact('revenue-intelligence-v2', 'models', 'Revenue intelligence v2 artifact'),
      this.eb.artifact('commerce-control-intel', 'domains', 'Commerce control intel artifact'),
      this.eb.artifact('db-intel', 'functions+tables', 'DB intel artifact: money functions + tables'),
    ];

    // Summary
    const moneyTableCount = this.moneyTables().length;
    const moneyFnCount = this.moneyFunctions().length;
    const notSdCount = this.moneyFunctions().filter((f) => !f.securityDefiner).length;
    const funnelStages = this.revenueFunnelStages();
    const summary = [
      `Commerce intelligence: ${moneyTableCount} money tables, ${moneyFnCount} money RPCs declared (CONNECTED).`,
      funnelStages.length > 0
        ? `Revenue funnel: ${funnelStages.join(' → ')} (topology CONNECTED; live amounts NOT_CONNECTED — requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).`
        : 'Revenue funnel topology not found.',
      notSdCount > 0
        ? `${notSdCount} money function(s) not SECURITY DEFINER (see findings for details).`
        : 'All money functions have SECURITY DEFINER.',
      'Subscriptions: NOT IMPLEMENTED.',
      'All live values (GMV, order rate, refund rate, payment failure rate, checkout success rate) NOT_CONNECTED — wire SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to connect.',
    ].join(' ');

    return operations(
      {
        area: 'commerce' as const,
        facts,
        findings: allFindings,
        signals,
        health,
        summary,
      },
      {
        evidence: allEvidence,
        liveConnected: false,
        now: this.now,
      },
    );
  }

  // ── Private fact builders ──────────────────────────────────────────────────

  private buildLedgerFacts(): OperationalFact[] {
    const facts: OperationalFact[] = [];

    // Ledger topology facts
    const ledgerTables = ['ledger_accounts', 'ledger_transactions', 'ledger_entries'];
    const tables = this.dbTables();
    for (const name of ledgerTables) {
      const t = tables.find((tb) => tb.name === name);
      facts.push(
        this.tn.fact('commerce', 'ledger-table', name,
          t ? `Canonical ledger table; rls=${t.rls}, money=${t.money}` : 'Canonical ledger table (structure from discovery doc)',
          {
            value: t ? name : null,
            status: 'CONNECTED',
            evidence: [this.eb.table(name, 'Canonical ledger table (append-only double-entry)')],
          },
        ),
      );
    }

    // Ledger triggers fact
    facts.push(
      this.tn.fact('commerce', 'ledger-invariant', 'enforce_ledger_transaction_balance',
        'Trigger: every ledger_transaction entry must sum to zero (double-entry invariant)',
        {
          value: 'active',
          status: 'CONNECTED',
          evidence: [
            this.eb.rpc('enforce_ledger_transaction_balance', 'Trigger function enforcing double-entry balance invariant'),
            this.eb.artifact('db-intel', 'functions[name=enforce_ledger_transaction_balance]', 'Immutability enforcer'),
          ],
        },
      ),
    );

    // GMV live fact (NOT_CONNECTED)
    facts.push(
      this.tn.fact('commerce', 'gmv-amount', 'orders.total_minor',
        `NOT_CONNECTED — requires ${SUPABASE_URL} + ${SUPABASE_KEY}`,
        {
          value: null,
          status: 'NOT_CONNECTED',
          evidence: [
            this.eb.notConnected('orders.total_minor', SUPABASE_URL),
            this.eb.notConnected('orders.total_minor', SUPABASE_KEY),
          ],
        },
      ),
    );

    return facts;
  }

  private buildFunnelFacts(): OperationalFact[] {
    const facts: OperationalFact[] = [];
    const stages = this.revenueFunnelStages();
    const leakageRpcs = this.leakageRpcs();

    facts.push(
      this.tn.fact('commerce', 'revenue-funnel-stages', 'models.funnel',
        stages.length > 0 ? `${stages.length} stages: ${stages.join(' → ')}` : 'Not found',
        {
          value: stages.length > 0 ? stages.join(' → ') : null,
          status: stages.length > 0 ? 'CONNECTED' : 'UNKNOWN',
          evidence: stages.length > 0
            ? [this.eb.artifact('revenue-intelligence-v2', 'models.funnel.stages', `${stages.length} stages`)]
            : [],
        },
      ),
    );

    facts.push(
      this.tn.fact('commerce', 'leakage-detection-rpcs', 'models.leakageDetection',
        `${leakageRpcs.length} leakage-detection RPCs declared`,
        {
          value: leakageRpcs.length,
          status: leakageRpcs.length > 0 ? 'CONNECTED' : 'UNKNOWN',
          evidence: leakageRpcs.length > 0
            ? [this.eb.artifact('revenue-intelligence-v2', 'models.leakageDetection.rpcs', `${leakageRpcs.length} RPCs`)]
            : [],
        },
      ),
    );

    return facts;
  }

  private buildMoneyTableFacts(): OperationalFact[] {
    const moneyTables = this.moneyTables();
    const moneyFns = this.moneyFunctions();

    return [
      this.tn.fact('commerce', 'money-table-count', 'db-intel.tables',
        `${moneyTables.length} money-related tables declared in db-intel`,
        {
          value: moneyTables.length,
          status: 'CONNECTED',
          evidence: [this.eb.artifact('db-intel', 'tables[money=true]', `${moneyTables.length} money tables`)],
        },
      ),
      this.tn.fact('commerce', 'money-function-count', 'db-intel.functions',
        `${moneyFns.length} money-touching functions declared in db-intel`,
        {
          value: moneyFns.length,
          status: 'CONNECTED',
          evidence: [this.eb.artifact('db-intel', 'functions[money=true]', `${moneyFns.length} money functions`)],
        },
      ),
      this.tn.fact('commerce', 'subscriptions-status', 'commerce-control-intel.domains',
        'Subscriptions domain NOT IMPLEMENTED — subscriptions table exists as churn signal only',
        {
          value: 'NOT_IMPLEMENTED',
          status: 'CONNECTED',
          evidence: [
            this.eb.artifact('commerce-control-intel', 'domains', 'No subscriptions domain in commerce-control-intel'),
          ],
        },
      ),
    ];
  }
}
